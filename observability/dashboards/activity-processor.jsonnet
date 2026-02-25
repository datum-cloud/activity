// Activity Processor Grafana Dashboard
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor dashboards/activity-processor.jsonnet > ../config/components/observability/dashboards/generated/activity-processor.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local config = import '../config.libsonnet';

local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local timeSeries = panel.timeSeries;
local row = panel.row;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = config.dashboards.datasource.name;
local datasourceRegex = config.dashboards.datasource.regex;
local refresh = config.dashboards.refresh;

// Panel dimension constants
local statHeight = 5;
local statWidth = 6;
local timeSeriesHeight = 8;
local timeSeriesHalfWidth = 12;

// Build all panels using wrapPanels for auto-layout
local allPanels = util.grid.wrapPanels([
  // ============================================================================
  // Row 1: Overview Stats
  // ============================================================================
  stat.new('Event Processing Rate')
  + stat.options.withGraphMode('area')
  + stat.options.withColorMode('value')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('ops')
  + stat.standardOptions.withDecimals(1)
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_audit_events_received_total[5m]))'
    )
    + prometheus.withLegendFormat('Events/s'),
  ])
  + stat.panelOptions.withDescription('Rate of events received from NATS per second')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('Activity Generation Rate')
  + stat.options.withGraphMode('area')
  + stat.options.withColorMode('value')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('ops')
  + stat.standardOptions.withDecimals(1)
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_activities_generated_total[5m]))'
    )
    + prometheus.withLegendFormat('Activities/s'),
  ])
  + stat.panelOptions.withDescription('Rate of activities generated and published to NATS')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('Error Rate')
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
      'sum(rate(activity_processor_audit_events_errored_total[5m])) / sum(rate(activity_processor_audit_events_received_total[5m])) * 100'
    )
    + prometheus.withLegendFormat('Error %'),
  ])
  + stat.standardOptions.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: 1 },
    { color: 'red', value: 5 },
  ])
  + stat.panelOptions.withDescription('Percentage of events that resulted in errors during processing')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('Active Policies')
  + stat.options.withGraphMode('none')
  + stat.options.withColorMode('value')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('short')
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'activity_processor_active_policies'
    )
    + prometheus.withInstant(true)
    + prometheus.withLegendFormat('Policies'),
  ])
  + stat.panelOptions.withDescription('Number of ActivityPolicies currently loaded')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  // ============================================================================
  // Row 2: Event Processing
  // ============================================================================
  row.new('Event Processing')
  + row.withCollapsed(false),

  timeSeries.new('Events by Type')
  + timeSeries.options.legend.withDisplayMode('table')
  + timeSeries.options.legend.withPlacement('bottom')
  + timeSeries.options.legend.withShowLegend(true)
  + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean'])
  + timeSeries.standardOptions.withUnit('ops')
  + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
  + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
  + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
  + timeSeries.fieldConfig.defaults.custom.stacking.withMode('normal')
  + timeSeries.datasource.withType('prometheus')
  + timeSeries.datasource.withUid(datasource)
  + timeSeries.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_audit_events_received_total[5m]))'
    )
    + prometheus.withLegendFormat('Audit Events'),
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_k8s_events_received_total[5m]))'
    )
    + prometheus.withLegendFormat('Cluster Events'),
  ])
  + timeSeries.panelOptions.withDescription('Event processing rate by event type (audit logs vs cluster events)')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  timeSeries.new('Events Evaluated vs Generated')
  + timeSeries.options.legend.withDisplayMode('table')
  + timeSeries.options.legend.withPlacement('bottom')
  + timeSeries.options.legend.withShowLegend(true)
  + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean'])
  + timeSeries.standardOptions.withUnit('ops')
  + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
  + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
  + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
  + timeSeries.datasource.withType('prometheus')
  + timeSeries.datasource.withUid(datasource)
  + timeSeries.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_audit_events_evaluated_total[5m]))'
    )
    + prometheus.withLegendFormat('Evaluated'),
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_activities_generated_total[5m]))'
    )
    + prometheus.withLegendFormat('Generated'),
  ])
  + timeSeries.panelOptions.withDescription('Events evaluated against policies vs activities generated (conversion rate)')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  timeSeries.new('Skipped Events by Reason')
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
      'sum(rate(activity_processor_audit_events_skipped_total[5m])) by (reason)'
    )
    + prometheus.withLegendFormat('{{reason}}'),
  ])
  + timeSeries.panelOptions.withDescription('Events skipped during processing, grouped by skip reason')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  timeSeries.new('Processing Duration p99 by Policy')
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
      'histogram_quantile(0.99, sum(rate(activity_processor_audit_event_processing_duration_seconds_bucket[5m])) by (policy_name, le))'
    )
    + prometheus.withLegendFormat('{{policy_name}}'),
  ])
  + timeSeries.panelOptions.withDescription('99th percentile processing duration per policy')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  // ============================================================================
  // Row 3: NATS Health
  // ============================================================================
  row.new('NATS Health')
  + row.withCollapsed(false),

  stat.new('NATS Connection Status')
  + stat.options.withGraphMode('none')
  + stat.options.withColorMode('background')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      // Use min() so panel shows Disconnected if ANY instance is disconnected
      'min(activity_processor_nats_connection_status)'
    )
    + prometheus.withInstant(true)
    + prometheus.withLegendFormat('Connected'),
  ])
  + stat.standardOptions.withMappings([
    {
      type: 'value',
      options: {
        '0': { text: 'Disconnected', color: 'red' },
        '1': { text: 'Connected', color: 'green' },
      },
    },
  ])
  + stat.panelOptions.withDescription('Current NATS connection status (shows Disconnected if any instance is disconnected)')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('NATS Disconnects')
  + stat.options.withGraphMode('area')
  + stat.options.withColorMode('background')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('short')
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      // Sum across all instances for total disconnect count
      'sum(activity_processor_nats_disconnects_total)'
    )
    + prometheus.withLegendFormat('Disconnects'),
  ])
  + stat.standardOptions.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: 1 },
    { color: 'red', value: 5 },
  ])
  + stat.panelOptions.withDescription('Total number of NATS disconnection events across all instances')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('NATS Publish Latency p99')
  + stat.options.withGraphMode('area')
  + stat.options.withColorMode('background')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('s')
  + stat.standardOptions.withDecimals(3)
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'histogram_quantile(0.99, sum(rate(activity_processor_nats_publish_latency_seconds_bucket[5m])) by (le))'
    )
    + prometheus.withLegendFormat('p99'),
  ])
  + stat.standardOptions.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: 0.1 },
    { color: 'red', value: 0.5 },
  ])
  + stat.panelOptions.withDescription('99th percentile latency for NATS message publishing')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  stat.new('Messages Published Rate')
  + stat.options.withGraphMode('area')
  + stat.options.withColorMode('value')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('ops')
  + stat.standardOptions.withDecimals(1)
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_nats_messages_published_total[5m]))'
    )
    + prometheus.withLegendFormat('Messages/s'),
  ])
  + stat.panelOptions.withDescription('Rate of messages published to NATS per second')
  + stat.gridPos.withW(statWidth)
  + stat.gridPos.withH(statHeight),

  timeSeries.new('NATS Connection Events')
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
      'sum(rate(activity_processor_nats_disconnects_total[5m]))'
    )
    + prometheus.withLegendFormat('Disconnects'),
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_nats_reconnects_total[5m]))'
    )
    + prometheus.withLegendFormat('Reconnects'),
    prometheus.new(
      datasource,
      'sum(rate(activity_processor_nats_errors_total[5m]))'
    )
    + prometheus.withLegendFormat('Errors'),
  ])
  + timeSeries.panelOptions.withDescription('NATS connection events over time (aggregated across all instances)')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  timeSeries.new('NATS Publish Latency Percentiles')
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
      'histogram_quantile(0.99, sum(rate(activity_processor_nats_publish_latency_seconds_bucket[5m])) by (le))'
    )
    + prometheus.withLegendFormat('p99'),
    prometheus.new(
      datasource,
      'histogram_quantile(0.95, sum(rate(activity_processor_nats_publish_latency_seconds_bucket[5m])) by (le))'
    )
    + prometheus.withLegendFormat('p95'),
    prometheus.new(
      datasource,
      'histogram_quantile(0.50, sum(rate(activity_processor_nats_publish_latency_seconds_bucket[5m])) by (le))'
    )
    + prometheus.withLegendFormat('p50'),
  ])
  + timeSeries.panelOptions.withDescription('NATS publish latency distribution')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  // ============================================================================
  // Row 4: Worker Health
  // ============================================================================
  row.new('Worker Health')
  + row.withCollapsed(false),

  timeSeries.new('Active Workers')
  + timeSeries.options.legend.withDisplayMode('list')
  + timeSeries.options.legend.withPlacement('bottom')
  + timeSeries.options.legend.withShowLegend(true)
  + timeSeries.standardOptions.withUnit('short')
  + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
  + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
  + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
  + timeSeries.datasource.withType('prometheus')
  + timeSeries.datasource.withUid(datasource)
  + timeSeries.queryOptions.withTargets([
    prometheus.new(
      datasource,
      'sum(activity_processor_active_workers)'
    )
    + prometheus.withLegendFormat('Total Workers'),
  ])
  + timeSeries.panelOptions.withDescription('Total number of active worker goroutines across all processor instances')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),

  timeSeries.new('Error Types Breakdown')
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
      'sum(rate(activity_processor_audit_events_errored_total[5m])) by (error_type)'
    )
    + prometheus.withLegendFormat('{{error_type}}'),
  ])
  + timeSeries.panelOptions.withDescription('Processing errors broken down by error type')
  + timeSeries.gridPos.withW(timeSeriesHalfWidth)
  + timeSeries.gridPos.withH(timeSeriesHeight),
]);

// Dashboard
dashboard.new('Activity Processor - Event Pipeline')
+ dashboard.withDescription('Activity Processor metrics for event processing, policy evaluation, and NATS health')
+ dashboard.withTags(['activity', 'processor', 'pipeline', 'nats'])
+ dashboard.withUid('activity-processor')
+ dashboard.time.withFrom('now-24h')
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.graphTooltip.withSharedCrosshair()
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', 'prometheus')
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource')
  + g.dashboard.variable.datasource.withRegex(datasourceRegex),
])
+ dashboard.withPanels(allPanels)
