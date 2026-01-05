// Reusable alert template library
// Provides standardized alert patterns for consistency across services
{
  // Creates a new alert rule with standard structure
  newAlert(
    name,
    expr,
    labels={},
    annotations={},
    forDuration='5m',
  ):: {
    alert: name,
    expr: expr,
    'for': forDuration,
    labels: labels,
    annotations: annotations,
  },

  // Service availability alert - fires when service is down
  serviceDown(
    service,
    job,
    severity='critical',
    forDuration='5m',
    sli='availability',
  ):: self.newAlert(
    '%sDown' % service,
    'up{job="%s"} == 0' % job,
    {
      severity: severity,
      component: job,
      sli: sli,
    },
    {
      summary: '%s is unavailable' % service,
      description: '%s has been down for more than %s. Service is completely unavailable.' % [service, forDuration],
      impact: 'Complete service outage - service is not responding',
    },
    forDuration
  ),

  // High error rate alert - fires when error percentage exceeds threshold
  highErrorRate(
    service,
    job,
    metric='apiserver_request_total',
    threshold=0.01,  // 1%
    severity='warning',
    forDuration='10m',
    sli='success_rate',
  ):: self.newAlert(
    '%sHighErrorRate' % service,
    |||
      sum(rate(%(metric)s{job="%(job)s",code=~"5.."}[5m]))
      /
      sum(rate(%(metric)s{job="%(job)s"}[5m]))
      > %(threshold)s
    ||| % {
      metric: metric,
      job: job,
      threshold: threshold,
    },
    {
      severity: severity,
      component: job,
      sli: sli,
    },
    {
      summary: 'High error rate in %s' % service,
      description: '{{ $value | humanizePercentage }} of requests are failing (target: <%s%%)' % (threshold * 100),
      impact: 'Users experiencing failed requests',
    },
    forDuration
  ),

  // High latency alert - fires when p99 latency exceeds threshold
  highLatency(
    service,
    metric,
    threshold=10,  // seconds
    percentile=0.99,
    severity='warning',
    forDuration='10m',
    sli='latency',
  ):: self.newAlert(
    '%sLatencyHigh' % service,
    |||
      histogram_quantile(%(percentile)s,
        sum(rate(%(metric)s_bucket[5m]))
        by (le)
      ) > %(threshold)s
    ||| % {
      percentile: percentile,
      metric: metric,
      threshold: threshold,
    },
    {
      severity: severity,
      component: service,
      sli: sli,
    },
    {
      summary: '%s latency is high' % service,
      description: 'p%s latency is {{ $value }}s (target: <%ss). Users experiencing slow responses.' % [percentile * 100, threshold],
      impact: 'Degraded user experience - requests taking too long',
    },
    forDuration
  ),

  // Database connection alert - fires when database is unavailable
  databaseUnavailable(
    service,
    database,
    metric,
    errorType='connection',
    threshold=0.1,
    severity='critical',
    forDuration='5m',
    sli='availability',
  ):: self.newAlert(
    '%s%sUnavailable' % [service, database],
    |||
      rate(%(metric)s{error_type="%(errorType)s"}[5m]) > %(threshold)s
    ||| % {
      metric: metric,
      errorType: errorType,
      threshold: threshold,
    },
    {
      severity: severity,
      component: std.asciiLower(database),
      sli: sli,
    },
    {
      summary: '%s database is unavailable' % database,
      description: 'Cannot connect to %s ({{ $value }} errors/sec). Data is inaccessible.' % database,
      impact: 'Complete service degradation - no data can be retrieved',
    },
    forDuration
  ),

  // Pipeline stalled alert - fires when no events are flowing
  pipelineStalled(
    service,
    metric,
    component,
    severity='critical',
    forDuration='15m',
    sli='data_freshness',
  ):: self.newAlert(
    '%sPipelineStalled' % service,
    |||
      rate(%(metric)s[5m]) == 0
    ||| % {
      metric: metric,
    },
    {
      severity: severity,
      component: component,
      sli: sli,
    },
    {
      summary: '%s pipeline has stalled' % service,
      description: 'No new events are being processed. Data is becoming stale.',
      impact: 'Users querying outdated data - compliance risk',
    },
    forDuration
  ),

  // Backlog critical alert - fires when queue/backlog exceeds threshold
  backlogCritical(
    service,
    metric,
    threshold,
    component,
    severity='critical',
    forDuration='10m',
    sli='data_freshness',
  ):: self.newAlert(
    '%sBacklogCritical' % service,
    |||
      %(metric)s > %(threshold)s
    ||| % {
      metric: metric,
      threshold: threshold,
    },
    {
      severity: severity,
      component: component,
      sli: sli,
    },
    {
      summary: '%s backlog is critical' % service,
      description: '{{ $value }} events pending. Risk of data loss if retention exceeded.',
      impact: 'Large delay in event availability - potential data loss',
    },
    forDuration
  ),

  // Resource usage alert - fires when CPU/memory usage is high
  highResourceUsage(
    service,
    resource,  // 'cpu' or 'memory'
    threshold,  // percentage as decimal (e.g., 0.80 for 80%)
    severity='warning',
    forDuration='15m',
  ):: self.newAlert(
    '%sHigh%sUsage' % [service, std.asciiUpper(resource[0]) + resource[1:]],
    if resource == 'cpu' then
      |||
        sum(rate(container_cpu_usage_seconds_total{pod=~"%(service)s.*"}[5m]))
        /
        sum(container_spec_cpu_quota{pod=~"%(service)s.*"} / container_spec_cpu_period{pod=~"%(service)s.*"})
        > %(threshold)s
      ||| % {
        service: service,
        threshold: threshold,
      }
    else if resource == 'memory' then
      |||
        sum(container_memory_working_set_bytes{pod=~"%(service)s.*"})
        /
        sum(container_spec_memory_limit_bytes{pod=~"%(service)s.*"})
        > %(threshold)s
      ||| % {
        service: service,
        threshold: threshold,
      }
    else
      error 'Unknown resource type: %s' % resource,
    {
      severity: severity,
      component: service,
      resource: resource,
    },
    {
      summary: '%s %s usage is high' % [service, resource],
      description: '{{ $value | humanizePercentage }} %s usage (threshold: %s%%). Risk of OOMKill or throttling.' % [resource, threshold * 100],
      impact: 'Service may become unstable or crash',
    },
    forDuration
  ),
}
