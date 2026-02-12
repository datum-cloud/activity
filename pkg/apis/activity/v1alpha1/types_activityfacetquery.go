// +k8s:openapi-gen=true
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +genclient:onlyVerbs=create
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ActivityFacetQuery helps you build filter UIs by returning "what values exist" for a field.
//
// For example, if you want a dropdown showing "filter by actor", this API tells you
// which actors have activities and how many each has. Great for autocomplete, filter
// chips, and faceted search interfaces.
//
// # Example: Get top actors and resource types from the last week
//
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: ActivityFacetQuery
//	spec:
//	  timeRange:
//	    start: "now-7d"
//	  facets:
//	    - field: spec.actor.name
//	      limit: 10
//	    - field: spec.resource.kind
//
// This returns something like:
//
//	status:
//	  facets:
//	    - field: spec.actor.name
//	      values:
//	        - value: alice@example.com
//	          count: 142
//	        - value: bob@example.com
//	          count: 89
//	    - field: spec.resource.kind
//	      values:
//	        - value: Deployment
//	          count: 95
//	        - value: HTTPProxy
//	          count: 67
type ActivityFacetQuery struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ActivityFacetQuerySpec   `json:"spec"`
	Status ActivityFacetQueryStatus `json:"status,omitempty"`
}

// ActivityFacetQuerySpec defines what you want facet data for.
type ActivityFacetQuerySpec struct {
	// TimeRange sets how far back to look. Defaults to the last 7 days if not set.
	// Use relative times like "now-7d" or absolute timestamps.
	//
	// +optional
	TimeRange FacetTimeRange `json:"timeRange,omitempty"`

	// Filter lets you narrow down which activities to include before computing facets.
	// Uses CEL (Common Expression Language) syntax.
	//
	// This is useful when you want facet values for a specific subset - for example,
	// "show me actors, but only for human-initiated changes."
	//
	// Fields you can filter on:
	//   spec.changeSource       - "human" or "system"
	//   spec.actor.name         - who did it (e.g., "alice@example.com")
	//   spec.actor.type         - user, serviceaccount, or controller
	//   spec.resource.kind      - what type of resource (Deployment, Pod, etc.)
	//   spec.resource.namespace - which namespace
	//   spec.resource.name      - resource name
	//   spec.resource.apiGroup  - API group (empty string for core resources)
	//
	// Example filters:
	//   "spec.changeSource == 'human'"              - Only human actions
	//   "spec.resource.kind == 'Deployment'"        - Only Deployment changes
	//   "!spec.actor.name.startsWith('system:')"    - Exclude system accounts
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
