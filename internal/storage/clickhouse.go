package storage

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/cel"
	"go.miloapis.com/activity/internal/metrics"
	"go.miloapis.com/activity/internal/timeutil"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var tracer = otel.Tracer("activity-clickhouse-storage")

const (
	// cursorTTL limits cursor lifetime to prevent replay attacks and stale queries.
	cursorTTL = 1 * time.Hour
)

// cursorData encodes pagination state and query validation information.
type cursorData struct {
	Timestamp time.Time `json:"t"` // Event timestamp for pagination
	AuditID   string    `json:"a"` // Audit ID for tie-breaking
	QueryHash string    `json:"h"` // Hash of query parameters
	IssuedAt  time.Time `json:"i"` // When cursor was created (for expiration)
}

// hashQueryParams creates a hash to validate cursors are used with matching queries.
// Excludes continueAfter since it changes between pagination requests.
func hashQueryParams(spec v1alpha1.AuditLogQuerySpec) string {
	h := sha256.New()
	h.Write([]byte(spec.StartTime))
	h.Write([]byte("|"))
	h.Write([]byte(spec.EndTime))
	h.Write([]byte("|"))
	h.Write([]byte(spec.Filter))
	h.Write([]byte("|"))
	h.Write([]byte(fmt.Sprintf("%d", spec.Limit)))

	return base64.URLEncoding.EncodeToString(h.Sum(nil)[:16])
}

// encodeCursor creates a base64-encoded pagination token containing position and validation data.
func encodeCursor(timestamp time.Time, auditID string, spec v1alpha1.AuditLogQuerySpec) string {
	data := cursorData{
		Timestamp: timestamp,
		AuditID:   auditID,
		QueryHash: hashQueryParams(spec),
		IssuedAt:  time.Now(),
	}

	jsonData, _ := json.Marshal(data)
	return base64.URLEncoding.EncodeToString(jsonData)
}

// ValidateCursor checks if a cursor is valid for the given query spec without extracting data.
// This is called by the API layer during validation to provide early feedback.
// Returns an error if the cursor is malformed, expired, or doesn't match the query parameters.
func ValidateCursor(cursor string, spec v1alpha1.AuditLogQuerySpec) error {
	_, _, err := decodeCursor(cursor, spec)
	return err
}

// decodeCursor validates and extracts pagination state from a cursor token.
// Returns an error if the cursor is malformed, expired, or doesn't match the current query.
func decodeCursor(cursor string, spec v1alpha1.AuditLogQuerySpec) (time.Time, string, error) {
	decoded, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", fmt.Errorf("cannot decode pagination cursor: %w", err)
	}

	var data cursorData
	if err := json.Unmarshal(decoded, &data); err != nil {
		return time.Time{}, "", fmt.Errorf("cursor format is invalid. Start a new query")
	}

	currentHash := hashQueryParams(spec)
	if data.QueryHash != currentHash {
		return time.Time{}, "", fmt.Errorf("cannot use cursor because query parameters changed. Start a new query without the continueAfter parameter")
	}

	if data.IssuedAt.IsZero() {
		return time.Time{}, "", fmt.Errorf("cursor format is invalid. Start a new query")
	}

	age := time.Since(data.IssuedAt)
	if age > cursorTTL {
		return time.Time{}, "", fmt.Errorf("cursor expired after %v. Cursors are valid for %v. Start a new query without the continueAfter parameter",
			age.Round(time.Second),
			cursorTTL,
		)
	}

	return data.Timestamp, data.AuditID, nil
}

// ClickHouseConfig configures the ClickHouse connection and query limits.
type ClickHouseConfig struct {
	Address  string
	Database string
	Username string
	Password string
	Table    string

	// TLS configuration (optional - disabled by default)
	TLSEnabled  bool   // Enable TLS for ClickHouse connection
	TLSCertFile string // Path to client certificate file
	TLSKeyFile  string // Path to client key file
	TLSCAFile   string // Path to CA certificate file

	MaxQueryWindow time.Duration // Maximum allowed time range for queries
	MaxPageSize    int32         // Maximum results per page
}

// ClickHouseStorage implements audit log storage using ClickHouse.
type ClickHouseStorage struct {
	conn   driver.Conn
	config ClickHouseConfig
}

// NewClickHouseStorage establishes a connection to ClickHouse and validates connectivity.
func NewClickHouseStorage(config ClickHouseConfig) (*ClickHouseStorage, error) {
	options := &clickhouse.Options{
		Addr: []string{config.Address},
		Auth: clickhouse.Auth{
			Database: config.Database,
			Username: config.Username,
			Password: config.Password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
		},
		DialTimeout: 5 * time.Second,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
	}

	// Configure TLS if enabled
	if config.TLSEnabled {
		tlsConfig, err := loadTLSConfig(config)
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS configuration: %w", err)
		}
		options.TLS = tlsConfig
		klog.V(2).Info("ClickHouse TLS enabled")
	}

	conn, err := clickhouse.Open(options)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	if err := conn.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping ClickHouse: %w", err)
	}

	return &ClickHouseStorage{
		conn:   conn,
		config: config,
	}, nil
}

// loadTLSConfig loads TLS certificates and creates a tls.Config for ClickHouse connection.
func loadTLSConfig(config ClickHouseConfig) (*tls.Config, error) {
	tlsConfig := &tls.Config{}

	// Load client certificate and key if provided
	if config.TLSCertFile != "" && config.TLSKeyFile != "" {
		cert, err := tls.LoadX509KeyPair(config.TLSCertFile, config.TLSKeyFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
		klog.V(2).Infof("Loaded client certificate from %s", config.TLSCertFile)
	}

	// Load CA certificate if provided
	if config.TLSCAFile != "" {
		caCert, err := os.ReadFile(config.TLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
		klog.V(2).Infof("Loaded CA certificate from %s", config.TLSCAFile)
	}

	return tlsConfig, nil
}

func (s *ClickHouseStorage) Close() error {
	if s.conn != nil {
		return s.conn.Close()
	}
	return nil
}

func (s *ClickHouseStorage) GetMaxQueryWindow() time.Duration {
	return s.config.MaxQueryWindow
}

func (s *ClickHouseStorage) GetMaxPageSize() int32 {
	return s.config.MaxPageSize
}

// QueryResult contains audit events and pagination state.
type QueryResult struct {
	Events   []auditv1.Event
	Continue string
}

// ScopeContext defines the hierarchical scope boundary for audit log queries.
type ScopeContext struct {
	Type string // "platform", "organization", "project", "user"
	Name string // scope identifier (org name, project name, etc.)
}

// QueryAuditLogs retrieves audit logs matching the query specification and scope.
// The spec parameter must be pre-validated by the API layer.
func (s *ClickHouseStorage) QueryAuditLogs(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope ScopeContext) (*QueryResult, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.query",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", s.config.Database),
			attribute.String("db.operation", "SELECT"),
			attribute.Int("query.limit", int(spec.Limit)),
			attribute.String("query.filter", spec.Filter),
			attribute.String("query.start_time", spec.StartTime),
			attribute.String("query.end_time", spec.EndTime),
		),
	)
	defer span.End()

	// Start timing the overall query operation
	overallStartTime := time.Now()

	query, args, err := s.buildQuery(ctx, spec, scope)
	if err != nil {
		metrics.ClickHouseQueryErrors.WithLabelValues("build_query").Inc()
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to build query")
		return nil, fmt.Errorf("failed to build query: %w", err)
	}

	klog.V(3).InfoS("Built ClickHouse query",
		"query", query,
		"argsCount", len(args),
	)

	// Add SQL statement to span (truncated if too long)
	truncatedQuery := query
	if len(query) > 1000 {
		truncatedQuery = query[:1000] + "..."
	}
	span.SetAttributes(attribute.String("db.statement", truncatedQuery))

	// Add trace context as SQL comment for correlation
	spanContext := span.SpanContext()
	if spanContext.IsValid() {
		traceparent := fmt.Sprintf("00-%s-%s-%02x",
			spanContext.TraceID().String(),
			spanContext.SpanID().String(),
			spanContext.TraceFlags())
		query = fmt.Sprintf("/* traceparent: %s */ %s", traceparent, query)
	}

	// Extract trace ID for logging
	traceID := span.SpanContext().TraceID().String()
	spanID := span.SpanContext().SpanID().String()

	klog.InfoS("Executing ClickHouse query",
		"traceID", traceID,
		"spanID", spanID,
		"filter", spec.Filter,
		"limit", spec.Limit,
		"continue", spec.Continue,
		"query", truncatedQuery,
	)

	// Time the actual ClickHouse query execution
	queryStartTime := time.Now()
	rows, err := s.conn.Query(ctx, query, args...)
	queryDuration := time.Since(queryStartTime).Seconds()

	if err != nil {
		metrics.ClickHouseQueryDuration.WithLabelValues("query").Observe(queryDuration)
		metrics.ClickHouseQueryTotal.WithLabelValues("error").Inc()

		// Classify error type
		errorType := "unknown"
		if strings.Contains(err.Error(), "connection") {
			errorType = "connection"
		} else if strings.Contains(err.Error(), "timeout") {
			errorType = "timeout"
		} else if strings.Contains(err.Error(), "syntax") {
			errorType = "syntax"
		} else if strings.Contains(err.Error(), "memory") {
			errorType = "memory"
		} else if strings.Contains(err.Error(), "parameter") {
			errorType = "parameter"
		}
		metrics.ClickHouseQueryErrors.WithLabelValues(errorType).Inc()

		// Record error in span
		span.RecordError(err)
		span.SetStatus(codes.Error, "query execution failed")
		span.SetAttributes(attribute.String("error.type", errorType))

		// Log detailed error with trace context and query details
		klog.ErrorS(err, "ClickHouse query failed",
			"traceID", traceID,
			"spanID", spanID,
			"errorType", errorType,
			"filter", spec.Filter,
			"limit", spec.Limit,
			"continue", spec.Continue,
			"duration", queryDuration,
			"query", truncatedQuery,
		)

		return nil, fmt.Errorf("failed to query ClickHouse: %w", err)
	}
	defer rows.Close()

	// Record successful query execution time
	metrics.ClickHouseQueryDuration.WithLabelValues("query").Observe(queryDuration)
	span.SetAttributes(attribute.Float64("db.query_duration_seconds", queryDuration))

	// Determine the limit
	limit := spec.Limit
	if limit <= 0 {
		limit = 100
	}
	if limit > s.config.MaxPageSize {
		limit = s.config.MaxPageSize
	}

	var events []auditv1.Event
	var unmarshalErrors int
	for rows.Next() {
		var eventJSON string
		if err := rows.Scan(&eventJSON); err != nil {
			klog.ErrorS(err, "Failed to scan row",
				"traceID", traceID,
				"spanID", spanID,
			)
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		var event auditv1.Event
		if err := json.Unmarshal([]byte(eventJSON), &event); err != nil {
			unmarshalErrors++
			klog.ErrorS(err, "Failed to unmarshal audit event",
				"traceID", traceID,
				"spanID", spanID,
			)
			continue
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		metrics.ClickHouseQueryTotal.WithLabelValues("error").Inc()
		metrics.ClickHouseQueryErrors.WithLabelValues("iteration").Inc()

		klog.ErrorS(err, "Error iterating ClickHouse rows",
			"traceID", traceID,
			"spanID", spanID,
			"filter", spec.Filter,
			"limit", spec.Limit,
		)

		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	if unmarshalErrors > 0 {
		klog.InfoS("Query completed with unmarshal errors",
			"traceID", traceID,
			"spanID", spanID,
			"unmarshalErrors", unmarshalErrors,
			"successfulEvents", len(events),
		)
	}

	// Check if we have more results (we fetched limit+1)
	var continueAfter string
	if int32(len(events)) > limit {
		events = events[:limit]
		if len(events) > 0 {
			lastEvent := events[len(events)-1]
			continueAfter = encodeCursor(lastEvent.StageTimestamp.Time, string(lastEvent.AuditID), spec)
		}
	}

	// Record successful query metrics
	metrics.ClickHouseQueryTotal.WithLabelValues("success").Inc()
	metrics.AuditLogQueryResults.Observe(float64(len(events)))

	// Record end-to-end query duration (includes result processing)
	totalDuration := time.Since(overallStartTime).Seconds()
	metrics.ClickHouseQueryDuration.WithLabelValues("total").Observe(totalDuration)

	// Add result metrics to span
	span.SetAttributes(
		attribute.Int("db.rows_returned", len(events)),
		attribute.Bool("query.has_more", continueAfter != ""),
		attribute.Float64("db.total_duration_seconds", totalDuration),
	)
	span.SetStatus(codes.Ok, "query successful")

	// Log successful query completion
	klog.InfoS("ClickHouse query completed successfully",
		"traceID", traceID,
		"spanID", spanID,
		"rowsReturned", len(events),
		"hasMore", continueAfter != "",
		"queryDuration", queryDuration,
		"totalDuration", totalDuration,
		"filter", spec.Filter,
		"limit", spec.Limit,
	)

	return &QueryResult{
		Events:   events,
		Continue: continueAfter,
	}, nil
}

// hasUserFilter checks if the CEL filter contains user-based filtering
func hasUserFilter(filter string) bool {
	if filter == "" {
		return false
	}
	// Check for common user filter patterns in CEL expressions
	// This is a heuristic - doesn't need to be perfect, just helpful for optimization
	return strings.Contains(filter, "user.username") ||
		strings.Contains(filter, "user.groups") ||
		strings.Contains(filter, "user.uid") ||
		// Also match if someone uses the materialized column directly
		(strings.Contains(filter, "user") && (strings.Contains(filter, "==") || strings.Contains(filter, "!=")))
}

// buildQuery constructs a ClickHouse SQL query from the query spec
func (s *ClickHouseStorage) buildQuery(ctx context.Context, spec v1alpha1.AuditLogQuerySpec, scope ScopeContext) (string, []interface{}, error) {
	var args []interface{}

	query := fmt.Sprintf("SELECT event_json FROM %s.%s", s.config.Database, s.config.Table)

	var conditions []string

	// Only add scope filters if not platform-wide query
	if scope.Type != "platform" {
		conditions = append(conditions, "scope_type = ?")
		args = append(args, scope.Type)

		conditions = append(conditions, "scope_name = ?")
		args = append(args, scope.Name)
	}

	// Use a single reference time for both timestamps to prevent sub-second drift
	// when using relative times like "now-7d" and "now"
	now := time.Now()

	if spec.StartTime != "" {
		startTime, err := timeutil.ParseFlexibleTime(spec.StartTime, now)
		if err != nil {
			return "", nil, fmt.Errorf("invalid startTime: %w", err)
		}
		conditions = append(conditions, "timestamp >= ?")
		args = append(args, startTime)
	}

	if spec.EndTime != "" {
		endTime, err := timeutil.ParseFlexibleTime(spec.EndTime, now)
		if err != nil {
			return "", nil, fmt.Errorf("invalid endTime: %w", err)
		}
		conditions = append(conditions, "timestamp < ?")
		args = append(args, endTime)
	}

	if spec.Filter != "" {
		celWhere, celArgs, err := cel.ConvertToClickHouseSQL(ctx, spec.Filter)
		if err != nil {
			// Return the error directly - it already has user-friendly messaging
			return "", nil, err
		}
		if celWhere != "" {
			processedWhere := celWhere
			for i := range celArgs {
				oldParam := fmt.Sprintf("{arg%d}", i+1)
				processedWhere = strings.ReplaceAll(processedWhere, oldParam, "?")
			}
			args = append(args, celArgs...)
			conditions = append(conditions, processedWhere)
		}
	}

	// Cursor pagination - must match ORDER BY for correct results
	if spec.Continue != "" {
		cursorTime, cursorAuditID, err := decodeCursor(spec.Continue, spec)
		if err != nil {
			return "", nil, err
		}

		conditions = append(conditions, "(timestamp < ? OR (timestamp = ? AND audit_id < ?))")
		args = append(args, cursorTime, cursorTime, cursorAuditID)
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Use ORDER BY that matches projection sort order to encourage ClickHouse
	// to use the appropriate projection for better query performance
	if scope.Type == "platform" {
		// For platform-wide queries, choose projection based on filter content
		if hasUserFilter(spec.Filter) {
			// Query filters by user - use user_query_projection
			// Sort order: (timestamp, user, api_group, resource)
			query += " ORDER BY timestamp DESC, user DESC, api_group DESC, resource DESC"
		} else {
			// General platform query - use platform_query_projection
			// Sort order: (timestamp, api_group, resource, audit_id)
			query += " ORDER BY timestamp DESC, api_group DESC, resource DESC, audit_id DESC"
		}
	} else if scope.Type == "user" {
		// User-scoped queries: ORDER BY matches user_query_projection
		// Sort order: (timestamp, user, api_group, resource)
		query += " ORDER BY timestamp DESC, user DESC, api_group DESC, resource DESC"
	} else {
		// Tenant-scoped queries (organization, project): ORDER BY matches primary key
		// Sort order: (timestamp, scope_type, scope_name, user, audit_id, stage)
		query += " ORDER BY timestamp DESC, scope_type DESC, scope_name DESC, user DESC, audit_id DESC"
	}

	limit := spec.Limit
	if limit <= 0 {
		limit = 100
	}
	if limit > s.config.MaxPageSize {
		limit = s.config.MaxPageSize
	}

	query += fmt.Sprintf(" LIMIT %d", limit+1)

	return query, args, nil
}
