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

// Build all panels
local allPanels =
  // ============================================================================
  // Row 1: Overview Stats
  // ============================================================================
  util.grid.makeGrid([
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
        'sum(rate(activity_processor_events_received_total[5m]))'
      )
      + prometheus.withLegendFormat('Events/s'),
    ])
    + stat.panelOptions.withDescription('Rate of events received from NATS per second'),

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
    + stat.panelOptions.withDescription('Rate of activities generated and published to NATS'),

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
        'sum(rate(activity_processor_events_errored_total[5m])) / sum(rate(activity_processor_events_received_total[5m])) * 100'
      )
      + prometheus.withLegendFormat('Error %'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 1 },
      { color: 'red', value: 5 },
    ])
    + stat.panelOptions.withDescription('Percentage of events that resulted in errors during processing'),

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
    + stat.panelOptions.withDescription('Number of ActivityPolicies currently loaded'),
  ], panelWidth=6, panelHeight=5, startY=0)

  // ============================================================================
  // Row 2: Event Processing
  // ============================================================================
  + [
    row.new('Event Processing')
    + row.withGridPos(5),
  ]

  + util.grid.makeGrid([
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
        'sum(rate(activity_processor_events_received_total[5m])) by (event_type)'
      )
      + prometheus.withLegendFormat('{{event_type}}'),
    ])
    + timeSeries.panelOptions.withDescription('Event processing rate by event type (audit logs vs cluster events)'),

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
        'sum(rate(activity_processor_events_evaluated_total[5m]))'
      )
      + prometheus.withLegendFormat('Evaluated'),
      prometheus.new(
        datasource,
        'sum(rate(activity_processor_activities_generated_total[5m]))'
      )
      + prometheus.withLegendFormat('Generated'),
    ])
    + timeSeries.panelOptions.withDescription('Events evaluated against policies vs activities generated (conversion rate)'),

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
        'sum(rate(activity_processor_events_skipped_total[5m])) by (reason)'
      )
      + prometheus.withLegendFormat('{{reason}}'),
    ])
    + timeSeries.panelOptions.withDescription('Events skipped during processing, grouped by skip reason'),

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
        'histogram_quantile(0.99, sum(rate(activity_processor_event_processing_duration_seconds_bucket[5m])) by (policy_name, le))'
      )
      + prometheus.withLegendFormat('{{policy_name}}'),
    ])
    + timeSeries.panelOptions.withDescription('99th percentile processing duration per policy'),
  ], panelWidth=12, panelHeight=8, startY=6)

  // ============================================================================
  // Row 3: NATS Health
  // ============================================================================
  + [
    row.new('NATS Health')
    + row.withGridPos(14),
  ]

  + util.grid.makeGrid([
    stat.new('NATS Connection Status')
    + stat.options.withGraphMode('none')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid(datasource)
    + stat.queryOptions.withTargets([
      prometheus.new(
        datasource,
        'activity_processor_nats_connection_status'
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
    + stat.panelOptions.withDescription('Current NATS connection status (1=connected, 0=disconnected)'),

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
        'activity_processor_nats_disconnects_total'
      )
      + prometheus.withLegendFormat('Disconnects'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 1 },
      { color: 'red', value: 5 },
    ])
    + stat.panelOptions.withDescription('Total number of NATS disconnection events'),

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
        'histogram_quantile(0.99, rate(activity_processor_nats_publish_latency_seconds_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p99'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
      { color: 'yellow', value: 0.1 },
      { color: 'red', value: 0.5 },
    ])
    + stat.panelOptions.withDescription('99th percentile latency for NATS message publishing'),

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
    + stat.panelOptions.withDescription('Rate of messages published to NATS per second'),
  ], panelWidth=6, panelHeight=5, startY=15)

  + util.grid.makeGrid([
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
        'rate(activity_processor_nats_disconnects_total[5m])'
      )
      + prometheus.withLegendFormat('Disconnects'),
      prometheus.new(
        datasource,
        'rate(activity_processor_nats_reconnects_total[5m])'
      )
      + prometheus.withLegendFormat('Reconnects'),
      prometheus.new(
        datasource,
        'rate(activity_processor_nats_errors_total[5m])'
      )
      + prometheus.withLegendFormat('Errors'),
    ])
    + timeSeries.panelOptions.withDescription('NATS connection events over time'),

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
        'histogram_quantile(0.99, rate(activity_processor_nats_publish_latency_seconds_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p99'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.95, rate(activity_processor_nats_publish_latency_seconds_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p95'),
      prometheus.new(
        datasource,
        'histogram_quantile(0.50, rate(activity_processor_nats_publish_latency_seconds_bucket[5m]))'
      )
      + prometheus.withLegendFormat('p50'),
    ])
    + timeSeries.panelOptions.withDescription('NATS publish latency distribution'),
  ], panelWidth=12, panelHeight=8, startY=20)

  // ============================================================================
  // Row 4: Worker Health
  // ============================================================================
  + [
    row.new('Worker Health')
    + row.withGridPos(28),
  ]

  + util.grid.makeGrid([
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
        'activity_processor_active_workers'
      )
      + prometheus.withLegendFormat('Workers'),
    ])
    + timeSeries.panelOptions.withDescription('Number of active worker goroutines processing events'),

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
        'sum(rate(activity_processor_events_errored_total[5m])) by (error_type)'
      )
      + prometheus.withLegendFormat('{{error_type}}'),
    ])
    + timeSeries.panelOptions.withDescription('Processing errors broken down by error type'),
  ], panelWidth=12, panelHeight=8, startY=29);

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
