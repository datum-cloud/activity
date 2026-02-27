// +k8s:openapi-gen=true
package v1alpha1

import (
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EventRecord represents a Kubernetes Event returned in EventQuery results.
// This is a wrapper type registered under activity.miloapis.com/v1alpha1 that
// embeds the events.k8s.io/v1 Event to avoid OpenAPI GVK conflicts while
// preserving full event data.
type EventRecord struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Event contains the full Kubernetes Event data in events.k8s.io/v1 format.
	// This includes fields like eventTime, regarding, note, type, reason,
	// reportingController, reportingInstance, series, and action.
	Event eventsv1.Event `json:"event"`
}
