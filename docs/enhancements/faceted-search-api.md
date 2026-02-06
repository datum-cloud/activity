# Enhancement Proposal: Faceted Search API for Audit Log Filtering

**Status**: Draft **Authors**: Platform Engineering Team **Created**: 2026-01-29
**Last Updated**: 2026-01-29

## Summary

This enhancement proposes adding a new `AuditLogFacets` API resource that
returns distinct values and counts for filterable fields in the audit log
system. This enables UI dropdown filters to display actual available values
based on the user's data, improving discoverability and reducing failed queries.

## Motivation

Users querying audit logs through the Activity Web UI need to filter on fields
like `verb`, `resource`, `namespace`, and `user`. Currently, the UI must either:

1. **Hardcode filter options** - Results in stale options that don't reflect
   actual data
2. **Allow free-form input** - Users don't know what values exist, leading to
   empty results
3. **Fetch all data client-side** - Expensive and doesn't scale

A faceted search API solves these problems by returning the actual distinct
values present in the user's data, along with counts showing how many events
match each value.

### User Experience Goals

- **Discoverability**: Users see what filter values are available before
  querying
- **Context**: Counts show the relative frequency of each value
- **Interactivity**: Selecting a filter updates other facets to show compatible
  values
- **Performance**: Facet queries complete quickly enough for interactive UI

### Technical Goals

- Leverage ClickHouse's efficient aggregation capabilities
- Respect the same multi-tenant scoping as `AuditLogQuery`
- Minimize resource consumption for high-cardinality fields
- Enable caching for frequently accessed facets

## Goals

### Primary Goals

- Create an `AuditLogFacets` resource that returns distinct values for specified
  fields
- Include event counts for each distinct value
- Support the same time range and scoping semantics as `AuditLogQuery`
- Allow pre-filtering to compute "compatible" facets when filters are selected
- Limit high-cardinality fields to prevent runaway queries

### Non-Goals

- Full-text search within facet values (use CEL `contains()` in queries instead)
- Facets for `objectRef.name` or `auditID` (too high cardinality)
- Real-time facet updates (slight staleness is acceptable)
- Cross-tenant facet aggregation (facets are always scoped)

## Design

### API Resource

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogFacets
metadata:
  name: "" # Generated, not user-specified
spec:
  # Time range for facet computation (required)
  # Same semantics as AuditLogQuery: relative ("now-7d") or absolute (RFC3339)
  startTime: "now-7d"
  endTime: "now"

  # Which facets to compute (required, 1-10 facets)
  # Controls query cost - only request what you need
  facets:
    - verb
    - objectRef.resource
    - objectRef.apiGroup
    - objectRef.namespace
    - user.username
    - responseStatus.code

  # Optional: pre-filter for "compatible" facet values
  # When set, facets are computed only for events matching this filter
  # Uses the same CEL syntax as AuditLogQuery.spec.filter
  filter: "verb == 'delete'"

  # Maximum values per facet (optional, default: 100, max: 500)
  limit: 100

status:
  # Resolved time range (for relative time expressions)
  effectiveStartTime: "2026-01-22T00:00:00Z"
  effectiveEndTime: "2026-01-29T00:00:00Z"

  # Computed facets, keyed by field name
  facets:
    verb:
      values:
        - value: "get"
          count: 89234
        - value: "list"
          count: 45123
        - value: "create"
          count: 15420
        - value: "update"
          count: 12345
        - value: "delete"
          count: 2341
        - value: "patch"
          count: 1234
        - value: "watch"
          count: 567
      # True if more values exist beyond the limit
      truncated: false

    objectRef.resource:
      values:
        - value: "pods"
          count: 45000
        - value: "deployments"
          count: 12000
        - value: "secrets"
          count: 8500
        - value: "configmaps"
          count: 7200
        - value: "services"
          count: 5100
      truncated: true  # More resources exist

    responseStatus.code:
      values:
        - value: "200"
          count: 95000
        - value: "201"
          count: 15000
        - value: "404"
          count: 2500
        - value: "403"
          count: 1200
        - value: "500"
          count: 150
      truncated: false
```

### Supported Facet Fields

| Field | ClickHouse Column | Cardinality | Default Include |
|-------|-------------------|-------------|-----------------|
| `verb` | `verb` | Very Low (~7) | Yes |
| `responseStatus.code` | `status_code` | Low (~20) | Yes |
| `objectRef.apiGroup` | `api_group` | Low (~50) | Yes |
| `objectRef.resource` | `resource` | Medium (~200) | Yes |
| `objectRef.namespace` | `namespace` | Medium-High | No |
| `user.username` | `user` | High | No |

**Not supported** (too high cardinality):
- `objectRef.name` - Individual resource names
- `auditID` - Unique per event
- `user.uid` - One per user identity

### ClickHouse Query Strategy

#### Option A: Per-Facet Queries (Recommended)

Execute a separate query for each requested facet. This provides accurate counts
and allows ClickHouse to use optimal indexes for each aggregation.

```sql
-- For each requested facet, run:
SELECT
    verb AS value,
    count() AS count
FROM audit.events
WHERE scope_type = {scope_type:String}
  AND scope_name = {scope_name:String}
  AND timestamp >= {start_time:DateTime64(3)}
  AND timestamp < {end_time:DateTime64(3)}
  -- Optional: CEL filter converted to SQL
  AND {cel_filter_sql}
GROUP BY verb
ORDER BY count DESC
LIMIT {limit:UInt32}
```

**Advantages:**
- Each query can use the most efficient index
- Accurate counts per facet
- Easy to parallelize
- Simple error isolation (one facet failing doesn't affect others)

**Disadvantages:**
- Multiple round trips to ClickHouse (mitigated by parallel execution)

#### Option B: Single Query with Multiple Aggregations

Compute all facets in a single query using conditional aggregation.

```sql
SELECT
    arraySlice(
        arrayReverseSort(x -> x.2, groupArray((verb, count)))
        1, {limit}
    ) AS verb_facet,
    arraySlice(
        arrayReverseSort(x -> x.2, groupArray((resource, count)))
        1, {limit}
    ) AS resource_facet
FROM (
    SELECT
        verb,
        resource,
        count() as count
    FROM audit.events
    WHERE scope_type = {scope_type}
      AND scope_name = {scope_name}
      AND timestamp >= {start_time}
      AND timestamp < {end_time}
    GROUP BY verb, resource
)
```

**Advantages:**
- Single round trip to ClickHouse
- Shared scan of base data

**Disadvantages:**
- Complex query construction
- Cross-product of grouping columns can explode memory
- All-or-nothing failure mode

**Recommendation:** Use Option A (per-facet queries) with parallel execution.
The simplicity and reliability outweigh the cost of multiple queries.

### Scoping

Facets respect the same multi-tenant scoping as `AuditLogQuery`:

| Scope | WHERE Clause Addition |
|-------|----------------------|
| Platform | None (all events visible) |
| Organization | `scope_type = 'Organization' AND scope_name = {org_name}` |
| Project | `scope_type = 'Project' AND scope_name = {project_name}` |
| User | `user_uid = {user_uid}` |

### Performance Considerations

#### Query Execution

1. **Parallel facet queries**: Execute all facet queries concurrently with
   `errgroup`
2. **Timeout**: 30-second timeout per facet query, 60-second total timeout
3. **Memory limits**: Set ClickHouse `max_memory_usage` to prevent runaway
   queries

#### Caching Strategy (Phase 2)

Facet results are cacheable because:
- They change slowly (new events don't drastically change distributions)
- The same facets are requested repeatedly by UI users
- Slight staleness is acceptable

**Cache key components:**
- Scope (type + name)
- Time range (rounded to nearest hour for cache efficiency)
- Requested facets (sorted)
- Filter expression (hashed)

**Cache TTL:** 5 minutes (configurable)

**Cache invalidation:** Time-based expiry only (no event-driven invalidation
needed)

#### Index Usage

The existing ClickHouse schema supports efficient facet queries:

| Facet | Index Used |
|-------|------------|
| `verb` | `idx_verb_set` (set index) |
| `resource` | `idx_resource_bloom` (bloom filter) |
| `api_group` | `bf_api_resource` (bloom filter) |
| `status_code` | `idx_status_code_set` (set index) |
| `namespace` | Primary key prefix |
| `user` | `idx_user_bloom` (bloom filter) |

### Error Handling

| Error Condition | Response |
|-----------------|----------|
| Invalid facet field requested | 400 Bad Request with list of valid fields |
| Too many facets requested (>10) | 400 Bad Request |
| CEL filter syntax error | 400 Bad Request with parse error |
| ClickHouse timeout | 504 Gateway Timeout |
| ClickHouse memory exceeded | 503 Service Unavailable |

Partial success is **not** supported - either all facets succeed or the request
fails. This simplifies client logic and prevents confusion from incomplete
results.

### UI Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Logs                                    [Last 7 days ▼] │
├─────────────────────────────────────────────────────────────────┤
│ Filters:                                                        │
│                                                                 │
│ ┌────────────┐  ┌──────────────┐  ┌─────────────────┐          │
│ │ Action   ▼ │  │ Resource   ▼ │  │ Status Code   ▼ │          │
│ ├────────────┤  ├──────────────┤  ├─────────────────┤          │
│ │ □ get (89k)│  │ □ pods (45k) │  │ □ 200 (95k)     │          │
│ │ □ list(45k)│  │ □ deploy(12k)│  │ □ 201 (15k)     │          │
│ │ ■ create   │  │ ■ secrets    │  │ □ 404 (2.5k)    │          │
│ │   (15k)    │  │   (8.5k)     │  │ ■ 403 (1.2k)    │          │
│ │ □ delete   │  │ □ configmaps │  │ □ 500 (150)     │          │
│ │   (2.3k)   │  │   (7.2k)     │  │                 │          │
│ └────────────┘  └──────────────┘  └─────────────────┘          │
│                                                                 │
│ [Apply Filters]                              [Clear All]        │
├─────────────────────────────────────────────────────────────────┤
│ Showing 1-100 of 9,700 results                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ 2026-01-29 14:23:15  CREATE  secrets/db-credentials       │  │
│ │ user: admin@example.com  status: 403  ns: production      │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ ...                                                       │  │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow:**

1. **Initial load**: UI calls `AuditLogFacets` with default time range and
   standard facets
2. **Time range change**: UI refetches facets with new time range
3. **Filter selection**: UI refetches facets with `filter` field set to update
   compatible values
4. **Query execution**: UI calls `AuditLogQuery` with user's selected filters as
   CEL expression

**Example interaction:**

```javascript
// 1. Initial facet load
const initialFacets = await createAuditLogFacets({
  startTime: "now-7d",
  endTime: "now",
  facets: ["verb", "objectRef.resource", "responseStatus.code"],
});

// 2. User selects verb='create', refetch to show compatible facets
const filteredFacets = await createAuditLogFacets({
  startTime: "now-7d",
  endTime: "now",
  facets: ["verb", "objectRef.resource", "responseStatus.code"],
  filter: "verb == 'create'",
});

// 3. User clicks "Apply", execute actual query
const results = await createAuditLogQuery({
  startTime: "now-7d",
  endTime: "now",
  filter: "verb == 'create' && objectRef.resource == 'secrets'",
  limit: 100,
});
```

## Implementation Plan

### Phase 1: Core API (Week 1-2)

**Objective**: Implement the basic `AuditLogFacets` resource with per-facet
queries.

**Tasks**:
1. Define API types in `pkg/apis/activity/v1alpha1/types.go`
2. Implement validation in `pkg/apis/activity/v1alpha1/validation.go`
3. Add ClickHouse facet query builder in `internal/storage/clickhouse.go`
4. Create REST storage handler in `internal/registry/activity/auditlogfacets/`
5. Register the resource with the API server
6. Add unit tests for query building and validation
7. Add integration tests with ClickHouse

**Deliverables**:
- `pkg/apis/activity/v1alpha1/types.go` (updated)
- `pkg/apis/activity/v1alpha1/validation.go` (updated)
- `internal/storage/clickhouse.go` (updated)
- `internal/storage/facets.go` (new)
- `internal/registry/activity/auditlogfacets/storage.go` (new)
- `internal/registry/activity/auditlogfacets/storage_test.go` (new)

**Success Criteria**:
- Can create `AuditLogFacets` resource via kubectl
- Returns correct facet values for a tenant
- Respects time range and scoping
- All tests pass

### Phase 2: Filter Support (Week 2-3)

**Objective**: Add support for the `filter` field to compute compatible facets.

**Tasks**:
1. Integrate CEL filter compilation from existing `AuditLogQuery` code
2. Apply CEL-to-SQL conversion for facet queries
3. Add validation for CEL syntax in facet requests
4. Update integration tests to cover filtered facets

**Deliverables**:
- Updated `internal/storage/facets.go` with filter support
- Additional test cases

**Success Criteria**:
- Filtered facets return only values compatible with the filter
- CEL syntax errors return helpful error messages
- Performance remains acceptable with filters applied

### Phase 3: Observability (Week 3)

**Objective**: Add metrics and tracing for facet queries.

**Tasks**:
1. Add Prometheus metrics for facet query latency and counts
2. Add OpenTelemetry spans for facet computation
3. Update Grafana dashboards to include facet metrics
4. Add facet query logging

**Metrics to add**:
- `activity_facet_query_duration_seconds` (histogram, by facet field)
- `activity_facet_queries_total` (counter, by scope type)
- `activity_facet_values_returned` (histogram)
- `activity_facet_query_errors_total` (counter, by error type)

**Deliverables**:
- Metrics instrumentation in storage layer
- Updated Grafana dashboard
- Tracing spans

**Success Criteria**:
- Facet query latency is visible in dashboards
- Slow facet queries can be identified
- Error rates are tracked

### Phase 4: Caching (Week 4) - Optional

**Objective**: Add caching layer for frequently accessed facets.

**Tasks**:
1. Implement in-memory LRU cache for facet results
2. Add cache key generation based on scope, time range, and facets
3. Add cache hit/miss metrics
4. Add cache configuration options (TTL, max size)
5. Consider Redis integration for distributed caching

**Deliverables**:
- `internal/cache/facets.go` (new)
- Cache metrics
- Configuration options in API server flags

**Success Criteria**:
- Repeated facet requests are served from cache
- Cache hit rate is measurable
- Cache memory usage is bounded

### Phase 5: Documentation (Week 4)

**Objective**: Document the new API for users and operators.

**Tasks**:
1. Add API reference documentation
2. Add usage examples for common scenarios
3. Document performance characteristics and limits
4. Update architecture documentation

**Deliverables**:
- `docs/api/auditlogfacets.md` (new)
- Updated `docs/architecture.md`
- Example YAML files in `examples/`

**Success Criteria**:
- Users can understand and use the API from documentation alone
- Performance expectations are documented

## API Types

```go
// AuditLogFacets requests facet values for audit log filtering.
// Like AuditLogQuery, this is an ephemeral resource that executes
// on creation and returns results in the status field.
type AuditLogFacets struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`

    Spec   AuditLogFacetsSpec   `json:"spec"`
    Status AuditLogFacetsStatus `json:"status,omitempty"`
}

// AuditLogFacetsSpec defines the parameters for facet computation.
type AuditLogFacetsSpec struct {
    // StartTime is the beginning of the time range for facet computation.
    // Supports relative times ("now-7d", "now-24h") or absolute RFC3339.
    // Required.
    StartTime string `json:"startTime"`

    // EndTime is the end of the time range for facet computation.
    // Supports relative times ("now") or absolute RFC3339.
    // Required.
    EndTime string `json:"endTime"`

    // Facets lists the fields to compute facets for.
    // Supported fields: verb, objectRef.resource, objectRef.apiGroup,
    // objectRef.namespace, user.username, responseStatus.code
    // Required. Minimum 1, maximum 10 facets.
    Facets []string `json:"facets"`

    // Filter is an optional CEL expression to pre-filter events.
    // When specified, facets are computed only for matching events.
    // Uses the same syntax as AuditLogQuery.spec.filter.
    // +optional
    Filter string `json:"filter,omitempty"`

    // Limit is the maximum number of values to return per facet.
    // Values are sorted by count descending.
    // Default: 100, Maximum: 500.
    // +optional
    Limit *int32 `json:"limit,omitempty"`
}

// AuditLogFacetsStatus contains the computed facet results.
type AuditLogFacetsStatus struct {
    // EffectiveStartTime is the resolved start time in RFC3339 format.
    EffectiveStartTime string `json:"effectiveStartTime,omitempty"`

    // EffectiveEndTime is the resolved end time in RFC3339 format.
    EffectiveEndTime string `json:"effectiveEndTime,omitempty"`

    // Facets contains the computed values for each requested field.
    // Keys match the field names from spec.facets.
    Facets map[string]FacetResult `json:"facets,omitempty"`
}

// FacetResult contains the distinct values and counts for a single facet.
type FacetResult struct {
    // Values contains the distinct values sorted by count descending.
    Values []FacetValue `json:"values"`

    // Truncated indicates whether more values exist beyond the limit.
    Truncated bool `json:"truncated"`
}

// FacetValue represents a single distinct value and its event count.
type FacetValue struct {
    // Value is the distinct field value.
    Value string `json:"value"`

    // Count is the number of events with this value.
    Count int64 `json:"count"`
}
```

## Success Metrics

### Functional Metrics

- Facet queries return correct values for all supported fields
- Scoping correctly isolates tenant data
- Filtered facets return compatible values
- Time ranges are respected

### Performance Metrics

| Metric | Target |
|--------|--------|
| Facet query P50 latency | < 500ms |
| Facet query P95 latency | < 2s |
| Facet query P99 latency | < 5s |
| Maximum concurrent facet requests | 50 |
| Cache hit rate (Phase 4) | > 60% |

### Adoption Metrics

- UI integration completed
- Facet queries per day (indicates user adoption)
- Reduction in empty `AuditLogQuery` results (indicates better discoverability)

## Alternatives Considered

### Alternative 1: Client-Side Aggregation

Fetch all events and compute facets in the browser.

**Pros:**
- No new API needed
- Always fresh data

**Cons:**
- Requires fetching all data (potentially millions of events)
- Poor performance for large datasets
- High bandwidth usage
- Browser memory constraints

**Decision:** Rejected due to scalability concerns.

### Alternative 2: Hardcoded Filter Options

Define static lists of filter values in the UI.

**Pros:**
- Simple implementation
- No API changes needed

**Cons:**
- Values become stale as data changes
- No counts to indicate relevance
- Can't reflect tenant-specific data

**Decision:** Rejected because it doesn't solve the core problem.

### Alternative 3: Elasticsearch-Style Aggregations

Use a query DSL with embedded aggregation requests.

**Pros:**
- Single request for query + facets
- Well-understood pattern from Elasticsearch

**Cons:**
- Major API redesign required
- More complex than current CEL-based approach
- Doesn't align with Kubernetes API patterns

**Decision:** Rejected to maintain consistency with existing API design.

### Alternative 4: Materialized Views for Facets

Pre-compute facets in ClickHouse materialized views.

**Pros:**
- Extremely fast reads
- No query-time aggregation

**Cons:**
- Storage overhead
- Complex to maintain with multiple tenants
- May become stale
- Doesn't support arbitrary filters

**Decision:** Deferred to Phase 4 if caching proves insufficient.

## Security Considerations

1. **Scope enforcement**: Facets must respect the same multi-tenant scoping as
   queries. A user should never see facet values from data they cannot query.

2. **Information disclosure**: Facet counts reveal information about data
   distribution. This is intentional but should be considered in security
   reviews.

3. **Resource exhaustion**: Facet queries without limits could consume
   significant ClickHouse resources. The limit field (max 500) prevents runaway
   queries.

4. **CEL injection**: The filter field uses the same validated CEL compilation
   as `AuditLogQuery`, preventing injection attacks.

## Future Enhancements

1. **Hierarchical facets**: Show namespace facets grouped by resource type
2. **Time-series facets**: Show how facet distributions change over time
3. **Suggested filters**: Recommend filters based on query patterns
4. **Facet search**: Allow filtering facet values for high-cardinality fields
5. **Custom facet fields**: Support organization-defined facet fields from
   annotations

## References

- [ClickHouse GROUP BY
  Optimization](https://clickhouse.com/docs/en/sql-reference/statements/select/group-by)
- [Elasticsearch
  Aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html)
  (conceptual reference)
- [Kubernetes API
  Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)
- [CEL Specification](https://github.com/google/cel-spec)
- Internal: `AuditLogQuery` implementation in
  `internal/registry/activity/auditlog/`

---

**End of Enhancement Proposal**
