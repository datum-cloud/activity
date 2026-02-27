// Activity System Overview Dashboard
// Generated using Grafonnet v11.4.0
// To build: jsonnet -J vendor dashboards/activity-system-overview.jsonnet > ../config/components/observability/dashboards/generated/activity-system-overview.json

local g = import 'grafonnet-v11.4.0/main.libsonnet';
local config = import '../config.libsonnet';

local dashboard = g.dashboard;
local panel = g.panel;
local stat = panel.stat;
local timeSeries = panel.timeSeries;
local text = panel.text;
local row = panel.row;
local prometheus = g.query.prometheus;
local util = g.util;

// Configuration
local datasource = config.dashboards.datasource.name;
local datasourceRegex = config.dashboards.datasource.regex;
local refresh = config.dashboards.refresh;

// Reusable Queries
local queries = {
  // System health indicators (derived)
  auditPipelineStatus: '(min(up{job="vector",namespace="activity-system"}) and min(activity:vector_throughput:5m > 0)) or vector(0)',
  eventsPipelineStatus: '(min(event_exporter_nats_connection_status{job="k8s-event-exporter"}) and min(event_exporter_informer_synced{job="k8s-event-exporter"})) or vector(0)',
  activityGenerationStatus: '(min(up{job="activity-processor"}) and min(activity_processor_nats_connection_status{job="activity-processor"})) or vector(0)',
  storageHealth: 'min(up{job=~"clickhouse-activity-clickhouse|nats-system/nats"})',

  // Throughput metrics
  auditEventsRate: 'activity:vector_throughput:5m',
  k8sEventsRate: 'sum(rate(event_exporter_events_published_total[5m]))',
  activitiesGeneratedRate: 'sum(rate(activity_processor_activities_generated_total[5m]))',
  totalStorageRate: 'activity:vector_writes:5m + activity:vector_writes_events:5m',

  // Combined throughput
  combinedThroughput: {
    audit: 'activity:vector_throughput:5m',
    events: 'sum(rate(event_exporter_events_published_total[5m]))',
    activities: 'sum(rate(activity_processor_activities_generated_total[5m]))',
  },

  // Error rates
  auditPipelineErrors: 'sum(rate(vector_component_errors_total{namespace="activity-system"}[5m])) or vector(0)',
  eventsPipelineErrors: '(sum(rate(event_exporter_publish_errors_total[5m])) or vector(0)) + (sum(rate(vector_component_errors_total{component_id="clickhouse_k8s_events"}[5m])) or vector(0))',
  // Using NATS errors + skipped events as proxy for processor errors
  processorErrors: '(sum(rate(activity_processor_nats_errors_total[5m])) or vector(0)) + (sum(rate(activity_processor_events_skipped_total[5m])) or vector(0))',
  // Using apiserver 5xx errors as proxy for query errors
  queryErrors: 'sum(rate(apiserver_request_total{job="activity-apiserver",code=~"5.."}[5m])) or vector(0)',

  // Latency metrics
  auditPipelineLatency: 'histogram_quantile(0.95, sum(rate(activity_pipeline_end_to_end_latency_seconds_bucket{stage="nats_to_aggregator"}[5m])) by (le))',
  eventsPipelineLatency: 'histogram_quantile(0.95, sum(rate(event_exporter_publish_latency_seconds_bucket[5m])) by (le))',
};

// Build all panels
local allPanels =
  // ============================================================================
  // Row 1: System Health
  // ============================================================================
  [
    row.new('System Health')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(0),
  ]
  + util.grid.makeGrid([
    stat.new('Audit Pipeline Status')
    + stat.panelOptions.withDescription('Audit log pipeline health (Vector up + receiving events)')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.auditPipelineStatus)
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'Degraded', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'Healthy', color: 'green' } } },
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),

    stat.new('Events Pipeline Status')
    + stat.panelOptions.withDescription('K8s events pipeline health (Exporter connected + synced)')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.eventsPipelineStatus)
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'Degraded', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'Healthy', color: 'green' } } },
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),

    stat.new('Activity Generation Status')
    + stat.panelOptions.withDescription('Activity processor health (Up + NATS connected)')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.activityGenerationStatus)
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'Degraded', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'Healthy', color: 'green' } } },
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),

    stat.new('Storage Health')
    + stat.panelOptions.withDescription('Storage backend components (ClickHouse + NATS)')
    + stat.options.withTextMode('value_and_name')
    + stat.options.withColorMode('background')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.storageHealth)
      + prometheus.withLegendFormat('Status'),
    ])
    + stat.standardOptions.withMappings([
      { type: 'value', options: { '0': { text: 'Down', color: 'red' } } },
      { type: 'value', options: { '1': { text: 'All Up', color: 'green' } } },
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'red', value: null },
      { color: 'green', value: 1 },
    ]),
  ], panelWidth=6, panelHeight=6, startY=1)

  // ============================================================================
  // Row 2: Throughput Summary
  // ============================================================================
  + [
    row.new('Throughput Summary')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(7),
  ]
  + util.grid.makeGrid([
    stat.new('Audit Events/sec')
    + stat.panelOptions.withDescription('Audit log processing rate')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.auditEventsRate)
      + prometheus.withLegendFormat('Events/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'blue', value: null },
    ]),

    stat.new('K8s Events/sec')
    + stat.panelOptions.withDescription('Kubernetes event collection rate')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.k8sEventsRate)
      + prometheus.withLegendFormat('Events/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'purple', value: null },
    ]),

    stat.new('Activities Generated/sec')
    + stat.panelOptions.withDescription('Activity generation rate from policies')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.activitiesGeneratedRate)
      + prometheus.withLegendFormat('Activities/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'green', value: null },
    ]),

    stat.new('Total Storage Rate')
    + stat.panelOptions.withDescription('Combined ClickHouse insert rate (all tables)')
    + stat.options.withGraphMode('area')
    + stat.options.withColorMode('value')
    + stat.options.reduceOptions.withCalcs(['lastNotNull'])
    + stat.standardOptions.withUnit('ops')
    + stat.datasource.withType('prometheus')
    + stat.datasource.withUid('$datasource')
    + stat.queryOptions.withTargets([
      prometheus.new('$datasource', queries.totalStorageRate)
      + prometheus.withLegendFormat('Writes/sec'),
    ])
    + stat.standardOptions.thresholds.withSteps([
      { color: 'orange', value: null },
    ]),
  ], panelWidth=6, panelHeight=5, startY=8)

  // ============================================================================
  // Row 3: Key Metrics
  // ============================================================================
  + [
    row.new('Key Metrics')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(13),
  ]
  + util.grid.makeGrid([
    timeSeries.new('Combined Pipeline Throughput')
    + timeSeries.panelOptions.withDescription('Breakdown of all data streams: audit logs, K8s events, and activities')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
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
      prometheus.new('$datasource', queries.combinedThroughput.audit)
      + prometheus.withLegendFormat('Audit Events'),
      prometheus.new('$datasource', queries.combinedThroughput.events)
      + prometheus.withLegendFormat('K8s Events'),
      prometheus.new('$datasource', queries.combinedThroughput.activities)
      + prometheus.withLegendFormat('Activities'),
    ]),

    timeSeries.new('Error Rates Across All Components')
    + timeSeries.panelOptions.withDescription('Errors from all Activity system components')
    + timeSeries.options.legend.withDisplayMode('table')
    + timeSeries.options.legend.withPlacement('bottom')
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
      prometheus.new('$datasource', queries.auditPipelineErrors)
      + prometheus.withLegendFormat('Audit Pipeline'),
      prometheus.new('$datasource', queries.eventsPipelineErrors)
      + prometheus.withLegendFormat('Events Pipeline'),
      prometheus.new('$datasource', queries.processorErrors)
      + prometheus.withLegendFormat('Processor'),
      prometheus.new('$datasource', queries.queryErrors)
      + prometheus.withLegendFormat('Query API'),
    ]),

    timeSeries.new('End-to-End Latency (p95)')
    + timeSeries.panelOptions.withDescription('Pipeline latency from event generation to storage')
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
      prometheus.new('$datasource', queries.auditPipelineLatency)
      + prometheus.withLegendFormat('Audit Pipeline (p95)'),
      prometheus.new('$datasource', queries.eventsPipelineLatency)
      + prometheus.withLegendFormat('Events Pipeline (p95)'),
    ]),
  ], panelWidth=8, panelHeight=8, startY=14)

  // ============================================================================
  // Row 4: Quick Links
  // ============================================================================
  + [
    row.new('Quick Links')
    + row.withCollapsed(false)
    + row.gridPos.withH(1)
    + row.gridPos.withW(24)
    + row.gridPos.withX(0)
    + row.gridPos.withY(22),
  ]
  + [
    text.new('Dashboard Navigation')
    + text.panelOptions.withDescription('Quick access to detailed dashboards')
    + text.options.withMode('markdown')
    + text.options.withContent(|||
      ## Detailed Dashboards

      Click to drill into specific components:

      - **[Audit Log Pipeline](/d/audit-pipeline)** - Detailed audit log pipeline monitoring
      - **[Events Pipeline](/d/events-pipeline)** - K8s events collection and processing
      - **[Activity Processor](/d/activity-processor)** - Activity generation and policy evaluation
      - **[Activity API Server](/d/activity-apiserver)** - Query API performance and usage

      ---

      ## Runbooks

      - [Activity System Troubleshooting](https://github.com/datum-cloud/activity-events-pipeline/tree/main/docs/operations)
      - [Pipeline Debugging Guide](https://github.com/datum-cloud/activity-events-pipeline/tree/main/docs/runbooks)
    |||)
    + text.gridPos.withW(24)
    + text.gridPos.withH(6)
    + text.gridPos.withX(0)
    + text.gridPos.withY(23),
  ];

// Dashboard
dashboard.new('Activity System Overview')
+ dashboard.withDescription('Single-pane-of-glass health check for entire Activity system. Quick status of audit pipeline, events pipeline, activity processor, and storage.')
+ dashboard.withTags(['activity', 'overview', 'sre', 'observability'])
+ dashboard.withUid('activity-system-overview')
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
