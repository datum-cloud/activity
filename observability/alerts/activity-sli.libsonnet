// Activity API Server SLI Alerts
// User-facing service quality indicators
local alerts = import '../lib/alerts.libsonnet';

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'activity-sli',
        interval: '30s',
        rules: [
          // Service Availability SLI
          alerts.serviceDown(
            service='Activity API Server',
            job='activity-apiserver',
            severity='critical',
            forDuration='5m',
            sli='availability',
          ) + {
            annotations+: {
              summary: 'Activity is unavailable',
              description: 'Activity has been down for more than 5 minutes. Users cannot query audit logs.',
              impact: 'Complete service outage - no audit log queries possible',
            },
          },

          // Request Success Rate SLI (Error Budget)
          alerts.highErrorRate(
            service='Activity',
            job='activity-apiserver',
            metric='apiserver_request_total',
            threshold=0.01,  // 1%
            severity='warning',
            forDuration='10m',
            sli='success_rate',
          ),

          // Query Latency SLI - Most Critical for User Experience
          alerts.highLatency(
            service='ActivityQuery',
            metric='activity_clickhouse_query_duration_seconds',
            threshold=10,  // 10 seconds
            percentile=0.99,
            severity='warning',
            forDuration='10m',
            sli='latency',
          ) + {
            expr: |||
              histogram_quantile(0.99,
                sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m]))
                by (le)
              ) > 10
            |||,
            annotations+: {
              summary: 'Audit log queries are slow',
              description: 'p99 query latency is {{ $value }}s (target: <10s). Users experiencing slow responses.',
              impact: 'Degraded user experience - queries taking too long',
            },
          },

          // Data Availability SLI - Backend Health
          alerts.databaseUnavailable(
            service='Activity',
            database='ClickHouse',
            metric='activity_clickhouse_query_errors_total',
            errorType='connection',
            threshold=0.1,
            severity='critical',
            forDuration='5m',
            sli='availability',
          ),
        ],
      },
    ],
  },
}
