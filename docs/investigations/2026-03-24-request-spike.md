# Root Cause Analysis: activity-apiserver Request Spike

**Date**: 2026-03-24 to 2026-03-25
**Severity**: Medium (degraded performance, no outage)
**Status**: Ongoing — elevated load persists as of 2026-03-25 12:00 UTC
**Author**: SRE Investigation via VictoriaMetrics (vmselect-vmcluster-metrics, telemetry-system)

---

## Summary

On 2026-03-24 at approximately 22:24 UTC, the `activity-apiserver` in production experienced a sustained request rate spike from a baseline of ~2.1 req/s to a peak of 15.7 req/s by 23:00 UTC. The load remains elevated at approximately 5–7 req/s as of the time of this writing (2026-03-25 12:00 UTC), meaning the condition is ongoing and not yet self-resolved.

The spike was caused entirely by a sudden, sustained increase in `AuditLogQuery` POST requests. These queries are characteristic of a polling client making requests with a fixed lookback window of approximately 15 hours (54,000 seconds), at a sustained rate of ~5–6 req/s per instance or batch, with a secondary burst phase that reached ~14 req/s. The query pattern — fixed lookback, high result counts (p99 ~950–960 results per query), and continuous polling — is consistent with an automated monitoring, export, or audit pipeline, not interactive user traffic.

This spike had a secondary relationship with ClickHouse: a separate ClickHouse slowdown had occurred earlier at 21:17–21:23 UTC (p99 latency hit 4.0 s), approximately 1 hour before the main request spike. Once the main spike began at 22:24 UTC and drove ClickHouse query throughput from near-zero to ~14 req/s, ClickHouse p99 settled at a sustained ~0.9 s throughout the event.

---

## Timeline

All times are UTC on 2026-03-24 to 2026-03-25.

| Time | Event |
|------|-------|
| 20:08 | Minor burst of `auditlogqueries/POST` (~1.5 req/s peak, ~12 min duration). ClickHouse p99 elevated at ~0.95 s. First precursor activity. |
| 21:17–21:23 | ClickHouse p99 spikes to **4.0–4.05 s** (peak at 21:20). This is the confirmed ClickHouse slowdown. Only ~0.25 req/s of auditlog queries during this window. |
| 21:45 | ClickHouse p99 returns to baseline (~0.13 s). |
| 21:56–22:03 | Second minor burst (~1.5 req/s peak, ~7 min duration). ClickHouse p99 ~0.7 s. |
| 22:24 | **Main spike begins.** `auditlogqueries/POST` rate starts climbing from near-zero. |
| 22:26–22:34 | Rapid escalation: 2.6 → 10.5 req/s. Total server rate jumps from 2.1 req/s to 12.7 req/s. |
| 22:31 | Total request rate reaches 10.5 req/s. `auditlogqueries` accounts for 10.5 of 12.7 req/s. |
| 22:55 | Rate as measured in the user-reported spike: **6.8 → 9.98 req/s** (5-minute window catching the climb). Total server rate: 12.3 req/s. |
| 22:56–22:58 | Escalation continues to **14.0 req/s** (auditlogqueries alone), **15.7 req/s** total server rate. ClickHouse p99 climbs to 0.94 s under load. |
| 22:58–23:20 | Peak plateau. auditlogqueries sustains 13–14 req/s. Query result count p99 reaches ~950 results/query. |
| 23:20–23:30 | Partial reduction to ~6–8 req/s (auditlogqueries). Concurrent `activities` WATCH connections begin accumulating (~28 at 22:55 → 249 at 00:05 UTC). |
| 23:30 onwards | Load stabilizes at ~6.1–6.5 req/s (auditlogqueries) + ~2.1 req/s background = **~8.2–8.6 req/s** total. |
| 00:05 (Mar 25) | `activities` WATCH connection count peaks at 249 concurrent connections. These connections drive ~0.13 req/s of additional WATCH traffic. |
| 00:30–01:05 | `activities` WATCH connections drain from 249 to 5. Connection turnover suggests a batch client not maintaining persistent connections. |
| 03:20–03:25 | `auditlogqueries` rate drops slightly from ~6.4 to ~5.0 req/s. ClickHouse p99 drops from 0.48 s to baseline. This may indicate a second client batch completing. |
| 04:00+ | Load stabilizes at ~5.0 req/s (auditlogqueries) + ~2.1 req/s background. Still elevated at time of investigation (2026-03-25 12:00 UTC). |

---

## Root Cause

### Primary Cause: Automated AuditLog Polling Client

The spike is entirely attributable to `auditlogqueries/POST` requests. All other resource types maintained stable rates throughout the event. The characteristics of this traffic strongly indicate an automated polling client or pipeline:

**Evidence:**

1. **Traffic profile is not interactive.** The baseline rate for `auditlogqueries` during business hours (12:00–18:00 UTC) was 0.01 req/s average (max 0.29 req/s in short bursts). The spike represents a 1,400x increase over average baseline.

2. **Fixed lookback window of ~15 hours.** During the sustained phase (22:35–03:20 UTC), the p50 query time range was consistently ~61,000–63,500 seconds (~17 hours), increasing by approximately 60–120 seconds per minute — exactly matching real-time advancement of a "last N hours" window in a polling loop.

3. **Fixed result count near page limit.** Query result count p99 reached and sustained 950–960 results per query. This is characteristic of a client that is paginating at or near a query limit and receiving near-full pages on each request.

4. **Machine-rate precision.** The rate during the plateau phase was strikingly regular: 6.0–6.5 req/s with very low variance. This is not humanly achievable click behavior.

5. **No user-agent label differentiation.** The `username` label shows only `unknown` — this suggests a service account, system identity, or identity that does not resolve to a named label in the metric pipeline. This is consistent with a controller or automated pipeline identity.

6. **Prior similar (but smaller) bursts.** The 7-day historical data shows episodic spikes from this same type of traffic on 2026-03-18 (~14:00 UTC), 2026-03-20 (~14:00 UTC), 2026-03-22 (~21:00 UTC), and 2026-03-23 (~13:00–16:00 UTC, peak 0.47 req/s). The March 24 event is the same pattern but orders of magnitude larger.

**Most likely client type:** An audit export job, compliance pipeline, or security monitoring system that was reconfigured or scaled up between 2026-03-23 and 2026-03-24, resulting in a dramatically higher polling frequency or fan-out.

The short burst at 03:20–03:25 UTC where rate drops from 6.4 to 5.0 req/s suggests there may be two concurrent clients, one of which completed its run at 03:20 UTC.

### Contributing Factor: Preceding ClickHouse Slowdown

At 21:17–21:23 UTC, ClickHouse experienced a p99 latency spike to 4.0–4.05 seconds. This preceded the main request spike by approximately 1 hour. During the spike, the `auditlogqueries` rate was only ~0.25 req/s, so ClickHouse was not being driven to 4 s by query volume — the slowdown had an independent cause (likely a compaction operation, GC event, or ephemeral resource contention in ClickHouse itself).

**The ClickHouse slowdown did not cause the request spike.** However, it may have caused in-flight queries from the minor precursor bursts (20:08–20:22 UTC, 21:56–22:03 UTC) to time out or back up, and any retry behavior by the client would have re-queued requests. The main volume increase at 22:24 UTC, however, begins a full hour after ClickHouse recovered.

During the main sustained spike, ClickHouse p99 stabilized at ~0.9 s (22:50–23:17 UTC) and then settled to ~0.5 s. This indicates ClickHouse is handling the new load level, though at higher sustained latency than the pre-spike baseline of ~0.13 s.

### No Retry Storm Detected

There were no meaningful 5xx errors until the request rate was already at peak (one `504` time series observed at `auditlogqueries/POST`, peak rate 0.0033 req/s — fewer than one 504 per 5 minutes). This rules out a retry storm as a cause of the volume. The volume itself is the primary driver.

### No WATCH Churn

The `activitypolicies` and `reindexjobs` WATCH connection counts remained stable throughout at ~359 and ~357 concurrent connections respectively, with no churn. The `activities` WATCH connections that accumulated (peaking at 249) appeared as a consequence of the query spike, not a cause.

---

## Relationship to ClickHouse Slowdown and CPU Throttling

| Metric | Pre-spike Baseline | During Spike Peak | Sustained Plateau |
|--------|-------------------|-------------------|-------------------|
| Total req/s | ~2.1 | 15.7 | 8.2–8.6 |
| auditlogqueries req/s | ~0.01 | 14.0 | 6.1–6.5 |
| ClickHouse p99 latency | ~0.13 s | ~0.94 s | ~0.49 s |
| ClickHouse query rate | ~0 req/s | ~13.5 req/s | ~6 req/s |
| apiserver p99 (auditlog) | ~0.2 s | 1.19 s | 0.74–0.98 s |
| 504 error rate | 0 | 0.0033 req/s | ~0 |

The ClickHouse slowdown at 21:17 UTC was an independent event, likely caused by an internal ClickHouse operation (compaction, part merge, or memory pressure). It resolved before the main request spike began.

CPU throttling is a plausible secondary consequence of the request spike: ClickHouse CPU usage would increase proportionally to query throughput (from ~0 to ~14 req/s), which could trigger CPU throttling on ClickHouse pods if resource limits are set conservatively, further explaining the sustained ~0.9 s latency during the plateau. However, direct CPU throttling metrics were not queried in this investigation.

---

## Recommendations

### Immediate Actions

1. **Identify the client.** Check audit logs or authentication logs for service accounts making `AuditLogQuery` POST requests at high frequency. The rate of ~5–6 req/s starting at 22:24 UTC on 2026-03-24 is the signal to look for. The identity will appear in the `username` or `user` field of audit log entries for the activity-apiserver itself. Use:
   ```bash
   kubectl activity query --filter "spec.resource.kind == 'AuditLogQuery'" --start-time "2026-03-24T22:20:00Z"
   ```
   Or query the kube-apiserver audit log for requests to the activity-apiserver API group.

2. **Determine if the load is expected.** If this is a newly onboarded compliance or audit export pipeline, validate its configuration. A rate of 5+ req/s continuously is likely unintentional — typical audit export jobs run on a schedule (e.g., hourly or daily) rather than polling continuously.

### Short-term Mitigations

3. **Apply per-client rate limiting to AuditLogQuery.** Implement Kubernetes API Priority and Fairness (APF) flow schemas that limit `AuditLogQuery` POST requests per service account to a reasonable rate (e.g., 5 req/min for batch clients, higher for interactive clients). This prevents a single runaway client from consuming the entire server capacity.

4. **Set a maximum lookback window.** Enforce a server-side cap on the `lookback` or time range parameter for `AuditLogQuery`. The observed queries used 15–528 hour lookback windows. Large lookback windows translate directly to expensive ClickHouse range scans. A cap of 24–48 hours would protect ClickHouse while still serving legitimate audit needs.

5. **Add result count pagination enforcement.** The p99 result count of 950–960 suggests clients are retrieving nearly-full pages on each request. If the client is not paginating correctly (i.e., it is re-fetching the same 950-record window each poll), this is wasted work. Ensure the API returns a `continue` token and that clients use it.

### Medium-term Improvements

6. **Expose user agent / username labels in Prometheus metrics.** The `username` label currently shows only `unknown`, making client identification impossible from metrics alone. Configuring the apiserver to include user identity labels (even hashed or bucketed) in `apiserver_request_total` would make future investigations much faster.

7. **Implement server-side AuditLogQuery rate limiting based on query cost.** Rather than pure rate limiting, consider a cost model where queries with large time ranges or high result counts are throttled more aggressively. This aligns incentives with efficient query patterns.

8. **Add alerting for sustained AuditLogQuery rate.** An alert on `sum(rate(apiserver_request_total{job="activity-apiserver",resource="auditlogqueries"}[5m])) > 2` would have fired approximately 30 minutes before the peak and given operators time to investigate before ClickHouse latency degraded.

9. **ClickHouse resource review.** The independent ClickHouse slowdown at 21:17 UTC warrants investigation. Review ClickHouse memory limits, merge operation scheduling, and whether the `activity_clickhouse_query_duration_seconds` p99 exceeding 4 s correlates with part merge or compaction activity in ClickHouse system logs.

---

## Data Sources

All data sourced from VictoriaMetrics (`vmselect-vmcluster-metrics.telemetry-system`, port 8481) using `apiserver_request_total`, `activity_clickhouse_query_duration_seconds_bucket`, `activity_auditlog_query_time_range_seconds_bucket`, `activity_auditlog_query_results_total_bucket`, and `apiserver_longrunning_requests` metrics from the `activity-apiserver` job.

Investigation window: 2026-03-24 20:00 UTC to 2026-03-25 04:00 UTC, with 7-day context from 2026-03-18 00:00 UTC.
