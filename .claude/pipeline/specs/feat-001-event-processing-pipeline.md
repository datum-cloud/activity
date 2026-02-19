# Product Specification: Kubernetes Event Processing Pipeline

**Feature ID**: feat-001-event-processing-pipeline
**Version**: 1.0
**Date**: 2026-02-17
**Status**: Ready for Review

---

## Handoff

- **From**: product-planner
- **To**: commercial-strategist (parallel), architect
- **Gate**: spec (requires human approval before design starts)
- **Open Questions**:
  1. ~~[BLOCKING] How does Milo authenticate to Activity API server?~~ **RESOLVED**: mTLS with cert-manager provisioning on both sides
  2. ~~[BLOCKING] Where does scope annotation injection happen?~~ **RESOLVED**: Milo injects scope annotations when forwarding requests to Activity
  3. [NON-BLOCKING] Should platform admins be able to query events across projects?
  4. [NON-BLOCKING] Should event retention TTL be configurable per-project or organization?
  5. [NON-BLOCKING] Is nanosecond-based resourceVersion sufficient for watch replay semantics?
- **Decisions Made**:
  1. Use thin proxy pattern (Milo forwards to Activity via X-Remote-* headers) rather than API aggregation or dual-write
  2. Store events as JSON blobs with materialized columns for efficient ClickHouse querying
  3. Use NATS JetStream for durable buffering, watch semantics, and message deduplication
  4. Multi-tenancy enforced via scope annotations on events (platform.miloapis.com/scope.type and scope.name)
  5. **60-day default TTL** (vs 1-hour etcd default), supporting extended incident investigation and compliance
  6. Accept eventual consistency for events (not ACID); this matches Kubernetes event semantics
  7. **mTLS authentication** between Milo and Activity using cert-manager for certificate provisioning
  8. **Milo injects scope annotations** when forwarding requests to Activity API server
  9. **Native Events API limited to 24 hours** for query performance; use `EventQuery` for extended queries
  10. **New `EventQuery` ephemeral type** for advanced querying beyond 24 hours (similar to `AuditLogQuery`)

---

## Overview

This feature offloads Kubernetes Event storage from etcd to ClickHouse via the Activity service infrastructure. Kubernetes Events (`core/v1.Event`) are high-volume, short-lived resources that create significant pressure on etcd through write amplification and storage consumption. By routing events through the existing Activity service pipeline (Milo -> Activity API Server -> NATS JetStream -> ClickHouse), we reduce etcd load while providing richer queryability, longer retention (**60 days** vs 1 hour), and multi-tenant isolation.

The Milo API server acts as a thin proxy, forwarding event CRUD operations to the Activity API server with user context passed via X-Remote-* headers. The Activity API server stores events in ClickHouse with optimized materialized columns for field selector queries (`involvedObject.*`, `reason`, `type`, `source.*`). Watch operations are implemented via NATS JetStream subscriptions, providing real-time event streaming with replay capability.

---

## User Stories

### US-1: Platform Operator Investigates Past Incidents

**As a** platform operator (SRE managing Milo),
**I want** to query events from the past 60 days,
**So that** I can investigate incidents that occurred outside the standard 1-hour etcd retention window.

**Acceptance Criteria**:
- Events are retained for 60 days by default in ClickHouse
- `kubectl get events -A` returns events from the **last 24 hours** (native API performance limit)
- `EventQuery` API allows querying the full 60-day retention with advanced filtering
- Field selector queries work: `kubectl get events --field-selector involvedObject.kind=Pod,reason=FailedMount`

### US-2: Service Consumer Debugs Deployment Failure

**As a** service consumer (developer using Milo),
**I want** to see all events related to my failing deployment,
**So that** I can understand why my pods are not starting.

**Acceptance Criteria**:
- `kubectl describe deployment my-app` shows events from the last 24 hours
- `EventQuery` allows querying older events (up to 60 days) with time range filters
- Events are scoped to the user's project and namespace
- Field selectors work: `kubectl get events --field-selector involvedObject.name=my-app`

### US-3: CI/CD Pipeline Watches for Deployment Events

**As an** automation system (CI/CD pipeline),
**I want** to watch for events related to my deployment,
**So that** I can report deployment status and trigger rollback if needed.

**Acceptance Criteria**:
- `kubectl get events -w` streams events in real-time
- Watch reconnection replays missed events using resourceVersion
- Events arrive within 5 seconds of occurrence

### US-4: Multi-Tenant Isolation

**As a** platform operator,
**I want** events from different projects to be isolated,
**So that** tenants cannot see each other's cluster activity.

**Acceptance Criteria**:
- Events include scope annotations (`platform.miloapis.com/scope.type` and `scope.name`)
- Queries automatically filter by the requesting user's scope
- Cross-project event queries are denied for non-platform users

### US-5: Reduced etcd Load

**As a** platform operator,
**I want** events stored outside of etcd,
**So that** the control plane has capacity for critical resources and event writes don't compete with pod scheduling.

**Acceptance Criteria**:
- etcd event storage reduced by >90%
- Event operations do not trigger etcd Raft consensus
- Event write latency p99 < 500ms

---

## Functional Requirements

### FR-1: Event Storage in ClickHouse

1. Events are stored in ClickHouse table `audit.events` as JSON blobs
2. Materialized columns extract queryable fields: `namespace`, `name`, `uid`, `involved_kind`, `involved_name`, `reason`, `type`, `source_component`, `scope_type`, `scope_name`
3. ReplicatedReplacingMergeTree engine handles event deduplication by (`namespace`, `name`, `uid`)
4. Events are partitioned by `toYYYYMMDD(first_timestamp)` for efficient TTL cleanup
5. **60-day TTL** is enforced at the storage layer (`TTL first_timestamp + INTERVAL 60 DAY DELETE`)

### FR-2: Event Exporter Component

1. `activity event-exporter` binary watches Kubernetes Events via informer
2. Publishes events to NATS JetStream with subject pattern `events.{namespace}`
3. Scope annotations are already present (injected by Milo at request time)
4. Uses message ID based on event UID for deduplication
5. Handles both ADD and MODIFY operations (DELETE is not needed for ephemeral events)

### FR-3: REST API for Events (Native)

1. Activity API server exposes Events under `activity.miloapis.com/v1alpha1` API group
2. Implements full Kubernetes REST interfaces: `Creater`, `Getter`, `Lister`, `Updater`, `GracefulDeleter`, `Watcher`
3. Uses `corev1.Event` and `corev1.EventList` types for wire compatibility
4. **Native Events API limited to 24-hour query window** for performance
5. Extracts scope from X-Remote-Extra-* headers for multi-tenant filtering

### FR-3a: EventQuery API (Advanced Querying)

1. New ephemeral `EventQuery` resource type for advanced event querying (similar to `AuditLogQuery`)
2. Supports querying the full 60-day retention window
3. Accepts time range filters (`startTime`, `endTime`)
4. Supports all standard field selectors plus additional CEL-based filtering
5. Returns paginated results with continuation tokens for large result sets
6. Query results are ephemeral (not persisted); EventQuery is a virtual resource

### FR-4: Watch API via NATS JetStream

1. Watch operations subscribe to NATS JetStream subjects
2. Support resourceVersion-based replay from stream sequence numbers
3. Apply field selector filtering on the server side
4. Gracefully handle NATS disconnections with automatic reconnection

### FR-5: Field Selector Support

1. Support standard Kubernetes event field selectors:
   - `metadata.namespace`
   - `metadata.name`
   - `involvedObject.kind`
   - `involvedObject.namespace`
   - `involvedObject.name`
   - `involvedObject.uid`
   - `involvedObject.apiVersion`
   - `reason`
   - `type`
   - `source.component`
2. Field selectors are translated to ClickHouse WHERE clauses using materialized columns
3. Invalid field selectors return HTTP 400 Bad Request

### FR-6: Multi-Tenant Scoping

1. Events include scope annotations: `platform.miloapis.com/scope.type` and `platform.miloapis.com/scope.name`
2. Scope values are extracted from user context (X-Remote-Extra-iam.miloapis.com/parent-type and parent-name)
3. Queries are automatically filtered by the requesting user's scope
4. Platform scope users see all events (no filtering)

### FR-7: Authentication via X-Remote-* Headers

1. Activity API server extracts user identity from X-Remote-User header
2. Groups extracted from X-Remote-Group headers
3. Extra context (scope, parent) extracted from X-Remote-Extra-* headers
4. Only accept X-Remote-* headers from authenticated Milo connections (mTLS required)

---

## Non-Functional Requirements

### NFR-1: Performance

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Event write latency p99 | < 500ms | OpenTelemetry histogram |
| Event query latency p99 (10K events) | < 500ms | Load test |
| Event throughput | 1,000 events/sec sustained | Load test |
| Watch delivery latency | < 5 seconds from occurrence | E2E test |

### NFR-2: Reliability

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Event durability | No event loss during component restart | Chaos test |
| Watch reconnection | Missed events replayed within 30 seconds | Chaos test |
| NATS unavailability tolerance | Buffer up to 1 hour of events | JetStream retention config |
| ClickHouse unavailability tolerance | Graceful degradation, retry with backoff | Integration test |

### NFR-3: Scalability

| Metric | Target | Notes |
|--------|--------|-------|
| Events per project | 100,000+ per day | ClickHouse handles billions of rows |
| Concurrent watch connections | 1,000+ per Activity server | NATS subscription limits |
| Storage efficiency | < 1KB per event (compressed) | ZSTD(3) compression on event_json |
| Projects per cluster | 1,000+ | Scope filtering via materialized columns |

### NFR-4: Security

1. mTLS required between Milo and Activity API server
2. X-Remote-* headers only trusted from authenticated connections
3. Event data encrypted at rest in ClickHouse
4. TLS for all network communication
5. Audit logging for event access (via Activity service itself)
6. Scope filtering prevents cross-tenant data access

### NFR-5: Observability

| Metric | Type | Labels |
|--------|------|--------|
| `activity_events_operations_total` | Counter | verb, status |
| `activity_events_operation_duration_seconds` | Histogram | verb |
| `activity_events_watch_connections` | Gauge | namespace |
| `activity_events_clickhouse_errors_total` | Counter | operation |
| `activity_events_nats_messages_published` | Counter | namespace |
| `activity_events_nats_messages_received` | Counter | namespace |

OpenTelemetry traces span: Exporter -> NATS -> ClickHouse, and API Server -> ClickHouse.

---

## API Surface

### New API Resources

| Resource | API Group | Version | Namespaced | Verbs | Notes |
|----------|-----------|---------|------------|-------|-------|
| `events` | `activity.miloapis.com` | `v1alpha1` | Yes | create, get, list, watch, update, delete | Native API, 24h query limit |
| `eventqueries` | `activity.miloapis.com` | `v1alpha1` | Yes | create | Ephemeral, 60-day query range |

### Wire Format

**Events (Native API)**:
- Uses `corev1.Event` and `corev1.EventList` types directly for compatibility with existing kubectl and client-go tooling
- List operations limited to last 24 hours for query performance

**EventQuery (Advanced API)**:
- Custom type similar to `AuditLogQuery`
- Accepts time range, field selectors, CEL filters
- Returns `EventQueryResult` with events and pagination metadata

### Example Request/Response

**List Events**:
```bash
kubectl get events -n default --field-selector involvedObject.kind=Pod
```

Translates to:
```http
GET /apis/activity.miloapis.com/v1alpha1/namespaces/default/events?fieldSelector=involvedObject.kind%3DPod
```

---

## Data Model

### ClickHouse Schema

**Table**: `audit.events`

| Column | Type | Source | Index |
|--------|------|--------|-------|
| `event_json` | String CODEC(ZSTD(3)) | Raw JSON blob | - |
| `inserted_at` | DateTime64(9) | Insert timestamp | minmax |
| `namespace` | LowCardinality(String) | MATERIALIZED | set(100) |
| `name` | String | MATERIALIZED | bloom_filter(0.01) |
| `uid` | String | MATERIALIZED | bloom_filter(0.01) |
| `involved_kind` | LowCardinality(String) | MATERIALIZED | set(50) |
| `involved_namespace` | LowCardinality(String) | MATERIALIZED | - |
| `involved_name` | String | MATERIALIZED | bloom_filter(0.01) |
| `involved_uid` | String | MATERIALIZED | bloom_filter(0.01) |
| `reason` | LowCardinality(String) | MATERIALIZED | set(100) |
| `type` | LowCardinality(String) | MATERIALIZED | set(10) |
| `source_component` | LowCardinality(String) | MATERIALIZED | set(50) |
| `first_timestamp` | DateTime64(3) | MATERIALIZED | minmax |
| `last_timestamp` | DateTime64(3) | MATERIALIZED | minmax |
| `scope_type` | LowCardinality(String) | MATERIALIZED | - |
| `scope_name` | String | MATERIALIZED | - |

**Engine**: `ReplicatedReplacingMergeTree(inserted_at)`
**Partition**: `toYYYYMMDD(first_timestamp)`
**Order By**: `(namespace, name, uid)`
**TTL**: `first_timestamp + INTERVAL 60 DAY DELETE`

### NATS JetStream

**Stream**: `EVENTS`
**Subjects**: `events.>` (wildcard for all namespaces)
**Retention**: 1 hour (buffer for ClickHouse outages)
**Deduplication**: Message ID based on event UID

---

## Acceptance Criteria

### Functional Acceptance

- [ ] `kubectl get events` returns events from ClickHouse within 5 seconds (24-hour window)
- [ ] `kubectl get events -w` streams events in real-time via NATS
- [ ] Field selectors work: `involvedObject.kind`, `involvedObject.name`, `reason`, `type`
- [ ] Native Events API returns only last 24 hours of events
- [ ] `EventQuery` API allows querying full 60-day retention window
- [ ] Events persist for 60 days (verify event queryable via EventQuery after 59 days)
- [ ] Events scoped to Project A are not visible to Project B users
- [ ] Platform admins can query all events (platform scope)
- [ ] Watch reconnection replays missed events using resourceVersion
- [ ] etcd event storage is empty or near-empty after migration

### Performance Acceptance

- [ ] Event write throughput: 1,000 events/sec sustained for 1 hour
- [ ] Event query latency p99 < 500ms for 10K event result set
- [ ] Watch delivery latency < 5 seconds from event occurrence
- [ ] ClickHouse storage < 1KB per event (compressed)

### Reliability Acceptance

- [ ] No event loss during NATS reconnection (10-second outage)
- [ ] No event loss during ClickHouse restart (5-minute outage)
- [ ] Activity API server handles 1,000 concurrent watch connections
- [ ] Graceful degradation when ClickHouse is unavailable (queue events)

### Security Acceptance

- [ ] X-Remote-* headers rejected from non-mTLS connections
- [ ] Cross-scope event query returns empty result (not error)
- [ ] Event access logged in Activity audit log

---

## Out of Scope

1. **Milo Thin Proxy Implementation**: Tracked separately (Milo team)
2. **Cross-Project Admin Queries**: Deferred to v2
3. **Configurable Per-Project TTL**: Deferred to v2 (60-day default for MVP)
4. **events.k8s.io/v1 Format Normalization**: Both formats stored as-is
5. **Migration of Existing Events**: System starts fresh
6. **Event Aggregation/Deduplication Logic**: ClickHouse handles automatically
7. **Event Rate Limiting/Quota**: Deferred to v2

---

## Open Questions

### Resolved

1. **Authentication Strategy**: ~~How does Milo authenticate to Activity API server?~~
   - **Resolution**: mTLS with cert-manager provisioning certificates on both sides. Trusted CA issues certs.

2. **Scope Annotation Injection**: ~~Where does scope annotation injection happen?~~
   - **Resolution**: Milo automatically injects scope annotations when forwarding requests to Activity API server.

### Non-Blocking (Deferred)

3. **Cross-Project Admin Queries**: Defer to v2
4. **Retention Configurability**: Defer to v2 (60-day default)
5. **Resource Version Semantics**: Monitor in production

---

## References

- Discovery Brief: `.claude/pipeline/briefs/feat-001-event-processing-pipeline.md`
- Design Document: `docs/enhancements/001-kubernetes-events-storage.md`
- POC Branch: `poc/event-processing-pipeline`
