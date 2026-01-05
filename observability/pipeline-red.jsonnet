// Audit Log Pipeline - RED Metrics Dashboard
// High-level dashboard focused on Rate, Errors, Duration (RED metrics)
// Perfect for: Executives, On-call engineers, SLO monitoring
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor pipeline-red.jsonnet > ../config/components/observability/dashboards/generated/pipeline-red.json

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
  // Row 0: Dashboard Documentation
  // ============================================================================
  [
    row.new('About This Dashboard')
    + row.withCollapsed(true)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(0),
  ]
  + util.grid.makeGrid([
    text.new('Dashboard Overview')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      # Pipeline RED Metrics Dashboard

      This dashboard provides high-level visibility into the audit log pipeline using **RED metrics** (Rate, Errors, Duration).

      ## What is the Audit Log Pipeline?

      The pipeline processes Kubernetes audit events through these stages:

      1. **Ingestion**: Vector sidecars collect audit logs from API servers
      2. **Queue**: NATS JetStream provides durable buffering
      3. **Aggregation**: Vector aggregator processes and enriches events
      4. **Storage**: Events are written to ClickHouse for long-term storage
      5. **Query**: Activity API serves queries from ClickHouse

      ## RED Metrics Explained

      - **Rate**: Throughput (events/sec) - how much traffic is the system handling?
      - **Errors**: Failure rate (% or count) - how often are requests failing?
      - **Duration**: Latency (seconds) - how long does processing take?

      ## Using This Dashboard

      - **Top Row (Overview)**: Quick health check - is the system healthy?
      - **Rate Section**: Monitor throughput and queue depth - is traffic normal?
      - **Errors Section**: Track failure rates - are errors within SLO?
      - **Duration Section**: Check latency - are events processed quickly?
      - **SLI/SLO Section**: 7-day reliability metrics - are we meeting targets?

      ## Healthy Baseline Values

      - **Throughput**: Varies by cluster (1-1000s events/sec)
      - **Error Rate**: < 0.1% (Target: < 0.01%)
      - **Pipeline Lag**: < 30s (Target: < 10s)
      - **Query Latency**: < 1s (Target: < 10s)
      - **Write SLI**: > 99.9%
      - **Read SLI**: > 99.9%
    |||),
  ], panelWidth=24, panelHeight=12, startY=1)

  // ============================================================================
  // Row 1: Overview - Golden Signals
  // ============================================================================
  + [
    row.new('Pipeline Health Overview')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(13),
  ]
  + util.grid.makeGrid([
    stat.new('Pipeline Status')
    + stat.panelOptions.withDescription('Overall pipeline health based on throughput and error rate')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', '(rate(vector_component_sent_events_total{component_id="clickhouse"}[5m]) > 0) * (rate(vector_http_client_errors_total{component_id="clickhouse"}[5m]) < 0.01)')
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'DEGRADED', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'HEALTHY', color: 'green' } } },
      { type: 'special', match: 'null', result: { text: 'NO DATA', color: 'orange' } },
    ]),

    stat.new('Throughput (5m avg)')
    + stat.panelOptions.withDescription('Events per second flowing through the pipeline')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.standardOptions.withUnit('ops')
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 1 },
      { color: 'green', value: 10 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Events/sec'),
    ]),

    stat.new('Error Rate (5m)')
    + stat.panelOptions.withDescription('Combined error rate across all pipeline components')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('percentunit')
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.01 },
      { color: 'red', value: 0.05 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_http_client_errors_total{component_id="clickhouse"}[5m]) + rate(activity_clickhouse_query_errors_total[5m])) / sum(rate(vector_component_sent_events_total{component_id="clickhouse"}[5m]) + rate(activity_clickhouse_query_total[5m]))')
      + prometheus.withLegendFormat('Error Rate'),
    ]),

    stat.new('End-to-End Latency (p99)')
    + stat.panelOptions.withDescription('99th percentile latency from event generation to ClickHouse')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.standardOptions.withUnit('s')
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 30 },
      { color: 'orange', value: 60 },
      { color: 'red', value: 120 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p99 Latency'),
    ]),
  ], panelWidth=6, panelHeight=4, startY=14)

  // ============================================================================
  // Row 2: Rate - Throughput Metrics
  // ============================================================================
  + [
    row.new('Rate - Throughput')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(18),
  ]
  + util.grid.makeGrid([
    text.new('Rate Metrics Help')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ## Understanding Rate Metrics

      **Rate** measures throughput - how many events flow through the system.

      ### What to Look For:

      - **Normal Pattern**: Steady throughput during business hours, lower at night
      - **Ingestion vs Write**: Should match closely (within 5-10%)
      - **NATS Queue Depth**: Rising queue means backpressure - aggregator can't keep up
      - **Query Rate**: User activity - spikes during investigations

      ### Troubleshooting:

      - **Queue Depth Rising**: Scale Vector aggregator or ClickHouse
      - **Ingestion >> Write**: Check for Vector errors or ClickHouse bottlenecks
      - **Zero Throughput**: Check Vector sidecar health, API server audit policy
    |||),
  ], panelWidth=24, panelHeight=4, startY=19)
  + util.grid.makeGrid([
    timeSeries.new('Ingestion Rate')
    + timeSeries.panelOptions.withDescription('Events entering the pipeline (audit events from k8s API servers)')
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
      prometheus.new('$datasource', 'sum(rate(vector_component_sent_events_total{component_id="nats_jetstream",pod=~"vector-sidecar.*"}[5m]))')
      + prometheus.withLegendFormat('Events Ingested/sec'),
    ]),

    timeSeries.new('Write Rate to ClickHouse')
    + timeSeries.panelOptions.withDescription('Events written to ClickHouse storage')
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
      + prometheus.withLegendFormat('Rows Written/sec'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=23)

  + util.grid.makeGrid([
    timeSeries.new('Query Rate')
    + timeSeries.panelOptions.withDescription('Queries per second on the Activity API')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_total{status="success"}[5m]))')
      + prometheus.withLegendFormat('Successful'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_total{status="error"}[5m]))')
      + prometheus.withLegendFormat('Failed'),
    ]),

    timeSeries.new('NATS Queue Depth')
    + timeSeries.panelOptions.withDescription('Pending messages in NATS queue (indicator of backpressure)')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.standardOptions.color.withMode('thresholds')
    + timeSeries.standardOptions.thresholds.withMode('absolute')
    + timeSeries.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 1000 },
      { color: 'orange', value: 10000 },
      { color: 'red', value: 50000 },
    ])
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'nats_consumer_num_pending{consumer_name="clickhouse-ingest"}')
      + prometheus.withLegendFormat('Pending Messages'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=23)

  // ============================================================================
  // Row 3: Errors - Error Rates
  // ============================================================================
  + [
    row.new('Errors - Failure Rates')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(31),
  ]
  + util.grid.makeGrid([
    text.new('Error Metrics Help')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ## Understanding Error Metrics

      **Errors** track failure rates - how often operations fail.

      ### Error Types:

      - **Vector → ClickHouse**: Write failures (HTTP 500s, network issues, schema mismatches)
      - **Activity Query Errors**: Query execution failures (invalid SQL, timeouts, OOM)
      - **CEL Filter Errors**: Client-side filter parsing errors (syntax errors in CEL expressions)

      ### What to Look For:

      - **Target Error Rate**: < 0.1% for writes, < 0.01% for reads
      - **Write Errors**: Usually indicate ClickHouse issues (disk full, out of memory, schema changes)
      - **Query Errors**: Often user errors (bad filters) or resource exhaustion
      - **Error Rate as %**: More meaningful than absolute count - shows reliability

      ### Troubleshooting:

      - **Sudden Spike**: Check ClickHouse logs, recent deployments, schema migrations
      - **Gradual Increase**: Resource exhaustion, scaling needed
      - **100% Errors**: Total outage - check ClickHouse availability, network connectivity
    |||),
  ], panelWidth=24, panelHeight=4, startY=32)
  + util.grid.makeGrid([
    timeSeries.new('Pipeline Error Rate')
    + timeSeries.panelOptions.withDescription('Errors across all pipeline components (Vector, ClickHouse writes, Activity queries)')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_http_client_errors_total{component_id="clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Vector → ClickHouse'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m]))')
      + prometheus.withLegendFormat('Activity Query Errors'),
      prometheus.new('$datasource', 'sum(rate(activity_cel_filter_errors_total[5m]))')
      + prometheus.withLegendFormat('CEL Filter Errors'),
    ]),

    timeSeries.new('Error Rate as % of Traffic')
    + timeSeries.panelOptions.withDescription('Error percentage - SLI for reliability')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull', 'max'])
    + timeSeries.standardOptions.withUnit('percentunit')
    + timeSeries.standardOptions.withMax(0.1)
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.standardOptions.color.withMode('thresholds')
    + timeSeries.standardOptions.thresholds.withMode('absolute')
    + timeSeries.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.01 },
      { color: 'orange', value: 0.05 },
      { color: 'red', value: 0.1 },
    ])
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid('$datasource')
    + timeSeries.queryOptions.withTargets([
      prometheus.new('$datasource', 'sum(rate(vector_http_client_errors_total{component_id="clickhouse"}[5m])) / sum(rate(vector_component_sent_events_total{component_id="clickhouse"}[5m]))')
      + prometheus.withLegendFormat('Write Path Error %'),
      prometheus.new('$datasource', 'sum(rate(activity_clickhouse_query_errors_total[5m])) / sum(rate(activity_clickhouse_query_total[5m]))')
      + prometheus.withLegendFormat('Read Path Error %'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=36)

  // ============================================================================
  // Row 4: Duration - Latency Metrics
  // ============================================================================
  + [
    row.new('Duration - Latency')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(44),
  ]
  + util.grid.makeGrid([
    text.new('Latency Metrics Help')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ## Understanding Duration/Latency Metrics

      **Duration** measures how long operations take - response time and processing lag.

      ### Latency Types:

      - **Write Path (Pipeline Lag)**: Time from event generation to stored in ClickHouse
        - Measured by Vector's `source_lag_time_seconds` using event's `stageTimestamp`
        - Includes: file ingestion, NATS queue time, Vector processing, ClickHouse insert
      - **Read Path (Query Latency)**: Time to execute queries on Activity API
        - ClickHouse query execution time only (not network time)

      ### What to Look For:

      - **Write Path**: p99 < 30s is good, < 10s is excellent
      - **Read Path**: p99 < 1s is good, < 100ms is excellent
      - **Increasing p99**: System under load, may need scaling
      - **Wide p50-p99 gap**: High variability, some requests are very slow

      ### Troubleshooting:

      - **High Write Latency**: Check NATS queue depth, ClickHouse insert performance
      - **High Query Latency**: Check ClickHouse CPU/memory, query complexity, table merge activity
      - **Sudden Spikes**: Often correlated with ClickHouse merges or large queries
    |||),
  ], panelWidth=24, panelHeight=4, startY=45)
  + util.grid.makeGrid([
    timeSeries.new('Write Path Latency')
    + timeSeries.panelOptions.withDescription('Time from event generation to stored in ClickHouse')
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
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p99 Pipeline Lag'),
      prometheus.new('$datasource', 'histogram_quantile(0.95, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p95 Pipeline Lag'),
      prometheus.new('$datasource', 'histogram_quantile(0.50, sum(rate(vector_source_lag_time_seconds_bucket{component_id="nats_consumer"}[5m])) by (le))')
      + prometheus.withLegendFormat('p50 Pipeline Lag'),
    ]),

    timeSeries.new('Read Path Latency')
    + timeSeries.panelOptions.withDescription('Query latency on Activity API (reading from ClickHouse)')
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
      prometheus.new('$datasource', 'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p99 Query Latency'),
      prometheus.new('$datasource', 'histogram_quantile(0.95, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p95 Query Latency'),
      prometheus.new('$datasource', 'histogram_quantile(0.50, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le))')
      + prometheus.withLegendFormat('p50 Query Latency'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=49)

  // ============================================================================
  // Row 5: SLI/SLO Tracking
  // ============================================================================
  + [
    row.new('SLI/SLO Tracking')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(57),
  ]
  + util.grid.makeGrid([
    text.new('SLI/SLO Metrics Help')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ## Understanding SLI/SLO Metrics

      **SLI** (Service Level Indicator): A quantitative measure of service reliability
      **SLO** (Service Level Objective): Target values for SLIs - the promises we make

      ### Our SLOs:

      - **Write Path SLI**: 99.9% of events successfully written to ClickHouse
        - Measures: Vector → ClickHouse write success rate over 7 days
      - **Read Path SLI**: 99.9% of queries successfully executed
        - Measures: Activity API query success rate over 7 days
      - **Latency SLI**: 99% of queries complete in < 10 seconds
        - Measures: Query performance over 7 days
      - **Availability**: 99.9% uptime for Activity API server
        - Measures: Service availability over 7 days

      ### Using SLI Metrics:

      - **Green (>99.9%)**: Meeting SLO - system healthy
      - **Yellow (99.5-99.9%)**: Warning - approaching SLO violation
      - **Red (<99.5%)**: SLO violation - incident response required

      ### Error Budget:

      With 99.9% SLO, you have a **0.1% error budget** (72 minutes/month downtime allowed).
      - Write Path: Can tolerate ~43k failed events/month at 100 events/sec
      - Read Path: Can tolerate ~2.5k failed queries/month at 1 query/sec

      These 7-day rolling windows help you track reliability trends and error budget consumption.
    |||),
  ], panelWidth=24, panelHeight=6, startY=58)
  + util.grid.makeGrid([
    stat.new('Write Path SLI (7d)')
    + stat.panelOptions.withDescription('% of events successfully written to ClickHouse (Target: 99.9%)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('percentunit')
    + stat.standardOptions.withMin(0.99)
    + stat.standardOptions.withMax(1)
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 0.995 },
      { color: 'green', value: 0.999 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', '1 - (sum(increase(vector_http_client_errors_total{component_id="clickhouse"}[7d])) / sum(increase(vector_component_sent_events_total{component_id="clickhouse"}[7d])))')
      + prometheus.withLegendFormat('Success Rate'),
    ]),

    stat.new('Read Path SLI (7d)')
    + stat.panelOptions.withDescription('% of queries successfully executed (Target: 99.9%)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('percentunit')
    + stat.standardOptions.withMin(0.99)
    + stat.standardOptions.withMax(1)
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 0.995 },
      { color: 'green', value: 0.999 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', '1 - (sum(increase(activity_clickhouse_query_errors_total[7d])) / sum(increase(activity_clickhouse_query_total[7d])))')
      + prometheus.withLegendFormat('Success Rate'),
    ]),

    stat.new('Latency SLI (7d)')
    + stat.panelOptions.withDescription('% of queries < 10s (Target: 99%)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('percentunit')
    + stat.standardOptions.withMin(0.95)
    + stat.standardOptions.withMax(1)
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 0.98 },
      { color: 'green', value: 0.99 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', '1 - (sum(increase(activity_clickhouse_query_duration_seconds_bucket{le="10"}[7d])) / sum(increase(activity_clickhouse_query_duration_seconds_count[7d])))')
      + prometheus.withLegendFormat('< 10s'),
    ]),

    stat.new('Pipeline Availability (7d)')
    + stat.panelOptions.withDescription('Overall system uptime (Target: 99.9%)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.standardOptions.withUnit('percentunit')
    + stat.standardOptions.withMin(0.99)
    + stat.standardOptions.withMax(1)
    + stat.standardOptions.color.withMode('thresholds')
    + stat.standardOptions.thresholds.withMode('absolute')
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 0.995 },
      { color: 'green', value: 0.999 },
    ])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', 'avg_over_time(up{job="activity-apiserver"}[7d])')
      + prometheus.withLegendFormat('Uptime'),
    ]),
  ], panelWidth=6, panelHeight=6, startY=64);

// Dashboard
dashboard.new('Pipeline RED Metrics')
+ dashboard.withDescription('High-level RED (Rate, Errors, Duration) metrics dashboard for the audit log pipeline. Focused on SLIs and executive visibility.')
+ dashboard.withTags(['audit', 'pipeline', 'RED', 'SLI', 'observability'])
+ dashboard.withUid('pipeline-red')
+ dashboard.time.withFrom('now-6h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource'),
])
+ dashboard.withPanels(allPanels)
