# Observability (Dashboards, Metrics, Alerts)

This directory contains source files for generating Grafana dashboards programmatically using [Grafonnet](https://github.com/grafana/grafonnet-lib), as well as Taskfile commands for managing observability components.

**Location:** `/observability` at repository root for easy discovery and development.

## Why Grafonnet?

Grafana dashboard JSON files are **huge** (1000+ lines) and **unmaintainable**. Grafonnet allows us to:

- ✅ **Write dashboards as code** - Clear, readable, reviewable
- ✅ **Reuse components** - Define panels once, use everywhere
- ✅ **Version control friendly** - Small diffs, easy reviews
- ✅ **Type-safe** - Catch errors before deployment
- ✅ **Parameterized** - Generate dashboards for multiple services

## Prerequisites

### Install Jsonnet

```bash
# macOS
brew install go-jsonnet jsonnet-bundler

# Linux
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
go install github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb@latest
```

### Install Grafonnet Library

```bash
cd observability/
jb init
jb install github.com/grafana/grafonnet-lib/grafonnet

# Or use the Taskfile
task observability:init
```

This creates:
- `jsonnetfile.json` - Dependency manifest
- `jsonnetfile.lock.json` - Locked versions
- `vendor/` - Downloaded libraries (gitignored)

## Building Dashboards

### Build All Dashboards

```bash
# From repo root using Taskfile
task observability:build-dashboards

# Or manually
cd observability/
jsonnet -J vendor activity-apiserver.jsonnet > ../config/components/observability/dashboards/generated/activity-apiserver.json
```

### Build Single Dashboard

```bash
cd observability/
jsonnet -J vendor activity-apiserver.jsonnet | jq . > ../config/components/observability/dashboards/generated/activity-apiserver.json
```

## Repository Structure

```
/observability/                           # Source files (commit to Git) ← YOU ARE HERE
├── README.md                             # This file
├── Taskfile.yaml                         # Observability task automation
├── jsonnetfile.json                      # Dependencies
├── jsonnetfile.lock.json                # Locked versions
├── vendor/                               # Libraries (gitignored)
│   └── grafonnet/
├── lib/                                  # Shared libraries (TODO)
│   ├── panels.libsonnet                 # Reusable panel templates
│   ├── queries.libsonnet                # Common PromQL queries
│   └── styles.libsonnet                 # Color schemes, thresholds
├── activity-apiserver.jsonnet           # API Server dashboard
├── audit-pipeline.jsonnet               # Audit pipeline dashboard
├── vector-aggregator.jsonnet            # Vector dashboard (TODO)
├── clickhouse.jsonnet                   # ClickHouse dashboard (TODO)
├── nats-jetstream.jsonnet               # NATS dashboard (TODO)
└── pipeline-overview.jsonnet            # End-to-end dashboard (TODO)

/config/components/observability/        # Deployed Kubernetes configs
├── servicemonitors/                      # Prometheus ServiceMonitors
├── alerts/                               # PrometheusRules for alerting
└── dashboards/                           # Grafana dashboards
    ├── generated/                        # Built JSON from Jsonnet
    │   ├── activity-apiserver.json
    │   └── audit-pipeline.json
    ├── activity-apiserver-grafanadashboard.yaml
    ├── audit-pipeline-grafanadashboard.yaml
    └── kustomization.yaml
```

## Example: Creating a New Dashboard

### 1. Create Jsonnet Source

```jsonnet
// my-service.jsonnet
local grafana = import 'grafonnet/grafana.libsonnet';
local dashboard = grafana.dashboard;
local graphPanel = grafana.graphPanel;
local prometheus = grafana.prometheus;

dashboard.new(
  title='My Service',
  uid='my-service',
  refresh='30s',
)
.addRow(
  row.new(title='Overview')
  .addPanel(
    graphPanel.new(
      title='Request Rate',
      datasource='Victoria Metrics',
    )
    .addTarget(
      prometheus.target(
        'sum(rate(http_requests_total[5m])) by (status)',
        legendFormat='{{status}}',
      )
    )
  )
)
```

### 2. Build

```bash
cd observability/
jsonnet -J vendor my-service.jsonnet > ../config/components/observability/dashboards/generated/my-service.json

# Or use the task
task observability:build-dashboards
```

### 3. Deploy

Add to `grafana-dashboards.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  labels:
    grafana_dashboard: "1"
data:
  my-service.json: |-
    {{ readFile "generated/my-service.json" | indent 4 }}
```

## Reusable Panel Library

Create shared components in `lib/`:

```jsonnet
// lib/panels.libsonnet
local grafana = import 'grafonnet/grafana.libsonnet';
local graphPanel = grafana.graphPanel;
local prometheus = grafana.prometheus;

{
  // Standard latency panel (p50/p95/p99)
  latencyPanel(title, metric, datasource='Victoria Metrics')::
    graphPanel.new(
      title=title,
      datasource=datasource,
      format='s',
      legend_show=true,
    )
    .addTargets([
      prometheus.target(
        'histogram_quantile(0.99, sum(rate(%s_bucket[5m])) by (le))' % metric,
        legendFormat='p99',
      ),
      prometheus.target(
        'histogram_quantile(0.95, sum(rate(%s_bucket[5m])) by (le))' % metric,
        legendFormat='p95',
      ),
      prometheus.target(
        'histogram_quantile(0.50, sum(rate(%s_bucket[5m])) by (le))' % metric,
        legendFormat='p50',
      ),
    ]),

  // Standard error rate panel
  errorRatePanel(title, job, datasource='Victoria Metrics')::
    graphPanel.new(
      title=title,
      datasource=datasource,
      format='percentunit',
    )
    .addTarget(
      prometheus.target(
        'sum(rate(http_requests_total{job="%s",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="%s"}[5m]))' % [job, job],
        legendFormat='Error Rate',
      )
    ),
}
```

Use in dashboards:
```jsonnet
local panels = import 'lib/panels.libsonnet';

dashboard.new('My Service')
  .addPanel(panels.latencyPanel('Query Latency', 'my_query_duration_seconds'))
  .addPanel(panels.errorRatePanel('Error Rate', 'my-service'))
```

## Development Workflow

### 1. Edit Jsonnet
```bash
vim activity-apiserver.jsonnet
```

### 2. Build & Preview
```bash
jsonnet -J vendor activity-apiserver.jsonnet | jq . | less
```

### 3. Validate
```bash
# Check JSON is valid
jsonnet -J vendor activity-apiserver.jsonnet | jq . > /dev/null && echo "✓ Valid"
```

### 4. Deploy to Grafana
```bash
# Generate JSON
task observability:build-dashboards

# Deploy observability components
task observability:deploy

# Grafana should auto-import (Grafana Operator watches GrafanaDashboard CRs)
```

## CI/CD Integration

Add to `.github/workflows/dashboards.yaml`:

```yaml
name: Validate Dashboards
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Jsonnet
        run: |
          go install github.com/google/go-jsonnet/cmd/jsonnet@latest
          go install github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb@latest

      - name: Install Dependencies
        working-directory: observability
        run: jb install

      - name: Build Dashboards
        working-directory: observability
        run: |
          for file in *.jsonnet; do
            echo "Building $file..."
            jsonnet -J vendor "$file" | jq . > "../config/components/observability/dashboards/generated/$(basename $file .jsonnet).json"
          done

      - name: Validate JSON
        run: |
          for file in config/components/observability/dashboards/generated/*.json; do
            echo "Validating $file..."
            jq . "$file" > /dev/null
          done
```

## Tips

### Preview in Grafana

1. Build dashboard: `jsonnet -J vendor activity-apiserver.jsonnet > /tmp/dashboard.json`
2. Open Grafana UI
3. Dashboards → Import → Upload JSON file
4. Select data source
5. Preview and adjust

### Debugging

```bash
# Pretty print
jsonnet -J vendor activity-apiserver.jsonnet | jq .

# Show line numbers
jsonnet -J vendor activity-apiserver.jsonnet 2>&1 | cat -n

# Check specific field
jsonnet -J vendor activity-apiserver.jsonnet | jq '.dashboard.panels[0].title'
```

## Resources

- [Grafonnet Documentation](https://grafana.github.io/grafonnet-lib/)
- [Grafonnet Examples](https://github.com/grafana/grafonnet-lib/tree/master/examples)
- [Jsonnet Tutorial](https://jsonnet.org/learning/tutorial.html)
- [Monitoring Mixins](https://monitoring.mixins.dev/)

## Troubleshooting

### "grafonnet not found"

```bash
cd observability/
jb install github.com/grafana/grafonnet-lib/grafonnet

# Or use the task
task observability:init
```

### "vendor directory missing"

Run `jb install` to download dependencies.

### Dashboard not importing

Check ConfigMap labels:
```yaml
labels:
  grafana_dashboard: "1"  # Required for Grafana sidecar
```

### PromQL errors

Test queries in Victoria Metrics first:
```bash
kubectl port-forward -n telemetry-system svc/vmsingle 8428:8428
# Visit http://localhost:8428/vmui
```
