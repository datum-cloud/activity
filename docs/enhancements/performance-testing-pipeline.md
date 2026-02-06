# Enhancement Proposal: Automated Performance Testing Pipeline

**Status**: Draft **Authors**: Platform Engineering Team **Created**: 2026-01-12
**Last Updated**: 2026-01-12

## Summary

This enhancement proposes building an automated, comprehensive performance
testing pipeline for the Activity audit log system. The pipeline will validate
the entire event ingestion and query path under realistic load conditions, model
production hardware configurations, and provide continuous performance insights
to prevent regressions.

## Motivation

The Activity system is designed to ingest high-volume audit events from multiple
tenant Kubernetes control planes and serve them through a queryable API. As the
system scales to support hundreds of tenants and billions of events, we need:

1. **Performance Validation**: Ensure the system meets SLOs under realistic load
2. **Regression Detection**: Catch performance degradations before production
3. **Capacity Planning**: Understand scaling limits and resource requirements
4. **Component Testing**: Validate each pipeline stage (Vector → NATS →
   ClickHouse → API)
5. **Real-World Simulation**: Test with production-like data volumes and query
   patterns

Currently, we have basic k6 query load tests, but we lack:
- Systematic ingestion load testing
- Multi-tenant simulation (hundreds of control planes)
- Historical data backfill capabilities
- End-to-end pipeline validation
- Automated continuous testing

## Goals

### Primary Goals

- Create a dedicated performance testing environment that models production
  hardware
- Build configurable audit event generators that simulate multiple Kubernetes
  control planes
- Implement data backfill capabilities to test queries against large historical
  datasets
- Develop comprehensive load test scenarios covering both ingestion and querying
- Establish automated test execution and reporting
- Provide clear performance metrics and SLO tracking

### Non-Goals

- Production load testing (this is for pre-production validation)
- Chaos engineering or fault injection (separate effort)
- Security penetration testing
- Cost optimization (though insights may inform this)

## Architecture

### Test Environment Components

```
activity-perf-test namespace
│
├── ClickHouse Cluster (3 nodes)
│   ├── Production-grade storage configuration
│   ├── Hot/cold tiering with S3
│   └── Real-world data volumes (billions of events)
│
├── Vector Pipeline
│   ├── Vector Sidecar (simulated API servers)
│   └── Vector Aggregator (2-5 replicas, HPA enabled)
│
├── NATS JetStream (3-node HA cluster)
│   ├── Stream: AUDIT_EVENTS
│   └── Consumer: clickhouse-ingest
│
├── Activity API Server (2-3 replicas, HPA enabled)
│   └── Query endpoint with tenant isolation
│
├── Load Generation
│   ├── k6 Ingestion Tests (audit event generation)
│   ├── k6 Query Tests (multi-tenant queries)
│   └── Data Backfill Job (historical data seeding)
│
└── Observability
    ├── Prometheus (metrics collection)
    ├── Grafana (dashboards)
    └── Test Result Archive
```

### Data Flow

```
┌─────────────────┐
│ k6 Ingestion    │  Simulates N control planes
│ Load Generator  │  sending audit events
└────────┬────────┘
         │ POST /webhook
         ▼
┌─────────────────┐
│ Vector Webhook  │  Receives events, adds metadata
│ (Sidecar)       │
└────────┬────────┘
         │ Publish
         ▼
┌─────────────────┐
│ NATS JetStream  │  Durable event stream
│ Stream: AUDIT   │  with acknowledgements
└────────┬────────┘
         │ Pull Subscribe
         ▼
┌─────────────────┐
│ Vector          │  Consumes, transforms,
│ Aggregator      │  filters (ResponseComplete)
└────────┬────────┘
         │ Batch Insert
         ▼
┌─────────────────┐
│   ClickHouse    │  Audit events table with
│   Database      │  projections for queries
└────────▲────────┘
         │ SQL Query
         │
┌────────┴────────┐
│   Activity API  │◄─── k6 Query Load Generator
│     Server      │     (tenant + platform queries)
└─────────────────┘
```

## Implementation Plan

### Phase 1: Test Environment Foundation (Week 1-2)

**Objective**: Create a production-like test environment

**Tasks**:
- Create `config/overlays/perf-test/` overlay
- Scale ClickHouse to 3-node cluster with production storage
- Deploy NATS in HA configuration (3 nodes)
- Configure Vector with HPA (2-5 replicas)
- Configure Activity API with HPA (2-3 replicas)
- Apply resource quotas and limits

**Deliverables**:
- `config/overlays/perf-test/kustomization.yaml`
- `config/overlays/perf-test/patches/clickhouse-cluster-patch.yaml`
- `config/overlays/perf-test/patches/nats-ha-patch.yaml`
- `config/overlays/perf-test/patches/vector-scaling-patch.yaml`
- `config/overlays/perf-test/patches/apiserver-scaling-patch.yaml`

**Success Criteria**:
- All components deploy successfully
- Health checks pass
- Basic smoke test passes (single event ingestion and query)

### Phase 2: Data Backfill System (Week 2-3)

**Objective**: Seed the database with realistic historical data

**Approach**: Hybrid strategy
1. **Bulk Insert** for old history (days 90-30): Direct ClickHouse insert for
   speed
2. **Pipeline Replay** for recent history (days 30-0): Through Vector to test
   pipeline

**Implementation**:

```go
// Pseudo-code for backfill job
type BackfillConfig struct {
    HistoryDays          int    // Total days of history to create
    TotalEvents          int64  // Total events to generate
    ControlPlanes        int    // Number of simulated tenants
    BulkInsertUntilDay   int    // Days to use bulk insert (90-30)
    ReplayFromDay        int    // Days to replay through pipeline (30-0)
}

func generateHistoricalEvents(cfg BackfillConfig) []AuditEvent {
    events := make([]AuditEvent, 0, cfg.TotalEvents)

    // Distribute events across time and tenants
    eventsPerDay := cfg.TotalEvents / cfg.HistoryDays
    eventsPerTenant := eventsPerDay / cfg.ControlPlanes

    for day := cfg.HistoryDays; day >= 0; day-- {
        timestamp := time.Now().Add(-time.Duration(day) * 24 * time.Hour)

        for tenant := 0; tenant < cfg.ControlPlanes; tenant++ {
            for i := 0; i < eventsPerTenant; i++ {
                events = append(events, generateRealisticEvent(
                    timestamp,
                    fmt.Sprintf("tenant-%d", tenant),
                    // Realistic distribution of verbs, resources, etc.
                ))
            }
        }
    }

    return events
}
```

**Configuration**:
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: activity-backfill
  namespace: activity-perf-test
spec:
  template:
    spec:
      containers:
      - name: backfill
        image: activity-backfill:latest
        env:
        - name: CLICKHOUSE_ADDRESS
          value: "clickhouse.activity-perf-test:9000"
        - name: HISTORY_DAYS
          value: "90"
        - name: TOTAL_EVENTS
          value: "10000000"  # 10M events
        - name: CONTROL_PLANES
          value: "50"
        - name: BULK_INSERT_UNTIL_DAY
          value: "30"
        - name: REPLAY_FROM_DAY
          value: "30"
      restartPolicy: Never
  backoffLimit: 3
```

**Deliverables**:
- `test/load/backfill/Dockerfile`
- `test/load/backfill/backfill-job.yaml`
- `test/load/backfill/main.go` (bulk insert logic)
- `test/load/backfill/event-generator.go` (realistic event templates)
- `test/load/backfill/replay.go` (Vector webhook replay)

**Success Criteria**:
- Successfully backfills 10M events in < 2 hours
- Events are distributed realistically across tenants and time
- ClickHouse table size and partition count are correct
- Sample queries return expected results

### Phase 3: Ingestion Load Testing (Week 3-4)

**Objective**: Simulate live audit event ingestion from multiple control planes

**Event Generator Features**:
- Configurable number of control planes (tenants)
- Configurable events/second per control plane
- Realistic Kubernetes audit event structure
- Distribution of common operations:
  - Core resources: pods, services, secrets, configmaps
  - Apps resources: deployments, statefulsets, daemonsets
  - Batch resources: jobs, cronjobs
  - RBAC resources: roles, rolebindings
- Realistic verb distribution: get (40%), list (30%), update (15%), create
  (10%), delete (5%)
- User diversity: service accounts, human users, system components
- Error scenarios: 4xx, 5xx status codes

**k6 Ingestion Test Script**:

```javascript
// test/load/src/ingestion-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const eventsIngested = new Counter('events_ingested');
const ingestionRate = new Rate('ingestion_success_rate');
const ingestionDuration = new Trend('ingestion_duration');

export const options = {
  scenarios: {
    steady_state: {
      executor: 'constant-arrival-rate',
      rate: 5000,  // 5000 events/sec
      duration: '30m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    'ingestion_success_rate': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },
};

const VECTOR_URL = __ENV.VECTOR_WEBHOOK_URL ||
  'http://vector-aggregator.activity-perf-test:8080';
const CONTROL_PLANES = parseInt(__ENV.CONTROL_PLANES || '50');

// Audit event templates
const verbs = ['get', 'list', 'create', 'update', 'patch', 'delete'];
const resources = [
  { apiGroup: '', resource: 'pods' },
  { apiGroup: '', resource: 'services' },
  { apiGroup: '', resource: 'secrets' },
  { apiGroup: '', resource: 'configmaps' },
  { apiGroup: 'apps', resource: 'deployments' },
  { apiGroup: 'apps', resource: 'statefulsets' },
  { apiGroup: 'batch', resource: 'jobs' },
];

function generateAuditEvent(controlPlaneId) {
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const resource = resources[Math.floor(Math.random() * resources.length)];

  return {
    kind: 'Event',
    apiVersion: 'audit.k8s.io/v1',
    auditID: crypto.randomUUID(),
    stage: 'ResponseComplete',
    requestReceivedTimestamp: new Date().toISOString(),
    verb: verb,
    user: {
      username: `system:serviceaccount:default:app-${Math.floor(Math.random() * 100)}`,
    },
    objectRef: {
      apiGroup: resource.apiGroup,
      resource: resource.resource,
      namespace: `namespace-${Math.floor(Math.random() * 20)}`,
      name: `resource-${Math.floor(Math.random() * 1000)}`,
    },
    responseStatus: {
      code: verb === 'delete' ? 200 : (verb === 'create' ? 201 : 200),
    },
    annotations: {
      'platform.miloapis.com/scope.type': 'tenant',
      'platform.miloapis.com/scope.name': `control-plane-${controlPlaneId}`,
    },
  };
}

export default function() {
  // Randomly select a control plane
  const controlPlaneId = Math.floor(Math.random() * CONTROL_PLANES);

  const event = generateAuditEvent(controlPlaneId);
  const payload = JSON.stringify(event);

  const response = http.post(VECTOR_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s',
  });

  const success = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  eventsIngested.add(1);
  ingestionRate.add(success ? 1 : 0);
  ingestionDuration.add(response.timings.duration);

  if (!success) {
    console.error(`Ingestion failed: ${response.status} - ${response.body}`);
  }
}
```

**TestRun Configuration**:

```yaml
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: activity-ingestion-load-test
  namespace: activity-perf-test
spec:
  script:
    configMap:
      name: activity-k6-ingestion-script
      file: ingestion-load-test.js
  parallelism: 10  # 10 parallel k6 instances
  runner:
    image: grafana/k6:latest
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
      limits:
        memory: "1Gi"
        cpu: "1000m"
    env:
    - name: VECTOR_WEBHOOK_URL
      value: "http://vector-aggregator.activity-perf-test:8080"
    - name: CONTROL_PLANES
      value: "50"
```

**Deliverables**:
- `test/load/src/ingestion-load-test.js`
- `test/load/src/audit-event-generator.js`
- `config/components/k6-performance-tests/ingestion-testrun.yaml`
- `test/load/Taskfile.yaml` (updated with ingestion tasks)

**Success Criteria**:
- Sustain 5,000 events/sec with >99% success rate
- Vector webhook latency P95 < 100ms
- NATS publish rate matches ingestion rate
- ClickHouse receives all events (verify via row count)

### Phase 4: Query Load Testing Enhancement (Week 4-5)

**Objective**: Comprehensive query testing with tenant isolation

**Enhancements to Existing Query Tests**:

1. **Add Tenant-Scoped Queries**:
```javascript
// Add to test/load/src/query-load-test.js

// Tenant-scoped query templates
const tenantQueries = [
  {
    name: 'tenant_recent_activity',
    filter: '',  // No filter, just tenant scope
    limit: 100,
    scope: { type: 'organization', name: 'org-1' },
  },
  {
    name: 'tenant_pod_creates',
    filter: "objectRef.resource == 'pods' && verb == 'create'",
    limit: 50,
    scope: { type: 'organization', name: 'org-2' },
  },
  {
    name: 'tenant_secret_access',
    filter: "objectRef.resource == 'secrets' && verb in ['get', 'list']",
    limit: 100,
    scope: { type: 'project', name: 'project-123' },
  },
];

function getRequestOptions(scope) {
  const options = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  };

  // Add tenant scope headers if provided
  if (scope) {
    options.headers['X-Remote-Extra-iam.miloapis.com/parent-type'] =
      scope.type === 'organization' ? 'Organization' : 'Project';
    options.headers['X-Remote-Extra-iam.miloapis.com/parent-name'] = scope.name;
  }

  if (TOKEN && !TLS_CERT_FILE) {
    options.headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  return options;
}
```

2. **Realistic Query Mix**:
```javascript
export default function() {
  const rand = Math.random();
  let template;

  if (rand < 0.60) {
    // 60% tenant-scoped queries (most common in multi-tenant systems)
    template = tenantQueries[Math.floor(Math.random() * tenantQueries.length)];
  } else if (rand < 0.90) {
    // 30% platform queries (provider/admin analytics)
    template = platformQueries[Math.floor(Math.random() * platformQueries.length)];
  } else {
    // 10% complex cross-tenant queries (compliance, security)
    template = complexQueries[Math.floor(Math.random() * complexQueries.length)];
  }

  executeQuery(template);
  sleep(Math.random() * 1.5 + 0.5);
}
```

**Deliverables**:
- Updated `test/load/src/query-load-test.js` with tenant queries
- `test/load/src/test-scenarios.js` (reusable scenario definitions)
- Documentation on query patterns and expected performance

**Success Criteria**:
- Tenant queries P95 < 1s (using primary key ordering)
- Platform queries P95 < 2s (using platform_query_projection)
- Query success rate > 95%
- No ClickHouse out-of-memory errors

### Phase 5: Observability & Metrics (Week 5-6)

**Objective**: Comprehensive monitoring and reporting

**Metrics Collection**:

1. **Ingestion Pipeline Metrics**:
```promql
# Events per second by control plane
rate(vector_events_processed_total{source="nats_consumer"}[5m])

# NATS JetStream lag
nats_jetstream_consumer_num_pending{stream="AUDIT_EVENTS"}

# Vector buffer usage
vector_buffer_events{component_id="clickhouse"}

# ClickHouse insert rate
rate(clickhouse_table_parts_total[5m])
```

2. **Query Performance Metrics**:
```promql
# Query latency by scope type
histogram_quantile(0.95,
  rate(activity_audit_log_query_duration_seconds_bucket[5m])
) by (scope_type)

# Queries per second
rate(activity_audit_log_queries_total[5m])

# Query errors
rate(activity_audit_log_query_errors_total[5m])

# ClickHouse query time
histogram_quantile(0.95,
  rate(clickhouse_query_duration_seconds_bucket[5m])
)
```

3. **Resource Utilization**:
```promql
# CPU usage by component
rate(container_cpu_usage_seconds_total{namespace="activity-perf-test"}[5m])

# Memory usage
container_memory_working_set_bytes{namespace="activity-perf-test"}

# Disk usage growth rate
rate(clickhouse_table_size_bytes[1h])
```

**Grafana Dashboards**:

Create comprehensive dashboards in `test/performance/dashboards/`:

1. **Ingestion Pipeline Dashboard** (`ingestion-pipeline.json`):
   - Events/sec by control plane
   - End-to-end latency (Vector webhook → ClickHouse)
   - NATS stream depth
   - Vector buffer status
   - Error rates by component

2. **Query Performance Dashboard** (`query-performance.json`):
   - QPS by scope type
   - P50/P95/P99 latency by query complexity
   - Query success rate
   - ClickHouse projection usage
   - Slow query log

3. **System Resources Dashboard** (`system-resources.json`):
   - CPU/Memory by pod
   - Network I/O
   - Disk usage and growth
   - Pod autoscaling activity

**Deliverables**:
- `test/performance/dashboards/ingestion-pipeline.json`
- `test/performance/dashboards/query-performance.json`
- `test/performance/dashboards/system-resources.json`
- `test/performance/prometheus-rules.yaml` (alerting rules)

**Success Criteria**:
- All key metrics are collected and visible
- Dashboards provide actionable insights
- Alerts fire correctly for threshold violations

### Phase 6: Test Automation (Week 6-7)

**Objective**: Automated, scheduled performance testing

**Test Orchestration**:

Create a test orchestrator that:
1. Verifies test environment is ready
2. Runs backfill (if needed)
3. Executes ingestion load test
4. Executes query load test
5. Collects metrics and generates report
6. Archives results for trending

**Implementation**:

```bash
#!/bin/bash
# test/load/orchestrator/run-tests.sh

set -e

echo "🚀 Starting Activity Performance Test Suite"
echo "============================================="

# Configuration
TEST_ID="perf-test-$(date +%Y%m%d-%H%M%S)"
NAMESPACE="activity-perf-test"
RESULTS_DIR="/tmp/perf-results/${TEST_ID}"

mkdir -p "${RESULTS_DIR}"

# Step 1: Verify environment
echo "📋 Verifying test environment..."
kubectl wait --for=condition=ready pod \
  -l clickhouse.altinity.com/chi=activity-clickhouse \
  -n ${NAMESPACE} --timeout=300s

kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=vector-aggregator \
  -n ${NAMESPACE} --timeout=300s

kubectl wait --for=condition=ready pod \
  -l app=activity-apiserver \
  -n ${NAMESPACE} --timeout=300s

echo "✅ Environment ready"

# Step 2: Check if backfill is needed
echo "📊 Checking data volume..."
EVENT_COUNT=$(kubectl exec -n ${NAMESPACE} \
  chi-activity-clickhouse-0-0-0 -- \
  clickhouse-client --query="SELECT count() FROM audit.events")

if [ "${EVENT_COUNT}" -lt 1000000 ]; then
  echo "⚠️  Insufficient test data (${EVENT_COUNT} events). Running backfill..."
  kubectl apply -f test/load/backfill/backfill-job.yaml
  kubectl wait --for=condition=complete job/activity-backfill \
    -n ${NAMESPACE} --timeout=7200s
  echo "✅ Backfill complete"
else
  echo "✅ Sufficient test data (${EVENT_COUNT} events)"
fi

# Step 3: Run ingestion load test
echo "🔥 Starting ingestion load test..."
kubectl apply -f config/components/k6-performance-tests/ingestion-testrun.yaml
kubectl wait --for=condition=complete job/activity-ingestion-load-test \
  -n ${NAMESPACE} --timeout=3600s

# Collect ingestion test results
kubectl logs -n ${NAMESPACE} -l k6_cr=activity-ingestion-load-test \
  > "${RESULTS_DIR}/ingestion-test.log"

echo "✅ Ingestion test complete"

# Step 4: Run query load test
echo "🔍 Starting query load test..."
kubectl apply -f config/components/k6-performance-tests/query-testrun.yaml
kubectl wait --for=condition=complete job/activity-query-load-test \
  -n ${NAMESPACE} --timeout=3600s

# Collect query test results
kubectl logs -n ${NAMESPACE} -l k6_cr=activity-query-load-test \
  > "${RESULTS_DIR}/query-test.log"

echo "✅ Query test complete"

# Step 5: Collect metrics
echo "📈 Collecting performance metrics..."
./test/load/orchestrator/collect-metrics.sh "${RESULTS_DIR}"

# Step 6: Generate report
echo "📝 Generating performance report..."
./test/load/orchestrator/generate-report.sh "${RESULTS_DIR}"

echo ""
echo "✅ Performance test suite complete!"
echo "Results: ${RESULTS_DIR}/report.md"
echo ""

# Upload to artifact storage (e.g., S3, GCS)
if [ -n "${ARTIFACT_BUCKET}" ]; then
  echo "📤 Uploading results to ${ARTIFACT_BUCKET}..."
  # aws s3 cp "${RESULTS_DIR}" "s3://${ARTIFACT_BUCKET}/perf-results/${TEST_ID}/" --recursive
fi
```

**Kubernetes CronJob**:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: activity-perf-test-weekly
  namespace: activity-perf-test
spec:
  schedule: "0 2 * * 0"  # Every Sunday at 2 AM
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: perf-test-runner
          containers:
          - name: test-orchestrator
            image: activity-perf-test-orchestrator:latest
            command: ["/run-tests.sh"]
            env:
            - name: ARTIFACT_BUCKET
              value: "activity-perf-results"
            - name: SLACK_WEBHOOK_URL
              valueFrom:
                secretKeyRef:
                  name: perf-test-secrets
                  key: slack-webhook
          restartPolicy: Never
```

**GitHub Actions Workflow** (optional):

```yaml
# .github/workflows/performance-tests.yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday
  workflow_dispatch:  # Manual trigger
    inputs:
      test_scenario:
        description: 'Test scenario to run'
        required: false
        default: 'full'
        type: choice
        options:
          - full
          - ingestion-only
          - query-only

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.PERF_TEST_KUBECONFIG }}

      - name: Run performance tests
        run: |
          ./test/load/orchestrator/run-tests.sh

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: performance-test-results
          path: /tmp/perf-results/
          retention-days: 90

      - name: Post results to Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "Performance test completed",
              "attachments": [{
                "color": "${{ job.status == 'success' && 'good' || 'danger' }}",
                "fields": [
                  {"title": "Status", "value": "${{ job.status }}", "short": true},
                  {"title": "Test ID", "value": "${{ github.run_id }}", "short": true}
                ]
              }]
            }
```

**Deliverables**:
- `test/load/orchestrator/Dockerfile`
- `test/load/orchestrator/run-tests.sh`
- `test/load/orchestrator/collect-metrics.sh`
- `test/load/orchestrator/generate-report.sh`
- `config/overlays/perf-test/cronjob.yaml`
- `.github/workflows/performance-tests.yaml`

**Success Criteria**:
- Tests run automatically on schedule
- Results are collected and archived
- Reports are generated and distributed
- Failures trigger notifications

### Phase 7: Documentation (Week 7-8)

**Objective**: Comprehensive documentation for users and maintainers

**Documents to Create**:

1. **Test Execution Guide** (`docs/performance-testing/execution-guide.md`):
   - Prerequisites
   - Environment setup
   - Running tests manually
   - Interpreting results

2. **Configuration Reference** (`docs/performance-testing/configuration.md`):
   - Test parameters
   - Environment variables
   - Scaling configuration
   - Scenario definitions

3. **Troubleshooting Guide** (`docs/performance-testing/troubleshooting.md`):
   - Common issues and solutions
   - Debugging techniques
   - Log analysis
   - Performance tuning

4. **Performance Tuning Guide** (`docs/performance-testing/tuning.md`):
   - ClickHouse optimization
   - Vector configuration
   - NATS tuning
   - Kubernetes resource allocation

**Deliverables**:
- Complete documentation in `docs/performance-testing/`
- README.md in `test/load/` with quick start
- Runbook for on-call engineers

**Success Criteria**:
- New team members can run tests without assistance
- Common issues are documented with solutions
- Performance tuning recommendations are clear

## Test Scenarios

### Scenario 1: Steady State Operations
**Purpose**: Validate normal operation under typical load

**Configuration**:
- Control planes: 50
- Events/sec per CP: 100
- Total ingestion: 5,000 events/sec
- Concurrent query users: 50
- Duration: 30 minutes

**Expected Results**:
- Ingestion success rate: >99.9%
- Query P95 latency: <2s
- Vector CPU: <60%
- ClickHouse CPU: <70%

### Scenario 2: Tenant Growth Spike
**Purpose**: Validate scaling behavior during rapid tenant growth

**Configuration**:
- Control planes: Ramp 50 → 200 over 15 minutes
- Events/sec per CP: 100 (constant)
- Total ingestion: 5,000 → 20,000 events/sec
- Concurrent query users: 100
- Duration: 30 minutes

**Expected Results**:
- Autoscaling triggers correctly
- No dropped events during scale-up
- Query latency remains stable
- Graceful degradation if limits reached

### Scenario 3: Query Storm
**Purpose**: Validate query performance under heavy load

**Configuration**:
- Control planes: 50 (steady)
- Events/sec per CP: 100 (steady)
- Concurrent query users: Ramp 0 → 500 over 5 minutes
- Query complexity: 60% simple, 30% medium, 10% complex
- Duration: 15 minutes

**Expected Results**:
- Query success rate: >95%
- P95 latency increases but stays <5s
- ClickHouse connection pool doesn't exhaust
- API server autoscales appropriately

### Scenario 4: Write Storm
**Purpose**: Validate ingestion capacity limits

**Configuration**:
- Control planes: 50
- Events/sec per CP: Ramp 100 → 1,000 over 10 minutes
- Total ingestion: 5,000 → 50,000 events/sec
- Concurrent query users: 50 (steady)
- Duration: 15 minutes

**Expected Results**:
- Identify maximum sustainable ingestion rate
- Vector buffers don't overflow
- NATS stream doesn't accumulate excessive lag
- ClickHouse keeps up with inserts

### Scenario 5: Peak Load (Combination)
**Purpose**: Simulate worst-case peak usage

**Configuration**:
- Control planes: 100
- Events/sec per CP: 500
- Total ingestion: 50,000 events/sec
- Concurrent query users: 300
- Query mix: Heavy on complex queries
- Duration: 30 minutes

**Expected Results**:
- System remains operational
- Degradation is graceful
- No data loss
- Recovery time after load removal: <5 minutes

## Success Metrics

### Service Level Objectives (SLOs)

**Ingestion SLOs**:
- **Availability**: 99.9% of events successfully ingested
- **Latency**: P95 end-to-end latency <10 seconds
- **Throughput**: Sustained 10,000 events/sec per cluster

**Query SLOs**:
- **Availability**: 99.5% of queries succeed
- **Latency**:
  - P50: <500ms
  - P95: <2s (tenant queries), <3s (platform queries)
  - P99: <5s
- **Throughput**: 100 concurrent queries

**Resource Utilization**:
- **ClickHouse CPU**: Average <70%, peak <85%
- **Vector CPU**: Average <60%, peak <80%
- **NATS Memory**: <80% of limit

### Performance Regression Criteria

A performance regression is defined as:
- Ingestion rate decreases >10% for same configuration
- Query P95 latency increases >20%
- Resource usage increases >15% for same workload
- Error rate increases >1%

## Security Considerations

1. **Test Data**: Generated data should not contain real PII or sensitive
   information
2. **Access Control**: Performance test namespace should have restricted RBAC
3. **Network Isolation**: Test traffic should not impact production
4. **Credentials**: Use dedicated test credentials with minimal privileges
5. **Cleanup**: Automated cleanup of test resources after execution

## Cost Considerations

**Estimated Monthly Cost** (AWS/GCP equivalent):
- ClickHouse cluster (3x m5.xlarge): ~$400/month
- NATS cluster (3x m5.large): ~$200/month
- Vector + API (autoscaling): ~$150/month
- Storage (1TB hot, 5TB cold): ~$200/month
- **Total**: ~$950/month

**Cost Optimization**:
- Run full tests weekly, lighter tests daily
- Use spot instances where possible
- Implement automated environment shutdown during non-test periods
- Use storage lifecycle policies for test result archives

## Alternatives Considered

### Alternative 1: Production Shadowing
**Pros**: Most realistic traffic patterns **Cons**: Risk to production, complex
setup, compliance issues **Decision**: Rejected due to risk

### Alternative 2: Synthetic Data Only (No Backfill)
**Pros**: Simpler implementation, faster setup **Cons**: Can't test queries
against large historical datasets **Decision**: Rejected - need to test query
performance at scale

### Alternative 3: Single-Node Test Environment
**Pros**: Lower cost, simpler setup **Cons**: Doesn't model production HA,
scaling, or performance **Decision**: Rejected - need production-like
configuration

## Future Enhancements

1. **Chaos Engineering**: Inject failures to test resilience
2. **Geographic Distribution**: Multi-region performance testing
3. **Cost Analysis**: Track cost per event and cost per query
4. **Machine Learning**: Anomaly detection in performance metrics
5. **Comparative Analysis**: A/B testing of different configurations
6. **Custom Scenarios**: User-defined test scenarios via CRDs

## References

- [ClickHouse Performance
  Testing](https://clickhouse.com/docs/en/development/tests)
- [k6 Documentation](https://k6.io/docs/)
- [NATS JetStream Best Practices](https://docs.nats.io/nats-concepts/jetstream)
- [Vector Performance Tuning](https://vector.dev/docs/reference/configuration/)
- [Kubernetes HPA Best
  Practices](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

## Appendix A: File Structure

```
activity/
├── config/
│   ├── overlays/
│   │   ├── perf-test/                    # NEW: Performance test overlay
│   │   │   ├── kustomization.yaml
│   │   │   ├── patches/
│   │   │   │   ├── clickhouse-cluster-patch.yaml
│   │   │   │   ├── vector-scaling-patch.yaml
│   │   │   │   ├── apiserver-scaling-patch.yaml
│   │   │   │   └── nats-ha-patch.yaml
│   │   │   └── resources/
│   │   │       ├── resource-quotas.yaml
│   │   │       ├── cronjob.yaml
│   │   │       └── rbac.yaml
│   └── components/
│       └── k6-performance-tests/
│           ├── ingestion-testrun.yaml    # NEW
│           ├── query-testrun.yaml        # Existing
│           └── combined-testrun.yaml     # NEW
├── test/
│   ├── load/
│   │   ├── src/
│   │   │   ├── query-load-test.js        # Existing (enhanced)
│   │   │   ├── ingestion-load-test.js    # NEW
│   │   │   ├── audit-event-generator.js  # NEW
│   │   │   └── test-scenarios.js         # NEW
│   │   ├── backfill/                     # NEW
│   │   │   ├── Dockerfile
│   │   │   ├── backfill-job.yaml
│   │   │   ├── main.go
│   │   │   ├── event-generator.go
│   │   │   └── README.md
│   │   ├── orchestrator/                 # NEW
│   │   │   ├── Dockerfile
│   │   │   ├── run-tests.sh
│   │   │   ├── collect-metrics.sh
│   │   │   ├── generate-report.sh
│   │   │   └── README.md
│   │   └── Taskfile.yaml                 # Updated
│   └── performance/                      # NEW
│       ├── dashboards/
│       │   ├── ingestion-pipeline.json
│       │   ├── query-performance.json
│       │   └── system-resources.json
│       ├── prometheus-rules.yaml
│       └── reports/
│           └── report-template.md
├── docs/
│   ├── enhancements/
│   │   └── performance-testing-pipeline.md  # This document
│   └── performance-testing/              # NEW
│       ├── README.md
│       ├── execution-guide.md
│       ├── configuration.md
│       ├── troubleshooting.md
│       └── tuning.md
└── .github/
    └── workflows/
        └── performance-tests.yaml        # NEW
```

## Appendix B: Sample Performance Report

```markdown
# Activity Performance Test Report

**Test ID**: perf-test-20260112-140523
**Date**: 2026-01-12 14:05:23 UTC
**Duration**: 2h 15m
**Environment**: activity-perf-test

## Test Configuration

- ClickHouse: 3-node cluster, 500GB storage each
- Vector Aggregator: 2-5 replicas (HPA)
- Activity API: 2-3 replicas (HPA)
- NATS: 3-node cluster
- Historical Data: 10M events (90 days)
- Control Planes: 50

## Scenario Results

### Scenario 1: Steady State (30 minutes)
**Configuration**: 50 CPs × 100 events/sec = 5,000 events/sec total

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Ingestion Success Rate | >99.9% | 99.94% | ✅ PASS |
| Ingestion P95 Latency | <10s | 3.2s | ✅ PASS |
| Query Success Rate | >99.5% | 98.7% | ✅ PASS |
| Query P95 Latency | <2s | 1.8s | ✅ PASS |
| ClickHouse CPU Avg | <70% | 62% | ✅ PASS |
| Vector CPU Avg | <60% | 45% | ✅ PASS |

**Issues**: None

### Scenario 3: Query Storm (15 minutes)
**Configuration**: 0 → 500 concurrent query users

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Query Success Rate | >95% | 96.2% | ✅ PASS |
| Query P95 Latency | <5s | 4.7s | ✅ PASS |
| API Server Autoscale | Yes | 1→3 replicas | ✅ PASS |
| ClickHouse CPU Peak | <85% | 89% | ⚠️ WARN |

**Issues**:
- ⚠️ ClickHouse CPU exceeded 85% threshold (reached 89%)
- Recommendation: Consider adding 4th ClickHouse node

### Scenario 4: Write Storm (15 minutes)
**Configuration**: 100 → 1,000 events/sec per CP (5k → 50k total)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Ingestion Success Rate | >99.9% | 98.2% | ❌ FAIL |
| NATS Stream Lag | <1000 | 5,432 | ❌ FAIL |
| Vector Buffer Usage | <80% | 92% | ❌ FAIL |

**Issues**:
- ❌ System cannot sustain 50,000 events/sec
- ❌ NATS stream accumulated significant lag
- ❌ Vector buffers near capacity
- **Maximum sustainable rate**: ~25,000 events/sec
- Recommendation: Add Vector aggregator capacity or increase buffer size

## Resource Utilization

### Peak Resource Usage

| Component | CPU Peak | Memory Peak | Disk Usage |
|-----------|----------|-------------|------------|
| ClickHouse Node 1 | 89% | 45GB/64GB | 128GB/500GB |
| ClickHouse Node 2 | 87% | 43GB/64GB | 126GB/500GB |
| ClickHouse Node 3 | 88% | 44GB/64GB | 127GB/500GB |
| Vector Aggregator | 78% | 2.1GB/4GB | 8.5GB/10GB |
| Activity API | 42% | 890MB/2GB | - |
| NATS | 35% | 3.2GB/8GB | 15GB/50GB |

## Recommendations

### High Priority
1. **Add 4th ClickHouse node** - CPU exceeded 85% during query storm
2. **Increase Vector buffer size** - Hit 92% during write storm
3. **Scale NATS cluster** - Stream lag accumulated during high load

### Medium Priority
4. **Tune HPA thresholds** - API server scaled late (should scale at 60% CPU, not 70%)
5. **Add query result caching** - 30% of queries were identical (cache hit potential)
6. **Review slow queries** - 2.3% of queries took >5s (see slow query log)

### Low Priority
7. **Optimize projection usage** - Platform queries not always using platform_query_projection
8. **Reduce Vector memory usage** - Can optimize transform pipeline

## Performance Trends

Compared to last week (perf-test-20260105-140523):
- ✅ Query P95 latency: 2.1s → 1.8s (-14%)
- ✅ Ingestion success rate: 99.89% → 99.94% (+0.05%)
- ⚠️ ClickHouse CPU: 58% → 62% (+6.9%)
- ⚠️ Write storm max rate: 27k → 25k events/sec (-7.4%)

## Conclusion

**Overall Status**: ⚠️ PARTIAL PASS

The system meets SLOs for typical workloads (Scenarios 1-3) but cannot sustain
extreme write loads (Scenario 4). Recommendation: Implement high-priority items
before production deployment.

## Attachments

- Detailed metrics: [metrics.json](metrics.json)
- Grafana snapshots: [grafana/](grafana/)
- Slow query log: [slow-queries.log](slow-queries.log)
- k6 test results: [k6-results/](k6-results/)
```

---

**End of Enhancement Proposal**
