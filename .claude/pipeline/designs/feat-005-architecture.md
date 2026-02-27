---
id: feat-005
title: Event Re-indexing After Policy Updates
status: reviewed
created: 2026-02-26
updated: 2026-02-27
author: architect
reviewed_by: code-reviewer
---

# Event Re-indexing After Policy Updates

## Overview

This feature enables operators to regenerate activities from historical audit logs and Kubernetes events after updating ActivityPolicy resources. This addresses three primary use cases: fixing policy bugs, adding retroactive coverage for new policies, and refining policy summaries.

**Key Design Points:**
- Queries from **both** `audit.audit_logs` (API audit logs) and `audit.k8s_events` (Kubernetes Events)
- Uses ClickHouse's ReplacingMergeTree with a `reindex_version` column to ensure newer activities overwrite older ones
- Introduces a `ReindexJob` API resource (etcd-backed, following ActivityPolicy pattern) for operator-initiated batch re-indexing with progress tracking
- Requires schema migration to recreate the activities table with `origin_id` in the ORDER BY key

## Requirements

### Functional Requirements

- FR1: Operators can trigger re-indexing for a specific time range via CLI command
- FR2: Re-indexing applies current ActivityPolicy rules to historical events from ClickHouse
- FR3: Re-indexed activities overwrite existing activities via ClickHouse deduplication (same `origin_id`)
- FR4: System handles tens of thousands of events without impacting real-time processing
- FR5: Progress visibility through metrics and logging
- FR6: Schema migration changes activities table ORDER BY to use `origin_id` for proper deduplication

### Non-Functional Requirements

- NFR1: Re-indexing runs as a batch job, not real-time processing
- NFR2: Rate limiting prevents overwhelming ClickHouse or blocking real-time queries
- NFR3: Re-indexing is idempotent (can be safely retried)
- NFR4: Clear error messages for failed re-indexing operations
- NFR5: Re-indexing does not require downtime or service restarts

## Design

### Schema Migration

#### Current State

The activities table uses this schema (from `migrations/002_activities_table.sql`):

```sql
ENGINE = ReplicatedReplacingMergeTree
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (tenant_type, tenant_name, timestamp, resource_uid)
PRIMARY KEY (tenant_type, tenant_name, timestamp, resource_uid)
```

**Problem:** The ORDER BY key uses `resource_uid` (the affected resource), which doesn't guarantee uniqueness per source event. A single audit log can produce multiple activities with different resource_uid values if the policy generates multiple activity records.

#### Target State

Change ORDER BY to use `origin_id` and add a version column for deterministic deduplication:

```sql
ENGINE = ReplicatedReplacingMergeTree(reindex_version)
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (tenant_type, tenant_name, timestamp, origin_id)
PRIMARY KEY (tenant_type, tenant_name, timestamp, origin_id)
```

**Why:**
- `origin_id` uniquely identifies the source audit log or event. When re-indexing inserts a new activity with the same `(tenant_type, tenant_name, timestamp, origin_id)`, ClickHouse's background merge automatically deduplicates.
- `reindex_version` (DateTime64) ensures the **newest row always wins** during deduplication. Without a version column, ClickHouse may keep an arbitrary row, which could be the old activity instead of the re-indexed one.

**Important Notes on origin_id:**
- For audit logs: `origin_id` = `audit.AuditID` (unique per audit event)
- For Kubernetes Events: `origin_id` = `event.metadata.uid` (unique per Event resource, but the same Event may be updated multiple times with incremented `count` and updated `lastTimestamp`)

**⚠️ WARNING - Kubernetes Event Limitation:**

When a K8s Event is updated (e.g., `count` incremented), it retains the same UID. Re-indexing will deduplicate to the **latest** activity generated from that Event UID. This means:

1. If an Event fired 5 times (count=5), re-indexing produces ONE activity (not 5)
2. The activity reflects the Event's final state at re-index time
3. Historical activity occurrences from earlier Event states are lost

**Mitigation:** If you need to preserve activities from earlier Event occurrences, scope re-indexing to audit logs only via `spec.policySelector`.

#### Migration Strategy

**File:** `migrations/005_activities_reindex_support.sql`

**Important:** ClickHouse's `ALTER TABLE MODIFY ORDER BY` only supports adding columns to the end of the key or using a prefix. It does NOT support replacing the last column (`resource_uid` → `origin_id`). Therefore, we must recreate the table with the new schema.

```sql
-- Migration: 005_activities_reindex_support
-- Description: Recreate activities table with origin_id in ORDER BY and version column for deduplication
-- Author: Activity System
-- Date: 2026-02-26
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

    -- Skip Indexes (same as original)
    INDEX idx_api_group api_group TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_actor_name actor_name TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_actor_uid actor_uid TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_resource resource_kind TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_resource_name resource_name TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_resource_uid resource_uid TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_change_source change_source TYPE set(10) GRANULARITY 4,
    INDEX idx_summary_search summary TYPE text(tokenizer = ngrams(3)) GRANULARITY 1,

    -- Updated projections with origin_id
    PROJECTION api_group_query_projection
    (
        SELECT *
        ORDER BY (api_group, timestamp, tenant_type, tenant_name, origin_id)
    ),

    PROJECTION actor_query_projection
    (
        SELECT *
        ORDER BY (actor_name, timestamp, tenant_type, tenant_name, origin_id)
    )
)
ENGINE = ReplicatedReplacingMergeTree(reindex_version)
PARTITION BY toYYYYMMDD(timestamp)
-- Updated ORDER BY with origin_id for deduplication
ORDER BY (tenant_type, tenant_name, timestamp, origin_id)
PRIMARY KEY (tenant_type, tenant_name, timestamp, origin_id)

TTL timestamp + INTERVAL 60 DAY DELETE

SETTINGS
    storage_policy = 'default',
    ttl_only_drop_parts = 1,
    deduplicate_merge_projection_mode = 'rebuild';
```

**CRITICAL: Migration Prerequisites and Sequencing**

The migration drops existing activities. You MUST have ReindexJob available to regenerate them.

**Correct deployment sequence:**
1. Deploy activity-apiserver with ReindexJob storage (Phase 3 complete)
2. Deploy controller-manager with ReindexJob controller
3. Verify API availability: `kubectl api-resources | grep reindexjob`
4. Run migration (drops activities table, recreates with new schema)
5. Create ReindexJob to backfill activities from audit_logs and k8s_events

**Pre-flight check before migration:**
```bash
# Verify ReindexJob API is registered
kubectl api-resources --api-group=activity.miloapis.com | grep -i reindexjob
# Expected output: reindexjobs ... activity.miloapis.com/v1alpha1 true ReindexJob

# Test creating a dry-run ReindexJob
kubectl apply --dry-run=server -f - <<EOF
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: test-api-check
spec:
  timeRange:
    startTime: "2026-02-26T00:00:00Z"
  config:
    dryRun: true
EOF
```

**What happens if migration runs first:**
- Activities are dropped, source data (audit_logs, k8s_events) retained
- Operators cannot regenerate activities until ReindexJob is deployed
- Not catastrophic (data is safe), but creates an availability gap

**Migration Execution:**
1. Deploy activity-apiserver with ReindexJob storage and controller first (so re-indexing is available)
2. Run migration on staging
3. Verify table schema: `SELECT name, sorting_key, engine_full FROM system.tables WHERE name = 'activities'`
4. Create ReindexJob to regenerate activities for desired time range
5. Run migration on production
6. Create ReindexJob to backfill production activities (up to 60-day retention window)

**Post-Migration:** New activities are generated by the real-time processor as usual. Historical activities can be backfilled using ReindexJob.

**Impact Analysis:**

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **Data Loss** | Existing activities dropped | Regenerate via ReindexJob (source data retained in audit_logs/k8s_events) |
| **Query Performance** | Unchanged - same primary key prefix | None needed |
| **Downtime** | Brief - DROP + CREATE | Schedule during maintenance window |
| **New Column** | `reindex_version` added for version tracking | Default value ensures existing inserts work unchanged |

**Migration Validation:**

```sql
-- Verify schema
SELECT name, sorting_key, engine_full
FROM system.tables
WHERE database = 'audit' AND name = 'activities';

-- Expected output:
-- sorting_key: tenant_type, tenant_name, timestamp, origin_id
-- engine_full: ReplicatedReplacingMergeTree(..., reindex_version)

-- Verify deduplication is working (test with duplicate insert)
INSERT INTO audit.activities (activity_json) VALUES ('{"spec":{"origin":{"id":"test-123"},"tenant":{"type":"platform","name":""}}, "metadata":{"creationTimestamp":"2026-02-27T00:00:00Z"}}');
INSERT INTO audit.activities (activity_json) VALUES ('{"spec":{"origin":{"id":"test-123"},"tenant":{"type":"platform","name":""}}, "metadata":{"creationTimestamp":"2026-02-27T00:00:00Z"}}');

OPTIMIZE TABLE audit.activities FINAL;

SELECT origin_id, COUNT(*) as count
FROM audit.activities
WHERE origin_id = 'test-123'
GROUP BY origin_id;

-- Should return count = 1 (deduplicated)

-- Clean up test data
ALTER TABLE audit.activities DELETE WHERE origin_id = 'test-123';
```

### ReindexJob API Resource

#### etcd-Backed Storage (Aggregated API Server)

Add new API resource `ReindexJob` to `activity.miloapis.com/v1alpha1` using etcd storage, following the same pattern as ActivityPolicy.

**Why etcd storage instead of CRD:**
- The activity-apiserver is an aggregated API server - it doesn't use CRDs
- ReindexJob needs to be served alongside other activity.miloapis.com resources
- Follows the existing ActivityPolicy pattern for consistency
- Enables server-side validation, status subresources, and table formatting

**Scoping Decision: Cluster-scoped**

ReindexJob is **cluster-scoped** (like ActivityPolicy) because:
- Multi-tenancy is handled at the control plane level - each tenant has their own control plane
- Namespace-scoping provides no benefit since there's only one activity-system per control plane
- Consistent with ActivityPolicy (both are cluster-scoped configuration resources)
- Simpler RBAC model - no need to manage namespace-level permissions

**Implementation Pattern (following ActivityPolicy):**

```
internal/registry/activity/
├── policy/                           # Existing: ActivityPolicy (cluster-scoped)
│   ├── storage.go                    # etcd storage using genericregistry.Store
│   └── strategy.go                   # CRUD strategy (validation, defaults)
├── reindexjob/                       # NEW: ReindexJob (cluster-scoped)
│   ├── storage.go                    # etcd storage
│   └── strategy.go                   # CRUD strategy
```

**Key Files to Reference:**
- `internal/registry/activity/policy/storage.go` - Storage pattern template
- `internal/registry/activity/policy/strategy.go` - Strategy pattern template
- `pkg/apis/activity/v1alpha1/types_activitypolicy.go` - Versioned types pattern
- `pkg/apis/activity/types.go` - Internal types (simpler, no kubebuilder annotations)

**Registration in apiserver.go:**

```go
// ReindexJob is stored in etcd (cluster-scoped)
reindexJobStorage, reindexJobStatusStorage, err := reindexjob.NewStorage(Scheme, c.GenericConfig.RESTOptionsGetter)
if err != nil {
    return nil, fmt.Errorf("failed to create ReindexJob storage: %w", err)
}
v1alpha1Storage["reindexjobs"] = reindexJobStorage
v1alpha1Storage["reindexjobs/status"] = reindexJobStatusStorage
```

**Resource Definition:**

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: fix-httpproxy-policy-2026-02-27
spec:
  # Time range for re-indexing (required)
  timeRange:
    # Start time in RFC3339 format
    startTime: "2026-02-25T00:00:00Z"
    # End time in RFC3339 format (defaults to now if omitted)
    endTime: "2026-02-27T00:00:00Z"

  # Optional: Scope to specific policies (omit for all policies)
  policySelector:
    # Match by name
    names:
      - httpproxy-policy
    # OR match by labels
    matchLabels:
      service: networking

  # Optional: Processing configuration
  config:
    # Events per batch (default: 1000)
    batchSize: 1000
    # Max events per second (default: 100)
    rateLimit: 100
    # Dry-run mode - preview without writing (default: false)
    dryRun: false

status:
  # Current phase: Pending, Running, Succeeded, Failed
  phase: Running

  # Human-readable message
  message: "Processing audit logs: 45% complete"

  # Detailed progress
  progress:
    # Total events to process (estimated)
    totalEvents: 15650
    # Events processed so far
    processedEvents: 7042
    # Activities generated
    activitiesGenerated: 1823
    # Errors encountered
    errors: 0
    # Current batch number
    currentBatch: 8
    # Total batches (estimated)
    totalBatches: 16

  # Timing information
  startedAt: "2026-02-27T02:15:00Z"
  completedAt: null

  # Conditions for detailed status
  conditions:
    - type: Ready
      status: "False"
      reason: "InProgress"
      message: "Re-indexing in progress"
      lastTransitionTime: "2026-02-27T02:15:00Z"
    - type: AuditLogsProcessed
      status: "False"
      reason: "Processing"
      message: "Processing batch 8 of 10"
      lastTransitionTime: "2026-02-27T02:18:00Z"
    - type: EventsProcessed
      status: "False"
      reason: "Pending"
      message: "Waiting for audit log processing to complete"
      lastTransitionTime: "2026-02-27T02:15:00Z"
```

#### Go Type Definitions

```go
// pkg/apis/activity/v1alpha1/types_reindexjob.go

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// ReindexJob triggers re-processing of historical audit logs and events through
// current ActivityPolicy rules. Use this to fix policy bugs retroactively, add
// coverage for new policies, or refine activity summaries after policy improvements.
//
// ReindexJob is a one-shot resource: once completed or failed, it cannot be
// re-run. Create a new ReindexJob for subsequent re-indexing operations.
//
// KUBERNETES EVENT LIMITATION:
//
// When a Kubernetes Event is updated (e.g., count incremented from 1 to 5),
// it retains the same UID. Re-indexing will produce ONE activity per Event UID,
// reflecting the Event's final state. Historical activity occurrences from earlier
// Event states are lost.
//
// Example: Event "pod-oom" fires 5 times (count=5) → Re-indexing produces 1 activity (not 5)
//
// Mitigation: Scope re-indexing to audit logs only via spec.policySelector to
// preserve activities from earlier Event occurrences.
//
// Example:
//
//   kubectl apply -f - <<EOF
//   apiVersion: activity.miloapis.com/v1alpha1
//   kind: ReindexJob
//   metadata:
//     name: fix-policy-bug-2026-02-27
//     namespace: activity-system
//   spec:
//     timeRange:
//       startTime: "2026-02-25T00:00:00Z"
//     policySelector:
//       names: ["httpproxy-policy"]
//   EOF
//
//   kubectl get reindexjobs -w  # Watch progress
type ReindexJob struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`

    Spec   ReindexJobSpec   `json:"spec"`
    Status ReindexJobStatus `json:"status,omitempty"`
}

// ReindexJobSpec defines the parameters for a re-indexing operation.
type ReindexJobSpec struct {
    // TimeRange specifies the time window of events to re-index.
    // Events outside this range are not processed.
    //
    // +required
    TimeRange ReindexTimeRange `json:"timeRange"`

    // PolicySelector optionally limits re-indexing to specific policies.
    // If omitted, all active ActivityPolicies are evaluated.
    //
    // +optional
    PolicySelector *ReindexPolicySelector `json:"policySelector,omitempty"`

    // Config contains processing configuration options.
    //
    // +optional
    Config *ReindexConfig `json:"config,omitempty"`

    // TTLSecondsAfterFinished specifies how long to retain the ReindexJob
    // after it completes (Succeeded or Failed). After this duration, the
    // controller automatically deletes the resource. If not set, the job
    // is retained indefinitely until manually deleted.
    //
    // +optional
    // +kubebuilder:validation:Minimum=0
    TTLSecondsAfterFinished *int32 `json:"ttlSecondsAfterFinished,omitempty"`
}

// ReindexTimeRange specifies the time window for re-indexing.
type ReindexTimeRange struct {
    // StartTime is the beginning of the time range (inclusive).
    // Must be within the ClickHouse retention window (60 days).
    //
    // +required
    StartTime metav1.Time `json:"startTime"`

    // EndTime is the end of the time range (exclusive).
    // Defaults to the current time if omitted.
    //
    // +optional
    EndTime *metav1.Time `json:"endTime,omitempty"`
}

// ReindexPolicySelector specifies which policies to include in re-indexing.
type ReindexPolicySelector struct {
    // Names is a list of ActivityPolicy names to include.
    // Mutually exclusive with MatchLabels.
    //
    // +optional
    Names []string `json:"names,omitempty"`

    // MatchLabels selects policies by label.
    // Mutually exclusive with Names.
    //
    // +optional
    MatchLabels map[string]string `json:"matchLabels,omitempty"`
}

// ReindexConfig contains processing configuration options.
type ReindexConfig struct {
    // BatchSize is the number of events to process per batch.
    // Larger batches are faster but use more memory.
    // Default: 1000
    //
    // +optional
    // +kubebuilder:default=1000
    // +kubebuilder:validation:Minimum=100
    // +kubebuilder:validation:Maximum=10000
    BatchSize int32 `json:"batchSize,omitempty"`

    // RateLimit is the maximum events per second to process.
    // Prevents overwhelming ClickHouse.
    // Default: 100
    //
    // +optional
    // +kubebuilder:default=100
    // +kubebuilder:validation:Minimum=10
    // +kubebuilder:validation:Maximum=1000
    RateLimit int32 `json:"rateLimit,omitempty"`

    // DryRun previews changes without writing activities.
    // Useful for estimating impact before execution.
    // Default: false
    //
    // +optional
    DryRun bool `json:"dryRun,omitempty"`
}

// ReindexJobStatus represents the current state of a ReindexJob.
type ReindexJobStatus struct {
    // Phase is the current lifecycle phase.
    // Values: Pending, Running, Succeeded, Failed
    //
    // +optional
    Phase ReindexJobPhase `json:"phase,omitempty"`

    // Message is a human-readable description of the current state.
    //
    // +optional
    Message string `json:"message,omitempty"`

    // Progress contains detailed progress information.
    //
    // +optional
    Progress *ReindexProgress `json:"progress,omitempty"`

    // StartedAt is when processing began.
    //
    // +optional
    StartedAt *metav1.Time `json:"startedAt,omitempty"`

    // CompletedAt is when processing finished (success or failure).
    //
    // +optional
    CompletedAt *metav1.Time `json:"completedAt,omitempty"`

    // Conditions represent the latest observations of the job's state.
    //
    // +optional
    // +listType=map
    // +listMapKey=type
    Conditions []metav1.Condition `json:"conditions,omitempty"`
}

// ReindexJobPhase represents the lifecycle phase of a ReindexJob.
type ReindexJobPhase string

const (
    ReindexJobPending   ReindexJobPhase = "Pending"
    ReindexJobRunning   ReindexJobPhase = "Running"
    ReindexJobSucceeded ReindexJobPhase = "Succeeded"
    ReindexJobFailed    ReindexJobPhase = "Failed"
)

// ReindexProgress contains detailed progress metrics.
type ReindexProgress struct {
    // TotalEvents is the estimated total events to process.
    TotalEvents int64 `json:"totalEvents,omitempty"`

    // ProcessedEvents is the number of events processed so far.
    ProcessedEvents int64 `json:"processedEvents,omitempty"`

    // ActivitiesGenerated is the number of activities created.
    ActivitiesGenerated int64 `json:"activitiesGenerated,omitempty"`

    // Errors is the count of non-fatal errors encountered.
    Errors int64 `json:"errors,omitempty"`

    // CurrentBatch is the batch number currently being processed.
    CurrentBatch int32 `json:"currentBatch,omitempty"`

    // TotalBatches is the estimated total number of batches.
    TotalBatches int32 `json:"totalBatches,omitempty"`
}
```

#### Usage Examples

**Fix a policy bug for the last 48 hours:**

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: fix-httpproxy-typo
spec:
  timeRange:
    startTime: "2026-02-25T00:00:00Z"
  policySelector:
    names: ["httpproxy-policy"]
  ttlSecondsAfterFinished: 3600  # Auto-delete 1 hour after completion
```

```bash
kubectl apply -f reindex-job.yaml
kubectl get reindexjobs -w  # Watch progress
```

**Dry-run to preview impact:**

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: preview-new-policy
spec:
  timeRange:
    startTime: "2026-02-20T00:00:00Z"
  policySelector:
    names: ["virtualmachine-policy"]
  config:
    dryRun: true
```

**Re-index all policies for a time range:**

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: full-reindex-2026-02-26
spec:
  timeRange:
    startTime: "2026-02-26T00:00:00Z"
    endTime: "2026-02-27T00:00:00Z"
  config:
    batchSize: 2000
    rateLimit: 200
```

### Component Architecture

#### Storage Implementation

Following the ActivityPolicy pattern, create etcd-backed storage for ReindexJob.

**Reference Implementation:** See `internal/registry/activity/policy/storage.go` and `internal/registry/activity/policy/strategy.go` for the complete pattern.

**Key files to create:**
- `internal/registry/activity/reindexjob/storage.go` - Follow policy/storage.go pattern exactly
- `internal/registry/activity/reindexjob/strategy.go` - Implement validation and defaults

**Storage pattern highlights:**
```go
// internal/registry/activity/reindexjob/storage.go
// Follow the exact pattern from policy/storage.go

// ReindexJobStorage implements rest.StandardStorage for ReindexJob
type ReindexJobStorage struct {
    *genericregistry.Store
}

// Same as ActivityPolicy: NamespaceScoped() returns FALSE
func (s reindexJobStrategy) NamespaceScoped() bool {
    return false  // ReindexJob is cluster-scoped, like ActivityPolicy
}
```

**Table formatting for kubectl output:**
```go
// ConvertToTable shows: NAME, PHASE, TIME_RANGE, PROGRESS, AGE
// Reference: policy/storage.go policyTableConvertor for pattern
```

#### Status Subresource Implementation

ReindexJob follows the exact pattern from ActivityPolicy for status updates:

**Files to create:**
- `internal/registry/activity/reindexjob/storage.go`:
  - `ReindexJobStorage` - main REST storage
  - `ReindexJobStatusStorage` - status subresource storage
- `internal/registry/activity/reindexjob/strategy.go`:
  - `reindexJobStrategy` - main CRUD strategy
  - `reindexJobStatusStrategy` - status-only strategy

**Key pattern (from `policy/storage.go`):**
```go
func NewStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*ReindexJobStorage, *ReindexJobStatusStorage, error) {
    strategy := NewStrategy(scheme)
    statusStrategy := NewStatusStrategy(scheme)

    store := &genericregistry.Store{
        NewFunc:                   func() runtime.Object { return &activity.ReindexJob{} },
        NewListFunc:               func() runtime.Object { return &activity.ReindexJobList{} },
        DefaultQualifiedResource:  v1alpha1.Resource("reindexjobs"),
        SingularQualifiedResource: v1alpha1.Resource("reindexjob"),
        CreateStrategy: strategy,
        UpdateStrategy: strategy,
        DeleteStrategy: strategy,
        TableConvertor: &reindexJobTableConvertor{},
    }

    // Status store uses statusStrategy
    statusStore := *store
    statusStore.UpdateStrategy = statusStrategy
    statusStore.ResetFieldsStrategy = statusStrategy

    return &ReindexJobStorage{store}, &ReindexJobStatusStorage{store: &statusStore}, nil
}
```

**GetResetFields** ensures spec cannot be modified through status subresource:
```go
func (s reindexJobStatusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
    return map[fieldpath.APIVersion]*fieldpath.Set{
        "activity.miloapis.com/v1alpha1": fieldpath.NewSet(
            fieldpath.MakePathOrDie("spec"),
        ),
    }
}
```

#### Validation Strategy

Following the ActivityPolicy pattern, validation is split between synchronous (API strategy) and asynchronous (controller):

**Strategy validation (sync, blocks API acceptance):**
- Required fields: `spec.timeRange.startTime`
- Time range logic: `startTime < endTime`, within ClickHouse retention window (60 days)
- Config bounds: `batchSize` (100-10000), `rateLimit` (10-1000)
- PolicySelector constraints: `names` and `matchLabels` are mutually exclusive
- Returns `field.ErrorList` - invalid resources are rejected by API server

**Controller validation (async, reported in status):**
- Policy existence: Verify policies in `policySelector.names` exist
- System readiness: ClickHouse and NATS connectivity
- Concurrency: Only one running job allowed
- Sets `status.phase = Pending` with reason if validation fails

**Implementation example:**
```go
// internal/registry/activity/reindexjob/strategy.go
func ValidateReindexJobSpec(spec *activity.ReindexJobSpec, path *field.Path) field.ErrorList {
    allErrs := field.ErrorList{}

    // Required: startTime
    if spec.TimeRange.StartTime.IsZero() {
        allErrs = append(allErrs, field.Required(path.Child("timeRange", "startTime"), ""))
    }

    // Time range logic
    endTime := spec.TimeRange.EndTime
    if endTime == nil {
        now := metav1.Now()
        endTime = &now
    }
    if !spec.TimeRange.StartTime.Before(endTime) {
        allErrs = append(allErrs, field.Invalid(path.Child("timeRange"), spec.TimeRange,
            "startTime must be before endTime"))
    }

    // Retention check (60 days)
    if time.Since(spec.TimeRange.StartTime.Time) > 60*24*time.Hour {
        allErrs = append(allErrs, field.Invalid(path.Child("timeRange", "startTime"),
            spec.TimeRange.StartTime, "startTime exceeds ClickHouse retention (60 days)"))
    }

    // PolicySelector: names and matchLabels are mutually exclusive
    if spec.PolicySelector != nil {
        if len(spec.PolicySelector.Names) > 0 && len(spec.PolicySelector.MatchLabels) > 0 {
            allErrs = append(allErrs, field.Invalid(path.Child("policySelector"),
                spec.PolicySelector, "names and matchLabels are mutually exclusive"))
        }
    }

    return allErrs
}
```

#### Controller Design

The `activity-controller-manager` will include a new controller for ReindexJob resources. The controller watches ReindexJob resources served by the aggregated API server (stored in etcd).

**Watch Strategy:**
- Primary watch: ReindexJob resources
- Optional: Watch ActivityPolicy to re-validate policy references in spec.policySelector when policies are deleted
  - This is similar to how activitypolicy_controller watches CRDs for re-reconciliation
  - For initial implementation, validation can be done at reconciliation time (simpler)
  - Future enhancement: Add watch on ActivityPolicy to detect deletions

**Reference Implementation:** Follow the pattern from `internal/controller/activitypolicy_controller.go`

#### Controller Client Access

The controller-manager accesses ReindexJob resources through the standard Kubernetes client, exactly like ActivityPolicy:

1. **In-cluster config**: Controller uses `ctrl.GetConfigOrDie()` to connect to the Kubernetes API server
2. **Transparent routing**: Kubernetes API server routes `activity.miloapis.com` requests to the aggregated API server via APIService
3. **Standard RBAC**: Controller's ServiceAccount needs permissions to the aggregated API:
   - `reindexjobs`: get, list, watch, update, patch
   - `reindexjobs/status`: update, patch
4. **No special configuration**: Works identically to existing ActivityPolicy controller

The aggregated API server's service (`activity-apiserver.activity-system.svc.cluster.local:443`) is automatically discovered through the APIService registration.

```
internal/controller/
├── activitypolicy_controller.go    # Existing
├── reindexjob_controller.go        # NEW: ReindexJob controller
└── reindexjob_worker.go            # NEW: Batch processing worker

internal/registry/activity/
├── policy/                         # Existing: ActivityPolicy
│   ├── storage.go
│   └── strategy.go
├── reindexjob/                     # NEW: ReindexJob
│   ├── storage.go                  # etcd storage
│   └── strategy.go                 # CRUD strategy
```

**Controller Responsibilities:**

1. **Watch** for new ReindexJob resources
2. **Validate** spec (time range within retention, policies exist)
3. **Execute** re-indexing in a goroutine with progress updates
4. **Update status** with progress, phase, conditions
5. **Emit events** for key milestones (started, completed, failed)

**Concurrency Control:**

- Only one ReindexJob can be `Running` at a time (prevents resource contention)
- Additional jobs queue in `Pending` state
- Optional: Add `spec.priority` for queue ordering

```go
// internal/controller/reindexjob_controller.go

type ReindexJobReconciler struct {
    client.Client
    Scheme          *runtime.Scheme
    ClickHouse      *storage.ClickHouseClient  // For reading source events
    JetStream       nats.JetStreamContext      // For publishing activities
    PolicyEvaluator *cel.Evaluator

    // Concurrency control - mutex protects runningJob to avoid race conditions
    runningJob      *types.NamespacedName
    mu              sync.Mutex
}

func (r *ReindexJobReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var job v1alpha1.ReindexJob
    if err := r.Get(ctx, req.NamespacedName, &job); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // Skip completed jobs
    if job.Status.Phase == v1alpha1.ReindexJobSucceeded ||
       job.Status.Phase == v1alpha1.ReindexJobFailed {
        return ctrl.Result{}, nil
    }

    // Check if another job is running (mutex-protected)
    r.mu.Lock()
    if r.runningJob != nil && *r.runningJob != req.NamespacedName {
        r.mu.Unlock()
        // Queue this job
        if job.Status.Phase != v1alpha1.ReindexJobPending {
            job.Status.Phase = v1alpha1.ReindexJobPending
            job.Status.Message = fmt.Sprintf("Waiting for %s to complete", r.runningJob)
            return ctrl.Result{}, r.Status().Update(ctx, &job)
        }
        return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
    }
    r.mu.Unlock()

    // Start or continue processing
    switch job.Status.Phase {
    case "", v1alpha1.ReindexJobPending:
        return r.startJob(ctx, &job)
    case v1alpha1.ReindexJobRunning:
        // Job already running, check progress
        return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
    }

    return ctrl.Result{}, nil
}

func (r *ReindexJobReconciler) startJob(ctx context.Context, job *v1alpha1.ReindexJob) (ctrl.Result, error) {
    // Claim the job slot under mutex protection
    r.mu.Lock()
    if r.runningJob != nil {
        r.mu.Unlock()
        // Another job claimed the slot, requeue
        return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
    }
    nn := types.NamespacedName{Name: job.Name, Namespace: job.Namespace}
    r.runningJob = &nn
    r.mu.Unlock()

    // Update status to Running
    job.Status.Phase = v1alpha1.ReindexJobRunning
    now := metav1.Now()
    job.Status.StartedAt = &now
    if err := r.Status().Update(ctx, job); err != nil {
        // Release the slot on error
        r.mu.Lock()
        r.runningJob = nil
        r.mu.Unlock()
        return ctrl.Result{}, err
    }

    // Start worker goroutine
    go r.runReindexWorker(context.Background(), job)

    return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
}
```

#### Optional: kubectl Plugin Wrapper

A thin kubectl plugin can wrap the API for convenience:

```bash
# Creates a ReindexJob resource and watches for completion
kubectl activity reindex --start-time now-48h --policy httpproxy-policy
```

This would:
1. Generate a ReindexJob manifest with unique name
2. `kubectl apply` the manifest
3. Watch the resource status until completion
4. Print progress updates

**Implementation:** Add to `cmd/kubectl-activity/reindex.go` - deferred for initial implementation.

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ReindexJob Controller Flow                       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Operator   │
└──────┬───────┘
       │
       │ kubectl apply -f reindexjob.yaml
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  activity-apiserver (aggregated API server)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ReindexJob resource stored in etcd                        │ │
│  │  - spec.timeRange, policySelector, config                  │ │
│  │  - status.phase = Pending                                  │ │
│  │  (NOT a CRD - stored in apiserver's etcd like ActivityPolicy)│ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       │
       │ Watch event
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  activity-controller-manager                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ReindexJob Controller                                     │ │
│  │  1. Validate spec (time range, policies exist)             │ │
│  │  2. Check concurrency (only 1 running at a time)           │ │
│  │  3. Start worker goroutine                                 │ │
│  │  4. Update status.phase = Running                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Reindex Worker (goroutine per job)                        │ │
│  │                                                            │ │
│  │  Loop:                                                     │ │
│  │    1. Query batch from ClickHouse (audit logs / events)   │ │
│  │    2. Evaluate ActivityPolicy rules                        │ │
│  │    3. Write activities to ClickHouse                       │ │
│  │    4. Update status.progress                               │ │
│  │    5. Rate limit wait                                      │ │
│  │                                                            │ │
│  │  On completion: status.phase = Succeeded                   │ │
│  │  On error: status.phase = Failed                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       │
       │ Status updates
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  kubectl get reindexjobs -w                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  NAME                  PHASE      PROGRESS   AGE           │ │
│  │  fix-httpproxy-typo    Running    45%        2m            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

Data Sources (ClickHouse):

┌──────────────────┐       ┌──────────────────┐
│ audit.audit_logs │       │ audit.k8s_events │
│                  │       │                  │
│ - API audit logs │       │ - K8s Events     │
│ - origin: audit  │       │ - origin: event  │
│ - 60 day TTL     │       │ - 60 day TTL     │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         └──────────┬───────────────┘
                    │
                    │ Query events in time range
                    │
                    ▼
         ┌─────────────────────┐
         │  Reindex Worker     │
         │  (in controller)    │
         └──────────┬──────────┘
                    │
                    │ Publish to ACTIVITIES_REINDEX stream
                    │ (separate from real-time ACTIVITIES)
                    │ (same origin_id as original)
                    ▼
         ┌───────────────────────────┐
         │  NATS JetStream           │
         │  ACTIVITIES_REINDEX stream│
         │  (activities.reindex.*)   │
         └──────────┬────────────────┘
                    │
                    │ Vector consumes
                    ▼
         ┌─────────────────────┐
         │  audit.activities   │
         │                     │
         │  ReplacingMergeTree │
         │  deduplicates on    │
         │  origin_id          │
         └─────────────────────┘
```

### Batch Processing Algorithm

The reindexer queries from **both** source tables:
- `audit.audit_logs` - API server audit logs (origin_type = "audit")
- `audit.k8s_events` - Kubernetes Events (origin_type = "event")

**Batch Processing Order:** Audit logs first, then K8s events (sequential, not interleaved by timestamp).

**Rationale:**
- Simpler implementation: two sequential loops
- No cross-table timestamp sorting (expensive in ClickHouse)
- Activities are immutable - insertion order doesn't affect queries
- Watch API doesn't see reindexed activities (separate stream)

#### Cursor-Based Pagination

Cursors use composite `(timestamp, id)` tuples for deterministic ordering:

**Audit logs cursor:**
```sql
WHERE timestamp >= ? AND timestamp < ?
  AND (timestamp, audit_id) > (?, ?)  -- cursor: (last_timestamp, last_audit_id)
ORDER BY timestamp, audit_id
LIMIT ?
```

**K8s events cursor:**
```sql
WHERE timestamp >= ? AND timestamp < ?
  AND (timestamp, event_uid) > (?, ?)  -- cursor: (last_timestamp, last_event_uid)
ORDER BY timestamp, event_uid
LIMIT ?
```

**Cursor encoding:**
- Base64-encoded JSON: `{"timestamp": "2026-02-27T...", "id": "abc123"}`
- Stored in controller's local state (not persisted in ReindexJob status)
- Resume from last cursor on controller restart: start from beginning (idempotent)

#### Progress Estimation

**Initial estimate** (at job start):
```sql
SELECT
  (SELECT count() FROM audit.audit_logs WHERE timestamp BETWEEN ? AND ?) +
  (SELECT count() FROM audit.k8s_events WHERE timestamp BETWEEN ? AND ?)
AS total_events
```

**Refinement** (after first batch):
- Use actual batch sizes to refine estimate
- If first batch returns 1000 events at 10% of time range → estimate ~10,000 total

**Why estimate is acceptable:**
- Exact count is expensive (scans full table)
- Estimate gives users rough completion time
- Progress percentage may adjust slightly as processing continues

```go
// Pseudocode for reindex logic (internal/reindex/reindexer.go)

func (r *Reindexer) Reindex(ctx context.Context, opts ReindexOptions) error {
    // 1. Initialize
    policies, err := r.fetchActivePolicies(ctx, opts.PolicyFilter)
    if err != nil {
        return fmt.Errorf("failed to fetch policies: %w", err)
    }

    // 2. Process audit logs from audit.audit_logs table
    auditCursor := ""
    totalProcessed := 0

    for {
        // Fetch batch from audit.audit_logs
        // Cursor format: (timestamp, audit_id) for deterministic pagination
        // Query: SELECT * FROM audit.audit_logs
        //        WHERE timestamp >= ? AND timestamp < ?
        //          AND (timestamp, audit_id) > (cursor_ts, cursor_id)
        //        ORDER BY timestamp, audit_id
        //        LIMIT ?
        auditBatch, nextAuditCursor, err := r.fetchAuditLogBatch(ctx, opts.StartTime, opts.EndTime, auditCursor, opts.BatchSize)
        if err != nil {
            return fmt.Errorf("failed to fetch audit logs: %w", err)
        }

        if len(auditBatch) == 0 {
            break
        }

        // Process audit batch - origin_id will be audit.AuditID
        activities, err := r.evaluateBatch(ctx, auditBatch, policies, "audit")
        if err != nil {
            return fmt.Errorf("failed to evaluate audit batch: %w", err)
        }

        // Publish activities to NATS (or skip if dry-run)
        if !opts.DryRun {
            if err := r.publishActivities(ctx, activities); err != nil {
                return fmt.Errorf("failed to publish activities: %w", err)
            }
        }

        totalProcessed += len(activities)
        r.updateProgress(totalProcessed, len(auditBatch), "audit")

        // Rate limiting
        r.rateLimiter.Wait(ctx, len(auditBatch))

        // Continue to next batch
        if nextAuditCursor == "" {
            break
        }
        auditCursor = nextAuditCursor
    }

    // 3. Process K8s events from audit.k8s_events table
    eventCursor := ""

    for {
        // Fetch batch from audit.k8s_events
        // Cursor format: (timestamp, event_uid) for deterministic pagination
        // Query: SELECT * FROM audit.k8s_events
        //        WHERE timestamp >= ? AND timestamp < ?
        //          AND (timestamp, event_uid) > (cursor_ts, cursor_uid)
        //        ORDER BY timestamp, event_uid
        //        LIMIT ?
        eventBatch, nextEventCursor, err := r.fetchEventBatch(ctx, opts.StartTime, opts.EndTime, eventCursor, opts.BatchSize)
        if err != nil {
            return fmt.Errorf("failed to fetch k8s events: %w", err)
        }

        if len(eventBatch) == 0 {
            break
        }

        // Process event batch - origin_id will be event.metadata.uid
        activities, err := r.evaluateBatch(ctx, eventBatch, policies, "event")
        if err != nil {
            return fmt.Errorf("failed to evaluate event batch: %w", err)
        }

        // Publish activities to NATS (or skip if dry-run)
        if !opts.DryRun {
            if err := r.publishActivities(ctx, activities); err != nil {
                return fmt.Errorf("failed to publish activities: %w", err)
            }
        }

        totalProcessed += len(activities)
        r.updateProgress(totalProcessed, len(eventBatch), "event")

        r.rateLimiter.Wait(ctx, len(eventBatch))

        if nextEventCursor == "" {
            break
        }
        eventCursor = nextEventCursor
    }

    return nil
}
```

**Key Design Points:**

1. **Cursor-based pagination**: Reuse existing ClickHouse query patterns from `internal/storage/clickhouse.go`
2. **Rate limiting**: Use `golang.org/x/time/rate` to limit query throughput
3. **Batch size tuning**: Default 1000 events/batch; adjustable via spec.config.batchSize
4. **Concurrency**: Process batches sequentially to avoid overwhelming ClickHouse (parallel workers for evaluation within batch)
5. **Status updates**: Update ReindexJob status after each batch with progress metrics
6. **Graceful shutdown**: Handle context cancellation for clean job termination

**Controller Integration:**

```go
// internal/controller/reindexjob_worker.go

func (r *ReindexJobReconciler) runReindexWorker(ctx context.Context, job *v1alpha1.ReindexJob) {
    defer func() {
        r.mu.Lock()
        r.runningJob = nil
        r.mu.Unlock()
    }()

    reindexer := reindex.NewReindexer(r.ClickHouse, r.JetStream, r.PolicyEvaluator)

    // Progress callback updates ReindexJob status
    reindexer.OnProgress = func(progress reindex.Progress) {
        job.Status.Progress = &v1alpha1.ReindexProgress{
            TotalEvents:         progress.TotalEvents,
            ProcessedEvents:     progress.ProcessedEvents,
            ActivitiesGenerated: progress.ActivitiesGenerated,
            Errors:              progress.Errors,
            CurrentBatch:        progress.CurrentBatch,
            TotalBatches:        progress.TotalBatches,
        }
        job.Status.Message = fmt.Sprintf("Processing: %d/%d events (%.1f%%)",
            progress.ProcessedEvents, progress.TotalEvents,
            float64(progress.ProcessedEvents)/float64(progress.TotalEvents)*100)

        // Non-blocking status update
        _ = r.Status().Update(ctx, job)
    }

    opts := reindex.Options{
        StartTime:   job.Spec.TimeRange.StartTime.Time,
        EndTime:     job.Spec.TimeRange.EndTime.Time,
        BatchSize:   job.Spec.Config.BatchSize,
        RateLimit:   job.Spec.Config.RateLimit,
        DryRun:      job.Spec.Config.DryRun,
        PolicyNames: job.Spec.PolicySelector.Names,
    }

    if err := reindexer.Run(ctx, opts); err != nil {
        job.Status.Phase = v1alpha1.ReindexJobFailed
        job.Status.Message = err.Error()
        meta.SetStatusCondition(&job.Status.Conditions, metav1.Condition{
            Type:    "Ready",
            Status:  metav1.ConditionFalse,
            Reason:  "Failed",
            Message: err.Error(),
        })
    } else {
        job.Status.Phase = v1alpha1.ReindexJobSucceeded
        job.Status.Message = fmt.Sprintf("Completed: %d activities generated",
            job.Status.Progress.ActivitiesGenerated)
        meta.SetStatusCondition(&job.Status.Conditions, metav1.Condition{
            Type:    "Ready",
            Status:  metav1.ConditionTrue,
            Reason:  "Succeeded",
            Message: "Re-indexing completed successfully",
        })
    }

    now := metav1.Now()
    job.Status.CompletedAt = &now
    if err := r.Status().Update(ctx, job); err != nil {
        klog.ErrorS(err, "Failed to update final job status",
            "job", job.Name,
            "namespace", job.Namespace,
            "phase", job.Status.Phase)
    }
}
```

### Activity Write Strategy

#### NATS Stream Architecture

The Activity system uses separate NATS streams for different purposes. The reindexer publishes to a **dedicated stream** to isolate reindexed activities from watch clients:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NATS JetStream                                   │
│                                                                          │
│  INPUT STREAMS (consumed by real-time processor):                        │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │  AUDIT_EVENTS   │  │     EVENTS      │                               │
│  │  (audit logs)   │  │  (k8s events)   │                               │
│  └────────┬────────┘  └────────┬────────┘                               │
│           │                    │                                         │
│           └────────┬───────────┘                                         │
│                    ▼                                                     │
│           ┌────────────────┐                                             │
│           │   Processor    │ ◄── Real-time: consumes from input streams  │
│           └────────┬───────┘                                             │
│                    │                                                     │
│  OUTPUT STREAMS:   ▼                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐           │
│  │      ACTIVITIES         │  │    ACTIVITIES_REINDEX       │           │
│  │  (activities.*)         │  │  (activities.reindex.*)     │           │
│  │                         │  │                             │           │
│  │  ◄── Real-time processor│  │  ◄── Reindexer only        │           │
│  │  ◄── Watch API consumes │  │  ◄── Watch API ignores     │           │
│  └───────────┬─────────────┘  └───────────────┬─────────────┘           │
│              │                                │                          │
│              └────────────┬───────────────────┘                          │
│                           ▼                                              │
│                   Vector consumes both                                   │
│                   writes to ClickHouse                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why separate streams?**
- **Watch isolation:** Clients watching activities don't see reindexed activities flooding in
- **No feedback loop:** Reindexer reads from ClickHouse, writes to output stream only
- **Reuse Vector:** Leverages Vector's batching, retries, and ClickHouse connection management
- **Operational clarity:** Clear separation between real-time and batch processing

#### Reindexer Data Flow

```
┌──────────────────┐       ┌──────────────────┐
│ audit.audit_logs │       │ audit.k8s_events │
│   (ClickHouse)   │       │   (ClickHouse)   │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         └──────────┬───────────────┘
                    │ Query (read-only)
                    ▼
         ┌─────────────────────┐
         │     Reindexer       │
         │  (evaluate policies)│
         └──────────┬──────────┘
                    │
                    │ Publish to ACTIVITIES_REINDEX stream
                    │ (NOT to ACTIVITIES, AUDIT_EVENTS, or EVENTS)
                    ▼
         ┌─────────────────────────┐
         │   ACTIVITIES_REINDEX    │
         │  (activities.reindex.*) │
         └───────────┬─────────────┘
                     │
                     │ Vector consumes
                     ▼
         ┌─────────────────────┐
         │  audit.activities   │
         │     (ClickHouse)    │
         └─────────────────────┘
```

#### Publish to ACTIVITIES_REINDEX Stream

```go
const (
    // ReindexStreamName is the NATS stream for reindexed activities
    ReindexStreamName = "ACTIVITIES_REINDEX"
    // ReindexSubjectPrefix is the subject prefix for reindexed activities
    ReindexSubjectPrefix = "activities.reindex"
)

func (r *Reindexer) publishActivities(ctx context.Context, activities []*v1alpha1.Activity) error {
    for _, activity := range activities {
        activityJSON, err := json.Marshal(activity)
        if err != nil {
            return fmt.Errorf("failed to marshal activity: %w", err)
        }

        // Publish to ACTIVITIES_REINDEX stream (separate from real-time ACTIVITIES)
        // Subject format: activities.reindex.<tenant_type>.<api_group>.<kind>
        subject := r.buildReindexSubject(activity)

        _, err = r.js.Publish(ctx, subject, activityJSON)
        if err != nil {
            return fmt.Errorf("failed to publish activity: %w", err)
        }
    }

    return nil
}

func (r *Reindexer) buildReindexSubject(activity *v1alpha1.Activity) string {
    return fmt.Sprintf("%s.%s.%s.%s",
        ReindexSubjectPrefix,
        activity.Spec.Tenant.Type,
        activity.Spec.Resource.APIGroup,
        activity.Spec.Resource.Kind,
    )
}
```

**Subject Pattern Note:**

The reindex subject pattern (`activities.reindex.<tenant_type>.<api_group>.<kind>`) is intentionally simpler than the real-time pattern (`activities.<tenant_type>.<tenant_name>.<api_group>.<origin>.<kind>.<namespace>.<name>`). This is acceptable because:

1. Vector consumes all messages from the ACTIVITIES_REINDEX stream regardless of subject
2. No watch clients subscribe to this stream (isolation is at stream level, not subject level)
3. The simpler pattern reduces subject cardinality and is sufficient for routing/filtering if needed

**Advantages:**
- Watch clients don't see reindexed activities (separate stream)
- Reuses Vector's batching, retries, and ClickHouse connection management
- No direct ClickHouse write credentials needed in controller
- No feedback loop - reads from ClickHouse, writes to dedicated output stream
- Clear separation between real-time and batch activity generation

**Considerations:**
- Rate limiting still important to avoid overwhelming NATS/Vector
- Progress tracking based on NATS publish acknowledgments
- Deduplication happens in ClickHouse after Vector writes

#### Infrastructure Requirements

**NATS Stream Configuration:**

```yaml
# Create ACTIVITIES_REINDEX stream
name: ACTIVITIES_REINDEX
subjects:
  - "activities.reindex.>"
retention: limits
max_age: 24h  # Short retention - Vector consumes quickly
storage: file
replicas: 3
```

**Vector Configuration:**

```toml
# Add source for reindex stream (alongside existing ACTIVITIES source)
[sources.nats_activities_reindex]
type = "nats"
url = "${NATS_URL}"
subject = "activities.reindex.>"
queue = "vector-reindex"

# Route to same ClickHouse sink as real-time activities
[sinks.clickhouse_activities]
type = "clickhouse"
inputs = ["nats_activities", "nats_activities_reindex"]  # Both sources
# ... existing ClickHouse config
```

**Controller NATS Credentials:**
The controller-manager needs publish permissions to `activities.reindex.>` subjects.

**NATS Stream Provisioning:**

Stream creation is handled by Infrastructure (SRE) during Phase 0, before deploying the controller.

**Controller validation at startup:**
```go
func (r *ReindexJobReconciler) SetupWithManager(mgr ctrl.Manager) error {
    // Verify NATS stream exists
    stream, err := r.JetStream.StreamInfo("ACTIVITIES_REINDEX")
    if err != nil {
        return fmt.Errorf("ACTIVITIES_REINDEX stream not found - run Phase 0 setup: %w", err)
    }
    klog.InfoS("NATS stream verified", "stream", stream.Config.Name, "subjects", stream.Config.Subjects)
    // ... setup controller
}
```

**What if stream is missing:**
- Controller startup fails with clear error message
- Prevents publishing to non-existent stream
- Operator must run Phase 0 infrastructure setup first

**Vector Configuration Validation** (manual, before deploying controller):
```bash
# Check Vector is consuming from ACTIVITIES_REINDEX stream
kubectl logs -l app=vector -n activity-system | grep ACTIVITIES_REINDEX

# Verify Vector config includes the reindex source
kubectl get configmap vector-config -n activity-system -o yaml | grep -A 5 nats_activities_reindex
```

#### Graceful Shutdown and Restarts

**Controller restart handling:**
1. Worker goroutine receives `ctx.Done()` signal
2. Worker stops processing after current batch completes
3. Status is updated: `phase = Pending`, `message = "Controller restarted, resuming..."`
4. On next reconcile, controller resumes from beginning (idempotent)

**Implementation:**
```go
func (r *Reindexer) Reindex(ctx context.Context, opts ReindexOptions) error {
    for {
        select {
        case <-ctx.Done():
            return fmt.Errorf("context cancelled: %w", ctx.Err())
        default:
            // Process next batch
        }

        batch, nextCursor, err := r.fetchBatch(ctx, cursor)
        if err != nil {
            return err
        }

        // ... process batch

        cursor = nextCursor
    }
}
```

**Resume behavior:**
- Job phase transitions: `Running` → `Pending` (on shutdown)
- Next reconcile detects `Pending` job and restarts
- Deduplication in ClickHouse ensures no duplicate activities
- Progress counters reset (acceptable - provides fresh estimate)

### Error Handling and Recovery

#### Error Categories

| Error Type | Behavior | Recovery |
|-----------|----------|----------|
| **Policy fetch failure** | Fail fast | Retry manually or fix kubeconfig |
| **ClickHouse query error** | Fail fast | Check connection string, credentials (for reading source events) |
| **Query timeout** | Log error, skip batch | Reduce batch size or time range |
| **Policy evaluation error** | Log error, skip event | Fix policy CEL expression |
| **NATS publish failure** | Retry batch | Exponential backoff, max 3 retries |
| **Context cancellation** | Graceful shutdown | Resume from last cursor |

#### Retry Strategy

```go
type RetryConfig struct {
    MaxRetries     int           // default: 3
    InitialBackoff time.Duration // default: 1s
    MaxBackoff     time.Duration // default: 30s
    Multiplier     float64       // default: 2.0
}

func (r *Reindexer) publishActivitiesWithRetry(ctx context.Context, activities []*v1alpha1.Activity) error {
    var lastErr error
    backoff := r.config.Retry.InitialBackoff

    for attempt := 0; attempt < r.config.Retry.MaxRetries; attempt++ {
        if err := r.publishActivities(ctx, activities); err == nil {
            return nil
        } else {
            lastErr = err
            klog.Warningf("Write failed (attempt %d/%d): %v", attempt+1, r.config.Retry.MaxRetries, err)

            select {
            case <-time.After(backoff):
                backoff = time.Duration(float64(backoff) * r.config.Retry.Multiplier)
                if backoff > r.config.Retry.MaxBackoff {
                    backoff = r.config.Retry.MaxBackoff
                }
            case <-ctx.Done():
                return ctx.Err()
            }
        }
    }

    return fmt.Errorf("failed after %d retries: %w", r.config.Retry.MaxRetries, lastErr)
}
```

#### Idempotency

Re-indexing is idempotent because:
1. Same `origin_id` for each source event
2. ClickHouse ReplacingMergeTree deduplicates on ORDER BY key
3. Cursor-based pagination ensures no duplicate processing

**Safe to retry:**
- After crash or cancellation: resume from last cursor
- After partial failure: re-run same time range (ClickHouse deduplicates)

### Observability

#### Metrics

```go
// internal/reindex/metrics.go

var (
    reindexJobsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "activity_reindex",
            Name:      "jobs_total",
            Help:      "Total number of reindex jobs started",
        },
        []string{"time_range", "policy"},
    )

    reindexEventsProcessed = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "activity_reindex",
            Name:      "events_processed_total",
            Help:      "Total number of source events processed during reindexing",
        },
        []string{"source_type", "policy", "dry_run"}, // dry_run: "true" or "false"
    )

    reindexActivitiesGenerated = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "activity_reindex",
            Name:      "activities_generated_total",
            Help:      "Total number of activities generated during reindexing",
        },
        []string{"policy", "dry_run"}, // dry_run: "true" or "false"
    )

    reindexActivitiesPublished = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "activity_reindex",
            Name:      "activities_published_total",
            Help:      "Total number of activities published to NATS",
        },
        []string{"policy"},
    )

    reindexErrors = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Namespace: "activity_reindex",
            Name:      "errors_total",
            Help:      "Total number of errors encountered during reindexing",
        },
        []string{"error_type"}, // query, evaluate, write
    )

    reindexDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Namespace: "activity_reindex",
            Name:      "job_duration_seconds",
            Help:      "Time spent on reindex jobs",
            Buckets:   prometheus.ExponentialBuckets(10, 2, 10), // 10s to ~2.8 hours
        },
        []string{"time_range"},
    )

    reindexBatchDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Namespace: "activity_reindex",
            Name:      "batch_duration_seconds",
            Help:      "Time spent processing each batch",
            Buckets:   prometheus.DefBuckets,
        },
    )
)

// Usage with dry_run label:
// reindexEventsProcessed.WithLabelValues(sourceType, policy, strconv.FormatBool(dryRun)).Inc()
```

**Dry-run mode metrics:**
- Use `dry_run="true"` label to differentiate from production runs
- Dashboards can filter production vs preview runs
- Dry-run jobs don't affect production metrics aggregations

#### Logging

**Structured logging with klog:**

```go
// Start of reindex job
klog.InfoS("Starting reindex job",
    "startTime", opts.StartTime,
    "endTime", opts.EndTime,
    "policy", opts.PolicyFilter,
    "batchSize", opts.BatchSize,
    "rateLimit", opts.RateLimit,
    "dryRun", opts.DryRun,
)

// Batch progress
klog.V(2).InfoS("Processed batch",
    "batchNumber", batchNum,
    "eventsProcessed", len(batch),
    "activitiesGenerated", len(activities),
    "totalProcessed", totalProcessed,
    "duration", batchDuration,
)

// Errors
klog.ErrorS(err, "Failed to evaluate policy",
    "policy", policy.Name,
    "sourceType", sourceType,
    "eventID", eventID,
)

// Completion
klog.InfoS("Reindex job completed",
    "totalEventsProcessed", totalEvents,
    "totalActivitiesGenerated", totalActivities,
    "duration", jobDuration,
    "errors", errorCount,
)
```

### Rate Limiting Strategy

```go
// Use golang.org/x/time/rate for token bucket rate limiting

type RateLimiter struct {
    limiter *rate.Limiter
}

func NewRateLimiter(eventsPerSecond int) *RateLimiter {
    // Allow bursts up to 2x the rate
    return &RateLimiter{
        limiter: rate.NewLimiter(rate.Limit(eventsPerSecond), eventsPerSecond*2),
    }
}

func (rl *RateLimiter) Wait(ctx context.Context, n int) error {
    // Wait for n tokens (events)
    reservation := rl.limiter.ReserveN(time.Now(), n)
    if !reservation.OK() {
        return fmt.Errorf("rate limit exceeded")
    }

    delay := reservation.Delay()
    if delay > 0 {
        select {
        case <-time.After(delay):
            return nil
        case <-ctx.Done():
            reservation.Cancel()
            return ctx.Err()
        }
    }
    return nil
}
```

**Default Rate Limits:**
- 100 events/second (36,000 events/hour)
- 24-hour reindex (typical): 2.16M events max
- 48-hour reindex: 4.32M events max
- Adjustable via `spec.config.rateLimit`

**Impact Assessment:**

| Scenario | Events | Rate | Duration | ClickHouse Impact |
|----------|--------|------|----------|-------------------|
| 24h bug fix | 10K | 100/s | ~2 min | Negligible |
| 48h retroactive | 50K | 100/s | ~8 min | Low |
| 7-day backfill | 350K | 100/s | ~1 hour | Medium |
| 30-day backfill | 1.5M | 100/s | ~4 hours | High (off-hours) |

### Controller Deployment

The ReindexJob controller runs as part of `activity-controller-manager`. No additional deployment needed.

**Note:** The controller accesses ReindexJob resources via the aggregated API server (activity-apiserver), not via a CRD. The aggregated API server stores ReindexJobs in etcd.

**RBAC Configuration:**

ReindexJob is cluster-scoped (like ActivityPolicy). Controller and operators both use ClusterRole permissions:

**Controller-Manager Permissions (ClusterRole):**

```yaml
# Add to config/base/generated/controller-manager-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: activity-controller-manager
rules:
- apiGroups: ["activity.miloapis.com"]
  resources: ["reindexjobs"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: ["activity.miloapis.com"]
  resources: ["reindexjobs/status"]
  verbs: ["update", "patch"]
- apiGroups: [""]
  resources: ["events"]
  verbs: ["create", "patch"]  # For emitting Kubernetes events
```

**Operator Permissions (users who create ReindexJobs):**

Platform admins need cluster-wide permissions:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: activity-reindex-operator
rules:
- apiGroups: ["activity.miloapis.com"]
  resources: ["reindexjobs"]
  verbs: ["create", "get", "list", "watch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: activity-reindex-operator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: activity-reindex-operator
subjects:
- kind: User
  name: alice@example.com
  apiGroup: rbac.authorization.k8s.io
```

**Why ClusterRole for both controller and operators:**
- ReindexJob is cluster-scoped (like ActivityPolicy)
- Multi-tenancy is at control plane level, not namespace level
- Consistent with existing ActivityPolicy RBAC pattern

**Resource limits:**

The controller-manager should have sufficient resources to handle reindex workloads:

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Dry-Run Mode

Dry-run mode previews changes without writing to ClickHouse. Create a ReindexJob with `spec.config.dryRun: true`:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: preview-policy-changes
spec:
  timeRange:
    startTime: "2026-02-25T00:00:00Z"
  config:
    dryRun: true
```

**Status output:**

```yaml
status:
  phase: Succeeded
  message: "Dry-run complete: 2,150 activities would be generated"
  progress:
    totalEvents: 15650
    processedEvents: 15650
    activitiesGenerated: 2150
    errors: 0
  conditions:
    - type: Ready
      status: "True"
      reason: "DryRunCompleted"
      message: "Dry-run completed. No activities written to ClickHouse."
```

### Kubernetes Events

The controller emits Kubernetes events for key milestones:

```bash
kubectl get events -n activity-system --field-selector involvedObject.kind=ReindexJob

LAST SEEN   TYPE     REASON      OBJECT                          MESSAGE
2m          Normal   Started     reindexjob/fix-httpproxy-typo   Started re-indexing 15650 events
1m          Normal   Progress    reindexjob/fix-httpproxy-typo   Processed 8000/15650 events (51%)
30s         Normal   Completed   reindexjob/fix-httpproxy-typo   Completed: 2150 activities generated
```

## Implementation Plan

### Phase 0: Infrastructure Setup (1 day)

**Tasks:**
1. Create ACTIVITIES_REINDEX NATS stream
   - Subjects: `activities.reindex.>`
   - Retention: 24h (short - Vector consumes quickly)
   - Replicas: 3
2. Update Vector configuration
   - Add source for `activities.reindex.>` subjects
   - Route to existing ClickHouse activities sink
3. Configure controller-manager NATS credentials
   - Publish permissions to `activities.reindex.>`

**Deliverables:**
- NATS stream configuration (Kustomize or Terraform)
- Vector config updates
- Controller-manager credential configuration

**Testing:**
- Verify stream creation: `nats stream info ACTIVITIES_REINDEX`
- Verify Vector consumes from new stream
- Test publish permissions from controller-manager

### Phase 1: Schema Migration (1 day)

**Prerequisites:**
- Phase 0 complete (NATS stream and Vector configured)
- Deploy activity-apiserver with ReindexJob storage and controller first (Phase 3), so activities can be regenerated after migration.

**Tasks:**
1. Create `migrations/005_activities_reindex_support.sql` (DROP + CREATE)
2. Test migration on development cluster (verify schema, deduplication)
3. Update `task migrations:generate` to include new migration
4. Execute migration on staging
5. Run ReindexJob on staging to verify activity generation works
6. Execute migration on production (during maintenance window)
7. Run ReindexJob on production to backfill activities (60-day window)

**Deliverables:**
- Migration file
- Validation queries
- ReindexJob example for post-migration backfill

**Testing:**
- Verify table schema matches expected (ORDER BY, engine)
- Insert duplicate activities with same origin_id
- Verify newer reindex_version wins after OPTIMIZE
- Verify MATERIALIZED columns compute correctly
- Verify ReindexJob successfully generates activities

### Phase 2: Core Re-indexing Logic (3-4 days)

**Tasks:**
1. Create `internal/reindex/` package
   - `reindexer.go`: Main reindex orchestrator
   - `batch.go`: Batch processing logic
   - `publisher.go`: NATS activity publishing
   - `metrics.go`: Prometheus metrics
   - `ratelimiter.go`: Rate limiting
2. Implement ClickHouse query methods (for reading source data)
   - `fetchAuditLogBatch()`: Query audit.audit_logs with cursor
   - `fetchEventBatch()`: Query audit.k8s_events with cursor
3. Implement policy evaluation
   - Reuse `internal/processor/evaluate.go`
   - Add batch evaluation wrapper
4. Implement NATS publishing
   - Publish activities to same subjects as real-time processor
   - Retry logic with exponential backoff
5. Add dry-run mode

**Deliverables:**
- `internal/reindex/` package
- Unit tests for batch processing
- Integration tests with test ClickHouse (read) and NATS (write)

**Testing:**
- Unit tests for batch logic
- Integration tests with sample data
- NATS publish verification
- Dry-run output validation

### Phase 3: ReindexJob API and Controller (3-4 days)

**Tasks:**
1. Create ReindexJob types:
   - `pkg/apis/activity/v1alpha1/types_reindexjob.go` (external versioned types with kubebuilder annotations)
   - `pkg/apis/activity/types.go` (add internal types - simpler, no annotations)
   - Register versioned types in `pkg/apis/activity/v1alpha1/register.go` (AddToScheme)
   - Register internal types in `pkg/apis/activity/register.go` (AddToScheme)
   - Add conversion functions if needed (see `pkg/apis/activity/v1alpha1/conversion.go` for pattern)
2. Create etcd storage (following ActivityPolicy pattern exactly):
   - `internal/registry/activity/reindexjob/storage.go` (copy pattern from policy/storage.go)
   - `internal/registry/activity/reindexjob/strategy.go` (copy pattern from policy/strategy.go, set NamespaceScoped() = false)
   - Add import for reindexjob package in `internal/apiserver/apiserver.go`
3. Register storage in `internal/apiserver/apiserver.go`:
   - Add to v1alpha1Storage map: `v1alpha1Storage["reindexjobs"]` and `v1alpha1Storage["reindexjobs/status"]`
4. Run code generation (`task generate`) - generates deepcopy, OpenAPI, etc.
5. Create controller in `internal/controller/reindexjob_controller.go`:
   - Follow pattern from `internal/controller/activitypolicy_controller.go`
   - Controller watches ReindexJob via aggregated API server client
6. Implement worker goroutine with progress callbacks in `internal/controller/reindexjob_worker.go`
7. Add concurrency control (single running job at a time)
8. Emit Kubernetes events for milestones via `record.EventRecorder`
9. Update RBAC for controller-manager (access through aggregated API server)

**Deliverables:**
- `pkg/apis/activity/v1alpha1/types_reindexjob.go` (versioned types)
- `pkg/apis/activity/types.go` (updated with internal ReindexJob types)
- `pkg/apis/activity/v1alpha1/register.go` (updated to register ReindexJob)
- `pkg/apis/activity/register.go` (updated to register internal ReindexJob)
- `internal/registry/activity/reindexjob/storage.go`
- `internal/registry/activity/reindexjob/strategy.go`
- `internal/controller/reindexjob_controller.go`
- `internal/controller/reindexjob_worker.go`
- Updated `internal/apiserver/apiserver.go` (registration + import)
- Updated RBAC manifests
- Example ReindexJob YAML files

**Testing:**
- Storage strategy tests (validation, defaults)
- Controller reconciliation tests
- Status update verification (via status subresource)
- Concurrency control tests
- Event emission tests

### Phase 4: Documentation and Runbook (1-2 days)

**Tasks:**
1. Write operator runbook for re-indexing
2. Document common scenarios (bug fix, retroactive, refinement)
3. Add troubleshooting guide
4. Update CLAUDE.md with reindex command

**Deliverables:**
- `docs/operations/reindexing.md`
- Runbook with examples
- Troubleshooting guide

### Phase 5: Production Validation (1-2 days)

**Tasks:**
1. Test on staging with real policies
2. Validate deduplication works correctly
3. Measure performance impact on ClickHouse
4. Execute small production reindex (24h window)
5. Monitor for issues

**Deliverables:**
- Staging validation report
- Performance benchmarks
- Production execution log

## Handoff

### Decisions Made

- **Decision 1: Schema migration recreates table with origin_id in ORDER BY and adds reindex_version column**
  - Rationale: ClickHouse's `MODIFY ORDER BY` doesn't support replacing the last column, so table recreation is required. The `reindex_version` column (DateTime64) ensures newer rows always win during ReplacingMergeTree deduplication. Single source event should produce single deduplicated activity.

- **Decision 1a: Query from both audit.audit_logs and audit.k8s_events tables**
  - Rationale: Activities can originate from either API audit logs or Kubernetes Events. Both source tables must be queried during re-indexing to cover all activity types.

- **Decision 2: Publish to separate NATS stream (ACTIVITIES_REINDEX)**
  - Rationale: Isolates reindexed activities from watch clients (who subscribe to ACTIVITIES stream). Reuses Vector's batching and retry logic. No direct ClickHouse credentials needed. Rate limiting in the reindexer prevents overwhelming the pipeline.

- **Decision 3: ReindexJob API resource with etcd storage (following ActivityPolicy pattern)**
  - Rationale: The activity-apiserver is an aggregated API server that doesn't use CRDs. ReindexJob is stored in etcd and served alongside other activity.miloapis.com resources. This provides status tracking, event emission, and integration with kubectl workflows. kubectl plugin wrapper can be added later.

- **Decision 3a: ReindexJob is cluster-scoped (like ActivityPolicy)**
  - Rationale: Multi-tenancy is handled at the control plane level - each tenant has their own control plane. Namespace-scoping provides no benefit since there's only one activity-system per control plane. Consistent with ActivityPolicy and simpler RBAC model.

- **Decision 4: Controller runs in activity-controller-manager**
  - Rationale: No additional deployment needed. Reuses existing ClickHouse and policy connections.

- **Decision 5: Sequential batch processing with single concurrent job**
  - Rationale: Prevents resource contention. Additional jobs queue in Pending state. Parallel workers within batch for policy evaluation.

- **Decision 6: Rate limit default 100 events/sec**
  - Rationale: Balances reindex speed with ClickHouse query load. Typical 24-48h reindex completes in minutes. Adjustable via spec.config.rateLimit.

### Open Questions

- **Question 1: Should we add automatic re-indexing on policy update?**
  - Blocking: No
  - Context: Discovery brief explicitly rejected automatic re-indexing as too risky. Manual operator action is safer. Could revisit if strong demand emerges.

- **Question 2: Should we support selective deletion of unmatched activities?**
  - Blocking: No
  - Context: If a policy changes and no longer matches events it previously matched, old activities remain. A "purge unmatched" flag could delete these. Deferred for initial implementation.

- **Question 3: Should we add a kubectl plugin wrapper?**
  - Blocking: No
  - Context: `kubectl activity reindex` would create a ReindexJob and watch for completion. Useful for interactive workflows. Deferred for initial implementation.

### Implementation Notes

**For api-dev:**

**Type Definitions:**
1. Create versioned types in `pkg/apis/activity/v1alpha1/types_reindexjob.go`:
   - Add kubebuilder annotations (+genclient, +k8s:deepcopy-gen, validation markers)
   - Include full JSON struct tags and field documentation
   - Reference: `pkg/apis/activity/v1alpha1/types_activitypolicy.go`
2. Add internal types to `pkg/apis/activity/types.go`:
   - Simpler than versioned types - no kubebuilder annotations, no json tags
   - Reference: `pkg/apis/activity/types.go` (search for ActivityPolicy)
3. Register types:
   - Versioned: `pkg/apis/activity/v1alpha1/register.go` (AddToScheme)
   - Internal: `pkg/apis/activity/register.go` (AddToScheme)
   - Add conversion functions if field names differ (see `pkg/apis/activity/v1alpha1/conversion.go`)

**Storage Implementation:**
4. Create `internal/registry/activity/reindexjob/storage.go`:
   - Copy pattern from `internal/registry/activity/policy/storage.go`
   - Implement NewStorage, ReindexJobStorage, ReindexJobStatusStorage
   - Add TableConvertor for kubectl output (columns: NAME, PHASE, TIME_RANGE, PROGRESS, AGE)
5. Create `internal/registry/activity/reindexjob/strategy.go`:
   - Copy pattern from `internal/registry/activity/policy/strategy.go`
   - **SAME AS ACTIVITYPOLICY:** `NamespaceScoped() bool` returns `false` (ReindexJob is cluster-scoped)
   - Implement validation logic in ValidateReindexJob
   - Add GetAttrs, SelectableFields, MatchReindexJob functions
6. Register in `internal/apiserver/apiserver.go`:
   - Import: `"go.miloapis.com/activity/internal/registry/activity/reindexjob"`
   - Call NewStorage and add to v1alpha1Storage map

**Controller Implementation:**
7. Create `internal/controller/reindexjob_controller.go`:
   - Follow `internal/controller/activitypolicy_controller.go` pattern
   - Controller watches ReindexJob via aggregated API server client
   - Use sync.Mutex for concurrency control (single running job)
8. Create `internal/controller/reindexjob_worker.go`:
   - Goroutine for long-running batch processing
   - Update status via status subresource after each batch
   - Use record.EventRecorder for Started/Progress/Completed/Failed events

**Batch Processing:**
9. Migration is simple DROP + CREATE - no data preservation needed
10. Publish activities to NATS ACTIVITIES_REINDEX stream - no direct ClickHouse writes
11. Query from BOTH `audit.audit_logs` (audit origin) AND `audit.k8s_events` (event origin)
12. Reuse NATS patterns from `internal/processor/` for publishing
13. Reuse `internal/processor/evaluate.go` for policy evaluation

**Field Types:**
14. Use `int32` for spec config (BatchSize, RateLimit) and batch counters (CurrentBatch, TotalBatches)
15. Use `int64` for cumulative counters in status (TotalEvents, ProcessedEvents, ActivitiesGenerated, Errors)

**Code Generation:**
16. Run `task generate` after creating types (generates deepcopy, OpenAPI, etc.)

**For test-engineer:**
1. Create integration tests with test ClickHouse cluster
2. Test deduplication with reindex_version: insert activity, re-insert with same origin_id, verify newer version wins after OPTIMIZE
3. Test batch processing from BOTH source tables: mock audit.audit_logs and audit.k8s_events
4. Test rate limiting: verify delays are applied correctly
5. Test dry-run: verify no NATS publishes occur
6. Test controller reconciliation: verify status updates, phase transitions
7. Test concurrency control: verify only one job runs at a time
8. Load test: reindex 100K events (mix of audit logs and k8s events), measure duration and resource usage
9. Test migration: verify schema correct, MATERIALIZED columns compute correctly, version column has default value

**For sre:**
1. Create ACTIVITIES_REINDEX NATS stream (subjects: `activities.reindex.>`)
2. Update Vector config to consume from both ACTIVITIES and ACTIVITIES_REINDEX streams
3. Update controller-manager RBAC for ReindexJob resources
4. Configure controller-manager NATS credentials with publish permissions to `activities.reindex.>`
5. Document ReindexJob examples in docs/
6. Document migration execution procedure (staging first, then production)
7. Create runbook for common reindex scenarios
8. Set up alerting for ReindexJob failures (optional)
