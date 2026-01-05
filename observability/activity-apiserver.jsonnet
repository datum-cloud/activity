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
local datasourceRegex = 'Service Metrics';
local refresh = '30s';
local job = 'activity-apiserver';

// Reusable query functions
local replicaHealthQuery = '(count(up{job="%s"} == 1) or vector(0)) / (count(up{job="%s"}) or vector(1)) * 100' % [job, job];
local successRateQuery = '(1 - (sum(rate(apiserver_request_total{job="%s",code=~"5.."}[5m])) or vector(0)) / (sum(rate(apiserver_request_total{job="%s"}[5m])) or vector(1))) * 100' % [job, job];
local requestRateQuery = 'sum(rate(apiserver_request_total{job="%s"}[5m]))' % job;
local latencyP99Query = 'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{job="%s"}[5m])) by (le))' % job;
local errorRateQuery = '(sum(rate(apiserver_request_total{job="%s",code=~"5.."}[5m])) or vector(0)) / (sum(rate(apiserver_request_total{job="%s"}[5m])) or vector(1))' % [job, job];

// Build all panels
local allPanels =
  // ============================================================================
  // Row 1: Golden Signals - Health at a Glance
  // ============================================================================
  util.grid.makeGrid([
    stat.new('Replica Health')
    + stat.options.withGraphMode('none')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('percent')
    + stat.standardOptions.withDecimals(1)
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        replicaHealthQuery
      )
      + prometheus.withInstant(true)
      + prometheus.withLegendFormat('Replica Health'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 50 },
      { color: 'green', value: 100 },
    ])
    + stat.options.withTextMode('value')
    + stat.panelOptions.withDescription('Percentage of healthy Activity API Server replicas. May temporarily drop during deployments'),

    stat.new('Success Rate')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('percent')
    + stat.standardOptions.withDecimals(2)
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        successRateQuery
      )
      + prometheus.withLegendFormat('Success Rate'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'yellow', value: 99 },
      { color: 'green', value: 99.9 },
    ])
    + stat.panelOptions.withDescription('Percentage of non-5xx responses. Target: >99.9%'),

    stat.new('Request Rate')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('reqps')
    + stat.standardOptions.withDecimals(1)
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        requestRateQuery
      )
      + prometheus.withLegendFormat('Requests/s'),
    ])
    + stat.panelOptions.withDescription('Total API requests per second'),

    stat.new('Latency (p99)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('s')
    + stat.standardOptions.withDecimals(2)
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        latencyP99Query
      )
      + prometheus.withLegendFormat('p99 Latency'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 2 },
      { color: 'red', value: 5 },
    ])
    + stat.panelOptions.withDescription('99th percentile API response time. Target: <2s'),
  ], panelWidth=6, panelHeight=5, startY=0)

  // ============================================================================
  // Row 2: Traffic & Errors
  // ============================================================================
  + util.grid.makeGrid([
    timeSeries.new('Request Rate')
    + timeSeries.options.legend.withDisplayMode('list')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('reqps')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        requestRateQuery
      )
      + prometheus.withLegendFormat('Requests/s'),
    ])
    + timeSeries.panelOptions.withDescription('Total API requests per second over time'),

    timeSeries.new('Error Rate')
    + timeSeries.options.legend.withDisplayMode('list')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('percentunit')
    + timeSeries.standardOptions.withMin(0)
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.thresholdsStyle.withMode('line')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        errorRateQuery
      )
      + prometheus.withLegendFormat('Error Rate'),
    ])
    + timeSeries.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.001 },
      { color: 'red', value: 0.01 },
    ])
    + timeSeries.panelOptions.withDescription('Percentage of 5xx errors. SLO target: <0.1%'),
  ], panelWidth=12, panelHeight=8, startY=5)

  // ============================================================================
  // Row 3: Latency
  // ============================================================================
  + util.grid.makeGrid([
    timeSeries.new('API Latency Percentiles')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean', 'max'])
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
    ])
    + timeSeries.panelOptions.withDescription('Request latency distribution. Most requests should complete quickly'),

    timeSeries.new('ClickHouse Query Duration (p99)')
    + timeSeries.options.legend.withDisplayMode('list')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.standardOptions.withUnit('s')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.thresholdsStyle.withMode('line')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'histogram_quantile(0.99, sum(rate(activity_clickhouse_query_duration_seconds_bucket{operation="total"}[5m])) by (le))'
      )
      + prometheus.withLegendFormat('p99 Query Duration'),
    ])
    + timeSeries.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 5 },
      { color: 'red', value: 10 },
    ])
    + timeSeries.panelOptions.withDescription('Backend query latency. Target: <5s for p99'),
  ], panelWidth=12, panelHeight=8, startY=13)

  // ============================================================================
  // Row 4: Backend Health
  // ============================================================================
  + util.grid.makeGrid([
    timeSeries.new('ClickHouse Query Status')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'sum(rate(activity_clickhouse_query_total[5m])) by (status)'
      )
      + prometheus.withLegendFormat('{{status}}'),
    ])
    + timeSeries.panelOptions.withDescription('Query success vs error rate from ClickHouse backend'),

    timeSeries.new('Result Set Sizes')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean', 'max'])
    + timeSeries.standardOptions.withUnit('short')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'histogram_quantile(0.99, rate(activity_auditlog_query_results_total_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p99'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.95, rate(activity_auditlog_query_results_total_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p95'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.50, rate(activity_auditlog_query_results_total_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p50'),
    ])
    + timeSeries.panelOptions.withDescription('Number of events returned per query. Large p99 (>10k) may indicate overly broad queries'),
  ], panelWidth=12, panelHeight=8, startY=21)

  // ============================================================================
  // Row 5: Usage Patterns
  // ============================================================================
  + util.grid.makeGrid([
    timeSeries.new('Queries by Scope Type')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'sum(rate(activity_auditlog_queries_by_scope_total[5m])) by (scope_type)'
      )
      + prometheus.withLegendFormat('{{scope_type}}'),
    ])
    + timeSeries.panelOptions.withDescription('Query distribution across tenant boundaries'),

    timeSeries.new('CEL Filter Errors')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
    + timeSeries.options.legend.withShowLegend(true)
    + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean'])
    + timeSeries.standardOptions.withUnit('ops')
    + timeSeries.fieldConfig.defaults.custom.withFillOpacity(30)
    + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
    + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
    + timeSeries.datasource.withType('prometheus')
    + timeSeries.datasource.withUid(datasource)
    + timeSeries.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'sum(rate(activity_cel_filter_errors_total[5m])) by (error_type)'
      )
      + prometheus.withLegendFormat('{{error_type}}'),
    ])
    + timeSeries.panelOptions.withDescription('Client-side filter parsing/evaluation errors'),
  ], panelWidth=12, panelHeight=8, startY=29);

// Dashboard
dashboard.new('Activity API Server - Overview')
+ dashboard.withDescription('High-level overview of Activity API Server health, performance, and usage patterns')
+ dashboard.withTags(['activity', 'apiserver', 'overview', 'kubernetes'])
+ dashboard.withUid('activity-apiserver')
+ dashboard.time.withFrom('now-24h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource')
  + g.dashboard.variable.datasource.withRegex(datasourceRegex),
])
+ dashboard.withPanels(allPanels)
