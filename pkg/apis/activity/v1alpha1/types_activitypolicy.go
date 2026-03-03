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
//	    - match: "verb == 'create'"
//	      summary: "{{ actor }} created {{ link(kind + ' ' + objectRef.name, responseObject) }}"
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
	// Available variables: verb, objectRef, user, responseStatus, responseObject, actor, actorRef, kind
	// Convenience variables available: actor
	//
	// +optional
	// +listType=map
	// +listMapKey=name
	AuditRules []ActivityPolicyRule `json:"auditRules,omitempty"`

	// EventRules define how to translate Kubernetes events into activity summaries.
	// Rules are evaluated in order; the first matching rule wins.
	// The `event` variable contains the full Kubernetes Event structure.
	// Convenience variables available: actor
	//
	// +optional
	// +listType=map
	// +listMapKey=name
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
	// Name is a unique identifier for this rule within the policy.
	// Used for strategic merge patching and error reporting.
	//
	// +required
	Name string `json:"name"`

	// Description is an optional human-readable description of what this rule does.
	//
	// +optional
	Description string `json:"description,omitempty"`

	// Match is a CEL expression that determines if this rule applies to the input.
	// For audit rules, use top-level variables (e.g., "verb == 'create'", "objectRef.namespace == 'default'").
	// For event rules, use the `event` variable (e.g., "event.reason == 'Programmed'").
	//
	// Examples:
	//   "verb == 'create'"
	//   "verb in ['update', 'patch']"
	//   "event.reason.startsWith('Failed')"
	//   "true"  (fallback rule that always matches)
	//
	// +required
	Match string `json:"match"`

	// Summary is a CEL template for generating the activity summary.
	// Use {{ }} delimiters to embed CEL expressions within strings.
	//
	// Available variables:
	//   - For audit rules: verb, objectRef, user, responseStatus, responseObject, actor, actorRef, kind
	//   - For event rules: event, actor
	//
	// Available functions:
	//   - link(displayText, resourceRef): Creates a clickable reference
	//
	// Examples:
	//   "{{ actor }} created {{ link(kind + ' ' + objectRef.name, responseObject) }}"
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
