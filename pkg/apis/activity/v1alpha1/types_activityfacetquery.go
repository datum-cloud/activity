// +k8s:openapi-gen=true
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +genclient:onlyVerbs=create
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityFacetQuery is an ephemeral resource for getting distinct field values.
// Use this to power autocomplete, filter dropdowns, and faceted search in UIs.
//
// The query returns counts for each distinct value, allowing you to show both
// available options and their frequency.
//
// Example:
//
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: ActivityFacetQuery
//	metadata:
//	  name: get-actors
//	spec:
//	  timeRange:
//	    start: "now-7d"
//	  facets:
//	    - field: spec.actor.name
//	      limit: 10
//	    - field: spec.resource.kind
type ActivityFacetQuery struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ActivityFacetQuerySpec   `json:"spec"`
	Status ActivityFacetQueryStatus `json:"status,omitempty"`
}

// ActivityFacetQuerySpec defines which facets to retrieve.
type ActivityFacetQuerySpec struct {
	// TimeRange limits the time window for facet aggregation.
	// If not specified, defaults to the last 7 days.
	//
	// +optional
	TimeRange FacetTimeRange `json:"timeRange,omitempty"`

	// Filter narrows the activities before computing facets using CEL.
	// This allows you to get facet values for a subset of activities.
	//
	// Available Fields:
	//   spec.changeSource              - "human" or "system"
	//   spec.actor.name                - actor display name
	//   spec.actor.type                - actor type (user, serviceaccount, controller)
	//   spec.actor.uid                 - actor UID
	//   spec.resource.apiGroup         - resource API group
	//   spec.resource.kind             - resource kind
	//   spec.resource.name             - resource name
	//   spec.resource.namespace        - resource namespace
	//   spec.summary                   - activity summary text
	//   spec.origin.type               - origin type (audit, event)
	//   metadata.namespace             - activity namespace
	//
	// Operators: ==, !=, &&, ||, !, in
	// String Functions: startsWith(), endsWith(), contains()
	//
	// Examples:
	//   "spec.changeSource == 'human'"                     - Human actions only
	//   "!(spec.changeSource == 'system')"                 - Exclude system actions
	//   "spec.resource.kind == 'Deployment'"               - Deployment activities
	//   "!spec.actor.name.startsWith('system:')"           - Exclude system actors
	//
	// +optional
	Filter string `json:"filter,omitempty"`

	// Facets specifies which fields to get distinct values for.
	// Each facet returns the top N values with counts.
	//
	// +required
	// +listType=atomic
	Facets []FacetSpec `json:"facets"`
}

// ActivityFacetQueryStatus contains the facet results.
type ActivityFacetQueryStatus struct {
	// Facets contains the results for each requested facet.
	//
	// +optional
	// +listType=atomic
	Facets []FacetResult `json:"facets,omitempty"`
}
