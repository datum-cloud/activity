// +k8s:openapi-gen=true
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityPolicy defines translation rules for a specific resource type. Service providers
// create one ActivityPolicy per resource kind to customize activity descriptions without
// modifying the Activity Processor.
//
// Example:
//
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: ActivityPolicy
//	metadata:
//	  name: networking-httpproxy
//	spec:
//	  resource:
//	    apiGroup: networking.datumapis.com
//	    kind: HTTPProxy
//	  auditRules:
//	    - match: "audit.verb == 'create'"
//	      summary: "{{ actor }} created {{ link(kind + ' ' + audit.objectRef.name, audit.responseObject) }}"
//	  eventRules:
//	    - match: "event.reason == 'Programmed'"
//	      summary: "{{ link(kind + ' ' + event.regarding.name, event.regarding) }} is now programmed"
type ActivityPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ActivityPolicySpec   `json:"spec"`
	Status ActivityPolicyStatus `json:"status,omitempty"`
}

// ActivityPolicyStatus represents the current state of an ActivityPolicy.
type ActivityPolicyStatus struct {
	// Conditions represent the current state of the policy.
	// The "Ready" condition indicates whether all rules compile successfully.
	// +optional
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// ObservedGeneration is the generation last processed by the controller.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// EvaluationStats contains runtime evaluation statistics from the processor.
	// Updated periodically by the activity-processor to report rule evaluation health.
	// +optional
	EvaluationStats *EvaluationStats `json:"evaluationStats,omitempty"`
}

// EvaluationStats tracks runtime CEL expression evaluation health for a policy.
// These metrics are collected by the activity-processor and reported via status updates.
type EvaluationStats struct {
	// LastEvaluationTime is when this policy last evaluated an event/audit.
	// +optional
	LastEvaluationTime *metav1.Time `json:"lastEvaluationTime,omitempty"`

	// SuccessCount is the number of successful evaluations in the current window.
	// +optional
	SuccessCount int64 `json:"successCount,omitempty"`

	// ErrorCount is the number of failed evaluations in the current window.
	// +optional
	ErrorCount int64 `json:"errorCount,omitempty"`

	// LastErrorTime is when the most recent error occurred.
	// +optional
	LastErrorTime *metav1.Time `json:"lastErrorTime,omitempty"`

	// LastErrorMessage contains the error message from the most recent failure.
	// +optional
	LastErrorMessage string `json:"lastErrorMessage,omitempty"`

	// LastErrorRuleIndex indicates which rule failed (0-based index).
	// +optional
	LastErrorRuleIndex *int `json:"lastErrorRuleIndex,omitempty"`

	// WindowStartTime marks the beginning of the current statistics window.
	// +optional
	WindowStartTime *metav1.Time `json:"windowStartTime,omitempty"`
}

// ActivityPolicySpec defines the translation rules for a resource type.
type ActivityPolicySpec struct {
	// Resource identifies the Kubernetes resource this policy applies to.
	// One ActivityPolicy should exist per resource kind.
	//
	// +required
	Resource ActivityPolicyResource `json:"resource"`

	// AuditRules define how to translate audit log entries into activity summaries.
	// Rules are evaluated in order; the first matching rule wins.
	// The `audit` variable contains the full Kubernetes audit event structure.
	// Convenience variables available: actor
	//
	// +optional
	// +listType=atomic
	AuditRules []ActivityPolicyRule `json:"auditRules,omitempty"`

	// EventRules define how to translate Kubernetes events into activity summaries.
	// Rules are evaluated in order; the first matching rule wins.
	// The `event` variable contains the full Kubernetes Event structure.
	// Convenience variables available: actor
	//
	// +optional
	// +listType=atomic
	EventRules []ActivityPolicyRule `json:"eventRules,omitempty"`
}

// ActivityPolicyResource identifies the target Kubernetes resource for a policy.
type ActivityPolicyResource struct {
	// APIGroup is the API group of the target resource (e.g., "networking.datumapis.com").
	// Use an empty string for core API group resources.
	//
	// +required
	APIGroup string `json:"apiGroup"`

	// Kind is the kind of the target resource (e.g., "HTTPProxy", "Network").
	//
	// +required
	Kind string `json:"kind"`
}

// ActivityPolicyRule defines a single translation rule that matches input events
// and generates human-readable activity summaries.
type ActivityPolicyRule struct {
	// Match is a CEL expression that determines if this rule applies to the input.
	// For audit rules, use the `audit` variable (e.g., "audit.verb == 'create'").
	// For event rules, use the `event` variable (e.g., "event.reason == 'Programmed'").
	//
	// Examples:
	//   "audit.verb == 'create'"
	//   "audit.verb in ['update', 'patch']"
	//   "event.reason.startsWith('Failed')"
	//   "true"  (fallback rule that always matches)
	//
	// +required
	Match string `json:"match"`

	// Summary is a CEL template for generating the activity summary.
	// Use {{ }} delimiters to embed CEL expressions within strings.
	//
	// Available variables:
	//   - audit/event: The full input object
	//   - actor: Resolved display name for the actor
	//
	// Available functions:
	//   - link(displayText, resourceRef): Creates a clickable reference
	//
	// Examples:
	//   "{{ actor }} created {{ link(kind + ' ' + audit.objectRef.name, audit.responseObject) }}"
	//   "{{ link(kind + ' ' + event.regarding.name, event.regarding) }} is now programmed"
	//
	// +required
	Summary string `json:"summary"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityPolicyList is a list of ActivityPolicy objects
type ActivityPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ActivityPolicy `json:"items"`
}
