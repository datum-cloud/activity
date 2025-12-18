# k6 Load Tests for Activity

This directory contains k6 load tests written in TypeScript for testing the query performance of Activity.

## Overview

The load tests simulate realistic query patterns against the `AuditLogQuery` API endpoint, testing:

- **Simple queries**: Single condition filters (verb, namespace, resource)
- **Medium complexity queries**: Multiple conditions and IN operators
- **Complex queries**: Multi-condition filters with timestamp ranges
- **Pagination**: Testing cursor-based pagination with various page sizes

## Test Scenarios

### 1. Steady Load (`steady_load`)
- **Duration**: 5 minutes
- **Virtual Users**: 10 concurrent users
- **Purpose**: Baseline performance under normal load

### 2. Ramp Up (`ramp_up`)
- **Duration**: 16 minutes total
- **Virtual Users**: 0 → 20 → 50 → 100 → 0
- **Purpose**: Test system behavior under increasing load

### 3. Spike Test (`spike`)
- **Duration**: ~1.5 minutes
- **Virtual Users**: 0 → 200 → 0 (sudden spike)
- **Purpose**: Test system resilience under sudden traffic bursts

## Prerequisites

1. **Install k6**
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. **Install Node.js dependencies**
   ```bash
   cd test/load
   npm install
   ```

## Running Tests

### Using the Helper Script (Recommended)

The `run-load-test.sh` script handles building and running the tests with automatic certificate extraction:

```bash
# Run all scenarios against local API server (auto-detects .test-infra/kubeconfig)
./test/load/run-load-test.sh

# The script automatically:
# - Detects the test-infra kubeconfig
# - Extracts client certificates and keys
# - Extracts the API server URL
# - Configures k6 to use mTLS authentication

# Run only steady load test
./test/load/run-load-test.sh --scenario steady

# Run with specific kubeconfig file
./test/load/run-load-test.sh --kubeconfig ~/.kube/config

# Run against remote API server with bearer token (disable client certs)
./test/load/run-load-test.sh \
  --url https://api.example.com:6443 \
  --token $(kubectl create token k6-load-test -n kube-system) \
  --no-client-certs

# Run with custom namespace filter
./test/load/run-load-test.sh --namespace production

# Run spike test on k6 Cloud
./test/load/run-load-test.sh --scenario spike --cloud
```

### Manual Execution

If you prefer to run tests manually:

```bash
cd test/load

# Build TypeScript tests
npm run build

# Option 1: Using client certificates (recommended for test-infra)
export API_SERVER_URL=https://127.0.0.1:52905  # From kubeconfig
export CLIENT_CERT_PATH=/tmp/client.crt
export CLIENT_KEY_PATH=/tmp/client.key
export NAMESPACE_FILTER=default

# Extract certs from kubeconfig
grep "client-certificate-data:" ../../.test-infra/kubeconfig | awk '{print $2}' | base64 -d > ${CLIENT_CERT_PATH}
grep "client-key-data:" ../../.test-infra/kubeconfig | awk '{print $2}' | base64 -d > ${CLIENT_KEY_PATH}

k6 run --include-system-env-vars dist/query-load-test.js

# Option 2: Using bearer token
export API_SERVER_URL=https://localhost:6443
export KUBE_TOKEN=$(kubectl create token k6-load-test -n kube-system)
export NAMESPACE_FILTER=default

k6 run --include-system-env-vars dist/query-load-test.js

# Run specific scenario
k6 run --include-system-env-vars --env SCENARIO=steady_load dist/query-load-test.js
```

## Authentication

The load tests support two authentication methods:

### 1. Client Certificate Authentication (mTLS)

This is the **recommended method** for the test-infra environment. The helper script automatically extracts certificates from your kubeconfig.

**Automatic (using helper script):**
```bash
# Auto-detects .test-infra/kubeconfig
./test/load/run-load-test.sh

# Or specify a kubeconfig
./test/load/run-load-test.sh --kubeconfig ~/.kube/config
```

**Manual:**
```bash
export CLIENT_CERT_PATH=/path/to/client.crt
export CLIENT_KEY_PATH=/path/to/client.key
k6 run --include-system-env-vars dist/query-load-test.js
```

### 2. Bearer Token Authentication

Use this method when connecting to remote clusters or when client certificates are not available.

```bash
# Using helper script
./test/load/run-load-test.sh \
  --token $(kubectl create token k6-load-test -n kube-system) \
  --no-client-certs

# Manual
export KUBE_TOKEN=$(kubectl create token k6-load-test -n kube-system)
k6 run --include-system-env-vars dist/query-load-test.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_SERVER_URL` | Activity API server base URL | `https://localhost:6443` |
| `KUBE_TOKEN` | Kubernetes bearer token for authentication | _empty_ |
| `CLIENT_CERT_PATH` | Path to client certificate for mTLS | _empty_ |
| `CLIENT_KEY_PATH` | Path to client key for mTLS | _empty_ |
| `CA_CERT_PATH` | Path to CA certificate | _empty_ |
| `NAMESPACE_FILTER` | Namespace to use in query filters | `default` |
| `SCENARIO` | Test scenario to run | `all` |
| `K6_INSECURE_SKIP_TLS_VERIFY` | Skip TLS verification (for self-signed certs) | `true` |

### Getting a Kubernetes Token

```bash
# Create a service account for testing (if needed)
kubectl create serviceaccount k6-load-test -n kube-system

# Create a ClusterRole with permissions to query audit logs
kubectl create clusterrolebinding k6-load-test \
  --clusterrole=cluster-admin \
  --serviceaccount=kube-system:k6-load-test

# Get the token (Kubernetes 1.24+)
kubectl create token k6-load-test -n kube-system --duration=24h

# Or get the token from a secret (Kubernetes <1.24)
kubectl get secret -n kube-system \
  $(kubectl get serviceaccount k6-load-test -n kube-system -o jsonpath='{.secrets[0].name}') \
  -o jsonpath='{.data.token}' | base64 -d
```

## Query Templates

The load test includes various query templates to test different CEL filter expressions:

### Simple Queries
- Verb filtering: `verb == 'create'`
- Namespace filtering: `ns == 'default'`
- Resource filtering: `resource == 'pods'`

### Medium Complexity
- Combined conditions: `verb == 'delete' && ns == 'default'`
- Multiple verbs: `verb in ['create', 'update', 'delete']`
- User prefix: `user.startsWith('system:') && verb == 'get'`

### Complex Queries
- Multi-condition: `ns in ['default', 'kube-system'] && resource == 'deployments' && verb in ['create', 'update']`
- Timestamp ranges: `timestamp >= timestamp('2024-01-01T00:00:00Z') && verb == 'delete'`
- Secrets audit: `resource == 'secrets' && stage == 'ResponseComplete' && verb in ['get', 'list']`

### Pagination
- Small pages: 10 events per page
- Medium pages: 25 events per page

## Metrics

The load tests track the following custom metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `query_success_rate` | Rate | Percentage of successful queries |
| `query_duration` | Trend | Query execution time distribution |
| `queries_executed` | Counter | Total number of queries executed |
| `cel_filter_errors` | Counter | Number of CEL filter validation errors |

## Performance Thresholds

The tests enforce the following performance thresholds:

- 95th percentile response time < 2000ms
- Query success rate > 95%
- HTTP request failure rate < 5%

If any threshold is violated, the test will fail.

## Output and Results

Test results are saved to the `results/` directory:

- **JSON output**: `results-TIMESTAMP.json` - Detailed test results
- **Summary**: `summary-TIMESTAMP.json` - Test summary with metrics

### Analyzing Results

```bash
# View summary
cat test/load/results/summary-*.json | jq

# Extract specific metrics
cat test/load/results/results-*.json | jq '.metrics.query_success_rate'

# Check threshold violations
cat test/load/results/summary-*.json | jq '.metrics | to_entries[] | select(.value.thresholds // {} | length > 0)'
```

## k6 Cloud (Optional)

You can run tests on k6 Cloud for advanced analytics and monitoring:

1. **Sign up** at https://k6.io/cloud
2. **Login**:
   ```bash
   k6 login cloud
   ```
3. **Run test**:
   ```bash
   ./test/load/run-load-test.sh --cloud
   ```

## Troubleshooting

### Certificate Errors

If testing against a server with self-signed certificates:

```bash
export K6_INSECURE_SKIP_TLS_VERIFY=true
k6 run dist/query-load-test.js
```

### Connection Refused

Ensure the API server is running and accessible:

```bash
# Check if API server is running
kubectl get --raw /apis/activity.miloapis.com/v1alpha1

# Check if port-forward is active (if using local cluster)
kubectl port-forward -n activity-system svc/activity-apiserver 6443:443
```

### High Error Rate

- Check API server logs for errors
- Verify authentication token is valid
- Ensure ClickHouse is running and accessible
- Check if query filters are valid CEL expressions
- Monitor API server resource usage (CPU, memory)

## Development

### Adding New Query Templates

Edit [query-load-test.ts](./query-load-test.ts) and add to the `queryTemplates` array:

```typescript
{
  name: 'my_custom_query',
  filter: "verb == 'patch' && resource == 'configmaps'",
  limit: 100,
}
```

### Modifying Test Scenarios

Update the `options.scenarios` object in [query-load-test.ts](./query-load-test.ts):

```typescript
export const options = {
  scenarios: {
    my_scenario: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      tags: { scenario: 'custom' },
    },
  },
};
```

### TypeScript Type Checking

```bash
npm run type-check
```

## Related Documentation

- [k6 Documentation](https://k6.io/docs/)
- [k6 TypeScript Guide](https://k6.io/docs/using-k6/javascript-typescript-compatibility-mode/)
- [Activity Server README](../../README.md)
- [AuditLogQuery API Reference](../../docs/api-reference.md)

## License

Apache-2.0
