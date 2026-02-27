package activity

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityPolicy defines translation rules for a specific resource type.
// This is the internal version used for conversion.
type ActivityPolicy struct {
	metav1.TypeMeta
	metav1.ObjectMeta

	Spec   ActivityPolicySpec
	Status ActivityPolicyStatus
}

// ActivityPolicySpec defines the translation rules for a resource type.
type ActivityPolicySpec struct {
	Resource   ActivityPolicyResource
	AuditRules []ActivityPolicyRule
	EventRules []ActivityPolicyRule
}

// ActivityPolicyResource identifies the Kubernetes resource this policy applies to.
type ActivityPolicyResource struct {
	APIGroup string
	Kind     string
}

// ActivityPolicyRule defines a translation rule.
type ActivityPolicyRule struct {
	Match   string
	Summary string
}

// Condition is an alias for metav1.Condition to simplify conversions
type Condition = metav1.Condition

// ActivityPolicyStatus contains the observed state of an ActivityPolicy.
type ActivityPolicyStatus struct {
	Conditions         []Condition
	ObservedGeneration int64
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityPolicyList is a list of ActivityPolicy objects
type ActivityPolicyList struct {
	metav1.TypeMeta
	metav1.ListMeta

	Items []ActivityPolicy
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ReindexJob triggers re-processing of historical audit logs and events.
// This is the internal version used for conversion.
type ReindexJob struct {
	metav1.TypeMeta
	metav1.ObjectMeta

	Spec   ReindexJobSpec
	Status ReindexJobStatus
}

// ReindexJobSpec defines the parameters for a re-indexing operation.
type ReindexJobSpec struct {
	TimeRange      ReindexTimeRange
	PolicySelector *ReindexPolicySelector
	Config         *ReindexConfig
}

// ReindexTimeRange specifies the time window for re-indexing.
type ReindexTimeRange struct {
	StartTime metav1.Time
	EndTime   *metav1.Time
}

// ReindexPolicySelector specifies which policies to include in re-indexing.
type ReindexPolicySelector struct {
	Names       []string
	MatchLabels map[string]string
}

// ReindexConfig contains processing configuration options.
type ReindexConfig struct {
	BatchSize int32
	RateLimit int32
	DryRun    bool
}

// ReindexJobStatus represents the current state of a ReindexJob.
type ReindexJobStatus struct {
	Phase       ReindexJobPhase
	Message     string
	Progress    *ReindexProgress
	StartedAt   *metav1.Time
	CompletedAt *metav1.Time
	Conditions  []Condition
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
	TotalEvents         int64
	ProcessedEvents     int64
	ActivitiesGenerated int64
	Errors              int64
	CurrentBatch        int32
	TotalBatches        int32
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ReindexJobList is a list of ReindexJob objects
type ReindexJobList struct {
	metav1.TypeMeta
	metav1.ListMeta

	Items []ReindexJob
}
