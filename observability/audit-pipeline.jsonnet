// Audit Log Pipeline Dashboard
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor audit-pipeline.jsonnet > audit-pipeline.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local timeSeries = panel.timeSeries;
local row = panel.row;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = 'Victoria Metrics';
local clickhouseDatasource = 'ClickHouse';
local refresh = '30s';

// Build all panels
local allPanels =
  // ============================================================================
  // Row 1: Pipeline Overview - Key Metrics
  // ============================================================================
  [
    row.new('Pipeline Overview - Key Metrics')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(0),
  ]
  + util.grid.makeGrid([
    stat.new('Ingress Rate')
    + stat.panelOptions.withDescription('Events per second entering the pipeline from Vector Sidecar (file + webhook sources)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'sum(rate(vector_component_received_events_total{component_id=~"apiserver_audit_logs|audit_log_webhook",namespace="activity-system",pod=~"vector-sidecar.*"}[5m]))'
      )
      + prometheus.withLegendFormat('Events/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 1 },
      { color: 'green', value: 10 },
    ]),

    stat.new('Pipeline Lag')
    + stat.panelOptions.withDescription('Number of messages pending in NATS queue')
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

    stat.new('ClickHouse Write Rate')
    + stat.panelOptions.withDescription('Events per second being written to ClickHouse')
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

    stat.new('Total Error Rate')
    + stat.panelOptions.withDescription('Combined error rate across all pipeline components')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new(
        '$datasource',
        'sum(rate(vector_http_client_errors_total[5m])) + sum(rate(activity_clickhouse_query_errors_total[5m]))'
      )
      + prometheus.withLegendFormat('Errors/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.1 },
      { color: 'red', value: 1 },
    ]),
  ], panelWidth=6, panelHeight=4, startY=1)

  // ============================================================================
  // Row 2: Pipeline Flow - Throughput by Stage
  // ============================================================================
  + [
    row.new('Pipeline Flow - Throughput by Stage')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(5),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Event Flow Through Pipeline')
    + timeSeries.panelOptions.withDescription('Events per second at each stage of the pipeline')
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
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="apiserver_audit_logs",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('1a. Sidecar: File-based Audit Logs'),
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="audit_log_webhook",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('1b. Sidecar: Webhook Audit Logs'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="nats_jetstream",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('2. Sent to NATS'),
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="nats_consumer",pod=~"vector-aggregator.*"}[5m]))')
      + prometheus.withLegendFormat('3. Consumed from NATS'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="clickhouse",pod=~"vector-aggregator.*"}[5m]))')
      + prometheus.withLegendFormat('4. Written to ClickHouse'),
      prometheus.new('$datasource', 'sum(rate(ClickHouseProfileEvents_InsertedRows{table="events"}[5m]))')
      + prometheus.withLegendFormat('5. ClickHouse Inserts'),
    ]),
  ], panelWidth=24, panelHeight=8, startY=6)

  // ============================================================================
  // Row 3: Component Health Status
  // ============================================================================
  + [
    row.new('Component Health Status')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(14),
  ]
  + util.grid.makeGrid([
    stat.new('Vector Sidecar')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'min(up{job="vector",namespace="activity-system",pod=~"vector-sidecar.*"})')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'UP', color: 'green' } } },
    ]),

    stat.new('NATS JetStream')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'min(up{job="nats-system/nats",namespace="nats-system"})')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'UP', color: 'green' } } },
    ]),

    stat.new('Vector Aggregator')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'min(up{job="vector",namespace="activity-system",pod=~"vector-aggregator.*"})')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'UP', color: 'green' } } },
    ]),

    stat.new('ClickHouse')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'min(up{job="clickhouse-activity-clickhouse",namespace="activity-system"})')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'UP', color: 'green' } } },
    ]),

    stat.new('Activity')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'min(up{job="activity-apiserver",namespace="activity-system"})')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DOWN', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'UP', color: 'green' } } },
    ]),
  ], panelWidth=4, panelHeight=3, startY=15)

  // ============================================================================
  // Row 4: NATS JetStream Queue Metrics
  // ============================================================================
  + [
    row.new('NATS JetStream Queue Metrics')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(18),
  ]
  + util.grid.makeGrid([
    timeSeries.new('NATS Stream & Consumer Messages')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'rate(nats_stream_total_messages{stream_name="AUDIT_EVENTS"}[5m])')
      + prometheus.withLegendFormat('Total Messages in Stream'),
      prometheus.new('$datasource', 'rate(nats_consumer_delivered_consumer_seq{consumer_name="clickhouse-ingest"}[5m])')
      + prometheus.withLegendFormat('Consumer Delivered'),
    ]),

    timeSeries.new('NATS Consumer Lag')
    + timeSeries.panelOptions.withDescription('Pending and unacknowledged messages - indicators of pipeline backpressure')
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
      prometheus.new('$datasource', 'nats_consumer_num_pending{consumer_name="clickhouse-ingest"}')
      + prometheus.withLegendFormat('Pending Messages'),
      prometheus.new('$datasource', 'nats_consumer_num_ack_pending{consumer_name="clickhouse-ingest"}')
      + prometheus.withLegendFormat('Unacknowledged Messages'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=19)

  // ============================================================================
  // Row 5: Vector Aggregator Metrics
  // ============================================================================
  + [
    row.new('Vector Aggregator Metrics')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(27),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Vector Aggregator Throughput')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_component_received_events_total{component_id="nats_consumer",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('Events from NATS'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="clickhouse",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('Events to ClickHouse'),
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_event_bytes_total{component_id="clickhouse",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('Bytes to ClickHouse'),
    ]),

    timeSeries.new('Vector Aggregator Buffer & Errors')
    + timeSeries.panelOptions.withDescription('Buffer depth indicates backpressure; errors indicate failures writing to ClickHouse')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(vector_buffer_events{component_id="clickhouse",namespace="activity-system"})')
      + prometheus.withLegendFormat('Buffer Events'),
      prometheus.new('$datasource', 'sum(vector_buffer_byte_size{component_id="clickhouse",namespace="activity-system"})')
      + prometheus.withLegendFormat('Buffer Bytes'),
      prometheus.new('$datasource', 'sum(rate(vector_http_client_errors_total{component_id="clickhouse",namespace="activity-system"}[5m]))')
      + prometheus.withLegendFormat('Error Rate'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=28)

  // ============================================================================
  // Row 6: ClickHouse Storage Metrics
  // ============================================================================
  + [
    row.new('ClickHouse Storage Metrics')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(36),
  ]
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Insert Performance')
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
      prometheus.new('$datasource', 'sum(rate(ClickHouseProfileEvents_InsertedRows[5m]))')
      + prometheus.withLegendFormat('Rows Inserted/sec'),
      prometheus.new('$datasource', 'sum(ClickHouseMetrics_InsertQuery)')
      + prometheus.withLegendFormat('Active Insert Queries'),
    ]),

    timeSeries.new('ClickHouse Query Activity')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(ClickHouseMetrics_Query)')
      + prometheus.withLegendFormat('Active Queries'),
      prometheus.new('$datasource', 'sum(ClickHouseMetrics_MemoryTracking) / 1024 / 1024 / 1024')
      + prometheus.withLegendFormat('Memory Usage (GB)'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=37)

  // ============================================================================
  // Row 7: Activity Query Performance
  // ============================================================================
  + [
    row.new('Activity Query Performance')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(45),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Query Latency Percentiles')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'histogram_quantile(0.50, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('P50'),
      prometheus.new('$datasource', 'histogram_quantile(0.95, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('P95'),
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('P99'),
    ]),

    timeSeries.new('Query Rate & Errors')
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
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('Errors: {{error_type}}'),
      prometheus.new('$datasource', 'sum(rate(activity_cel_filter_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('CEL Errors: {{error_type}}'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=46)

  // ============================================================================
  // Row 8: Activity Connection Pool
  // ============================================================================
  + [
    row.new('Activity Connection Pool')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(54),
  ]
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Connection Pool')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(1)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'activity_clickhouse_connection_pool_active')
      + prometheus.withLegendFormat('Active Connections'),
      prometheus.new('$datasource', 'activity_clickhouse_connection_pool_idle')
      + prometheus.withLegendFormat('Idle Connections'),
    ]),
  ], panelWidth=24, panelHeight=6, startY=55)

  // ============================================================================
  // Row 9: Error Analysis - All Components
  // ============================================================================
  + [
    row.new('Error Analysis - All Components')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(61),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Errors by Component (Stacked)')
    + timeSeries.panelOptions.withDescription('Combined view of all errors across the pipeline')
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
      prometheus.new('$datasource', 'sum(rate(vector_component_errors_total{namespace="milo-system"}[5m])) by (component)')
      + prometheus.withLegendFormat('Vector Sidecar: {{component}}'),
      prometheus.new('$datasource', 'sum(rate(vector_component_errors_total{namespace="activity-system"}[5m])) by (component)')
      + prometheus.withLegendFormat('Vector Aggregator: {{component}}'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('Activity: {{error_type}}'),
      prometheus.new('$datasource', 'sum(rate(activity_cel_filter_errors_total[5m])) by (error_type)')
      + prometheus.withLegendFormat('CEL Filter: {{error_type}}'),
    ]),
  ], panelWidth=24, panelHeight=8, startY=62);

// Dashboard
dashboard.new('Audit Log Pipeline')
+ dashboard.withDescription('End-to-end monitoring of the audit log pipeline from Milo → Vector → NATS → Vector → ClickHouse → Activity')
+ dashboard.withTags(['audit', 'pipeline', 'activity', 'observability'])
+ dashboard.withUid('audit-pipeline')
+ dashboard.time.withFrom('now-24h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource'),

  g.dashboard.variable.datasource.new('clickhouse_datasource', 'grafana-clickhouse-datasource')
  + g.dashboard.variable.datasource.generalOptions.withLabel('ClickHouse Datasource'),
])
+ dashboard.withPanels(allPanels)
