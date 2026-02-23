package install

import (
	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

// Install registers the API group and adds types to a scheme
func Install(scheme *runtime.Scheme) {
	utilruntime.Must(v1alpha1.AddToScheme(scheme))
	utilruntime.Must(scheme.SetVersionPriority(v1alpha1.SchemeGroupVersion))

	// Register core/v1 Events for legacy API group support
	// This allows us to serve Events under both:
	// - /api/v1/namespaces/{ns}/events (core/v1 - legacy Events API)
	// - /apis/activity.miloapis.com/v1alpha1/namespaces/{ns}/events (activity API)
	coreV1GroupVersion := schema.GroupVersion{Group: "", Version: "v1"}
	scheme.AddKnownTypes(coreV1GroupVersion,
		&corev1.Event{},
		&corev1.EventList{},
	)

	// Register events.k8s.io/v1 Events (newer Events API)
	// This allows us to serve Events under:
	// - /apis/events.k8s.io/v1/namespaces/{ns}/events
	eventsV1GroupVersion := schema.GroupVersion{Group: "events.k8s.io", Version: "v1"}
	scheme.AddKnownTypes(eventsV1GroupVersion,
		&eventsv1.Event{},
		&eventsv1.EventList{},
	)

	// Add meta types (WatchEvent, etc.) to the events.k8s.io/v1 group
	// Required for watch operations to work
	metav1.AddToGroupVersion(scheme, eventsV1GroupVersion)

	// Register field label conversions for Events
	// This enables field selectors like type=Warning, reason=FailedMount, etc.
	utilruntime.Must(scheme.AddFieldLabelConversionFunc(
		coreV1GroupVersion.WithKind("Event"),
		v1alpha1.EventFieldLabelConversionFunc,
	))
	utilruntime.Must(scheme.AddFieldLabelConversionFunc(
		eventsV1GroupVersion.WithKind("Event"),
		v1alpha1.EventFieldLabelConversionFunc,
	))
}
