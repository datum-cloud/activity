# Enhancement 002: CEL Filter Performance Monitoring

**Status**: Proposed
**Authors**: Activity Team
**Created**: 2025-12-15
**Last Updated**: 2025-12-15

## Summary

Implement comprehensive monitoring and observability for CEL-based filter expressions used in audit log queries. This enhancement provides visibility into query performance characteristics, identifies slow queries, correlates performance with filter complexity, and enables data-driven optimization decisions for ClickHouse indexes and query patterns.

## Motivation

### Current State

The Activity API server currently supports CEL filter expressions that are translated to ClickHouse SQL WHERE clauses. While basic metrics exist (`activity_clickhouse_query_duration_seconds`, `activity_cel_filter_parse_duration_seconds`), they lack the granularity needed to answer critical operational questions:

**Questions we cannot answer today:**
1. Which CEL filter patterns are slowest?
2. What ClickHouse indexes would most benefit our actual query workload?
3. Which fields in the audit event are most frequently filtered?
4. Are users querying indexed vs non-indexed fields?
5. How does filter complexity correlate with query execution time?
6. Which filters are causing ClickHouse to perform full table scans?
7. What's the p99 latency for queries using specific filter patterns?

**Current instrumentation gaps:**
- No per-filter performance tracking
- No visibility into which fields are accessed in filters
- No correlation between filter complexity and execution time
- No insight into ClickHouse query plan efficiency
- Limited ability to identify optimization opportunities

### Real-World Use Cases

**Performance Investigation:**
```yaml
# User reports: "My impersonation queries are slow"
filter: "impersonatedUser.username == 'admin'"
# Today: We see overall p99 latency, but can't isolate this specific filter pattern
# Need: Per-field query latency metrics to identify that impersonatedUser is slow
```

**Index Optimization:**
```yaml
# Question: Should we add an index on requestURI?
# Today: No data on requestURI filter frequency or performance impact
# Need: Field access frequency + correlation with slow queries
```

**Query Pattern Analysis:**
```yaml
# User: "Queries with complex filters time out"
filter: |
  (verb == 'create' || verb == 'update') &&
  objectRef.namespace.startsWith('prod-') &&
  user.groups.exists(g, g == 'cluster-admin')
# Today: We see timeout, but can't quantify "complexity" or identify the bottleneck
# Need: Filter complexity metrics + per-clause performance breakdown
```

**Capacity Planning:**
```yaml
# Question: How will query performance change as data grows?
# Today: Limited visibility into scan efficiency
# Need: Rows scanned vs rows returned, scan efficiency over time
```

### Why This Matters

As audit log data grows and query patterns evolve:
- **Performance degradation** becomes harder to diagnose without granular metrics
- **Index strategy** decisions are based on intuition rather than data
- **User experience** suffers when slow queries can't be identified proactively
- **Cost optimization** is limited without understanding query efficiency

## Goals

1. **Filter-level observability**: Track performance metrics per CEL filter pattern
2. **Field access tracking**: Understand which audit event fields are queried most frequently
3. **Complexity correlation**: Quantify filter complexity and correlate with performance
4. **ClickHouse query analysis**: Expose ClickHouse query plan metrics (rows scanned, index usage)
5. **Actionable insights**: Enable data-driven decisions for index creation and query optimization
6. **Distributed tracing integration**: Connect CEL filters to OpenTelemetry traces for end-to-end visibility
7. **Proactive alerting**: Detect performance anomalies before they impact users

## Non-Goals

1. **Automatic query optimization**: This proposal focuses on observability, not automatic rewrites
2. **Per-user query quotas**: Rate limiting is a separate concern
3. **Query result caching**: Caching strategies are out of scope
4. **Real-time query cost estimation**: Pre-execution cost prediction is a future enhancement
5. **ClickHouse-specific tuning**: Observability is database-agnostic where possible

## Proposal

### Overview

Enhance the Activity API server's instrumentation at three key layers:

1. **CEL Layer**: Track filter parsing, complexity analysis, and field extraction
2. **Translation Layer**: Monitor CEL-to-SQL translation and query building
3. **ClickHouse Layer**: Capture query execution metrics and ClickHouse-specific insights

Each layer emits structured metrics, logs, and traces that compose into a complete performance picture.

### Metrics Design

#### 1. Filter Pattern Metrics

Track performance by normalized filter patterns to identify slow patterns across users.

```go
// activity_cel_filter_execution_duration_seconds{pattern_hash, field_count}
// Histogram of query execution time grouped by filter pattern
CELFilterExecutionDuration = metrics.NewHistogramVec(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "cel_filter_execution_duration_seconds",
        Help:           "Query execution duration by CEL filter pattern",
        StabilityLevel: metrics.ALPHA,
        Buckets:        metrics.ExponentialBuckets(0.001, 2, 14), // 1ms to ~10s
    },
    []string{
        "pattern_hash",  // SHA256 hash of normalized filter pattern
        "field_count",   // Number of fields referenced in filter
    },
)
```

**Pattern normalization** removes literal values to group similar queries:
```
Input:  user.username == 'alice' && verb == 'delete'
Output: user.username == ? && verb == ?
Hash:   abc123... (SHA256 of normalized pattern)
```

This allows us to see that "filter pattern abc123 has p99 latency of 2.5s" even when literal values differ.

#### 2. Field Access Metrics

Track which audit event fields are queried and their performance characteristics.

```go
// activity_cel_filter_field_access_total{field_path, operation}
// Counter of field accesses in CEL filters
CELFilterFieldAccessTotal = metrics.NewCounterVec(
    &metrics.CounterOpts{
        Namespace:      "activity",
        Name:           "cel_filter_field_access_total",
        Help:           "Total number of field accesses in CEL filters",
        StabilityLevel: metrics.ALPHA,
    },
    []string{
        "field_path",  // e.g., "user.username", "objectRef.namespace"
        "operation",   // "equals", "contains", "startsWith", "in", "exists"
    },
)

// activity_cel_filter_field_query_duration_seconds{field_path}
// Histogram of query duration when a specific field is filtered
CELFilterFieldQueryDuration = metrics.NewHistogramVec(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "cel_filter_field_query_duration_seconds",
        Help:           "Query duration when filtering on specific fields",
        StabilityLevel: metrics.ALPHA,
        Buckets:        metrics.ExponentialBuckets(0.001, 2, 14),
    },
    []string{"field_path"},
)
```

**Use case**: Identify that filtering on `impersonatedUser.username` is 10x slower than `user.username`, indicating a missing index.

#### 3. Filter Complexity Metrics

Quantify filter complexity and correlate with performance.

```go
// activity_cel_filter_complexity{complexity_class}
// Histogram of query duration by filter complexity
CELFilterComplexity = metrics.NewHistogramVec(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "cel_filter_complexity_duration_seconds",
        Help:           "Query duration by filter complexity class",
        StabilityLevel: metrics.ALPHA,
        Buckets:        metrics.ExponentialBuckets(0.001, 2, 14),
    },
    []string{
        "complexity_class",  // "simple", "moderate", "complex", "very_complex"
        "has_logical_ops",   // "true" if filter contains && or ||
        "has_array_ops",     // "true" if filter contains exists() or array indexing
        "has_string_ops",    // "true" if filter contains startsWith/contains/matches
    },
)
```

**Complexity classification:**
- **Simple**: Single field comparison (e.g., `verb == 'delete'`)
- **Moderate**: 2-3 fields with AND/OR (e.g., `verb == 'delete' && user.username == 'alice'`)
- **Complex**: 4+ fields, array operations, or string functions
- **Very Complex**: Nested exists(), multiple string operations, or deep object navigation

#### 4. ClickHouse Query Plan Metrics

Expose ClickHouse-specific execution metrics to understand query efficiency.

```go
// activity_clickhouse_query_rows_scanned{indexed}
// Histogram of rows scanned per query
ClickHouseQueryRowsScanned = metrics.NewHistogramVec(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "clickhouse_query_rows_scanned",
        Help:           "Number of rows scanned by ClickHouse queries",
        StabilityLevel: metrics.ALPHA,
        Buckets:        []float64{100, 1000, 10000, 100000, 1000000, 10000000},
    },
    []string{
        "indexed",  // "true" if query used skip indexes, "false" otherwise
    },
)

// activity_clickhouse_query_scan_efficiency
// Ratio of rows returned / rows scanned (higher is better)
ClickHouseQueryScanEfficiency = metrics.NewHistogram(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "clickhouse_query_scan_efficiency",
        Help:           "Ratio of rows returned to rows scanned (0.0 to 1.0)",
        StabilityLevel: metrics.ALPHA,
        Buckets:        []float64{0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0},
    },
)

// activity_clickhouse_query_index_usage_total{index_name}
// Counter of queries utilizing each ClickHouse skip index
ClickHouseQueryIndexUsage = metrics.NewCounterVec(
    &metrics.CounterOpts{
        Namespace:      "activity",
        Name:           "clickhouse_query_index_usage_total",
        Help:           "Count of queries using specific ClickHouse indexes",
        StabilityLevel: metrics.ALPHA,
    },
    []string{"index_name"},
)
```

**ClickHouse integration**: Query `system.query_log` after each query to extract:
- `read_rows`: Total rows scanned
- `result_rows`: Rows returned
- `query_duration_ms`: Execution time
- `used_indexes`: Array of index names used

#### 5. Filter Cardinality Metrics

Track selectivity of filters to understand data distribution.

```go
// activity_cel_filter_result_cardinality{pattern_hash}
// Distribution of result counts per filter pattern
CELFilterResultCardinality = metrics.NewHistogramVec(
    &metrics.HistogramOpts{
        Namespace:      "activity",
        Name:           "cel_filter_result_cardinality",
        Help:           "Distribution of result counts by filter pattern",
        StabilityLevel: metrics.ALPHA,
        Buckets:        metrics.ExponentialBuckets(1, 10, 7), // 1 to 1M results
    },
    []string{"pattern_hash"},
)
```

**Use case**: Identify that filter pattern X always returns 1M+ results (overly broad) while pattern Y returns <10 (highly selective).

### Implementation Architecture

#### Component Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Activity API Server                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ REST Handler (AuditLogQuery CREATE)                       │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CEL Filter Parser & Analyzer                             │  │
│  │ - Parse CEL expression                                   │  │
│  │ - Extract field references                               │  │
│  │ - Calculate complexity score                             │  │
│  │ - Normalize pattern for grouping                         │  │
│  │ - Emit: CELFilterParseDuration (existing)                │  │
│  │ - Emit: CELFilterFieldAccessTotal (NEW)                  │  │
│  │ - Emit: CELFilterComplexity (NEW)                        │  │
│  │ - Trace span: "cel.parse" with attributes                │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CEL-to-SQL Translator                                    │  │
│  │ - Convert CEL to ClickHouse WHERE clause                 │  │
│  │ - Identify indexed vs non-indexed fields                 │  │
│  │ - Build parameterized query                              │  │
│  │ - Trace span: "cel.translate" with SQL preview           │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ClickHouse Storage Layer                                 │  │
│  │ - Execute query                                          │  │
│  │ - Emit: ClickHouseQueryDuration (existing)               │  │
│  │ - Emit: ClickHouseQueryTotal (existing)                  │  │
│  │ - Emit: CELFilterExecutionDuration (NEW)                 │  │
│  │ - Emit: CELFilterFieldQueryDuration (NEW)                │  │
│  │ - Trace span: "clickhouse.query" (existing)              │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ClickHouse Query Log Analyzer (Async)                    │  │
│  │ - Query system.query_log for last query                  │  │
│  │ - Extract: read_rows, result_rows, used_indexes          │  │
│  │ - Emit: ClickHouseQueryRowsScanned (NEW)                 │  │
│  │ - Emit: ClickHouseQueryScanEfficiency (NEW)              │  │
│  │ - Emit: ClickHouseQueryIndexUsage (NEW)                  │  │
│  │ - Emit: CELFilterResultCardinality (NEW)                 │  │
│  │ - Augment trace span with query plan attributes          │  │
│  └────────────────┬───────────────────────────────────────────┘  │
│                   │                                               │
│                   ▼                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Response with enriched trace context                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
   ┌──────────────────┐           ┌──────────────────────┐
   │ Victoria Metrics │           │ Tempo (Tracing)      │
   │ - Prometheus API │           │ - Distributed traces │
   │ - Grafana viz    │           │ - Trace correlation  │
   └──────────────────┘           └──────────────────────┘
```

#### CEL Filter Analyzer

New component: `internal/cel/analyzer.go`

```go
package cel

import (
    "crypto/sha256"
    "encoding/hex"
    "strings"
)

// FilterAnalysis contains metadata about a CEL filter expression
type FilterAnalysis struct {
    // Pattern identification
    NormalizedPattern string   // Filter with literals replaced by ?
    PatternHash       string   // SHA256 hash for grouping

    // Field references
    FieldPaths        []string // e.g., ["user.username", "verb"]
    FieldOperations   map[string]string // field -> operation type

    // Complexity metrics
    ComplexityClass   string   // "simple", "moderate", "complex", "very_complex"
    ComplexityScore   int      // Numeric score (0-100)
    HasLogicalOps     bool     // Contains && or ||
    HasArrayOps       bool     // Contains exists() or [index]
    HasStringOps      bool     // Contains startsWith/contains/matches

    // Query prediction
    EstimatedIndexed  bool     // True if all fields have ClickHouse indexes
    NonIndexedFields  []string // Fields without indexes
}

// AnalyzeFilter parses and analyzes a CEL filter expression
func AnalyzeFilter(filterExpr string) (*FilterAnalysis, error) {
    // Parse CEL expression
    env, err := cel.NewEnv(/* ... */)
    if err != nil {
        return nil, err
    }

    ast, issues := env.Parse(filterExpr)
    if issues.Err() != nil {
        return nil, issues.Err()
    }

    analysis := &FilterAnalysis{
        FieldOperations: make(map[string]string),
    }

    // Walk AST to extract field references and operations
    visitor := &filterVisitor{analysis: analysis}
    cel.Walk(ast.Expr(), visitor)

    // Normalize pattern (replace literals with ?)
    analysis.NormalizedPattern = normalizePattern(filterExpr)
    analysis.PatternHash = hashPattern(analysis.NormalizedPattern)

    // Calculate complexity score
    analysis.ComplexityScore = calculateComplexity(analysis)
    analysis.ComplexityClass = classifyComplexity(analysis.ComplexityScore)

    // Check index availability (requires ClickHouse schema awareness)
    analysis.EstimatedIndexed = checkIndexAvailability(analysis.FieldPaths)

    return analysis, nil
}

// normalizePattern replaces literal values with placeholders
func normalizePattern(filter string) string {
    // Replace string literals: 'value' -> ?
    normalized := regexp.MustCompile(`'[^']*'`).ReplaceAllString(filter, "?")
    // Replace numeric literals: 123 -> ?
    normalized = regexp.MustCompile(`\b\d+\b`).ReplaceAllString(normalized, "?")
    return normalized
}

// calculateComplexity assigns a numeric complexity score
func calculateComplexity(a *FilterAnalysis) int {
    score := 0

    // Base complexity: number of fields
    score += len(a.FieldPaths) * 5

    // Logical operations add complexity
    if a.HasLogicalOps {
        score += 10
    }

    // Array operations are expensive
    if a.HasArrayOps {
        score += 20
    }

    // String operations are moderately expensive
    if a.HasStringOps {
        score += 15
    }

    return score
}

// classifyComplexity maps score to human-readable class
func classifyComplexity(score int) string {
    switch {
    case score <= 10:
        return "simple"
    case score <= 30:
        return "moderate"
    case score <= 60:
        return "complex"
    default:
        return "very_complex"
    }
}
```

#### ClickHouse Query Log Integration

After executing a query, asynchronously query `system.query_log` to extract execution metrics:

```go
// internal/storage/clickhouse_query_analysis.go

// QueryPlanMetrics contains ClickHouse query execution metrics
type QueryPlanMetrics struct {
    ReadRows       uint64   // Rows scanned
    ResultRows     uint64   // Rows returned
    QueryDuration  float64  // Execution time in seconds
    UsedIndexes    []string // Index names used
    MemoryUsage    uint64   // Peak memory bytes
}

// FetchQueryPlanMetrics retrieves metrics for the last query from system.query_log
func (s *ClickHouseStorage) FetchQueryPlanMetrics(ctx context.Context, queryID string) (*QueryPlanMetrics, error) {
    query := `
        SELECT
            read_rows,
            result_rows,
            query_duration_ms,
            used_indexes,
            memory_usage
        FROM system.query_log
        WHERE query_id = ?
          AND type = 'QueryFinish'
        ORDER BY event_time DESC
        LIMIT 1
    `

    var metrics QueryPlanMetrics
    err := s.conn.QueryRow(ctx, query, queryID).Scan(
        &metrics.ReadRows,
        &metrics.ResultRows,
        &metrics.QueryDuration,
        &metrics.UsedIndexes,
        &metrics.MemoryUsage,
    )

    if err != nil {
        return nil, err
    }

    return &metrics, nil
}

// EmitQueryPlanMetrics publishes ClickHouse query plan metrics
func EmitQueryPlanMetrics(metrics *QueryPlanMetrics, analysis *cel.FilterAnalysis) {
    // Rows scanned
    indexed := len(metrics.UsedIndexes) > 0
    metricsPkg.ClickHouseQueryRowsScanned.
        WithLabelValues(fmt.Sprintf("%t", indexed)).
        Observe(float64(metrics.ReadRows))

    // Scan efficiency (avoid divide-by-zero)
    if metrics.ReadRows > 0 {
        efficiency := float64(metrics.ResultRows) / float64(metrics.ReadRows)
        metricsPkg.ClickHouseQueryScanEfficiency.Observe(efficiency)
    }

    // Index usage
    for _, indexName := range metrics.UsedIndexes {
        metricsPkg.ClickHouseQueryIndexUsage.
            WithLabelValues(indexName).
            Inc()
    }

    // Result cardinality by pattern
    metricsPkg.CELFilterResultCardinality.
        WithLabelValues(analysis.PatternHash).
        Observe(float64(metrics.ResultRows))
}
```

### Distributed Tracing Enhancements

Augment existing OpenTelemetry spans with CEL filter metadata.

**Existing trace structure:**
```
http.request (API server)
├── cel.parse
├── clickhouse.query
└── ...
```

**Enhanced trace structure with attributes:**
```
http.request (API server)
├── cel.parse
│   ├── cel.filter.expression = "user.username == 'alice' && verb == 'delete'"
│   ├── cel.filter.pattern_hash = "abc123..."
│   ├── cel.filter.complexity_class = "simple"
│   ├── cel.filter.field_count = 2
│   ├── cel.filter.fields = ["user.username", "verb"]
│   └── cel.filter.has_logical_ops = true
├── cel.translate
│   ├── cel.sql.preview = "WHERE user = ? AND verb = ?"
│   └── cel.estimated_indexed = true
└── clickhouse.query
    ├── db.statement = "SELECT ... WHERE ..." (existing)
    ├── db.query_duration_seconds = 0.125 (existing)
    ├── clickhouse.read_rows = 50000 (NEW)
    ├── clickhouse.result_rows = 123 (NEW)
    ├── clickhouse.used_indexes = ["idx_user", "idx_verb"] (NEW)
    ├── clickhouse.scan_efficiency = 0.00246 (NEW)
    └── clickhouse.memory_usage_bytes = 1048576 (NEW)
```

**Trace correlation workflow:**
1. User submits AuditLogQuery with traceID in HTTP headers (W3C Trace Context)
2. API server creates root span with traceID
3. Each layer adds child spans with CEL and ClickHouse attributes
4. ClickHouse query includes traceparent in SQL comment (already implemented)
5. Async query log fetch adds ClickHouse metrics to span via `span.SetAttributes()`
6. Complete trace exported to Tempo for visualization in Grafana

### Structured Logging

Emit structured logs at key decision points for post-hoc analysis.

```go
// Log filter analysis results
klog.InfoS("CEL filter analyzed",
    "filter", filterExpr,
    "patternHash", analysis.PatternHash,
    "complexityClass", analysis.ComplexityClass,
    "fieldCount", len(analysis.FieldPaths),
    "fields", strings.Join(analysis.FieldPaths, ","),
    "estimatedIndexed", analysis.EstimatedIndexed,
)

// Log query execution with enriched context
klog.InfoS("Query executed",
    "traceID", traceID,
    "patternHash", analysis.PatternHash,
    "duration", queryDuration,
    "readRows", queryPlanMetrics.ReadRows,
    "resultRows", queryPlanMetrics.ResultRows,
    "scanEfficiency", scanEfficiency,
    "usedIndexes", strings.Join(queryPlanMetrics.UsedIndexes, ","),
)
```

Logs are ingested by Vector and can be queried in Grafana Loki or correlated with traces.

### Grafana Dashboard Design

Create a dedicated "CEL Filter Performance" dashboard with the following panels:

#### Dashboard: CEL Filter Performance Analysis

**Row 1: Query Overview**
- **Query Rate**: `rate(activity_clickhouse_query_total[5m])`
- **p50/p95/p99 Latency**: `histogram_quantile(0.99, rate(activity_clickhouse_query_duration_seconds_bucket[5m]))`
- **Error Rate**: `rate(activity_clickhouse_query_total{status="error"}[5m])`

**Row 2: Filter Patterns**
- **Top 10 Slowest Patterns** (Table):
  ```promql
  topk(10,
    histogram_quantile(0.99,
      sum by (pattern_hash) (
        rate(activity_cel_filter_execution_duration_seconds_bucket[1h])
      )
    )
  )
  ```
  Columns: Pattern Hash | p99 Latency | Query Count

- **Pattern Latency Heatmap**: Distribution of latencies across pattern hashes

**Row 3: Field Access Analysis**
- **Most Queried Fields** (Bar chart):
  ```promql
  topk(15, sum by (field_path) (
    rate(activity_cel_filter_field_access_total[1h])
  ))
  ```

- **Field Query Performance** (Table):
  ```promql
  # For each field: access count + p99 latency
  topk(20,
    sum by (field_path) (
      rate(activity_cel_filter_field_access_total[1h])
    )
  )
  ```
  Join with:
  ```promql
  histogram_quantile(0.99,
    sum by (field_path) (
      rate(activity_cel_filter_field_query_duration_seconds_bucket[1h])
    )
  )
  ```
  Columns: Field | Access Count | p99 Latency | Indexed

**Row 4: Complexity Analysis**
- **Latency by Complexity Class**:
  ```promql
  histogram_quantile(0.99,
    sum by (complexity_class) (
      rate(activity_cel_filter_complexity_duration_seconds_bucket[5m])
    )
  )
  ```

- **Query Distribution by Complexity** (Pie chart):
  ```promql
  sum by (complexity_class) (
    rate(activity_cel_filter_complexity_duration_seconds_count[1h])
  )
  ```

**Row 5: ClickHouse Query Efficiency**
- **Scan Efficiency Over Time**:
  ```promql
  avg(activity_clickhouse_query_scan_efficiency)
  ```
  Shows ratio of rows returned / rows scanned (goal: >0.1)

- **Rows Scanned (Indexed vs Non-Indexed)**:
  ```promql
  sum by (indexed) (
    rate(activity_clickhouse_query_rows_scanned_sum[5m])
  ) / sum by (indexed) (
    rate(activity_clickhouse_query_rows_scanned_count[5m])
  )
  ```

- **Index Usage Frequency** (Bar chart):
  ```promql
  topk(10, sum by (index_name) (
    rate(activity_clickhouse_query_index_usage_total[1h])
  ))
  ```

**Row 6: Result Cardinality**
- **Result Distribution by Pattern**:
  ```promql
  histogram_quantile(0.99,
    sum by (pattern_hash) (
      rate(activity_cel_filter_result_cardinality_bucket[1h])
    )
  )
  ```
  Identifies overly broad queries returning millions of results

**Row 7: Recommendations (Text Panel)**
- Automated recommendations based on metrics:
  - "Field `impersonatedUser.username` is queried 500x/hour with p99 latency of 3.2s. Consider adding a ClickHouse skip index."
  - "Pattern hash `abc123` accounts for 40% of slow queries. Review filter: `user.username == ? && objectRef.namespace.startsWith(?)`"
  - "Scan efficiency is 0.005 (0.5%). Most queries scan 200x more rows than returned. Index optimization recommended."

### Alert Rules

Define alerting rules for performance anomalies:

```yaml
# config/components/observability/alerts/cel-filter-alerts.yaml
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMRule
metadata:
  name: cel-filter-performance-alerts
  namespace: activity-system
spec:
  groups:
  - name: cel_filter_performance
    interval: 30s
    rules:

    # Alert when p99 query latency exceeds 5 seconds
    - alert: HighCELFilterLatency
      expr: |
        histogram_quantile(0.99,
          sum(rate(activity_cel_filter_execution_duration_seconds_bucket[5m]))
        ) > 5
      for: 5m
      labels:
        severity: warning
        component: activity-apiserver
      annotations:
        summary: "High CEL filter query latency"
        description: "p99 query latency is {{ $value }}s (threshold: 5s). Check slow filter patterns."
        dashboard_url: "https://grafana/d/cel-filter-performance"

    # Alert when scan efficiency drops below 1% (scanning 100x more rows than returned)
    - alert: LowQueryScanEfficiency
      expr: |
        avg(activity_clickhouse_query_scan_efficiency) < 0.01
      for: 10m
      labels:
        severity: warning
        component: activity-apiserver
      annotations:
        summary: "Low ClickHouse query scan efficiency"
        description: "Average scan efficiency is {{ $value | humanizePercentage }} (threshold: 1%). Most queries are scanning far more rows than returned. Index optimization needed."

    # Alert when non-indexed queries exceed 50% of total
    - alert: HighNonIndexedQueryRate
      expr: |
        sum(rate(activity_clickhouse_query_rows_scanned{indexed="false"}[5m])) /
        sum(rate(activity_clickhouse_query_rows_scanned[5m])) > 0.5
      for: 15m
      labels:
        severity: info
        component: activity-apiserver
      annotations:
        summary: "High rate of non-indexed queries"
        description: "{{ $value | humanizePercentage }} of queries are not using ClickHouse indexes. Review field access metrics to identify index candidates."

    # Alert when a specific filter pattern is consistently slow
    - alert: SlowFilterPattern
      expr: |
        histogram_quantile(0.99,
          sum by (pattern_hash) (
            rate(activity_cel_filter_execution_duration_seconds_bucket[10m])
          )
        ) > 10
      for: 5m
      labels:
        severity: warning
        component: activity-apiserver
      annotations:
        summary: "Slow CEL filter pattern detected"
        description: "Filter pattern {{ $labels.pattern_hash }} has p99 latency of {{ $value }}s. Investigate filter complexity and index usage."
```

### User-Facing Features

#### 1. Query Performance Hints (Future)

Return query performance hints in AuditLogQuery status:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogQuery
metadata:
  name: slow-query-example
spec:
  filter: "impersonatedUser.username == 'admin'"
  # ... other fields ...
status:
  results: [ ... ]
  performanceHints:
  - severity: warning
    message: "Query scanned 1,000,000 rows but returned only 5 (0.0005% efficiency). Consider adding a time range filter."
  - severity: info
    message: "Field 'impersonatedUser.username' is not indexed. Query may be slow for large time ranges."
  queryMetrics:
    durationSeconds: 2.34
    rowsScanned: 1000000
    rowsReturned: 5
    scanEfficiency: 0.000005
    indexesUsed: []
```

#### 2. Query Plan EXPLAIN Endpoint (Future)

Add a dry-run mode that returns query plan without executing:

```bash
kubectl create -f query.yaml --dry-run=server -o yaml
```

Returns estimated query plan:
```yaml
status:
  queryPlan:
    estimatedRowsScanned: ~500000
    estimatedDuration: ~2.5s
    indexesUsed: []
    recommendations:
    - "Add index on impersonatedUser.username to improve performance"
    - "Narrow time range to reduce scan scope"
```

### Rollout Plan

#### Phase 1: Core Metrics (Week 1-2)
- Implement CEL filter analyzer
- Add filter pattern metrics
- Add field access metrics
- Update metrics registry

#### Phase 2: ClickHouse Integration (Week 2-3)
- Implement query_log integration
- Add scan efficiency metrics
- Add index usage metrics
- Handle async metric collection

#### Phase 3: Tracing Enhancement (Week 3-4)
- Augment spans with CEL attributes
- Add ClickHouse query plan attributes
- Test trace correlation in Grafana Tempo

#### Phase 4: Dashboards & Alerts (Week 4-5)
- Build CEL Filter Performance dashboard
- Define alert rules
- Document runbooks

#### Phase 5: Documentation & Testing (Week 5-6)
- Write operational guides
- Create example queries for common scenarios
- E2E testing with various filter patterns

### Success Metrics

**Observability Goals:**
- 100% of queries have filter pattern hash tracked
- <5% overhead from metrics collection
- <500ms latency added by async query_log lookup

**Operational Outcomes:**
- Identify top 3 index candidates within first week
- Reduce p99 query latency by 50% through targeted indexing (within 1 month)
- Zero "mystery slow queries" (all slow queries traceable to specific patterns)

**User Experience:**
- Users can self-diagnose slow queries using Grafana dashboard
- Platform team can make data-driven index decisions
- Proactive alerts catch performance regressions before user impact

## Alternatives Considered

### Alternative 1: Client-Side Query Profiling

Users run queries with a `--profile` flag to get performance breakdown.

**Pros**: No server-side instrumentation needed
**Cons**:
- Requires user action (not proactive)
- No aggregated insights across all users
- Doesn't help with capacity planning

**Decision**: Server-side monitoring provides holistic view of all query patterns.

### Alternative 2: Sampling-Based Metrics

Only collect detailed metrics for a random 10% of queries.

**Pros**: Lower overhead
**Cons**:
- Misses rare but critical slow queries
- Metrics less accurate for per-pattern analysis

**Decision**: Full instrumentation with async collection minimizes overhead while maintaining accuracy.

### Alternative 3: ClickHouse-Only Metrics

Rely solely on ClickHouse's system.query_log without CEL-layer metrics.

**Pros**: No custom instrumentation
**Cons**:
- Can't correlate ClickHouse performance with CEL filter patterns
- Loses field-level access insights
- No filter complexity analysis

**Decision**: Multi-layer instrumentation provides end-to-end visibility.

### Alternative 4: Log-Only Approach

Emit all data as structured logs, query logs for insights.

**Pros**: Simpler implementation (no new metrics)
**Cons**:
- Logs not suited for real-time dashboards
- Higher storage cost (logs vs metrics)
- Slower to query (log search vs Prometheus)

**Decision**: Metrics for real-time dashboards, logs for deep-dive investigations.

## Open Questions

1. **What's the acceptable overhead for query_log lookup?**
   - Run async to avoid blocking query response
   - If lookup takes >500ms, skip and log warning
   - **Recommendation**: Accept <5% overhead, make async lookups best-effort

2. **How long should we retain per-pattern metrics?**
   - Pattern hashes could explode cardinality if every unique filter tracked
   - **Recommendation**: Limit to top 1000 patterns, aggregate others as "other"

3. **Should we implement automatic slow query logging?**
   - Log full query details (not just pattern) when p99 > 5s
   - **Recommendation**: Yes, log to structured format for offline analysis

4. **How to handle index changes over time?**
   - Index availability affects `estimatedIndexed` field
   - **Recommendation**: Re-evaluate index availability periodically (hourly) by querying ClickHouse schema

5. **Should we expose metrics to end users?**
   - Could add performance metrics to query status
   - **Recommendation**: Start with operator-only visibility, expose selectively in future

## References

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [ClickHouse system.query_log Documentation](https://clickhouse.com/docs/en/operations/system-tables/query_log)
- [Prometheus Best Practices: Metric Naming](https://prometheus.io/docs/practices/naming/)
- [CEL Language Specification](https://github.com/google/cel-spec)
- [Activity Observability Component](../../config/components/observability/README.md)
- [Activity Metrics Implementation](../../internal/metrics/metrics.go)
- [Enhancement 001: Declarative Index Policy](001-declarative-index-policy.md) - Complements this proposal by making index management declarative
