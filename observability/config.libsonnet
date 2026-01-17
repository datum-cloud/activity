// Activity Observability Shared Configuration
// Common settings used across all dashboards, alerts, and rules
//
// Usage:
//   local config = import 'config.libsonnet';
//   local datasource = config.dashboards.datasource.name;
{
  // Dashboard configuration
  dashboards: {
    // Datasource settings
    datasource: {
      // Template variable name (allows users to select datasource in Grafana)
      name: '$datasource',

      // Regex filter for datasource selection dropdown
      // Only show datasources matching this pattern
      regex: '',

      // Datasource type
      type: 'prometheus',
    },

    // Default refresh interval for all dashboards
    refresh: '30s',

    // Default time range
    timeRange: {
      from: 'now-24h',
      to: 'now',
    },

    // Timezone for all dashboards
    timezone: 'utc',
  },

  // Prometheus job labels
  // Used in metric queries to filter by component
  jobs: {
    // Activity API server
    apiserver: 'activity-apiserver',

    // ClickHouse database
    clickhouse: 'clickhouse-activity-clickhouse',

    // Vector log collector (sidecar and aggregator)
    vector: 'vector',

    // NATS message queue
    nats: 'nats-system/nats',

    // Kubernetes API server (for audit metrics)
    kubeApiserver: '.*apiserver.*',  // Regex to match various kube-apiserver job names
  },

  // Kubernetes namespaces
  namespaces: {
    // Main activity system namespace
    activity: 'activity-system',

    // NATS namespace
    nats: 'nats-system',
  },

  // Alert configuration
  alerts: {
    // Default severity labels
    severities: {
      critical: 'critical',
      warning: 'warning',
      info: 'info',
    },

    // Runbook URL template
    runbookUrlTemplate: 'https://github.com/example/runbooks/blob/main/alerts/%s.md',
  },

  // Recording rule configuration
  rules: {
    // Evaluation interval for recording rules
    interval: '30s',
  },
}
