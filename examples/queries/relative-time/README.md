# Relative Time Query Examples

This directory contains examples of audit log queries using relative time expressions. Relative times make queries **time-agnostic** and **reusable**, perfect for GitOps workflows and automated monitoring.

## Relative Time Format

Relative times use the format: `now` or `now±<duration>`

**Supported units:**
- `s` - seconds
- `m` - minutes
- `h` - hours
- `d` - days
- `w` - weeks

**Examples:**
- `now` - current time
- `now-7d` - 7 days ago
- `now-24h` - 24 hours ago
- `now-2w` - 2 weeks ago
- `now+1d` - 1 day from now (for future queries)

## Why Use Relative Times?

### 1. **Time-Agnostic Queries**
```yaml
# This query works every day without modification
startTime: "now-7d"
endTime: "now"
```

### 2. **GitOps Friendly**
Store queries in Git and apply them continuously:
```bash
# This works every time, no date updates needed
kubectl apply -f examples/queries/relative-time/01-last-7-days.yaml
```

### 3. **Automated Monitoring**
Perfect for CronJobs or continuous compliance checks:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-audit
spec:
  schedule: "0 0 * * *"  # Daily at midnight
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: audit
            image: kubectl:latest
            command:
            - kubectl
            - apply
            - -f
            - /queries/last-24-hours.yaml
```

## Examples in This Directory

| File | Description | Use Case |
|------|-------------|----------|
| `01-last-7-days.yaml` | Query last 7 days of activity | Weekly reports |
| `02-last-24-hours.yaml` | Query last 24 hours | Daily monitoring |
| `03-recent-errors.yaml` | Errors in the last hour | Real-time alerts |
| `04-mixed-absolute-relative.yaml` | Mix absolute and relative times | Queries from specific date to now |
| `05-compliance-weekly-audit.yaml` | Weekly compliance check | Automated compliance |

## Absolute vs. Relative Time

### Absolute Time (RFC3339)
```yaml
startTime: "2024-01-01T00:00:00Z"
endTime: "2024-01-02T00:00:00Z"
```
✅ Use for historical queries
✅ Use when you need exact time ranges
❌ Requires manual updates for recurring queries

### Relative Time
```yaml
startTime: "now-7d"
endTime: "now"
```
✅ Use for recurring queries
✅ Use in GitOps workflows
✅ Use for automated monitoring
❌ Time is evaluated when query is created

## Server-Side Evaluation

Relative times are **evaluated on the API server**, not the client. This means:

1. **`now` = server time** when the query is processed
2. **Consistent across clients** - same query gives same results regardless of client timezone
3. **Works with any Kubernetes client** - kubectl, client-go, Python client, etc.

## More Information

See the main [examples/queries/README.md](../README.md) for more query patterns and the [API documentation](../../docs/api.md) for complete field reference.
