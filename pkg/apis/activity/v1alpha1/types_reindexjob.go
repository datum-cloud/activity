// +k8s:openapi-gen=true
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ReindexJob triggers re-processing of historical audit logs and events through
// current ActivityPolicy rules. Use this to fix policy bugs retroactively, add
// coverage for new policies, or refine activity summaries after policy improvements.
//
// ReindexJob is a one-shot resource: once completed or failed, it cannot be
// re-run. Create a new ReindexJob for subsequent re-indexing operations.
//
// KUBERNETES EVENT LIMITATION:
//
// When a Kubernetes Event is updated (e.g., count incremented from 1 to 5),
// it retains the same UID. Re-indexing will produce ONE activity per Event UID,
// reflecting the Event's final state. Historical activity occurrences from earlier
// Event states are lost.
//
// Example: Event "pod-oom" fires 5 times (count=5) → Re-indexing produces 1 activity (not 5)
//
// Mitigation: Scope re-indexing to audit logs only via spec.policySelector to
// preserve activities from earlier Event occurrences.
//
// Example:
//
//	kubectl apply -f - <<EOF
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: ReindexJob
//	metadata:
//	  name: fix-policy-bug-2026-02-27
//	spec:
//	  timeRange:
//	    startTime: "2026-02-25T00:00:00Z"
//	  policySelector:
//	    names: ["httpproxy-policy"]
//	EOF
//
//	kubectl get reindexjobs -w  # Watch progress
type ReindexJob struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ReindexJobSpec   `json:"spec"`
	Status ReindexJobStatus `json:"status,omitempty"`
}

// ReindexJobSpec defines the parameters for a re-indexing operation.
type ReindexJobSpec struct {
	// TimeRange specifies the time window of events to re-index.
	// Events outside this range are not processed.
	//
	// +required
	TimeRange ReindexTimeRange `json:"timeRange"`

	// PolicySelector optionally limits re-indexing to specific policies.
	// If omitted, all active ActivityPolicies are evaluated.
	//
	// +optional
	PolicySelector *ReindexPolicySelector `json:"policySelector,omitempty"`

	// Config contains processing configuration options.
	//
	// +optional
	Config *ReindexConfig `json:"config,omitempty"`

	// TTLSecondsAfterFinished limits the lifetime of a ReindexJob after it finishes
	// execution (either Succeeded or Failed). If set, the controller will delete the
	// ReindexJob resource after it has been in a terminal state for this many seconds.
	//
	// This field is optional. If unset, completed jobs are retained indefinitely.
	//
	// Example: Setting to 3600 (1 hour) allows users to inspect job results for an
	// hour after completion, after which the job is automatically cleaned up.
	//
	// +optional
	// +kubebuilder:validation:Minimum=0
	TTLSecondsAfterFinished *int32 `json:"ttlSecondsAfterFinished,omitempty"`
}

// ReindexTimeRange specifies the time window for re-indexing.
type ReindexTimeRange struct {
	// StartTime is the beginning of the time range (inclusive).
	// Must be within the ClickHouse retention window (60 days).
	//
	// +required
	StartTime metav1.Time `json:"startTime"`

	// EndTime is the end of the time range (exclusive).
	// Defaults to the current time if omitted.
	//
	// +optional
	EndTime *metav1.Time `json:"endTime,omitempty"`
}

// ReindexPolicySelector specifies which policies to include in re-indexing.
type ReindexPolicySelector struct {
	// Names is a list of ActivityPolicy names to include.
	// Mutually exclusive with MatchLabels.
	//
	// +optional
	Names []string `json:"names,omitempty"`

	// MatchLabels selects policies by label.
	// Mutually exclusive with Names.
	//
	// +optional
	MatchLabels map[string]string `json:"matchLabels,omitempty"`
}

// ReindexConfig contains processing configuration options.
type ReindexConfig struct {
	// BatchSize is the number of events to process per batch.
	// Larger batches are faster but use more memory.
	// Default: 1000
	//
	// +optional
	// +kubebuilder:default=1000
	// +kubebuilder:validation:Minimum=100
	// +kubebuilder:validation:Maximum=10000
	BatchSize int32 `json:"batchSize,omitempty"`

	// RateLimit is the maximum events per second to process.
	// Prevents overwhelming ClickHouse.
	// Default: 100
	//
	// +optional
	// +kubebuilder:default=100
	// +kubebuilder:validation:Minimum=10
	// +kubebuilder:validation:Maximum=1000
	RateLimit int32 `json:"rateLimit,omitempty"`

	// DryRun previews changes without writing activities.
	// Useful for estimating impact before execution.
	// Default: false
	//
	// +optional
	DryRun bool `json:"dryRun,omitempty"`
}

// ReindexJobStatus represents the current state of a ReindexJob.
type ReindexJobStatus struct {
	// Phase is the current lifecycle phase.
	// Values: Pending, Running, Succeeded, Failed
	//
	// +optional
	Phase ReindexJobPhase `json:"phase,omitempty"`

	// Message is a human-readable description of the current state.
	//
	// +optional
	Message string `json:"message,omitempty"`

	// Progress contains detailed progress information.
	//
	// +optional
	Progress *ReindexProgress `json:"progress,omitempty"`

	// StartedAt is when processing began.
	//
	// +optional
	StartedAt *metav1.Time `json:"startedAt,omitempty"`

	// CompletedAt is when processing finished (success or failure).
	//
	// +optional
	CompletedAt *metav1.Time `json:"completedAt,omitempty"`

	// Conditions represent the latest observations of the job's state.
	//
	// +optional
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

// ReindexJobPhase represents the lifecycle phase of a ReindexJob.
type ReindexJobPhase string

const (
	ReindexJobPending   ReindexJobPhase = "Pending"
	ReindexJobRunning   ReindexJobPhase = "Running"
	ReindexJobSucceeded ReindexJobPhase = "Succeeded"
	ReindexJobFailed    ReindexJobPhase = "Failed"
)

// ReindexProgress contains detailed progress metrics.
type ReindexProgress struct {
	// TotalEvents is the estimated total events to process.
	TotalEvents int64 `json:"totalEvents,omitempty"`

	// ProcessedEvents is the number of events processed so far.
	ProcessedEvents int64 `json:"processedEvents,omitempty"`

	// ActivitiesGenerated is the number of activities created.
	ActivitiesGenerated int64 `json:"activitiesGenerated,omitempty"`

	// Errors is the count of non-fatal errors encountered.
	Errors int64 `json:"errors,omitempty"`

	// CurrentBatch is the batch number currently being processed.
	CurrentBatch int32 `json:"currentBatch,omitempty"`

	// TotalBatches is the estimated total number of batches.
	TotalBatches int32 `json:"totalBatches,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ReindexJobList is a list of ReindexJob objects
type ReindexJobList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ReindexJob `json:"items"`
}
