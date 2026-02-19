# Changelog: Kubernetes Event Processing Pipeline

**Release Date:** Pending
**Feature ID:** feat-001-event-processing-pipeline
**Status:** PENDING HUMAN APPROVAL - Do not publish until approved

---

## Added

- **Kubernetes Events stored in ClickHouse** - Events are now offloaded from etcd to ClickHouse, reducing control plane pressure and enabling extended retention.

- **60-day event retention** - Events are retained for 60 days (up from Kubernetes' default 1-hour TTL), supporting post-incident investigation and compliance requirements.

- **EventQuery API** - New `EventQuery` resource (`activity.miloapis.com/v1alpha1`) for querying the full 60-day event history with time range filters and CEL expressions.

- **Real-time event streaming** - Watch API delivers events within 5 seconds of occurrence via NATS JetStream, with replay support on reconnection.

- **Field selector support** - Standard Kubernetes field selectors work as expected: `involvedObject.kind`, `involvedObject.name`, `reason`, `type`, `source.component`.

- **Event-driven Activities** - Events can now trigger human-readable Activity records via ActivityPolicy EventRules, providing unified visibility across audit logs and cluster events.

- **EventFacetQuery API** - Query distinct field values (reasons, types, namespaces) for building filter UIs and dashboards.

## Changed

- **Native Events API limited to 24 hours** - `kubectl get events` queries are limited to the last 24 hours for query performance. Use `EventQuery` for extended time ranges.

## Performance

- Event write throughput: 1,000 events/sec sustained
- Event query latency p99: < 500ms (10K event result set)
- Watch delivery latency: < 5 seconds from occurrence
- Storage efficiency: < 1KB per event (ZSTD compressed)

## Multi-Tenancy

- Events are automatically scoped to projects via `platform.miloapis.com/scope.type` and `scope.name` annotations.
- Cross-project isolation enforced at query time.

---

## Migration Notes

- No migration required for existing events - the system starts fresh with ClickHouse storage.
- Existing `kubectl` workflows continue to work unchanged.
- etcd event storage will be significantly reduced after deployment.

---

## API Reference

| Resource | API Group | Verbs | Notes |
|----------|-----------|-------|-------|
| `events` | `activity.miloapis.com/v1alpha1` | create, get, list, watch, update, delete | 24h native query limit |
| `eventqueries` | `activity.miloapis.com/v1alpha1` | create | 60-day query range, ephemeral |
| `eventfacetqueries` | `activity.miloapis.com/v1alpha1` | create | Distinct value queries |
