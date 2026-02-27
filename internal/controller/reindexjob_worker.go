package controller

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"go.miloapis.com/activity/internal/reindex"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// runReindexWorker is the background goroutine that processes a ReindexJob.
// It runs in the background and updates the job status as it progresses.
func (r *ReindexJobReconciler) runReindexWorker(ctx context.Context, job *v1alpha1.ReindexJob) {
	startTime := time.Now()

	// Always release the job slot when done
	defer func() {
		r.mu.Lock()
		r.runningJob = nil
		r.mu.Unlock()
		reindexJobsRunning.Dec()

		// Record job duration
		reindexJobDuration.WithLabelValues(job.Namespace).Observe(time.Since(startTime).Seconds())
	}()

	logger := klog.LoggerWithValues(klog.Background(),
		"job", job.Name,
		"namespace", job.Namespace,
	)

	// Create reindexer with dependencies
	reindexer := reindex.NewReindexer(r.Client, r.JetStream)

	// Set up progress callback to update ReindexJob status
	reindexer.OnProgress = func(progress reindex.Progress) {
		var latestJob v1alpha1.ReindexJob
		if err := r.Get(ctx, client.ObjectKeyFromObject(job), &latestJob); err != nil {
			logger.Error(err, "failed to fetch latest ReindexJob for progress update")
			return
		}

		latestJob.Status.Progress = &v1alpha1.ReindexProgress{
			TotalEvents:         progress.TotalEvents,
			ProcessedEvents:     progress.ProcessedEvents,
			ActivitiesGenerated: progress.ActivitiesGenerated,
			Errors:              progress.Errors,
			CurrentBatch:        progress.CurrentBatch,
			TotalBatches:        progress.TotalBatches,
		}

		latestJob.Status.Message = fmt.Sprintf("Processing: %d events processed, %d activities generated",
			progress.ProcessedEvents, progress.ActivitiesGenerated)

		if err := r.Status().Update(ctx, &latestJob); err != nil {
			// Log at V(2) for better visibility - progress update failures may indicate resource version conflicts
			logger.V(2).Info("failed to update progress (will retry on next batch)", "error", err)
		}
	}

	// Build reindex options from job spec
	endTime := time.Now()
	if job.Spec.TimeRange.EndTime != nil {
		endTime = job.Spec.TimeRange.EndTime.Time
	}

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
		StartTime:   job.Spec.TimeRange.StartTime.Time,
		EndTime:     endTime,
		BatchSize:   batchSize,
		RateLimit:   rateLimit,
		DryRun:      dryRun,
		PolicyNames: policyNames,
		MatchLabels: matchLabels,
	}

	logger.Info("Starting reindex operation",
		"startTime", opts.StartTime,
		"endTime", opts.EndTime,
		"batchSize", opts.BatchSize,
		"rateLimit", opts.RateLimit,
		"dryRun", opts.DryRun,
		"policyNames", policyNames,
		"matchLabels", matchLabels,
	)

	// Run the reindexer
	runErr := reindexer.Run(ctx, opts)

	// Fetch latest version of job for final status update
	var finalJob v1alpha1.ReindexJob
	if err := r.Get(ctx, client.ObjectKeyFromObject(job), &finalJob); err != nil {
		logger.Error(err, "failed to fetch ReindexJob for final status update")
		return
	}

	now := metav1.Now()
	finalJob.Status.CompletedAt = &now

	if runErr != nil {
		// Job failed
		finalJob.Status.Phase = v1alpha1.ReindexJobFailed
		finalJob.Status.Message = fmt.Sprintf("Re-indexing failed: %v", runErr)

		meta.SetStatusCondition(&finalJob.Status.Conditions, metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "Failed",
			Message:            runErr.Error(),
			ObservedGeneration: finalJob.Generation,
		})

		logger.Error(runErr, "ReindexJob failed")
		r.Recorder.Event(&finalJob, "Warning", "Failed", finalJob.Status.Message)
		reindexJobsCompletedTotal.WithLabelValues(finalJob.Namespace, "failed").Inc()
	} else {
		// Job succeeded
		finalJob.Status.Phase = v1alpha1.ReindexJobSucceeded

		activitiesGenerated := int64(0)
		if finalJob.Status.Progress != nil {
			activitiesGenerated = finalJob.Status.Progress.ActivitiesGenerated
		}

		if dryRun {
			finalJob.Status.Message = fmt.Sprintf("Dry-run complete: %d activities would be generated", activitiesGenerated)
		} else {
			finalJob.Status.Message = fmt.Sprintf("Completed: %d activities generated", activitiesGenerated)
		}

		meta.SetStatusCondition(&finalJob.Status.Conditions, metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionTrue,
			Reason:             "Succeeded",
			Message:            "Re-indexing completed successfully",
			ObservedGeneration: finalJob.Generation,
		})

		logger.Info("ReindexJob completed successfully",
			"activitiesGenerated", activitiesGenerated,
			"duration", time.Since(startTime),
		)
		r.Recorder.Event(&finalJob, "Normal", "Completed", finalJob.Status.Message)
		reindexJobsCompletedTotal.WithLabelValues(finalJob.Namespace, "succeeded").Inc()
	}

	// Update final status
	if err := r.Status().Update(ctx, &finalJob); err != nil {
		logger.Error(err, "failed to update final ReindexJob status",
			"phase", finalJob.Status.Phase)
	}
}
