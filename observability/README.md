# Observability

Programmatic observability stack for Kubernetes audit log collection pipeline
using Grafonnet, Jsonnet, Prometheus, and Grafana.

## Quick Start

```bash
# Install Jsonnet tooling (go-jsonnet, jsonnet-bundler)
task observability:install-jsonnet

# Initialize Grafonnet library
task observability:init

# Generate dashboards
task observability:build-dashboards

# Deploy to cluster
task observability:deploy
```

## Structure

```
observability/
├── dashboards/            # Dashboard source files
├── alerts/                # Prometheus alert rules
├── rules/                 # Recording rules
├── lib/                   # Reusable panels/queries
├── config.libsonnet       # Shared config (datasources, jobs)
└── mixin.libsonnet        # Combined alerts + recording rules

config/components/observability/
├── dashboards/generated/  # Built JSON (generated, do not edit)
├── servicemonitors/       # Prometheus ServiceMonitors
└── alerts/                # PrometheusRules for K8s
```

## Learning Resources

### Jsonnet Fundamentals
- [Jsonnet Tutorial](https://jsonnet.org/learning/tutorial.html) - Language
  basics
- [Jsonnet Standard Library](https://jsonnet.org/ref/stdlib.html) - Built-in
  functions

### Grafonnet (Grafana as Code)
- [Grafonnet Documentation](https://grafana.github.io/grafonnet/index.html) -
  Official docs
- [Grafonnet GitHub
  Examples](https://github.com/grafana/grafonnet/tree/main/examples) - Sample
  dashboards
- [Monitoring Mixins](https://monitoring.mixins.dev/) - Reusable monitoring
  components

### Prometheus & PromQL
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
  - Query language intro
- [PromQL
  Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/) -
  Common query patterns
