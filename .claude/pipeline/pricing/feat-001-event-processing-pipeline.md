# Pricing Brief: Kubernetes Event Processing Pipeline

## Handoff

- **From**: commercial-strategist
- **To**: architect
- **Gate**: pricing (requires human approval)
- **Decisions Made**:
  - Event storage is a core platform capability included in all tiers (not gated by tier)
  - **ClickHouse TTL set to 60 days** (storage layer default)
  - Retention is the primary commercial lever, tiered as: Free (24h query access), Pro (60d full access), Enterprise (90d+ configurable)
  - No per-event pricing; storage quota measured in GB per project
  - Rate limiting to prevent abuse: 100 events/min soft, 1000/min hard for Free tier
  - Enterprise gets configurable retention beyond 60 days
  - Event query API included at all tiers; no query-based metering
- **Open Questions**:
  - [FOR ARCHITECT] Should retention be enforced at write time (TTL) or via background cleanup? Affects implementation complexity.
  - [FOR PRODUCT] Should Pro tier have a retention upgrade add-on (e.g., pay $X/month for 30-day retention)?
  - [FOR FINANCE] What is our target gross margin on storage? 50%? 70%? This affects whether we can offer generous Free tier limits.
  - [FOR LEGAL] Any data retention compliance requirements that mandate minimum or maximum retention periods?
  - [FOR ARCHITECT] Cross-project admin queries deferred to v2 - will Enterprise tier customers expect this at launch?

---

## Executive Summary

The Kubernetes Event Processing Pipeline should be positioned as a **core platform capability** included in all pricing tiers. Event visibility is fundamental to debugging and operations - gating access would create a frustrating experience that damages platform perception.

The commercial lever is **retention duration**, not access. This follows industry patterns where basic observability is included but extended retention and advanced features drive tier upgrades.

**Recommended Structure:**

| Tier | Query Access | Storage Quota | Rate Limit | Rationale |
|------|-------------|---------------|------------|-----------|
| Free | 24 hours | 1 GB | 100 events/min | Sufficient for evaluation and hobby projects |
| Pro | **60 days** (full storage access) | 50 GB | 1000 events/min | Covers production workloads with extended history |
| Enterprise | **90+ days** (configurable TTL) | Unlimited | Unlimited | Meets compliance and enterprise SLA needs |

**Note:** ClickHouse stores all events for 60 days by default. Free tier query access is limited to 24h at query time.

---

## Commercial Model Analysis

### Why Events Should Be a Core Feature (Not Premium)

**1. Operational Necessity**
Events are not a "nice to have" - they are essential for debugging Kubernetes workloads. A platform that hides events behind a paywall would be operationally hostile. Users expect `kubectl get events` to work.

**2. Etcd Pressure Is Our Problem**
The primary motivation for this feature is reducing etcd storage pressure in the Milo control plane. This is a platform health concern, not a premium feature. We should not charge users to solve our infrastructure scaling problem.

**3. Competitive Baseline**
All major Kubernetes platforms (GKE, EKS, AKS) include event access. The question is not whether to provide events, but how much history to retain.

**4. Trust and Transparency**
Events reveal what the platform is doing. Hiding them would reduce trust. Platform operators and developers need visibility into system behavior.

### Why Retention Is the Right Commercial Lever

**1. Cost Alignment**
Longer retention = more storage = higher cost. Charging for retention directly aligns pricing with our cost structure.

**2. Clear Value Proposition**
"7 days of event history" is easy to understand and communicate. Users can see exactly what they're getting.

**3. Natural Upgrade Trigger**
Users upgrade when they need more history, typically after an incident where they wished they had older data. This is a "growth" upgrade trigger (positive) not a "frustration" trigger (negative).

**4. Industry Precedent**
This matches how observability leaders price retention:
- Datadog: 1-day (free) vs 15 months (paid)
- New Relic: 8 days (standard) vs 90 days (Data Plus)
- Dynatrace: Retention is a configurable consumption dimension

---

## Tier Design

### Free Tier: 24-Hour Retention

**Included:**
- Full event query API access (field selectors, watch)
- 24-hour event retention
- 1 GB storage quota per project
- Rate limit: 100 events/minute (soft), 500/minute (hard burst)

**Rationale:**
- 24 hours is a 24x improvement over Kubernetes' default 1-hour TTL
- Sufficient for real-time debugging and demo purposes
- Storage quota prevents abuse while being generous for evaluation
- Matches Datadog's free tier retention model

**What Can You Do?**
- Debug a failing deployment in real-time
- See why a pod isn't scheduling
- Build a demo with event visibility
- Evaluate the platform capabilities

**What Triggers Upgrade?**
- User has an incident on Friday, investigates Monday - events are gone
- User wants to track deployment patterns over a week
- User hits storage or rate limits due to growth

### Pro Tier: 60-Day Retention

**Included:**
- Full event query API access
- **60-day event retention** (full access to ClickHouse storage)
- 50 GB storage quota per project
- Rate limit: 1000 events/minute (soft), 5000/minute (hard burst)
- Priority support for event-related issues

**Rationale:**
- 60 days covers extended incident investigation and monthly patterns
- Aligns with the updated TTL requirement for production workloads
- 50 GB is generous - at 1KB per compressed event, this is ~50 million events
- Rate limits cover typical production workloads (deployments, scaling events)

**What Can You Do?**
- Investigate incidents weeks after they occur
- Track month-over-month patterns and trends
- Run production workloads with full history
- Debug intermittent issues and long-running problems

**What Triggers Upgrade?**
- Compliance requirements mandate 90+ day retention
- Need cross-project visibility for platform teams
- Hit storage or rate limits due to enterprise scale

### Enterprise Tier: 90+ Day Configurable Retention

**Included:**
- Full event query API access
- Configurable retention: 90, 180, or 365 days (extended TTL)
- Unlimited storage quota (fair use policy applies)
- No rate limiting (subject to platform capacity)
- Dedicated support with SLA
- Future: Cross-project admin queries (v2)

**Rationale:**
- Enterprise compliance often requires 90+ day retention
- Platform teams need visibility across projects
- Large organizations generate high event volumes
- SLA-backed support for critical operations

---

## Quota Design

### Storage Quota

**Measurement:** Compressed GB stored per project

**Why Storage Not Event Count:**
- Events vary in size significantly (pod events ~500 bytes, detailed controller events ~2KB)
- Storage directly correlates with our cost (ClickHouse storage)
- Easier to reason about capacity planning
- Avoids "event tax" perception where users fear generating events

**Tier Defaults:**

| Tier | Storage Quota | Approximate Events | Daily Runway |
|------|---------------|-------------------|--------------|
| Free | 1 GB | ~1M events | ~42K events/day (24h query access) |
| Pro | 50 GB | ~50M events | ~833K events/day (60d retention) |
| Enterprise | Unlimited | N/A | N/A |

**Enforcement:**
- Soft limit: Warning notification at 80% usage
- Hard limit: Oldest events pruned early (FIFO) to stay within quota
- No write rejection - this would break Kubernetes event semantics

### Rate Limiting

**Measurement:** Events per minute per project

**Tier Defaults:**

| Tier | Soft Limit | Hard Limit | Burst Window |
|------|------------|------------|--------------|
| Free | 100/min | 500/min | 10 seconds |
| Pro | 1000/min | 5000/min | 10 seconds |
| Enterprise | No limit | No limit | N/A |

**Enforcement:**
- Soft limit: Events accepted with warning header, metric incremented
- Hard limit: Events dropped with 429 response (Kubernetes clients retry)
- Burst window allows short spikes during deployments

---

## Cost Analysis

### Estimated Per-Project Cost

| Tier | Storage | Query Access | Monthly Cost | Revenue Target |
|------|---------|--------------|--------------|----------------|
| Free | 1 GB | 24h | ~$0.02 | $0 (subsidized) |
| Pro | 50 GB | 60d | ~$2.50 | Included in Pro |
| Enterprise | 200+ GB | 90-365d | ~$10.00+ | Included in Enterprise |

**Key Insight:** Event storage cost is minimal compared to other platform costs. The storage cost for events is negligible - the real cost is the infrastructure (ClickHouse cluster, NATS) that we're already running for audit logs.

---

## Competitive Positioning

| Platform | Free Retention | Paid Retention | Pricing Model |
|----------|----------------|----------------|---------------|
| **Datadog** | 1 day | 15 days - 15 months | Per GB ingested + indexed |
| **New Relic** | 8 days | 90 days (Data Plus) | Per GB + per user |
| **Dynatrace** | N/A (no free tier) | Configurable | Per GiB-day |
| **Native K8s** | 1 hour | 1 hour | N/A |
| **Datum (proposed)** | 24 hours | **60-365 days** | Included in tier |

### Differentiation Opportunities

1. **Kubernetes-Native Experience** - Unlike observability platforms that treat K8s events as "just another data source," we provide native kubectl integration.
2. **Transparent Pricing** - No per-event or per-GB surcharges within tier.
3. **Generous Defaults** - Our 24-hour Free tier is 24x better than native Kubernetes (1 hour).
4. **No "Observability Tax"** - We want users to emit events freely.

---

## Implementation Recommendations for Architect

### Quota Enforcement Points

1. **Rate limiting**: Implement in the event exporter or NATS ingestion layer. Do not rate limit at the API server (breaks watch semantics).

2. **Storage quota**: Enforce via background cleanup job, not write rejection. Track storage per project using ClickHouse's `system.parts` or custom aggregation.

3. **Retention TTL**: Use ClickHouse's native TTL feature. Consider per-project TTL overrides for Enterprise tier.

### Observability for Commercial

Expose these metrics for commercial operations:

```
activity_events_storage_bytes{project, tier}
activity_events_retention_days{project, tier}
activity_events_rate_limited_total{project, tier}
activity_events_quota_usage_percent{project, tier}
```

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pricing model | Included in tier | Events are core infrastructure, not premium |
| Commercial lever | Retention duration | Aligns with cost, clear value, positive upgrade trigger |
| ClickHouse TTL | **60 days** | Default storage retention for all events |
| Free query access | 24 hours | 24x improvement over K8s default, sufficient for evaluation |
| Pro query access | **60 days** | Full access to stored events for production workloads |
| Enterprise retention | **90-365 days** configurable | Extended TTL for compliance and audit requirements |
| Storage quota | Yes, per-project GB | Directly correlates with cost, fair |
| Rate limiting | Yes, tiered | Prevents abuse, protects shared infrastructure |
| Per-event pricing | No | Too complex, creates perverse incentives |

---

## Next Steps

1. **Human Approval**: This pricing strategy requires product/finance approval before proceeding
2. **Architect Review**: Quota enforcement implementation needs architecture input
3. **Finance Validation**: Confirm gross margin targets for tier pricing
4. **Proceed to Design**: Once approved, `/pipeline next feat-001` to advance
