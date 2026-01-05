// Activity Recording Rules
// Pre-computed metrics for dashboard performance and complex aggregations
{
  prometheusRules+:: {
    groups+: [
      {
        name: 'activity-recordings',
        interval: '30s',
        rules: [
          // =========================================================================
          // Request Rate Recordings
          // =========================================================================

          // Overall request rate by verb and resource
          {
            record: 'activity:request_rate:5m',
            expr: |||
              sum(rate(apiserver_request_total{job="activity-apiserver"}[5m]))
              by (verb, resource, code)
            |||,
          },

          // Total request rate (for quick overview)
          {
            record: 'activity:request_rate_total:5m',
            expr: |||
              sum(rate(apiserver_request_total{job="activity-apiserver"}[5m]))
            |||,
          },

          // Error rate percentage (for SLI calculations)
          {
            record: 'activity:error_rate:5m',
            expr: |||
              sum(rate(apiserver_request_total{job="activity-apiserver",code=~"5.."}[5m]))
              /
              sum(rate(apiserver_request_total{job="activity-apiserver"}[5m]))
            |||,
          },

          // =========================================================================
          // API Server Request Duration Recordings
          // =========================================================================

          // API server request latency percentiles (user-facing API performance)
          {
            record: 'activity:apiserver_request_duration:p50',
            expr: |||
              histogram_quantile(0.50,
                sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver"}[5m]))
                by (le)
              )
            |||,
          },

          {
            record: 'activity:apiserver_request_duration:p95',
            expr: |||
              histogram_quantile(0.95,
                sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver"}[5m]))
                by (le)
              )
            |||,
          },

          {
            record: 'activity:apiserver_request_duration:p99',
            expr: |||
              histogram_quantile(0.99,
                sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver"}[5m]))
                by (le)
              )
            |||,
          },

          // =========================================================================
          // Query Performance Recordings
          // =========================================================================

          // Pre-compute query latency percentiles for dashboards
          {
            record: 'activity:query_duration:p50',
            expr: |||
              histogram_quantile(0.50,
                sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m]))
                by (le)
              )
            |||,
          },

          {
            record: 'activity:query_duration:p95',
            expr: |||
              histogram_quantile(0.95,
                sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m]))
                by (le)
              )
            |||,
          },

          {
            record: 'activity:query_duration:p99',
            expr: |||
              histogram_quantile(0.99,
                sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m]))
                by (le)
              )
            |||,
          },

          // Query rate by operation type
          {
            record: 'activity:query_rate:5m',
            expr: |||
              sum(rate(activity_clickhouse_query_total[5m]))
              by (status)
            |||,
          },

          // =========================================================================
          // ClickHouse Performance Recordings
          // =========================================================================

          // ClickHouse query error rate
          {
            record: 'activity:clickhouse_error_rate:5m',
            expr: |||
              sum(rate(activity_clickhouse_query_errors_total[5m]))
              by (error_type)
            |||,
          },

          // =========================================================================
          // Pipeline Throughput Recordings
          // =========================================================================

          // Vector throughput rate (events/sec from NATS consumer)
          {
            record: 'activity:vector_throughput:5m',
            expr: |||
              sum(rate(vector_component_received_events_total{component_id="nats_consumer",namespace="activity-system"}[5m]))
            |||,
          },

          // Vector to ClickHouse write rate
          {
            record: 'activity:vector_writes:5m',
            expr: |||
              sum(rate(vector_component_sent_events_total{component_id="clickhouse",namespace="activity-system"}[5m]))
            |||,
          },

          // Pipeline lag (difference between intake and output)
          {
            record: 'activity:pipeline_lag:5m',
            expr: |||
              sum(rate(vector_component_received_events_total{component_id="nats_consumer",namespace="activity-system"}[5m]))
              -
              sum(rate(vector_component_sent_events_total{component_id="clickhouse",namespace="activity-system"}[5m]))
            |||,
          },

          // =========================================================================
          // NATS JetStream Recordings
          // =========================================================================

          // NATS consumer lag (pending messages for clickhouse-ingest consumer)
          {
            record: 'activity:nats_consumer_lag',
            expr: |||
              nats_consumer_num_pending{stream_name="AUDIT_EVENTS",consumer_name="clickhouse-ingest"}
            |||,
          },

          // NATS stream message rate (total messages in stream)
          {
            record: 'activity:nats_message_rate:5m',
            expr: |||
              rate(nats_stream_total_messages{stream_name="AUDIT_EVENTS"}[5m])
            |||,
          },

          // =========================================================================
          // Resource Utilization Recordings
          // =========================================================================

          // CPU utilization by component
          {
            record: 'activity:cpu_utilization',
            expr: |||
              sum(rate(container_cpu_usage_seconds_total{namespace="activity-system"}[5m]))
              by (pod)
              /
              sum(container_spec_cpu_quota{namespace="activity-system"} / container_spec_cpu_period{namespace="activity-system"})
              by (pod)
            |||,
          },

          // Memory utilization by component
          {
            record: 'activity:memory_utilization',
            expr: |||
              sum(container_memory_working_set_bytes{namespace="activity-system"})
              by (pod)
              /
              sum(container_spec_memory_limit_bytes{namespace="activity-system"})
              by (pod)
            |||,
          },
        ],
      },
    ],
  },
}
