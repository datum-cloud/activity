package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"go.miloapis.com/activity/internal/controller"
	"go.miloapis.com/activity/internal/reindex"
	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

const (
	retentionWindow = 60 * 24 * time.Hour
)

// ReindexWorkerOptions contains configuration for the reindex worker.
type ReindexWorkerOptions struct {
	// The ReindexJob resource name
	JobName string

	// NATS configuration (required for publishing activities)
	NATSURL        string
	NATSTLSEnabled bool
	NATSTLSCertFile string
	NATSTLSKeyFile  string
	NATSTLSCAFile   string
}

// NewReindexWorkerOptions creates options with default values.
func NewReindexWorkerOptions() *ReindexWorkerOptions {
	return &ReindexWorkerOptions{}
}

// AddFlags adds reindex worker flags to the command.
func (o *ReindexWorkerOptions) AddFlags(fs *pflag.FlagSet) {
	// NATS flags (required)
	fs.StringVar(&o.NATSURL, "nats-url", o.NATSURL,
		"NATS server URL (e.g., nats://localhost:4222). Required.")
	fs.BoolVar(&o.NATSTLSEnabled, "nats-tls-enabled", o.NATSTLSEnabled,
		"Enable TLS for NATS connection.")
	fs.StringVar(&o.NATSTLSCertFile, "nats-tls-cert-file", o.NATSTLSCertFile,
		"Path to client certificate file for NATS TLS.")
	fs.StringVar(&o.NATSTLSKeyFile, "nats-tls-key-file", o.NATSTLSKeyFile,
		"Path to client private key file for NATS TLS.")
	fs.StringVar(&o.NATSTLSCAFile, "nats-tls-ca-file", o.NATSTLSCAFile,
		"Path to CA certificate file for NATS TLS.")
}

// NewReindexWorkerCommand creates the reindex-worker subcommand.
func NewReindexWorkerCommand() *cobra.Command {
	options := NewReindexWorkerOptions()

	cmd := &cobra.Command{
		Use:   "reindex-worker <reindexjob-name>",
		Short: "Run a single ReindexJob worker",
		Long: `Run the reindex worker for a specific ReindexJob resource.
This is executed by Kubernetes Jobs created by the controller-manager.
It should not be run manually.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			options.JobName = args[0]
			return RunReindexWorker(cmd.Context(), options)
		},
	}

	options.AddFlags(cmd.Flags())

	return cmd
}

// RunReindexWorker executes the reindex job worker.
func RunReindexWorker(ctx context.Context, options *ReindexWorkerOptions) error {
	// Validate required flags
	if options.NATSURL == "" {
		return fmt.Errorf("--nats-url is required")
	}

	if options.JobName == "" {
		return fmt.Errorf("reindexjob name is required")
	}

	klog.InfoS("Starting reindex worker", "job", options.JobName)

	// Build in-cluster Kubernetes client
	config, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	// Create Kubernetes client
	scheme := controller.Scheme
	cl, err := client.New(config, client.Options{Scheme: scheme})
	if err != nil {
		return fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	// Fetch the ReindexJob resource
	var job v1alpha1.ReindexJob
	if err := cl.Get(ctx, types.NamespacedName{Name: options.JobName}, &job); err != nil {
		return fmt.Errorf("failed to fetch ReindexJob %s: %w", options.JobName, err)
	}

	klog.InfoS("Loaded ReindexJob", "name", job.Name, "generation", job.Generation)

	// Initialize NATS JetStream connection
	klog.InfoS("Connecting to NATS", "url", options.NATSURL)
	natsOpts, err := buildNATSOptions(options)
	if err != nil {
		return fmt.Errorf("failed to build NATS options: %w", err)
	}

	natsConn, err := nats.Connect(options.NATSURL, natsOpts...)
	if err != nil {
		return fmt.Errorf("failed to connect to NATS: %w", err)
	}
	defer natsConn.Close()

	js, err := natsConn.JetStream()
	if err != nil {
		return fmt.Errorf("failed to get JetStream context: %w", err)
	}

	// Update status to Running
	if err := updateJobPhase(ctx, cl, &job, v1alpha1.ReindexJobRunning, "Re-indexing in progress"); err != nil {
		return fmt.Errorf("failed to update status to Running: %w", err)
	}

	// Create reindexer
	reindexer := reindex.NewReindexer(cl, js)

	// Set up progress callback to update ReindexJob status
	reindexer.OnProgress = func(progress reindex.Progress) {
		if err := updateJobProgress(ctx, cl, &job, progress); err != nil {
			klog.V(2).InfoS("failed to update progress (will retry on next batch)", "error", err)
		}
	}

	// Parse time range
	now := time.Now()
	startTime, err := timeutil.ParseFlexibleTime(job.Spec.TimeRange.StartTime, now)
	if err != nil {
		updateJobPhase(ctx, cl, &job, v1alpha1.ReindexJobFailed, fmt.Sprintf("Invalid startTime: %v", err))
		return fmt.Errorf("invalid startTime: %w", err)
	}

	endTimeStr := job.Spec.TimeRange.EndTime
	if endTimeStr == "" {
		endTimeStr = "now"
	}
	endTime, err := timeutil.ParseFlexibleTime(endTimeStr, now)
	if err != nil {
		updateJobPhase(ctx, cl, &job, v1alpha1.ReindexJobFailed, fmt.Sprintf("Invalid endTime: %v", err))
		return fmt.Errorf("invalid endTime: %w", err)
	}

	// Validate retention window
	timeSinceStart := time.Since(startTime)
	if timeSinceStart > retentionWindow {
		msg := fmt.Sprintf(
			"startTime exceeds ClickHouse retention window: data from %s is beyond the %d-day retention period (age: %dd)",
			startTime.Format(time.RFC3339),
			int(retentionWindow.Hours()/24),
			int(timeSinceStart.Hours()/24),
		)
		updateJobPhase(ctx, cl, &job, v1alpha1.ReindexJobFailed, msg)
		return fmt.Errorf("retention window exceeded")
	}

	// Build reindex options
	batchSize := int32(1000)
	if job.Spec.Config != nil && job.Spec.Config.BatchSize > 0 {
		batchSize = job.Spec.Config.BatchSize
	}

	rateLimit := int32(100)
	if job.Spec.Config != nil && job.Spec.Config.RateLimit > 0 {
		rateLimit = job.Spec.Config.RateLimit
	}

	dryRun := false
	if job.Spec.Config != nil {
		dryRun = job.Spec.Config.DryRun
	}

	var policyNames []string
	var matchLabels map[string]string
	if job.Spec.PolicySelector != nil {
		if len(job.Spec.PolicySelector.Names) > 0 {
			policyNames = job.Spec.PolicySelector.Names
		}
		if len(job.Spec.PolicySelector.MatchLabels) > 0 {
			matchLabels = job.Spec.PolicySelector.MatchLabels
		}
	}

	opts := reindex.Options{
		StartTime:   startTime,
		EndTime:     endTime,
		BatchSize:   batchSize,
		RateLimit:   rateLimit,
		DryRun:      dryRun,
		PolicyNames: policyNames,
		MatchLabels: matchLabels,
	}

	klog.InfoS("Starting reindex operation",
		"startTime", opts.StartTime,
		"endTime", opts.EndTime,
		"batchSize", opts.BatchSize,
		"rateLimit", opts.RateLimit,
		"dryRun", opts.DryRun,
	)

	// Run the reindexer
	runErr := reindexer.Run(ctx, opts)

	// Update final status
	if runErr != nil {
		msg := fmt.Sprintf("Re-indexing failed: %v", runErr)
		if err := updateJobPhase(ctx, cl, &job, v1alpha1.ReindexJobFailed, msg); err != nil {
			klog.ErrorS(err, "failed to update status to Failed")
		}
		return runErr
	}

	// Success
	var finalJob v1alpha1.ReindexJob
	if err := cl.Get(ctx, types.NamespacedName{Name: job.Name}, &finalJob); err == nil {
		activitiesGenerated := int64(0)
		if finalJob.Status.Progress != nil {
			activitiesGenerated = finalJob.Status.Progress.ActivitiesGenerated
		}

		var msg string
		if dryRun {
			msg = fmt.Sprintf("Dry-run complete: %d activities would be generated", activitiesGenerated)
		} else {
			msg = fmt.Sprintf("Completed: %d activities generated", activitiesGenerated)
		}

		if err := updateJobPhase(ctx, cl, &finalJob, v1alpha1.ReindexJobSucceeded, msg); err != nil {
			klog.ErrorS(err, "failed to update status to Succeeded")
		}

		klog.InfoS("Reindex job completed successfully",
			"activitiesGenerated", activitiesGenerated,
		)
	}

	return nil
}

// updateJobPhase updates the ReindexJob phase and message, setting CompletedAt for terminal phases.
func updateJobPhase(ctx context.Context, cl client.Client, job *v1alpha1.ReindexJob, phase v1alpha1.ReindexJobPhase, message string) error {
	// Fetch latest version
	var latest v1alpha1.ReindexJob
	if err := cl.Get(ctx, types.NamespacedName{Name: job.Name}, &latest); err != nil {
		return err
	}

	latest.Status.Phase = phase
	latest.Status.Message = message

	// Set CompletedAt for terminal phases
	if phase == v1alpha1.ReindexJobSucceeded || phase == v1alpha1.ReindexJobFailed {
		now := metav1.Now()
		latest.Status.CompletedAt = &now
	}

	// Set StartedAt for Running phase if not already set
	if phase == v1alpha1.ReindexJobRunning && latest.Status.StartedAt == nil {
		now := metav1.Now()
		latest.Status.StartedAt = &now
	}

	// Update conditions
	var conditionStatus metav1.ConditionStatus
	var reason string
	switch phase {
	case v1alpha1.ReindexJobPending:
		conditionStatus = metav1.ConditionFalse
		reason = "Pending"
	case v1alpha1.ReindexJobRunning:
		conditionStatus = metav1.ConditionFalse
		reason = "InProgress"
	case v1alpha1.ReindexJobSucceeded:
		conditionStatus = metav1.ConditionTrue
		reason = "Succeeded"
	case v1alpha1.ReindexJobFailed:
		conditionStatus = metav1.ConditionFalse
		reason = "Failed"
	}

	meta.SetStatusCondition(&latest.Status.Conditions, metav1.Condition{
		Type:               "Ready",
		Status:             conditionStatus,
		Reason:             reason,
		Message:            message,
		ObservedGeneration: latest.Generation,
	})

	return cl.Status().Update(ctx, &latest)
}

// updateJobProgress updates the ReindexJob progress information.
func updateJobProgress(ctx context.Context, cl client.Client, job *v1alpha1.ReindexJob, progress reindex.Progress) error {
	// Fetch latest version
	var latest v1alpha1.ReindexJob
	if err := cl.Get(ctx, types.NamespacedName{Name: job.Name}, &latest); err != nil {
		return err
	}

	latest.Status.Progress = &v1alpha1.ReindexProgress{
		TotalEvents:         progress.TotalEvents,
		ProcessedEvents:     progress.ProcessedEvents,
		ActivitiesGenerated: progress.ActivitiesGenerated,
		Errors:              progress.Errors,
		CurrentBatch:        progress.CurrentBatch,
		TotalBatches:        progress.TotalBatches,
	}

	latest.Status.Message = fmt.Sprintf("Processing: %d events processed, %d activities generated",
		progress.ProcessedEvents, progress.ActivitiesGenerated)

	return cl.Status().Update(ctx, &latest)
}

// buildNATSOptions constructs NATS connection options from configuration.
func buildNATSOptions(options *ReindexWorkerOptions) ([]nats.Option, error) {
	var natsOpts []nats.Option

	// Configure TLS if enabled
	if options.NATSTLSEnabled {
		tlsConfig := &tls.Config{
			MinVersion: tls.VersionTLS12,
		}

		// Load client cert/key if provided
		if options.NATSTLSCertFile != "" && options.NATSTLSKeyFile != "" {
			cert, err := tls.LoadX509KeyPair(options.NATSTLSCertFile, options.NATSTLSKeyFile)
			if err != nil {
				return nil, fmt.Errorf("failed to load NATS TLS client cert: %w", err)
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}

		// Load CA cert if provided
		if options.NATSTLSCAFile != "" {
			caCert, err := os.ReadFile(options.NATSTLSCAFile)
			if err != nil {
				return nil, fmt.Errorf("failed to read NATS TLS CA file: %w", err)
			}
			caCertPool := x509.NewCertPool()
			if !caCertPool.AppendCertsFromPEM(caCert) {
				return nil, fmt.Errorf("failed to parse NATS TLS CA certificate")
			}
			tlsConfig.RootCAs = caCertPool
		}

		natsOpts = append(natsOpts, nats.Secure(tlsConfig))
	}

	return natsOpts, nil
}
