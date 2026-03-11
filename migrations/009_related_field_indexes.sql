-- Migration: 009_related_field_indexes
-- Description: Add skip indexes for related_* columns in k8s_events table to support
-- efficient filtering by the optional secondary object reference.
-- These indexes match the patterns used for regarding_* columns.
-- Author: Activity System
-- Date: 2026-03-11

-- Bloom filter for related_name (high-cardinality String column)
ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_related_name_bloom related_name TYPE bloom_filter(0.01) GRANULARITY 1;

-- Set index for related_kind (low-cardinality LowCardinality(String))
ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_related_kind_set related_kind TYPE set(50) GRANULARITY 4;

-- Set index for related_namespace (medium-cardinality LowCardinality(String))
ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_related_namespace_set related_namespace TYPE set(100) GRANULARITY 4;

-- Set index for related_api_version (low-cardinality LowCardinality(String))
ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_related_api_version_set related_api_version TYPE set(50) GRANULARITY 4;

-- Materialize the indexes for existing data
ALTER TABLE audit.k8s_events MATERIALIZE INDEX idx_related_name_bloom;
ALTER TABLE audit.k8s_events MATERIALIZE INDEX idx_related_kind_set;
ALTER TABLE audit.k8s_events MATERIALIZE INDEX idx_related_namespace_set;
ALTER TABLE audit.k8s_events MATERIALIZE INDEX idx_related_api_version_set;
