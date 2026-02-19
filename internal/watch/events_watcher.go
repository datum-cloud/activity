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

// EventsNATSWatcher manages NATS JetStream connections for Kubernetes event watch operations.
type EventsNATSWatcher struct {
	conn          *nats.Conn
	js            nats.JetStreamContext
	streamName    string
	subjectPrefix string
}

// EventsNATSConfig contains NATS connection configuration for events.
type EventsNATSConfig struct {
	URL           string
	StreamName    string // JetStream stream name (e.g., "EVENTS")
	SubjectPrefix string // Subject prefix (e.g., "events")
	TLSEnabled    bool
	TLSCertFile   string
	TLSKeyFile    string
	TLSCAFile     string
}

// NewEventsNATSWatcher creates a new NATS watcher for Kubernetes events.
// Returns nil if URL is empty (watch disabled).
func NewEventsNATSWatcher(config EventsNATSConfig) (*EventsNATSWatcher, error) {
	if config.URL == "" {
		klog.Info("NATS URL not configured for events, Watch API will be disabled")
		return nil, nil
	}

	opts := []nats.Option{
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			if err != nil {
				klog.ErrorS(err, "Events NATS disconnected")
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			klog.Info("Events NATS reconnected", "url", nc.ConnectedUrl())
		}),
	}

	// Add TLS configuration if enabled
	if config.TLSEnabled {
		tlsConfig, err := buildNATSTLSConfig(NATSConfig{
			TLSEnabled:  config.TLSEnabled,
			TLSCertFile: config.TLSCertFile,
			TLSKeyFile:  config.TLSKeyFile,
			TLSCAFile:   config.TLSCAFile,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to build NATS TLS config: %w", err)
		}
		opts = append(opts, nats.Secure(tlsConfig))
		klog.V(2).InfoS("NATS TLS enabled for Events Watch API")
	}

	conn, err := nats.Connect(config.URL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS for events: %w", err)
	}

	// Create JetStream context
	js, err := conn.JetStream()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create JetStream context for events: %w", err)
	}

	prefix := config.SubjectPrefix
	if prefix == "" {
		prefix = "events"
	}

	streamName := config.StreamName
	if streamName == "" {
		streamName = "EVENTS"
	}

	klog.Info("Connected to NATS JetStream for Events Watch API",
		"url", config.URL,
		"stream", streamName,
		"subjectPrefix", prefix,
	)

	return &EventsNATSWatcher{
		conn:          conn,
		js:            js,
		streamName:    streamName,
		subjectPrefix: prefix,
	}, nil
}

// Close closes the NATS connection.
func (w *EventsNATSWatcher) Close() {
	if w.conn != nil {
		w.conn.Close()
	}
}

// EventWatchFilter contains filter criteria for event watch operations.
type EventWatchFilter struct {
	// ResourceVersion is the JetStream sequence number to start from.
	// If 0, starts from the latest message (real-time only).
	// If > 0, replays from that sequence number.
	ResourceVersion uint64
	// Namespace filters events by namespace
	Namespace string
	// InvolvedObjectKind filters by involved object kind
	InvolvedObjectKind string
	// InvolvedObjectName filters by involved object name
	InvolvedObjectName string
	// Reason filters by event reason
	Reason string
	// Type filters by event type (Normal/Warning)
	Type string
	// FieldSelector is the raw field selector string
	FieldSelector string
}

// Watch creates a new watch for Kubernetes events matching the given scope and filter.
func (w *EventsNATSWatcher) Watch(ctx context.Context, scope storage.ScopeContext, filter EventWatchFilter) (watch.Interface, error) {
	if w == nil || w.js == nil {
		return nil, fmt.Errorf("Events Watch API is not available: NATS not configured")
	}

	// Build the NATS subject filter based on scope and namespace
	subject := w.buildSubject(scope, filter)

	// Generate unique consumer name for this watch
	consumerName := fmt.Sprintf("events-watch-%s", uuid.New().String()[:8])

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
		Name:              consumerName,
		FilterSubject:     subject,
		DeliverPolicy:     deliverPolicy,
		AckPolicy:         nats.AckExplicitPolicy,
		DeliverSubject:    inbox,
		InactiveThreshold: 5 * time.Minute,
		FlowControl:       true,
		Heartbeat:         30 * time.Second,
	}

	if optStartSeq > 0 {
		consumerConfig.OptStartSeq = optStartSeq
	}

	// Add consumer to stream
	_, err := w.js.AddConsumer(w.streamName, consumerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create JetStream consumer for events: %w", err)
	}

	// Subscribe to the consumer's delivery subject
	sub, err := w.conn.SubscribeSync(inbox)
	if err != nil {
		w.js.DeleteConsumer(w.streamName, consumerName)
		return nil, fmt.Errorf("failed to subscribe to events consumer inbox: %w", err)
	}

	watchCtx, cancel := context.WithCancel(ctx)

	ew := &EventWatch{
		resultChan:   make(chan watch.Event, 100),
		sub:          sub,
		js:           w.js,
		streamName:   w.streamName,
		consumerName: consumerName,
		ctx:          watchCtx,
		cancel:       cancel,
		filter:       filter,
		scope:        scope,
		stopped:      false,
	}

	// Start processing messages
	go ew.processMessages()

	return ew, nil
}

// buildSubject constructs a NATS subject pattern based on scope and filters.
// Subject format from exporter: events.k8s.{namespace}
func (w *EventsNATSWatcher) buildSubject(scope storage.ScopeContext, filter EventWatchFilter) string {
	parts := []string{w.subjectPrefix}

	// Namespace filter
	if filter.Namespace != "" {
		parts = append(parts, filter.Namespace)
	} else {
		parts = append(parts, ">") // Wildcard for all namespaces
	}

	return strings.Join(parts, ".")
}

// EventWatch implements watch.Interface for Kubernetes event resources using JetStream.
type EventWatch struct {
	resultChan   chan watch.Event
	sub          *nats.Subscription
	js           nats.JetStreamContext
	streamName   string
	consumerName string
	ctx          context.Context
	cancel       context.CancelFunc
	filter       EventWatchFilter
	scope        storage.ScopeContext

	mu      sync.Mutex
	stopped bool

	// lastSequence tracks the last processed sequence for resourceVersion
	lastSequence uint64
}

// ResultChan returns the channel for receiving watch events.
func (w *EventWatch) ResultChan() <-chan watch.Event {
	return w.resultChan
}

// Stop stops the watch and cleans up resources.
func (w *EventWatch) Stop() {
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
			klog.V(4).InfoS("Failed to delete events consumer (may already be deleted)", "consumer", w.consumerName, "error", err)
		}
	}

	w.cancel()
	close(w.resultChan)
}

// processMessages reads messages from JetStream and sends watch events.
func (w *EventWatch) processMessages() {
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

			// Apply client-side filters
			if !w.matchesFilter(&event) {
				msg.Ack()
				continue
			}

			// Check scope filtering
			if !w.matchesScope(&event) {
				msg.Ack()
				continue
			}

			// Send the watch event
			select {
			case w.resultChan <- watch.Event{
				Type:   watch.Added,
				Object: &event,
			}:
				msg.Ack()
			case <-w.ctx.Done():
				return
			}
		}
	}
}

// matchesFilter checks if an event matches the filter criteria.
func (w *EventWatch) matchesFilter(event *corev1.Event) bool {
	if w.filter.InvolvedObjectKind != "" && event.InvolvedObject.Kind != w.filter.InvolvedObjectKind {
		return false
	}
	if w.filter.InvolvedObjectName != "" && event.InvolvedObject.Name != w.filter.InvolvedObjectName {
		return false
	}
	if w.filter.Reason != "" && event.Reason != w.filter.Reason {
		return false
	}
	if w.filter.Type != "" && event.Type != w.filter.Type {
		return false
	}

	// Parse field selector if present and apply additional filters
	if w.filter.FieldSelector != "" {
		terms, err := storage.ParseFieldSelector(w.filter.FieldSelector)
		if err != nil {
			klog.V(4).InfoS("Failed to parse field selector in watch",
				"fieldSelector", w.filter.FieldSelector,
				"error", err,
			)
			return true // Fail open on parse error
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
	}

	return true
}

// matchesScope checks if an event matches the watcher's scope.
func (w *EventWatch) matchesScope(event *corev1.Event) bool {
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

// EventsWatcherInterface defines the interface for event watch operations.
type EventsWatcherInterface interface {
	Watch(ctx context.Context, scope storage.ScopeContext, filter EventWatchFilter) (watch.Interface, error)
}
