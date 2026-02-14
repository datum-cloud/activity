# Kubernetes Events

> Last verified: 2026-02-18 against branch poc/event-processing-pipeline

Kubernetes Events tell you what is happening to your workloads right now — a pod
was scheduled, an image pull failed, a volume couldn't mount. The Activity
platform captures these events from across all namespaces, stores them in
ClickHouse with a 60-day retention window, and exposes them through the Activity
API server using familiar kubectl tooling.

## Overview

Standard Kubernetes stores events in etcd with a default TTL of one hour.
This creates two problems for operators and developers:

- **Events disappear before you investigate them.** An incident might not be
  escalated until hours after it begins. By then, the relevant events are gone.
- **etcd is the wrong store for high-volume, low-priority data.** Event writes
  trigger the Raft consensus protocol and compete with critical control plane
  operations like pod scheduling and secret updates.

The Activity platform solves both by routing events through its existing
pipeline: a lightweight event exporter publishes Kubernetes Events to NATS
JetStream, Vector writes them to ClickHouse, and the Activity API server queries
ClickHouse when you run `kubectl get events`. Events are retained for 60 days
and are scoped to your project so tenants cannot see each other's data.

The event exporter also feeds the activity processor. When you define
`eventRules` in an `ActivityPolicy`, Kubernetes events become human-readable
activity records that appear alongside audit log activities in your activity
feed.

## Querying Events

### Native Events API (last 24 hours)

The standard kubectl event commands work against the Activity API server
transparently. This is the correct tool for current or recent debugging.

```bash
# List all events in a namespace
kubectl get events -n my-app

# Watch events in real time
kubectl get events -n my-app -w

# Filter by the kind of the affected resource
kubectl get events --field-selector involvedObject.kind=Pod

# Filter by the name of the affected resource
kubectl get events --field-selector involvedObject.name=my-pod

# Filter by event reason
kubectl get events --field-selector reason=FailedMount

# Filter by event type (Normal or Warning)
kubectl get events --field-selector type=Warning

# Combine field selectors
kubectl get events --field-selector involvedObject.kind=Pod,type=Warning

# Show events from all namespaces
kubectl get events -A
```

The native Events API returns events from the **last 24 hours only**. This
limit exists because `kubectl get events` is designed for interactive debugging,
and returning 60 days of events by default would be slow and impractical.

For anything older than 24 hours, use `EventQuery`.

### EventQuery (up to 60 days)

`EventQuery` is an ephemeral resource that queries the full retention window.
You create it with `kubectl create -f`, results are returned immediately in
`status.results`, and no object is persisted.

```bash
kubectl create -f my-query.yaml -o yaml
```

The response is the same YAML you submitted, with `status.results` populated.

## EventQuery Examples

### All Warning events in a namespace over the past week

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: recent-warnings
spec:
  startTime: "now-7d"
  endTime: "now"
  namespace: "my-app"
  fieldSelector: "type=Warning"
  limit: 100
```

### All events for a specific pod

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: pod-events
spec:
  startTime: "now-7d"
  endTime: "now"
  fieldSelector: "involvedObject.kind=Pod,involvedObject.name=my-pod-7d4f9b"
  limit: 100
```

### All FailedMount events across all namespaces for the past 30 days

Useful for post-incident investigations where the affected namespace is unknown.

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: failed-mounts
spec:
  startTime: "now-30d"
  endTime: "now"
  fieldSelector: "reason=FailedMount"
  limit: 500
```

### Events from a specific component over a defined time window

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: scheduler-events
spec:
  startTime: "2026-02-01T00:00:00Z"
  endTime: "2026-02-08T00:00:00Z"
  fieldSelector: "source.component=default-scheduler"
  limit: 200
```

### Paginating through large result sets

When `status.continue` is non-empty, more results are available. Repeat the
query with `spec.continue` set to the previous `status.continue` value, keeping
all other fields identical.

```yaml
# Page 1
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: all-warnings-page-1
spec:
  startTime: "now-30d"
  endTime: "now"
  fieldSelector: "type=Warning"
  limit: 1000
```

```yaml
# Page 2 — copy status.continue from the previous response
apiVersion: activity.miloapis.com/v1alpha1
kind: EventQuery
metadata:
  name: all-warnings-page-2
spec:
  startTime: "now-30d"
  endTime: "now"
  fieldSelector: "type=Warning"
  limit: 1000
  continue: "<value from previous status.continue>"
```

## ActivityPolicy EventRules

`EventRules` in an `ActivityPolicy` translate raw Kubernetes events into
human-readable activity records. This is the mechanism that turns a
`FailedMount` event into "The pod my-pod could not mount storage — check if
the volume exists and has correct permissions."

Rules are evaluated in order. The first rule whose `match` expression returns
`true` wins. If no rule matches, no activity is generated for that event.

### Structure

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: my-resource-policy
spec:
  resource:
    apiGroup: "apps"
    kind: Deployment
  eventRules:
    - match: "<CEL expression using event variable>"
      summary: "<CEL template using {{ }} delimiters>"
```

The `event` variable contains the full `corev1.Event` structure. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `event.reason` | string | Short, machine-readable reason (e.g., `FailedMount`, `Scheduled`) |
| `event.message` | string | Human-readable description of the event |
| `event.type` | string | `Normal` or `Warning` |
| `event.regarding` | ObjectReference | The resource the event is about |
| `event.regarding.name` | string | Name of the involved resource |
| `event.regarding.namespace` | string | Namespace of the involved resource |
| `event.regarding.kind` | string | Kind of the involved resource |
| `event.source.component` | string | Component that reported the event |

The `link(displayText, resourceRef)` function in `summary` creates a clickable
reference in the activity feed UI.

### Example: Pod lifecycle policy

This is an excerpt from `examples/basic-kubernetes/core.yaml` showing how to
handle the most common pod events:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: core-pods
spec:
  resource:
    apiGroup: ""
    kind: Pod
  eventRules:
    # Normal lifecycle
    - match: "event.reason == 'Scheduled'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} was scheduled to a node"
    - match: "event.reason == 'Started'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} is now running"
    - match: "event.reason == 'Killing'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} is shutting down"

    # Warning events with remediation guidance
    - match: "event.reason == 'BackOff'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} keeps crashing and restarting - check the logs to see what's going wrong"
    - match: "event.reason == 'FailedMount'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} could not mount storage - check if the volume exists and has correct permissions"
    - match: "event.reason == 'OOMKilled'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} ran out of memory - consider increasing the memory limit or optimizing the application"
    - match: "event.reason == 'ImagePullBackOff'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} cannot download its container image - verify the image name and registry credentials"

    # Catch-all: surface any other Warning with its message
    - match: "event.type == 'Warning'"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} has a warning: {{ event.message }}"

    # Final fallback for Normal events
    - match: "true"
      summary: "The pod {{ link(event.regarding.name, event.regarding) }} {{ event.reason }}"
```

### Example: Custom application events

For custom controllers or operators that emit events, write a policy that
matches on the reason strings your controller uses:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: my-operator-widget
spec:
  resource:
    apiGroup: "mycompany.io"
    kind: Widget
  eventRules:
    - match: "event.reason == 'Reconciling'"
      summary: "The widget {{ link(event.regarding.name, event.regarding) }} is being configured"
    - match: "event.reason == 'Ready'"
      summary: "The widget {{ link(event.regarding.name, event.regarding) }} is ready"
    - match: "event.reason == 'Failed'"
      summary: "The widget {{ link(event.regarding.name, event.regarding) }} failed: {{ event.message }}"
    - match: "event.type == 'Warning'"
      summary: "The widget {{ link(event.regarding.name, event.regarding) }} has a warning: {{ event.message }}"
    - match: "true"
      summary: "The widget {{ link(event.regarding.name, event.regarding) }} {{ event.reason }}"
```

### Testing policies with PolicyPreview

Before deploying a policy, use `PolicyPreview` to test your rules against
sample inputs without storing any data. Provide a sample Kubernetes event in
`spec.inputs` with `type: event`, and check `status.results` to see which rule
matched.

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: PolicyPreview
metadata:
  name: test-widget-policy
spec:
  policy:
    resource:
      apiGroup: "mycompany.io"
      kind: Widget
    eventRules:
      - match: "event.reason == 'Ready'"
        summary: "The widget {{ link(event.regarding.name, event.regarding) }} is ready"
  inputs:
    - type: event
      event:
        reason: "Ready"
        type: "Normal"
        message: "Widget has been successfully configured"
        regarding:
          kind: Widget
          name: my-widget
          namespace: default
```

## API Reference

### EventQuery

`EventQuery` is a cluster-scoped, ephemeral resource. It only supports `create`.
Results are returned in the response and are not stored.

**API group**: `activity.miloapis.com/v1alpha1`
**Kind**: `EventQuery`
**Verbs**: `create`

#### Spec fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startTime` | string | Yes | Beginning of the search window. Supports relative (`now-7d`, `now-2h`) and absolute (RFC3339) formats. Maximum lookback is 60 days. |
| `endTime` | string | Yes | End of the search window. Use `now` for the current time. Must be after `startTime`. |
| `namespace` | string | No | Limit results to a single namespace. Omit to query all namespaces. |
| `fieldSelector` | string | No | Standard Kubernetes field selector syntax. See supported fields below. |
| `limit` | integer | No | Maximum results per page. Default: 100. Maximum: 1000. |
| `continue` | string | No | Pagination cursor copied from `status.continue` of the previous response. |

**Supported field selector fields:**

| Field | Example |
|-------|---------|
| `metadata.name` | `metadata.name=my-event` |
| `metadata.namespace` | `metadata.namespace=production` |
| `metadata.uid` | `metadata.uid=abc-123` |
| `involvedObject.kind` | `involvedObject.kind=Pod` |
| `involvedObject.namespace` | `involvedObject.namespace=default` |
| `involvedObject.name` | `involvedObject.name=my-pod` |
| `involvedObject.uid` | `involvedObject.uid=abc-123` |
| `involvedObject.apiVersion` | `involvedObject.apiVersion=v1` |
| `reason` | `reason=FailedMount` |
| `type` | `type=Warning` |
| `source.component` | `source.component=kubelet` |
| `source.host` | `source.host=node-1` |

**Time formats:**

| Format | Example | When to use |
|--------|---------|-------------|
| Relative | `now-7d`, `now-2h`, `now-30m` | Dashboards and recurring queries |
| Absolute (RFC3339) | `2026-01-15T09:00:00Z` | Historical analysis of specific windows |

Units for relative time: `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks).

#### Status fields

| Field | Type | Description |
|-------|------|-------------|
| `results` | `corev1.Event` array | Matching events, sorted newest-first. |
| `continue` | string | Pagination cursor. Non-empty means more results exist. Copy to `spec.continue` to fetch the next page. |
| `effectiveStartTime` | string | The resolved RFC3339 timestamp used as the start of the query window. Useful for auditing queries that used relative times. |
| `effectiveEndTime` | string | The resolved RFC3339 timestamp used as the end of the query window. |

### ActivityPolicy eventRules

`eventRules` is a field on `ActivityPolicySpec`. Rules are processed by the
`activity processor` component. Each rule that matches generates one `Activity`
record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `match` | string | Yes | CEL expression evaluated against the `event` variable. Return `true` to select this rule. |
| `summary` | string | Yes | CEL template for the activity text. Use `{{ expr }}` to embed expressions. |

**Available variables in `match` and `summary`:**

| Variable | Type | Description |
|----------|------|-------------|
| `event` | `corev1.Event` | The full Kubernetes event. Access any field with standard dot notation. |
| `actor` | string | Resolved display name of the actor (for system-generated events, typically the source component). |
| `link(text, ref)` | function | Creates a clickable reference. First argument is display text; second is the resource reference (e.g., `event.regarding`). |
