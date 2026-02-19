# Technical Design Document: feat-001-event-processing-pipeline

## Handoff

- **From**: architect
- **To**: api-dev, sre (parallel implementation)
- **Open Questions**:
  1. [NON-BLOCKING] Should platform admins be able to query events across projects? Deferred to v2.
  2. [NON-BLOCKING] Should event retention TTL be configurable per-project? Deferred to v2 (60-day default).
  3. [NON-BLOCKING] Is nanosecond `resourceVersion` sufficient for watch replay? Monitor in production.
- **Decisions Made**:
  1. NATS stream renamed from `K8S_EVENTS` (POC) to `EVENTS`, subjects `events.>` (not `events.k8s.>`)
  2. ClickHouse table renamed from `audit.k8s_events` (POC) to `audit.events`
  3. POC imports `controller.PolicyCache` — must change to `activityprocessor.PolicyCache`
  4. `Publisher` type removed; use `nats.JetStreamContext` directly
  5. `AuditProcessor` type defined in `internal/processor/audit.go`
  6. `ActorTypeController` constant added to `internal/processor/classifier.go`
  7. Five NATS metrics added to `internal/metrics/metrics.go`
  8. Silent message drops eliminated by switching to JetStream pull consumer
  9. Duplicate `getFieldValue` resolved — moved to `internal/storage/field_selector.go`
  10. `EventQuery` follows the `AuditLogQuery` ephemeral pattern
  11. 24-hour query window enforced on native Events list; EventQuery supports 60 days
  12. Migration `003` replaced with corrected `audit.events` table (60-day TTL)
  13. `EventFacetQuery` already exists in POC — no new facet types needed

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          Milo Control Plane                                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Milo API Server                                                     │  │
│  │  EventsREST (thin proxy)  ──────────────────────────────────────┐   │  │
│  │  Admission: injects scope annotations on event create/update    │   │  │
│  └─────────────────────────────────────────────────────────────────┼───┘  │
│                                                                    │       │
│                                                         HTTPS+mTLS │       │
│                                                    X-Remote-* hdrs │       │
└────────────────────────────────────────────────────────────────────┼──────┘
                                                                     │
                                                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         Activity Service                                   │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Activity API Server                                                 │  │
│  │                                                                      │  │
│  │  ┌───────────────────┐   ┌──────────────────┐   ┌────────────────┐  │  │
│  │  │ mTLS Auth Filter  │──▶│  EventsREST       │──▶│ ClickHouse     │  │  │
│  │  │ (X-Remote-* ext)  │   │  (CRUD + Watch)   │   │ Backend        │  │  │
│  │  └───────────────────┘   └────────┬─────────┘   └───────┬────────┘  │  │
│  │                                   │ Watch               │ Query     │  │
│  │  ┌───────────────────┐            │                     │           │  │
│  │  │  EventQuery REST   │───────────┼─────────────────────┘           │  │
│  │  │  (ephemeral, 60d) │            │                                 │  │
│  │  └───────────────────┘            ▼                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────┐         ┌─────────────────────┐               │
│  │  activity event-exporter│────────▶│  NATS JetStream      │              │
│  │  (Kubernetes informer)  │         │  Stream: EVENTS      │              │
│  └────────────────────────┘         │  Subject: events.>   │              │
│                                      │  Retention: 1 hour   │              │
│                                      └──────────┬──────────┘              │
│                                                  │                         │
│                                                  ▼                         │
│                                      ┌───────────────────┐                │
│                                      │  Vector Aggregator │                │
│                                      │  → ClickHouse      │                │
│                                      │    audit.events    │                │
│                                      │    (60-day TTL)    │                │
│                                      └───────────────────┘                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  activity processor (EventActivityProcessor)                         │  │
│  │  JetStream pull consumer: events.>                                   │  │
│  │  Evaluates ActivityPolicy EventRules → publishes ACTIVITIES stream   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Data Flow**:

1. **Write path**: Milo forwards event CRUD via mTLS to Activity API Server → ClickHouse + NATS publish
2. **Read path (native, 24h)**: `kubectl get events` → EventsREST.List with 24h time filter
3. **Read path (advanced, 60d)**: `kubectl create -f event-query.yaml` → EventQueryREST.Create, no 24h limit
4. **Watch path**: `kubectl get events -w` → JetStream ephemeral push consumer
5. **Activity generation**: EventActivityProcessor pull consumer → ActivityPolicy EventRules → Activities

---

## Package Structure

### Files Changed

| File | Change | Reason |
|------|--------|--------|
| `internal/processor/event.go` | Replace | Fix imports, remove Publisher, use JetStream pull consumer |
| `internal/processor/processor.go` | Replace | Fix imports, define AuditProcessor, fix metrics |
| `internal/processor/classifier.go` | Amend | Add `ActorTypeController` constant |
| `internal/metrics/metrics.go` | Amend | Add 5 NATS + 6 Events API metrics |
| `internal/storage/events_clickhouse.go` | Amend | Table `events`, add 24h limit to List |
| `internal/watch/events_watcher.go` | Amend | Stream `EVENTS`, subject `events.>` |
| `migrations/003_k8s_events_table.sql` | Replace | Table `audit.events`, 60-day TTL |
| `pkg/apis/activity/v1alpha1/register.go` | Amend | Register EventQuery types |
| `pkg/mcp/tools/tools.go` | Amend | Remove KindLabel from PolicyPreviewSpec |

### New Files

| File | Purpose |
|------|---------|
| `pkg/apis/activity/v1alpha1/types_eventquery.go` | EventQuery CRD type |
| `internal/registry/activity/eventquery/storage.go` | EventQuery REST handler |
| `internal/storage/event_query_clickhouse.go` | EventQuery ClickHouse backend |
| `internal/storage/field_selector.go` | Shared `GetEventFieldValue` helper |

---

## Type Definitions

### EventQuery (new CRD type)

`pkg/apis/activity/v1alpha1/types_eventquery.go`:

```go
// +genclient
// +genclient:nonNamespaced
// +genclient:onlyVerbs=create
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

type EventQuery struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec   EventQuerySpec   `json:"spec"`
    Status EventQueryStatus `json:"status,omitempty"`
}

type EventQuerySpec struct {
    StartTime     string `json:"startTime"`           // Required, max 60 days back
    EndTime       string `json:"endTime"`             // Required
    Namespace     string `json:"namespace,omitempty"` // Optional namespace filter
    FieldSelector string `json:"fieldSelector,omitempty"`
    Limit         int32  `json:"limit,omitempty"`     // Default 100, max 1000
    Continue      string `json:"continue,omitempty"`
}

type EventQueryStatus struct {
    Results            []corev1.Event `json:"results,omitempty"`
    Continue           string         `json:"continue,omitempty"`
    EffectiveStartTime string         `json:"effectiveStartTime,omitempty"`
    EffectiveEndTime   string         `json:"effectiveEndTime,omitempty"`
}
```

### ActorTypeController constant

Add to `internal/processor/classifier.go`:

```go
const (
    ActorTypeUser       = "user"
    ActorTypeSystem     = "system"
    ActorTypeController = "controller"  // NEW
)
```

---

## Storage Layer Design

### ClickHouse Schema

Replace `migrations/003_k8s_events_table.sql`:

```sql
-- Migration: 003_events_table
-- Table: audit.events (60-day TTL)

CREATE TABLE IF NOT EXISTS audit.events
(
    event_json     String CODEC(ZSTD(3)),
    inserted_at    DateTime64(9) DEFAULT now64(9),

    -- Metadata (materialized)
    namespace      LowCardinality(String) MATERIALIZED ...,
    name           String MATERIALIZED ...,
    uid            String MATERIALIZED ...,

    -- Involved Object
    involved_kind  LowCardinality(String) MATERIALIZED ...,
    involved_name  String MATERIALIZED ...,
    involved_uid   String MATERIALIZED ...,

    -- Event classification
    reason         LowCardinality(String) MATERIALIZED ...,
    type           LowCardinality(String) MATERIALIZED ...,
    source_component LowCardinality(String) MATERIALIZED ...,

    -- Timestamps
    first_timestamp DateTime64(3) MATERIALIZED ...,
    last_timestamp  DateTime64(3) MATERIALIZED ...,

    -- Multi-tenancy
    scope_type     LowCardinality(String) MATERIALIZED ...,
    scope_name     String MATERIALIZED ...,

    -- Indexes
    INDEX idx_name_bloom name TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_namespace_set namespace TYPE set(100) GRANULARITY 4,
    ...
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/activity_events',
    '{replica}',
    inserted_at
)
PARTITION BY toYYYYMMDD(first_timestamp)
ORDER BY (namespace, name, uid)
TTL first_timestamp + INTERVAL 60 DAY DELETE;
```

### 24-Hour Limit on Native List

In `ClickHouseEventsBackend.List`, prepend:

```go
window24h := time.Now().Add(-24 * time.Hour)
conditions = append(conditions, "last_timestamp >= ?")
args = append(args, window24h)
```

---

## Metrics Design

Add to `internal/metrics/metrics.go`:

```go
// NATS connection metrics
NATSConnectionStatus     *metrics.GaugeVec     // {connection}
NATSDisconnectsTotal     *metrics.CounterVec   // {connection}
NATSReconnectsTotal      *metrics.CounterVec   // {connection}
NATSErrorsTotal          *metrics.CounterVec   // {connection}
NATSLameDuckEventsTotal  *metrics.CounterVec   // {connection}

// Events API metrics (spec NFR-5)
EventsOperationsTotal        *metrics.CounterVec    // {verb, status}
EventsOperationDuration      *metrics.HistogramVec  // {verb}
EventsWatchConnections       *metrics.GaugeVec      // {namespace}
EventsClickHouseErrorsTotal  *metrics.CounterVec    // {operation}
EventsNATSMessagesPublished  *metrics.CounterVec    // {namespace}
EventsNATSMessagesReceived   *metrics.CounterVec    // {namespace}
```

---

## NATS JetStream Configuration

### Stream: EVENTS

| Setting | Value |
|---------|-------|
| Name | `EVENTS` |
| Subjects | `events.>` |
| MaxAge | `1h` |
| Replicas | `3` (prod) / `1` (dev) |
| Deduplication | MsgID (event UID) |

### Consumer: Activity Event Processor

| Setting | Value |
|---------|-------|
| Name | `activity-event-processor` |
| Type | Pull (durable) |
| FilterSubject | `events.>` |
| AckPolicy | Explicit |
| AckWait | `30s` |
| MaxDeliver | `5` |

---

## Work Breakdown

### api-dev Tasks

**api-dev-1: Fix POC compilation errors**
1. Fix imports in `event.go` and `processor.go` (`controller` → `activityprocessor`)
2. Add `ActorTypeController` to `classifier.go`
3. Add all metrics to `metrics.go`
4. Update `events_clickhouse.go`: table name `events`, 24h limit
5. Update `events_watcher.go`: stream `EVENTS`, subject `events.>`
6. Move `getFieldValue` to shared `field_selector.go`
7. Fix `tools.go:1364`: remove `KindLabel`

**api-dev-2: EventQuery type and handler**
1. Create `types_eventquery.go`
2. Update `register.go`
3. Run `task generate`
4. Create `event_query_clickhouse.go`
5. Create `eventquery/storage.go`
6. Register `eventqueries` route

### sre Tasks

**sre-1: NATS configuration**
1. Create `EVENTS` stream manifest
2. Create processor consumer manifest
3. Update/delete old `K8S_EVENTS` stream

**sre-2: ClickHouse migration**
1. Replace `migrations/003` with corrected version
2. Apply migration
3. Drop `audit.k8s_events` if exists

**sre-3: cert-manager mTLS**
1. Create Activity server TLS cert
2. Create Milo client cert
3. Configure shared CA

---

## References

- Spec: `.claude/pipeline/specs/feat-001-event-processing-pipeline.md`
- Brief: `.claude/pipeline/briefs/feat-001-event-processing-pipeline.md`
- Enhancement doc: `docs/enhancements/001-kubernetes-events-storage.md`
- POC branch: `poc/event-processing-pipeline`
