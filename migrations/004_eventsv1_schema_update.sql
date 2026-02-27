-- Migration: 004_eventsv1_schema_update
-- Description: Updates k8s_events table schema to support events.k8s.io/v1 Event format.
-- This migration updates MATERIALIZED column expressions and adds new columns for
-- the events.k8s.io/v1 Event structure.
-- Author: Claude Code
-- Date: 2026-02-23

-- ============================================================================
-- events.k8s.io/v1 Event Model
-- ============================================================================
-- Key differences from core/v1:
--   - eventTime (MicroTime, required) - when event was first observed
--   - series (optional object) - for repeated events:
--       - series.count (int32) - number of occurrences
--       - series.lastObservedTime (MicroTime) - time of last occurrence
--   - regarding (ObjectReference) - replaces involvedObject
--   - related (optional ObjectReference) - secondary object
--   - note (string) - replaces message
--   - action (string, required) - what action was taken
--   - reportingController - replaces source.component
--   - reportingInstance - replaces source.host
--   - Deprecated* fields for backward compat with core/v1

-- ============================================================================
-- Add new columns for events.k8s.io/v1 fields
-- ============================================================================

-- Action field (required in v1, describes what action was taken)
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS action LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'action'), '');

-- Series count (null/0 for singleton events)
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS series_count Int32 MATERIALIZED
        coalesce(JSONExtractInt(event_json, 'series', 'count'), 0);

-- Series last observed time (for repeated events, defaults to eventTime for singleton events)
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS series_last_observed DateTime64(6) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'series', 'lastObservedTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedLastTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        );

-- Is this a singleton event (no series) or part of a series?
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS is_series Bool MATERIALIZED
        JSONHas(event_json, 'series');

-- Related object (optional secondary object in v1)
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS related_api_version LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'apiVersion'), '');

ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS related_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'kind'), '');

ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS related_namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'namespace'), '');

ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS related_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'related', 'name'), '');

-- ============================================================================
-- Update timestamp fields for events.k8s.io/v1
-- ============================================================================
-- eventTime is required and uses MicroTime (microsecond precision)
-- series.lastObservedTime is for repeated events

-- Event time (required in v1, microsecond precision, with fallbacks for compatibility)
ALTER TABLE audit.k8s_events
    ADD COLUMN IF NOT EXISTS event_time DateTime64(6) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedFirstTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        );

-- Update first_timestamp to use eventTime as primary source
ALTER TABLE audit.k8s_events
    MODIFY COLUMN first_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedFirstTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        );

-- Update last_timestamp to use series.lastObservedTime as primary source
ALTER TABLE audit.k8s_events
    MODIFY COLUMN last_timestamp DateTime64(3) MATERIALIZED
        coalesce(
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'series', 'lastObservedTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'deprecatedLastTimestamp')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'eventTime')),
            parseDateTime64BestEffortOrNull(JSONExtractString(event_json, 'metadata', 'creationTimestamp'))
        );

-- ============================================================================
-- Update involved object fields (involvedObject -> regarding)
-- ============================================================================

-- API group extracted from regarding.apiVersion (e.g., "apps/v1" -> "apps", "v1" -> "")
ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_api_group LowCardinality(String) MATERIALIZED
        if(
            position(JSONExtractString(event_json, 'regarding', 'apiVersion'), '/') > 0,
            splitByChar('/', JSONExtractString(event_json, 'regarding', 'apiVersion'))[1],
            ''
        );

ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_api_version LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'apiVersion'), '');

ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_kind LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'kind'), '');

ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_namespace LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'namespace'), '');

ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_name String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'name'), '');

ALTER TABLE audit.k8s_events
    MODIFY COLUMN involved_uid String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'regarding', 'uid'), '');

-- ============================================================================
-- Update source fields (source.* -> reportingController/reportingInstance)
-- ============================================================================

ALTER TABLE audit.k8s_events
    MODIFY COLUMN source_component LowCardinality(String) MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reportingController'), '');

ALTER TABLE audit.k8s_events
    MODIFY COLUMN source_host String MATERIALIZED
        coalesce(JSONExtractString(event_json, 'reportingInstance'), '');

-- ============================================================================
-- Add indexes for new columns
-- ============================================================================

ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_action_set action TYPE set(100) GRANULARITY 4;

ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_is_series_set is_series TYPE set(2) GRANULARITY 4;

ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_event_time_minmax event_time TYPE minmax GRANULARITY 4;

ALTER TABLE audit.k8s_events
    ADD INDEX IF NOT EXISTS idx_series_last_observed_minmax series_last_observed TYPE minmax GRANULARITY 4;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The table schema now fully supports events.k8s.io/v1 Event format:
--   - eventTime with microsecond precision
--   - series.count and series.lastObservedTime for repeated events
--   - action field for describing what happened
--   - regarding (renamed from involvedObject)
--   - related (optional secondary object)
--   - reportingController/reportingInstance (renamed from source.*)
--
-- Column names for involved object remain unchanged for query compatibility.
-- New columns added for v1-specific fields (action, series_*, event_time, related_*).
