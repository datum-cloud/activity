---
handoff:
  id: feat-005
  from: product-discovery
  to: product-planner
  created: 2026-02-27T01:47:28Z
  context_summary: |
    Support re-indexing events after ActivityPolicy changes to enable policy lifecycle management.
    Primary use cases: fixing policy bugs, adding retroactive coverage for new policies, and refining
    policy summaries. Typical time scope is 24-48 hours (tens of thousands of events) but must support
    custom time ranges for flexibility.
  decisions_made:
    - decision: "General-purpose feature supporting all policy lifecycle scenarios"
      rationale: "User confirmed need for policy bug fixes, retroactive coverage, and policy refinement"
    - decision: "Primary time window is 24-48 hours"
      rationale: "Balances quick fixes for recent issues while keeping event volume manageable (tens of thousands)"
    - decision: "Must support custom time ranges"
      rationale: "Different scenarios require different time windows based on when policy deployed or events occurred"
    - decision: "Source data (audit logs and events) already available in ClickHouse"
      rationale: "Activities link back to origin via origin.type and origin.id, raw data stored with 60-day TTL"
    - decision: "Overwrite existing activities via ClickHouse ReplacingMergeTree"
      rationale: "Simpler than versioning; uses native ClickHouse deduplication; no need to track activity versions"
    - decision: "Schema migration required to change ORDER BY to include origin_id"
      rationale: "Current ORDER BY (tenant_type, tenant_name, timestamp, resource_uid) doesn't deduplicate by source event; changing to (tenant_type, tenant_name, timestamp, origin_id) enables proper deduplication"
    - decision: "Manual operator-initiated re-indexing"
      rationale: "Automatic re-indexing on policy update is too risky for unintended changes; manual action is safer and provides control"
  open_questions:
    - question: "What performance constraints exist for bulk re-processing?"
      blocking: false
      context: "Need to understand ClickHouse query limits, processor throughput, and NATS capacity for replaying events"
    - question: "Should re-indexing be scoped to specific policies or all policies?"
      blocking: false
      context: "User might want to re-index only the changed policy, or all policies if changing common templates"
  assumptions:
    - "Raw audit logs and events are retained in ClickHouse with 60-day TTL"
    - "Activities have origin.type and origin.id fields for correlation to source events"
    - "Processor can evaluate ActivityPolicy rules against arbitrary audit/event inputs"
    - "System can handle reprocessing tens of thousands of events without impacting real-time processing"
    - "Re-indexing is an operator-driven task, not end-user facing"
  platform_capabilities:
    quota: "N/A - Re-indexing is operator activity, not consumer resource usage"
    insights: "Should emit insights when re-indexing job fails or produces unexpected results"
    telemetry: "Must track re-indexing job progress, throughput, errors, and completion status"
    activity: "N/A - This service IS the activity system"
---

# Discovery Brief: Event Re-indexing After Policy Updates

## Problem Statement

When service providers deploy ActivityPolicy resources, they may need to regenerate activities from historical events due to:

1. **Policy bugs** - Typos or incorrect CEL expressions causing wrong summaries or missed events
2. **Retroactive coverage** - Newly created policies that should generate activities for recent historical events
3. **Policy refinement** - Improving working policies with better wording, additional context, or enhanced formatting

Currently, once an activity is generated from an audit log or event, it's immutable. If the policy changes, only new events get the improved translations. Historical activities remain incorrect or missing.

**Impact:**
- Operators can't fix policy mistakes retroactively
- New policies leave gaps in activity history
- Iterative policy improvement is discouraged due to permanent legacy data
- Support engineers see inconsistent activity descriptions across time

## Target Users

**Primary:** Platform operators managing ActivityPolicy resources
- Service teams defining policies for their resource types
- Platform SREs fixing policy bugs discovered in production

**Secondary:** Support engineers investigating incidents
- Need consistent activity descriptions when debugging issues spanning policy changes
- Benefit from complete activity coverage when new policies are deployed

## User Needs

### Policy Bug Fixes
"I deployed a policy with a typo in the summary template and now activities show garbled text. I fixed the policy but thousands of old activities are still wrong."

**Needs:**
- Re-run corrected policy against recent events (last 24-48 hours typical)
- Replace incorrect activities with corrected ones
- Verify results before committing changes

### Retroactive Coverage
"I just added an ActivityPolicy for VirtualMachines, which previously had no coverage. I want to generate activities for VM changes from the past week so users see complete history."

**Needs:**
- Apply new policy to historical events that previously had no matching policy
- Generate activities for time windows before policy creation
- Fill gaps in activity timeline

### Policy Refinement
"My policy works but I want to improve the summary text to include more context. I'd like to regenerate recent activities with the better description."

**Needs:**
- Apply improved policy templates to recent events
- Update existing activities with refined summaries
- Iterate on policy design with quick feedback

## Current Architecture Context

### Data Pipeline
1. Audit logs and events flow through NATS JetStream
2. `activity-processor` evaluates ActivityPolicy rules and generates Activity records
3. Activities stored in ClickHouse with 60-day TTL
4. Raw audit logs and events also stored in ClickHouse

### Key Schema Details
- Activities link to source via `origin.type` (audit/event) and `origin.id`
- ActivityPolicy rules are CEL expressions evaluated in order (first match wins)
- `PolicyPreview` API already exists for testing policies against sample inputs
- `EvaluationStats` track runtime policy evaluation health

### Existing Capabilities
- Raw source data (audit logs and events) available in ClickHouse
- Processor can evaluate policies against arbitrary inputs (PolicyPreview proves this)
- Activities have creation timestamps and origin correlation
- Policies have versioning via `metadata.generation` and `status.observedGeneration`

## Scope Boundaries

### In Scope
- **Schema migration**: Change activities table ORDER BY to use `origin_id` for proper deduplication
- Operator-initiated re-indexing of events within retention window (up to 60 days)
- Re-processing specific time ranges with updated ActivityPolicy rules
- Replacing existing activities via ClickHouse ReplacingMergeTree deduplication
- Progress tracking and error reporting for re-indexing jobs

### Out of Scope (for initial implementation)
- Automatic re-indexing on every policy change (too risky for unintended changes)
- Re-indexing beyond ClickHouse retention window (source data unavailable)
- Real-time re-indexing (batch-oriented operation)
- End-user triggered re-indexing (operator-only capability)
- Activity versioning (using overwrite strategy instead)

### Deferred Questions
- Should we support selective re-indexing (e.g., only activities matching specific filters)?
- How do we handle policies that no longer match events they previously matched? (activities would remain unchanged unless explicitly deleted)
- Should we provide a "purge unmatched" option to remove activities that no longer have matching policies?

## Success Criteria

**Must Have:**
- Operators can trigger re-indexing for a specific time range
- Re-indexing applies current ActivityPolicy rules to historical events
- System handles tens of thousands of events without impacting real-time processing
- Clear progress visibility and error reporting

**Should Have:**
- Dry-run mode to preview changes before applying
- Scoping to specific policies (vs. re-indexing all policies)
- Metrics and logging for re-indexing operations

**Could Have:**
- Automatic re-indexing when policy.status.conditions changes to Ready=true
- Incremental re-indexing (only events affected by changed rules)
- Activity versioning to preserve history across re-indexing

## Technical Considerations

### Schema Migration Required

The activities table currently uses:
```sql
ENGINE = ReplicatedReplacingMergeTree
ORDER BY (tenant_type, tenant_name, timestamp, resource_uid)
```

This must change to:
```sql
ORDER BY (tenant_type, tenant_name, timestamp, origin_id)
```

**Why:** `origin_id` uniquely identifies the source audit log or event. Activities from the same source event will have the same `origin_id`, enabling proper deduplication during re-indexing. The current key uses `resource_uid` (the affected resource), which doesn't guarantee uniqueness per source event.

**Migration approach:**
1. Create new migration file `005_activities_reindex_support.sql`
2. Use `ALTER TABLE ... MODIFY ORDER BY` (supported in ClickHouse 22.8+)
3. Background merge will rebuild indexes; no data loss

### ReplacingMergeTree Deduplication

When re-indexed activities are inserted:
1. They have the same `(tenant_type, tenant_name, timestamp, origin_id)` as original
2. ClickHouse background merge deduplicates rows with identical sorting keys
3. Most recent row (re-indexed activity) is kept
4. No explicit DELETE required; deduplication happens automatically

**Note:** Deduplication is eventual (happens during background merges). Queries immediately after re-indexing may see both old and new activities until merge completes. Use `FINAL` modifier for immediate consistency if needed.

### Data Availability
- Audit logs and events stored in ClickHouse with 60-day retention
- Activities can be correlated to source via `origin.type` and `origin.id`
- Query patterns exist for time-range filtered retrieval

### Processing Architecture
- Processor already evaluates policies against arbitrary inputs
- PolicyPreview shows batch evaluation is possible
- Need to avoid overwhelming NATS or ClickHouse with bulk queries

### Operational Concerns
- Re-indexing could conflict with real-time processing
- Large time ranges could strain resources
- Operators need visibility into progress and errors

## Platform Capability Requirements

### Telemetry (Required)
- Metrics for re-indexing job progress (events processed, activities generated)
- Error counters for failed evaluations or storage operations
- Duration and throughput metrics for performance monitoring

### Insights (Recommended)
- Emit insights when re-indexing produces unexpected results (e.g., zero activities generated)
- Alert on re-indexing failures or performance degradation

### Quota (Not Applicable)
- Re-indexing is operator activity, not resource consumption

### Activity (Not Applicable)
- This service provides activity tracking itself

## Next Steps

This brief should be handed off to **architect (datum-platform:plan)** to:
1. Design the schema migration for ORDER BY change
2. Design the re-indexing API/CLI interface for operators
3. Design the batch processing architecture (query source events, evaluate policies, insert activities)
4. Define scoping options (time range, specific policies, resource filters)
5. Assess performance constraints and rate limiting approach
6. Produce implementation plan with component breakdown
