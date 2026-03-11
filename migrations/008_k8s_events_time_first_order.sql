-- Migration: 008_k8s_events_time_first_order
-- Description: Recreate k8s_events table with time-first ORDER BY aligned with
-- audit_logs and activities patterns. Puts toStartOfHour(last_timestamp) as the
-- leading sort key for efficient time-range query performance.
--
-- Author: Activity System
-- Date: 2026-03-10
--
-- NOTE: This migration drops existing k8s_events data. The feature is not yet
-- in production so data loss is acceptable. Use DROP + CREATE (no copy-swap).
--
-- Change ORDER BY from:
--   (scope_type, scope_name, last_timestamp, regarding_api_group, regarding_kind, type, uid)
-- to:
--   (toStartOfHour(last_timestamp), last_timestamp, scope_type, scope_name, regarding_api_group, regarding_kind, type, uid)
--
-- Projections are also updated to use hour-bucketed patterns.

-- Step 1: Drop the existing k8s_events table (data loss acceptable for pre-production)
DROP TABLE IF EXISTS audit.k8s_events;

-- Step 2: Create new table with time-first ORDER BY and hour-bucketed projections
CREATE TABLE audit.k8s_events
(
    -- Raw event JSON (events.k8s.io/v1.Event)
    event_json String CODEC(ZSTD(3)),

    -- Insertion timestamp for ResourceVersion (nanoseconds for monotonicity)
    -- Used as version column for ReplacingMergeTree deduplication
    inserted_at DateTime64(9) DEFAULT now64(9),

    -- ========================================================================
    -- Multi-tenant scope (primary query dimension)
    -- ========================================================================
    scope_type LowCardinality(String) MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'metadata', 'annotations', 'platform.miloapis.com/scope.type'),
            ''
        ),

    scope_name String MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'metadata', 'annotations', 'platform.miloapis.com/scope.name'),
            ''
        ),

    -- ========================================================================
    -- Timestamp fields
    -- ========================================================================
    first_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedFirstTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        ),

    last_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'series', 'lastObservedTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedLastTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        ),

    event_time DateTime64(6) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedFirstTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        ),

    -- ========================================================================
    -- Metadata fields (from metadata.*)
    -- ========================================================================
    namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'metadata', 'namespace'), ''),

    name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'metadata', 'name'), ''),

    uid String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'metadata', 'uid'), ''),

    -- ========================================================================
    -- Regarding Object fields (from regarding.* - events.k8s.io/v1)
    -- ========================================================================
    -- API group extracted from apiVersion (e.g., "apps/v1" -> "apps", "v1" -> "")
    regarding_api_group LowCardinality(String) MATERIALIZED
        if(
            position(JSONExtractString(event_json, 'regarding', 'apiVersion'), '/') > 0,
            splitByChar('/', JSONExtractString(event_json, 'regarding', 'apiVersion'))[1],
            ''
        ),

    regarding_api_version LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'apiVersion'), ''),

    regarding_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'kind'), ''),

    regarding_namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'namespace'), ''),

    regarding_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'name'), ''),

    regarding_uid String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'uid'), ''),

    regarding_field_path String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'fieldPath'), ''),

    -- ========================================================================
    -- Related Object fields (optional secondary object in events.k8s.io/v1)
    -- ========================================================================
    related_api_version LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'apiVersion'), ''),

    related_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'kind'), ''),

    related_namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'namespace'), ''),

    related_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'name'), ''),

    -- ========================================================================
    -- Event classification fields
    -- ========================================================================
    reason LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reason'), ''),

    -- Type is "Normal" or "Warning"
    type LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'type'), 'Normal'),

    -- Action field (required in v1, describes what action was taken)
    action LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'action'), ''),

    -- ========================================================================
    -- Series fields (for repeated events in events.k8s.io/v1)
    -- ========================================================================
    series_count Int32 MATERIALIZED
        coalesce(JSONExtractInt(event_json, 'series', 'count'), 0),

    series_last_observed DateTime64(6) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'series', 'lastObservedTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedLastTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        ),

    is_series Bool MATERIALIZED
        JSONHas(event_json, 'series'),

    -- ========================================================================
    -- Source fields (reportingController/reportingInstance in events.k8s.io/v1)
    -- ========================================================================
    source_component LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reportingController'), ''),

    source_host String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reportingInstance'), ''),

    -- ========================================================================
    -- Skip Indexes
    -- ========================================================================
    -- Bloom filters for high-cardinality columns
    INDEX idx_name_bloom             name              TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_uid_bloom              uid               TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_regarding_name_bloom   regarding_name    TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_regarding_uid_bloom    regarding_uid     TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_scope_name_bloom       scope_name        TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Set indexes for low-cardinality columns
    INDEX idx_namespace_set          namespace          TYPE set(100) GRANULARITY 4,
    INDEX idx_scope_type_set         scope_type         TYPE set(10) GRANULARITY 4,
    INDEX idx_regarding_api_group    regarding_api_group TYPE set(50) GRANULARITY 4,
    INDEX idx_regarding_kind_set     regarding_kind     TYPE set(50) GRANULARITY 4,
    INDEX idx_reason_set             reason             TYPE set(100) GRANULARITY 4,
    INDEX idx_type_set               type               TYPE set(10) GRANULARITY 4,
    INDEX idx_source_component       source_component   TYPE set(50) GRANULARITY 4,
    INDEX idx_action_set             action             TYPE set(100) GRANULARITY 4,
    INDEX idx_is_series_set          is_series          TYPE set(2) GRANULARITY 4,

    -- Timestamp minmax indexes
    INDEX idx_first_timestamp_minmax  first_timestamp    TYPE minmax GRANULARITY 4,
    INDEX idx_last_timestamp_minmax   last_timestamp     TYPE minmax GRANULARITY 4,
    INDEX idx_inserted_at_minmax      inserted_at        TYPE minmax GRANULARITY 4,
    INDEX idx_event_time_minmax       event_time         TYPE minmax GRANULARITY 4,
    INDEX idx_series_last_observed_minmax series_last_observed TYPE minmax GRANULARITY 4,

    -- ========================================================================
    -- Projections (time-bucketed, aligned with audit_logs and activities patterns)
    -- ========================================================================

    -- Platform-wide queries: sorted by time across all tenants
    -- ORDER BY matches platform_query_projection for efficient index use
    PROJECTION platform_query_projection
    (
        SELECT *
        ORDER BY (toStartOfHour(last_timestamp), last_timestamp, regarding_api_group, regarding_kind, type, uid)
    ),

    -- API group / resource queries: sorted by regarding object type
    -- Includes scope for tenant-filtered regarding-object queries
    PROJECTION regarding_object_query_projection
    (
        SELECT *
        ORDER BY (toStartOfHour(last_timestamp), last_timestamp, regarding_api_group, regarding_kind, scope_type, scope_name, type, uid)
    ),

    -- Source component queries: sorted by generating controller/component
    PROJECTION source_query_projection
    (
        SELECT *
        ORDER BY (toStartOfHour(last_timestamp), last_timestamp, source_component, scope_type, scope_name, regarding_api_group, regarding_kind, type, uid)
    )
)
ENGINE = ReplicatedReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMMDD(last_timestamp)
-- Primary key uses toStartOfHour(last_timestamp) as the leading column for efficient
-- time-bucketed queries, matching the projection sort orders and audit_logs/activities patterns.
ORDER BY (toStartOfHour(last_timestamp), last_timestamp, scope_type, scope_name, regarding_api_group, regarding_kind, type, uid)
PRIMARY KEY (toStartOfHour(last_timestamp), last_timestamp, scope_type, scope_name, regarding_api_group, regarding_kind, type, uid)

-- 60-day TTL for event retention (supports EventQuery 60-day window)
TTL last_timestamp + INTERVAL 60 DAY DELETE

SETTINGS
    ttl_only_drop_parts = 1,
    deduplicate_merge_projection_mode = 'rebuild';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The k8s_events table now uses time-first ORDER BY:
--   PRIMARY KEY: (toStartOfHour(last_timestamp), last_timestamp, scope_type, scope_name,
--                 regarding_api_group, regarding_kind, type, uid)
--
-- Projections updated to hour-bucketed patterns:
--   - platform_query_projection: time-first for platform-wide queries
--   - regarding_object_query_projection: time-first for resource-type queries
--   - source_query_projection: time-first for source component queries
--
-- Query builder (event_query_clickhouse.go) ORDER BY clauses must match this
-- primary key and projection sort orders.
