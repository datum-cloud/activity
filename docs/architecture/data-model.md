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
| Events | 90 days | Hot only |
| Activities | 30 days | Hot only |

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

The events table schema will be defined in a future iteration when Kubernetes
event ingestion is implemented.

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
