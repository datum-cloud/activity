# Root Cause Analysis: ClickHouse Query Slowdown — March 24, 2026

**Date of incident**: 2026-03-24
**Time of impact**: 21:16 UTC – ~21:30 UTC (primary spike); elevated latency and cascading effects until ~23:10 UTC
**Severity**: High
**Status**: Resolved (self-recovered)
**Correction (2026-03-25)**: An earlier version of this document incorrectly attributed part of the slowdown to migration `009_related_field_indexes` running at 20:05 UTC on March 24 and issuing background `MATERIALIZE INDEX` mutations. That is incorrect. Migration 009 ran once on 2026-03-12T02:40:53 UTC and completed successfully; the `clickhouse-migrate` job at 20:05 UTC on March 24 was a no-op. The `MaxPartCountForPartition` values of 12–20 were normal ClickHouse merge activity. The document has been updated to reflect that the slowdown was caused solely by unbounded lookback queries.

---

## Summary

Starting at 21:16 UTC on March 24, 2026, ClickHouse query latency spiked sharply, with p99 reaching 4.065 s and p50 reaching 3.072 s by 21:20–21:21 UTC. The slowdown was caused by a small number of `AuditLogQuery` requests bearing extremely wide, unfiltered time ranges (up to ~716 hours / ~29.8 days), which forced a full-partition scan across all three ClickHouse shards simultaneously. This compounded with transient part-count pressure (MaxPartCountForPartition peaking at 20 at 21:25 UTC), which was normal ClickHouse merge activity unrelated to any migration.

The query-time overhead was not in ClickHouse execution itself — the `query` operation sub-timer stayed below 127 ms throughout. The 4 s latency resided in the `total` operation timer, indicating that time was spent acquiring ClickHouse connection-pool slots (ConcurrencyControlSlotsDelayed fired at 21:19 UTC on node-0 and 21:22 UTC on node-2) while long-running wide-range queries monopolized the query concurrency budget.

The initial latency spike resolved by 21:30 UTC, but wide-range queries continued intermittently from 21:41 UTC onward, sustaining elevated p99 between 0.8–1 s into the 22:xx window. The resumption of wide-range queries at 22:25–22:30 UTC drove a second burst of ConcurrencyControl delays across all three nodes, coinciding with a sharp increase in `auditlogqueries` request rate (peaking at 14/s by 22:58 UTC) that caused ClickHouse insert rates to spike to >2 000 rows/s per shard and memory to climb from ~5 GB to ~8 GB per pod. This sustained high-CPU state on the ClickHouse pods drove the `activity-apiserver` CPU throttling that began at ~22:45 UTC and peaked at 23:01–23:04 UTC — the downstream cascade identified in the original alert.

---

## Timeline

| Time (UTC) | Event |
|------------|-------|
| **20:05** | `clickhouse-migrate` Flux Kustomization job runs. It checks `schema_migrations`, finds migration `009_related_field_indexes` already applied (original run: 2026-03-12T02:40:53 UTC), and exits immediately as a no-op. No DDL or mutation operations are issued. |
| **20:05–21:15** | ClickHouse is operating normally. MaxPartCountForPartition fluctuates between 12–17 (within healthy range). ClickHouse CPU is idle (0.04–0.13 cores). |
| **21:15–21:16** | First wide-range `AuditLogQuery` requests arrive with lookback durations of ~716 hours (~29.8 days). Queries are distributed across all three shards. |
| **21:16:30** | `activity:query_duration:p99` crosses 4.035 s. The `total` operation timer (which includes connection acquisition overhead) spikes sharply; the `query` ClickHouse execution timer stays at 127 ms. |
| **21:19** | `ConcurrencyControlQueriesDelayed +1` and `ConcurrencyControlSlotsDelayed +5` fire on node-0. A query is delayed waiting for a concurrency slot while wide-range scans hold existing slots. |
| **21:20–21:21** | p99 peaks at 4.076 s; p50 peaks at 3.072 s. MaxPartCountForPartition reaches 20 on all three shards simultaneously (peak for the entire window). |
| **21:22:30** | `ConcurrencyControlQueriesDelayed +1` fires on node-2 as the same wide-range scan pattern hits that shard. |
| **21:23–21:30** | Latency begins to recover as the wide-range queries complete. p99 drops back below 0.127 s by 21:43 UTC. |
| **21:41–22:03** | Wide-range queries resume (lookback durations climbing from 71 h to 716 h across multiple apiserver instances). p99 cycles between 0.8–0.99 s. |
| **21:55–22:00** | `ConcurrencyControlSlotsDelayed` fires again on node-0 (+10, +17, +20 increments). |
| **22:00** | ClickHouse CPU rises on node-0 to 2.99 cores (normal is ~0.04 cores). Memory begins climbing from ~5 GB baseline. |
| **22:25–22:30** | `auditlogqueries` request rate climbs sharply (0→10.52/s). All three nodes experience heavy concurrent `ConcurrencyControlSlotsDelayed` activity (node-0: +77/+124/+157 in successive 30-second intervals). |
| **22:29** | Node-0 ClickHouse I/O spikes transiently to 25 MB/s write; nodes 1 and 2 follow. ClickHouse insert rates spike to 1 500–2 500 rows/s per shard (from ~400 rows/s baseline). |
| **22:30–22:35** | Memory jumps to 7–8 GB per pod across all shards. |
| **~22:45** | CPU throttling begins on `activity-apiserver` pods (rate 0.035 measured in 5-minute window). |
| **22:55** | CPU throttle rate crosses 0.13 on all three apiserver pods — the throttling alert fires. |
| **22:58** | Failed query errors appear (`error_type: iteration`) on two apiserver pods at 0.0033/s, confirming timed-out ClickHouse queries reaching clients. |
| **23:01–23:04** | Peak CPU throttle rate: 0.63 across all three apiserver pods combined. |
| **23:05–23:10** | Throttling begins declining as wide-range query traffic subsides. |

---

## Root Cause

The root cause is **unbounded `AuditLogQuery` requests submitted without an adequate time-range constraint**, starting at 21:16 UTC. Migration `009_related_field_indexes` was not a contributing factor: it ran on 2026-03-12 and the `clickhouse-migrate` job at 20:05 UTC on March 24 was a no-op. The `MaxPartCountForPartition` fluctuation between 12–20 was normal ClickHouse merge activity.

### Mechanism

`AuditLogQuery` translates directly to a ClickHouse `SELECT` against `audit.audit_logs` (and related tables). When `startTime` is set far in the past (in this case, up to 29.8 days prior), ClickHouse must scan all parts in every date partition that falls within the range. With a write rate of ~400 rows/s per shard, 29.8 days of data represents tens of millions of rows across dozens of parts.

The `query` sub-timer in `activity_clickhouse_query_duration_seconds` measures execution time once a slot is acquired — it stayed under 127 ms, indicating ClickHouse can execute the query itself if it gets to run. However, ClickHouse's `max_concurrent_queries` concurrency limit (default 100 slots, measured via `BackgroundMergesAndMutationsPoolSize: 32` for background and comparable values for query slots) was saturated by the long-running wide-range scans. Subsequent queries — including normal, well-scoped queries — were placed in the concurrency queue, producing the 4 s total latency observed. This is confirmed by `ConcurrencyControlSlotsDelayed` and `ConcurrencyControlQueriesDelayed` firing in the 21:19–21:23 window.

### Why ClickHouse CPU Spiked After 22:00 UTC

The 22:00 UTC CPU spike (0→3 cores on node-0) and subsequent memory growth from 5 GB to 8+ GB are a direct consequence of the resumed wide-range query traffic triggering more concurrent ClickHouse scans. At peak (22:28–22:30 UTC), node-0 alone received 15–32 delayed queries per 30-second interval, each scanning tens of millions of rows, exhausting available CPU and causing memory pressure as ClickHouse buffered intermediate aggregation data.

### Why the Apiserver Throttled

The activity-apiserver pods stream results from ClickHouse back to callers. When ClickHouse queries take 4 s instead of 100 ms, goroutines waiting on responses accumulate in the apiserver. The high rate of concurrent `auditlogqueries` (14/s peak) combined with slow ClickHouse responses caused the apiserver Go runtime to spawn additional goroutines for request handling, exhausting the pod's CPU limit (measured throttle rate 0.13–0.20 seconds of throttle per second across all three pods). This is not a sign of an apiserver bug — it is a predictable consequence of holding many open connections to an overloaded downstream database.

---

## Impact

| Metric | Value |
|--------|-------|
| p99 query latency peak | 4.076 s (21:21 UTC) |
| p50 query latency peak | 3.072 s (21:21 UTC) |
| Duration of primary latency spike | ~7 min (21:16–21:23 UTC) |
| Duration of elevated latency (>0.8 s p99) | ~47 min (21:16–22:03 UTC) |
| ClickHouse query errors (iteration timeouts) | ~0.0033/s on 2 of 3 apiservers starting 22:30 UTC |
| Apiserver CPU throttle onset | 22:45 UTC |
| Apiserver CPU throttle peak | 23:01–23:04 UTC (0.63 combined throttle rate) |
| ClickHouse memory increase | +2–4 GB per shard (5 GB → 8–9 GB) |
| ClickHouse insert rate spike | Up to 3 090 rows/s per shard (7x baseline of ~400 rows/s) |
| Keeper / ZooKeeper health | Not affected (zero session expirations or hardware exceptions) |

---

## Recommendations

### Immediate (within 1 sprint)

1. **Enforce a maximum lookback window on `AuditLogQuery`**. The API server should reject or cap `AuditLogQuery` requests where `endTime - startTime > X` (suggested default: 7 days; maximum configurable to 30 days). Requests from the 21:16–22:03 UTC window had lookback durations of 716 hours (~29.8 days), with some hitting 1 425 hours (~59 days). A hard cap would have prevented the scan.

2. **Add a ClickHouse query timeout for `AuditLogQuery` scans**. Set `max_execution_time` in the ClickHouse query settings (e.g., 30 s) so that runaway wide-range queries are killed by ClickHouse rather than allowed to hold concurrency slots indefinitely.

3. **Emit a warning metric / log line when a query time range exceeds a threshold**. This would have surfaced the wide-range queries in dashboards before they caused a latency impact.

### Short-term (within 1 month)

4. **Add a dashboard panel for `MaxPartCountForPartition`** with an alert threshold at 25 (warning) and 50 (critical). Part counts sustained at 12–20 are within normal range; a sustained upward trend under heavy write load is an early warning sign.

5. **Add an alert for `ConcurrencyControlQueriesDelayed > 0`** sustained over 2+ minutes. This metric fired before the latency spike was visible in p99, making it a faster leading indicator than latency histograms for this class of problem.

### Long-term

6. **Implement per-tenant and per-`AuditLogQuery` resource quotas** to limit total scan bytes or rows per request. ClickHouse supports `max_rows_to_read` and `max_bytes_to_read` settings that can be applied per query via the HTTP interface. Exposing these as configurable policy limits (e.g., via `ActivityPolicy` or a new `AuditLogQueryLimit` resource) would bound the blast radius of any single abusive query.

7. **Investigate whether the insert rate spike at 22:28–22:30 UTC correlates with a specific upstream source** (e.g., a NATS consumer replay or a backpressure release event). The 3–7x insert rate burst (400 → 2 500+ rows/s) coinciding with the high-latency query traffic is suspicious and may indicate a separate upstream producer that was retrying stalled writes.

---

## Data Sources

All metrics queried from VictoriaMetrics (`svc/vmselect-vmcluster-metrics` in `telemetry-system`, port 8481) against the `prod-infrastructure-control-plane` cluster. Investigation window: 2026-03-24T20:00:00Z – 2026-03-25T04:00:00Z.

Key metrics used:

- `activity:query_duration:p99` / `activity:query_duration:p50` — pre-computed recording rules
- `activity_clickhouse_query_duration_seconds_bucket{operation="total|query"}` — broken down by operation stage
- `activity_auditlog_query_time_range_seconds_bucket` — confirmed wide time-range queries
- `activity_auditlog_query_lookback_duration_seconds_bucket` — confirmed lookback duration
- `chi_clickhouse_metric_MaxPartCountForPartition` — part count pressure
- `chi_clickhouse_event_ConcurrencyControlQueriesDelayed` / `ConcurrencyControlSlotsDelayed` — concurrency saturation confirmation
- `chi_clickhouse_event_InsertedRows` (counter delta) — insert rate
- `container_cpu_usage_seconds_total{container="clickhouse"}` — ClickHouse CPU
- `container_memory_working_set_bytes{container="clickhouse"}` — memory growth
- `container_fs_writes_bytes_total{container="clickhouse"}` — I/O spike at 22:05 UTC
- `container_cpu_cfs_throttled_seconds_total{container="apiserver"}` — downstream throttle cascade
- `apiserver_request_total{job="activity-apiserver"}` — `auditlogqueries` POST rate
- `kube_job_status_start_time` — confirmed `clickhouse-migrate` job started at 20:05 UTC
- `chi_clickhouse_event_ZooKeeperHardwareExceptions` / `ZooKeeperSessionExpired` — confirmed Keeper was healthy throughout
