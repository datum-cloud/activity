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
	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

const (
	// retentionWindow is the ClickHouse retention window for audit logs and events.
	// Events older than this are pruned and cannot be reindexed.
	retentionWindow = 60 * 24 * time.Hour

	// statusUpdateRetries is the number of times to retry a status update before giving up.
	statusUpdateRetries = 3

	// statusUpdateRetryDelay is the delay between status update retry attempts.
	statusUpdateRetryDelay = 100 * time.Millisecond
)

// updateJobStatusWithRetry updates the ReindexJob status with retry logic.
// This prevents transient failures (like resource version conflicts) from leaving
// the job in an inconsistent state. Returns an error if all retries fail.
func (r *ReindexJobReconciler) updateJobStatusWithRetry(ctx context.Context, job *v1alpha1.ReindexJob, updateFn func(*v1alpha1.ReindexJob)) error {
	var lastErr error
	for i := 0; i < statusUpdateRetries; i++ {
		// Fetch latest version to avoid conflicts
		var latestJob v1alpha1.ReindexJob
		if err := r.Get(ctx, client.ObjectKeyFromObject(job), &latestJob); err != nil {
			lastErr = fmt.Errorf("failed to fetch latest ReindexJob: %w", err)
			time.Sleep(statusUpdateRetryDelay)
			continue
		}

		// Apply the update function to the latest version
		updateFn(&latestJob)

		// Try to update status
		if err := r.Status().Update(ctx, &latestJob); err != nil {
			lastErr = fmt.Errorf("failed to update ReindexJob status: %w", err)
			time.Sleep(statusUpdateRetryDelay)
			continue
		}

		// Success
		return nil
	}

	return fmt.Errorf("status update failed after %d retries: %w", statusUpdateRetries, lastErr)
}

// runReindexWorker is the background goroutine that processes a ReindexJob.
// It runs in the background and updates the job status as it progresses.
func (r *ReindexJobReconciler) runReindexWorker(ctx context.Context, job *v1alpha1.ReindexJob) {
	jobStartedAt := time.Now()

	// Always release the job slot when done
	defer func() {
		r.mu.Lock()
		r.runningJob = ""
		r.mu.Unlock()
		reindexJobsRunning.Dec()

		// Record job duration
		reindexJobDuration.Observe(time.Since(jobStartedAt).Seconds())
	}()

	logger := klog.LoggerWithValues(klog.Background(),
		"job", job.Name,
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
	// Parse effective timestamps using a single reference time for consistency.
	// This ensures relative times like "now-7d" and "now" are resolved at job start,
	// preventing sub-second drift between startTime and endTime calculations.
	now := time.Now()

	startTime, err := timeutil.ParseFlexibleTime(job.Spec.TimeRange.StartTime, now)
	if err != nil {
		// Update job with failure status
		var failJob v1alpha1.ReindexJob
		if getErr := r.Get(ctx, client.ObjectKeyFromObject(job), &failJob); getErr != nil {
			logger.Error(getErr, "failed to fetch ReindexJob for error status update")
			return
		}

		failJob.Status.Phase = v1alpha1.ReindexJobFailed
		failJob.Status.Message = fmt.Sprintf("Invalid startTime: %v", err)
		nowTime := metav1.Now()
		failJob.Status.CompletedAt = &nowTime

		meta.SetStatusCondition(&failJob.Status.Conditions, metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "InvalidStartTime",
			Message:            err.Error(),
			ObservedGeneration: failJob.Generation,
		})

		if statusErr := r.Status().Update(ctx, &failJob); statusErr != nil {
			logger.Error(statusErr, "failed to update ReindexJob status after startTime parse error")
		}
		r.Recorder.Event(&failJob, "Warning", "InvalidStartTime", err.Error())
		reindexJobsCompletedTotal.WithLabelValues("failed").Inc()
		return
	}

	// Default endTime to "now" if not specified
	endTimeStr := job.Spec.TimeRange.EndTime
	if endTimeStr == "" {
		endTimeStr = "now"
	}

	endTime, err := timeutil.ParseFlexibleTime(endTimeStr, now)
	if err != nil {
		// Update job with failure status
		var failJob v1alpha1.ReindexJob
		if getErr := r.Get(ctx, client.ObjectKeyFromObject(job), &failJob); getErr != nil {
			logger.Error(getErr, "failed to fetch ReindexJob for error status update")
			return
		}

		failJob.Status.Phase = v1alpha1.ReindexJobFailed
		failJob.Status.Message = fmt.Sprintf("Invalid endTime: %v", err)
		nowTime := metav1.Now()
		failJob.Status.CompletedAt = &nowTime

		meta.SetStatusCondition(&failJob.Status.Conditions, metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionFalse,
			Reason:             "InvalidEndTime",
			Message:            err.Error(),
			ObservedGeneration: failJob.Generation,
		})

		if statusErr := r.Status().Update(ctx, &failJob); statusErr != nil {
			logger.Error(statusErr, "failed to update ReindexJob status after endTime parse error")
		}
		r.Recorder.Event(&failJob, "Warning", "InvalidEndTime", err.Error())
		reindexJobsCompletedTotal.WithLabelValues("failed").Inc()
		return
	}

	// Validate retention window at execution time.
	// This is the actual check that matters - we validate against the retention
	// window when the job actually runs, not when it was created.
	// This prevents jobs that were created with valid times but queued for hours
	// from executing against pruned data.
	timeSinceStart := time.Since(startTime)
	if timeSinceStart > retentionWindow {
		updateErr := r.updateJobStatusWithRetry(ctx, job, func(j *v1alpha1.ReindexJob) {
			j.Status.Phase = v1alpha1.ReindexJobFailed
			j.Status.Message = fmt.Sprintf(
				"startTime exceeds ClickHouse retention window: data from %s is beyond the %d-day retention period (age: %dd). "+
					"ClickHouse has pruned this data. Use a more recent startTime.",
				startTime.Format(time.RFC3339),
				int(retentionWindow.Hours()/24),
				int(timeSinceStart.Hours()/24),
			)
			nowTime := metav1.Now()
			j.Status.CompletedAt = &nowTime

			meta.SetStatusCondition(&j.Status.Conditions, metav1.Condition{
				Type:               "Ready",
				Status:             metav1.ConditionFalse,
				Reason:             "RetentionWindowExceeded",
				Message:            j.Status.Message,
				ObservedGeneration: j.Generation,
			})
		})

		if updateErr != nil {
			logger.Error(updateErr, "failed to update ReindexJob status after retention validation failure")
		}

		logger.Error(nil, "ReindexJob failed: retention window exceeded",
			"startTime", startTime,
			"age", timeSinceStart,
			"retentionWindow", retentionWindow,
		)
		r.Recorder.Eventf(job, "Warning", "RetentionWindowExceeded",
			"startTime is beyond %d-day retention window", int(retentionWindow.Hours()/24))
		reindexJobsCompletedTotal.WithLabelValues("failed").Inc()
		return
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
		StartTime:   startTime,
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

	// Update final status with retry logic to prevent inconsistent state.
	// If status update fails, we retry to ensure the job doesn't stay in "Running"
	// with the slot released.
	completedAt := metav1.Now()

	statusUpdateErr := r.updateJobStatusWithRetry(ctx, job, func(finalJob *v1alpha1.ReindexJob) {
		finalJob.Status.CompletedAt = &completedAt

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
		}
	})

	if statusUpdateErr != nil {
		logger.Error(statusUpdateErr, "failed to update final ReindexJob status after retries",
			"runErr", runErr)
	}

	// Record events and metrics
	if runErr != nil {
		logger.Error(runErr, "ReindexJob failed")
		r.Recorder.Eventf(job, "Warning", "Failed", "Re-indexing failed: %v", runErr)
		reindexJobsCompletedTotal.WithLabelValues("failed").Inc()
	} else {
		var latestJob v1alpha1.ReindexJob
		if err := r.Get(ctx, client.ObjectKeyFromObject(job), &latestJob); err == nil {
			activitiesGenerated := int64(0)
			if latestJob.Status.Progress != nil {
				activitiesGenerated = latestJob.Status.Progress.ActivitiesGenerated
			}

			logger.Info("ReindexJob completed successfully",
				"activitiesGenerated", activitiesGenerated,
				"duration", time.Since(jobStartedAt),
			)
		}
		r.Recorder.Event(job, "Normal", "Completed", "Re-indexing completed successfully")
		reindexJobsCompletedTotal.WithLabelValues("succeeded").Inc()
	}
}
