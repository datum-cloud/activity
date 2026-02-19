package watch

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/storage"
)

// EventsWatcher watches for Kubernetes events via NATS JetStream.
type EventsWatcher struct {
	nats *NATSWatcher
}

// NewEventsWatcher creates a new events watcher using the given NATS watcher.
func NewEventsWatcher(nats *NATSWatcher) *EventsWatcher {
	return &EventsWatcher{nats: nats}
}

// EventsWatchFilter contains filter criteria for event watch operations.
type EventsWatchFilter struct {
	// ResourceVersion is the JetStream sequence number to start from.
	// If 0, starts from the latest message (real-time only).
	// If > 0, replays from that sequence number.
	ResourceVersion uint64

	// Namespace filters events by namespace
	Namespace string

	// InvolvedObjectKind filters by involved object kind
	InvolvedObjectKind string

	// InvolvedObjectNamespace filters by involved object namespace
	InvolvedObjectNamespace string

	// InvolvedObjectName filters by involved object name
	InvolvedObjectName string

	// InvolvedObjectUID filters by involved object UID
	InvolvedObjectUID string

	// Reason filters by event reason
	Reason string

	// Type filters by event type (Normal, Warning)
	Type string

	// Source filters by reporting component
	Source string
}

// Watch creates a new watch for events matching the given scope and filter.
// Uses JetStream ephemeral push consumers for reliable delivery and replay support.
func (w *EventsWatcher) Watch(ctx context.Context, scope storage.ScopeContext, filter EventsWatchFilter) (watch.Interface, error) {
	if w.nats == nil {
		return nil, fmt.Errorf("Watch API is not available: NATS not configured")
	}

	// Build the NATS subject filter based on scope and filters
	subject := w.buildSubject(scope, filter)

	// Generate unique consumer name for this watch
	consumerName := "events-watch-" + uuid.New().String()[:8]

	// Configure consumer based on resourceVersion
	var deliverPolicy nats.DeliverPolicy
	var optStartSeq uint64

	if filter.ResourceVersion > 0 {
		// Resume from specific sequence (replay missed events)
		deliverPolicy = nats.DeliverByStartSequencePolicy
		optStartSeq = filter.ResourceVersion
		klog.V(4).InfoS("Starting events watch from sequence", "subject", subject, "sequence", optStartSeq)
	} else {
		// Start from now (real-time only)
		deliverPolicy = nats.DeliverNewPolicy
		klog.V(4).InfoS("Starting events watch from now", "subject", subject)
	}

	// Create ephemeral push consumer with inbox delivery
	inbox := nats.NewInbox()

	consumerConfig := &nats.ConsumerConfig{
		Name:           consumerName,
		FilterSubject:  subject,
		DeliverPolicy:  deliverPolicy,
		AckPolicy:      nats.AckExplicitPolicy,
		DeliverSubject: inbox,
		// Ephemeral consumer - no durable name
		// Will be automatically cleaned up when subscription ends
		InactiveThreshold: 5 * time.Minute,
		// Flow control for backpressure
		FlowControl: true,
		// Heartbeat to detect stale consumers
		Heartbeat: 30 * time.Second,
	}

	if optStartSeq > 0 {
		consumerConfig.OptStartSeq = optStartSeq
	}

	streamName := w.nats.streamName
	if streamName == "" {
		streamName = "EVENTS"
	}

	// Add consumer to stream
	_, err := w.nats.js.AddConsumer(streamName, consumerConfig)
	if err != nil {
		return nil, err
	}

	// Subscribe to the consumer's delivery subject
	sub, err := w.nats.conn.SubscribeSync(inbox)
	if err != nil {
		// Clean up consumer on failure
		w.nats.js.DeleteConsumer(streamName, consumerName)
		return nil, err
	}

	watchCtx, cancel := context.WithCancel(ctx)

	ew := &eventsWatch{
		resultChan:   make(chan watch.Event, 100),
		sub:          sub,
		js:           w.nats.js,
		streamName:   streamName,
		consumerName: consumerName,
		ctx:          watchCtx,
		cancel:       cancel,
		filter:       filter,
		stopped:      false,
	}

	// Start processing messages
	go ew.processMessages()

	return ew, nil
}

// buildSubject constructs a NATS subject pattern based on scope and filters.
// Subject format: events.<tenant_type>.<tenant_name>.<namespace>.<kind>.<name>
func (w *EventsWatcher) buildSubject(scope storage.ScopeContext, filter EventsWatchFilter) string {
	prefix := w.nats.subjectPrefix
	if prefix == "" {
		prefix = "events"
	}

	parts := []string{prefix}

	// Tenant type and name
	if scope.Type == "platform" {
		parts = append(parts, ">") // Wildcard for all tenants
		return strings.Join(parts, ".")
	}

	parts = append(parts, scope.Type)
	parts = append(parts, scope.Name)

	// Namespace
	if filter.Namespace != "" {
		parts = append(parts, filter.Namespace)
	} else if filter.InvolvedObjectNamespace != "" {
		parts = append(parts, filter.InvolvedObjectNamespace)
	} else {
		parts = append(parts, "*")
	}

	// InvolvedObject Kind
	if filter.InvolvedObjectKind != "" {
		parts = append(parts, filter.InvolvedObjectKind)
	} else {
		parts = append(parts, "*")
	}

	// InvolvedObject Name - always wildcard (use filter matching for exact name)
	parts = append(parts, ">")

	return strings.Join(parts, ".")
}

// eventsWatch implements watch.Interface for event resources using JetStream.
type eventsWatch struct {
	resultChan   chan watch.Event
	sub          *nats.Subscription
	js           nats.JetStreamContext
	streamName   string
	consumerName string
	ctx          context.Context
	cancel       context.CancelFunc
	filter       EventsWatchFilter

	mu      sync.Mutex
	stopped bool

	// lastSequence tracks the last processed sequence for resourceVersion
	lastSequence uint64
}

// ResultChan returns the channel for receiving watch events.
func (w *eventsWatch) ResultChan() <-chan watch.Event {
	return w.resultChan
}

// Stop stops the watch and cleans up resources.
func (w *eventsWatch) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.stopped {
		return
	}
	w.stopped = true

	// Unsubscribe from inbox
	if w.sub != nil {
		w.sub.Unsubscribe()
	}

	// Delete ephemeral consumer
	if w.js != nil && w.consumerName != "" {
		if err := w.js.DeleteConsumer(w.streamName, w.consumerName); err != nil {
			klog.V(4).InfoS("Failed to delete consumer (may already be deleted)", "consumer", w.consumerName, "error", err)
		}
	}

	w.cancel()
	close(w.resultChan)
}

// processMessages reads messages from JetStream and sends watch events.
func (w *eventsWatch) processMessages() {
	defer w.Stop()

	for {
		select {
		case <-w.ctx.Done():
			return
		default:
			msg, err := w.sub.NextMsgWithContext(w.ctx)
			if err != nil {
				if w.ctx.Err() != nil {
					// Context cancelled, normal shutdown
					return
				}
				klog.ErrorS(err, "Error receiving JetStream message for events")
				continue
			}

			// Handle flow control heartbeats
			if len(msg.Data) == 0 && msg.Header.Get("Status") == "100" {
				// Flow control message, respond to it
				msg.Respond(nil)
				continue
			}

			// Parse the event from the message
			var event corev1.Event
			if err := json.Unmarshal(msg.Data, &event); err != nil {
				klog.ErrorS(err, "Failed to unmarshal event from JetStream message")
				msg.Nak()
				continue
			}

			// Extract sequence number for resourceVersion
			meta, err := msg.Metadata()
			if err == nil {
				w.lastSequence = meta.Sequence.Stream
				// Set resourceVersion on the event for client tracking
				event.ResourceVersion = strconv.FormatUint(meta.Sequence.Stream, 10)
			}

			// Apply client-side filters that weren't covered by the subject pattern
			if !w.matchesFilter(&event) {
				msg.Ack()
				continue
			}

			// Send the watch event
			select {
			case w.resultChan <- watch.Event{
				Type:   watch.Added,
				Object: &event,
			}:
				// Acknowledge successful delivery
				msg.Ack()
			case <-w.ctx.Done():
				return
			}
		}
	}
}

// matchesFilter checks if an event matches the additional filter criteria.
func (w *eventsWatch) matchesFilter(event *corev1.Event) bool {
	// InvolvedObject name
	if w.filter.InvolvedObjectName != "" && event.InvolvedObject.Name != w.filter.InvolvedObjectName {
		return false
	}

	// InvolvedObject UID
	if w.filter.InvolvedObjectUID != "" && string(event.InvolvedObject.UID) != w.filter.InvolvedObjectUID {
		return false
	}

	// Reason
	if w.filter.Reason != "" && event.Reason != w.filter.Reason {
		return false
	}

	// Type (Normal, Warning)
	if w.filter.Type != "" && event.Type != w.filter.Type {
		return false
	}

	// Source component
	if w.filter.Source != "" && event.Source.Component != w.filter.Source {
		return false
	}

	return true
}

// LastResourceVersion returns the last processed resourceVersion (sequence number).
func (w *eventsWatch) LastResourceVersion() string {
	return strconv.FormatUint(w.lastSequence, 10)
}
