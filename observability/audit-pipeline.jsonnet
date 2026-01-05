// Audit Log Pipeline Dashboard - Simplified View
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor audit-pipeline-simple.jsonnet > audit-pipeline-simple.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local timeSeries = panel.timeSeries;
local text = panel.text;
local row = panel.row;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = 'Victoria Metrics';
local refresh = '30s';

// Build all panels
local allPanels =
  // ============================================================================
  // Row 0: Quick Start Guide (collapsed)
  // ============================================================================
  [
    row.new('Troubleshooting Guide')
    + row.withCollapsed(true)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(0),
  ]
  + [
    text.new('Troubleshooting')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ### Common Issues

      | Problem | Action |
      |---------|--------|
      | Requests Rejected >0 | CRITICAL: Run `kubectl -n activity-system logs -l app=vector-sidecar` |
      | API Server events > Vector ingested | Check webhook endpoint: `kubectl -n activity-system get svc vector-sidecar` |
      | Audit Backend Errors >0 | Check Vector sidecar logs for HTTP errors |
      | Queue Backlog >10k | Scale aggregator: `kubectl -n activity-system scale deploy vector-aggregator --replicas=5` |
      | Part Count >100 | Check ClickHouse CPU/memory; increase `background_pool_size` |
      | Component DOWN | Run `kubectl -n activity-system get pods` |

      ### Thresholds

      | Metric | Healthy | Critical |
      |--------|---------|----------|
      | Latency (p99) | <10s | >60s |
      | Queue Backlog | <1k | >10k |
      | Part Count | <50 | >100 |
      | Error Rate | 0 | >1/s |
    |||)
    + text.gridPos.withH(12)
    + text.gridPos.withW(24)
    + text.gridPos.withX(0)
    + text.gridPos.withY(1),
  ]

  // ============================================================================
  // Row 1: API Server Audit Generation
  // ============================================================================
  + [
    row.new('API Server Audit Generation')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(2),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Audit Event Generation vs Ingestion')
    + timeSeries.panelOptions.withDescription('API server event generation vs Vector ingestion - gap indicates lost events')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(0)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(apiserver_audit_event_total{job=~".*apiserver.*"}[5m]))')
      + prometheus.withLegendFormat('API Server Generated'),
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="webhook",namespace="activity-system",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('Vector Ingested'),
    ]),

    timeSeries.new('Audit Backend Errors')
    + timeSeries.panelOptions.withDescription('Audit events that failed to be written - should be ZERO in healthy state')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(apiserver_audit_error_total{job=~".*apiserver.*"}[5m])) by (plugin)')
      + prometheus.withLegendFormat('{{plugin}} errors'),
    ]),

    stat.new('Requests Rejected')
    + stat.panelOptions.withDescription('API requests rejected due to audit backend failure - CRITICAL if >0')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('short')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(apiserver_audit_requests_rejected_total{job=~".*apiserver.*"})')
      + prometheus.withLegendFormat('Rejected'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'red', value: 1 },
    ]),

    timeSeries.new('Audit Policy Levels')
    + timeSeries.panelOptions.withDescription('Distribution of audit events by policy level (Metadata/Request/RequestResponse)')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(apiserver_audit_level_total{job=~".*apiserver.*"}[5m])) by (level)')
      + prometheus.withLegendFormat('{{level}}'),
    ]),
  ], panelWidth=12, panelHeight=7, startY=3)

  // ============================================================================
  // Row 2: Critical Health Indicators
  // ============================================================================
  + [
    row.new('Critical Health Indicators')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(10),
  ]
  + util.grid.makeGrid([
    stat.new('Ingress Rate')
    + stat.panelOptions.withDescription('Events/sec entering pipeline from K8s API servers')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'sum(rate(vector_component_received_events_total{component_id=~"webhook",namespace="activity-system",pod=~"vector-sidecar.*"}[5m]))'
      )
      + prometheus.withLegendFormat('Events/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 1 },
      { color: 'green', value: 10 },
    ]),

    stat.new('Egress Rate')
    + stat.panelOptions.withDescription('Events/sec written to ClickHouse (should match ingress)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'sum(rate(vector_component_sent_events_total{component_id="clickhouse"}[5m]))'
      )
      + prometheus.withLegendFormat('Events/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 1 },
      { color: 'green', value: 10 },
    ]),

    stat.new('Queue Backlog')
    + stat.panelOptions.withDescription('Messages pending in NATS queue (indicator of backpressure)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('short')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'nats_consumer_num_pending{consumer_name="clickhouse-ingest"}'
      )
      + prometheus.withLegendFormat('Pending'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 1000 },
      { color: 'red', value: 10000 },
    ]),

    stat.new('Error Rate')
    + stat.panelOptions.withDescription('Combined errors across all pipeline components')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'sum(rate(vector_component_errors_total{namespace="activity-system"}[5m])) + sum(rate(activity_clickhouse_query_errors_total[5m]))'
      )
      + prometheus.withLegendFormat('Errors/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.1 },
      { color: 'red', value: 1 },
    ]),

    stat.new('End-to-End Latency (p99)')
    + stat.panelOptions.withDescription('Event generation to queryable in ClickHouse (data freshness)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('s')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'histogram_quantile(0.99, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le)) + (rate(chi_clickhouse_event_InsertQueryTimeMicroseconds{chi="activity-clickhouse"}[5m]) / rate(chi_clickhouse_event_InsertQuery{chi="activity-clickhouse"}[5m]) / 1000000)'
      )
      + prometheus.withLegendFormat('p99'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 10 },
      { color: 'orange', value: 30 },
      { color: 'red', value: 60 },
    ]),

    stat.new('Component Health')
    + stat.panelOptions.withDescription('All pipeline components UP')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'min(up{job=~"vector|nats-system/nats|clickhouse-activity-clickhouse|activity-apiserver",namespace=~"activity-system|nats-system"})'
      )
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'ALL UP', color: 'green' } } },
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),
  ], panelWidth=4, panelHeight=4, startY=11)

  // ============================================================================
  // Row 3: Pipeline Flow Visualization
  // ============================================================================
  + [
    row.new('Pipeline Flow')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(15),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Event Flow Through Pipeline Stages')
    + timeSeries.panelOptions.withDescription('Events per second at each pipeline stage - should be roughly equal in steady state')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="webhook",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('1. Webhook Ingress'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="nats_jetstream",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('2. Published to NATS'),
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="nats_consumer",pod=~"vector-aggregator.*"}[5m]))')
      + prometheus.withLegendFormat('3. Consumed from NATS'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="clickhouse",pod=~"vector-aggregator.*"}[5m]))')
      + prometheus.withLegendFormat('4. Sent to ClickHouse'),
      prometheus.new('$datasource', 'sum(rate(chi_clickhouse_event_InsertedRows{chi="activity-clickhouse"}[5m]))')
      + prometheus.withLegendFormat('5. ClickHouse Writes'),
    ]),

    timeSeries.new('Ingress vs Egress Comparison')
    + timeSeries.panelOptions.withDescription('Pipeline input vs output - gap indicates bottleneck or filtering')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(0)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="webhook",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('Ingress (API Servers)'),
      prometheus.new('$datasource', 'sum(rate(chi_clickhouse_event_InsertedRows{chi="activity-clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Egress (ClickHouse)'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=16)

  // ============================================================================
  // Row 4: Performance Deep Dive
  // ============================================================================
  + [
    row.new('Performance Deep Dive')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(24),
  ]
  + util.grid.makeGrid([
    timeSeries.new('End-to-End Latency (p50/p95/p99)')
    + timeSeries.panelOptions.withDescription('Time from event generation to queryable in ClickHouse')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p99'),
      prometheus.new('$datasource', 'histogram_quantile(0.95, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p95'),
      prometheus.new('$datasource', 'histogram_quantile(0.50, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p50'),
    ]),

    timeSeries.new('NATS Queue Backlog')
    + timeSeries.panelOptions.withDescription('Pending and unacknowledged messages - indicators of backpressure')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(20)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'nats_consumer_num_pending{consumer_name="clickhouse-ingest"}')
      + prometheus.withLegendFormat('Pending Messages'),
      prometheus.new('$datasource', 'nats_consumer_num_ack_pending{consumer_name="clickhouse-ingest"}')
      + prometheus.withLegendFormat('Unacknowledged'),
    ]),

    timeSeries.new('Vector Aggregator Buffer Depth')
    + timeSeries.panelOptions.withDescription('Buffer depth indicates ClickHouse backpressure - high values mean slow writes')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(vector_buffer_events{component_id="clickhouse",namespace="activity-system"})')
      + prometheus.withLegendFormat('Buffered Events'),
    ]),

    timeSeries.new('ClickHouse Insert Performance')
    + timeSeries.panelOptions.withDescription('Insert rate and latency - write path health')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(chi_clickhouse_event_InsertedRows{chi="activity-clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Rows Inserted/sec'),
      prometheus.new('$datasource', 'sum(chi_clickhouse_metric_InsertQuery{chi="activity-clickhouse"})')
      + prometheus.withLegendFormat('Active Insert Queries'),
    ]),
  ], panelWidth=12, panelHeight=7, startY=25)

  // ============================================================================
  // Row 5: Resource Saturation
  // ============================================================================
  + [
    row.new('Resource Saturation')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(32),
  ]
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Active Operations')
    + timeSeries.panelOptions.withDescription('Concurrent operations - high values indicate database saturation')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(1)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(chi_clickhouse_metric_InsertQuery{chi="activity-clickhouse"})')
      + prometheus.withLegendFormat('Inserts'),
      prometheus.new('$datasource', 'sum(chi_clickhouse_metric_Query{chi="activity-clickhouse"})')
      + prometheus.withLegendFormat('Queries'),
      prometheus.new('$datasource', 'chi_clickhouse_metric_Merge{chi="activity-clickhouse"}')
      + prometheus.withLegendFormat('Merges'),
    ]),

    timeSeries.new('Merge Activity vs Insert Rate')
    + timeSeries.panelOptions.withDescription('Merge rate should be 10-100x insert rate for healthy consolidation')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(chi_clickhouse_event_InsertedRows{chi="activity-clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Insert Rate'),
      prometheus.new('$datasource', 'rate(chi_clickhouse_event_MergedRows{chi="activity-clickhouse"}[5m])')
      + prometheus.withLegendFormat('Merge Rate'),
    ]),

    timeSeries.new('Part Count (Query Performance Indicator)')
    + timeSeries.panelOptions.withDescription('Number of data parts - high count (>100) slows queries, needs more merging')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(chi_clickhouse_table_parts{chi="activity-clickhouse",database="audit",table="events"})')
      + prometheus.withLegendFormat('Total Parts'),
    ]),
  ], panelWidth=8, panelHeight=7, startY=33)

  // ============================================================================
  // Row 6: Error Breakdown (collapsed)
  // ============================================================================
  + [
    row.new('Error Breakdown')
    + row.withCollapsed(true)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(40),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Errors by Component')
    + timeSeries.panelOptions.withDescription('Breakdown of errors across all pipeline components')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('right')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(1)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_component_errors_total{namespace="activity-system",pod=~"vector-sidecar.*"}[5m])) by (component_id)')
      + prometheus.withLegendFormat('Sidecar: {{component_id}}'),
      prometheus.new('$datasource', 'sum(rate(vector_component_errors_total{namespace="activity-system",pod=~"vector-aggregator.*"}[5m])) by (component_id)')
      + prometheus.withLegendFormat('Aggregator: {{component_id}}'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('Activity: {{error_type}}'),
      prometheus.new('$datasource', 'sum(rate(activity_cel_filter_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('CEL: {{error_type}}'),
    ]),

    timeSeries.new('Vector Aggregator Errors Detail')
    + timeSeries.panelOptions.withDescription('Vector aggregator error breakdown - most common failure point')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_http_client_errors_total{component_id="clickhouse",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('HTTP Client Errors'),
      prometheus.new('$datasource', 'sum(rate(vector_component_errors_total{component_id="clickhouse",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('Component Errors'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=41)

  // ============================================================================
  // Row 7: Query Performance (collapsed)
  // ============================================================================
  + [
    row.new('Query Performance')
    + row.withCollapsed(true)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(41),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Activity API Query Latency')
    + timeSeries.panelOptions.withDescription('User-facing query performance (p50/p95/p99)')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'histogram_quantile(0.50, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p50'),
      prometheus.new('$datasource', 'histogram_quantile(0.95, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p95'),
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p99'),
    ]),

    timeSeries.new('Query Rate & Errors')
    + timeSeries.panelOptions.withDescription('Query volume and error rates')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_total{status="success"}[5m]))')
      + prometheus.withLegendFormat('Successful Queries'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m]))')
      + prometheus.withLegendFormat('Failed Queries'),
    ]),

    timeSeries.new('Query Patterns')
    + timeSeries.panelOptions.withDescription('Query distribution by scope type')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'rate(activity_auditlog_queries_by_scope_total[5m])')
      + prometheus.withLegendFormat('{{scope_type}}'),
    ]),
  ], panelWidth=8, panelHeight=7, startY=42);

// Dashboard
dashboard.new('Audit Log Pipeline')
+ dashboard.withDescription('Concise, single-screen overview for rapid issue identification. End-to-end monitoring: K8s API → Vector → NATS → ClickHouse → Activity API')
+ dashboard.withTags(['audit', 'pipeline', 'activity', 'observability'])
+ dashboard.withUid('audit-pipeline')
+ dashboard.time.withFrom('now-6h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource'),
])
+ dashboard.withPanels(allPanels)
