package storage

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

const (
	// eventQueryMaxWindow is the maximum allowed query window for EventQuery.
	// Unlike the native Events list (24h), EventQuery supports up to 60 days.
	eventQueryMaxWindow = 60 * 24 * time.Hour

	// eventQueryDefaultLimit is the default page size for EventQuery results.
	eventQueryDefaultLimit = int32(100)

	// eventQueryMaxLimit is the maximum page size for EventQuery results.
	eventQueryMaxLimit = int32(1000)
)

// EventQueryBackend defines the storage interface for EventQuery operations.
type EventQueryBackend interface {
	QueryEvents(ctx context.Context, spec v1alpha1.EventQuerySpec, scope ScopeContext) (*EventQueryResult, error)
	GetMaxQueryWindow() time.Duration
	GetMaxPageSize() int32
}

// EventQueryResult contains events and pagination state from an EventQuery.
type EventQueryResult struct {
	Events   []corev1.Event
	Continue string
}

// ClickHouseEventQueryBackend implements EventQueryBackend using ClickHouse.
// Unlike ClickHouseEventsBackend (which enforces a 24-hour window on List),
// this backend supports up to 60 days of history with explicit time bounds
// from the EventQuerySpec.
type ClickHouseEventQueryBackend struct {
	conn   driver.Conn
	config ClickHouseEventsConfig
}

// NewClickHouseEventQueryBackend creates a new ClickHouse-backed EventQuery storage.
func NewClickHouseEventQueryBackend(conn driver.Conn, config ClickHouseEventsConfig) *ClickHouseEventQueryBackend {
	return &ClickHouseEventQueryBackend{
		conn:   conn,
		config: config,
	}
}

// GetMaxQueryWindow returns the maximum allowed query time window (60 days).
func (b *ClickHouseEventQueryBackend) GetMaxQueryWindow() time.Duration {
	return eventQueryMaxWindow
}

// GetMaxPageSize returns the maximum allowed page size (1000).
func (b *ClickHouseEventQueryBackend) GetMaxPageSize() int32 {
	return eventQueryMaxLimit
}

// QueryEvents retrieves Kubernetes Events matching the query specification and scope.
// The spec must be pre-validated by the API layer (startTime, endTime required,
// window <= 60 days, limit <= 1000).
func (b *ClickHouseEventQueryBackend) QueryEvents(ctx context.Context, spec v1alpha1.EventQuerySpec, scope ScopeContext) (*EventQueryResult, error) {
	query, args, err := b.buildQuery(ctx, spec, scope)
	if err != nil {
		return nil, err
	}

	klog.V(3).InfoS("Executing EventQuery ClickHouse query",
		"query", query,
		"argsCount", len(args),
	)

	rows, err := b.conn.Query(ctx, query, args...)
	if err != nil {
		klog.ErrorS(err, "EventQuery ClickHouse query failed",
			"fieldSelector", spec.FieldSelector,
			"namespace", spec.Namespace,
			"limit", spec.Limit,
		)
		return nil, fmt.Errorf("unable to retrieve events. Try again or contact support if the problem persists")
	}
	defer rows.Close()

	limit := resolveEventQueryLimit(spec.Limit)

	var events []corev1.Event
	for rows.Next() {
		var eventJSON string
		if err := rows.Scan(&eventJSON); err != nil {
			klog.ErrorS(err, "Failed to scan EventQuery row")
			return nil, fmt.Errorf("unable to retrieve events. Try again or contact support if the problem persists")
		}

		var event corev1.Event
		if err := json.Unmarshal([]byte(eventJSON), &event); err != nil {
			klog.ErrorS(err, "Failed to unmarshal event in EventQuery, skipping")
			continue
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		klog.ErrorS(err, "Error iterating EventQuery rows")
		return nil, fmt.Errorf("unable to retrieve events. Try again or contact support if the problem persists")
	}

	// Check whether more results exist (we fetched limit+1)
	var continueToken string
	if int32(len(events)) > limit {
		events = events[:limit]
		if len(events) > 0 {
			lastEvent := events[len(events)-1]
			continueToken = encodeEventQueryCursor(lastEvent, spec)
		}
	}

	klog.V(4).InfoS("EventQuery completed",
		"rowsReturned", len(events),
		"hasMore", continueToken != "",
		"namespace", spec.Namespace,
		"limit", spec.Limit,
	)

	return &EventQueryResult{
		Events:   events,
		Continue: continueToken,
	}, nil
}

// buildQuery constructs the ClickHouse SQL query from the EventQuerySpec.
func (b *ClickHouseEventQueryBackend) buildQuery(_ context.Context, spec v1alpha1.EventQuerySpec, scope ScopeContext) (string, []interface{}, error) {
	var conditions []string
	var args []interface{}

	// Scope filtering — events carry scope annotations set at write time
	scopeConds, scopeArgs := b.buildScopeConditions(scope)
	conditions = append(conditions, scopeConds...)
	args = append(args, scopeArgs...)

	// Namespace filter (optional)
	if spec.Namespace != "" {
		conditions = append(conditions, "namespace = ?")
		args = append(args, spec.Namespace)
	}

	// Time range — use a single reference time to prevent sub-second drift
	now := time.Now()

	if spec.StartTime != "" {
		startTime, err := timeutil.ParseFlexibleTime(spec.StartTime, now)
		if err != nil {
			return "", nil, fmt.Errorf("invalid startTime: %w", err)
		}
		conditions = append(conditions, "last_timestamp >= ?")
		args = append(args, startTime)
	}

	if spec.EndTime != "" {
		endTime, err := timeutil.ParseFlexibleTime(spec.EndTime, now)
		if err != nil {
			return "", nil, fmt.Errorf("invalid endTime: %w", err)
		}
		conditions = append(conditions, "last_timestamp < ?")
		args = append(args, endTime)
	}

	// Field selector (optional) — translates standard K8s field selectors to WHERE clauses
	if spec.FieldSelector != "" {
		terms, err := ParseFieldSelector(spec.FieldSelector)
		if err != nil {
			return "", nil, fmt.Errorf("invalid fieldSelector: %w", err)
		}
		fieldConds, fieldArgs := FieldSelectorTermsToSQL(terms)
		conditions = append(conditions, fieldConds...)
		args = append(args, fieldArgs...)
	}

	// Pagination cursor — decode offset from opaque continue token
	if spec.Continue != "" {
		offset, err := decodeEventQueryCursor(spec.Continue, spec)
		if err != nil {
			return "", nil, err
		}
		// Offset-based pagination: skip rows already returned in previous pages
		limit := resolveEventQueryLimit(spec.Limit)
		query := fmt.Sprintf("SELECT event_json FROM %s.%s", b.config.Database, "k8s_events")
		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		query += " ORDER BY last_timestamp DESC, namespace, name"
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit+1, offset)
		return query, args, nil
	}

	query := fmt.Sprintf("SELECT event_json FROM %s.%s", b.config.Database, "k8s_events")
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY last_timestamp DESC, namespace, name"

	limit := resolveEventQueryLimit(spec.Limit)
	query += fmt.Sprintf(" LIMIT %d", limit+1)

	return query, args, nil
}

// buildScopeConditions returns WHERE conditions for scope-based multi-tenancy filtering.
func (b *ClickHouseEventQueryBackend) buildScopeConditions(scope ScopeContext) ([]string, []interface{}) {
	var conditions []string
	var args []interface{}

	if scope.Type == "" || scope.Type == "platform" {
		// Platform scope sees all events across all tenants
		return conditions, args
	}

	switch scope.Type {
	case "organization", "project":
		conditions = append(conditions, "scope_type = ?", "scope_name = ?")
		args = append(args, scope.Type, scope.Name)
	case "user":
		// User scope falls back to organization/project filtering for events
		// since events don't carry user-level attribution the same way audit logs do.
		conditions = append(conditions, "scope_type = ?", "scope_name = ?")
		args = append(args, scope.Type, scope.Name)
	}

	return conditions, args
}

// resolveEventQueryLimit applies default and maximum bounds to the requested limit.
func resolveEventQueryLimit(requested int32) int32 {
	if requested <= 0 {
		return eventQueryDefaultLimit
	}
	if requested > eventQueryMaxLimit {
		return eventQueryMaxLimit
	}
	return requested
}

// eventQueryCursorData encodes pagination state for EventQuery.
// Uses offset-based pagination because events lack a stable monotonic cursor field
// analogous to audit_id in audit logs.
type eventQueryCursorData struct {
	Offset    int32     `json:"o"`  // Number of rows to skip
	QueryHash string    `json:"h"`  // Hash of query parameters for validation
	IssuedAt  time.Time `json:"i"`  // When cursor was created (for expiration)
}

// hashEventQueryParams creates a stable hash of the query parameters.
// Excludes Continue since it changes between pagination requests.
func hashEventQueryParams(spec v1alpha1.EventQuerySpec) string {
	h := sha256.New()
	h.Write([]byte(spec.StartTime))
	h.Write([]byte("|"))
	h.Write([]byte(spec.EndTime))
	h.Write([]byte("|"))
	h.Write([]byte(spec.Namespace))
	h.Write([]byte("|"))
	h.Write([]byte(spec.FieldSelector))
	h.Write([]byte("|"))
	h.Write([]byte(fmt.Sprintf("%d", spec.Limit)))
	return base64.URLEncoding.EncodeToString(h.Sum(nil)[:16])
}

// encodeEventQueryCursor creates a base64-encoded pagination token.
// The offset is computed from the position of the last event returned.
func encodeEventQueryCursor(lastEvent corev1.Event, spec v1alpha1.EventQuerySpec) string {
	// Determine the current page's starting offset from the Continue token, if any
	currentOffset := int32(0)
	if spec.Continue != "" {
		if offset, err := decodeEventQueryCursor(spec.Continue, spec); err == nil {
			currentOffset = offset
		}
	}

	limit := resolveEventQueryLimit(spec.Limit)
	nextOffset := currentOffset + limit

	data := eventQueryCursorData{
		Offset:    nextOffset,
		QueryHash: hashEventQueryParams(spec),
		IssuedAt:  time.Now(),
	}

	jsonData, _ := json.Marshal(data)
	return base64.URLEncoding.EncodeToString(jsonData)
}

// decodeEventQueryCursor validates and extracts the offset from a cursor token.
// Returns an error if the cursor is malformed, expired, or parameters changed.
func decodeEventQueryCursor(cursor string, spec v1alpha1.EventQuerySpec) (int32, error) {
	decoded, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, fmt.Errorf("cannot decode pagination cursor: %w", err)
	}

	var data eventQueryCursorData
	if err := json.Unmarshal(decoded, &data); err != nil {
		return 0, fmt.Errorf("cursor format is invalid. Start a new query")
	}

	currentHash := hashEventQueryParams(spec)
	if data.QueryHash != currentHash {
		return 0, fmt.Errorf("cannot use cursor because query parameters changed. Start a new query without the continue parameter")
	}

	if data.IssuedAt.IsZero() {
		return 0, fmt.Errorf("cursor format is invalid. Start a new query")
	}

	age := time.Since(data.IssuedAt)
	if age > cursorTTL {
		return 0, fmt.Errorf("cursor expired after %v. Cursors are valid for %v. Start a new query without the continue parameter",
			age.Round(time.Second),
			cursorTTL,
		)
	}

	return data.Offset, nil
}

// ValidateEventQueryCursor checks if a cursor is valid for the given EventQuerySpec.
// Called by the API layer during validation to provide early feedback.
func ValidateEventQueryCursor(cursor string, spec v1alpha1.EventQuerySpec) error {
	_, err := decodeEventQueryCursor(cursor, spec)
	return err
}

// GetEventQueryNotFoundError returns a standard not-found error for EventQuery resources.
// Exported for use by the REST handler.
func GetEventQueryNotFoundError(name string) error {
	return errors.NewNotFound(v1alpha1.Resource("eventqueries"), name)
}
