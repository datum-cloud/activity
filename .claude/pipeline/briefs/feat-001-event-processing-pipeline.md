# Discovery Brief: Kubernetes Event Processing Pipeline

**Feature ID**: feat-001-event-processing-pipeline  
**Date**: 2026-02-17  
**Status**: Ready for Spec  

---

## Handoff

- **From**: product-discovery
- **To**: product-planner, commercial-strategist
- **Context Summary**: This feature offloads Kubernetes Event storage from etcd to ClickHouse via the existing Activity service infrastructure. A POC exists with the core architecture implemented but has blocking compilation errors. The design is sound and follows established patterns in the codebase.
- **Decisions Made**:
  - Use thin proxy pattern (Milo forwards to Activity) rather than API aggregation or dual-write
  - Events stored as JSON blobs with materialized columns for efficient querying
  - NATS JetStream for durable buffering and watch semantics
  - Multi-tenancy via scope annotations on events (Milo injects at request time)
  - **60-day default TTL** (vs 1-hour etcd default)
  - Eventual consistency acceptable for events (not ACID)
  - **Native Events API limited to 24 hours** for query performance
  - **New `EventQuery` type** for advanced querying of full 60-day retention (like AuditLogQuery)
  - **Table name**: `audit.events` (not `k8s_events` — Milo doesn't position itself as K8s runtime)
- **Open Questions**:
  - ~~[BLOCKING] Authentication:~~ **RESOLVED** - mTLS with cert-manager provisioning on both sides
  - ~~[BLOCKING] Scope injection:~~ **RESOLVED** - Milo injects scope annotations when forwarding to Activity
  - [NON-BLOCKING] Cross-project admin queries: Should platform admins be able to query events across projects?
  - [NON-BLOCKING] Retention configurability: Should TTL be configurable per-project or organization?
  - [NON-BLOCKING] Resource version semantics: Current implementation uses nanosecond timestamps; is this sufficient for watch replay?
- **Platform Capabilities**:
  - **Quota**: Events per project/hour may need limiting to prevent abuse
  - **Insights**: Event aggregation patterns could surface deployment issues
  - **Telemetry**: Metrics for event throughput, storage, query latency defined in design doc
  - **Activity**: N/A (Events ARE the activity source)

---

## Problem Statement

Kubernetes Events (`core/v1.Event`) create significant operational burden on etcd:

1. **Storage pressure**: Events accumulate rapidly in busy clusters. A single deployment rollout can generate hundreds of events. These consume etcd storage even with the default 1-hour TTL cleanup.

2. **Write amplification**: Every event write triggers etcd's Raft consensus protocol. Event writes compete with critical control plane operations (pod scheduling, secret updates, lease renewals).

3. **Limited queryability**: etcd only supports key-prefix queries. Common debugging questions like "show me all FailedMount events in the last hour" require client-side filtering of potentially thousands of events.

4. **No historical retention**: The default 1-hour TTL means events are lost before post-incident investigations can begin. Many outages aren't investigated until hours or days after they occur.

### Is this problem real and widespread?

**Yes.** This is a known limitation discussed extensively in the Kubernetes community:
- SIG-instrumentation has debated event storage backends since 2018
- Large cluster operators (Google, Microsoft, AWS) run custom event sinks
- The `events.k8s.io/v1` API was introduced partly to enable alternative backends
- etcd maintainers explicitly recommend offloading events for clusters >1000 nodes

For Milo specifically, the multi-tenant control plane will host events from many projects. Without offloading, etcd will become a bottleneck as the platform scales.

---

## Target Users

### Primary: Platform Operators (SREs managing Milo)

**Context**: Respond to alerts, debug deployment failures, investigate customer issues.  
**Current pain**: `kubectl get events` shows last hour only. Can't answer "what happened to this pod yesterday?"  
**Value delivered**: Rich queries across longer time ranges, faster incident response.

### Secondary: Service Consumers (developers using Milo)

**Context**: Deploy applications, debug failures, understand why pods aren't running.  
**Current pain**: Events disappear before they can investigate. No way to search across namespaces.  
**Value delivered**: Retain events for 60 days. Field selector queries work as expected.

### Tertiary: Automation (CI/CD pipelines, operators, controllers)

**Context**: Watch for events to trigger actions (e.g., auto-remediation, alerting).  
**Current pain**: Watch connections must stay alive; missed events if connection drops.  
**Value delivered**: Watch replay from resourceVersion, durable event streaming.

---

## Scope Boundaries

### In Scope for MVP

1. **Event storage in ClickHouse** via existing Activity service infrastructure
2. **Event exporter component** that watches etcd events and publishes to NATS
3. **CRUD API for Events** through Activity API server (kubectl compatible)
4. **Watch API for Events** using NATS JetStream subscriptions
5. **Field selector support** for involvedObject.*, reason, type, source.*
6. **Multi-tenant scoping** via scope annotations (Organization/Project isolation)
7. **7-day default retention** with TTL-based cleanup

### Explicitly Out of Scope

1. **Milo thin proxy implementation** - requires Milo codebase changes (separate feature)
2. **Admission controller for scope injection** - prerequisite but separate work item
3. **Cross-project admin queries** - defer to v2
4. **Configurable per-project TTL** - defer to v2
5. **Event aggregation/deduplication** - ClickHouse ReplacingMergeTree handles this automatically
6. **Migration of existing events** - events are ephemeral, start fresh
7. **events.k8s.io/v1 format normalization** - both formats store as-is

---

## Success Criteria

### Functional

| Criterion | Measurement |
|-----------|-------------|
| kubectl get events works through Activity API | E2E test passes |
| Field selectors work (involvedObject.kind, reason, type) | E2E tests for each supported selector |
| Watch API delivers events within 5 seconds of occurrence | Latency test with known event creation |
| Events scoped to project are not visible to other projects | Multi-tenant isolation test |
| Events persist for 7 days | Verify events queryable after 6 days |

### Operational

| Criterion | Measurement |
|-----------|-------------|
| Event write throughput: 1000 events/sec sustained | Load test |
| Query latency p99 < 500ms for 10K events | Performance test |
| Watch reconnection recovers missed events | Chaos test: kill NATS, verify replay |
| ClickHouse storage < 1KB per event (compressed) | Monitor storage growth |

### Adoption

| Criterion | Measurement |
|-----------|-------------|
| etcd event storage reduced by 90% | Prometheus metrics comparison |
| No increase in customer support tickets about missing events | Support ticket analysis |

---

## Platform Capability Assessment

### Quota

**Relevance**: Medium-High

Events could be abused (intentionally or accidentally) by controllers that emit events in loops. Consider:

- **Per-project event rate limit**: e.g., 100 events/minute as soft limit, 1000/minute as hard limit
- **Storage quota**: e.g., 100MB of event storage per project
- **Burst allowance**: Allow short bursts during deployments

**Recommendation**: Implement rate limiting in the event exporter. Defer storage quota to v2.

### Insights

**Relevance**: Medium

The Activity service has unique visibility into event patterns across the platform:

- **Deployment health signals**: High FailedMount/FailedScheduling rates indicate cluster issues
- **Tenant anomaly detection**: Sudden spike in Warning events for one project
- **Capacity planning**: Event volume trends indicate workload growth

**Recommendation**: Add event aggregation metrics to Insights in v2. MVP focuses on storage and query.

### Telemetry

**Relevance**: High

The design doc already specifies metrics. Confirm implementation of:

| Metric | Type | Labels |
|--------|------|--------|
| `activity_events_operations_total` | Counter | verb, status |
| `activity_events_operation_duration_seconds` | Histogram | verb |
| `activity_events_watch_connections` | Gauge | namespace |
| `activity_events_clickhouse_errors_total` | Counter | operation |
| `activity_events_nats_messages_published` | Counter | namespace |

Traces should span: Exporter -> NATS -> ClickHouse, and API Server -> ClickHouse.

**Recommendation**: Ensure all metrics in design doc are implemented. Add alert rules for error rates.

### Activity (Meta)

**Relevance**: Not applicable

This feature IS the Activity Events capability. Events don't need to be logged to Activity - they ARE the activity record.

---

## Risks and Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| NATS unavailable loses events | Medium | High | JetStream durability, retry with backoff, dead letter queue |
| ClickHouse query performance degrades at scale | Low | High | Projections already defined, benchmark at 10M events |
| Watch API resource exhaustion (too many watchers) | Medium | Medium | Connection limits, per-project watcher quotas |
| Resource version collisions (nanosecond timestamps) | Low | Low | UUID fallback, or switch to sequence-based |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration breaks existing kubectl workflows | Low | High | API compatibility testing, kubectl e2e suite |
| Storage costs exceed expectations | Medium | Medium | Monitor early, adjust TTL or compression |
| Team lacks ClickHouse operational expertise | Medium | Medium | Runbooks, training, existing audit log precedent |

### Dependency Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Milo proxy work blocked by other priorities | High | High | Activity service is independently useful for internal queries |
| NATS stream configuration changes break watches | Medium | Medium | Version-pin NATS, test upgrades |

---

## POC Status and Technical Readiness

### What Exists

The POC on branch `poc/event-processing-pipeline` includes:

- `/internal/registry/activity/events/` - REST handlers implementing full CRUD + Watch
- `/internal/storage/events_clickhouse.go` - ClickHouse backend with scope filtering
- `/internal/watch/events_watcher.go` - NATS JetStream watch implementation
- `/internal/eventexporter/exporter.go` - Kubernetes event exporter to NATS
- `/migrations/003_k8s_events_table.sql` - ClickHouse schema with projections
- `/pkg/apis/activity/v1alpha1/register.go` - Events registered in API group
- `/docs/enhancements/001-kubernetes-events-storage.md` - Full design document

### Blocking Issues (from feature request)

1. Wrong package imports for `controller.PolicyCache`/`controller.CompiledPolicy`
2. Undefined types: `Publisher`, `AuditProcessor`
3. Missing `ActorTypeController` constant
4. Missing NATS metrics
5. Unknown struct field `KindLabel` in PolicyPreviewSpec

These are fixable compiler errors, not design issues.

### Warnings to Address

1. Silent message drops when NATS work channel full (data loss risk)
2. Hardcoded SCOPE_TYPE/SCOPE_NAME env vars
3. Missing liveness/readiness probes in event exporter deployment
4. 1-hour NATS stream retention too short for production
5. Duplicate `getFieldValue` implementations

---

## Recommendation

**Proceed to spec.** The discovery is complete and the design is sound.

The POC demonstrates technical feasibility. Blocking issues are implementation bugs, not architectural problems. The design follows established patterns (thin proxy, NATS buffering, ClickHouse storage) already proven by the audit log pipeline.

### Before Implementation

Resolve these blockers at spec/implementation time:

1. **Authentication strategy**: Document mTLS certificate provisioning between Milo and Activity
2. **Scope injection point**: Decide if this is Milo admission controller or a separate feature
3. **POC cleanup**: Fix compilation errors, address warnings

### Next Steps

1. Product-planner: Formalize into implementation spec with task breakdown
2. Commercial-strategist: Assess if event retention is a differentiator for pricing tiers
3. Engineering: Fix POC compilation errors as first task

---

## Appendix: Alternative Approaches Considered

The design doc evaluated these alternatives:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| API Aggregation | Clean separation | Breaks existing tooling (different API group) | Rejected |
| Dual-write (etcd + ClickHouse) | Fast local reads | Doesn't solve etcd pressure | Rejected |
| Custom storage.Interface | No network hop | Complex, violates separation of concerns | Rejected |
| Client library from Activity | Type safety | Cross-repo dependency coupling | Rejected |
| **Thin proxy with X-Remote-*** | Follows existing patterns, minimal coupling | Network hop | **Selected** |

The selected approach matches the existing Sessions/UserIdentities pattern in Milo, minimizing learning curve and operational complexity.
