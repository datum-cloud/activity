---
name: analytics
description: Analyze platform activity patterns over time. Use for trend analysis, anomaly detection, compliance reporting, and capacity planning.
---

# Skill: Activity Analytics

This skill helps you analyze platform activity patterns, detect anomalies, and generate reports using the Activity MCP server.

## When to Use

- **Trend analysis**: "How has deployment frequency changed?"
- **Anomaly detection**: "Is activity higher than normal?"
- **Compliance reporting**: "Generate monthly access report"
- **Capacity planning**: "What's our API usage pattern?"

## Available Tools

### Analytics Tools

| Tool | Purpose |
|------|---------|
| `get_activity_timeline` | Activity counts by time bucket |
| `summarize_recent_activity` | High-level activity summary |
| `compare_activity_periods` | Compare two time periods |

### Query Tools (for drill-down)

| Tool | Purpose |
|------|---------|
| `query_audit_logs` | Detailed audit log search |
| `query_activities` | Human-readable activity search |
| `get_audit_log_facets` | Aggregate by user/resource/verb |
| `get_activity_facets` | Aggregate by actor/kind/namespace |

## Common Patterns

### Activity Over Time

```
Tool: get_activity_timeline
Args:
  startTime: "now-7d"
  endTime: "now"
  bucketSize: "hour"         # Options: "hour" or "day"
  changeSource: "human"      # Optional: "human" or "system"
```

Returns:
```json
{
  "timeRange": {"start": "2024-01-08T10:00:00Z", "end": "2024-01-15T10:00:00Z"},
  "bucketSize": "hour",
  "totalCount": 109,
  "buckets": [
    {"timestamp": "2024-01-15T10:00:00Z", "count": 42},
    {"timestamp": "2024-01-15T11:00:00Z", "count": 67, "note": "peak"}
  ],
  "peakBucket": {"timestamp": "2024-01-15T11:00:00Z", "count": 67},
  "averagePerBucket": 54.5
}
```

### Compare Periods

```
Tool: compare_activity_periods
Args:
  baselineStart: "now-14d"
  baselineEnd: "now-7d"
  comparisonStart: "now-7d"
  comparisonEnd: "now"
```

Returns:
```json
{
  "baseline": {"start": "...", "end": "...", "count": 1234},
  "comparison": {"start": "...", "end": "...", "count": 1567},
  "changePercent": 27.0,
  "newInComparison": ["new-user@example.com"],
  "increasedActivity": [{"name": "Deployment", "baseline": 10, "comparison": 25, "changePercent": 150.0}],
  "decreasedActivity": [{"name": "ConfigMap", "baseline": 20, "comparison": 5, "changePercent": -75.0}],
  "analysis": "Activity increased 27% compared to baseline..."
}
```

### Activity Summary

```
Tool: summarize_recent_activity
Args:
  startTime: "now-24h"
  changeSource: "human"      # Optional: "human" or "system"
  topN: 5                    # Optional: number of top items (default 5)
```

Returns:
```json
{
  "timeRange": {"start": "...", "end": "..."},
  "totalActivities": 234,
  "humanChanges": 45,
  "systemChanges": 189,
  "highlights": [
    "234 total activities (45 human, 189 system)",
    "Most active: alice@example.com (23 activities)",
    "Most changed resource type: Deployment (67 activities)"
  ],
  "topActors": [
    {"name": "alice@example.com", "count": 23},
    {"name": "bob@example.com", "count": 15}
  ],
  "topResources": [
    {"name": "Deployment", "count": 67},
    {"name": "ConfigMap", "count": 45}
  ],
  "recentSummaries": ["Alice created Deployment api-gateway"]
}
```

### Top Users

```
Tool: get_audit_log_facets
Args:
  startTime: "now-30d"
  fields: ["user.username"]
  filter: "verb in ['create', 'update', 'delete']"
  limit: 10
```

### Top Resources Changed

```
Tool: get_activity_facets
Args:
  startTime: "now-7d"
  fields: ["spec.resource.kind", "spec.resource.namespace"]
  filter: "spec.changeSource == 'human'"
```

## Report Templates

### Weekly Activity Report

```markdown
# Weekly Activity Report
Period: {{baselineStart}} to {{comparisonEnd}}

## Summary
- Total activities: {{totalActivities}}
- Human changes: {{humanChanges}}
- System changes: {{systemChanges}}

## Compared to Previous Week
- Activity: {{changePercent > 0 ? '+' : ''}}{{changePercent}}%
- Unique users: {{usersChange}}

## Top Contributors
| User | Changes |
|------|---------|
{{#topActors}}
| {{name}} | {{count}} |
{{/topActors}}
```

### Compliance Access Report

```markdown
# Sensitive Resource Access Report
Period: {{startTime}} to {{endTime}}

## Secret Access
| Time | User | Namespace | Secret | Action |
|------|------|-----------|--------|--------|
{{#secretAccess}}
| {{time}} | {{user}} | {{namespace}} | {{name}} | {{verb}} |
{{/secretAccess}}
```

## Analysis Workflows

### Detect Unusual Activity

1. **Get baseline**:
   ```
   get_activity_timeline
     startTime: "now-30d"
     endTime: "now-7d"
     bucketSize: "day"
   ```

2. **Compare to recent**:
   ```
   compare_activity_periods
     baselineStart: "now-14d"
     baselineEnd: "now-7d"
     comparisonStart: "now-7d"
     comparisonEnd: "now"
   ```

3. **Investigate spikes**:
   ```
   query_audit_logs
     startTime: "<spike_time>"
     endTime: "<spike_time + 1h>"
   ```

### Audit User Activity

1. **Get summary**:
   ```
   get_user_activity_summary
     username: "alice@example.com"
     startTime: "now-30d"
   ```

2. **Get details**:
   ```
   query_audit_logs
     filter: "user.username == 'alice@example.com'"
     startTime: "now-30d"
   ```

3. **Check sensitive access**:
   ```
   query_audit_logs
     filter: "user.username == 'alice@example.com' && objectRef.resource == 'secrets'"
   ```
