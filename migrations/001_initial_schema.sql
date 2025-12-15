-- Migration: 001_initial_schema
-- Description: High-volume multi-tenant audit events table
-- Author: Scot Wells <swells@datum.net>
-- Date: 2025-12-11
-- Strategy: Simplified scope-based partitioning with hash-based distribution

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

    stage LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'stage'), ''),

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

    -- Simple bucketing to spread parts/merges
    bucket UInt8 MATERIALIZED (cityHash64(audit_id) % 16),

    -- Minimal skip indexes
    INDEX bf_user         user                      TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX bf_scope        (scope_type, scope_name)  TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX bf_audit_id     audit_id                  TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX bf_api_resource (api_group, resource)     TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY (toYYYYMM(timestamp), bucket)
ORDER BY (timestamp, scope_type, scope_name, user, audit_id, stage)

-- Move parts to cold S3-backed volume after 90 days
TTL timestamp + INTERVAL 90 DAY TO VOLUME 'cold'

SETTINGS
    storage_policy = 'hot_cold',
    ttl_only_drop_parts = 1;
