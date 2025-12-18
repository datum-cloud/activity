// Activity Grafana Dashboard
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor activity-apiserver.jsonnet > ../generated/activity-apiserver.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local timeSeries = panel.timeSeries;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = '$datasource';
local refresh = '30s';
local job = 'activity-apiserver';

// Reusable query functions
local requestRateQuery = 'sum(rate(apiserver_request_total{job="%s"}[5m])) by (verb, code)' % job;
local errorRateQuery = 'sum(rate(apiserver_request_total{job="%s",code=~"5.."}[5m])) / sum(rate(apiserver_request_total{job="%s"}[5m]))' % [job, job];
local latencyP99Query = 'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{job="%s",verb!~"WATCH|CONNECT"}[5m])) by (le))' % job;
local queryLatencyQuery = 'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m])) by (le))';
local queryCountQuery = 'sum(rate(activity_clickhouse_query_total[5m])) by (status)';

// Build all panels
local allPanels =
  // Row 1: Service Health Overview
  util.grid.makeGrid([
    stat.new('Service Status')
    + stat.options.withGraphMode('none')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['last'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'up{job="%s"}' % job
      )
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),

    stat.new('Request Rate')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('reqps')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        requestRateQuery
      )
      + prometheus.withLegendFormat('{{verb}}'),
    ]),

    stat.new('Error Rate')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('percentunit')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        errorRateQuery
      ),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.01 },
      { color: 'red', value: 0.05 },
    ]),

    stat.new('API Latency (p99)')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('s')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        latencyP99Query
      ),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 2 },
      { color: 'red', value: 5 },
    ]),
  ], panelWidth=6, panelHeight=4, startY=0)

  // Row 2: API Server Performance
  + util.grid.makeGrid([
    timeSeries.new('Request Rate by Verb')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('reqps')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        requestRateQuery
      )
      + prometheus.withLegendFormat('{{verb}} - {{code}}'),
    ]),

    timeSeries.new('Request Latency Percentiles')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull'])
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{job="%s"}[5m])) by (le))' % job
      )
      + prometheus.withLegendFormat('p99'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.95, sum(rate(apiserver_request_duration_seconds_bucket{job="%s"}[5m])) by (le))' % job
      )
      + prometheus.withLegendFormat('p95'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.50, sum(rate(apiserver_request_duration_seconds_bucket{job="%s"}[5m])) by (le))' % job
      )
      + prometheus.withLegendFormat('p50'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=4)

  // Row 3: Query Performance (Most Important SLI)
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Query Latency (p99)')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        queryLatencyQuery
      )
      + prometheus.withLegendFormat('p99 Query Latency'),
      prometheus.new(
        datasource,
        'vector(10)'
      )
      + prometheus.withLegendFormat('SLI Target (10s)'),
    ]),

    timeSeries.new('Query Success vs Errors')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        queryCountQuery
      )
      + prometheus.withLegendFormat('{{status}}'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=12)

  // Row 4: ClickHouse Backend Health
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Query Duration by Operation')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket[5m])) by (le, operation))'
      )
      + prometheus.withLegendFormat('{{operation}}'),
    ]),

    timeSeries.new('Query Errors by Type')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'sum(rate(activity_clickhouse_query_errors_total[5m])) by (error_type)'
      )
      + prometheus.withLegendFormat('{{error_type}}'),
    ]),
  ], panelWidth=12, panelHeight=8, startY=20)

  // Row 5: Query Results Distribution
  + util.grid.makeGrid([
    timeSeries.new('Results Count Distribution')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withCalcs(['mean', 'lastNotNull'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'sum(rate(activity_auditlog_query_results_total_count[5m]))'
      )
      + prometheus.withLegendFormat('Query Results Rate'),
    ]),
  ], panelWidth=24, panelHeight=8, startY=28);

// Dashboard
dashboard.new('Activity')
+ dashboard.withDescription('Monitoring dashboard for Activity audit log service')
+ dashboard.withTags(['activity', 'apiserver', 'kubernetes'])
+ dashboard.withUid('activity-apiserver')
+ dashboard.time.withFrom('now-24h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource'),
])
+ dashboard.withPanels(allPanels)