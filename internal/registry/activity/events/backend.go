package events

import (
	"context"

	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	"go.miloapis.com/activity/internal/storage"
)

// EventsBackend defines the interface for Kubernetes Events storage operations.
// Implementations provide CRUD operations and watch support for events.k8s.io/v1 Event objects.
// The backend uses eventsv1.Event as the canonical storage format.
type EventsBackend interface {
	// Create stores a new event and returns it with server-generated fields populated.
	// The event's ResourceVersion is set from the storage's monotonic clock.
	Create(ctx context.Context, event *eventsv1.Event, scope storage.ScopeContext) (*eventsv1.Event, error)

	// Get retrieves a single event by namespace and name.
	// Returns nil and an error if the event is not found.
	Get(ctx context.Context, namespace, name string, scope storage.ScopeContext) (*eventsv1.Event, error)

	// List retrieves events matching the given namespace and options.
	// If namespace is empty, returns events across all namespaces (within scope).
	// Supports field selectors for filtering by regarding object, reason, type, etc.
	List(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (*eventsv1.EventList, error)

	// Update modifies an existing event.
	// For event aggregation, this typically increments series.count and updates series.lastObservedTime.
	// Returns the updated event with new ResourceVersion.
	Update(ctx context.Context, event *eventsv1.Event, scope storage.ScopeContext) (*eventsv1.Event, error)

	// Delete removes an event by namespace and name.
	// Returns nil if the event was successfully deleted or didn't exist.
	Delete(ctx context.Context, namespace, name string, scope storage.ScopeContext) error

	// Watch returns a watch.Interface that streams event changes.
	// The watch starts from the given resourceVersion in opts.
	// Use namespace="" to watch across all namespaces (within scope).
	Watch(ctx context.Context, namespace string, opts metav1.ListOptions, scope storage.ScopeContext) (watch.Interface, error)
}
