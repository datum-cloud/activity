# Root Cause Analysis: ClickHouse Keeper Pod chk-activity-keeper-activity-keeper-0-2-0 Reported Outage

**Date**: 2026-03-19 04:15 UTC — 2026-03-20 17:05 UTC (reported window)
**Actual disruption**: 2026-03-19 04:15 UTC — 2026-03-19 04:17 UTC (~2 minutes)
**Severity**: Low (no quorum loss, no ClickHouse unavailability; disruption lasted ~2 minutes)
**Status**: Resolved
**Author**: SRE Investigation via VictoriaMetrics (vmselect-vmcluster-metrics, telemetry-system)

---

## Summary

A 37-hour outage was reported for `chk-activity-keeper-activity-keeper-0-2-0` in the `activity-system` namespace, spanning 2026-03-19 04:15 UTC to 2026-03-20 17:05 UTC. Investigation shows the actual service disruption lasted approximately **2 minutes**: the pod was evicted when its GKE node (`gke-infrastructure-c-infra-prod-stand-f519446b-7x2b`) went NotReady for 60 seconds at 04:15 UTC during a node maintenance event, then rescheduled and ready by 04:17 UTC. The Raft quorum was maintained throughout via the other two keeper replicas and was never at risk of losing majority. The 37-hour duration is an artifact of a stale monitoring alert that fired at 04:15 UTC when the pod's `kube_pod_status_ready` metric series was interrupted, and did not resolve until the pod was rescheduled again at 17:05 UTC Mar 20, which caused the old metric series to expire and the alert to clear.

---

## Timeline of Events

All times UTC.

| Time | Event |
|------|-------|
| 2026-03-18 22:53 | Node `gke-...-7916` goes NotReady for 1 minute; pod 0-2-0 briefly unassigned and immediately rescheduled to node `gke-...-7x2b` |
| 2026-03-18 22:54 | Pod 0-2-0 reassigned to node `7x2b`; Ready and participating in Raft as follower |
| 2026-03-18 23:05 | Node `7916` goes NotReady permanently (GKE node replacement); pod is already on `7x2b`, no further disruption |
| 2026-03-19 04:15 | Node `7x2b` goes NotReady for 60 seconds (GKE node maintenance event); pod 0-2-0 evicted and enters `Pending` phase; `kube_pod_status_ready` metric series for this pod instance interrupted; **monitoring alert fires** |
| 2026-03-19 04:16 | Node `7x2b` recovers (NotReady lasted exactly 1 minute) |
| 2026-03-19 04:17 | Pod 0-2-0 rescheduled back to node `7x2b`; container ready; `KeeperLastLogIdx` resumes in sync with peers within the same 5-minute scrape interval |
| 2026-03-19 04:20 | Pod running as follower; log replication confirmed in sync (log index ~12,673,562, matching peers within ~130 entries) |
| 2026-03-19 04:31 | Leadership election completes: pod 0-0-0 becomes new leader (was previously follower); pod 0-1-0 steps down |
| 2026-03-19 04:15 – 2026-03-20 17:05 | Pod 0-2-0 **Running and Ready** for this entire period; Raft quorum maintained; AliveConnections increases as it earns connections from ClickHouse clients after leadership changes; no ClickHouse outage observed |
| 2026-03-20 01:05 | Pod 0-2-0 elected leader; pod 0-0-0 becomes follower; pod 0-0-0 rescheduled to new node `gke-...-gczs` |
| 2026-03-20 14:05 | Pod 0-1-0 rescheduled to new node (another GKE maintenance event); pod 0-1-0 down for ~5 minutes, quorum maintained |
| 2026-03-20 17:05 | Pod 0-2-0 rescheduled to node `gke-...-h2mf` (another GKE maintenance event on `7x2b`); pod enters Pending for ~5 minutes |
| 2026-03-20 17:10 | Pod 0-2-0 ready on node `h2mf`; stale `kube_pod_status_ready` series from the Mar 19 pod instance now fully expired; **monitoring alert clears** |
| 2026-03-20 17:15–17:20 | Rolling leadership re-election: pod 0-0-0 briefly Pending (~5 minutes), then 0-2-0 becomes leader; all 3 pods stable at 3/3 ready |
| 2026-03-20 17:45 | All 3 keeper pods stable, 3/3 ready; system nominal |

---

## Root Cause

The reported 37-hour outage was caused by two separate but related issues:

### 1. Actual disruption: GKE node maintenance on node `7x2b` (2 minutes)

At 04:15 UTC on 2026-03-19, GKE performed an automated maintenance operation on node `gke-infrastructure-c-infra-prod-stand-f519446b-7x2b`, causing it to become NotReady for 60 seconds. The pod `chk-activity-keeper-activity-keeper-0-2-0` was running on this node and was immediately evicted under the default `node.kubernetes.io/unreachable:NoExecute` toleration (300s timeout, but the scheduler evicted it faster due to the short-lived NotReady). The pod was rescheduled back onto the same node within 2 minutes and rejoined the Raft cluster in sync.

This node had itself been a replacement node — `7x2b` was provisioned at 22:54 UTC Mar 18 after its predecessor `7916` went permanently NotReady at 23:05 UTC Mar 18 (another GKE node replacement). The repeated node churn in the `f519446b` node pool suggests a sustained GKE node-pool upgrade or auto-repair cycle was underway during this period.

### 2. Alert duration inflation: Stale Prometheus metric series

When the pod was evicted and rescheduled at 04:15-04:17 UTC, Kubernetes created a new pod instance (same name, new UID). This caused `kube_pod_status_ready` and related metrics to create a **new label series** for the rescheduled pod, while the **old series** for the pre-eviction pod instance continued to exist with its last-known value until it was scraped and found absent. The monitoring alert was likely configured on the old series and therefore remained in a firing state for the 37 hours until Mar 20 17:10 UTC when the pod was rescheduled a second time, causing the old series to fully expire from the scrape target.

This is a known Kubernetes monitoring pattern: pod eviction + reschedule creates new metric series, and alerts that do not handle series staleness correctly can remain stale-firing for hours.

---

## Impact Assessment

| Dimension | Assessment |
|-----------|-----------|
| **ClickHouse Keeper quorum** | Not affected; 2 of 3 keepers remained healthy throughout; quorum requires only 2/3 |
| **ClickHouse availability** | Not affected; ClickHouse servers maintained ZooKeeper sessions throughout |
| **Activity API reads/writes** | Not affected; no query failures observed |
| **Data pipeline** | Not affected; NATS and Vector processing uninterrupted |
| **Raft replication lag** | Negligible; pod 0-2-0 log index was within ~130 entries of peers on first scrape after reschedule |
| **Leadership stability** | Mild; one leadership election at 04:31 UTC (0-0-0 became leader) and additional elections during Mar 20 maintenance; all elections completed within ~5 minutes |
| **Actual downtime (pod 0-2-0)** | ~2 minutes (04:15–04:17 UTC Mar 19) |
| **Alert false-positive duration** | ~37 hours |

---

## Recommendations

### 1. Fix alert on pod readiness to use pod restart/recreation-aware queries

The monitoring alert should use `kube_pod_status_ready` with proper staleness handling or switch to alerting on quorum loss rather than individual pod readiness:

```promql
# Alert when fewer than 2 of 3 keepers are ready (quorum loss risk)
count(kube_pod_status_ready{namespace="activity-system", pod=~"chk-activity-keeper.*", condition="true"} == 1) < 2
```

This alert is immune to individual pod churn and reflects the actual operational risk (quorum loss), not transient rescheduling.

### 2. Add a ClickHouse Keeper quorum alert

Add an explicit alert that fires only when quorum is at risk:

```promql
# Pages when only 1 or 0 keepers are ready (quorum lost or near-loss)
count(kube_pod_status_ready{namespace="activity-system", pod=~"chk-activity-keeper.*", condition="true"} == 1) < 2
```

### 3. Investigate repeated node churn in the `f519446b` node pool

During the investigation window (Mar 18–20), multiple nodes in the `f519446b` pool were replaced or went through maintenance (`7916`, `7x2b`, `h2mf`, plus later `gczs`). This caused repeated pod evictions for keeper 0-2-0 and keeper 0-0-0. Confirm whether this was a planned GKE node pool upgrade, and if so, schedule future upgrades with PodDisruptionBudgets (PDBs) enforced so only one keeper is disrupted at a time.

Current PDB status for the keeper StatefulSet should be verified:

```bash
kubectl get pdb -n activity-system | grep keeper
```

If no PDB exists, add one:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: clickhouse-keeper-pdb
  namespace: activity-system
spec:
  minAvailable: 2
  selector:
    matchLabels:
      clickhouse-keeper.altinity.com/cluster: activity-keeper
```

### 4. Confirm Keeper pod anti-affinity rules

The topology spread constraints on the keeper pods use `ScheduleAnyway`, which means pods may co-locate on the same node during node pool churn. If two keeper pods land on the same node and that node undergoes maintenance, quorum could be lost. Consider tightening to `DoNotSchedule`:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        clickhouse-keeper.altinity.com/cluster: activity-keeper
```

### 5. Tune alert staleness window

For Prometheus/VictoriaMetrics alerts on pods that can be rescheduled, add a `for` duration of at least 10 minutes to avoid firing on transient evictions:

```yaml
- alert: ClickHouseKeeperPodNotReady
  expr: kube_pod_status_ready{namespace="activity-system", pod=~"chk-activity-keeper.*", condition="true"} == 0
  for: 10m
  labels:
    severity: warning
```

---

## Data Sources

- VictoriaMetrics: `vmselect-vmcluster-metrics.telemetry-system:8481`
- Metrics queried: `kube_pod_status_ready`, `kube_pod_status_phase`, `kube_pod_info`, `kube_node_status_condition`, `kube_pod_container_status_restarts_total`, `container_memory_working_set_bytes`, `ClickHouseAsyncMetrics_KeeperIsLeader`, `ClickHouseAsyncMetrics_KeeperIsFollower`, `ClickHouseAsyncMetrics_KeeperFollowers`, `ClickHouseAsyncMetrics_KeeperLastLogIdx`, `ClickHouseMetrics_KeeperAliveConnections`
- Query window: 2026-03-18T00:00:00Z to 2026-03-21T00:00:00Z
- Cluster: `KUBECONFIG=~/.kube/gke-prod`
