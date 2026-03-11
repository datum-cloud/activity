# Working with Control Plane Events

> Last verified: 2026-03-11 against v1alpha1

This guide serves two audiences:

- **Service consumers** — platform users who need to understand what's happening
  in their environment — investigating issues, monitoring resource health, and
  building dashboards. Start with [Querying events](#querying-events) and
  [Building filter UIs](#building-filter-uis).

- **Service providers** — teams building the control plane components that
  produce events — making them useful for the consumers who rely on them. Start
  with [Producing events with meaningful fields](#producing-events-with-meaningful-fields)
  and [Writing ActivityPolicy rules that use related](#writing-activitypolicy-rules-that-use-related).

---

## What are control plane events?

Control plane events are structured observations recorded by the platform as it
manages your resources. Every time a controller schedules a workload, binds
storage, updates networking, or encounters an error, it records an event. These
events capture not just what changed, but the context around why it changed —
which component acted, which resources were involved, and whether the action
succeeded or failed.

The Activity system collects these events from across the control plane and
retains them for up to 60 days. This is a significant extension of the default
24-hour window that Kubernetes provides natively, and it makes control plane
events searchable and filterable at scale rather than ephemeral observations that
disappear before anyone investigates them.

Events answer the question: "What happened to my resources and why?" When a Pod
fails to schedule, when a volume refuses to bind, when a certificate renewal
stalls — events are the raw signal that tells you where to look. They also feed
the Activity timeline, which translates those raw signals into human-readable
summaries.

Use this guide to query events directly when you need granular detail, to build
filter interfaces that give users visibility into their environment, or to emit
well-formed events from your own controllers so that platform users can benefit
from them.

---

## Understanding `regarding` and `related`

Every control plane event in `events.k8s.io/v1` has two object reference fields:

- **`regarding`** (required) — the primary subject of the event. This is the
  resource the controller was reconciling when it emitted the event. For
  example, when a Pod is scheduled, `regarding` points to the Pod.

- **`related`** (optional) — a secondary resource that was meaningfully involved
  in the same action. When a scheduler places a Pod on a specific Node, `related`
  points to the Node. Most events do not set this field — that is normal.

The `related` field is what makes events useful for cross-resource debugging. If
you are investigating why a PersistentVolumeClaim is stuck, you want to see
events whose `related` field points to the PersistentVolume that was matched (or
not matched). If you are investigating Pod scheduling failures, you want to see
events filtered by `related.kind=Node`.

### When is `related` populated?

| Event scenario | `regarding` | `related` | Why `related` is set |
|----------------|-------------|-----------|----------------------|
| Pod scheduled | Pod | Node | The scheduler placed the Pod on a specific Node |
| Volume attached | PersistentVolumeClaim | PersistentVolume | The PVC was bound to a specific PV |
| EndpointSlice updated | EndpointSlice | Service | The slice changed because of a Service update |
| HPA scaled deployment | Deployment | HorizontalPodAutoscaler | The HPA triggered the scale action |
| Custom controller sync | YourResource | ConfigMap | Your controller loaded configuration from a ConfigMap |

The `related` field is sparse by design. Controllers should only set it when
there is a genuine second resource involved in the action — not as a way to
attach extra metadata.

---

## Querying events

EventQuery is an ephemeral resource. You create it with `kubectl create` and
the results are returned immediately in the response. Nothing is persisted. The
resource only supports the `create` verb.

### Quick start

Retrieve all Warning events from the last 7 days:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: recent-warnings
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "type=Warning"
  limit: 50
```

```bash
kubectl create -f query.yaml -o yaml
```

The response includes the matching events in `status.results` and the resolved
time range in `status.effectiveStartTime` and `status.effectiveEndTime`:

```yaml
status:
  effectiveStartTime: "2026-03-04T00:00:00Z"
  effectiveEndTime: "2026-03-11T00:00:00Z"
  results:
    - event:
        eventTime: "2026-03-10T14:22:31Z"
        type: Warning
        reason: FailedScheduling
        note: "0/3 nodes available: 3 Insufficient memory."
        regarding:
          kind: Pod
          name: web-frontend-7d9c8b4f6-xk2pz
          namespace: production
        reportingController: default-scheduler
  continue: ""
```

An empty `status.continue` means all results fit on one page.

### Time ranges

Use relative time expressions for dashboards and recurring queries — they
automatically advance with the current time:

| Expression | Meaning |
|------------|---------|
| `now-30m` | 30 minutes ago |
| `now-2h` | 2 hours ago |
| `now-7d` | 7 days ago |
| `now-4w` | 4 weeks ago |

Units are `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks).
Maximum lookback is 60 days.

Use absolute RFC3339 timestamps for historical analysis of specific time periods:

```yaml
spec:
  startTime: "2026-02-01T00:00:00Z"
  endTime: "2026-02-28T23:59:59Z"
```

### Filtering by `regarding`

The most common pattern is to filter by the primary subject of events:

```yaml
# All events for Pods in a specific namespace
spec:
  startTime: "now-24h"
  endTime: "now"
  namespace: production
  fieldSelector: "regarding.kind=Pod"
```

```yaml
# Warning events for a specific Pod by name
spec:
  startTime: "now-24h"
  endTime: "now"
  fieldSelector: "regarding.name=web-frontend-7d9c8b4f6-xk2pz,type=Warning"
```

```yaml
# All FailedMount events across the cluster
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "reason=FailedMount"
```

### Filtering by `related`

Use `related.*` selectors to find events where a specific secondary resource
was involved. This is the key to cross-resource debugging:

```yaml
# Find all events related to a specific Node (e.g., investigating node pressure)
spec:
  startTime: "now-24h"
  endTime: "now"
  fieldSelector: "related.kind=Node,related.name=node-1a2b3c"
```

```yaml
# Find Pods that have events related to PersistentVolumes
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "regarding.kind=Pod,related.kind=PersistentVolume"
```

```yaml
# Find all events related to a specific HorizontalPodAutoscaler
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "related.kind=HorizontalPodAutoscaler,related.name=web-frontend-hpa,related.namespace=production"
```

Remember that `related` is sparse — most events will not have this field set.
If a filter on `related.*` returns no results, it may mean controllers in your
environment are not populating the field. See
[Producing events with meaningful fields](#producing-events-with-meaningful-fields)
for guidance on emitting events with `related`.

### Combining field selectors

Multiple selectors are comma-separated. All conditions must match (AND logic):

```yaml
# Warning events for Pods that involve Nodes
spec:
  startTime: "now-24h"
  endTime: "now"
  fieldSelector: "type=Warning,regarding.kind=Pod,related.kind=Node"
```

```yaml
# Events from the kubelet on a specific host
spec:
  startTime: "now-1h"
  endTime: "now"
  fieldSelector: "source.component=kubelet,source.host=node-1a2b3c"
```

The full set of supported field selectors:

| Field | Description | Example value |
|-------|-------------|---------------|
| `metadata.name` | Event name | `my-pod.17a4b` |
| `metadata.namespace` | Event namespace | `production` |
| `metadata.uid` | Event UID | `a1b2c3d4-...` |
| `regarding.apiVersion` | Regarding resource API version | `apps/v1` |
| `regarding.kind` | Regarding resource kind | `Pod` |
| `regarding.namespace` | Regarding resource namespace | `production` |
| `regarding.name` | Regarding resource name | `web-frontend-abc` |
| `regarding.uid` | Regarding resource UID | `a1b2c3d4-...` |
| `regarding.fieldPath` | Regarding resource field path | `spec.containers[0]` |
| `related.apiVersion` | Related resource API version | `v1` |
| `related.kind` | Related resource kind | `Node` |
| `related.namespace` | Related resource namespace | `kube-system` |
| `related.name` | Related resource name | `node-1a2b3c` |
| `reason` | Event reason | `FailedMount` |
| `type` | Event type | `Normal` or `Warning` |
| `source.component` | Source component | `kubelet` |
| `source.host` | Source host | `node-1a2b3c` |
| `reportingComponent` | Reporting component (alias for `source.component`) | `my-controller` |
| `reportingInstance` | Reporting instance (alias for `source.host`) | `pod-name` |

Operators are `=` (or `==`) and `!=`. OR is not supported — submit multiple
queries if you need disjoint filters.

### Scoping to a namespace

The `spec.namespace` field limits results to events that belong to a particular
namespace (the event's own namespace, which is typically the same as the
`regarding` resource's namespace):

```yaml
spec:
  startTime: "now-24h"
  endTime: "now"
  namespace: production
  fieldSelector: "type=Warning"
```

Leave `namespace` empty to query across all namespaces.

### Pagination

By default, queries return up to 100 results per page. Set `spec.limit` to
control page size (maximum 1000). If the query has more results than the limit,
`status.continue` will be non-empty.

To retrieve the next page, copy the `status.continue` value into a new query
with identical `spec` fields:

```yaml
# First page
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: events-page-1
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "type=Warning"
  limit: 200
```

```yaml
# Second page — same spec, add the continue cursor
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: events-page-2
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "type=Warning"
  limit: 200
  continue: "eyJhbGciOiJ..."   # copied from status.continue of previous query
```

Repeat until `status.continue` is empty. Keep all other `spec` fields identical
across pages — changing them with a cursor produces undefined results.

---

## Building filter UIs

EventFacetQuery retrieves the distinct values for event fields within a time
window, with counts. This powers autocomplete inputs and filter dropdowns. Like
EventQuery, it is an ephemeral `create`-only resource.

### Basic facet query

Retrieve the top values for event type, event reason, and regarding kind over
the last 7 days:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventFacetQuery
metadata:
  name: filter-options
spec:
  timeRange:
    start: "now-7d"
  facets:
    - field: type
    - field: reason
      limit: 20
    - field: regarding.kind
      limit: 10
```

```bash
kubectl create -f facets.yaml -o yaml
```

Response:

```yaml
status:
  facets:
    - field: type
      values:
        - value: Normal
          count: 14203
        - value: Warning
          count: 892
    - field: reason
      values:
        - value: Scheduled
          count: 3821
        - value: Pulled
          count: 2940
        - value: FailedScheduling
          count: 712
        - value: FailedMount
          count: 180
    - field: regarding.kind
      values:
        - value: Pod
          count: 9841
        - value: Deployment
          count: 1203
        - value: ReplicaSet
          count: 988
```

### Including `related` facets

The `related.kind` and `related.namespace` facets reveal the secondary resource
types that appear in your event stream. Add them alongside `regarding.*` facets
to give users the full filter panel:

```yaml
spec:
  timeRange:
    start: "now-7d"
  facets:
    - field: regarding.kind
      limit: 10
    - field: regarding.namespace
      limit: 20
    - field: related.kind
      limit: 10
    - field: related.namespace
      limit: 20
    - field: type
    - field: reason
      limit: 20
    - field: source.component
      limit: 10
```

The `related.kind` facet will only return values when at least some events in
your environment carry a `related` reference. If it comes back empty, that is
expected — it means controllers in this environment are not populating the field.

### Supported facet fields

| Field | Description |
|-------|-------------|
| `type` | Event types: `Normal`, `Warning` |
| `reason` | Event reasons emitted by controllers |
| `regarding.kind` | Resource kinds of the primary subject |
| `regarding.namespace` | Namespaces of the primary subject |
| `related.kind` | Resource kinds of the secondary object |
| `related.namespace` | Namespaces of the secondary object |
| `source.component` | Source components (e.g., `kubelet`, `scheduler`) |
| `namespace` | Namespace where the event itself is stored |

### Time range for facets

`spec.timeRange` follows the same relative and absolute formats as EventQuery.
If omitted, it defaults to the last 7 days. Scoping facets to a short window
(such as the last 24 hours) keeps counts relevant to the current state of the
system:

```yaml
spec:
  timeRange:
    start: "now-24h"
    end: "now"
  facets:
    - field: reason
      limit: 20
```

### Default and maximum limits

Each facet returns up to 20 values by default. Set `spec.facets[].limit` to
request more, up to a maximum of 100. Values are ordered by count, descending.

---

## Producing events with meaningful fields

This section is for teams building controllers and operators. The choices you
make when emitting events directly affect how useful those events are for the
platform users who receive them.

### Required fields for well-formed events

Use `events.k8s.io/v1` (the `Event` object from that API group, not the older
`v1.Event`). The required fields are:

```go
import (
    eventsv1 "k8s.io/api/events/v1"
    corev1  "k8s.io/api/core/v1"
    metav1  "k8s.io/apimachinery/pkg/apis/meta/v1"
)

event := &eventsv1.Event{
    ObjectMeta: metav1.ObjectMeta{
        // Use a deterministic name based on the object UID and reason to
        // avoid creating duplicate events on rapid reconcile loops.
        Name:      fmt.Sprintf("%s.%s", obj.UID, "Programmed"),
        Namespace: obj.Namespace,
    },
    EventTime:           metav1.NewMicroTime(time.Now()),
    ReportingController: "my-controller.example.com",
    ReportingInstance:   os.Getenv("POD_NAME"),
    Action:              "Programmed",
    Reason:              "Programmed",
    Type:                corev1.EventTypeNormal,
    Note:                "HTTPProxy is programmed and accepting traffic",
    Regarding: corev1.ObjectReference{
        APIVersion: obj.APIVersion,
        Kind:       obj.Kind,
        Namespace:  obj.Namespace,
        Name:       obj.Name,
        UID:        obj.UID,
    },
}
```

### When and how to populate `related`

Populate `related` when a second, distinct resource is directly involved in the
action. Ask yourself: "Would someone debugging this event want to navigate
directly to this second resource?" If yes, set `related`.

**Good uses of `related`:**

```go
// A Pod was placed on a specific Node by the scheduler
event.Regarding = corev1.ObjectReference{
    Kind:      "Pod",
    Namespace: pod.Namespace,
    Name:      pod.Name,
    UID:       pod.UID,
}
event.Related = &corev1.ObjectReference{
    Kind: "Node",
    Name: nodeName,
    UID:  nodeUID,
}
```

```go
// A custom controller synchronized configuration from a ConfigMap
event.Regarding = corev1.ObjectReference{
    Kind:      "MyResource",
    Namespace: resource.Namespace,
    Name:      resource.Name,
    UID:       resource.UID,
}
event.Related = &corev1.ObjectReference{
    Kind:      "ConfigMap",
    Namespace: configMap.Namespace,
    Name:      configMap.Name,
    UID:       configMap.UID,
}
```

**Do not use `related` for:**

- The controller's own Pod or ServiceAccount — this is noise that dilutes the signal
- The owning resource when `regarding` is already a child resource — the ownership
  hierarchy is queryable separately
- Resources that are only tangentially connected to the event

### Choosing `reason` values

`reason` is a short camelCase string that describes what happened. It is the
primary filter dimension for event queries. Keep reasons:

- **Consistent across your controller.** Use the same reason string for the same
  type of event every time. A change to a reason string is a breaking change for
  any ActivityPolicy that matches it.
- **Descriptive and specific.** `Programmed` is better than `Updated`. `FailedScheduling`
  is better than `Failed`.
- **Prefixed with `Failed` for error states.** The conventional prefix makes it
  easy to write CEL match expressions like `event.reason.startsWith('Failed')`.

### Using the `controller-runtime` recorder

If you are using `controller-runtime`, the `record.EventRecorder` handles
creation and deduplication. For `related`, use the `AnnotatedEventf` method:

```go
// Standard event (regarding only)
r.Recorder.Eventf(obj, corev1.EventTypeNormal, "Programmed",
    "HTTPProxy is programmed and accepting traffic")

// Event with a related object
r.Recorder.AnnotatedEventf(obj, map[string]string{}, corev1.EventTypeNormal,
    "Scheduled", "Pod scheduled on node %s", node.Name)
```

Note that the standard `record.EventRecorder` interface does not expose the
`related` field directly. To set `related`, construct the `events.k8s.io/v1`
Event object manually and use the Kubernetes client to create it, or use a
recorder implementation that exposes the field.

---

## Writing ActivityPolicy rules that use `related`

ActivityPolicy `eventRules` can access `event.related` in both `match`
expressions and `summary` templates. Because most events do not carry a
`related` reference, you must guard all access with `has(event.related)`.

### Checking for `related` presence

This is mandatory. Without the guard, the CEL expression panics on events where
the field is absent:

```cel
# Correct: guard before access
has(event.related) && event.related.kind == 'Node'

# Incorrect: will error on events without related
event.related.kind == 'Node'
```

### Matching on `related.kind`

Write a specific rule that mentions the related resource, and follow it with a
general fallback for the same reason:

```yaml
eventRules:
  # Specific rule: scheduling event with a Node reference
  - match: "event.reason == 'Scheduled' && has(event.related) && event.related.kind == 'Node'"
    summary: "{{ link('Pod ' + event.regarding.name, event.regarding) }} scheduled on {{ link('node ' + event.related.name, event.related) }}"

  # Fallback: scheduling event without a related Node
  - match: "event.reason == 'Scheduled'"
    summary: "{{ link('Pod ' + event.regarding.name, event.regarding) }} was scheduled"
```

The more specific rule must appear first. CEL rule evaluation stops at the first match.

### Building richer summaries with both objects

When `related` is present, a summary that mentions both objects is significantly
more useful than one that only mentions the primary subject:

```yaml
eventRules:
  # PVC bound to a PV — mention both
  - match: "event.reason == 'VolumeBound' && has(event.related) && event.related.kind == 'PersistentVolume'"
    summary: "{{ link('PVC ' + event.regarding.name, event.regarding) }} bound to {{ link('volume ' + event.related.name, event.related) }}"

  # PVC event without a specific PV reference
  - match: "event.reason == 'VolumeBound'"
    summary: "{{ link('PVC ' + event.regarding.name, event.regarding) }} was bound to a volume"

  # Warning events — always show the note
  - match: "event.type == 'Warning'"
    summary: "{{ link(event.regarding.kind + ' ' + event.regarding.name, event.regarding) }} warning: {{ event.note }}"

  # Fallback
  - match: "true"
    summary: "{{ link(event.regarding.kind + ' ' + event.regarding.name, event.regarding) }}: {{ event.reason }}"
```

### Full `event.related` field reference

| Variable | Type | Description |
|----------|------|-------------|
| `event.related` | map | Secondary object reference. Only present on some events; always guard with `has(event.related)` |
| `event.related.kind` | string | Resource kind (e.g., `Node`, `PersistentVolume`) |
| `event.related.name` | string | Resource name |
| `event.related.namespace` | string | Resource namespace (empty for cluster-scoped resources) |
| `event.related.apiVersion` | string | API version (e.g., `v1`, `apps/v1`) |
| `event.related.uid` | string | Resource UID |

For the complete event variable reference including `event.regarding`,
`event.reason`, `event.type`, `event.note`, and `event.reportingController`,
see [Authoring ActivityPolicy Resources](./activity-policies.md#event-rule-variables).

### Testing with PolicyPreview

Use PolicyPreview to validate that your `has(event.related)` guards work
correctly against both kinds of input — events with and without the field:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: PolicyPreview
metadata:
  name: test-scheduling-policy
spec:
  policy:
    resource:
      apiGroup: ""
      kind: Pod
    eventRules:
      - match: "event.reason == 'Scheduled' && has(event.related) && event.related.kind == 'Node'"
        summary: "{{ link('Pod ' + event.regarding.name, event.regarding) }} scheduled on {{ link('node ' + event.related.name, event.related) }}"
      - match: "event.reason == 'Scheduled'"
        summary: "{{ link('Pod ' + event.regarding.name, event.regarding) }} was scheduled"
  inputs:
    # Event WITH related
    - type: event
      event:
        reason: Scheduled
        type: Normal
        note: "Successfully assigned default/my-pod to node-1a2b3c"
        regarding:
          apiVersion: v1
          kind: Pod
          namespace: default
          name: my-pod
        related:
          apiVersion: v1
          kind: Node
          name: node-1a2b3c
        reportingController: default-scheduler
    # Event WITHOUT related — must not error
    - type: event
      event:
        reason: Scheduled
        type: Normal
        note: "Successfully assigned default/my-pod to a node"
        regarding:
          apiVersion: v1
          kind: Pod
          namespace: default
          name: my-pod
        reportingController: default-scheduler
```

```bash
kubectl create -f preview.yaml -o yaml
```

Verify that `status.results[0].matched` is `true` (matches the specific rule)
and `status.results[1].matched` is `true` (falls through to the general rule
without errors).

---

## Common recipes

### Find all Warning events in a namespace

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: namespace-warnings
spec:
  startTime: "now-24h"
  endTime: "now"
  namespace: production
  fieldSelector: "type=Warning"
  limit: 100
```

### Investigate scheduling failures for a workload

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: scheduling-failures
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "reason=FailedScheduling,regarding.kind=Pod"
  limit: 100
```

### Find events touching a specific Node

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: node-events
spec:
  startTime: "now-24h"
  endTime: "now"
  fieldSelector: "related.kind=Node,related.name=node-1a2b3c"
  limit: 200
```

### Get filter options for an event explorer UI

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventFacetQuery
metadata:
  name: explorer-facets
spec:
  timeRange:
    start: "now-24h"
    end: "now"
  facets:
    - field: type
    - field: reason
      limit: 30
    - field: regarding.kind
      limit: 15
    - field: regarding.namespace
      limit: 20
    - field: related.kind
      limit: 10
    - field: source.component
      limit: 10
```

---

## Related documentation

- [Authoring ActivityPolicy Resources](./activity-policies.md) — Writing CEL rules that surface events as human-readable Activities
- [API Reference](../api.md) — Complete field specifications for EventQuery and EventFacetQuery
