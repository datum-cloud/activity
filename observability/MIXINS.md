# Activity Monitoring Mixins

This directory contains **Prometheus Monitoring Mixins** - a reusable and maintainable approach to managing:
- 📊 **Grafana Dashboards** (using Grafonnet)
- 🚨 **Alert Rules** (using Jsonnet)
- 📈 **Recording Rules** (using Jsonnet)

## Why Monitoring Mixins?

### Before: Manual YAML (Unmaintainable)
```yaml
# 111 lines of repetitive YAML...
- alert: ActivityClickHouseUnavailable
  expr: rate(activity_clickhouse_query_errors_total{error_type="connection"}[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
    component: clickhouse
  annotations:
    summary: "ClickHouse database is unavailable"
    ...
- alert: VectorNATSUnavailable  # Copy/paste with slight changes
  expr: rate(vector_nats_errors_total{error_type="connection"}[5m]) > 0.1
  for: 5m
  ...
```

### After: Jsonnet Mixins (Maintainable)
```jsonnet
// Reusable alert template
alerts.databaseUnavailable(
  service='Activity',
  database='ClickHouse',
  metric='activity_clickhouse_query_errors_total',
  threshold=0.1
)
```

### Benefits
- ✅ **DRY (Don't Repeat Yourself)** - Define alert patterns once, reuse everywhere
- ✅ **Type-safe** - Catch errors before deployment
- ✅ **Version control friendly** - Small, readable diffs
- ✅ **Parameterized** - Easy to adjust thresholds and customize
- ✅ **Testable** - Validate expressions before deploying
- ✅ **Consistent** - Same patterns across all components

## Structure

```
observability/
├── mixin.libsonnet                    # Main entrypoint - combines all mixins
├── lib/                                # Reusable libraries
│   └── alerts.libsonnet               # Alert template library
├── alerts/                             # Alert definitions (Jsonnet)
│   ├── activity-sli.libsonnet         # Service-level indicators
│   └── activity-pipeline.libsonnet    # Data pipeline alerts
├── rules/                              # Recording rules (Jsonnet)
│   └── activity-recordings.libsonnet  # Pre-computed metrics
├── dashboards/                         # Dashboard source (Jsonnet)
│   ├── activity-apiserver.jsonnet
│   └── audit-pipeline.jsonnet
└── Taskfile.yaml                       # Build automation
```

## Quick Start

### 1. Install Dependencies
```bash
# Install Jsonnet tooling
task observability:install-jsonnet

# Initialize Grafonnet library
task observability:init
```

### 2. Build All Mixin Components
```bash
# Build alerts, recording rules, and dashboards
task observability:build-mixin
```

This generates:
- `config/components/observability/alerts/generated/activity-alerts.yaml`
- `config/components/observability/alerts/generated/activity-recordings.yaml`
- `config/components/observability/dashboards/generated/*.json`

### 3. Deploy
```bash
task observability:deploy
```

## Working with Alert Rules

### Using Pre-built Alert Templates

The `lib/alerts.libsonnet` library provides reusable alert patterns:

```jsonnet
local alerts = import '../lib/alerts.libsonnet';

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'my-service-alerts',
        interval: '30s',
        rules: [
          // Service availability
          alerts.serviceDown(
            service='My Service',
            job='my-service',
            severity='critical',
            forDuration='5m'
          ),

          // High error rate
          alerts.highErrorRate(
            service='My Service',
            job='my-service',
            threshold=0.05,  // 5%
            severity='warning'
          ),

          // High latency
          alerts.highLatency(
            service='My Service Query',
            metric='my_service_duration_seconds',
            threshold=5,  // 5 seconds
            percentile=0.99
          ),

          // Database issues
          alerts.databaseUnavailable(
            service='My Service',
            database='PostgreSQL',
            metric='my_service_db_errors_total'
          ),

          // Pipeline issues
          alerts.pipelineStalled(
            service='My Pipeline',
            metric='events_processed_total',
            component='processor'
          ),

          // Backlog alerts
          alerts.backlogCritical(
            service='My Queue',
            metric='queue_depth',
            threshold=10000,
            component='message-queue'
          ),
        ],
      },
    ],
  },
}
```

### Available Alert Templates

| Template | Use Case | Parameters |
|----------|----------|------------|
| `serviceDown()` | Service unavailable | service, job, severity |
| `highErrorRate()` | Excessive errors | service, job, threshold, metric |
| `highLatency()` | Slow responses | service, metric, threshold, percentile |
| `databaseUnavailable()` | Database connection issues | service, database, metric |
| `pipelineStalled()` | Event processing stopped | service, metric, component |
| `backlogCritical()` | Queue/backlog too large | service, metric, threshold |
| `highResourceUsage()` | CPU/memory limits | service, resource, threshold |

### Creating Custom Alerts

```jsonnet
local alerts = import '../lib/alerts.libsonnet';

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'custom-alerts',
        rules: [
          // Use template as base, override specific fields
          alerts.highErrorRate(
            service='Activity',
            job='activity-apiserver',
            threshold=0.01
          ) + {
            annotations+: {
              runbook_url: 'https://runbooks.example.com/activity-errors',
              dashboard: 'https://grafana.example.com/d/activity',
            },
          },

          // Fully custom alert
          {
            alert: 'ActivityCustomAlert',
            expr: 'my_custom_metric > 100',
            'for': '10m',
            labels: {
              severity: 'warning',
              team: 'platform',
            },
            annotations: {
              summary: 'Custom metric exceeded threshold',
              description: 'Value is {{ $value }}',
            },
          },
        ],
      },
    ],
  },
}
```

## Working with Recording Rules

Recording rules pre-compute expensive queries for better dashboard performance and easier alerting.

### Example Recording Rules

```jsonnet
{
  prometheusRules+:: {
    groups+: [
      {
        name: 'my-recordings',
        interval: '30s',
        rules: [
          // Request rate by status code
          {
            record: 'my_service:request_rate:5m',
            expr: |||
              sum(rate(http_requests_total[5m]))
              by (status, method)
            |||,
          },

          // Error rate percentage
          {
            record: 'my_service:error_rate:5m',
            expr: |||
              sum(rate(http_requests_total{status=~"5.."}[5m]))
              /
              sum(rate(http_requests_total[5m]))
            |||,
          },

          // Latency percentiles
          {
            record: 'my_service:latency:p99',
            expr: |||
              histogram_quantile(0.99,
                sum(rate(http_request_duration_seconds_bucket[5m]))
                by (le)
              )
            |||,
          },
        ],
      },
    ],
  },
}
```

### Using Recording Rules in Alerts

```jsonnet
{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'alerts-using-recordings',
        rules: [
          {
            alert: 'HighErrorRate',
            // Use pre-computed recording rule instead of complex query
            expr: 'my_service:error_rate:5m > 0.05',
            'for': '10m',
            labels: { severity: 'warning' },
            annotations: {
              summary: 'Error rate is {{ $value | humanizePercentage }}',
            },
          },
        ],
      },
    ],
  },
}
```

## Build Tasks

| Task | Description |
|------|-------------|
| `task observability:install-jsonnet` | Install Jsonnet and jsonnet-bundler |
| `task observability:init` | Initialize Grafonnet library |
| `task observability:build-alerts` | Build alert rules from mixin |
| `task observability:build-rules` | Build recording rules from mixin |
| `task observability:build-dashboards` | Build Grafana dashboards |
| `task observability:build-mixin` | Build everything (alerts + rules + dashboards) |
| `task observability:validate-mixin` | Validate all generated files |
| `task observability:deploy` | Deploy to Kubernetes cluster |

## Development Workflow

### 1. Edit Alert Definitions
```bash
vim observability/alerts/activity-sli.libsonnet
```

### 2. Build and Validate
```bash
# Build alerts
task observability:build-alerts

# Or build everything
task observability:build-mixin

# Validate output
task observability:validate-mixin
```

### 3. Test Locally
```bash
# View generated YAML
cat config/components/observability/alerts/generated/activity-alerts.yaml

# Check expressions with promtool (if available)
promtool check rules config/components/observability/alerts/generated/activity-alerts.yaml
```

### 4. Deploy
```bash
task observability:deploy
```

### 5. Verify in Cluster
```bash
# Check PrometheusRules
kubectl get prometheusrules -n activity-system

# Check alert status in VMAlert
task observability:port-forward-vmalert
# Visit http://localhost:8080
```

## Tips and Best Practices

### Alert Naming Conventions
- **Pattern**: `{Service}{Component}{Condition}`
- **Examples**:
  - `ActivityAPIServerDown`
  - `ActivityClickHouseUnavailable`
  - `ActivityPipelineBacklogCritical`

### Recording Rule Naming Conventions
- **Pattern**: `{prefix}:{metric}:{aggregation}`
- **Examples**:
  - `activity:request_rate:5m`
  - `activity:error_rate:5m`
  - `activity:query_duration:p99`

### SLI Labels
Use consistent SLI labels for grouping:
- `availability` - Service up/down
- `success_rate` - Error budget
- `latency` - Response time
- `data_freshness` - Pipeline lag

### Customizing Templates
```jsonnet
// Override specific fields while keeping template defaults
alerts.serviceDown(...) + {
  'for': '15m',  // Change from default 5m
  labels+: {
    team: 'platform',
    page: 'true',
  },
  annotations+: {
    runbook_url: 'https://runbooks.example.com/...',
  },
}
```

### Debugging

```bash
# Pretty-print the generated Prometheus alerts object
jsonnet -J vendor -e '(import "mixin.libsonnet").prometheusAlerts' | jq .

# Check for syntax errors
jsonnet -J vendor mixin.libsonnet

# Validate expressions (requires promtool)
promtool check rules config/components/observability/alerts/generated/*.yaml
```

## CI/CD Integration

Add to `.github/workflows/observability.yaml`:

```yaml
name: Validate Observability Mixin
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Jsonnet
        run: |
          go install github.com/google/go-jsonnet/cmd/jsonnet@latest
          go install github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb@latest

      - name: Install dependencies
        working-directory: observability
        run: jb install

      - name: Build mixin
        working-directory: observability
        run: |
          mkdir -p ../config/components/observability/alerts/generated
          jsonnet -J vendor -e 'std.manifestYamlDoc((import "mixin.libsonnet").prometheusAlerts)' | jq -r . > ../config/components/observability/alerts/generated/activity-alerts.yaml
          jsonnet -J vendor -e 'std.manifestYamlDoc((import "mixin.libsonnet").prometheusRules)' | jq -r . > ../config/components/observability/alerts/generated/activity-recordings.yaml

      - name: Validate YAML
        run: |
          for file in config/components/observability/alerts/generated/*.yaml; do
            echo "Validating $file..."
            yq eval . "$file" > /dev/null
          done

      - name: Validate Prometheus rules (optional)
        if: false  # Enable if promtool is available
        run: |
          promtool check rules config/components/observability/alerts/generated/*.yaml
```

## Resources

- [Prometheus Monitoring Mixins](https://monitoring.mixins.dev/)
- [Grafonnet Documentation](https://grafana.github.io/grafonnet-lib/)
- [Jsonnet Tutorial](https://jsonnet.org/learning/tutorial.html)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/alerting/)

## Troubleshooting

### "No such file or directory: vendor"
```bash
cd observability
jb install
```

### "RUNTIME ERROR: expected string result"
Make sure you're using `std.manifestYamlDoc()` to convert objects to YAML strings.

### Alert not firing
1. Check alert is deployed: `kubectl get prometheusrules -n activity-system`
2. Check VMAlert logs: `task test-infra:kubectl -- logs -n telemetry-system -l app.kubernetes.io/name=vmalert`
3. Test expression in Victoria Metrics: `task observability:port-forward-vmsingle`
4. Visit http://localhost:8428/vmui and run the alert expression

### Recording rule not showing up
1. Check PrometheusRule: `kubectl get prometheusrule activity-recordings -n activity-system -o yaml`
2. Check VMAlert picked it up: Visit VMAlert UI and check "Recording rules"
3. Query the recorded metric: Visit http://localhost:8428/vmui and search for `activity:*`
