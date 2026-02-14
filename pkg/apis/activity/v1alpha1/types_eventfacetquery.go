// +k8s:openapi-gen=true
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +genclient:onlyVerbs=create
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// EventFacetQuery is an ephemeral resource for getting distinct field values from Kubernetes Events.
// Use this to power autocomplete, filter dropdowns, and faceted search in UIs.
//
// The query returns counts for each distinct value, allowing you to show both
// available options and their frequency.
//
// Example:
//
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: EventFacetQuery
//	metadata:
//	  name: get-facets
//	spec:
//	  timeRange:
//	    start: "now-7d"
//	  facets:
//	    - field: involvedObject.kind
//	      limit: 10
//	    - field: reason
//	    - field: type
type EventFacetQuery struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   EventFacetQuerySpec   `json:"spec"`
	Status EventFacetQueryStatus `json:"status,omitempty"`
}

// EventFacetQuerySpec defines which facets to retrieve from Kubernetes Events.
type EventFacetQuerySpec struct {
	// TimeRange limits the time window for facet aggregation.
	// If not specified, defaults to the last 7 days.
	//
	// +optional
	TimeRange FacetTimeRange `json:"timeRange,omitempty"`

	// Facets specifies which fields to get distinct values for.
	// Each facet returns the top N values with counts.
	//
	// Supported fields:
	//   - involvedObject.kind: Resource kinds (Pod, Deployment, etc.)
	//   - involvedObject.namespace: Namespaces of involved objects
	//   - reason: Event reasons (Scheduled, Pulled, Created, etc.)
	//   - type: Event types (Normal, Warning)
	//   - source.component: Source components (kubelet, scheduler, etc.)
	//   - namespace: Event namespace
	//
	// +required
	// +listType=atomic
	Facets []FacetSpec `json:"facets"`
}

// EventFacetQueryStatus contains the facet results.
type EventFacetQueryStatus struct {
	// Facets contains the results for each requested facet.
	//
	// +optional
	// +listType=atomic
	Facets []FacetResult `json:"facets,omitempty"`
}
