# Example k6 Load Test Output

This document shows example output from running the load tests.

## Running the Script

```bash
$ ./run-load-test.sh --scenario steady

[INFO] Auto-detected test-infra kubeconfig: /Users/scotwells/repos/activity/.test-infra/kubeconfig
[INFO] Extracting client certificates from kubeconfig...
[INFO] Extracted client certificate
[INFO] Extracted client key
[INFO] Extracted CA certificate
[INFO] Extracted API server URL: https://127.0.0.1:52905
[INFO] Building TypeScript load tests...
[SUCCESS] Build completed
[INFO] Load test configuration:
[INFO]   API Server: https://127.0.0.1:52905
[INFO]   Namespace Filter: default
[INFO]   Scenario: steady
[INFO]   Output: ./results
[INFO]   k6 Cloud: false
[INFO]   Auth Method: Client Certificates
[INFO] Running Steady Load test...

          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: dist/query-load-test.js
     output: json (./results/results-20251208-155500.json)

  scenarios: (100.00%) 1 scenario, 10 max VUs, 5m30s max duration (incl. graceful stop):
           * steady_load: 10 constant VUs for 5m0s (gracefulStop: 30s)


     ✓ status is 201
     ✓ response has body
     ✓ query completed

     cel_filter_errors.............: 0       0/s
     checks........................: 100.00% ✓ 9000      ✗ 0
     data_received.................: 25 MB   83 kB/s
     data_sent.....................: 4.2 MB  14 kB/s
     http_req_blocked..............: avg=1.2ms    min=1µs      med=4µs      max=45ms     p(90)=6µs      p(95)=8ms
     http_req_connecting...........: avg=580µs    min=0s       med=0s       max=22ms     p(90)=0s       p(95)=3ms
   ✓ http_req_duration.............: avg=245.5ms  min=120ms    med=230ms    max=890ms    p(90)=380ms    p(95)=450ms
       { expected_response:true }...: avg=245.5ms  min=120ms    med=230ms    max=890ms    p(90)=380ms    p(95)=450ms
   ✓ http_req_failed...............: 0.00%   ✓ 0         ✗ 3000
     http_req_receiving............: avg=125µs    min=20µs     med=95µs     max=2.5ms    p(90)=180µs    p(95)=250µs
     http_req_sending..............: avg=28µs     min=8µs      med=22µs     max=450µs    p(90)=45µs     p(95)=65µs
     http_req_tls_handshaking......: avg=580µs    min=0s       med=0s       max=18ms     p(90)=0s       p(95)=2.5ms
     http_req_waiting..............: avg=245.3ms  min=119.8ms  med=229.9ms  max=889.5ms  p(90)=379.8ms  p(95)=449.8ms
     http_reqs.....................: 3000    10/s
     iteration_duration............: avg=1.24s    min=620ms    med=1.23s    max=2.89s    p(90)=1.38s    p(95)=1.45s
     iterations....................: 3000    10/s
     queries_executed..............: 3000    10/s
   ✓ query_duration................: avg=245.5ms  min=120ms    med=230ms    max=890ms    p(90)=380ms    p(95)=450ms
   ✓ query_success_rate............: 100.00% ✓ 3000      ✗ 0
     vus...........................: 10      min=10      max=10
     vus_max.......................: 10      min=10      max=10


running (5m00.3s), 00/10 VUs, 3000 complete and 0 interrupted iterations
steady_load ✓ [======================================] 10 VUs  5m0s

[SUCCESS] Steady Load test completed
[SUCCESS] All load tests completed successfully
[INFO] Results saved to: ./results
```

## Successful Run - All Thresholds Pass

The ✓ symbols next to metrics indicate thresholds passed:
- `http_req_duration`: P95 is 450ms < 2000ms threshold ✓
- `query_success_rate`: 100% > 95% threshold ✓
- `http_req_failed`: 0% < 5% threshold ✓

## Example with Threshold Failure

If performance degrades:

```
     ✓ status is 201
     ✓ response has body
     ✗ query completed
       ↳  85% — ✓ 2550 / ✗ 450

   ✗ http_req_duration.............: avg=2.5s     min=120ms    med=2.3s     max=8.5s     p(90)=4.2s     p(95)=5.1s
       { expected_response:true }...: avg=2.5s     min=120ms    med=2.3s     max=8.5s     p(90)=4.2s     p(95)=5.1s
     http_req_failed...............: 15.00%  ✓ 450       ✗ 2550
   ✗ query_success_rate............: 85.00%  ✓ 2550      ✗ 450

ERRO[0301] some thresholds have failed
```

The ✗ symbols indicate failures:
- P95 duration is 5.1s > 2000ms threshold
- Success rate is 85% < 95% threshold

## Example Results File

**results/summary-20251208-155500.json:**

```json
{
  "metrics": {
    "query_success_rate": {
      "type": "rate",
      "contains": "default",
      "values": {
        "rate": 1,
        "passes": 3000,
        "fails": 0
      },
      "thresholds": {
        "rate>0.95": {
          "ok": true
        }
      }
    },
    "query_duration": {
      "type": "trend",
      "contains": "time",
      "values": {
        "avg": 245.5,
        "min": 120,
        "med": 230,
        "max": 890,
        "p(90)": 380,
        "p(95)": 450,
        "p(99)": 650
      }
    },
    "http_req_duration": {
      "type": "trend",
      "contains": "time",
      "values": {
        "avg": 245.5,
        "min": 120,
        "med": 230,
        "max": 890,
        "p(90)": 380,
        "p(95)": 450,
        "p(99)": 650
      },
      "thresholds": {
        "p(95)<2000": {
          "ok": true
        }
      }
    },
    "queries_executed": {
      "type": "counter",
      "contains": "default",
      "values": {
        "count": 3000,
        "rate": 10.003334445185395
      }
    },
    "cel_filter_errors": {
      "type": "counter",
      "contains": "default",
      "values": {
        "count": 0,
        "rate": 0
      }
    }
  },
  "root_group": {
    "checks": [
      {
        "name": "status is 201",
        "passes": 3000,
        "fails": 0
      },
      {
        "name": "response has body",
        "passes": 3000,
        "fails": 0
      },
      {
        "name": "query completed",
        "passes": 3000,
        "fails": 0
      }
    ]
  }
}
```

## Analyzing Results with jq

```bash
# Get overall success rate
$ cat results/summary-*.json | jq '.metrics.query_success_rate.values.rate'
1.0

# Get P95 latency
$ cat results/summary-*.json | jq '.metrics.http_req_duration.values["p(95)"]'
450

# Check if any thresholds failed
$ cat results/summary-*.json | jq '.metrics | to_entries[] | select(.value.thresholds // {} | to_entries[] | select(.value.ok == false))'
# (empty output = all passed)

# Get total queries executed
$ cat results/summary-*.json | jq '.metrics.queries_executed.values.count'
3000

# Get CEL filter error count
$ cat results/summary-*.json | jq '.metrics.cel_filter_errors.values.count'
0
```

## Example Error Scenarios

### Authentication Failure

```
ERRO[0001] Request Failed                               error="Get \"https://127.0.0.1:52905/apis/activity.miloapis.com/v1alpha1/auditlogqueries\": remote error: tls: bad certificate"
```

**Solution**: Check client certificate paths are correct.

### CEL Filter Error

```
Query failed: complex_multi_condition, Status: 400, Body: {
  "kind": "Status",
  "apiVersion": "v1",
  "status": "Failure",
  "message": "invalid filter expression: undefined field 'invalid_field'",
  "reason": "BadRequest",
  "code": 400
}
```

**Solution**: Fix the CEL filter expression in `queryTemplates`.

### Connection Timeout

```
ERRO[0030] Request Failed                               error="Get \"https://127.0.0.1:52905/apis/activity.miloapis.com/v1alpha1/auditlogqueries\": context deadline exceeded"
```

**Solution**: Check if API server is running and accessible.

## Performance Trends

Track performance over time:

```bash
# Extract P95 from all test runs
for file in results/summary-*.json; do
  timestamp=$(basename "$file" .json | cut -d'-' -f2-)
  p95=$(jq -r '.metrics.http_req_duration.values["p(95)"]' "$file")
  echo "$timestamp: $p95 ms"
done

# Example output:
# 20251208-100000: 450 ms
# 20251208-110000: 465 ms
# 20251208-120000: 442 ms
# 20251208-130000: 478 ms
```

## Grafana Integration (Future)

Results can be exported to InfluxDB/Prometheus for visualization:

```bash
k6 run \
  --out influxdb=http://localhost:8086/k6 \
  dist/query-load-test.js
```

Then create Grafana dashboards to visualize:
- Query success rate over time
- P95/P99 latency trends
- Throughput (queries/second)
- Error rate by query type
