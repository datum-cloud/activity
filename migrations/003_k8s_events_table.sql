-- Migration: 003_k8s_events_table
-- Description: Renames audit.events to audit.audit_logs and creates
-- audit.k8s_events for Kubernetes Events (core/v1.Event) storage.
-- Author: Claude Code
-- Date: 2026-02-17

-- ============================================================================
-- Step 1: Rename Audit Log Table
-- ============================================================================
-- Migration 001 created audit.events for audit logs. Rename it to audit.audit_logs
-- to avoid confusion with Kubernetes events and enable clearer naming.
RENAME TABLE IF EXISTS audit.events TO audit.audit_logs;

-- ============================================================================
-- K8s Events Table
-- ============================================================================
-- Stores Kubernetes Events (core/v1.Event) for multi-tenant environments.
--
-- Storage model: Insert-only with deduplication
--   - Each event state (as lastTimestamp changes) is a separate row
--   - Queries use LIMIT 1 BY uid to get latest state per event
--   - ReplacingMergeTree deduplicates true duplicates from pipeline retries
--
-- Designed for:
--   - Multi-tenant isolation (scope_type, scope_name as primary key prefix)
--   - Efficient ordering by last_timestamp (in primary key)
--   - API group / resource queries on involved objects
--   - Platform-wide time-range queries
--   - Source component queries (by controller/component)
--   - Field selector queries (involvedObject.*, reason, type, etc.)
--   - Watch operations with ResourceVersion (using inserted_at nanoseconds)
CREATE TABLE IF NOT EXISTS audit.k8s_events
(
    -- Raw event JSON (core/v1.Event)
    event_json String CODEC(ZSTD(3)),

    -- Insertion timestamp for ResourceVersion (nanoseconds for monotonicity)
    -- Used instead of etcd revision for watch operations
    inserted_at DateTime64(9) DEFAULT now64(9),

    -- ========================================================================
    -- Multi-tenant scope (primary query dimension)
    -- ========================================================================
    -- Extracted from annotations for multi-tenant isolation.
    -- All queries should start with scope filtering for performance.
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
    -- Timestamp fields (second query dimension)
    -- ========================================================================
    first_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'firstTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        ),

    last_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'lastTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'firstTimestamp')),
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
    -- Involved Object fields (from involvedObject.*)
    -- ========================================================================
    -- API group extracted from apiVersion (e.g., "apps/v1" -> "apps", "v1" -> "")
    involved_api_group LowCardinality(String) MATERIALIZED
        if(
            position(JSONExtractString(event_json, 'involvedObject', 'apiVersion'), '/') > 0,
            substringBefore(JSONExtractString(event_json, 'involvedObject', 'apiVersion'), '/'),
            ''
        ),

    involved_api_version LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'involvedObject', 'apiVersion'), ''),

    involved_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'involvedObject', 'kind'), ''),

    involved_namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'involvedObject', 'namespace'), ''),

    involved_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'involvedObject', 'name'), ''),

    involved_uid String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'involvedObject', 'uid'), ''),

    -- ========================================================================
    -- Event classification fields
    -- ========================================================================
    reason LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reason'), ''),

    -- Type is "Normal" or "Warning"
    type LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'type'), 'Normal'),

    -- ========================================================================
    -- Source fields (from source.*)
    -- Identifies which controller/component generated the event
    -- ========================================================================
    source_component LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'source', 'component'), ''),

    source_host String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'source', 'host'), ''),

    -- ========================================================================
    -- Skip Indexes: Optimized for different query patterns
    -- ========================================================================

    -- Bloom filters for high-cardinality columns used in field selectors
    INDEX idx_name_bloom          name                  TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_uid_bloom           uid                   TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_involved_name_bloom involved_name         TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_involved_uid_bloom  involved_uid          TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_scope_name_bloom    scope_name            TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Set indexes for low-cardinality columns
    INDEX idx_namespace_set       namespace             TYPE set(100) GRANULARITY 4,
    INDEX idx_scope_type_set      scope_type            TYPE set(10) GRANULARITY 4,
    INDEX idx_involved_api_group  involved_api_group    TYPE set(50) GRANULARITY 4,
    INDEX idx_involved_kind_set   involved_kind         TYPE set(50) GRANULARITY 4,
    INDEX idx_reason_set          reason                TYPE set(100) GRANULARITY 4,
    INDEX idx_type_set            type                  TYPE set(10) GRANULARITY 4,
    INDEX idx_source_component    source_component      TYPE set(50) GRANULARITY 4,

    -- Timestamp minmax indexes for time-based queries
    INDEX idx_first_timestamp_minmax first_timestamp TYPE minmax GRANULARITY 4,
    INDEX idx_last_timestamp_minmax  last_timestamp  TYPE minmax GRANULARITY 4,
    INDEX idx_inserted_at_minmax     inserted_at     TYPE minmax GRANULARITY 4,

    -- ========================================================================
    -- Projections (defined inline for ReplicatedReplacingMergeTree compatibility)
    -- ========================================================================

    -- Platform-wide queries: sorted by time across all tenants
    -- Use cases: "What happened recently across the platform?"
    PROJECTION platform_query_projection
    (
        SELECT *
        ORDER BY (last_timestamp, scope_type, scope_name, involved_api_group, involved_kind, type, uid)
    ),

    -- API group / resource queries: sorted by involved object type
    -- Use cases: "All events for Deployments", "Events for networking.k8s.io resources"
    PROJECTION involved_object_query_projection
    (
        SELECT *
        ORDER BY (involved_api_group, involved_kind, scope_type, scope_name, last_timestamp, type, uid)
    ),

    -- Source component queries: sorted by generating controller/component
    -- Use cases: "All events from kubelet", "Events from deployment-controller"
    PROJECTION source_query_projection
    (
        SELECT *
        ORDER BY (source_component, last_timestamp, scope_type, scope_name, involved_api_group, involved_kind, type, uid)
    )
)
-- ==================================================================
-- TABLE ENGINE CONFIGURATION
-- ==================================================================
-- ReplicatedReplacingMergeTree provides:
-- - Deduplication of true duplicates (same ORDER BY key) during merges
-- - newer inserted_at wins when duplicates are merged
-- - HA replication across database replicas
--
-- Note: No explicit ZooKeeper path or replica name - the audit database
-- uses the Replicated engine (migration 001) which manages replication
-- paths automatically. Specifying them explicitly is not allowed.
ENGINE = ReplicatedReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMMDD(last_timestamp)
-- Primary key optimized for multi-tenant queries ordered by last_timestamp.
-- Insert-only model: each event state is a separate row, queries deduplicate
-- with LIMIT 1 BY uid. ReplacingMergeTree handles true duplicates from retries.
ORDER BY (scope_type, scope_name, last_timestamp, involved_api_group, involved_kind, type, uid)
PRIMARY KEY (scope_type, scope_name, last_timestamp, involved_api_group, involved_kind, type, uid)

-- 60-day TTL for event retention (supports EventQuery 60-day window)
TTL last_timestamp + INTERVAL 60 DAY DELETE

SETTINGS
    -- Allow dropping parts during TTL cleanup
    ttl_only_drop_parts = 1,
    -- Rebuild projections during deduplication merges
    deduplicate_merge_projection_mode = 'rebuild';
