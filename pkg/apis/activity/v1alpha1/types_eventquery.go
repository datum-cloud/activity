// +k8s:openapi-gen=true
package v1alpha1

import (
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +genclient
// +genclient:nonNamespaced
// +genclient:onlyVerbs=create
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// EventQuery searches Kubernetes Events stored in ClickHouse.
//
// Unlike the native Events list (limited to 24 hours), EventQuery supports
// up to 60 days of history. Results are returned in the Status field,
// ordered newest-first.
//
// Quick Start:
//
//	apiVersion: activity.miloapis.com/v1alpha1
//	kind: EventQuery
//	metadata:
//	  name: recent-pod-failures
//	spec:
//	  startTime: "now-7d"          # last 7 days
//	  endTime: "now"
//	  namespace: "production"      # optional: limit to namespace
//	  fieldSelector: "type=Warning" # optional: standard K8s field selector
//	  limit: 100
//
// Time Formats:
// - Relative: "now-30d" (great for dashboards and recurring queries)
// - Absolute: "2024-01-01T00:00:00Z" (great for historical analysis)
type EventQuery struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   EventQuerySpec   `json:"spec"`
	Status EventQueryStatus `json:"status,omitempty"`
}

// EventQuerySpec defines the search parameters.
//
// Required: startTime and endTime define your search window (max 60 days).
// Optional: namespace (limit to namespace), fieldSelector (standard K8s syntax),
// limit (page size, default 100), continue (pagination).
type EventQuerySpec struct {
	// StartTime is the beginning of your search window (inclusive).
	//
	// Format Options:
	// - Relative: "now-30d", "now-2h", "now-30m" (units: s, m, h, d, w)
	//   Use for dashboards and recurring queries - they adjust automatically.
	// - Absolute: "2024-01-01T00:00:00Z" (RFC3339 with timezone)
	//   Use for historical analysis of specific time periods.
	//
	// Maximum lookback is 60 days from now.
	//
	// Examples:
	//   "now-7d"                      → 7 days ago
	//   "2024-06-15T14:30:00-05:00"   → specific time with timezone offset
	//
	// +required
	StartTime string `json:"startTime"`

	// EndTime is the end of your search window (exclusive).
	//
	// Uses the same formats as StartTime. Commonly "now" for the current moment.
	// Must be greater than StartTime.
	//
	// Examples:
	//   "now"                  → current time
	//   "2024-01-02T00:00:00Z" → specific end point
	//
	// +required
	EndTime string `json:"endTime"`

	// Namespace limits results to events from a specific namespace.
	// Leave empty to query events across all namespaces.
	//
	// +optional
	Namespace string `json:"namespace,omitempty"`

	// FieldSelector filters events using standard Kubernetes field selector syntax.
	//
	// Supported Fields:
	//   metadata.name               - event name
	//   metadata.namespace          - event namespace
	//   metadata.uid                - event UID
	//   involvedObject.apiVersion   - involved resource API version
	//   involvedObject.kind         - involved resource kind (e.g., Pod, Deployment)
	//   involvedObject.namespace    - involved resource namespace
	//   involvedObject.name         - involved resource name
	//   involvedObject.uid          - involved resource UID
	//   involvedObject.fieldPath    - involved resource field path
	//   reason                      - event reason (e.g., FailedMount, Pulled)
	//   type                        - event type (Normal or Warning)
	//   source.component            - reporting component
	//   source.host                 - reporting host
	//
	// Operators: = (or ==), !=
	// Multiple conditions: comma-separated (all must match)
	//
	// Common Patterns:
	//   "type=Warning"                                  - Warning events only
	//   "involvedObject.kind=Pod"                       - Events for pods
	//   "reason=FailedMount"                            - Mount failure events
	//   "involvedObject.name=my-pod,type=Warning"       - Warnings for a specific pod
	//
	// +optional
	FieldSelector string `json:"fieldSelector,omitempty"`

	// Limit sets the maximum number of results per page.
	// Default: 100, Maximum: 1000.
	//
	// Use smaller values (10-50) for exploration, larger (500-1000) for data collection.
	// Use continue to fetch additional pages.
	//
	// +optional
	Limit int32 `json:"limit,omitempty"`

	// Continue is the pagination cursor for fetching additional pages.
	//
	// Leave empty for the first page. If status.continue is non-empty after a query,
	// copy that value here in a new query with identical parameters to get the next page.
	// Repeat until status.continue is empty.
	//
	// Important: Keep all other parameters (startTime, endTime, namespace, fieldSelector,
	// limit) identical across paginated requests. The cursor is opaque - copy it exactly
	// without modification.
	//
	// +optional
	Continue string `json:"continue,omitempty"`
}

// EventQueryStatus contains the query results and pagination state.
type EventQueryStatus struct {
	// Results contains matching Kubernetes Events, sorted newest-first.
	//
	// Each event follows the standard eventsv1.Event format with fields like:
	//   regarding.{kind,name,namespace}, reason, note, type,
	//   eventTime, series.count, reportingController
	//
	// Empty results? Try broadening your field selector or time range.
	//
	// +listType=atomic
	Results []eventsv1.Event `json:"results,omitempty"`

	// Continue is the pagination cursor.
	// Non-empty means more results are available - copy this to spec.continue for the next page.
	// Empty means you have all results.
	Continue string `json:"continue,omitempty"`

	// EffectiveStartTime is the actual start time used for this query (RFC3339 format).
	//
	// When you use relative times like "now-7d", this shows the exact timestamp that was
	// calculated. Useful for understanding exactly what time range was queried, especially
	// for auditing, debugging, or recreating queries with absolute timestamps.
	//
	// Example: If you query with startTime="now-7d" at 2025-12-17T12:00:00Z,
	// this will be "2025-12-10T12:00:00Z".
	//
	// +optional
	EffectiveStartTime string `json:"effectiveStartTime,omitempty"`

	// EffectiveEndTime is the actual end time used for this query (RFC3339 format).
	//
	// When you use relative times like "now", this shows the exact timestamp that was
	// calculated. Useful for understanding exactly what time range was queried.
	//
	// Example: If you query with endTime="now" at 2025-12-17T12:00:00Z,
	// this will be "2025-12-17T12:00:00Z".
	//
	// +optional
	EffectiveEndTime string `json:"effectiveEndTime,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// EventQueryList is required by the code generator but is not used directly.
// EventQuery is an ephemeral resource that only supports Create.
type EventQueryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []EventQuery `json:"items"`
}
