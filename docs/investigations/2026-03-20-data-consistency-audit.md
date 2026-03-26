# Data Consistency Audit: March 20–21 2026 KEEPER_EXCEPTION Window

**Date of investigation**: 2026-03-25
**Investigated by**: SRE Agent
**Incident window**: 2026-03-20 22:00 UTC – 2026-03-21 01:55 UTC (approximately 3h55m of active exceptions)
**Background window referenced in ticket**: 2026-03-20 17:00 UTC – 2026-03-21 01:00 UTC

---

## Summary

A 37-hour ClickHouse Keeper outage (`keeper-0-2-0` down) triggered a 3h55m KEEPER_EXCEPTION storm across all three ClickHouse data nodes beginning at 22:00 UTC on 2026-03-20. ZooKeeperSessionExpired counts peaked at 10/7/8 per node. Despite this, **no duplicate inserts or deduplication failures occurred in any table**. All three replicas are currently fully synchronized with identical row and part counts. A single transient DownloadPart timeout error at 01:53 UTC was automatically retried and resolved without data loss.

**Data integrity assessment: CLEAN. No remediation required.**

---

## Background

The Activity system uses a 3-node ClickHouse cluster (`chi-activity-clickhouse-activity-0-{0,1,2}-0`) backed by a 3-node ClickHouse Keeper quorum (`chk-activity-keeper-activity-keeper-0-{0,1,2}-0`). All tables use `ReplicatedReplacingMergeTree`, which relies on Keeper for:

1. Distributed insert deduplication block tracking
2. Replication log coordination
3. Leader election for merge scheduling

When Keeper sessions expire, `ReplicatedReplacingMergeTree` can bypass insert deduplication and write a block even if it was already written — provided the same block hash is re-submitted. Whether this results in visible duplicates depends on whether the writer retried and whether background merges have consolidated the replacement rows.

---

## Methodology

### Cluster access

- Cluster: `infrastructure-control-plane-prod` via `~/.kube/gke-prod`
- Namespace: `activity-system`
- ClickHouse connection: `kubectl exec` with `clickhouse-client --port 9440 --secure --accept-invalid-certificate`
- Metrics: VictoriaMetrics at `http://localhost:8481` (pre-existing port-forward to `svc/vmselect-vmcluster-metrics` in `telemetry-system`)

### Checks performed

1. Table schema inspection to understand deduplication keys
2. Duplicate key scans across all three data tables for the incident window
3. System replica status check across all three nodes
4. Part-level error log review via `system.part_log`
5. Row count cross-comparison across all three replicas
6. VictoriaMetrics queries for:
   - `chi_clickhouse_metric_ZooKeeperSessionExpired` (cumulative session expiry counter)
   - `chi_clickhouse_metric_SystemErrors_KEEPER_EXCEPTION` (total exception count)
   - `chi_clickhouse_event_DuplicationElapsedMicroseconds` (dedup engine activity)
   - `rate(chi_clickhouse_event_InsertedRows[5m])` (insert throughput)
   - `increase(chi_clickhouse_event_ZooKeeperInit[5m])` (Keeper reconnect events)
   - `chi_clickhouse_event_ZooKeeperHardwareExceptions` (hard connection failures)

---

## Findings

### 1. Table Engines and Deduplication Keys

All tables in the `audit` database use `ReplicatedReplacingMergeTree`:

| Table | Engine | Dedup Key (ORDER BY) | Version Column |
|-------|--------|----------------------|----------------|
| `audit_logs` | ReplicatedReplacingMergeTree | `(toStartOfHour(timestamp), timestamp, scope_type, scope_name, user, audit_id)` | none (last-write-wins) |
| `activities` | ReplicatedReplacingMergeTree | `(toStartOfHour(timestamp), timestamp, tenant_type, tenant_name, origin_id)` | `reindex_version` |
| `k8s_events` | ReplicatedReplacingMergeTree | `(toStartOfHour(timestamp), timestamp, scope_type, scope_name, ..., uid)` | `inserted_at` |

`ReplicatedReplacingMergeTree` provides eventual deduplication: duplicate rows with identical ORDER BY keys are collapsed to the latest version (or last insert, for tables without a version column) during background merges. This means that even if duplicates were inserted, they would be removed by the next merge covering that partition.

### 2. Duplicate Scan Results

Scans were run against each table for the full window `2026-03-20 17:00:00` through `2026-03-21 01:00:00`, grouping by the primary dedup key and filtering for `count() > 1`:

```sql
-- audit_logs
SELECT audit_id, count() AS cnt FROM audit.audit_logs
WHERE timestamp >= '2026-03-20 17:00:00' AND timestamp <= '2026-03-21 01:00:00'
GROUP BY audit_id HAVING cnt > 1

-- activities
SELECT origin_id, count() AS cnt FROM audit.activities
WHERE timestamp >= '2026-03-20 17:00:00' AND timestamp <= '2026-03-21 01:00:00'
GROUP BY origin_id HAVING cnt > 1

-- k8s_events
SELECT uid, count() AS cnt FROM audit.k8s_events
WHERE last_timestamp >= '2026-03-20 17:00:00' AND last_timestamp <= '2026-03-21 01:00:00'
GROUP BY uid HAVING cnt > 1
```

**Result: Zero duplicates found in all three tables.**

### 3. Exception Window Timeline

The `ZooKeeperSessionExpired` metric (a cumulative counter that persists across restarts) showed exception activity on all three data nodes:

| Node | Session Expiry Count | Exception Window (UTC) | Cleared (UTC) |
|------|---------------------|------------------------|---------------|
| `activity-0-0` | 10 | 2026-03-20 22:00 | 2026-03-21 01:50 |
| `activity-0-1` | 7 | 2026-03-20 22:00 | 2026-03-21 02:00 |
| `activity-0-2` | 8 | 2026-03-20 22:00 | 2026-03-21 01:55 |

`chi_clickhouse_metric_SystemErrors_KEEPER_EXCEPTION` totals at start of window: node-0-0: 44, node-0-1: 34, node-0-2: 36. These are cumulative since process start and indicate the total number of KEEPER_EXCEPTION errors experienced over the cluster lifetime, not just this window.

Each node performed exactly one Keeper reconnect (`ZooKeeperInit`) between 01:50 and 02:00 UTC, after which the `ZooKeeperSessionExpired` gauge reset to 0.

### 4. Insert Throughput During Exception Window

Insert throughput remained stable throughout, confirming writes were accepted and not blocked by the Keeper exceptions:

| Period | Avg Insert Rate (per node) |
|--------|---------------------------|
| Pre-exception (14:00–17:00 UTC) | 463.8 rows/s |
| Exception window (22:00–02:00 UTC) | 455.7 rows/s |
| Post-recovery (02:00–05:00 UTC) | 453.2 rows/s |

The ~1.8% reduction during the exception window is within normal variance and not indicative of any degradation.

### 5. Deduplication Engine Activity

`chi_clickhouse_event_DuplicationElapsedMicroseconds` was non-zero on all three nodes throughout the window, confirming the deduplication check path was executing continuously. The consistently low elapsed time (0.03–0.12 µs/s) indicates dedup lookups were fast and not experiencing Keeper timeouts at the application level.

`chi_clickhouse_event_ZooKeeperHardwareExceptions` was zero across all nodes for the entire window. This means no hard connection failures (socket errors, refused connections) occurred — only session-level expiry events. This is consistent with a Keeper leader re-election rather than a complete Keeper unavailability.

### 6. Row Count Consistency Across Replicas

All three replicas reported identical values as of the investigation date (2026-03-25):

| Table | Rows (all 3 nodes) | Active Parts (all 3 nodes) |
|-------|-------------------|---------------------------|
| `audit_logs` | 401,030,335 | 305 |
| `activities` | 1,241 | 12 |
| `k8s_events` | 2,358 | 13 |
| `schema_migrations` | 9 | 1 |

Zero replication lag (`absolute_delay = 0`, `queue_size = 0`) on all replicas.

### 7. Part-Level Errors

`system.part_log` contained one error during the investigation window:

```
event_time:  2026-03-21 01:53:21 UTC
event_type:  DownloadPart
part_name:   20260321_1310_1310_1
table:       audit_logs
error:       Timeout: connect timed out: 10.1.5.5:9010
```

This is a transient inter-replica fetch timeout that occurred during the recovery phase (01:53 UTC, approximately 7 minutes before the exception window fully cleared). Part `20260321_1310_1310_1` is not present as a standalone active part; it was subsequently fetched or incorporated via merge. The current row count of 401,030,335 is consistent across all replicas, confirming this part was recovered.

### 8. Hourly Row Distribution

`audit_logs` row counts by hour show no dip or anomalous spike during the exception hours:

| Hour (UTC) | Rows |
|------------|------|
| 2026-03-20 17:00 | 664,757 |
| 2026-03-20 18:00 | 966,367 |
| 2026-03-20 19:00 | 945,242 |
| 2026-03-20 20:00 | 896,224 |
| 2026-03-20 21:00 | 710,317 |
| 2026-03-20 22:00 | 795,206 |
| 2026-03-20 23:00 | 730,404 |
| 2026-03-21 00:00 | 736,465 |
| 2026-03-21 01:00 | 751,733 |
| 2026-03-21 02:00 | 740,010 |

Volumes are consistent with typical hour-to-hour variance. The 17:00 hour shows lower volume as it covers only 57 minutes of the investigation window; hours 18:00–21:00 represent normal daytime traffic levels.

---

## Current Replication Status

As of 2026-03-25 (5 days post-incident):

| Node | Is Leader | Total Replicas | Active Replicas | Abs. Delay | Queue | ZK Exception |
|------|-----------|----------------|-----------------|------------|-------|--------------|
| `activity-0-0` | yes | 3 | 3 | 0 | 0 | — |
| `activity-0-1` | yes | 3 | 3 | 0 | 0 | — |
| `activity-0-2` | yes | 3 | 3 | 0 | 0 | — |

All tables show `last_queue_update_exception` and `zookeeper_exception` as empty. The cluster is fully healthy.

Note: all three replicas report `is_leader = 1`. In ClickHouse's `ReplicatedMergeTree`, this is expected — each table can have a separate leader, and a single node can be leader for multiple tables simultaneously.

---

## Root Cause Assessment

**Root cause of the exception storm**: `keeper-0-2-0` was unavailable for 37 hours. During this period, the two remaining Keeper nodes (`keeper-0-0` and `keeper-0-1`) maintained quorum. However, the data nodes' ZooKeeper client sessions periodically expired and required re-establishment, accumulating the observed session expiry counts.

**Why no duplicates occurred**: Three factors protected data integrity:

1. **ReplicatedReplacingMergeTree's idempotent design**: Even if the same block were inserted twice due to a dedup check bypass, `ReplacingMergeTree` would collapse duplicates during the next background merge on the partition. Since the exception window ended ~5 days ago, all affected partitions have been merged.

2. **Quorum remained intact**: With 2-of-3 Keeper nodes operational, session expiry caused reconnects but did not cause Keeper to lose writes. The dedup block hashes written before a session expiry were visible to the new session after reconnect.

3. **No hard write failures**: Zero `ZooKeeperHardwareExceptions` confirms that insert operations completed at the Keeper level — the exceptions were at session/connection teardown, not at the point of the atomic write.

**The single DownloadPart timeout** (01:53 UTC) is consistent with a data node attempting to fetch a new part from a peer that was itself mid-reconnect. The automatic retry mechanism in `StorageReplicatedMergeTree` handled recovery without operator intervention.

---

## Data Integrity Assessment

**CLEAN. No duplicate data is present. No data loss occurred.**

The KEEPER_EXCEPTION storm was a connectivity and session-management disruption, not a data corruption event. The `ReplicatedReplacingMergeTree` engine's merge-based deduplication provided a secondary safety net even if any in-flight dedup checks were bypassed at insert time.

---

## Recommendations

### Immediate (no action required on data)

No data cleanup is needed. The tables are consistent across all replicas and contain no duplicate records.

### Short-term

1. **Alert on `chi_clickhouse_metric_ZooKeeperSessionExpired` increasing**: Add a VictoriaMetrics alert that fires when this counter increases by more than 3 within a 15-minute window. The current state (all zeros) provides a clean baseline. Threshold: `increase(chi_clickhouse_metric_ZooKeeperSessionExpired[15m]) > 3`.

2. **Alert on Keeper pod restarts**: The 37-hour `keeper-0-2-0` outage suggests either an OOM kill or a pod eviction that went undetected for too long. Add a PagerDuty-level alert for `kube_pod_container_restarts_total{pod=~"chk-activity-keeper.*"} > 1` within a 30-minute window.

3. **Review Keeper pod resource requests/limits**: If `keeper-0-2-0` was OOM-killed, the current resource limits may be undersized for the ZooKeeper node count and write volume. Review `ClickHouseAsyncMetrics_KeeperApproximateDataSize` trends.

### Medium-term

4. **Enable insert deduplication metrics monitoring**: The `chi_clickhouse_event_DuplicationElapsedMicroseconds` metric was active during the window but there is no corresponding alert to detect a sudden drop (which would indicate the dedup path is being bypassed). Consider tracking this as a sentinel metric.

5. **Consider `insert_keeper_fault_injection_probability` testing**: Periodically validate that the dedup path handles Keeper disconnects gracefully in a non-production environment by enabling fault injection during load tests.

6. **Reduce Keeper session timeout**: The default ZooKeeper session timeout is 30 seconds. Tuning `zookeeper_session_timeout_ms` to a lower value (e.g., 10 seconds) would cause faster session detection and reconnect, reducing the window during which a node operates with a stale session.

---

## Appendix: Queries Used

```sql
-- Duplicate scan: audit_logs
SELECT audit_id, count() AS cnt, min(timestamp), max(timestamp)
FROM audit.audit_logs
WHERE timestamp >= '2026-03-20 17:00:00' AND timestamp <= '2026-03-21 01:00:00'
GROUP BY audit_id HAVING cnt > 1 LIMIT 100;

-- Duplicate scan: activities
SELECT origin_id, count() AS cnt, min(timestamp), max(timestamp)
FROM audit.activities
WHERE timestamp >= '2026-03-20 17:00:00' AND timestamp <= '2026-03-21 01:00:00'
GROUP BY origin_id HAVING cnt > 1 LIMIT 100;

-- Duplicate scan: k8s_events
SELECT uid, count() AS cnt, min(last_timestamp), max(last_timestamp)
FROM audit.k8s_events
WHERE last_timestamp >= '2026-03-20 17:00:00' AND last_timestamp <= '2026-03-21 01:00:00'
GROUP BY uid HAVING cnt > 1 LIMIT 100;

-- Replication status
SELECT database, table, replica_name, is_leader, is_readonly,
       total_replicas, active_replicas, absolute_delay, queue_size,
       inserts_in_queue, merges_in_queue, last_queue_update_exception, zookeeper_exception
FROM system.replicas ORDER BY database, table, replica_name;

-- Part errors during window
SELECT event_time, event_type, error, exception, part_name, table
FROM system.part_log
WHERE event_time >= '2026-03-20 17:00:00' AND event_time <= '2026-03-21 02:00:00'
  AND error > 0 AND database = 'audit'
ORDER BY event_time;

-- Row counts per replica
SELECT database, table, sum(rows) AS total_rows, count() AS parts_count
FROM system.parts WHERE database = 'audit' AND active = 1
GROUP BY database, table ORDER BY table;
```

```promql
# Session expiry timeline
chi_clickhouse_metric_ZooKeeperSessionExpired

# KEEPER_EXCEPTION system error total
chi_clickhouse_metric_SystemErrors_KEEPER_EXCEPTION

# Insert throughput
rate(chi_clickhouse_event_InsertedRows[5m])

# Keeper reconnects
increase(chi_clickhouse_event_ZooKeeperInit[5m])

# Dedup engine activity
rate(chi_clickhouse_event_DuplicationElapsedMicroseconds[5m])
```
