-- Migration: 001_initial_schema
-- Description: High-volume multi-tenant audit events table with HA replication
-- and projections for platform-wide querying and user-specific querying.
-- Author: Scot Wells <swells@datum.net>
-- Date: 2025-12-11
-- Updated: 2026-01-15 - Added HA replication support with ReplicatedReplacingMergeTree
-- Updated: 2026-01-16 - Use Replicated database engine for automatic DDL replication

-- ============================================================================
-- Step 1: Create Replicated Database
-- ============================================================================
-- The Replicated database engine automatically replicates all DDL operations
-- across all replicas in the cluster. This ensures schema consistency without
-- requiring ON CLUSTER clauses.
--
-- UUID ensures the database has the same identifier on all replicas
-- Path: /clickhouse/activity/databases/audit in ClickHouse Keeper
-- Macros: {shard} and {replica} are automatically substituted by ClickHouse
CREATE DATABASE IF NOT EXISTS audit ON CLUSTER 'activity'
ENGINE = Replicated('/clickhouse/activity/databases/audit', '{shard}', '{replica}');

-- ============================================================================
-- Step 2: Create Schema Migrations Tracking Table
-- ============================================================================
-- This table tracks which migrations have been applied to prevent re-running
-- them. Each migration records its version, name, application timestamp, and
-- checksum for integrity verification.
CREATE TABLE IF NOT EXISTS audit.schema_migrations
(
    version UInt32,
    name String,
    applied_at DateTime64(3) DEFAULT now64(3),
    checksum String
) ENGINE = ReplicatedReplacingMergeTree()
ORDER BY version
SETTINGS
    -- No special storage policy needed for this small metadata table
    storage_policy = 'default';

-- ============================================================================
-- Step 3: Create Events Table
-- ============================================================================
-- Replicated database automatically replicates table DDL - no need for ON CLUSTER
CREATE TABLE IF NOT EXISTS audit.events
(
    -- Raw audit event JSON
    event_json String CODEC(ZSTD(3)),

    -- Core timestamp (always queried)
    -- Uses requestReceivedTimestamp which represents when the API server received the request.
    timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'requestReceivedTimestamp')),
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

    user_uid String MATERIALIZED
        coalesce(
            JSONExtractString(event_json, 'user', 'uid'),
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
    INDEX idx_user_uid_bloom      user_uid              TYPE bloom_filter(0.001) GRANULARITY 1,

    -- Set indexes for low-cardinality columns
    INDEX idx_status_code_set status_code TYPE set(100) GRANULARITY 4,
    -- Minmax index for status_code range queries
    INDEX idx_status_code_minmax status_code TYPE minmax GRANULARITY 4,
)
-- ==================================================================
-- TABLE ENGINE CONFIGURATION (High Availability)
-- ==================================================================
-- ReplicatedReplacingMergeTree provides:
-- - Deduplication based on ORDER BY key during merges
-- - Eventual consistency with quorum writes (configured via settings)
-- - Data replication to other database replicas
--
-- Replication Behavior:
-- - INSERT on any replica replicates to all replicas via Keeper (database-level)
-- - Quorum writes ensure 2/3 replicas acknowledge before success
-- - Deduplication happens during background merges
ENGINE = ReplicatedReplacingMergeTree
PARTITION BY toYYYYMMDD(timestamp)
-- Primary key optimized for tenant-scoped queries with hour bucketing
-- Hour bucketing provides data locality while timestamp ensures strict chronological order
-- Timestamp as second key ensures events are always returned in time order for audit compliance
-- Deduplication occurs on the full ORDER BY key during merges
ORDER BY (toStartOfHour(timestamp), timestamp, scope_type, scope_name, user, audit_id)
PRIMARY KEY (toStartOfHour(timestamp), timestamp, scope_type, scope_name, user, audit_id)

-- Move parts to cold S3-backed volume after 90 days
TTL timestamp + INTERVAL 90 DAY TO VOLUME 'cold'

SETTINGS
    storage_policy = 'hot_cold',
    ttl_only_drop_parts = 1,
    deduplicate_merge_projection_mode = 'rebuild';

-- ============================================================================
-- Step 4: Add Platform Query Projection
-- ============================================================================
-- This projection is optimized for platform-wide queries that filter by
-- timestamp, api_group, and resource (common for cross-tenant analytics).
--
-- Sort order: (toStartOfHour(timestamp), timestamp, api_group, resource, audit_id)
-- Use cases:
--   - "All events for 'apps' API group and 'deployments' resource in last 24 hours"
--   - "All events for core API 'pods' resource"
--   - Platform-wide verb/resource filtering
--
-- Hour bucketing provides index efficiency while timestamp ensures strict chronological order.
-- Timestamp as second key ensures events are always returned in time order for audit compliance.

ALTER TABLE audit.events
ADD PROJECTION platform_query_projection
(
    SELECT *
    ORDER BY (toStartOfHour(timestamp), timestamp, api_group, resource, audit_id)
);

-- ============================================================================
-- Step 5: Add User Query Projection
-- ============================================================================
-- This projection is optimized for username-based queries within time ranges.
--
-- Sort order: (toStartOfHour(timestamp), timestamp, user, api_group, resource, audit_id)
-- Use cases:
--   - "What did alice@example.com do in the last 24 hours?"
--   - "All events by system:serviceaccount:kube-system:default"
--   - Platform admin filtering by username in CEL expressions
--
-- Hour bucketing provides index efficiency while timestamp ensures strict chronological order.
-- Timestamp as second key ensures events are always returned in time order for audit compliance.
-- ClickHouse automatically chooses the best projection for each query based
-- on the WHERE clause filters.

ALTER TABLE audit.events
ADD PROJECTION user_query_projection
(
    SELECT *
    ORDER BY (toStartOfHour(timestamp), timestamp, user, api_group, resource, audit_id)
);

-- ============================================================================
-- Step 6: Add User UID Query Projection
-- ============================================================================
-- This projection is optimized for user-scoped queries by UID.
--
-- Sort order: (toStartOfHour(timestamp), timestamp, user_uid, api_group, resource, audit_id)
-- Use cases:
--   - User-scoped queries: "Show all activity by user with UID abc-123"
--   - Cross-organization user activity tracking
--   - User-specific audit trail regardless of username changes
--
-- This projection is used when scope.type == "user" to filter by user_uid
-- instead of scope_name, enabling queries for a user's activity across all
-- organizations and projects on the platform.
--
-- Hour bucketing provides index efficiency while timestamp ensures strict chronological order.
-- Timestamp as second key ensures events are always returned in time order for audit compliance.

ALTER TABLE audit.events
ADD PROJECTION user_uid_query_projection
(
    SELECT *
    ORDER BY (toStartOfHour(timestamp), timestamp, user_uid, api_group, resource, audit_id)
);
