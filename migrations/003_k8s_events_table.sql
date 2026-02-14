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
-- Step 5: Create K8s Events Table
-- ============================================================================
-- Stores Kubernetes Events (core/v1.Event) for multi-tenant environments.
-- Designed for:
--   - Fast lookups by namespace/name/uid
--   - Field selector queries (involvedObject.*, reason, type, etc.)
--   - Watch operations with ResourceVersion (using inserted_at nanoseconds)
--   - Multi-tenant scope isolation
--
-- ReplicatedReplacingMergeTree handles:
--   - Deduplication by (namespace, name, uid) during merges
--   - Event updates (count increment, lastTimestamp update) via replace
--   - HA replication across database replicas
CREATE TABLE IF NOT EXISTS audit.k8s_events
(
    -- Raw event JSON (core/v1.Event)
    event_json String CODEC(ZSTD(3)),

    -- Insertion timestamp for ResourceVersion (nanoseconds for monotonicity)
    -- Used instead of etcd revision for watch operations
    inserted_at DateTime64(9) DEFAULT now64(9),

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
    -- ========================================================================
    source_component LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'source', 'component'), ''),

    -- ========================================================================
    -- Timestamp fields
    -- ========================================================================
    first_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'firstTimestamp')),
            now64(3)
        ),

    last_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'lastTimestamp')),
            now64(3)
        ),

    -- ========================================================================
    -- Scope annotations (multi-tenant scoping)
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
    -- Skip Indexes: Optimized for different query patterns
    -- ========================================================================

    -- Bloom filters for high-cardinality columns used in field selectors
    INDEX idx_name_bloom          name                  TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_uid_bloom           uid                   TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_involved_name_bloom involved_name         TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_involved_uid_bloom  involved_uid          TYPE bloom_filter(0.01) GRANULARITY 1,

    -- Set indexes for low-cardinality columns
    INDEX idx_namespace_set       namespace             TYPE set(100) GRANULARITY 4,
    INDEX idx_involved_kind_set   involved_kind         TYPE set(50) GRANULARITY 4,
    INDEX idx_reason_set          reason                TYPE set(100) GRANULARITY 4,
    INDEX idx_type_set            type                  TYPE set(10) GRANULARITY 4,
    INDEX idx_source_component    source_component      TYPE set(50) GRANULARITY 4,

    -- Timestamp minmax indexes for time-based queries
    INDEX idx_first_timestamp_minmax first_timestamp TYPE minmax GRANULARITY 4,
    INDEX idx_last_timestamp_minmax  last_timestamp  TYPE minmax GRANULARITY 4,
    INDEX idx_inserted_at_minmax     inserted_at     TYPE minmax GRANULARITY 4
)
-- ==================================================================
-- TABLE ENGINE CONFIGURATION
-- ==================================================================
-- ReplicatedReplacingMergeTree provides:
-- - Deduplication based on ORDER BY key during merges
-- - Event updates via row replacement (newer inserted_at wins)
-- - HA replication across database replicas
--
-- Note: No explicit ZooKeeper path or replica name - the audit database
-- uses the Replicated engine (migration 001) which manages replication
-- paths automatically. Specifying them explicitly is not allowed.
ENGINE = ReplicatedReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMMDD(first_timestamp)
-- Primary key optimized for namespace-scoped lookups (kubectl get events -n <namespace>)
-- and specific event retrieval by name/uid
ORDER BY (namespace, name, uid)

-- 60-day TTL for event retention (supports EventQuery 60-day window)
TTL first_timestamp + INTERVAL 60 DAY DELETE

SETTINGS
    -- Allow dropping parts during TTL cleanup
    ttl_only_drop_parts = 1,
    -- Rebuild projections during deduplication merges
    deduplicate_merge_projection_mode = 'rebuild';

-- ============================================================================
-- Step 5: Add Time-Based Query Projection
-- ============================================================================
-- Optimized for "kubectl get events --sort-by=.lastTimestamp" and
-- time-based listing across namespaces.
--
-- Sort order: (toStartOfHour(last_timestamp), last_timestamp, namespace, name, uid)
-- Use cases:
--   - "What happened in the last hour across all namespaces?"
--   - "Recent events sorted by time"
--   - Watch operations with resourceVersion filtering

ALTER TABLE audit.k8s_events
ADD PROJECTION time_based_query_projection
(
    SELECT *
    ORDER BY (toStartOfHour(last_timestamp), last_timestamp, namespace, name, uid)
);

-- ============================================================================
-- Step 5: Add Involved Object Query Projection
-- ============================================================================
-- Optimized for field selector queries on involvedObject fields.
-- Common kubectl pattern: kubectl get events --field-selector involvedObject.name=my-pod
--
-- Sort order: (involved_kind, involved_namespace, involved_name, last_timestamp)
-- Use cases:
--   - "All events for Pod my-pod"
--   - "All events for Deployments in namespace default"
--   - "Events involving a specific resource UID"

ALTER TABLE audit.k8s_events
ADD PROJECTION involved_object_query_projection
(
    SELECT *
    ORDER BY (involved_kind, involved_namespace, involved_name, last_timestamp)
);

-- ============================================================================
-- Step 5: Add Scope-Based Query Projection
-- ============================================================================
-- Optimized for multi-tenant scope-filtered queries.
-- Used when filtering by organization or project scope.
--
-- Sort order: (scope_type, scope_name, namespace, last_timestamp)
-- Use cases:
--   - "All events in organization X"
--   - "All events in project Y"

ALTER TABLE audit.k8s_events
ADD PROJECTION scope_query_projection
(
    SELECT *
    ORDER BY (scope_type, scope_name, namespace, last_timestamp, name, uid)
);
