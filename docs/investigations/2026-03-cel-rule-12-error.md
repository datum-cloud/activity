# Root Cause Analysis: CEL Rule 12 Error — `dns.networking.miloapis.com-dnsrecordset` ActivityPolicy

**Date**: 2026-03-25
**Severity**: Medium — 28 activity events lost to DLQ, no platform outage
**Policy**: `dns.networking.miloapis.com-dnsrecordset`
**Rule index**: 12 (named `update-a-aaaa`)
**Error type label**: `cel_summary` (label used by DLQ metric; error occurs in the match phase)
**First observed**: 2026-03-20 ~12:00 UTC (from VictoriaMetrics range query)

---

## Summary

The `update-a-aaaa` rule (index 12) in the `dns.networking.miloapis.com-dnsrecordset` ActivityPolicy fails at runtime whenever the Datum Cloud portal issues a PATCH update to a `DNSRecordSet` resource. The match expression accesses `audit.requestObject.spec.recordType` directly, but the portal's PATCH request body omits `spec.recordType` because the field is not being modified — only `spec.records` is present in the request object. This causes the CEL runtime to throw `no such key: recordType`, which aborts rule evaluation, prevents any activity from being generated, and routes the event to the dead-letter queue.

28 events have been lost to DLQ as of 2026-03-25. Each represents a DNS record update by an end user that will not appear in their activity timeline.

---

## The Failing CEL Expression

Rule 12 in `config/milo/activity/policies/dnsrecordset-policy.yaml` (dns-operator repo):

```yaml
- name: update-a-aaaa
  match: >-
    !audit.user.username.startsWith('system:') &&
    audit.verb in ['update', 'patch'] &&
    !has(audit.objectRef.subresource) &&
    has(audit.requestObject.spec) &&
    audit.requestObject.spec.recordType in ['A', 'AAAA'] &&
    has(audit.responseObject.metadata.annotations) &&
    'dns.networking.miloapis.com/display-name' in audit.responseObject.metadata.annotations
  summary: >-
    {{ actor }} updated
    {{ link(audit.responseObject.metadata.annotations['dns.networking.miloapis.com/display-name'], audit.objectRef) }}
    to point to
    {{ audit.responseObject.metadata.annotations['dns.networking.miloapis.com/display-value'] }}
```

The specific failing sub-expression is:

```
audit.requestObject.spec.recordType in ['A', 'AAAA']
```

This executes **after** `has(audit.requestObject.spec)` passes, but `has()` only guards that the `spec` map itself exists — not that `recordType` is a key within it. When `recordType` is absent from the request spec, the CEL runtime raises `no such key: recordType`.

---

## Root Cause

**The Kubernetes API server audit log records only the fields sent in the request body, not the full stored object.** When a client issues a strategic merge patch or a full update that omits unchanged fields, those fields do not appear in `audit.requestObject`.

In this case, `datum-cloud-portal` sends PATCH requests containing only `spec.records`. It does not repeat `spec.recordType` in the request because the record type is not changing. The audit log's `requestObject` therefore has this shape:

```json
{
  "apiVersion": "dns.networking.miloapis.com/v1alpha1",
  "kind": "DNSRecordSet",
  "spec": {
    "records": [
      {"aaaa": {"content": "2607:ed40:20::1"}, "name": "@"},
      {"aaaa": {"content": "2607:ed40:10::1"}, "name": "@"}
    ]
  }
}
```

The `responseObject.spec` does contain `recordType` (it reflects the full stored object after the mutation), but the match expression reads from `requestObject`, which lacks the field.

The fix `has(audit.requestObject.spec)` was correctly included in earlier rules as a guard, but was not extended to guard the nested field access `audit.requestObject.spec.recordType`.

---

## Example Input That Triggers the Failure

Audit event for `auditID: cacfe23d-1821-4b23-98e1-44b0130fed7b` from 2026-03-23T06:36:56Z:

- **Verb**: update (PATCH)
- **Resource**: `dnsrecordsets/kev1n-org-2e4hmd-aaaa` in namespace `default`
- **Field manager**: `datum-cloud-portal`
- **requestObject.spec** (abridged):
  ```json
  {
    "records": [
      {"aaaa": {"content": "2607:ed40:20::1"}, "name": "@"},
      {"aaaa": {"content": "2607:ed40:10::1"}, "name": "@"}
    ]
  }
  ```
- **responseObject.spec.recordType**: `"AAAA"` (present in the stored object)
- **Error**: `rule 12 match: failed to evaluate match: no such key: recordType`

The actual `recordType` is available in `audit.responseObject.spec.recordType`, which always reflects the full persisted resource.

---

## Why Static Validation Does Not Catch This

The ActivityPolicy controller reports `ActivityPolicy validated successfully` for every reconciliation of this policy. CEL validation checks that expressions compile and are type-correct against the schema, but it cannot statically verify map key existence at compile time. The `no such key` error is a runtime error that only manifests when an actual event is processed with a `requestObject` that omits the field.

---

## Recommended Fix

Replace `audit.requestObject.spec.recordType` in the match expression with `audit.responseObject.spec.recordType`, guarded by `has(audit.responseObject.spec)`. The `responseObject` always contains the full stored spec after a mutation, making it a reliable source for `recordType` regardless of what fields the client submitted.

The three update rules that read `recordType` from `requestObject` need the same fix:

### Rule 12 — `update-a-aaaa`

**Current match** (line 115 in `dnsrecordset-policy.yaml`):
```
has(audit.requestObject.spec) && audit.requestObject.spec.recordType in ['A', 'AAAA']
```

**Fixed match**:
```
has(audit.responseObject.spec) && audit.responseObject.spec.recordType in ['A', 'AAAA']
```

### Rule 13 — `update-cname`

**Current match**:
```
has(audit.requestObject.spec) && audit.requestObject.spec.recordType == 'CNAME'
```

**Fixed match**:
```
has(audit.responseObject.spec) && audit.responseObject.spec.recordType == 'CNAME'
```

### Rule 14 — `update-other-annotated`

This rule reads `audit.requestObject.spec.recordType` in the **summary template** (not the match expression), which produces a silent empty value rather than an error, but the result would be malformed output. The same pattern applies:

**Current summary**:
```
{{ actor }} updated {{ audit.requestObject.spec.recordType }} record ...
```

**Fixed summary**:
```
{{ actor }} updated {{ audit.responseObject.spec.recordType }} record ...
```

### Alternative: use `has()` guard on the nested key

If `requestObject` must be used (e.g. to reflect the user's intent rather than the stored state), add a nested `has()` guard:

```
has(audit.requestObject.spec) && has(audit.requestObject.spec.recordType) && audit.requestObject.spec.recordType in ['A', 'AAAA']
```

Using `responseObject` is preferred because it is more reliable and always contains the full spec after a successful mutation.

---

## Impact

| Dimension | Value |
|-----------|-------|
| Events lost to DLQ | 28 |
| First occurrence | 2026-03-20 ~12:00 UTC |
| Affected users | End users updating AAAA and A records via the Datum Cloud portal |
| Activity entries missing | 28 DNS record update activities will not appear in user timelines |
| Platform availability | Not affected — DLQ events can be replayed once the policy is patched |
| Propagation | Ongoing — every PATCH from datum-cloud-portal that omits `spec.recordType` will continue to fail until the policy is updated |

Events currently in the DLQ under subject `activity.dlq.audit.dns.networking.miloapis.com.DNSRecordSet` can be reprocessed automatically by the DLQ retry controller once the policy fix is deployed.

---

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 2026-03-20 ~12:00 | First DLQ events recorded (metrics; ~20 events from a now-rotated pod) |
| 2026-03-23 06:36 | First captured error in current pod logs — AAAA record update by `kev1n-org-2e4hmd-aaaa` |
| 2026-03-23 17:06 | Second cluster of errors — same resource, different update |
| 2026-03-23 17:08 onwards | Continued errors from multiple users |
| 2026-03-25 | Investigation completed; 28 DLQ events confirmed across all pods |

---

## Files to Change

- `config/milo/activity/policies/dnsrecordset-policy.yaml` in the `datum-cloud/dns-operator` repository
  - Line 115: `update-a-aaaa` match expression
  - Line 120: `update-cname` match expression
  - Line 125–126: `update-other-annotated` match expression and summary template
