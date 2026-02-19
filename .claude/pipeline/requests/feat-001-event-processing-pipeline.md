# Feature Request: feat-001-event-processing-pipeline

## Summary

Add a Kubernetes event processing pipeline to the Activity platform. This feature extends the existing audit log pipeline to also capture, store, and expose Kubernetes Events (from the `events.k8s.io/v1` and `v1` APIs) through the Activity API server.

## Context

A POC exists on branch `poc/event-processing-pipeline` (commit `a95d6c65`). The POC demonstrates the approach but has blocking compilation errors and several design gaps that need to be resolved before productionization.

## Known POC Issues (from code review)

### Blocking
1. Wrong package imports — references `controller.PolicyCache`/`controller.CompiledPolicy` from wrong package
2. Missing types — `Publisher` and `AuditProcessor` are undefined
3. Missing `ActorTypeController` constant
4. Missing NATS metrics (`NATSDisconnectsTotal`, `NATSConnectionStatus`, etc.)
5. Unknown struct field `KindLabel` in `PolicyPreviewSpec`

### Warnings
- Silent message drops when NATS work channel full (data loss risk)
- Hardcoded `SCOPE_TYPE`/`SCOPE_NAME` env vars in event exporter deployment
- Missing liveness/readiness probes in event exporter deployment
- 1-hour NATS stream retention too short for production
- Duplicate `getFieldValue` implementations

## Requested Outcome

A production-ready Kubernetes event processing pipeline that:
- Captures Kubernetes Events from all namespaces
- Normalizes events from both API versions (v1, events.k8s.io/v1)
- Stores events in ClickHouse with proper TTL and deduplication
- Exposes events through the Activity aggregated API server
- Provides EventFacetQuery for filtered exploration
- Integrates with the existing NATS JetStream infrastructure
- Has proper metrics, health probes, and observability

## Branch

`poc/event-processing-pipeline`

## Related Files

- `internal/processor/event.go`
- `internal/processor/processor.go`
- `internal/eventexporter/exporter.go`
- `internal/storage/events_clickhouse.go`
- `internal/watch/events_watcher.go`
- `migrations/003_k8s_events_table.sql`
- `docs/enhancements/001-kubernetes-events-storage.md`
