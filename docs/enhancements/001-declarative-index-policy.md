# Enhancement 001: Declarative Audit Log Index Policy

**Status**: Proposed
**Authors**: Activity Team
**Created**: 2024-12-13
**Last Updated**: 2024-12-13

## Summary

Add declarative, CRD-based management of ClickHouse schema and indexes for the audit log table, allowing operators to define filterable fields and query optimizations without manual SQL migrations. Users will reference fields using CEL expressions that automatically validate against the declared policy, while the system handles all ClickHouse-specific schema reconciliation.

## Motivation

### Current State

Today, adding new filterable fields to audit log queries requires:

1. **Manual SQL migration**: Write ClickHouse DDL to add materialized columns
2. **Manual index creation**: Craft `ALTER TABLE` statements for skip indexes
3. **Code changes**: Update CEL filter converter with hardcoded field mappings
4. **Deployment coordination**: Apply migrations before deploying code changes
5. **No validation**: Users can't discover which fields are filterable until queries fail

Example current workflow to add a new field:

```sql
-- Step 1: Write SQL migration (migrations/002_add_impersonation_field.sql)
ALTER TABLE audit.events
ADD COLUMN impersonated_user_username String
MATERIALIZED JSONExtractString(event_json, 'impersonatedUser', 'username');

ALTER TABLE audit.events
ADD INDEX idx_impersonated_user impersonated_user_username
TYPE bloom_filter GRANULARITY 4;
```

```go
// Step 2: Update internal/cel/filter.go with hardcoded mapping
case "impersonatedUser.username":
    return "impersonated_user_username", nil
```

This process is:
- **Manual and error-prone**: SQL syntax errors, column name typos
- **Requires deep ClickHouse knowledge**: Operators must understand materialized columns, skip indexes, granularity
- **Tightly coupled**: Schema changes require code deployments
- **Not discoverable**: No way to query "what fields can I filter on?"
- **Risky**: No validation before applying changes to production tables

### Real-World Use Cases

**Security teams** need to track impersonation events:
```yaml
# Want to query: Who impersonated admin accounts?
filter: "impersonatedUser.username == 'admin'"
# Today: Manual migration + code change
```

**Platform teams** need to analyze request patterns:
```yaml
# Want to query: What's accessing /api/v1/secrets?
filter: "requestURI.startsWith('/api/v1/secrets')"
# Today: Manual migration + code change
```

**Compliance teams** need custom annotation tracking:
```yaml
# Want to query: Events with specific compliance tags
filter: "annotations['compliance.company.com/reviewed'] == 'true'"
# Today: Manual migration + code change
```

Each of these requires weeks of coordination across teams who understand ClickHouse, the codebase, and migration safety.

### Why This Matters

As the Activity service scales across multiple teams and use cases, the current manual schema management becomes a bottleneck:

- **Time to value**: Simple field addition takes days/weeks instead of minutes
- **Knowledge barrier**: Requires ClickHouse expertise that platform users don't have
- **Risk of errors**: Manual SQL in production databases
- **No self-service**: Platform teams can't extend the schema without engineering support

## Goals

1. **Declarative schema management**: Define filterable fields and indexes as Kubernetes CRDs
2. **Automatic reconciliation**: System reconciles ClickHouse schema to match declared policy
3. **Zero ClickHouse knowledge required**: Operators work with JSONPath expressions, not SQL
4. **Query validation**: CEL filters automatically validated against declared schema
5. **Safe by default**: Never auto-drop columns; explicit opt-in for destructive operations
6. **Gradual rollout**: Support incremental backfill for materialized columns
7. **Status transparency**: Operators can see applied schema and reconciliation progress
8. **Single table only**: Manage the single `audit.events` table (no multi-table complexity)

## Non-Goals

1. **Multi-table support**: Policy always applies to `audit.events` only
2. **Multi-backend support**: ClickHouse-specific (though API is designed to be portable)
3. **Query result transformation**: Policy only affects what's filterable, not result format
4. **Dynamic table creation**: Table must exist; policy only adds columns/indexes
5. **Advanced ClickHouse features**: No projections, partitioning changes, or TTL management (future enhancements)
6. **Schema versioning**: No rollback mechanism (use ClickHouse backups for disaster recovery)

## Proposal

### Overview

Introduce a new CRD `AuditLogIndexPolicy` that declaratively defines:
- Filterable fields (extracted from audit event JSON via JSONPath)
- Indexes to optimize queries
- Materialization and backfill strategies

An embedded controller within the Activity API server reconciles this policy against the actual ClickHouse schema, generating and applying DDL changes automatically.

### API Design

#### CRD: AuditLogIndexPolicy

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogIndexPolicy
metadata:
  name: audit-events-schema  # Singleton - only one allowed

spec:
  # Define filterable fields using JSONPath
  filterableFields:

  # Extract impersonated user from audit event
  - jsonPath: "$.impersonatedUser.username"
    type: string           # string | integer | boolean | timestamp
    materialize: false     # false = compute on read, true = store on disk
    description: "User being impersonated (if any)"

  # Extract first source IP
  - jsonPath: "$.sourceIPs[0]"
    type: string
    materialize: false
    description: "First source IP address"

  # Extract request URI with materialization for performance
  - jsonPath: "$.requestURI"
    type: string
    materialize: true     # Pre-compute and store
    description: "HTTP request path"

  # Extract custom annotation
  - jsonPath: "$.annotations['compliance.company.com/reviewed']"
    type: string
    materialize: false
    description: "Compliance review status"

  # Define indexes for query optimization
  indexes:

  # Single-field index
  - jsonPaths: ["$.impersonatedUser.username"]
    type: hash           # hash | range | set | fulltext
    description: "Optimize impersonation tracking queries"

  # Composite index (multiple fields together)
  - jsonPaths: ["$.objectRef.namespace", "$.verb"]
    type: hash
    description: "Optimize namespace + action queries"

  # Column lifecycle management
  prunePolicy:
    allowColumnDrops: false  # Safety: never auto-drop
    gracePeriodDays: 30      # Wait period before dropping
    mode: disabled           # disabled | enabled

  # Backfill strategy for materialized columns
  backfillConfig:
    strategy: none           # none | incremental | immediate
    batchSize: 1             # Partitions per batch (for incremental)
    batchIntervalMinutes: 1  # Wait between batches

status:
  observedGeneration: 2

  conditions:
  - type: Ready
    status: "True"
    reason: ReconcileSuccess
    message: "Schema reconciled successfully"
    lastTransitionTime: "2024-12-13T10:30:00Z"

  # Currently available fields
  availableFields:
  - jsonPath: "$.impersonatedUser.username"
    type: string
    status: Active
    # Internal mapping (informational)
    backend:
      columnName: impersonated_user_username
      expression: "JSONExtractString(event_json, 'impersonatedUser', 'username')"
      materializationMode: DEFAULT

  appliedIndexes:
  - jsonPaths: ["$.impersonatedUser.username"]
    type: hash
    status: Active
    backend:
      indexName: idx_impersonated_user_username
      clickhouseType: bloom_filter

  lastReconcileTime: "2024-12-13T10:30:00Z"
```

#### Query Integration (Existing AuditLogQuery)

Users continue to write CEL filters, but now they're validated against the policy:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogQuery
metadata:
  name: security-audit
spec:
  startTime: "now-7d"
  endTime: "now"
  # CEL expression - validated against policy
  filter: |
    impersonatedUser.username == 'admin' &&
    objectRef.namespace == 'kube-system' &&
    verb in ['delete', 'update']
```

**Validation logic:**
1. Parse CEL expression
2. Extract field references (e.g., `impersonatedUser.username`)
3. Check if field exists in policy's `filterableFields` or is built-in
4. Reject with helpful error if field not found

**Error example:**
```
Field 'unknownField' is not available for filtering.

Available fields:
  - auditID, verb, stage, stageTimestamp
  - objectRef.namespace, objectRef.resource, objectRef.name
  - user.username, responseStatus.code
  - impersonatedUser.username (from policy)
  - sourceIPs[0] (from policy)
```

### Architecture

#### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Activity API Server                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │ AuditLogQuery    │────────▶│ Query Validator          │  │
│  │ REST Storage     │         │ (CEL → Policy Check)     │  │
│  └──────────────────┘         └─────────────────────────┘  │
│           │                              │                   │
│           │                              ▼                   │
│           │                    ┌─────────────────────────┐  │
│           │                    │ Policy Cache             │  │
│           │                    │ (In-memory policy)       │  │
│           │                    └─────────────────────────┘  │
│           │                              ▲                   │
│           │                              │                   │
│           ▼                              │                   │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │ CEL → SQL        │◀────────│ Schema Reconciler        │  │
│  │ Translator       │         │ (Embedded Controller)    │  │
│  └──────────────────┘         └─────────────────────────┘  │
│           │                              │                   │
│           │                              │                   │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            ▼                              ▼
   ┌────────────────────────────────────────────────┐
   │              ClickHouse                         │
   │  ┌──────────────────────────────────────────┐ │
   │  │ audit.events                              │ │
   │  │  - event_json (raw)                       │ │
   │  │  - timestamp, user, verb, ... (built-in)  │ │
   │  │  - impersonated_user_username (policy)    │ │
   │  │  - source_ips_0 (policy)                  │ │
   │  │  - idx_impersonated_user_username (index) │ │
   │  └──────────────────────────────────────────┘ │
   └────────────────────────────────────────────────┘
```

#### Schema Reconciler (Embedded Controller)

Runs as a goroutine inside the Activity API server:

1. **Startup reconciliation**: Run immediately on server start
2. **Periodic reconciliation**: Every 5 minutes (configurable)
3. **Event-driven**: Watch for policy updates (future enhancement)

**Reconciliation loop:**
```
1. Fetch AuditLogIndexPolicy CRD
2. Introspect ClickHouse schema (query system.columns, system.data_skipping_indices)
3. Generate diff plan (desired vs actual)
4. Execute DDL changes (ALTER TABLE ADD COLUMN, ADD INDEX)
5. Handle materialization (if needed)
6. Update policy status (conditions, applied fields)
```

**Why embedded vs separate controller:**
- Shares ClickHouse connection pool
- Simpler deployment (single binary)
- No separate RBAC/leader election needed (deployment has replicas: 1)
- Direct access to policy cache for query validation

### Internal Translation Layer

#### JSONPath → ClickHouse Column Name

Algorithm to generate deterministic column names:

```
Input:  $.impersonatedUser.username
Steps:  1. Remove $. prefix              → impersonatedUser.username
        2. Convert camelCase to snake    → impersonated_user.username
        3. Replace dots with underscores → impersonated_user_username
        4. Lowercase                     → impersonated_user_username
Output: impersonated_user_username
```

More examples:
```
$.sourceIPs[0]                           → source_ips_0
$.objectRef.namespace                    → object_ref_namespace
$.annotations['compliance.io/reviewed']  → annotations_compliance_io_reviewed
$.verb                                   → verb
```

#### JSONPath → ClickHouse Expression

```
Input:  $.impersonatedUser.username
Output: JSONExtractString(event_json, 'impersonatedUser', 'username')

Input:  $.sourceIPs[0]
Output: JSONExtractString(event_json, 'sourceIPs', 1)  # ClickHouse 1-indexed

Input:  $.annotations['key']
Output: JSONExtractString(event_json, 'annotations', 'key')
```

#### CEL Field → ClickHouse Column

User writes CEL:
```
impersonatedUser.username == 'admin'
```

Internal mapping:
```
CEL field: impersonatedUser.username
    ↓
JSONPath: $.impersonatedUser.username  (for policy lookup)
    ↓
ClickHouse column: impersonated_user_username  (for SQL generation)
    ↓
SQL: WHERE impersonated_user_username = 'admin'
```

### Safety Mechanisms

#### 1. No Automatic Column Drops

By default, removing a field from the policy does NOT drop the column:

```yaml
# Before: policy has field A
filterableFields:
- jsonPath: "$.fieldA"

# After: field A removed
filterableFields: []

# Result: Column 'field_a' remains in ClickHouse, marked as orphaned in status
status:
  orphanedColumns:
  - jsonPath: "$.fieldA"
    columnName: field_a
    markedForDeletionAt: "2024-12-13T10:00:00Z"
    willBeDeletedAt: "2025-01-12T10:00:00Z"  # After 30-day grace period
```

**To enable column drops:**
```yaml
prunePolicy:
  allowColumnDrops: true   # Explicit opt-in
  gracePeriodDays: 30      # Wait 30 days after removal
  mode: enabled            # Must be enabled
```

#### 2. Idempotent DDL

All SQL uses `IF NOT EXISTS` / `IF EXISTS`:
```sql
ALTER TABLE audit.events ADD COLUMN IF NOT EXISTS field_name ...
ALTER TABLE audit.events ADD INDEX IF NOT EXISTS idx_name ...
```

Reconciler can run repeatedly without errors or duplicate operations.

#### 3. Validation Before Apply

Policy validation webhook checks:
- JSONPath syntax is valid
- Field types are supported (string, integer, boolean, timestamp)
- No reserved SQL keywords as column names
- No JSONPath collisions (two paths generating same column name)
- Singleton enforcement (only one policy allowed)

#### 4. Gradual Materialization

For materialized columns, support incremental backfill:

```yaml
backfillConfig:
  strategy: incremental  # Process partitions one by one
  batchSize: 1           # 1 partition at a time
  batchIntervalMinutes: 1  # Wait 1 minute between batches
```

This prevents:
- Overwhelming ClickHouse with mutations
- Blocking queries during materialization
- Rapid storage growth

Status tracks progress:
```yaml
status:
  availableFields:
  - jsonPath: "$.requestURI"
    status: Materializing
    materializationProgress:
      strategy: incremental
      totalPartitions: 120
      completedPartitions: 45
      currentPartition: "202412"
      estimatedCompletion: "2024-12-13T12:00:00Z"
```

### Migration from Manual Schema

Existing materialized columns (from `001_initial_schema.sql`) are treated as built-in:

```yaml
# These are always available, no policy needed:
- auditID, verb, stage, stageTimestamp
- objectRef.namespace, objectRef.resource, objectRef.name
- user.username, responseStatus.code
```

First policy deployment should declare these explicitly (for documentation):

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogIndexPolicy
metadata:
  name: audit-events-schema

spec:
  # Document existing schema (already in ClickHouse)
  filterableFields:
  - jsonPath: "$.verb"
    type: string
    materialize: true
    description: "Action performed (create, update, delete, etc.)"

  - jsonPath: "$.objectRef.namespace"
    type: string
    materialize: true
    description: "Namespace of the affected resource"

  # ... existing fields ...

  # Add new fields
  - jsonPath: "$.impersonatedUser.username"
    type: string
    materialize: false
    description: "User being impersonated"
```

Reconciler detects existing columns and indexes, marking them as `Active` without re-creating.

### User Workflow

#### Adding a New Filterable Field

**Step 1**: Update policy
```bash
kubectl edit auditlogindexpolicy audit-events-schema
```

Add field:
```yaml
spec:
  filterableFields:
  - jsonPath: "$.impersonatedUser.username"
    type: string
    materialize: false
```

**Step 2**: Wait for reconciliation
```bash
kubectl get auditlogindexpolicy audit-events-schema -w

# Watch for Ready condition
NAME                   READY   AGE
audit-events-schema    True    2m
```

**Step 3**: Use in queries immediately
```bash
kubectl apply -f - <<EOF
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogQuery
metadata:
  name: test-new-field
spec:
  startTime: "now-1h"
  endTime: "now"
  filter: "impersonatedUser.username == 'admin'"
EOF

kubectl get auditlogquery test-new-field -o jsonpath='{.status.results}'
```

**Total time: < 5 minutes** (vs days/weeks with manual process)

### Example Use Cases

#### Use Case 1: Security Team - Track Impersonation

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogIndexPolicy
metadata:
  name: audit-events-schema
spec:
  filterableFields:
  - jsonPath: "$.impersonatedUser.username"
    type: string
    materialize: false
    description: "Track who is being impersonated"

  indexes:
  - jsonPaths: ["$.impersonatedUser.username"]
    type: hash
```

Query:
```yaml
filter: "impersonatedUser.username == 'admin' && verb == 'delete'"
```

#### Use Case 2: Platform Team - Analyze Request Patterns

```yaml
spec:
  filterableFields:
  - jsonPath: "$.requestURI"
    type: string
    materialize: true  # High-cardinality, materialize for performance
    description: "HTTP request path"

  - jsonPath: "$.userAgent"
    type: string
    materialize: false
    description: "Client user agent"

  indexes:
  - jsonPaths: ["$.requestURI"]
    type: set  # Good for IN queries
```

Query:
```yaml
filter: "requestURI.startsWith('/api/v1/secrets') && verb == 'get'"
```

#### Use Case 3: Compliance - Custom Annotations

```yaml
spec:
  filterableFields:
  - jsonPath: "$.annotations['compliance.company.com/reviewed']"
    type: string
    materialize: false
    description: "Compliance review status"

  - jsonPath: "$.annotations['compliance.company.com/reviewer']"
    type: string
    materialize: false
    description: "Who reviewed for compliance"
```

Query:
```yaml
filter: |
  annotations['compliance.company.com/reviewed'] == 'false' &&
  responseStatus.code >= 400
```

### Rollout Plan

#### Phase 1: Foundation (Week 1-2)
- Define CRD types
- Add validation webhook
- Code generation

#### Phase 2: Introspection & Planning (Week 2-3)
- ClickHouse schema introspection
- Diff/plan generation
- Translation layer (JSONPath → ClickHouse)

#### Phase 3: Reconciliation (Week 3-4)
- Executor (apply DDL)
- Status tracking
- Embedded controller

#### Phase 4: Query Integration (Week 4-5)
- CEL validator with policy
- Dynamic field mapping
- Error messaging

#### Phase 5: Testing & Documentation (Week 5-6)
- Integration tests
- E2E tests
- User documentation
- Migration guide

### Success Metrics

- **Time to add new field**: < 5 minutes (from policy update to queryable)
- **Zero manual SQL migrations**: All schema changes via policy
- **Query validation rate**: 100% of CEL filters validated before execution
- **Reconciliation reliability**: 99.9% successful reconciliations
- **User satisfaction**: Platform teams can self-serve schema extensions

### Future Enhancements

This proposal focuses on core functionality. Future enhancements may include:

1. **Projections**: Define alternative data layouts for specific query patterns
2. **Partition management**: Declarative partition lifecycle (retention, archival)
3. **Event-driven reconciliation**: Watch policy changes instead of periodic polling
4. **Multi-replica support**: Leader election for reconciler
5. **Schema versioning**: Track schema history and enable rollback
6. **Cost optimization**: Recommend indexes based on query patterns
7. **Field templates**: Reusable field definitions (e.g., "kubernetes.labels.*")

## Alternatives Considered

### Alternative 1: Keep Manual Migrations

**Pros**: Simple, no new code
**Cons**: Doesn't solve the problem, scales poorly

### Alternative 2: Config File Instead of CRD

Use a ConfigMap or static YAML file for policy.

**Pros**: Slightly simpler
**Cons**:
- No validation (OpenAPI schema)
- No status reporting
- No kubectl integration
- No audit trail of changes

**Decision**: CRD provides better UX and aligns with Kubernetes patterns.

### Alternative 3: Separate Controller Deployment

Run reconciler as a separate deployment (like a traditional Kubernetes operator).

**Pros**: More "standard" operator pattern
**Cons**:
- Added complexity (separate binary, RBAC, leader election)
- No shared ClickHouse connection
- Harder to keep policy cache in sync with queries

**Decision**: Embedded controller is simpler for single-table use case.

### Alternative 4: User Invents Field Names

Policy requires users to invent a "name" separate from JSONPath:

```yaml
# Rejected approach
filterableFields:
- name: impersonated_user  # User invents this
  jsonPath: "$.impersonatedUser.username"
```

**Pros**: More explicit
**Cons**:
- Extra cognitive load (two names to remember)
- Potential for confusion (name doesn't match structure)
- Unnecessary abstraction

**Decision**: Auto-generate column names from JSONPath.

## Open Questions

1. **Should we support field renaming?**
   - Detected as drop + add (breaks existing queries)
   - Could add explicit "rename" operation (complex)
   - **Recommendation**: Don't support initially, require explicit drop + add

2. **How to handle ClickHouse version differences?**
   - JSONExtract functions have evolved across versions
   - **Recommendation**: Document minimum ClickHouse version (22.8+)

3. **Should policy updates be gated by approval?**
   - Add admission webhook requiring approval annotation
   - **Recommendation**: Future enhancement, not MVP

4. **What if policy is deleted?**
   - Keep columns in ClickHouse (safe)
   - Fall back to built-in fields only
   - **Recommendation**: Warn in deletion confirmation

## References

- [JSONPath Specification (RFC 9535)](https://www.rfc-editor.org/rfc/rfc9535.html)
- [CEL Language Specification](https://github.com/google/cel-spec)
- [ClickHouse Skip Indexes](https://clickhouse.com/docs/en/optimize/skipping-indexes)
- [Kubernetes API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)
- [Activity Current Schema](../../migrations/001_initial_schema.sql)
