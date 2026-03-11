# Reindexing Historical Activity

Activities are generated from audit logs and Kubernetes events as they happen.
When you create or update an ActivityPolicy, only events that arrive *after*
that change get translated. Events that already occurred are not retroactively
processed — they sit in storage, but no activities exist for them yet.

A **ReindexJob** fixes this. It replays historical audit logs and events through
your current ActivityPolicy rules and writes the resulting activities to
ClickHouse. When the job finishes, your activity feed reflects the full history
for the policies and time range you specified.

## When to use a ReindexJob

| Situation | What to do |
|-----------|------------|
| You added a new ActivityPolicy | Reindex to generate activities for events that predate the policy |
| You updated a policy's match rules | Reindex to apply the corrected matching logic to past events |
| You fixed a policy's summary template | Reindex to regenerate activity text for past events |
| You want to backfill activity for a specific time window | Reindex with an explicit start and end time |

ReindexJob is not necessary for ongoing processing. The activity processor
handles new events continuously — ReindexJob is only for the historical data
that was never translated.

## How reindexing works

When you create a ReindexJob, the controller:

1. Schedules a worker pod that reads audit logs and events from ClickHouse for
   your specified time range.
2. Evaluates each event against the ActivityPolicy rules you selected (or all
   active policies if you did not specify any).
3. Writes new Activity records back to ClickHouse for every event that matched
   a policy rule.

The job runs once and cannot be re-run. To re-process the same time range
again, create a new ReindexJob.

## Creating a ReindexJob

### Minimal example

This reindexes the last 7 days of events against all active ActivityPolicies:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: backfill-last-7-days
spec:
  timeRange:
    startTime: "now-7d"
```

Apply it:

```bash
kubectl apply -f reindexjob.yaml
```

### Targeting a specific policy

If you only updated one policy, scope the job to that policy to avoid
reprocessing events against policies that have not changed:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: fix-httpproxy-policy
spec:
  timeRange:
    startTime: "now-30d"
    endTime: "now"
  policySelector:
    names:
      - networking-httpproxy
```

You can also select policies by label:

```yaml
spec:
  policySelector:
    matchLabels:
      team: networking
```

### Using an absolute time range

Use RFC3339 timestamps when you need to target a specific historical period:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: backfill-february
spec:
  timeRange:
    startTime: "2026-02-01T00:00:00Z"
    endTime: "2026-03-01T00:00:00Z"
  policySelector:
    names:
      - networking-httpproxy
```

### Time range reference

| Format | Example | Notes |
|--------|---------|-------|
| Relative | `now-7d` | Resolved when the worker starts, not when you apply the resource |
| Relative | `now-2h` | Units: `s`, `m`, `h`, `d`, `w` |
| Absolute | `2026-02-01T00:00:00Z` | RFC3339, UTC or with offset |
| Absolute | `2026-02-01T00:00:00-08:00` | RFC3339 with timezone offset |

`endTime` defaults to `"now"` (the moment the worker starts) if omitted.

The maximum lookback window is 60 days, matching the retention period. This
limit is enforced when the worker starts processing, not when the job is
created — so a job that sits in `Pending` for a long time could fail if its
start time ages past the 60-day window.

### Dry run

To see how many events would be processed without writing any activities, set
`dryRun: true`:

```yaml
spec:
  timeRange:
    startTime: "now-7d"
  config:
    dryRun: true
```

The job runs normally and reports progress, but no activities are written.
This is useful for estimating the scope of a reindex before committing.

### Automatic cleanup

Set `ttlSecondsAfterFinished` to have the job resource deleted automatically
after a period. This keeps your control plane tidy without manual cleanup:

```yaml
spec:
  timeRange:
    startTime: "now-7d"
  ttlSecondsAfterFinished: 3600  # Delete 1 hour after completion
```

If omitted, completed jobs are retained indefinitely.

## Monitoring progress

Watch the job status:

```bash
kubectl get reindexjob backfill-last-7-days --watch
```

ReindexJob is cluster-scoped, not namespaced, so you do not need to specify
`-n <namespace>` when running these commands.

The `PHASE` column shows the lifecycle state:

| Phase | Meaning |
|-------|---------|
| `Pending` | Waiting for a processing slot (a concurrency limit is in effect) |
| `Running` | Worker pod is active and processing events |
| `Succeeded` | All events processed successfully |
| `Failed` | Processing stopped due to an error |

Get detailed progress including event counts:

```bash
kubectl get reindexjob backfill-last-7-days -o yaml
```

The `status` section includes:

Shortly after creation, before the worker has started:

```yaml
status:
  phase: Pending
  message: "Job created, waiting for execution"
  conditions:
    - type: Ready
      status: "False"
      reason: Pending
      message: "Waiting for processing slot"
```

Once the worker is active:

```yaml
status:
  phase: Running
  message: "Processing batch 13 of 46"
  startedAt: "2026-03-10T14:00:00Z"
  progress:
    totalEvents: 45200
    processedEvents: 12300
    activitiesGenerated: 8750
    errors: 0
    currentBatch: 13
    totalBatches: 46
  conditions:
    - type: Ready
      status: "False"
      reason: InProgress
      message: "Re-indexing in progress"
```

`activitiesGenerated` is the count of activities written so far. It will be
less than `processedEvents` because not every event matches a policy rule.

`errors` counts non-fatal processing errors. The job continues processing when
non-fatal errors occur, but those events are skipped.

## What happens when it completes

When the phase reaches `Succeeded`, all matched events have been translated and
written. Your activity feed and any ActivityQuery results for that time range
will now include the backfilled activities.

```bash
kubectl get reindexjob backfill-last-7-days
# NAME                    PHASE       AGE
# backfill-last-7-days    Succeeded   12m
```

You can then query for the newly generated activities using an ActivityQuery.
Activity is a read-only, ClickHouse-backed type that does not support
field selectors, so use the ActivityQuery API to filter by time range,
policy, or other criteria.

## What happens when it fails

If the phase is `Failed`, check `status.message` for the reason:

```bash
kubectl get reindexjob backfill-last-7-days -o jsonpath='{.status.message}'
```

Common causes:

- The time range extends beyond the 60-day ClickHouse retention window
- A policy named in `policySelector.names` does not exist
- The worker pod was evicted due to resource pressure

Failed jobs are not retried automatically. Create a new ReindexJob to try
again, adjusting the spec to address the root cause.

## Known limitation: Kubernetes events

When a Kubernetes Event is updated (for example, a pod OOM event fires five
times and its `count` field increments from 1 to 5), the event retains the same
UID throughout its lifetime. Reindexing produces one activity per event UID,
reflecting the event's final state — the intermediate occurrences are not
recoverable.

**Example:** An event fires 5 times (count = 5). Reindexing generates 1
activity, not 5.

If preserving individual event occurrences matters, scope your ReindexJob to
audit logs only by using `policySelector` to select policies that only have
`auditRules` (no `eventRules`). This avoids reprocessing Kubernetes Events
entirely.

## Reference: spec fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.timeRange.startTime` | string | Yes | Start of the window to reindex. Relative (`now-7d`) or absolute (RFC3339). Maximum lookback: 60 days. |
| `spec.timeRange.endTime` | string | No | End of the window. Defaults to `"now"` at job start time. |
| `spec.policySelector.names` | string[] | No | Reindex against these ActivityPolicy names only. Mutually exclusive with `matchLabels`. |
| `spec.policySelector.matchLabels` | map | No | Select policies by label. Mutually exclusive with `names`. |
| `spec.config.batchSize` | integer | No | Events per batch. Default: 1000. Range: 100–10000. Larger batches process faster but use more memory. |
| `spec.config.rateLimit` | integer | No | Maximum events per second. Default: 100. Range: 10–1000. |
| `spec.config.dryRun` | boolean | No | When true, processes events and reports progress without writing activities. Default: false. |
| `spec.ttlSecondsAfterFinished` | integer | No | Seconds to retain the job resource after it finishes. If unset, retained indefinitely. |

## Related documentation

- [ActivityPolicy reference](../api.md#activitypolicy) — how to write policy rules
- [Activity pipeline](../architecture/activity-pipeline.md) — how activities are generated from events
- [API reference](../api.md) — complete spec for all activity resources
