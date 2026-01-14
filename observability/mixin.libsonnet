// Activity Observability Mixin
// Combines Grafana dashboards, Prometheus alerts, and recording rules
//
// Usage:
//   Alerts:     jsonnet -J vendor -S mixin.libsonnet -e '(import "mixin.libsonnet").prometheusAlerts'
//   Rules:      jsonnet -J vendor -S mixin.libsonnet -e '(import "mixin.libsonnet").prometheusRules'
//   Dashboards: See individual dashboard .jsonnet files
{
  // Import all alert definitions
  _alerts:: {
    sli: import 'alerts/activity-sli.libsonnet',
    pipeline: import 'alerts/activity-pipeline.libsonnet',
  },

  // Import recording rules
  _rules:: {
    recordings: import 'rules/activity-recordings.libsonnet',
  },

  // Combine all alerts into a single PrometheusRule manifest
  prometheusAlerts:: {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'PrometheusRule',
    metadata: {
      name: 'activity-alerts',
      namespace: 'activity-system',
      labels: {
        prometheus: 'activity',
        'app.kubernetes.io/part-of': 'activity',
        monitoring: 'true',
      },
    },
    spec: {
      groups:
        $._alerts.sli.prometheusAlerts.groups +
        $._alerts.pipeline.prometheusAlerts.groups,
    },
  },

  // Combine all recording rules into a single PrometheusRule manifest
  prometheusRules:: {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'PrometheusRule',
    metadata: {
      name: 'activity-recordings',
      namespace: 'activity-system',
      labels: {
        prometheus: 'activity',
        'app.kubernetes.io/part-of': 'activity',
        monitoring: 'true',
      },
    },
    spec: {
      groups: $._rules.recordings.prometheusRules.groups,
    },
  },

  // Export configuration for documentation or debugging
  _config:: {
    name: 'activity-mixin',
    version: '1.0.0',
    description: 'Activity observability mixin: alerts, recording rules, and dashboards',
  },
}
