# Control Plane Events

Control plane events are structured observations recorded by the platform as it manages your resources. Every time a controller schedules a workload, binds storage, updates networking, or encounters an error, it records an event. These events capture not just what changed, but the context around why — which component acted, which resources were involved, and whether the action succeeded or failed.

The Activity system collects these events and retains them for up to 60 days, making them searchable and filterable long after the default 24-hour window expires. Events are the raw signal that feeds the [Activity timeline](./activity-policies.md), which translates them into human-readable summaries.

---

## How events are structured

Every event has a **type** (`Normal` or `Warning`), a **reason** describing what happened (like `Scheduled` or `FailedMount`), and a **note** with additional detail. Events also carry two resource references that describe which resources were involved.

### The primary subject: `regarding`

Every event has a `regarding` field that identifies the resource the event is about — the Pod that was scheduled, the Deployment that was scaled, or the certificate that failed to renew. This is the most common way to find events: filter by the resource you're investigating.

### The secondary object: `related`

Some events involve a second resource. When a Pod is scheduled, the scheduler records which Node it was placed on. When a volume is bound, the system records which PersistentVolume was matched. This secondary resource is captured in the `related` field.

The `related` field is what makes events useful for cross-resource investigation. Instead of only asking "what happened to this Pod?", you can ask "what happened on this Node?" or "which Pods are connected to this PersistentVolume?"

Most events only have `regarding` — the `related` field is populated when there's a genuine second resource involved. That's by design.

### Real-world examples

| What happened | Primary subject (`regarding`) | Secondary object (`related`) |
|---------------|-------------------------------|------------------------------|
| Pod scheduled | Pod | Node it was placed on |
| Volume bound | PersistentVolumeClaim | PersistentVolume it was matched to |
| Endpoint slice updated | EndpointSlice | Service that triggered the change |
| HPA scaled a deployment | Deployment | HorizontalPodAutoscaler that triggered it |
| Controller loaded config | Custom resource | ConfigMap it read from |

---

## For service consumers

As a platform user, control plane events help you understand what's happening in your environment and investigate issues.

### Finding events for a resource

The most common pattern is looking at events for a specific resource or resource type. You can filter by the primary subject (`regarding`) to see everything that happened to a particular Pod, Deployment, or any other resource.

### Investigating cross-resource relationships

The `related` field enables a different kind of investigation. Instead of starting from the resource that had a problem, you can start from the resource that *caused* it:

- **Node issues** — find all events where a specific Node was the related object, revealing every Pod scheduling decision and volume attachment that involved that Node
- **Storage problems** — find events where a PersistentVolume was the related object, showing which claims were bound to it and any attachment failures
- **Autoscaling** — find events related to a HorizontalPodAutoscaler, showing which Deployments it scaled and when

### Filtering and facets

Events can be filtered by type, reason, source component, and both `regarding` and `related` fields. The Activity system also provides faceted search — distinct values with counts — for building filter dropdowns and understanding the distribution of events in your environment.

If a filter on `related` fields returns no results, that's normal. It means the controllers in your environment aren't populating the `related` field for those events. See the service provider section below for guidance.

For detailed query syntax, field selector reference, and API examples, see the [API Reference](../api.md).

---

## For service providers

As a team building control plane components, the events you emit are a primary source of visibility for the platform users who depend on your service. Well-structured events make debugging easier and enable richer Activity timeline summaries.

### Populating `regarding` and `related`

Every event should have `regarding` set to the resource your controller was reconciling. The question for `related` is: **"Would someone debugging this event want to navigate directly to a second resource?"** If yes, set `related`.

**Good uses of `related`:**
- A scheduler placing a Pod on a Node — `related` points to the Node
- A controller loading configuration from a ConfigMap — `related` points to the ConfigMap
- A volume controller binding a claim to a volume — `related` points to the PersistentVolume

**Avoid using `related` for:**
- The controller's own Pod or ServiceAccount — this is noise
- The owning resource when `regarding` is already a child — ownership is queryable separately
- Resources only tangentially connected to the event

### Choosing meaningful reasons

The `reason` field is a short camelCase string (like `Scheduled`, `FailedMount`, or `Programmed`) that becomes the primary filter dimension for event queries. Keep reasons consistent across your controller — a change to a reason string is a breaking change for any ActivityPolicy that matches it. Use descriptive, specific values (`FailedScheduling` over `Failed`), and prefix error states with `Failed` by convention.

### Surfacing events in the Activity timeline

ActivityPolicy resources define how raw events are translated into human-readable activity summaries. When an event carries a `related` field, policies can produce richer summaries that mention both resources — for example, "Pod web-frontend scheduled on node-1" instead of just "Pod web-frontend was scheduled."

For details on writing ActivityPolicy event rules, including how to safely access the optional `related` field in CEL expressions, see [Authoring ActivityPolicy Resources](./activity-policies.md).

---

## Related documentation

- [Authoring ActivityPolicy Resources](./activity-policies.md) — writing rules that translate events into Activity timeline entries
- [API Reference](../api.md) — complete field specifications, query syntax, and examples for EventQuery and EventFacetQuery
