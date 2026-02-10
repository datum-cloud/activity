package metrics

import (
	"k8s.io/component-base/metrics"
	"k8s.io/component-base/metrics/legacyregistry"
)

const (
	namespace = "activity"
)

var (
	// ClickHouseQueryDuration tracks the duration of ClickHouse queries
	ClickHouseQueryDuration = metrics.NewHistogramVec(
		&metrics.HistogramOpts{
			Namespace:      namespace,
			Name:           "clickhouse_query_duration_seconds",
			Help:           "Duration of ClickHouse queries in seconds",
			StabilityLevel: metrics.ALPHA,
			// Buckets from 1ms to ~10s for query latency
			Buckets: metrics.ExponentialBuckets(0.001, 2, 14),
		},
		[]string{"operation"},
	)

	// ClickHouseQueryTotal tracks the total number of ClickHouse queries
	ClickHouseQueryTotal = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "clickhouse_query_total",
			Help:           "Total number of ClickHouse queries",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"status"},
	)

	// ClickHouseQueryErrors tracks failed ClickHouse queries
	ClickHouseQueryErrors = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "clickhouse_query_errors_total",
			Help:           "Total number of failed ClickHouse queries",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"error_type"},
	)

	// AuditLogQueryResults tracks the distribution of result counts per query
	AuditLogQueryResults = metrics.NewHistogram(
		&metrics.HistogramOpts{
			Namespace:      namespace,
			Name:           "auditlog_query_results_total",
			Help:           "Distribution of number of results returned per query",
			StabilityLevel: metrics.ALPHA,
			// Buckets: 1, 10, 100, 1k (max page size: 1000)
			Buckets: metrics.ExponentialBuckets(1, 10, 4),
		},
	)

	// CELFilterParseDuration tracks CEL filter parsing time
	CELFilterParseDuration = metrics.NewHistogram(
		&metrics.HistogramOpts{
			Namespace:      namespace,
			Name:           "cel_filter_parse_duration_seconds",
			Help:           "Duration of CEL filter parsing in seconds",
			StabilityLevel: metrics.ALPHA,
			// Buckets from 100μs to ~100ms for parsing time
			Buckets: metrics.ExponentialBuckets(0.0001, 2, 11),
		},
	)

	// CELFilterErrors tracks CEL filter parse errors
	CELFilterErrors = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "cel_filter_errors_total",
			Help:           "Total number of CEL filter parse errors",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"error_type"},
	)

	// AuditLogQueriesByScope tracks queries by scope type
	AuditLogQueriesByScope = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "auditlog_queries_by_scope_total",
			Help:           "Total number of audit log queries by scope type",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"scope_type"},
	)

	// AuditLogQueryLookbackDuration tracks how far back in time users are querying
	AuditLogQueryLookbackDuration = metrics.NewHistogram(
		&metrics.HistogramOpts{
			Namespace:      namespace,
			Name:           "auditlog_query_lookback_duration_seconds",
			Help:           "Time between query start time and current time (how far back users query)",
			StabilityLevel: metrics.ALPHA,
			// Buckets from 1 minute to 90 days
			// 1min, 5min, 15min, 1h, 6h, 1d, 3d, 7d, 14d, 30d, 60d, 90d
			Buckets: []float64{60, 300, 900, 3600, 21600, 86400, 259200, 604800, 1209600, 2592000, 5184000, 7776000},
		},
	)

	// AuditLogQueryTimeRange tracks the duration of the time range being queried
	AuditLogQueryTimeRange = metrics.NewHistogram(
		&metrics.HistogramOpts{
			Namespace:      namespace,
			Name:           "auditlog_query_time_range_seconds",
			Help:           "Time range duration between startTime and endTime in queries",
			StabilityLevel: metrics.ALPHA,
			// Buckets from 1 minute to 30 days
			// 1min, 5min, 15min, 1h, 6h, 1d, 3d, 7d, 14d, 30d
			Buckets: []float64{60, 300, 900, 3600, 21600, 86400, 259200, 604800, 1209600, 2592000},
		},
	)

	// NATSDisconnectsTotal tracks the total number of NATS disconnections
	NATSDisconnectsTotal = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "nats_disconnects_total",
			Help:           "Total number of NATS disconnections",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"connection"},
	)

	// NATSReconnectsTotal tracks the total number of NATS reconnections
	NATSReconnectsTotal = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "nats_reconnects_total",
			Help:           "Total number of NATS reconnections",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"connection"},
	)

	// NATSErrorsTotal tracks the total number of NATS async errors
	NATSErrorsTotal = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "nats_errors_total",
			Help:           "Total number of NATS async errors",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"connection"},
	)

	// NATSLameDuckEventsTotal tracks the total number of NATS lame duck mode events
	NATSLameDuckEventsTotal = metrics.NewCounterVec(
		&metrics.CounterOpts{
			Namespace:      namespace,
			Name:           "nats_lame_duck_events_total",
			Help:           "Total number of NATS lame duck mode events",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"connection"},
	)

	// NATSConnectionStatus tracks the current NATS connection status (1=connected, 0=disconnected)
	NATSConnectionStatus = metrics.NewGaugeVec(
		&metrics.GaugeOpts{
			Namespace:      namespace,
			Name:           "nats_connection_status",
			Help:           "Current NATS connection status (1=connected, 0=disconnected)",
			StabilityLevel: metrics.ALPHA,
		},
		[]string{"connection"},
	)
)

// init registers all custom metrics with the legacy registry
// This ensures they're included in the /metrics endpoint
func init() {
	legacyregistry.MustRegister(
		ClickHouseQueryDuration,
		ClickHouseQueryTotal,
		ClickHouseQueryErrors,
		AuditLogQueryResults,
		CELFilterParseDuration,
		CELFilterErrors,
		AuditLogQueriesByScope,
		AuditLogQueryLookbackDuration,
		AuditLogQueryTimeRange,
		NATSDisconnectsTotal,
		NATSReconnectsTotal,
		NATSErrorsTotal,
		NATSLameDuckEventsTotal,
		NATSConnectionStatus,
	)
}
