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
