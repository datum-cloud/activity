// Activity API Server SLO Dashboard
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor dashboards/activity-slo.jsonnet > ../config/components/observability/dashboards/generated/activity-slo.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local config = import '../config.libsonnet';

local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local gauge = panel.gauge;
local timeSeries = panel.timeSeries;
local row = panel.row;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = config.dashboards.datasource.name;
local datasourceRegex = config.dashboards.datasource.regex;
local refresh = config.dashboards.refresh;

// SLO target: 99.0% availability
local sloTarget = 0.99;

// SLO definitions: display name → recording rule name suffix
local slos = [
  { name: 'Metadata API', key: 'metadata' },
  { name: 'Audit Query', key: 'audit_query' },
  { name: 'Activity Query', key: 'activity_query' },
  { name: 'Event Query', key: 'event_query' },
  { name: 'Availability', key: 'availability' },
];

// Burn rate thresholds (multiples of 1 - sloTarget error rate)
// At 99% target, base error budget rate = 0.01
// page:   14.4x → 14.4 * 0.01 = 0.144 (burns 1h budget in ~5m)
// ticket:  6.0x →  6.0 * 0.01 = 0.060 (burns 1d budget in ~4h)
// low:     3.0x →  3.0 * 0.01 = 0.030 (slow burn)
local burnRateThresholds = {
  page: 0.144,
  ticket: 0.060,
  low: 0.030,
};

// Latency SLO targets (seconds)
local latencyTargets = {
  metadata: 1,   // 1s for metadata/list operations
  queries: 3,    // 3s for audit/activity/event query operations
};

// ============================================================================
// Helper: build a stat panel for one SLO success ratio
// ============================================================================
local sloStatPanel(slo) =
  stat.new(slo.name)
  + stat.panelOptions.withDescription(
    'Current success ratio for %s (good requests / total requests, 5m window). Target: >99.0%%' % slo.name
  )
  + stat.options.withTextMode('value_and_name')
  + stat.options.withColorMode('background')
  + stat.options.withGraphMode('area')
  + stat.options.reduceOptions.withCalcs(['lastNotNull'])
  + stat.standardOptions.withUnit('percentunit')
  + stat.standardOptions.withDecimals(3)
  + stat.datasource.withType('prometheus')
  + stat.datasource.withUid(datasource)
  + stat.queryOptions.withTargets([
    prometheus.new(
      datasource,
      '(activity:slo_%s:request_good:rate5m / activity:slo_%s:request_total:rate5m) and activity:slo_%s:request_total:rate5m > 0' % [slo.key, slo.key, slo.key]
    )
    + prometheus.withLegendFormat(slo.name),
  ])
  + stat.standardOptions.thresholds.withSteps([
    { color: 'red', value: null },
    { color: 'yellow', value: sloTarget },
    { color: 'green', value: 0.999 },
  ])
  + stat.standardOptions.withNoValue('No traffic')
  + { fieldConfig+: { defaults+: { color+: { fixedColor: 'text' } } } }
  + stat.standardOptions.withMappings([
    { type: 'special', options: { match: 'null', result: { text: 'No traffic', color: 'text' } } },
  ]);

// ============================================================================
// Helper: build a gauge panel for error budget remaining
// ============================================================================
// Error budget remaining % = (1 - error_ratio) / (1 - slo_target) clamped to [0,1]
// Simplified: (good/total - slo_target) / (1 - slo_target) * 100
// Or equivalently: (1 - error_ratio - (1 - slo_target)) / (1 - slo_target)
// = (slo_target - error_ratio) / (1 - slo_target)
// We expose as 0-100 percent.
//
// Using 30d window (rate30m used here as a longer burn-rate proxy; switch to
// rate3d if a 3-day window is preferred for budget calculation).
local errorBudgetGaugePanel(slo) =
  gauge.new(slo.name)
  + gauge.panelOptions.withDescription(
    'Error budget remaining for %s at 99%% SLO target. ' % slo.name +
    'Calculated over a 5m window. 100%% = no budget consumed, 0%% = fully exhausted.'
  )
  + gauge.options.withOrientation('auto')
  + gauge.options.reduceOptions.withCalcs(['lastNotNull'])
  + gauge.standardOptions.withUnit('percent')
  + gauge.standardOptions.withDecimals(1)
  + gauge.standardOptions.withMin(0)
  + gauge.standardOptions.withMax(100)
  + gauge.datasource.withType('prometheus')
  + gauge.datasource.withUid(datasource)
  + gauge.queryOptions.withTargets([
    prometheus.new(
      datasource,
      // budget_remaining = clamp_min((slo_target - error_ratio) / (1 - slo_target), 0) * 100
      // error_ratio = 1 - (good/total)
      // => budget_remaining = clamp_min((good/total - slo_target) / (1 - slo_target), 0) * 100
      '(clamp_min((activity:slo_%s:request_good:rate5m / activity:slo_%s:request_total:rate5m - %g) / (1 - %g), 0) * 100) and activity:slo_%s:request_total:rate5m > 0'
      % [slo.key, slo.key, sloTarget, sloTarget, slo.key]
    )
    + prometheus.withLegendFormat(slo.name),
  ])
  + gauge.standardOptions.thresholds.withSteps([
    { color: 'red', value: null },
    { color: 'yellow', value: 10 },
    { color: 'green', value: 25 },
  ])
  + gauge.standardOptions.withNoValue('No traffic')
  + gauge.standardOptions.withMappings([
    { type: 'special', options: { match: 'null', result: { text: 'No traffic', color: 'text' } } },
  ]);

// ============================================================================
// Helper: build a time series target for one SLO burn rate series
// ============================================================================
local burnRateTarget(slo, window) =
  prometheus.new(
    datasource,
    'activity:slo_%s:error_ratio:rate%s' % [slo.key, window]
  )
  + prometheus.withLegendFormat(slo.name);

// ============================================================================
// Helper: build a burn rate time series panel
// ============================================================================
local burnRatePanel(title, description, window) =
  timeSeries.new(title)
  + timeSeries.panelOptions.withDescription(description)
  + timeSeries.options.legend.withDisplayMode('table')
  + timeSeries.options.legend.withPlacement('bottom')
  + timeSeries.options.legend.withShowLegend(true)
  + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean', 'max'])
  + timeSeries.standardOptions.withUnit('percentunit')
  + timeSeries.standardOptions.withDecimals(4)
  + timeSeries.fieldConfig.defaults.custom.withFillOpacity(5)
  + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
  + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
  + timeSeries.fieldConfig.defaults.custom.thresholdsStyle.withMode('line')
  + timeSeries.datasource.withType('prometheus')
  + timeSeries.datasource.withUid(datasource)
  + timeSeries.queryOptions.withTargets(
    std.map(function(slo) burnRateTarget(slo, window), slos)
  )
  + timeSeries.standardOptions.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: burnRateThresholds.low },
    { color: 'orange', value: burnRateThresholds.ticket },
    { color: 'red', value: burnRateThresholds.page },
  ]);

// ============================================================================
// Helper: build a latency time series panel
// ============================================================================
local latencyPanel(title, resourceSelector, threshold) =
  timeSeries.new(title)
  + timeSeries.panelOptions.withDescription('SLO target: p99 < %ds' % threshold)
  + timeSeries.options.legend.withDisplayMode('table')
  + timeSeries.options.legend.withPlacement('bottom')
  + timeSeries.options.legend.withShowLegend(true)
  + timeSeries.options.legend.withCalcs(['lastNotNull', 'mean', 'max'])
  + timeSeries.standardOptions.withUnit('s')
  + timeSeries.fieldConfig.defaults.custom.withFillOpacity(10)
  + timeSeries.fieldConfig.defaults.custom.withLineWidth(2)
  + timeSeries.fieldConfig.defaults.custom.withShowPoints('never')
  + timeSeries.fieldConfig.defaults.custom.thresholdsStyle.withMode('line')
  + timeSeries.datasource.withType('prometheus')
  + timeSeries.datasource.withUid(datasource)
  + timeSeries.queryOptions.withTargets([
    prometheus.new(datasource, 'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver",%s}[5m])) by (le))' % resourceSelector) + prometheus.withLegendFormat('p99'),
    prometheus.new(datasource, 'histogram_quantile(0.95, sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver",%s}[5m])) by (le))' % resourceSelector) + prometheus.withLegendFormat('p95'),
    prometheus.new(datasource, 'histogram_quantile(0.50, sum(rate(apiserver_request_duration_seconds_bucket{job="activity-apiserver",%s}[5m])) by (le))' % resourceSelector) + prometheus.withLegendFormat('p50'),
  ])
  + timeSeries.standardOptions.thresholds.withSteps([
    { color: 'green', value: null },
    { color: 'yellow', value: threshold },
    { color: 'red', value: threshold * 2 },
  ]);

// ============================================================================
// Dashboard layout using wrapPanels for auto-positioning
// ============================================================================
local allPanels = util.grid.wrapPanels(
  // Row 1: SLO Status
  [row.new('SLO Status (5m window)')]
  + std.map(function(p) p + { gridPos+: { w: 4, h: 4 } }, std.map(sloStatPanel, slos))

  // Row 2: Error Budget
  + [row.new('Error Budget Remaining (99% SLO target)')]
  + std.map(function(p) p + { gridPos+: { w: 4, h: 5 } }, std.map(errorBudgetGaugePanel, slos))

  // Row 3: Burn Rate
  + [row.new('Burn Rate (error ratio over time)')]
  + [
    burnRatePanel('Burn Rate — 5m window', 'Short-window burn rate for page-level alerting', 'rate5m') + { gridPos+: { w: 8, h: 8 } },
    burnRatePanel('Burn Rate — 1h window', 'Medium-window burn rate. Sustained elevation requires immediate response.', 'rate1h') + { gridPos+: { w: 8, h: 8 } },
    burnRatePanel('Burn Rate — 6h window', 'Longer-window burn rate for detecting slow burns', 'rate6h') + { gridPos+: { w: 8, h: 8 } },
  ]

  // Row 4: Latency
  + [row.new('Request Latency (SLO targets: 1s metadata, 3s queries)')]
  + [
    latencyPanel('Metadata API Latency', 'resource="activitypolicies",verb!="WATCH"', latencyTargets.metadata) + { gridPos+: { w: 12, h: 8 } },
    latencyPanel('Audit Query Latency', 'resource="auditlogqueries"', latencyTargets.queries) + { gridPos+: { w: 12, h: 8 } },
    latencyPanel('Activity Query Latency', 'resource=~"activityqueries|activityfacetqueries"', latencyTargets.queries) + { gridPos+: { w: 12, h: 8 } },
    latencyPanel('Event Query Latency', 'resource=~"eventqueries|eventfacetqueries"', latencyTargets.queries) + { gridPos+: { w: 12, h: 8 } },
  ]
);

// Dashboard
dashboard.new('Activity API Server — SLO Tracking')
+ dashboard.withDescription(
  'SLO tracking for the Activity API Server: success ratios, error budget consumption, ' +
  'multi-window burn rates, and latency percentiles against defined SLO targets.'
)
+ dashboard.withTags(['activity', 'apiserver', 'slo', 'sre', 'observability'])
+ dashboard.withUid('activity-slo')
+ dashboard.time.withFrom(config.dashboards.timeRange.from)
+ dashboard.time.withTo(config.dashboards.timeRange.to)
+ dashboard.withTimezone(config.dashboards.timezone)
+ dashboard.withRefresh(refresh)
+ dashboard.withEditable(true)
+ dashboard.graphTooltip.withSharedCrosshair()
+ dashboard.withVariables([
  g.dashboard.variable.datasource.new('datasource', config.dashboards.datasource.type)
  + g.dashboard.variable.datasource.generalOptions.withLabel('Prometheus Datasource')
  + g.dashboard.variable.datasource.withRegex(datasourceRegex),
])
+ dashboard.withPanels(allPanels)
