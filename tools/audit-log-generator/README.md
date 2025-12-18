# Audit Log Generator

Tool for generating realistic Kubernetes audit log events for testing and development of the Activity audit pipeline.

## Overview

This tool provides multiple strategies for loading audit events into the Activity pipeline:

1. **Synthetic Events (NATS)** - Directly publish synthetic audit events to NATS JetStream
2. **Real Operations (Kubernetes)** - Perform actual Kubernetes operations to generate real audit logs
3. **Replay Historical Logs** - Import and replay existing audit log files

## Quick Start

### Generate 1000 synthetic events via NATS

```bash
# From Activity repository root
task test:load-audit-logs -- -count=1000 -rate=50
```

### Generate events via real Kubernetes operations

```bash
task test:load-audit-logs-real -- -operations=500
```

## Methods

### Method 1: Synthetic Events via NATS (Fastest)

**Pros:**
- Very fast (thousands of events per second)
- No cluster state changes
- Predictable event structure
- Can test specific edge cases

**Cons:**
- Not "real" audit events
- Doesn't test API server audit configuration
- Won't test Vector sidecar collection (only aggregator)

**Usage:**

```bash
go run tools/audit-log-generator/main.go \
  -nats-url=nats://localhost:4222 \
  -count=10000 \
  -rate=100 \
  -subject=audit.k8s.synthetic \
  -source=load-generator
```

**Parameters:**
- `-nats-url`: NATS server URL (default: `nats://localhost:4222`)
- `-count`: Number of events to generate (default: `100`)
- `-rate`: Events per second (default: `10`)
- `-subject`: NATS subject to publish to (default: `audit.k8s.synthetic`)
- `-source`: Source identifier in event metadata (default: `load-generator`)
- `-namespace`: Kubernetes namespace for synthetic resources (default: `default`)

**Port-forward NATS for local testing:**

```bash
task test-infra:kubectl -- port-forward -n nats-system svc/nats 4222:4222
```

Then run the generator pointing to `localhost:4222`.

### Method 2: Real Kubernetes Operations

**Pros:**
- Generates real audit events through actual API calls
- Tests complete pipeline including API server audit config
- Realistic event patterns and timing
- Tests rate limiting and API server load

**Cons:**
- Slower (limited by API server)
- Creates actual resources (needs cleanup)
- Requires cluster access and permissions
- Can't easily control event characteristics

**Usage:**

```bash
# Create a dedicated namespace for load testing
task kubectl -- create namespace audit-load-test

# Run operations that generate audit events
kubectl create deployment test-load-$RANDOM --image=nginx --replicas=3 -n audit-load-test
kubectl scale deployment test-load-$RANDOM --replicas=5 -n audit-load-test
kubectl delete deployment test-load-$RANDOM -n audit-load-test

# Cleanup
task kubectl -- delete namespace audit-load-test
```

**Automated script** (see [kubernetes-load-generator.sh](kubernetes-load-generator.sh)):

```bash
./tools/audit-log-generator/kubernetes-load-generator.sh \
  --operations 1000 \
  --namespace audit-load-test \
  --cleanup
```

### Method 3: Replay Historical Logs

**Pros:**
- Uses real-world audit log patterns
- Can test with specific scenarios from production
- Reproducible tests

**Cons:**
- Requires access to historical audit logs
- May contain sensitive data (needs sanitization)
- Timestamps may be stale

**Usage:**

1. Export audit logs from a real cluster:
   ```bash
   kubectl logs kube-apiserver-xxxx -n kube-system > audit-logs.json
   ```

2. Sanitize the logs (remove sensitive data):
   ```bash
   # Use jq to clean sensitive fields
   cat audit-logs.json | jq -c '.annotations = {"sanitized": "true"} | .requestObject = null | .responseObject = null' > clean-audit-logs.json
   ```

3. Replay to NATS:
   ```bash
   go run tools/audit-log-generator/replay.go \
     -file=clean-audit-logs.json \
     -nats-url=nats://localhost:4222 \
     -subject=audit.k8s.replay
   ```

## Event Distribution

The synthetic generator creates events with realistic distribution:

**Resource Types:**
- Core resources: Pods, Services, ConfigMaps, Secrets (40%)
- Apps: Deployments, StatefulSets, DaemonSets (30%)
- Batch: Jobs, CronJobs (15%)
- Networking: Ingresses (15%)

**Verbs:**
- Read operations (get, list, watch): 60%
- Write operations (create, update, patch, delete): 40%

**Users:**
- System accounts: 40%
- Human users: 30%
- Service accounts: 30%

**Response Codes:**
- Success (2xx): 85%
- Client errors (4xx): 10%
- Server errors (5xx): 5%

## Load Testing Scenarios

### Scenario 1: Baseline Performance

Test pipeline throughput with moderate load:

```bash
task test:load-audit-logs -- -count=10000 -rate=50
```

**Expected:**
- ~10,000 events in ~3 minutes
- Vector aggregator lag < 1 second
- ClickHouse insert rate > 1000 events/sec

### Scenario 2: Burst Load

Test pipeline burst handling:

```bash
task test:load-audit-logs -- -count=5000 -rate=500
```

**Expected:**
- ~5,000 events in ~10 seconds
- NATS buffers events during burst
- Vector recovers within 30 seconds

### Scenario 3: Sustained High Load

Test pipeline under sustained load:

```bash
task test:load-audit-logs -- -count=100000 -rate=200
```

**Expected:**
- ~100,000 events in ~8 minutes
- No event loss
- Steady state memory usage

### Scenario 4: Mixed Sources

Test multiple sources publishing simultaneously:

```bash
# Terminal 1: Milo events
task test:load-audit-logs -- -count=5000 -rate=50 -subject=audit.k8s.milo -source=milo-apiserver

# Terminal 2: Activity events
task test:load-audit-logs -- -count=5000 -rate=50 -subject=audit.k8s.activity -source=activity-apiserver

# Terminal 3: Synthetic events
task test:load-audit-logs -- -count=5000 -rate=50 -subject=audit.k8s.synthetic -source=load-test
```

**Expected:**
- All events processed correctly
- Source attribution maintained
- No event interleaving issues

## Verification

### Check NATS stream messages

```bash
task test-infra:kubectl -- run nats-box --rm -it --image=natsio/nats-box:latest -- \
  nats stream info AUDIT_EVENTS --server=nats://nats.nats-system.svc.cluster.local:4222
```

### Check Vector aggregator processing

```bash
task test-infra:kubectl -- logs -n activity-system -l app.kubernetes.io/instance=vector-aggregator --tail=100
```

### Check ClickHouse event count

```bash
task test-infra:kubectl -- exec -it clickhouse-0 -n activity-system -- \
  clickhouse-client --query="SELECT source, count(*) as events FROM activity.audit_events GROUP BY source ORDER BY events DESC"
```

### Query via Activity

```bash
task kubectl -- get auditevents --field-selector=source=load-generator
```

## Performance Tuning

### Increase Vector Aggregator Throughput

Edit [config/components/vector-aggregator/vector-hr.yaml](../../config/components/vector-aggregator/vector-hr.yaml):

```yaml
batch:
  max_bytes: 10485760  # 10 MB (increase for higher throughput)
  timeout_secs: 5      # Decrease for lower latency
```

### Increase ClickHouse Insert Performance

```sql
-- Use async inserts for better throughput
SET async_insert = 1;
SET wait_for_async_insert = 0;
```

### Increase NATS Stream Limits

Edit [config/components/nats-streams/audit-stream.yaml](../../config/components/nats-streams/audit-stream.yaml):

```yaml
spec:
  maxBytes: 536870912000  # 500 GB
  maxMsgsPerSubject: 1000000
```

## Cleanup

### Remove synthetic events from ClickHouse

```bash
task test-infra:kubectl -- exec -it clickhouse-0 -n activity-system -- \
  clickhouse-client --query="DELETE FROM activity.audit_events WHERE source = 'load-generator'"
```

### Clear NATS stream

```bash
task test-infra:kubectl -- run nats-box --rm -it --image=natsio/nats-box:latest -- \
  nats stream purge AUDIT_EVENTS --server=nats://nats.nats-system.svc.cluster.local:4222 --force
```

## Troubleshooting

### Events not appearing in ClickHouse

1. Check NATS stream has messages:
   ```bash
   task test-infra:kubectl -- run nats-box --rm -it --image=natsio/nats-box:latest -- \
     nats stream info AUDIT_EVENTS
   ```

2. Check Vector aggregator is consuming:
   ```bash
   task test-infra:kubectl -- logs -n activity-system -l app.kubernetes.io/instance=vector-aggregator | grep -i error
   ```

3. Check ClickHouse is accepting inserts:
   ```bash
   task test-infra:kubectl -- logs -l clickhouse.altinity.com/chi=activity-clickhouse -n activity-system
   ```

### NATS connection refused

Make sure you've port-forwarded NATS:

```bash
task test-infra:kubectl -- port-forward -n nats-system svc/nats 4222:4222
```

Or run the generator **inside the cluster**:

```bash
kubectl run audit-log-generator --rm -it --image=golang:1.24 -- /bin/bash
# Then build and run from inside the pod
```

### Rate limiting

If you see rate limiting errors, adjust:

```bash
# Reduce rate
task test:load-audit-logs -- -count=1000 -rate=10

# Or increase in smaller batches
for i in {1..10}; do
  task test:load-audit-logs -- -count=100 -rate=20
  sleep 10
done
```

## Building

```bash
cd tools/audit-log-generator
go build -o ../../bin/audit-log-generator .
```

Then run directly:

```bash
./bin/audit-log-generator -count=1000 -rate=50
```

## Future Enhancements

- [ ] Add replay tool for historical audit logs
- [ ] Add Kubernetes operations generator
- [ ] Support custom event templates
- [ ] Add Prometheus metrics export
- [ ] Support NATS JetStream acknowledgements
- [ ] Add event validation against audit schema
- [ ] Support TLS connections to NATS
- [ ] Add CLI flag for authentication
