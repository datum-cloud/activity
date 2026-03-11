# Authoring ActivityPolicy Resources

ActivityPolicy is the configuration resource that tells the activity system how
to translate raw audit logs and Kubernetes events into the human-readable
summaries that appear in activity feeds. Without policies, audit logs and events
pass through the pipeline but produce no Activity records. You author one policy
per resource kind.

This guide walks you through writing policies from scratch, understanding the
CEL expressions and template syntax, and testing your work with PolicyPreview
before deploying.

## How ActivityPolicy works

The activity-processor watches for audit logs and Kubernetes events on NATS
JetStream. For each incoming event, it looks up the ActivityPolicy that matches
the event's `apiGroup` and `kind`. If a policy exists, the processor evaluates
each rule in order and stops at the first match. The matched rule's summary
template is rendered, and the result is stored as an Activity record.

If no policy matches, or no rule in the policy matches, no Activity is created
for that event.

```
Audit log arrives
  -> Find policy for (apiGroup, kind)
  -> Evaluate auditRules top-to-bottom
  -> First match wins -> render summary -> publish Activity
  -> No match -> drop silently
```

The same logic applies to Kubernetes events, using the `eventRules` list
instead.

## Policy anatomy

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: networking-httpproxy        # Unique cluster-scoped name
spec:
  resource:
    apiGroup: networking.datumapis.com
    kind: HTTPProxy

  auditRules:
    - name: create
      match: "audit.verb == 'create'"
      summary: "{{ actor }} created {{ link('HTTP proxy ' + audit.objectRef.name, audit.responseObject) }}"

    - name: delete
      match: "audit.verb == 'delete'"
      summary: "{{ actor }} deleted HTTP proxy {{ audit.objectRef.name }}"

    - name: update
      match: "audit.verb in ['update', 'patch']"
      summary: "{{ actor }} updated {{ link('HTTP proxy ' + audit.objectRef.name, audit.objectRef) }}"

    - name: fallback
      match: "true"
      summary: "{{ actor }} modified HTTP proxy {{ audit.objectRef.name }}"

  eventRules:
    - name: status-programmed
      match: "event.reason == 'Programmed'"
      summary: "{{ link('HTTP proxy ' + event.regarding.name, event.regarding) }} is now programmed"

    - name: failed
      match: "event.reason.startsWith('Failed')"
      summary: "{{ link('HTTP proxy ' + event.regarding.name, event.regarding) }} failed: {{ event.note }}"
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `spec.resource.apiGroup` | Yes | API group of the target resource. Use `""` for core resources (Pod, Service, etc.) |
| `spec.resource.kind` | Yes | Kind of the target resource, exactly as it appears in Kubernetes |
| `spec.auditRules` | No | Rules that match against audit log entries |
| `spec.eventRules` | No | Rules that match against Kubernetes events from controllers |
| `auditRules[].name` | Yes | Unique identifier for the rule within its list. Used as the list map key for strategic merge patching |
| `auditRules[].description` | No | Human-readable description of what the rule does |
| `auditRules[].match` | Yes | CEL boolean expression. First matching rule wins |
| `auditRules[].summary` | Yes | Template string. Use `{{ expression }}` to embed CEL |

A policy can have `auditRules`, `eventRules`, or both. A policy with neither
field is valid but produces no activities.

## CEL match expressions

`match` must be a CEL expression that returns `true` or `false`. Rules are
evaluated top to bottom; the first rule where `match` returns `true` is used.

### Audit rule variables

| Variable | Type | Description |
|----------|------|-------------|
| `audit` | map | The full audit log entry |
| `audit.verb` | string | The API verb: `create`, `update`, `patch`, `delete`, `get`, `list`, `watch` |
| `audit.objectRef` | map | The target resource reference |
| `audit.objectRef.name` | string | Resource name |
| `audit.objectRef.namespace` | string | Resource namespace (empty for cluster-scoped) |
| `audit.objectRef.resource` | string | Plural resource name (e.g., `httpproxies`) |
| `audit.objectRef.subresource` | string | Subresource, if any (e.g., `status`, `scale`) |
| `audit.objectRef.apiGroup` | string | API group |
| `audit.user` | map | The authenticated user |
| `audit.user.username` | string | Username (e.g., `alice@example.com`, `system:serviceaccount:default:my-sa`) |
| `audit.responseStatus` | map | HTTP response status from the API server |
| `audit.responseStatus.code` | number | HTTP status code |
| `audit.responseObject` | map | The resource as it exists after the request |
| `audit.requestObject` | map | The resource as submitted in the request |
| `actor` | string | Convenience: same as `audit.user.username` |
| `actorRef` | map | Actor reference with `type` and `name` keys, for use with `link()` |
| `kind` | string | Convenience: extracted from `audit.objectRef.resource` (the plural resource name, e.g., `httpproxies`) |

### Event rule variables

| Variable | Type | Description |
|----------|------|-------------|
| `event` | map | The full Kubernetes Event object |
| `event.reason` | string | Short camelCase reason (e.g., `Programmed`, `FailedScheduling`) |
| `event.type` | string | `Normal` or `Warning` |
| `event.note` | string | Human-readable message |
| `event.regarding` | map | The object this event is about |
| `event.regarding.name` | string | Object name |
| `event.regarding.namespace` | string | Object namespace |
| `event.regarding.apiVersion` | string | Object API version |
| `event.regarding.kind` | string | Object kind |
| `event.reportingController` | string | Controller that emitted the event |
| `actor` | string | Resolved from `event.reportingController`, falling back to `event.source.component` |
| `actorRef` | map | Actor reference with `type: "controller"` and the controller name. Resolved using the same fallback as `actor`: `reportingController` first, then `source.component` |

### Common match patterns

Match a specific verb:

```cel
audit.verb == 'create'
```

Match multiple verbs:

```cel
audit.verb in ['update', 'patch']
```

Match a verb and a subresource:

```cel
audit.verb in ['update', 'patch'] && audit.objectRef.subresource == 'status'
```

Exclude subresource writes (main resource only):

```cel
audit.verb in ['update', 'patch'] && !has(audit.objectRef.subresource)
```

Match a failed request (non-2xx response):

```cel
audit.verb == 'create' && audit.responseStatus.code >= 400
```

Match an event reason exactly:

```cel
event.reason == 'Programmed'
```

Match an event reason by prefix:

```cel
event.reason.startsWith('Failed')
```

Match warning events only:

```cel
event.type == 'Warning'
```

Fallback rule that matches everything:

```cel
true
```

## Summary templates

`summary` is a string that may contain one or more `{{ expression }}` blocks.
Each block must be a CEL expression that returns a string. The text between
blocks is included as-is.

### Available functions

**`link(displayText, resourceRef)`** — Creates a clickable reference in the
portal. `displayText` is a string; `resourceRef` is any map that contains
enough fields for the portal to construct a URL (typically `audit.responseObject`,
`audit.objectRef`, or `event.regarding`).

```
{{ link('HTTP proxy ' + audit.objectRef.name, audit.responseObject) }}
```

The portal renders this as a hyperlink with the display text. If `resourceRef`
lacks the fields needed to build a URL, the text is shown without a link.

### Rendering actor

The `actor` variable holds the raw username from the audit log, which is often
an email address or a `system:` prefixed name. For user-facing summaries you
usually want to render it as a link for human actors and as "System" for service
accounts:

```
{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }}
```

This pattern appears throughout the built-in example policies and is the
recommended default.

### Referencing resource names and fields

```
{{ audit.objectRef.name }}
{{ audit.objectRef.namespace }}
{{ event.regarding.name }}
{{ event.note }}
```

String concatenation uses `+`:

```
{{ 'HTTP proxy ' + audit.objectRef.name }}
```

The `kind` variable (audit rules only) holds the plural API resource name from
`audit.objectRef.resource` — for example, `httpproxies`, not `HTTPProxy`. It is
convenient for match expressions but is usually too technical for user-facing
summary text. Prefer string literals like `'HTTP proxy '` in summaries.

### Multiple template blocks in one summary

You can mix template blocks and static text freely:

```
{{ actor }} updated {{ link('HTTP proxy ' + audit.objectRef.name, audit.objectRef) }} in {{ audit.objectRef.namespace }}
```

## Common patterns

### CRUD operations for any resource

This structure covers the most common cases. Add a rule for each verb and
a `true` fallback to catch anything else:

```yaml
auditRules:
  - name: create
    match: "audit.verb == 'create'"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} created {{ link('network ' + audit.objectRef.name, audit.responseObject) }}"

  - name: delete
    match: "audit.verb == 'delete'"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} deleted network {{ audit.objectRef.name }}"

  - name: update
    match: "audit.verb in ['update', 'patch']"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} updated {{ link('network ' + audit.objectRef.name, audit.objectRef) }}"

  - name: fallback
    match: "true"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} modified network {{ audit.objectRef.name }}"
```

### Subresource operations

Controllers frequently write to `/status` and `/scale` subresources. Handling
these separately prevents noisy "updated" entries from status reconciliation:

```yaml
auditRules:
  - name: scale
    match: "audit.verb in ['update', 'patch'] && audit.objectRef.subresource == 'scale'"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} scaled {{ link('deployment ' + audit.objectRef.name, audit.objectRef) }}"

  - name: status
    match: "audit.verb in ['update', 'patch'] && audit.objectRef.subresource == 'status'"
    summary: "{{ link('deployment ' + audit.objectRef.name, audit.objectRef) }} status changed"

  - name: update
    match: "audit.verb in ['update', 'patch']"
    summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} updated {{ link('deployment ' + audit.objectRef.name, audit.objectRef) }}"
```

The more-specific rules must appear before the general `update` rule because
evaluation stops at the first match.

### Controller event rules

Events emitted by controllers use `eventRules`. Match on `event.reason`, which
controllers set as a short camelCase string:

```yaml
eventRules:
  - name: status-programmed
    match: "event.reason == 'Programmed'"
    summary: "{{ link('network ' + event.regarding.name, event.regarding) }} is programmed"

  - name: warning-event
    match: "event.type == 'Warning'"
    summary: "{{ link('network ' + event.regarding.name, event.regarding) }} warning: {{ event.note }}"

  - name: fallback
    match: "true"
    summary: "{{ link('network ' + event.regarding.name, event.regarding) }}: {{ event.reason }}"
```

### Combining audit and event rules

A single policy can handle both audit logs (who changed the resource) and events
(what the controller observed). They are evaluated independently — an incoming
audit log only matches `auditRules`, an incoming Kubernetes event only matches
`eventRules`:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: networking-network
spec:
  resource:
    apiGroup: networking.datumapis.com
    kind: Network

  auditRules:
    - name: create
      match: "audit.verb == 'create'"
      summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} created {{ link('network ' + audit.objectRef.name, audit.responseObject) }}"
    - name: delete
      match: "audit.verb == 'delete'"
      summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} deleted network {{ audit.objectRef.name }}"
    - name: update
      match: "audit.verb in ['update', 'patch'] && !has(audit.objectRef.subresource)"
      summary: "{{ actor.startsWith('system:') ? 'System' : link(actor, actorRef) }} updated {{ link('network ' + audit.objectRef.name, audit.objectRef) }}"

  eventRules:
    - name: status-ready
      match: "event.reason == 'Ready'"
      summary: "{{ link('network ' + event.regarding.name, event.regarding) }} is ready"
    - name: warning-event
      match: "event.type == 'Warning'"
      summary: "{{ link('network ' + event.regarding.name, event.regarding) }} warning: {{ event.note }}"
```

### Core Kubernetes resources

Core API group resources (Pod, Service, ConfigMap, etc.) use an empty string for
`apiGroup`:

```yaml
spec:
  resource:
    apiGroup: ""
    kind: Pod
```

## Testing with PolicyPreview

Before applying a policy to the control plane, use PolicyPreview to verify that your
CEL expressions compile, your rules match the right inputs, and your summaries
render correctly. PolicyPreview is an ephemeral resource — you create it and the
API server evaluates it immediately, returning results in the response. Nothing
is stored.

### Manual inputs

Supply sample audit logs or events that represent real traffic for your resource.
Copy these from actual audit log data or construct them to match the cases your
rules need to handle:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: PolicyPreview
metadata:
  name: test-httpproxy
spec:
  policy:
    resource:
      apiGroup: networking.datumapis.com
      kind: HTTPProxy
    auditRules:
      - name: create
        match: "audit.verb == 'create'"
        summary: "{{ actor }} created {{ link('HTTP proxy ' + audit.objectRef.name, audit.responseObject) }}"
      - name: delete
        match: "audit.verb == 'delete'"
        summary: "{{ actor }} deleted HTTP proxy {{ audit.objectRef.name }}"
  inputs:
    - type: audit
      audit:
        verb: create
        objectRef:
          apiGroup: networking.datumapis.com
          resource: httpproxies
          name: api-gateway
          namespace: default
        user:
          username: alice@example.com
        responseObject:
          apiVersion: networking.datumapis.com/v1alpha1
          kind: HTTPProxy
          metadata:
            name: api-gateway
            namespace: default
    - type: audit
      audit:
        verb: delete
        objectRef:
          apiGroup: networking.datumapis.com
          resource: httpproxies
          name: old-proxy
          namespace: default
        user:
          username: bob@example.com
```

Apply it and read back the results:

```bash
kubectl create -f preview.yaml -o yaml
```

The response `status.results` shows which rule matched each input and whether
evaluation succeeded. `status.activities` contains the rendered Activity objects
so you can see exactly what would appear in the activity feed.

### Auto-fetch inputs

Instead of constructing sample inputs by hand, you can ask the API server to
fetch real samples from the last N hours of activity data. This is useful when
you want to verify a policy against actual traffic for your resource type.

`autoFetch` is mutually exclusive with manual `inputs` — provide one or the
other, not both.

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: PolicyPreview
metadata:
  name: test-httpproxy-autofetch
spec:
  policy:
    resource:
      apiGroup: networking.datumapis.com
      kind: HTTPProxy
    auditRules:
      - name: create
        match: "audit.verb == 'create'"
        summary: "{{ actor }} created {{ link('HTTP proxy ' + audit.objectRef.name, audit.responseObject) }}"
  autoFetch:
    limit: 10        # 1-50, default 10
    timeRange: "24h"  # default "24h", supports "1h", "7d", "30d"
    sources: "both"   # "audit", "events", or "both" (default)
```

When `autoFetch` is used, the response includes a `status.fetchedInputs` field
containing the actual samples that were tested. Inspect this field to understand
exactly what data the policy was evaluated against.

### Reading preview results

The response status looks like this:

```yaml
status:
  results:
    - inputIndex: 0
      matched: true
      matchedRuleIndex: 0
      matchedRuleName: create
      matchedRuleType: audit
    - inputIndex: 1
      matched: true
      matchedRuleIndex: 1
      matchedRuleName: delete
      matchedRuleType: audit
  activities:
    - spec:
        summary: "alice@example.com created HTTP proxy api-gateway"
        ...
    - spec:
        summary: "bob@example.com deleted HTTP proxy old-proxy"
        ...
```

If a rule fails to compile or a summary expression errors, the result for that
input will include an `error` field explaining what went wrong. Fix the CEL
expression and re-run the preview.

## Deploying a policy

ActivityPolicy is a cluster-scoped resource. Apply it like any other Kubernetes
resource:

```bash
kubectl apply -f my-policy.yaml
```

The activity-controller-manager validates and compiles all CEL expressions when
the policy is created or updated. Check the policy status to confirm it was
accepted:

```bash
kubectl get activitypolicy my-policy -o yaml
```

Look for a `Ready` condition in `status.conditions`:

```yaml
status:
  conditions:
    - type: Ready
      status: "True"
      reason: PolicyReady
      message: All rules compiled successfully
```

If compilation fails, the `Ready` condition will be `False` with a message
identifying which expression is invalid. The processor will not use a policy
that has not reached `Ready: True`.

## Tips and gotchas

**Each rule must have a unique `name` within its list (`auditRules` or `eventRules`).** Names are the list map key for strategic merge patching. If two rules share a name, one will silently overwrite the other during `kubectl apply`. Choose names that describe the rule's intent, such as `create`, `delete`, `status`, `fallback`.

**Rules are evaluated in order; order matters.** Put specific rules before
general ones. A `true` fallback must be last or it will shadow everything below
it.

**The `match` expression must return a boolean.** An expression like
`audit.verb` (which returns a string) causes a compilation error. Always write
a comparison: `audit.verb == 'create'`.

**Summary expressions must return a string.** Each `{{ }}` block must evaluate
to a string. `link()` returns a string. Numeric fields like
`audit.responseStatus.code` must be converted: `string(audit.responseStatus.code)`.

**`audit.responseObject` is empty for deletes.** The API server does not return
a response body for `delete` operations. Use `audit.objectRef` instead when
linking to deleted resources.

**`audit.requestObject` is empty for status subresource writes.** Controllers
typically patch `/status` with a partial object. Do not rely on
`audit.requestObject` fields for status rules.

**Use `has()` to safely check optional fields.** Some audit log fields may not
be present for all requests. The CEL `has()` macro tests for field presence
before accessing it:

```cel
has(audit.objectRef.subresource) && audit.objectRef.subresource == 'status'
```

Alternatively, use `!has(audit.objectRef.subresource)` to match only requests
to the main resource:

```cel
audit.verb in ['update', 'patch'] && !has(audit.objectRef.subresource)
```

**If a summary fails to evaluate at runtime, the event is published to the
dead-letter queue (DLQ) and acknowledged. It will not be retried automatically.**
Persistent failures can be inspected with the DLQ runbooks. Use PolicyPreview to
catch errors before they reach production.

**One policy per resource kind.** The processor matches on `(apiGroup, kind)`.
If you create two policies for the same kind, the behavior is undefined. Name
your policies with a consistent convention such as `{apigroup-slug}-{kind-lowercase}`.

## Related documentation

- [API Reference](../api.md) — Complete ActivityPolicy and PolicyPreview field specs
- [Activity Pipeline Architecture](../architecture/activity-pipeline.md) — How the processor evaluates policies
- [DLQ Runbooks](../runbooks/dlq/) — Troubleshooting evaluation failures
