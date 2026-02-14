package events

import (
	"context"
	"encoding/json"
	"sync"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/storage"
)

// EventWatcher implements watch.Interface for Kubernetes Events.
// It filters events based on namespace, scope, and field selectors.
type EventWatcher struct {
	namespace string
	scope     storage.ScopeContext
	opts      metav1.ListOptions

	resultChan chan watch.Event
	stopChan   chan struct{}
	doneChan   chan struct{}

	mu sync.Mutex
}

// NewEventWatcher creates a new event watcher.
func NewEventWatcher(namespace string, opts metav1.ListOptions, scope storage.ScopeContext) *EventWatcher {
	w := &EventWatcher{
		namespace:  namespace,
		scope:      scope,
		opts:       opts,
		resultChan: make(chan watch.Event, 100), // Buffered to prevent blocking publishers
		stopChan:   make(chan struct{}),
		doneChan:   make(chan struct{}),
	}

	return w
}

// Start begins watching with the given context.
// The watcher will stop when the context is cancelled.
func (w *EventWatcher) Start(ctx context.Context) {
	go func() {
		defer close(w.doneChan)
		select {
		case <-ctx.Done():
			w.Stop()
		case <-w.stopChan:
		}
	}()
}

// SendEvent sends an event to watch clients if it matches filters.
// This is called by the message handler when an event is received.
func (w *EventWatcher) SendEvent(eventType watch.EventType, event *corev1.Event) {
	w.mu.Lock()
	defer w.mu.Unlock()

	select {
	case <-w.stopChan:
		// Watcher has been stopped, ignore event
		return
	default:
	}

	// Check namespace filter
	if w.namespace != "" && event.Namespace != w.namespace {
		return
	}

	// Check scope filtering
	if !w.matchesScope(event) {
		return
	}

	// Check field selector filtering
	if !w.matchesFieldSelector(event) {
		return
	}

	// Create watch event
	watchEvent := watch.Event{
		Type:   eventType,
		Object: event,
	}

	// Send to result channel (non-blocking)
	select {
	case w.resultChan <- watchEvent:
	default:
		klog.V(2).InfoS("Watch result channel full, dropping event",
			"namespace", event.Namespace,
			"name", event.Name,
		)
	}
}

// matchesScope checks if an event matches the watcher's scope.
func (w *EventWatcher) matchesScope(event *corev1.Event) bool {
	if w.scope.Type == "" || w.scope.Type == "platform" {
		// Platform scope sees all events
		return true
	}

	// Check scope annotations on the event
	if event.Annotations == nil {
		return false
	}

	scopeType := event.Annotations["platform.miloapis.com/scope.type"]
	scopeName := event.Annotations["platform.miloapis.com/scope.name"]

	return scopeType == w.scope.Type && scopeName == w.scope.Name
}

// matchesFieldSelector checks if an event matches the watcher's field selector.
func (w *EventWatcher) matchesFieldSelector(event *corev1.Event) bool {
	if w.opts.FieldSelector == "" {
		return true
	}

	// Parse field selector
	terms, err := storage.ParseFieldSelector(w.opts.FieldSelector)
	if err != nil {
		klog.V(4).InfoS("Failed to parse field selector in watch",
			"fieldSelector", w.opts.FieldSelector,
			"error", err,
		)
		return true // Allow on parse error (fail open)
	}

	for _, term := range terms {
		value := storage.GetEventFieldValue(event, term.Column)

		switch term.Operator {
		case storage.FieldSelectorEqual:
			if value != term.Value {
				return false
			}
		case storage.FieldSelectorNotEqual:
			if value == term.Value {
				return false
			}
		}
	}

	return true
}

// Stop stops the watcher and closes all channels.
func (w *EventWatcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()

	select {
	case <-w.stopChan:
		// Already stopped
		return
	default:
		close(w.stopChan)
	}

	// Close result channel
	close(w.resultChan)
}

// ResultChan returns a channel that will receive watch events.
func (w *EventWatcher) ResultChan() <-chan watch.Event {
	return w.resultChan
}

// EventMessage represents the message format for event notifications.
// This is used for serialization when publishing/receiving events via messaging.
type EventMessage struct {
	// Type is the watch event type (ADDED, MODIFIED, DELETED)
	Type watch.EventType `json:"type"`

	// Event is the Kubernetes Event object
	Event corev1.Event `json:"event"`
}

// MarshalEventMessage serializes an event message for transmission.
func MarshalEventMessage(eventType watch.EventType, event *corev1.Event) ([]byte, error) {
	msg := EventMessage{
		Type:  eventType,
		Event: *event,
	}
	return json.Marshal(msg)
}

// UnmarshalEventMessage deserializes an event message.
func UnmarshalEventMessage(data []byte) (*EventMessage, error) {
	var msg EventMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
