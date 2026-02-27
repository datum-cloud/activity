-- Migration: 005_activities_reindex_support
-- Description: Recreate activities table with origin_id in ORDER BY and version column for deduplication
-- Author: Activity System
-- Date: 2026-02-27
--
-- NOTE: This migration drops existing activities data. Activities can be regenerated
-- using the ReindexJob resource to re-process historical audit logs and events.

-- Step 1: Drop the existing activities table
DROP TABLE IF EXISTS audit.activities;

-- Step 2: Create new table with updated schema
CREATE TABLE audit.activities
(
    -- Full activity record as JSON (compressed)
    activity_json String CODEC(ZSTD(3)),

    -- Version column for ReplacingMergeTree deduplication
    -- Newer timestamp wins during merge
    reindex_version DateTime64(3) DEFAULT now64(3),

    -- Core timestamp for time-range queries
    timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(activity_json, 'metadata', 'creationTimestamp')),
            now64(3)
        ),

    -- Multi-tenant isolation
    tenant_type LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'tenant', 'type'), ''),

    tenant_name String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'tenant', 'name'), ''),

    -- Origin tracking for correlation to source records
    origin_type LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'origin', 'type'), ''),

    origin_id String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'origin', 'id'), ''),

    -- Change source classification (human vs system)
    change_source LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'changeSource'), ''),

    -- Actor information
    actor_type LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'actor', 'type'), ''),

    actor_name String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'actor', 'name'), ''),

    actor_uid String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'actor', 'uid'), ''),

    -- Resource information
    api_group LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'resource', 'apiGroup'), ''),

    resource_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'resource', 'kind'), ''),

    resource_name String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'resource', 'name'), ''),

    resource_namespace String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'resource', 'namespace'), ''),

    resource_uid String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'resource', 'uid'), ''),

    -- Activity metadata
    activity_name String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'metadata', 'name'), ''),

    activity_namespace String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'metadata', 'namespace'), ''),

    -- Summary for full-text search
    summary String MATERIALIZED
        coalesce(JSONExtractString(activity_json, 'spec', 'summary'), ''),

    -- ========================================================================
    -- Skip Indexes
    -- ========================================================================

    -- Bloom filter for API group filtering (service provider queries)
    INDEX idx_api_group api_group TYPE bloom_filter(0.01) GRANULARITY 1,

    -- Bloom filter for actor-based filtering
    INDEX idx_actor_name actor_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_actor_uid actor_uid TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Bloom filter for resource lookups
    INDEX idx_resource resource_kind TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_resource_name resource_name TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_resource_uid resource_uid TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Minmax for change source filtering (human vs system)
    INDEX idx_change_source change_source TYPE set(10) GRANULARITY 4,

    -- Full-text index for summary search (ngrams enable substring/prefix matching)
    INDEX idx_summary_search summary TYPE text(tokenizer = ngrams(3)) GRANULARITY 1,

    -- ========================================================================
    -- Projections (updated with origin_id)
    -- ========================================================================

    -- Projection for service provider queries (by API group)
    PROJECTION api_group_query_projection
    (
        SELECT *
        ORDER BY (api_group, timestamp, tenant_type, tenant_name, origin_id)
    ),

    -- Projection for actor-based queries
    PROJECTION actor_query_projection
    (
        SELECT *
        ORDER BY (actor_name, timestamp, tenant_type, tenant_name, origin_id)
    )
)
ENGINE = ReplicatedReplacingMergeTree(reindex_version)
PARTITION BY toYYYYMMDD(timestamp)
-- Updated ORDER BY with origin_id for deduplication.
-- NOTE: The combination (tenant_type, tenant_name, timestamp, origin_id) is unique because
-- the activity processor follows a "first policy wins" rule - each source event (audit log
-- or Kubernetes Event) produces at most one Activity. Even if multiple ActivityPolicies
-- match the same event, only the first matching policy generates an Activity.
-- See evaluateBatch() in internal/reindex/evaluate.go.
ORDER BY (tenant_type, tenant_name, timestamp, origin_id)
PRIMARY KEY (tenant_type, tenant_name, timestamp, origin_id)

-- 60-day retention for activities
TTL timestamp + INTERVAL 60 DAY DELETE

SETTINGS
    storage_policy = 'default',
    ttl_only_drop_parts = 1,
    deduplicate_merge_projection_mode = 'rebuild';
