package controller

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/record"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	ctrlmetrics "sigs.k8s.io/controller-runtime/pkg/metrics"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var (
	reindexJobsStartedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: "activity_controller",
			Name:      "reindex_jobs_started_total",
			Help:      "Total number of ReindexJob resources started",
		},
	)

	reindexJobsCompletedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "activity_controller",
			Name:      "reindex_jobs_completed_total",
			Help:      "Total number of ReindexJob resources completed",
		},
		[]string{"result"}, // result: succeeded, failed
	)

	reindexJobDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: "activity_controller",
			Name:      "reindex_job_duration_seconds",
			Help:      "Time spent running ReindexJob operations",
			Buckets:   prometheus.ExponentialBuckets(10, 2, 10), // 10s to ~2.8 hours
		},
	)

	reindexJobsRunning = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "activity_controller",
			Name:      "reindex_jobs_running",
			Help:      "Number of ReindexJob resources currently running",
		},
	)

	reindexJobsTTLDeletedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: "activity_controller",
			Name:      "reindex_jobs_ttl_deleted_total",
			Help:      "Total number of ReindexJob resources deleted due to TTL expiration",
		},
	)
)

func init() {
	ctrlmetrics.Registry.MustRegister(
		reindexJobsStartedTotal,
		reindexJobsCompletedTotal,
		reindexJobDuration,
		reindexJobsRunning,
		reindexJobsTTLDeletedTotal,
	)
}

// ReindexJobReconciler reconciles ReindexJob resources.
type ReindexJobReconciler struct {
	client.Client
	Scheme    *runtime.Scheme
	JetStream nats.JetStreamContext
	Recorder  record.EventRecorder

	// Concurrency control - only one job can run at a time.
	// Since ReindexJob is cluster-scoped, we only track the job name (not namespace).
	// Empty string means no job is currently running.
	runningJob string
	mu         sync.Mutex

	// Context for graceful shutdown of worker goroutines
	workerCtx    context.Context
	workerCancel context.CancelFunc
}

// +kubebuilder:rbac:groups=activity.miloapis.com,resources=reindexjobs,verbs=get;list;watch;update;patch;delete
// +kubebuilder:rbac:groups=activity.miloapis.com,resources=reindexjobs/status,verbs=update;patch
// +kubebuilder:rbac:groups=activity.miloapis.com,resources=auditlogqueries,verbs=create
// +kubebuilder:rbac:groups=activity.miloapis.com,resources=eventqueries,verbs=create
// +kubebuilder:rbac:groups=activity.miloapis.com,resources=activitypolicies,verbs=get;list
// +kubebuilder:rbac:groups="",resources=events,verbs=create;patch

// Reconcile handles the reconciliation of a ReindexJob resource.
func (r *ReindexJobReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := klog.FromContext(ctx)

	// Fetch the ReindexJob
	var job v1alpha1.ReindexJob
	if err := r.Get(ctx, req.NamespacedName, &job); err != nil {
		if client.IgnoreNotFound(err) != nil {
			logger.Error(err, "unable to fetch ReindexJob")
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, nil
	}

	// Handle TTL-based cleanup for completed jobs
	if job.Status.Phase == v1alpha1.ReindexJobSucceeded ||
		job.Status.Phase == v1alpha1.ReindexJobFailed {
		return r.handleTTLCleanup(ctx, &job)
	}

	// Check if another job is running (mutex-protected)
	r.mu.Lock()
	if r.runningJob != "" && r.runningJob != req.Name {
		r.mu.Unlock()
		// Queue this job
		if job.Status.Phase != v1alpha1.ReindexJobPending {
			job.Status.Phase = v1alpha1.ReindexJobPending
			job.Status.Message = fmt.Sprintf("Waiting for %s to complete", r.runningJob)
			meta.SetStatusCondition(&job.Status.Conditions, metav1.Condition{
				Type:               "Ready",
				Status:             metav1.ConditionFalse,
				Reason:             "Pending",
				Message:            job.Status.Message,
				ObservedGeneration: job.Generation,
			})
			if err := r.Status().Update(ctx, &job); err != nil {
				logger.Error(err, "failed to update ReindexJob status to Pending")
				return ctrl.Result{}, err
			}
			r.Recorder.Event(&job, "Normal", "Queued", job.Status.Message)
		}
		return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
	}
	r.mu.Unlock()

	// Start or continue processing
	switch job.Status.Phase {
	case "", v1alpha1.ReindexJobPending:
		return r.startJob(ctx, &job)
	case v1alpha1.ReindexJobRunning:
		// Job already running, check progress
		logger.V(4).Info("ReindexJob already running", "job", req.NamespacedName)
		return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
	}

	return ctrl.Result{}, nil
}

// handleTTLCleanup checks if a completed job should be deleted based on TTL.
func (r *ReindexJobReconciler) handleTTLCleanup(ctx context.Context, job *v1alpha1.ReindexJob) (ctrl.Result, error) {
	logger := klog.FromContext(ctx)

	// TTL not set - retain indefinitely
	if job.Spec.TTLSecondsAfterFinished == nil {
		logger.V(4).Info("ReindexJob completed, no TTL set", "phase", job.Status.Phase)
		return ctrl.Result{}, nil
	}

	// CompletedAt not set yet - this shouldn't happen for completed jobs, but handle gracefully
	if job.Status.CompletedAt == nil {
		logger.V(4).Info("ReindexJob completed but CompletedAt not set, skipping TTL cleanup", "phase", job.Status.Phase)
		return ctrl.Result{}, nil
	}

	// Calculate expiration time
	ttlDuration := time.Duration(*job.Spec.TTLSecondsAfterFinished) * time.Second
	expirationTime := job.Status.CompletedAt.Add(ttlDuration)
	now := time.Now()

	// Check if TTL has expired
	if now.Before(expirationTime) {
		// Not yet expired - requeue after remaining TTL duration
		remainingTTL := expirationTime.Sub(now)
		// Ensure minimum requeue duration to avoid busy-looping
		if remainingTTL < time.Second {
			remainingTTL = time.Second
		}
		logger.V(4).Info("ReindexJob not yet expired",
			"phase", job.Status.Phase,
			"completedAt", job.Status.CompletedAt.Time,
			"ttlSeconds", *job.Spec.TTLSecondsAfterFinished,
			"remainingTTL", remainingTTL,
		)
		return ctrl.Result{RequeueAfter: remainingTTL}, nil
	}

	// TTL expired - delete the job
	logger.Info("Deleting expired ReindexJob",
		"job", job.Name,
		"phase", job.Status.Phase,
		"completedAt", job.Status.CompletedAt.Time,
		"ttlSeconds", *job.Spec.TTLSecondsAfterFinished,
	)

	// Emit event before deletion
	r.Recorder.Event(job, "Normal", "TTLExpired",
		fmt.Sprintf("ReindexJob deleted after %d seconds TTL", *job.Spec.TTLSecondsAfterFinished))

	// Delete the resource
	if err := r.Delete(ctx, job); err != nil {
		logger.Error(err, "failed to delete expired ReindexJob")
		return ctrl.Result{}, err
	}

	reindexJobsTTLDeletedTotal.Inc()
	logger.Info("Successfully deleted expired ReindexJob", "job", job.Name)
	return ctrl.Result{}, nil
}

// startJob claims the job slot and starts the worker goroutine.
func (r *ReindexJobReconciler) startJob(ctx context.Context, job *v1alpha1.ReindexJob) (ctrl.Result, error) {
	logger := klog.FromContext(ctx)

	// Claim the job slot under mutex protection
	r.mu.Lock()
	if r.runningJob != "" {
		r.mu.Unlock()
		// Another job claimed the slot, requeue
		return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
	}
	r.runningJob = job.Name
	r.mu.Unlock()

	// Update status to Running
	job.Status.Phase = v1alpha1.ReindexJobRunning
	now := metav1.Now()
	job.Status.StartedAt = &now
	job.Status.Message = "Starting re-indexing operation"
	meta.SetStatusCondition(&job.Status.Conditions, metav1.Condition{
		Type:               "Ready",
		Status:             metav1.ConditionFalse,
		Reason:             "InProgress",
		Message:            "Re-indexing in progress",
		ObservedGeneration: job.Generation,
	})

	if err := r.Status().Update(ctx, job); err != nil {
		logger.Error(err, "failed to update ReindexJob status to Running")
		// Release the slot on error
		r.mu.Lock()
		r.runningJob = ""
		r.mu.Unlock()
		return ctrl.Result{}, err
	}

	// Log job details with nil-safe config access
	batchSize := int32(1000) // default
	dryRun := false
	if job.Spec.Config != nil {
		batchSize = job.Spec.Config.BatchSize
		dryRun = job.Spec.Config.DryRun
	}
	logger.Info("Starting ReindexJob",
		"job", job.Name,
		"startTime", job.Spec.TimeRange.StartTime,
		"endTime", job.Spec.TimeRange.EndTime,
		"batchSize", batchSize,
		"dryRun", dryRun,
	)

	// Record metrics
	reindexJobsStartedTotal.Inc()
	reindexJobsRunning.Inc()

	// Emit Started event
	endTimeDisplay := job.Spec.TimeRange.EndTime
	if endTimeDisplay == "" {
		endTimeDisplay = "now"
	}
	r.Recorder.Event(job, "Normal", "Started", fmt.Sprintf("Started re-indexing from %s to %s",
		job.Spec.TimeRange.StartTime, endTimeDisplay))

	// Start worker goroutine with cancellable context for graceful shutdown
	go r.runReindexWorker(r.workerCtx, job)

	return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *ReindexJobReconciler) SetupWithManager(mgr ctrl.Manager, maxConcurrentReconciles int) error {
	// Initialize worker context for graceful shutdown
	// The context is cancelled when the manager stops
	r.workerCtx, r.workerCancel = context.WithCancel(context.Background())

	// Register cleanup when manager stops
	if err := mgr.Add(&managerRunnable{cancel: r.workerCancel}); err != nil {
		return fmt.Errorf("failed to register shutdown handler: %w", err)
	}

	// Verify NATS ACTIVITIES_REINDEX stream exists at startup
	stream, err := r.JetStream.StreamInfo("ACTIVITIES_REINDEX")
	if err != nil {
		return fmt.Errorf("ACTIVITIES_REINDEX stream not found - run Phase 0 infrastructure setup: %w", err)
	}
	klog.InfoS("NATS stream verified", "stream", stream.Config.Name, "subjects", stream.Config.Subjects)

	return ctrl.NewControllerManagedBy(mgr).
		For(&v1alpha1.ReindexJob{}).
		WithOptions(controller.Options{
			MaxConcurrentReconciles: maxConcurrentReconciles,
		}).
		Complete(r)
}

// Helper functions
// (removed formatEndTime - no longer needed with string-based time fields)

// managerRunnable implements manager.Runnable to cancel worker context on shutdown.
type managerRunnable struct {
	cancel context.CancelFunc
}

func (r *managerRunnable) Start(ctx context.Context) error {
	// Wait for context cancellation (manager shutdown)
	<-ctx.Done()
	// Cancel worker context to stop any running workers
	r.cancel()
	return nil
}
