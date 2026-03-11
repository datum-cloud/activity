# Control Plane Events

Control plane events are structured observations recorded by the platform as it manages your resources. Every time a controller schedules a workload, binds storage, updates networking, or encounters an error, it records an event. These events capture not just what changed, but the context around why — which component acted, which resources were involved, and whether the action succeeded or failed.

The Activity system collects these events and retains them for up to 60 days, making them searchable and filterable long after the default 24-hour window expires.

---

## Why events matter

Events are the primary way to understand what the control plane is doing on your behalf. They answer questions like:

- Why didn't my Pod start?
- When was this Deployment last scaled?
- Which controller is producing warnings in this namespace?
- What changed right before this service started failing?

Events also feed the [Activity timeline](./activity-policies.md), which translates raw events into human-readable summaries like "Pod web-frontend scheduled on node-1" or "Deployment api-server scaled to 5 replicas."

---

## Anatomy of an event

Each event carries several fields that describe what happened, to what, and why.

### Type

Events are either `Normal` (expected operations) or `Warning` (something that needs attention). Filtering by type is the fastest way to find problems — Warning events surface scheduling failures, mount errors, resource limits, and other issues that may need investigation.

### Reason

A short camelCase label describing what happened — `Scheduled`, `Pulled`, `FailedMount`, `ScalingReplicaSet`. Reasons are consistent within a controller, making them reliable for filtering and building automation. By convention, error-related reasons are prefixed with `Failed`.

### Note

A human-readable message with specific details about this occurrence. Where `reason` tells you *what* happened, `note` tells you *why* — for example, "0/3 nodes available: 3 Insufficient memory" or "Successfully pulled image nginx:1.25."

### Source

The `source.component` and `source.host` fields identify which controller produced the event and where it was running. This is useful for distinguishing events from different parts of the control plane — the scheduler, kubelet, a custom operator, or a platform controller.

### Resource references

Every event identifies the resources involved:

- **`regarding`** — the primary subject. This is the resource the controller was acting on when it recorded the event. For example, when a Pod is scheduled, `regarding` is the Pod.

- **`related`** (optional) — a secondary resource involved in the same action. When a Pod is placed on a specific Node, `related` is the Node. When a volume claim is bound, `related` is the PersistentVolume that was matched. Most events only have `regarding` — `related` is populated when there's a genuine second resource involved.

| What happened | Primary subject | Secondary object |
|---------------|-----------------|------------------|
| Pod scheduled | Pod | Node it was placed on |
| Volume bound | PersistentVolumeClaim | PersistentVolume it was matched to |
| Endpoint slice updated | EndpointSlice | Service that triggered the change |
| HPA scaled a deployment | Deployment | HorizontalPodAutoscaler that triggered it |

---

## For service consumers

As a platform user, events give you visibility into what the control plane is doing in your environment.

**Investigating issues** — when something goes wrong, events are usually the first place to look. Filter by Warning type to find errors, by reason to find specific failure modes, or by the resource you're investigating.

**Understanding resource behavior** — events show the full lifecycle of a resource: creation, scheduling, configuration, scaling, and errors. Looking at the event stream for a specific resource tells you exactly what happened and in what order.

**Cross-resource investigation** — the `related` field connects events across resources. Instead of only asking "what happened to this Pod?", you can ask "what happened involving this Node?" to see every Pod that was scheduled there, every volume attached, and every issue encountered. This is particularly useful when investigating infrastructure-level problems that affect multiple workloads.

**Building dashboards and filters** — the Activity system provides faceted search to power filter dropdowns with the distinct values and counts for fields like event type, reason, resource kind, namespace, and source component.

For query syntax and API examples, see the [API Reference](../api.md).

---

## For service providers

As a team building control plane components, the events you produce are a primary source of visibility for the users who depend on your service.

**Choose clear reasons** — the `reason` field is the most important filter dimension. Use consistent, descriptive camelCase values. `Programmed` is better than `Updated`. `FailedScheduling` is better than `Failed`. Once published, a reason string becomes part of your interface — changing it breaks any ActivityPolicy rules or automation that matches on it.

**Write useful notes** — the `note` field should include the specific details someone needs to understand this occurrence. Include resource names, error messages, and relevant quantities. "Scaled to 5 replicas" is more useful than "Scaling complete."

**Set `related` when it helps debugging** — ask yourself: "Would someone debugging this event want to navigate directly to a second resource?" If yes, populate `related` with that resource. If not, leave it empty. Don't use `related` for the controller's own Pod, for owner references that are already queryable, or for tangentially connected resources.

**Use `events.k8s.io/v1`** — use the newer Events API, not the legacy `v1.Event`. The newer format supports `regarding`, `related`, microsecond-precision timestamps, and event series for deduplication.

**Surface events in the Activity timeline** — [ActivityPolicy](./activity-policies.md) resources define how raw events are translated into human-readable summaries. When events carry well-structured fields — meaningful reasons, clear notes, and `related` references where appropriate — the resulting activity summaries are significantly more useful.

---

## Related documentation

- [Authoring ActivityPolicy Resources](./activity-policies.md) — writing rules that translate events into Activity timeline entries
- [API Reference](../api.md) — complete field specifications, query syntax, and examples for EventQuery and EventFacetQuery
