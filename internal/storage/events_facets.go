package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/internal/timeutil"
)

// EventFacetQuerySpec defines the parameters for an event facet query.
type EventFacetQuerySpec struct {
	// TimeRange specifies the time window for facet aggregation.
	StartTime string
	EndTime   string

	// Facets are the fields to compute distinct values for.
	Facets []FacetFieldSpec
}

// QueryEventFacets retrieves distinct field values with counts for Kubernetes Event faceted search.
func (b *ClickHouseEventsBackend) QueryEventFacets(ctx context.Context, spec EventFacetQuerySpec, scope ScopeContext) (*FacetQueryResult, error) {
	ctx, span := tracer.Start(ctx, "clickhouse.query_event_facets",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			attribute.String("db.system", "clickhouse"),
			attribute.String("db.name", b.config.Database),
			attribute.String("db.operation", "SELECT"),
			attribute.Int("facet.count", len(spec.Facets)),
		),
	)
	defer span.End()

	result := &FacetQueryResult{
		Facets: make([]FacetFieldResult, 0, len(spec.Facets)),
	}

	// Execute each facet query
	for _, facet := range spec.Facets {
		facetResult, err := b.queryEventFacet(ctx, facet, spec, scope)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to query event facet %s: %w", facet.Field, err)
		}
		result.Facets = append(result.Facets, *facetResult)
	}

	span.SetStatus(codes.Ok, "event facet query successful")
	return result, nil
}

// queryEventFacet executes a single facet query against the events table.
func (b *ClickHouseEventsBackend) queryEventFacet(ctx context.Context, facet FacetFieldSpec, spec EventFacetQuerySpec, scope ScopeContext) (*FacetFieldResult, error) {
	column, err := GetEventFacetColumn(facet.Field)
	if err != nil {
		return nil, err
	}

	limit := facet.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var args []interface{}
	var conditions []string

	// Scope filtering
	scopeConds, scopeArgs := b.buildScopeConditions(scope)
	conditions = append(conditions, scopeConds...)
	args = append(args, scopeArgs...)

	// Time range
	now := time.Now()
	if spec.StartTime != "" {
		startTime, err := timeutil.ParseFlexibleTime(spec.StartTime, now)
		if err != nil {
			return nil, fmt.Errorf("invalid startTime: %w", err)
		}
		conditions = append(conditions, "last_timestamp >= ?")
		args = append(args, startTime)
	}

	if spec.EndTime != "" {
		endTime, err := timeutil.ParseFlexibleTime(spec.EndTime, now)
		if err != nil {
			return nil, fmt.Errorf("invalid endTime: %w", err)
		}
		conditions = append(conditions, "last_timestamp < ?")
		args = append(args, endTime)
	}

	// Build query against the events table
	query := fmt.Sprintf("SELECT %s, COUNT(*) as count FROM %s.%s", column, b.config.Database, "k8s_events")

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Group by the facet column and order by count descending, then value ascending for stability
	query += fmt.Sprintf(" GROUP BY %s ORDER BY count DESC, %s ASC LIMIT %d", column, column, limit)

	klog.V(4).InfoS("Executing event facet query",
		"field", facet.Field,
		"column", column,
		"query", query,
	)

	rows, err := b.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute event facet query: %w", err)
	}
	defer rows.Close()

	result := &FacetFieldResult{
		Field:  facet.Field,
		Values: make([]FacetValueResult, 0),
	}

	for rows.Next() {
		var value string
		var count uint64
		if err := rows.Scan(&value, &count); err != nil {
			return nil, fmt.Errorf("failed to scan event facet row: %w", err)
		}
		result.Values = append(result.Values, FacetValueResult{
			Value: value,
			Count: int64(count),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating event facet rows: %w", err)
	}

	return result, nil
}
