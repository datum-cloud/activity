# Quick Start Guide

Get up and running with k6 load tests in 5 minutes.

## 1. Install k6

```bash
# macOS
brew install k6

# Linux
curl -fsSL https://dl.k6.io/key.gpg | sudo apt-key add -
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## 2. Install Dependencies

```bash
cd test/load
npm install
```

## 3. Run Load Tests

### Against test-infra (Local Kind Cluster)

The simplest way to run load tests against your local test-infra cluster:

```bash
# Make sure test-infra is running
cd ../../.test-infra
task up  # If not already running

# Run load tests
cd ../test/load
./run-load-test.sh
```

That's it! The script will:
- Auto-detect the `.test-infra/kubeconfig`
- Extract client certificates automatically
- Extract the API server URL
- Build the TypeScript tests
- Run all load test scenarios

### Quick Test (Steady Load Only)

Run just the 5-minute steady load test:

```bash
./run-load-test.sh --scenario steady
```

### Custom Namespace

Test queries against a specific namespace:

```bash
./run-load-test.sh --namespace kube-system
```

## 4. View Results

Results are saved to `./results/` directory:

```bash
# View summary
cat results/summary-*.json | jq

# View specific metrics
cat results/summary-*.json | jq '.metrics.query_success_rate'

# Check if thresholds passed
cat results/summary-*.json | jq '.metrics | to_entries[] | select(.value.thresholds.failed == true)'
```

## Troubleshooting

### "Cannot find kubeconfig"

Specify the path manually:

```bash
./run-load-test.sh --kubeconfig /path/to/kubeconfig
```

### "Connection refused"

Make sure the API server is accessible:

```bash
# Check if test-infra is running
kubectl --kubeconfig ../../.test-infra/kubeconfig get pods -A

# Get the API server URL from kubeconfig
grep "server:" ../../.test-infra/kubeconfig
```

### "Certificate errors"

The script automatically handles self-signed certificates. If you still have issues:

```bash
export K6_INSECURE_SKIP_TLS_VERIFY=true
./run-load-test.sh
```

### "No audit logs returned"

Make sure you have some audit log data in ClickHouse. You can generate test data:

```bash
# From the project root
cd tools/audit-log-generator
./kubernetes-load-generator.sh
```

## Next Steps

- Read the full [README.md](./README.md) for all configuration options
- Check out the [query templates](./query-load-test.ts) to understand what's being tested
- Modify scenarios in `query-load-test.ts` to match your use case
- Run tests on k6 Cloud for advanced analytics: `./run-load-test.sh --cloud`

## Example Output

```
[INFO] Auto-detected test-infra kubeconfig: /path/to/.test-infra/kubeconfig
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
[INFO]   Scenario: all
[INFO]   Output: ./results
[INFO]   k6 Cloud: false
[INFO]   Auth Method: Client Certificates
[INFO] Running Steady Load test...

     ✓ status is 201
     ✓ response has body
     ✓ query completed

     query_success_rate............: 98.50%
     query_duration................: avg=245ms min=120ms med=230ms max=890ms p(95)=450ms
     queries_executed..............: 3000
     cel_filter_errors.............: 0

[SUCCESS] Steady Load test completed
```
