// Activity Data Pipeline Health Alerts
// Ensures fresh audit data is available
local alerts = import '../lib/alerts.libsonnet';

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'activity-pipeline',
        interval: '30s',
        rules: [
          // Data Freshness SLI - Critical for audit compliance
          alerts.pipelineStalled(
            service='ActivityDataPipeline',
            metric='vector_events_out_total{component_id="clickhouse"}',
            component='vector-aggregator',
            severity='critical',
            forDuration='15m',
            sli='data_freshness',
          ) + {
            annotations+: {
              summary: 'Audit event pipeline has stalled',
              description: 'No new audit events are being stored in ClickHouse. Data is becoming stale.',
              impact: 'Users querying outdated audit data - compliance risk',
            },
          },

          // NATS Consumer Lag - Leading indicator of pipeline issues
          alerts.backlogCritical(
            service='ActivityPipeline',
            metric='nats_jetstream_consumer_num_pending{stream="AUDIT_EVENTS"}',
            threshold=500000,
            component='nats',
            severity='critical',
            forDuration='10m',
            sli='data_freshness',
          ) + {
            annotations+: {
              summary: 'Audit event backlog is critical',
              description: '{{ $value }} audit events pending. Risk of data loss if retention exceeded.',
              impact: 'Large delay in audit event availability - potential data loss',
            },
          },
        ],
      },
    ],
  },
}
