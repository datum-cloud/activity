# Data Model

The activity service stores data in a ClickHouse cluster managed by the
[Altinity ClickHouse Operator][ch-operator]. The cluster runs 3 replicas
coordinated by [ClickHouse Keeper][ch-keeper] for high availability.

[ch-operator]: https://github.com/Altinity/clickhouse-operator
[ch-keeper]: https://clickhouse.com/docs/en/guides/sre/keeper/clickhouse-keeper

## Storage Architecture

All tables use `ReplicatedReplacingMergeTree` with:
- Daily or monthly partitioning for efficient TTL management
- Primary keys optimized for time-scoped tenant queries
- Bloom filter and minmax skip indexes for common filter patterns
- ZSTD compression for JSON columns

### Retention Policies

| Table | Retention | Storage |
|-------|-----------|---------|
| Audit Events | Unlimited | Hot (90 days) → Cold (S3) |
| Events | 60 days | Hot only |
| Activities | 60 days | Hot only |

Audit logs use tiered storage: data automatically moves from local SSD to
S3-compatible cold storage after 90 days. A 10 GB local cache accelerates
queries against cold data. Events and activities are deleted after their
retention period expires.

## Audit Events Table

The `audit.events` table stores raw audit events from the control plane:

```sql
CREATE TABLE audit.events (
    -- Full audit event as compressed JSON
    event_json String CODEC(ZSTD(3)),

    -- Extracted timestamp for partitioning and ordering
    timestamp DateTime64(6),

    -- Tenant scope
    scope_type LowCardinality(String),  -- Organization, Project, User
    scope_name String,

    -- Actor identity
    user String,
    user_uid String,

    -- Request metadata
    verb LowCardinality(String),
    resource LowCardinality(String),
    api_group LowCardinality(String),
    namespace String,
    resource_name String,

    -- Response
    status_code UInt16

) ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/audit_events', '{replica}')
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (scope_type, scope_name, timestamp, user_uid)
TTL timestamp + INTERVAL 90 DAY TO VOLUME 'cold'
SETTINGS index_granularity = 8192;
```

### Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `idx_verb` | bloom_filter | `verb` | Filter by operation type |
| `idx_resource` | bloom_filter | `resource, resource_name` | Resource lookups |
| `idx_user` | bloom_filter | `user, user_uid` | Actor-based queries |
| `idx_status` | minmax | `status_code` | Error filtering |

### Projections

Three projections provide optimized sort orders:

```sql
-- Platform-wide queries (sorted by time)
PROJECTION platform_queries (
    SELECT * ORDER BY timestamp, scope_type, scope_name
)

-- Username-based queries
PROJECTION user_queries (
    SELECT * ORDER BY user, timestamp
)

-- User UID-based queries (stable across name changes)
PROJECTION uid_queries (
    SELECT * ORDER BY user_uid, timestamp
)
```

## Events Table

The `audit.k8s_events` table stores Kubernetes Events (core/v1.Event) for
multi-tenant environments.

### Storage Model

Events use an **insert-only model** where each event state (as `lastTimestamp`
changes) becomes a separate row. This allows `last_timestamp` to be in the
primary key for efficient ordering. Queries use `LIMIT 1 BY uid` to get the
latest state per event. `ReplacingMergeTree` handles true duplicates from
pipeline retries.

```sql
CREATE TABLE audit.k8s_events (
    -- Full event as compressed JSON
    event_json String CODEC(ZSTD(3)),

    -- Insertion timestamp for ResourceVersion (nanoseconds for monotonicity)
    inserted_at DateTime64(9),

    -- Tenant scope (primary query dimension)
    scope_type LowCardinality(String),   -- Organization, Project
    scope_name String,

    -- Timestamps
    first_timestamp DateTime64(3),
    last_timestamp DateTime64(3),

    -- Event metadata
    namespace LowCardinality(String),
    name String,
    uid String,

    -- Involved object (the resource the event is about)
    involved_api_group LowCardinality(String),  -- e.g., "apps", "networking.k8s.io"
    involved_api_version LowCardinality(String),
    involved_kind LowCardinality(String),       -- e.g., "Pod", "Deployment"
    involved_namespace LowCardinality(String),
    involved_name String,
    involved_uid String,

    -- Event classification
    reason LowCardinality(String),   -- e.g., "Scheduled", "Pulling", "Created"
    type LowCardinality(String),     -- "Normal" or "Warning"

    -- Source (what generated the event)
    source_component LowCardinality(String),  -- e.g., "kubelet", "deployment-controller"
    source_host String

) ENGINE = ReplicatedReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMMDD(last_timestamp)
ORDER BY (scope_type, scope_name, last_timestamp, involved_api_group, involved_kind, type, uid)
TTL last_timestamp + INTERVAL 60 DAY DELETE;
```

### Example Query

To get the latest state of each event, sorted by most recent activity:

```sql
SELECT * FROM audit.k8s_events
WHERE scope_type = 'organization' AND scope_name = 'acme'
ORDER BY last_timestamp DESC
LIMIT 1 BY uid
```

### Query Patterns

The table is optimized for four primary query patterns:

1. **Multi-tenant queries** (default): Filter by scope, then time range
2. **API group/resource queries**: Find events for specific resource types
3. **Platform-wide queries**: Time-range queries across all tenants
4. **Source component queries**: Events from specific controllers

### Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `idx_scope_name_bloom` | bloom_filter | `scope_name` | Tenant filtering |
| `idx_involved_api_group` | set | `involved_api_group` | API group queries |
| `idx_involved_kind_set` | set | `involved_kind` | Resource type filtering |
| `idx_involved_name_bloom` | bloom_filter | `involved_name` | Resource name lookups |
| `idx_involved_uid_bloom` | bloom_filter | `involved_uid` | Resource UID lookups |
| `idx_reason_set` | set | `reason` | Event reason filtering |
| `idx_type_set` | set | `type` | Normal vs Warning |
| `idx_source_component` | set | `source_component` | Controller/component filtering |

### Projections

Three projections provide optimized sort orders:

```sql
-- Platform-wide queries (sorted by time across all tenants)
PROJECTION platform_query_projection (
    SELECT * ORDER BY (last_timestamp, scope_type, scope_name,
                       involved_api_group, involved_kind, type, uid)
)

-- API group/resource queries (sorted by involved object type)
PROJECTION involved_object_query_projection (
    SELECT * ORDER BY (involved_api_group, involved_kind, scope_type,
                       scope_name, last_timestamp, type, uid)
)

-- Source component queries (by generating controller/component)
PROJECTION source_query_projection (
    SELECT * ORDER BY (source_component, last_timestamp, scope_type,
                       scope_name, involved_api_group, involved_kind, type, uid)
)
```

## Activities Table

The `activity.activities` table stores translated activity records:

```sql
CREATE TABLE activity.activities (
    -- Full activity as compressed JSON
    activity_json String CODEC(ZSTD(3)),

    -- Extracted timestamp
    timestamp DateTime64(6),

    -- Tenant scope
    tenant_type LowCardinality(String),  -- global, organization, project, user
    tenant_name String,

    -- Origin tracking
    origin_type LowCardinality(String),  -- audit, event
    origin_id String,

    -- Change classification
    change_source LowCardinality(String),  -- human, system

    -- Actor
    actor_type LowCardinality(String),     -- user, serviceaccount, controller
    actor_name String,
    actor_uid String,

    -- Affected resource
    api_group LowCardinality(String),
    resource_kind LowCardinality(String),
    resource_name String,
    resource_namespace String,
    resource_uid String,

    -- Human-readable summary for full-text search
    summary String

) ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{shard}/activities', '{replica}')
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (tenant_type, tenant_name, timestamp, resource_uid)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;
```

### Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `idx_api_group` | bloom_filter | `api_group` | Service provider queries |
| `idx_actor` | bloom_filter | `actor_name` | Actor-based filtering |
| `idx_resource` | bloom_filter | `resource_kind, resource_name` | Resource lookups |
| `idx_change_source` | minmax | `change_source` | Human vs system filtering |
| `idx_summary_search` | tokenbf_v1 | `summary` | Full-text search |

### Full-Text Search

The `idx_summary_search` index uses ClickHouse's `tokenbf_v1` bloom filter for
efficient token matching:

```sql
INDEX idx_summary_search summary TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 4
```

This enables queries like:

```sql
SELECT * FROM activities
WHERE hasToken(summary, 'HTTPProxy')
  AND hasToken(summary, 'created')
```

## Write Consistency

All tables are configured for strong consistency:

- Writes require acknowledgment from 2 of 3 replicas before returning success
- Reads use sequential consistency for read-after-write guarantees
- 7-day deduplication windows prevent duplicate records from pipeline retries

## Related Documentation

- [Architecture Overview](./README.md)
- [Audit Pipeline](./audit-pipeline.md) - Audit event ingestion
- [Event Pipeline](./event-pipeline.md) - Kubernetes event ingestion
- [Activity Pipeline](./activity-pipeline.md) - Activity generation
