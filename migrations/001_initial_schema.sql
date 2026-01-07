-- Migration: 001_initial_schema
-- Description: High-volume multi-tenant audit events table with projections for
-- platform-wide querying and user-specific querying.
-- Author: Scot Wells <swells@datum.net>
-- Date: 2025-12-11

CREATE DATABASE IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.events
(
    -- Raw audit event JSON
    event_json String CODEC(ZSTD(3)),

    -- Core timestamp (always queried)
    timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'stageTimestamp')),
            now64(3)
        ),

    -- Scope annotations (multi-tenant scoping)
    scope_type LowCardinality(String) MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'annotations', 'platform.miloapis.com/scope.type'),
            ''
        ),

    scope_name String MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'annotations', 'platform.miloapis.com/scope.name'),
            ''
        ),

    -- User identity
    user String MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'user', 'username'),
            ''
        ),

    -- Request identity
    audit_id UUID MATERIALIZED
        toUUIDOrZero(coalesce(JSONExtractString(event_json, 'auditID'), '')),

    -- Common filters
    verb LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'verb'), ''),

    api_group LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'objectRef', 'apiGroup'), ''),

    resource LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'objectRef', 'resource'), ''),

    namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'objectRef', 'namespace'), ''),

    resource_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'objectRef', 'name'), ''),

    status_code UInt16 MATERIALIZED
        toUInt16OrZero(JSONExtractString(event_json, 'responseStatus', 'code')),

    -- ========================================================================
    -- Skip Indexes: Optimized for different query patterns
    -- ========================================================================

    -- Timestamp minmax index for time range queries
    INDEX idx_timestamp_minmax timestamp TYPE minmax GRANULARITY 4,

    -- Bloom filters with GRANULARITY 1 for high precision (critical filters)
    INDEX idx_verb_set            verb                  TYPE set(10) GRANULARITY 4,
    INDEX idx_resource_bloom      resource              TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX bf_api_resource         (api_group, resource) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_verb_resource_bloom (verb, resource)      TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_user_bloom          user                  TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Set indexes for low-cardinality columns
    INDEX idx_status_code_set status_code TYPE set(100) GRANULARITY 4,
    -- Minmax index for status_code range queries
    INDEX idx_status_code_minmax status_code TYPE minmax GRANULARITY 4,
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMMDD(timestamp)
-- Primary key optimized for tenant-scoped queries
-- Deduplication occurs on the full ORDER BY key during merges
ORDER BY (timestamp, scope_type, scope_name, user, audit_id)

-- Move parts to cold S3-backed volume after 90 days
TTL timestamp + INTERVAL 90 DAY TO VOLUME 'cold'

SETTINGS
    storage_policy = 'hot_cold',
    ttl_only_drop_parts = 1;

-- ============================================================================
-- Step 3: Add Platform Query Projection
-- ============================================================================
-- This projection is optimized for platform-wide queries that filter by
-- timestamp, api_group, and resource (common for cross-tenant analytics).
--
-- Sort order: (timestamp, api_group, resource, audit_id)
-- Use cases:
--   - "All events for 'apps' API group and 'deployments' resource in last 24 hours"
--   - "All events for core API 'pods' resource"
--   - Platform-wide verb/resource filtering
--

ALTER TABLE audit.events
ADD PROJECTION platform_query_projection
(
    SELECT *
    ORDER BY (timestamp, api_group, resource, audit_id)
);

-- ============================================================================
-- Step 4: Add User Query Projection
-- ============================================================================
-- This projection is optimized for user-specific queries within time ranges.
--
-- Sort order: (timestamp, user, api_group, resource)
-- Use cases:
--   - "What did alice@example.com do in the last 24 hours?"
--   - "All events by system:serviceaccount:kube-system:default"
--   - User-specific verb/resource filtering
--
-- ClickHouse automatically chooses the best projection for each query based
-- on the WHERE clause filters.

ALTER TABLE audit.events
ADD PROJECTION user_query_projection
(
    SELECT *
    ORDER BY (timestamp, user, api_group, resource)
);
