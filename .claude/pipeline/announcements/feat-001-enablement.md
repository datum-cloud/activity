# Internal Enablement Brief: Kubernetes Event Processing Pipeline

**Feature ID:** feat-001-event-processing-pipeline
**Audience:** Sales, Solutions Engineering, Support
**Status:** PENDING HUMAN APPROVAL - Do not share externally until approved

---

## What It Does

The Kubernetes Event Processing Pipeline offloads event storage from etcd to ClickHouse, extending event retention from Kubernetes' default 1 hour to 60 days. Platform operators and developers can now investigate incidents that happened days or weeks ago, using familiar `kubectl` commands or the new `EventQuery` API for advanced filtering.

---

## Why It Matters

### For Platform Operators
- **Extended incident investigation** - No more "the events are gone" when investigating Monday what happened Friday.
- **Reduced etcd pressure** - Events no longer compete with critical control plane operations (pod scheduling, secret updates).
- **Real-time streaming** - Watch connections automatically replay missed events on reconnection.

### For Developers
- **Debug historical failures** - Query why a deployment failed last week, not just in the last hour.
- **Familiar tooling** - `kubectl get events` works exactly as expected; no new CLI to learn.
- **Better filtering** - Field selectors work properly: find all FailedMount events for a specific pod.

### For the Platform
- **Control plane scalability** - Events are the highest-volume write in Kubernetes. Offloading them removes a major etcd bottleneck.
- **Unified observability** - Events now feed into the Activity system, enabling correlation with audit logs.

---

## Key Talking Points

1. **60x improvement over Kubernetes default** - Native Kubernetes retains events for 1 hour. We retain them for 60 days.

2. **Zero workflow changes** - `kubectl get events` works unchanged. Power users get `EventQuery` for advanced queries.

3. **Production-grade performance** - 1,000 events/sec sustained, sub-500ms query latency, real-time streaming.

4. **Multi-tenant isolation** - Events are automatically scoped to projects. Cross-project queries are blocked for non-platform users.

5. **Included in all tiers** - Event visibility is a core capability, not a premium upsell.

---

## Demo Script

### Setup (before demo)
Ensure you have access to a project with recent activity (deployments, pod restarts, etc.).

### Demo Flow

**1. Show native event access (2 min)**
```bash
# Standard kubectl works
kubectl get events -n demo-namespace

# Field selectors work
kubectl get events --field-selector reason=Pulling

# Watch in real-time
kubectl get events -w
```
*Talking point: "This works exactly like native Kubernetes, but events persist for 60 days instead of 1 hour."*

**2. Show extended history via EventQuery (3 min)**
```yaml
# Create event-query.yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: last-week-failures
spec:
  startTime: "2026-02-11T00:00:00Z"
  endTime: "2026-02-18T00:00:00Z"
  fieldSelector: "type=Warning"
  limit: 100
```
```bash
kubectl create -f event-query.yaml -o yaml
```
*Talking point: "EventQuery lets you search the full 60-day history with time ranges and filters."*

**3. Show Activity integration (2 min)**
```bash
# Events can trigger Activities
kubectl get activities -n demo-namespace
```
*Talking point: "Events automatically become human-readable Activities, giving you a unified timeline of what happened in your cluster."*

---

## Common Questions and Answers

### Technical Questions

**Q: Does this replace the native Kubernetes Events API?**
A: No. It extends it. `kubectl get events` works unchanged, but queries are routed to ClickHouse instead of etcd. The wire format is identical `corev1.Event`.

**Q: Why is the native API limited to 24 hours?**
A: Query performance. Scanning 60 days of events for every `kubectl get events` would be slow. Use `EventQuery` when you need extended time ranges.

**Q: What happens if NATS or ClickHouse is unavailable?**
A: Events are buffered in NATS JetStream for up to 1 hour. The system gracefully degrades and retries. No event loss during typical infrastructure disruptions.

**Q: Can I watch events from the past?**
A: Yes. Watch connections support `resourceVersion`-based replay. If your connection drops, you can resume from where you left off.

### Commercial Questions

**Q: Is this feature available on all tiers?**
A: Yes. Event visibility is a core capability included in all tiers. The commercial lever is retention duration:
- Free: 24-hour query access
- Pro: 60-day full access
- Enterprise: 90+ days configurable

**Q: What are the storage limits?**
A:
- Free: 1 GB per project
- Pro: 50 GB per project
- Enterprise: Unlimited (fair use)

**Q: Are there rate limits?**
A:
- Free: 100 events/min (soft), 500/min (hard)
- Pro: 1,000 events/min (soft), 5,000/min (hard)
- Enterprise: No limits

### Competitive Questions

**Q: How does this compare to Datadog/New Relic?**
A: Those are observability platforms that treat Kubernetes events as "just another data source." We provide native `kubectl` integration - no new CLI, no separate query language, no per-GB charges within tier.

**Q: What about native Kubernetes?**
A: Native Kubernetes stores events in etcd with a 1-hour TTL. We extend retention to 60 days and add advanced query capabilities without changing the developer experience.

---

## Pricing and Quota Summary

| Tier | Query Access | Storage Quota | Rate Limit |
|------|-------------|---------------|------------|
| Free | 24 hours | 1 GB | 100 events/min |
| Pro | 60 days | 50 GB | 1,000 events/min |
| Enterprise | 90+ days (configurable) | Unlimited | Unlimited |

**Key positioning:** Events are not a premium feature - they are essential for debugging. The commercial lever is retention duration, which directly aligns with our storage costs.

---

## Objection Handling

**"We already have Datadog for Kubernetes monitoring."**
Response: Datadog is great for metrics and APM. This is about native Kubernetes event visibility in your control plane - no context switching, no additional agents, works with existing `kubectl` muscle memory.

**"Why would I pay for something Kubernetes gives me for free?"**
Response: Kubernetes gives you 1 hour of event history stored in etcd (which creates control plane pressure). We give you 60 days of history with no etcd impact. The question is: how often do you need to investigate something that happened more than an hour ago?

**"Can't I just run my own event sink?"**
Response: Absolutely. Many large operators do. We've built and operate it so you don't have to - with multi-tenant isolation, performance guarantees, and native kubectl integration.

---

## Links and Resources

- Spec: `.claude/pipeline/specs/feat-001-event-processing-pipeline.md`
- Design: `.claude/pipeline/designs/feat-001-event-processing-pipeline.md`
- Pricing: `.claude/pipeline/pricing/feat-001-event-processing-pipeline.md`

---

**REMINDER:** This brief is PENDING HUMAN APPROVAL. Do not share externally or reference in customer conversations until the announce gate is cleared.
