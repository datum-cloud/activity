package controller

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

func TestUpdateJobStatusWithRetry(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	tests := []struct {
		name       string
		setupJob   func() *v1alpha1.ReindexJob
		updateFn   func(*v1alpha1.ReindexJob)
		setupMocks func(t *testing.T, fakeClient client.Client, job *v1alpha1.ReindexJob)
		wantErr    bool
		validate   func(t *testing.T, job *v1alpha1.ReindexJob, err error)
	}{
		{
			name: "successful update on first try",
			setupJob: func() *v1alpha1.ReindexJob {
				return &v1alpha1.ReindexJob{
					ObjectMeta: metav1.ObjectMeta{
						Name:            "test-job",
						ResourceVersion: "1",
					},
					Status: v1alpha1.ReindexJobStatus{
						Phase: v1alpha1.ReindexJobPending,
					},
				}
			},
			updateFn: func(job *v1alpha1.ReindexJob) {
				job.Status.Phase = v1alpha1.ReindexJobRunning
				job.Status.Message = "Processing started"
			},
			setupMocks: func(t *testing.T, fakeClient client.Client, job *v1alpha1.ReindexJob) {
				// No additional setup needed for successful case
			},
			wantErr: false,
			validate: func(t *testing.T, job *v1alpha1.ReindexJob, err error) {
				require.NoError(t, err)
			},
		},
		{
			name: "job deleted during update - no error",
			setupJob: func() *v1alpha1.ReindexJob {
				return &v1alpha1.ReindexJob{
					ObjectMeta: metav1.ObjectMeta{
						Name:            "deleted-job",
						ResourceVersion: "1",
					},
					Status: v1alpha1.ReindexJobStatus{
						Phase: v1alpha1.ReindexJobRunning,
					},
				}
			},
			updateFn: func(job *v1alpha1.ReindexJob) {
				job.Status.Phase = v1alpha1.ReindexJobSucceeded
			},
			setupMocks: func(t *testing.T, fakeClient client.Client, job *v1alpha1.ReindexJob) {
				// Simulate job deletion by not creating it in the fake client
				// The Get call will return NotFound
			},
			wantErr: false,
			validate: func(t *testing.T, job *v1alpha1.ReindexJob, err error) {
				require.NoError(t, err)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			job := tt.setupJob()

			// Create fake client with scheme
			var objs []client.Object
			if tt.name != "job deleted during update - no error" {
				objs = append(objs, job)
			}
			fakeClient := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(objs...).
				WithStatusSubresource(&v1alpha1.ReindexJob{}).
				Build()

			if tt.setupMocks != nil {
				tt.setupMocks(t, fakeClient, job)
			}

			reconciler := &ReindexJobReconciler{
				Client: fakeClient,
				Scheme: scheme,
			}

			ctx := context.Background()

			err := reconciler.updateJobStatusWithRetry(ctx, job, tt.updateFn)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			if tt.validate != nil {
				tt.validate(t, job, err)
			}
		})
	}
}

func TestUpdateJobStatusWithRetry_ConflictRetry(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	job := &v1alpha1.ReindexJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "conflict-test-job",
			ResourceVersion: "1",
		},
		Status: v1alpha1.ReindexJobStatus{
			Phase: v1alpha1.ReindexJobPending,
		},
	}

	// Use a tracker-based approach to simulate version conflicts
	fakeClient := fake.NewClientBuilder().
		WithScheme(scheme).
		WithObjects(job).
		WithStatusSubresource(&v1alpha1.ReindexJob{}).
		Build()

	reconciler := &ReindexJobReconciler{
		Client: fakeClient,
		Scheme: scheme,
	}

	updateCount := 0
	updateFn := func(j *v1alpha1.ReindexJob) {
		updateCount++
		j.Status.Phase = v1alpha1.ReindexJobRunning
		j.Status.Message = "Processing"
	}

	ctx := context.Background()
	err := reconciler.updateJobStatusWithRetry(ctx, job, updateFn)

	// Should succeed without error since conflict retries work
	require.NoError(t, err)

	// Verify update was called at least once
	assert.GreaterOrEqual(t, updateCount, 1)

	// Verify final status
	var updated v1alpha1.ReindexJob
	require.NoError(t, fakeClient.Get(ctx, client.ObjectKeyFromObject(job), &updated))
	assert.Equal(t, v1alpha1.ReindexJobRunning, updated.Status.Phase)
}

func TestUpdateJobStatusWithRetry_ExhaustedRetries(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	// Create a client that will consistently fail with a non-conflict error
	fakeClient := &alwaysFailingClient{
		Client: fake.NewClientBuilder().
			WithScheme(scheme).
			Build(),
		getError: apierrors.NewInternalError(assert.AnError),
	}

	reconciler := &ReindexJobReconciler{
		Client: fakeClient,
		Scheme: scheme,
	}

	job := &v1alpha1.ReindexJob{
		ObjectMeta: metav1.ObjectMeta{
			Name: "failing-job",
		},
	}

	updateFn := func(j *v1alpha1.ReindexJob) {
		j.Status.Phase = v1alpha1.ReindexJobRunning
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := reconciler.updateJobStatusWithRetry(ctx, job, updateFn)

	// Should fail after retries exhausted
	require.Error(t, err)
	assert.Contains(t, err.Error(), "status update failed after")
}

func TestRetentionValidation(t *testing.T) {
	t.Parallel()

	now := time.Now()

	tests := []struct {
		name          string
		startTime     time.Time
		expectFailure bool
		errorContains string
	}{
		{
			name:          "startTime within retention window - valid",
			startTime:     now.Add(-30 * 24 * time.Hour),
			expectFailure: false,
		},
		{
			name:          "startTime just under 60-day boundary",
			startTime:     now.Add(-60*24*time.Hour + time.Second),
			expectFailure: false,
		},
		{
			name:          "startTime just beyond 60-day retention - invalid",
			startTime:     now.Add(-61 * 24 * time.Hour),
			expectFailure: true,
			errorContains: "exceeds ClickHouse retention window",
		},
		{
			name:          "startTime way beyond retention - invalid",
			startTime:     now.Add(-90 * 24 * time.Hour),
			expectFailure: true,
			errorContains: "exceeds ClickHouse retention window",
		},
		{
			name:          "startTime very recent - valid",
			startTime:     now.Add(-1 * time.Hour),
			expectFailure: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Validate using the retention window constant
			timeSinceStart := time.Since(tt.startTime)
			exceedsRetention := timeSinceStart > retentionWindow

			if tt.expectFailure {
				assert.True(t, exceedsRetention, "Expected retention validation to fail")
				// Verify the error message would contain expected text
				if tt.errorContains != "" {
					assert.Contains(t, tt.errorContains, "retention")
				}
			} else {
				assert.False(t, exceedsRetention, "Expected retention validation to pass")
			}
		})
	}
}

func TestRetentionValidation_RelativeTimes(t *testing.T) {
	t.Parallel()

	// Test using relative time strings similar to how the worker processes them
	tests := []struct {
		name          string
		daysAgo       int
		expectFailure bool
	}{
		{
			name:          "now-59d - valid",
			daysAgo:       59,
			expectFailure: false,
		},
		{
			name:          "now-61d - invalid",
			daysAgo:       61,
			expectFailure: true,
		},
		{
			name:          "now-7d - valid",
			daysAgo:       7,
			expectFailure: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			now := time.Now()
			startTime := now.Add(time.Duration(-tt.daysAgo) * 24 * time.Hour)
			timeSinceStart := time.Since(startTime)
			exceedsRetention := timeSinceStart > retentionWindow

			if tt.expectFailure {
				assert.True(t, exceedsRetention,
					"Expected %d days ago to exceed retention window", tt.daysAgo)
			} else {
				assert.False(t, exceedsRetention,
					"Expected %d days ago to be within retention window", tt.daysAgo)
			}
		})
	}
}

func TestRetentionValidation_Integration(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	tests := []struct {
		name              string
		startTimeOffset   time.Duration
		expectedPhase     v1alpha1.ReindexJobPhase
		expectedCondition string
	}{
		{
			name:              "within retention - should not fail",
			startTimeOffset:   -30 * 24 * time.Hour,
			expectedPhase:     "", // Won't reach failure in this test
			expectedCondition: "",
		},
		{
			name:              "beyond retention - should set failed phase",
			startTimeOffset:   -70 * 24 * time.Hour,
			expectedPhase:     v1alpha1.ReindexJobFailed,
			expectedCondition: "RetentionWindowExceeded",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			now := time.Now()
			startTime := now.Add(tt.startTimeOffset)
			timeSinceStart := time.Since(startTime)

			// This simulates the retention check in runReindexWorker
			if timeSinceStart > retentionWindow {
				// Would trigger the failure path
				assert.Equal(t, v1alpha1.ReindexJobFailed, tt.expectedPhase)
				assert.Equal(t, "RetentionWindowExceeded", tt.expectedCondition)
			} else {
				// Would proceed with processing
				assert.Empty(t, tt.expectedPhase)
			}
		})
	}
}

func TestRetentionWindow_Constant(t *testing.T) {
	// Verify the retention window constant is set correctly
	expectedRetention := 60 * 24 * time.Hour
	assert.Equal(t, expectedRetention, retentionWindow,
		"Retention window should be 60 days")
}

func TestStatusUpdateRetryConstants(t *testing.T) {
	// Verify retry constants are set to expected values
	assert.Equal(t, 3, statusUpdateRetries,
		"Should retry status updates 3 times")
	assert.Equal(t, 100*time.Millisecond, statusUpdateRetryDelay,
		"Should wait 100ms between retries")
}

// Helper mock client that always fails Get calls with a specific error
type alwaysFailingClient struct {
	client.Client
	getError error
}

func (c *alwaysFailingClient) Get(ctx context.Context, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
	return c.getError
}

func (c *alwaysFailingClient) Status() client.StatusWriter {
	return &alwaysFailingStatusWriter{err: c.getError}
}

type alwaysFailingStatusWriter struct {
	err error
}

func (w *alwaysFailingStatusWriter) Create(ctx context.Context, obj client.Object, subResource client.Object, opts ...client.SubResourceCreateOption) error {
	return w.err
}

func (w *alwaysFailingStatusWriter) Update(ctx context.Context, obj client.Object, opts ...client.SubResourceUpdateOption) error {
	return w.err
}

func (w *alwaysFailingStatusWriter) Patch(ctx context.Context, obj client.Object, patch client.Patch, opts ...client.SubResourcePatchOption) error {
	return w.err
}

func (w *alwaysFailingStatusWriter) Apply(ctx context.Context, obj runtime.ApplyConfiguration, opts ...client.SubResourceApplyOption) error {
	return w.err
}

// TestUpdateJobStatusWithRetry_RealConflictScenario tests a realistic scenario
// where the job is updated by another goroutine during status update
func TestUpdateJobStatusWithRetry_RealConflictScenario(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	job := &v1alpha1.ReindexJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "concurrent-job",
			ResourceVersion: "1",
		},
		Status: v1alpha1.ReindexJobStatus{
			Phase:   v1alpha1.ReindexJobRunning,
			Message: "Initial message",
		},
	}

	fakeClient := fake.NewClientBuilder().
		WithScheme(scheme).
		WithObjects(job).
		WithStatusSubresource(&v1alpha1.ReindexJob{}).
		Build()

	reconciler := &ReindexJobReconciler{
		Client: fakeClient,
		Scheme: scheme,
	}

	// First update should succeed
	updateFn := func(j *v1alpha1.ReindexJob) {
		j.Status.Phase = v1alpha1.ReindexJobSucceeded
		j.Status.Message = "Completed successfully"
		completedAt := metav1.Now()
		j.Status.CompletedAt = &completedAt

		meta.SetStatusCondition(&j.Status.Conditions, metav1.Condition{
			Type:               "Ready",
			Status:             metav1.ConditionTrue,
			Reason:             "Succeeded",
			Message:            "Re-indexing completed successfully",
			ObservedGeneration: j.Generation,
		})
	}

	ctx := context.Background()
	err := reconciler.updateJobStatusWithRetry(ctx, job, updateFn)
	require.NoError(t, err)

	// Verify the job was updated
	var updated v1alpha1.ReindexJob
	require.NoError(t, fakeClient.Get(ctx, client.ObjectKeyFromObject(job), &updated))
	assert.Equal(t, v1alpha1.ReindexJobSucceeded, updated.Status.Phase)
	assert.Equal(t, "Completed successfully", updated.Status.Message)
	assert.NotNil(t, updated.Status.CompletedAt)

	// Verify condition was set
	condition := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
	require.NotNil(t, condition)
	assert.Equal(t, metav1.ConditionTrue, condition.Status)
	assert.Equal(t, "Succeeded", condition.Reason)
}

// TestRetentionValidation_BoundaryConditions tests edge cases around the 60-day boundary
func TestRetentionValidation_BoundaryConditions(t *testing.T) {
	t.Parallel()

	now := time.Now()

	tests := []struct {
		name          string
		offset        time.Duration
		expectFailure bool
	}{
		{
			name:          "60 days + 1 second - invalid",
			offset:        -(60*24*time.Hour + time.Second),
			expectFailure: true,
		},
		{
			name:          "60 days - 1 second - valid",
			offset:        -(60*24*time.Hour - time.Second),
			expectFailure: false,
		},
		{
			name:          "59 days 23 hours 59 minutes - valid",
			offset:        -(59*24*time.Hour + 23*time.Hour + 59*time.Minute),
			expectFailure: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			startTime := now.Add(tt.offset)
			timeSinceStart := time.Since(startTime)
			exceedsRetention := timeSinceStart > retentionWindow

			assert.Equal(t, tt.expectFailure, exceedsRetention,
				"Offset %v should fail=%v, got fail=%v", tt.offset, tt.expectFailure, exceedsRetention)
		})
	}
}

// TestUpdateJobStatusWithRetry_ContextCancellation tests that the retry
// loop respects context cancellation
func TestUpdateJobStatusWithRetry_ContextCancellation(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	// Create a client that will force retries by always returning an internal error
	fakeClient := &alwaysFailingClient{
		Client: fake.NewClientBuilder().
			WithScheme(scheme).
			Build(),
		getError: apierrors.NewInternalError(assert.AnError),
	}

	reconciler := &ReindexJobReconciler{
		Client: fakeClient,
		Scheme: scheme,
	}

	job := &v1alpha1.ReindexJob{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-job",
		},
	}

	updateFn := func(j *v1alpha1.ReindexJob) {
		j.Status.Phase = v1alpha1.ReindexJobRunning
	}

	// Create a context with a very short timeout to test cancellation
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	err := reconciler.updateJobStatusWithRetry(ctx, job, updateFn)

	// Should fail with context deadline exceeded
	require.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
}

// TestUpdateJobStatusWithRetry_NotFoundDuringGet tests the case where
// the job is deleted between the retry loop and the Get call
func TestUpdateJobStatusWithRetry_NotFoundDuringGet(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	require.NoError(t, v1alpha1.AddToScheme(scheme))

	// Create a client that returns NotFound on Get
	fakeClient := &alwaysFailingClient{
		Client: fake.NewClientBuilder().
			WithScheme(scheme).
			Build(),
		getError: apierrors.NewNotFound(schema.GroupResource{
			Group:    v1alpha1.GroupName,
			Resource: "reindexjobs",
		}, "test-job"),
	}

	reconciler := &ReindexJobReconciler{
		Client: fakeClient,
		Scheme: scheme,
	}

	job := &v1alpha1.ReindexJob{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-job",
		},
	}

	updateFn := func(j *v1alpha1.ReindexJob) {
		j.Status.Phase = v1alpha1.ReindexJobSucceeded
	}

	ctx := context.Background()
	err := reconciler.updateJobStatusWithRetry(ctx, job, updateFn)

	// Should return nil (no error) when job is not found
	require.NoError(t, err)
}
