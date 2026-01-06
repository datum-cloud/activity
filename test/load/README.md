# Performance Testing

k6 load tests for the Activity audit log query API using the [k6 operator](https://github.com/grafana/k6-operator).

## Architecture

Source scripts in [src/](src/) are synced to [config/components/k6-performance-tests/generated/](../../config/components/k6-performance-tests/generated/) via `task load:generate`, then deployed as ConfigMaps referenced by k6 TestRun resources.

## Test Scenarios

Three load scenarios run sequentially (~22min total):
- **Steady** (5m): 10 VUs constant load
- **Ramp** (16m): 0→100 VUs in stages
- **Spike** (1.5m): 200 VUs burst

Query mix: 50% simple / 30% medium / 15% complex / 5% paginated

**Thresholds**: P95 < 2s, Success > 95%, Errors < 5%

## Usage

```bash
# Deploy and run
kubectl apply -k config/components/k6-performance-tests

# Monitor
kubectl logs -n activity-system -l k6_cr=activity-query-load-test -f

# Modify tests
# 1. Edit test/load/src/query-load-test.js
# 2. Sync and redeploy
task load:generate
kubectl apply -k config/components/k6-performance-tests

# Validate locally (requires k6 installed)
task load:validate
```

## Configuration

Environment variables in [testrun.yaml](../../config/components/k6-performance-tests/testrun.yaml):
- `API_SERVER_URL`: Target apiserver endpoint
- `K6_INSECURE_SKIP_TLS_VERIFY`: Skip TLS verification (default: true)
- `TLS_CERT_FILE`, `TLS_KEY_FILE`: mTLS certificate paths (optional)

**Resources**:

- [k6](https://k6.io/docs/)
- [k6 Operator](https://github.com/grafana/k6-operator)
