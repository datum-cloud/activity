package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/metrics"
)

// ClickHouseEventsBackend implements the EventsBackend interface using ClickHouse.
type ClickHouseEventsBackend struct {
	conn     driver.Conn
	config   ClickHouseEventsConfig
	natsConn NATSConnection // Optional NATS connection for watch support
}

// NATSConnection defines the interface for NATS operations needed by the events backend.
// This allows for easy mocking in tests.
type NATSConnection interface {
	Publish(subject string, data []byte) error
	Subscribe(subject string, cb func(*NATSMessage)) (NATSSubscription, error)
}

// NATSMessage represents a NATS message.
type NATSMessage struct {
	Subject string
	Data    []byte
}

// NATSSubscription represents a NATS subscription.
type NATSSubscription interface {
	Unsubscribe() error
}

// ClickHouseEventsConfig configures the ClickHouse events storage.
type ClickHouseEventsConfig struct {
	Database string
}

// NewClickHouseEventsBackend creates a new ClickHouse-backed events storage.
func NewClickHouseEventsBackend(conn driver.Conn, config ClickHouseEventsConfig) *ClickHouseEventsBackend {
	return &ClickHouseEventsBackend{
		conn:   conn,
		config: config,
	}
}

// Create stores a new event in ClickHouse.
func (b *ClickHouseEventsBackend) Create(ctx context.Context, event *corev1.Event, scope ScopeContext) (*corev1.Event, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.events.create",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "INSERT"),
			attribute.String("event.namespace", event.Namespace),
			attribute.String("event.name", event.Name),
		),
	)
	defer span.End()

	// Generate UID if not set
	if event.UID == "" {
		event.UID = types.UID(uuid.New().String())
	}

	// Set timestamps if not set
	now := metav1.Now()
	if event.FirstTimestamp.IsZero() {
		event.FirstTimestamp = now
	}
	if event.LastTimestamp.IsZero() {
		event.LastTimestamp = now
	}
	if event.Count == 0 {
		event.Count = 1
	}

	// Set scope annotations
	if event.Annotations == nil {
		event.Annotations = make(map[string]string)
	}
	if scope.Type != "" && scope.Type != "platform" {
		event.Annotations["platform.miloapis.com/scope.type"] = scope.Type
		event.Annotations["platform.miloapis.com/scope.name"] = scope.Name
	}

	// Serialize event to JSON
	eventJSON, err := json.Marshal(event)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal event")
		return nil, fmt.Errorf("failed to marshal event: %w", err)
	}

	// Insert into ClickHouse
	insertTime := time.Now()
	query := fmt.Sprintf("INSERT INTO %s.%s (event_json, inserted_at) VALUES (?, ?)",
		b.config.Database, "k8s_events")

	if err := b.conn.Exec(ctx, query, string(eventJSON), insertTime); err != nil {
		metrics.ClickHouseQueryErrors.WithLabelValues("insert").Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, "insert failed")
		klog.ErrorS(err, "Failed to insert event",
			"namespace", event.Namespace,
			"name", event.Name,
		)
		return nil, fmt.Errorf("failed to insert event: %w", err)
	}

	// Set ResourceVersion from insertion time (nanoseconds for uniqueness)
	event.ResourceVersion = strconv.FormatInt(insertTime.UnixNano(), 10)

	span.SetStatus(codes.Ok, "event created")
	klog.V(4).InfoS("Created event",
		"namespace", event.Namespace,
		"name", event.Name,
		"uid", event.UID,
		"resourceVersion", event.ResourceVersion,
	)

	return event, nil
}

// Get retrieves a single event by namespace and name.
func (b *ClickHouseEventsBackend) Get(ctx context.Context, namespace, name string, scope ScopeContext) (*corev1.Event, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.events.get",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "SELECT"),
			attribute.String("event.namespace", namespace),
			attribute.String("event.name", name),
		),
	)
	defer span.End()

	var conditions []string
	var args []interface{}

	conditions = append(conditions, "namespace = ?", "name = ?")
	args = append(args, namespace, name)

	// Add scope filtering
	scopeConds, scopeArgs := b.buildScopeConditions(scope)
	conditions = append(conditions, scopeConds...)
	args = append(args, scopeArgs...)

	query := fmt.Sprintf(
		"SELECT event_json, inserted_at FROM %s.%s WHERE %s ORDER BY inserted_at DESC LIMIT 1",
		b.config.Database, "k8s_events", strings.Join(conditions, " AND "))

	row := b.conn.QueryRow(ctx, query, args...)

	var eventJSON string
	var insertedAt time.Time
	if err := row.Scan(&eventJSON, &insertedAt); err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, errors.NewNotFound(corev1.Resource("events"), name)
		}
		span.RecordError(err)
		span.SetStatus(codes.Error, "query failed")
		return nil, fmt.Errorf("failed to get event: %w", err)
	}

	var event corev1.Event
	if err := json.Unmarshal([]byte(eventJSON), &event); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "unmarshal failed")
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Set ResourceVersion from insertion timestamp
	event.ResourceVersion = strconv.FormatInt(insertedAt.UnixNano(), 10)

	span.SetStatus(codes.Ok, "event retrieved")
	return &event, nil
}

// List retrieves events matching the given namespace and options.
func (b *ClickHouseEventsBackend) List(ctx context.Context, namespace string, opts metav1.ListOptions, scope ScopeContext) (*corev1.EventList, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.events.list",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "SELECT"),
			attribute.String("event.namespace", namespace),
			attribute.String("list.fieldSelector", opts.FieldSelector),
			attribute.Int64("list.limit", opts.Limit),
		),
	)
	defer span.End()

	var conditions []string
	var args []interface{}

	// Enforce a 24-hour lookback window for native List calls.
	// Use EventQuery for longer historical queries (up to 60 days).
	window24h := time.Now().Add(-24 * time.Hour)
	conditions = append([]string{"last_timestamp >= ?"}, conditions...)
	args = append([]interface{}{window24h}, args...)

	// Namespace filter (if specified)
	if namespace != "" {
		conditions = append(conditions, "namespace = ?")
		args = append(args, namespace)
	}

	// Add scope filtering
	scopeConds, scopeArgs := b.buildScopeConditions(scope)
	conditions = append(conditions, scopeConds...)
	args = append(args, scopeArgs...)

	// Parse and apply field selectors
	if opts.FieldSelector != "" {
		terms, err := ParseFieldSelector(opts.FieldSelector)
		if err != nil {
			return nil, errors.NewBadRequest(fmt.Sprintf("invalid field selector: %s", err))
		}
		fieldConds, fieldArgs := FieldSelectorTermsToSQL(terms)
		conditions = append(conditions, fieldConds...)
		args = append(args, fieldArgs...)
	}

	// ResourceVersion filter for continuation
	if opts.ResourceVersion != "" && opts.ResourceVersion != "0" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err == nil {
			// For list, get events newer than the resource version
			rvTime := time.Unix(0, rv)
			conditions = append(conditions, "inserted_at > ?")
			args = append(args, rvTime)
		}
	}

	// Build WHERE clause
	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Determine limit
	limit := int64(500) // default
	if opts.Limit > 0 {
		limit = opts.Limit
	}

	query := fmt.Sprintf(
		"SELECT event_json, inserted_at FROM %s.%s %s ORDER BY last_timestamp DESC, namespace, name LIMIT %d",
		b.config.Database, "k8s_events", whereClause, limit+1)

	klog.V(4).InfoS("Executing events list query",
		"query", query,
		"args", args,
	)

	rows, err := b.conn.Query(ctx, query, args...)
	if err != nil {
		metrics.ClickHouseQueryErrors.WithLabelValues("query").Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, "query failed")
		return nil, fmt.Errorf("failed to list events: %w", err)
	}
	defer rows.Close()

	var events []corev1.Event
	var lastRV string
	for rows.Next() {
		var eventJSON string
		var insertedAt time.Time
		if err := rows.Scan(&eventJSON, &insertedAt); err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		var event corev1.Event
		if err := json.Unmarshal([]byte(eventJSON), &event); err != nil {
			klog.ErrorS(err, "Failed to unmarshal event, skipping", "json", eventJSON[:min(len(eventJSON), 200)])
			continue
		}

		event.ResourceVersion = strconv.FormatInt(insertedAt.UnixNano(), 10)
		lastRV = event.ResourceVersion
		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("error iterating events: %w", err)
	}

	// Check for more results
	var continueToken string
	if int64(len(events)) > limit {
		events = events[:limit]
		if len(events) > 0 {
			continueToken = events[len(events)-1].ResourceVersion
		}
	}

	result := &corev1.EventList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "EventList",
		},
		ListMeta: metav1.ListMeta{
			ResourceVersion: lastRV,
			Continue:        continueToken,
		},
		Items: events,
	}

	span.SetAttributes(attribute.Int("events.count", len(events)))
	span.SetStatus(codes.Ok, "events listed")
	return result, nil
}

// Update modifies an existing event.
func (b *ClickHouseEventsBackend) Update(ctx context.Context, event *corev1.Event, scope ScopeContext) (*corev1.Event, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.events.update",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "INSERT"),
			attribute.String("event.namespace", event.Namespace),
			attribute.String("event.name", event.Name),
		),
	)
	defer span.End()

	// Get existing event to verify it exists and check scope
	existing, err := b.Get(ctx, event.Namespace, event.Name, scope)
	if err != nil {
		return nil, err
	}

	// Preserve UID from existing event
	if event.UID == "" {
		event.UID = existing.UID
	}

	// Update lastTimestamp
	event.LastTimestamp = metav1.Now()

	// Increment count if this is an event aggregation update
	if event.Count == 0 {
		event.Count = existing.Count + 1
	}

	// Preserve firstTimestamp from original
	if event.FirstTimestamp.IsZero() {
		event.FirstTimestamp = existing.FirstTimestamp
	}

	// Set scope annotations
	if event.Annotations == nil {
		event.Annotations = make(map[string]string)
	}
	if scope.Type != "" && scope.Type != "platform" {
		event.Annotations["platform.miloapis.com/scope.type"] = scope.Type
		event.Annotations["platform.miloapis.com/scope.name"] = scope.Name
	}

	// Serialize event to JSON
	eventJSON, err := json.Marshal(event)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal event")
		return nil, fmt.Errorf("failed to marshal event: %w", err)
	}

	// Insert new version (ReplacingMergeTree will deduplicate by namespace, name, uid)
	insertTime := time.Now()
	query := fmt.Sprintf("INSERT INTO %s.%s (event_json, inserted_at) VALUES (?, ?)",
		b.config.Database, "k8s_events")

	if err := b.conn.Exec(ctx, query, string(eventJSON), insertTime); err != nil {
		metrics.ClickHouseQueryErrors.WithLabelValues("insert").Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, "update failed")
		return nil, fmt.Errorf("failed to update event: %w", err)
	}

	// Set ResourceVersion from insertion time
	event.ResourceVersion = strconv.FormatInt(insertTime.UnixNano(), 10)

	span.SetStatus(codes.Ok, "event updated")
	klog.V(4).InfoS("Updated event",
		"namespace", event.Namespace,
		"name", event.Name,
		"uid", event.UID,
		"count", event.Count,
		"resourceVersion", event.ResourceVersion,
	)

	return event, nil
}

// Delete removes an event by namespace and name.
// Note: In ClickHouse, we use a lightweight delete which marks rows for deletion
// during the next merge. For immediate consistency, we rely on the Get/List
// operations to filter out deleted events.
func (b *ClickHouseEventsBackend) Delete(ctx context.Context, namespace, name string, scope ScopeContext) error {
	ctx, span := tracer.Start(ctx, "clickhouse.events.delete",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "DELETE"),
			attribute.String("event.namespace", namespace),
			attribute.String("event.name", name),
		),
	)
	defer span.End()

	// Verify event exists and is within scope
	_, err := b.Get(ctx, namespace, name, scope)
	if err != nil {
		if errors.IsNotFound(err) {
			// Already deleted - success
			span.SetStatus(codes.Ok, "event already deleted")
			return nil
		}
		return err
	}

	var conditions []string
	var args []interface{}

	conditions = append(conditions, "namespace = ?", "name = ?")
	args = append(args, namespace, name)

	// Add scope filtering
	scopeConds, scopeArgs := b.buildScopeConditions(scope)
	conditions = append(conditions, scopeConds...)
	args = append(args, scopeArgs...)

	// Use lightweight delete (ALTER TABLE ... DELETE)
	query := fmt.Sprintf(
		"ALTER TABLE %s.%s DELETE WHERE %s",
		b.config.Database, "k8s_events", strings.Join(conditions, " AND "))

	if err := b.conn.Exec(ctx, query, args...); err != nil {
		metrics.ClickHouseQueryErrors.WithLabelValues("delete").Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, "delete failed")
		return fmt.Errorf("failed to delete event: %w", err)
	}

	span.SetStatus(codes.Ok, "event deleted")
	klog.V(4).InfoS("Deleted event",
		"namespace", namespace,
		"name", name,
	)

	return nil
}

// Watch returns a watch.Interface that streams event changes.
// Watch is implemented via NATS JetStream at the REST layer (EventsREST.Watch),
// not through the ClickHouse backend. This method exists only to satisfy the
// EventsBackend interface but should not be called directly.
//
// The REST layer uses EventsNATSWatcher (internal/watch/events_watcher.go) for
// real-time event streaming via NATS JetStream subscriptions.
func (b *ClickHouseEventsBackend) Watch(ctx context.Context, namespace string, opts metav1.ListOptions, scope ScopeContext) (watch.Interface, error) {
	return nil, errors.NewMethodNotSupported(corev1.Resource("events"), "watch")
}

// buildScopeConditions creates SQL conditions for scope filtering.
func (b *ClickHouseEventsBackend) buildScopeConditions(scope ScopeContext) ([]string, []interface{}) {
	var conditions []string
	var args []interface{}

	if scope.Type == "" || scope.Type == "platform" {
		// Platform scope sees all events
		return conditions, args
	}

	switch scope.Type {
	case "user":
		// User scope: filter by user UID (not implemented for events)
		// Events don't have a user field in the same way as audit logs
		// For now, fall through to organization/project filtering
		fallthrough
	case "organization", "project":
		conditions = append(conditions, "scope_type = ?", "scope_name = ?")
		args = append(args, scope.Type, scope.Name)
	}

	return conditions, args
}

