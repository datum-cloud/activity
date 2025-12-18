# k6 Load Test Implementation Summary

## What Was Created

A comprehensive k6 load testing framework for the Activity's query endpoints with full support for client certificate authentication.

### Files Created

1. **[query-load-test.ts](./query-load-test.ts)** - Main k6 load test (9.77KB compiled)
   - 11 query templates (simple, medium, complex)
   - 3 test scenarios (steady, ramp, spike)
   - Custom metrics and thresholds
   - Client certificate (mTLS) and bearer token authentication
   - Pagination support

2. **[run-load-test.sh](./run-load-test.sh)** - Automated test runner
   - Auto-detects `.test-infra/kubeconfig`
   - Extracts client certificates from kubeconfig
   - Extracts API server URL
   - Builds TypeScript automatically
   - Multiple scenario support

3. **[package.json](./package.json)** - Node.js dependencies
   - TypeScript and webpack configuration
   - k6 type definitions
   - Build scripts

4. **[tsconfig.json](./tsconfig.json)** - TypeScript configuration
5. **[webpack.config.js](./webpack.config.js)** - Build configuration
6. **[README.md](./README.md)** - Complete documentation
7. **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute getting started guide
8. **[.gitignore](./.gitignore)** - Git exclusions

## Key Features

### Authentication Methods

#### 1. Client Certificate (mTLS) - **AUTOMATIC**
```bash
# Just run it - certificates are auto-extracted from kubeconfig
./run-load-test.sh
```

The script automatically:
- Detects `.test-infra/kubeconfig` or `~/.kube/config`
- Extracts `client-certificate-data` → `/tmp/client.crt`
- Extracts `client-key-data` → `/tmp/client.key`
- Extracts `certificate-authority-data` → `/tmp/ca.crt`
- Configures k6 to use mTLS

#### 2. Bearer Token
```bash
./run-load-test.sh \
  --token $(kubectl create token k6-load-test -n kube-system) \
  --no-client-certs
```

### Query Templates

**Simple** (50% of traffic):
- `verb == 'create'`
- `ns == 'default'`
- `resource == 'pods'`

**Medium** (30% of traffic):
- `verb == 'delete' && ns == 'default'`
- `verb in ['create', 'update', 'delete']`
- `user.startsWith('system:') && verb == 'get'`

**Complex** (15% of traffic):
- `ns in ['default', 'kube-system'] && resource == 'deployments' && verb in ['create', 'update']`
- `timestamp >= timestamp('2024-01-01T00:00:00Z') && verb == 'delete'`
- `resource == 'secrets' && stage == 'ResponseComplete' && verb in ['get', 'list']`

**Pagination** (5% of traffic):
- 10 events per page
- 25 events per page

### Test Scenarios

| Scenario | Duration | Virtual Users | Purpose |
|----------|----------|---------------|---------|
| **Steady Load** | 5 min | 10 | Baseline performance |
| **Ramp Up** | 16 min | 0→100 | Increasing load |
| **Spike** | 1.5 min | 0→200→0 | Burst resilience |

### Metrics

- **query_success_rate**: Percentage of successful queries (threshold: >95%)
- **query_duration**: Query execution time (threshold: p95 <2000ms)
- **queries_executed**: Total query count
- **cel_filter_errors**: CEL validation errors
- **http_req_failed**: HTTP failure rate (threshold: <5%)

## Usage

### Quick Start

```bash
# 1. Install k6
brew install k6  # macOS

# 2. Install dependencies
cd test/load && npm install

# 3. Run tests
./run-load-test.sh
```

### Common Commands

```bash
# Run all scenarios (default)
./run-load-test.sh

# Run specific scenario
./run-load-test.sh --scenario steady
./run-load-test.sh --scenario ramp
./run-load-test.sh --scenario spike

# Custom configuration
./run-load-test.sh --namespace production
./run-load-test.sh --kubeconfig ~/.kube/config

# k6 Cloud
./run-load-test.sh --cloud
```

### View Results

```bash
# Summary
cat results/summary-*.json | jq

# Success rate
cat results/summary-*.json | jq '.metrics.query_success_rate'

# P95 duration
cat results/summary-*.json | jq '.metrics.http_req_duration.values["p(95)"]'

# Failed thresholds
cat results/summary-*.json | jq '.metrics | to_entries[] | select(.value.thresholds.failed == true)'
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           run-load-test.sh                           │
│  1. Auto-detect kubeconfig                           │
│  2. Extract client certificates → /tmp/*.{crt,key}   │
│  3. Extract API server URL                           │
│  4. npm run build (if needed)                        │
│  5. Export environment variables                     │
│  6. Execute: k6 run dist/query-load-test.js          │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         query-load-test.ts (compiled to JS)          │
│  • Read CLIENT_CERT_PATH, CLIENT_KEY_PATH            │
│  • Configure HTTP with tlsAuth (mTLS)               │
│  • Execute queries against API server                │
│  • Track metrics and thresholds                      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         Activity                             │
│  /apis/activity.miloapis.com/v1alpha1/auditlogqueries│
│  • Validates client certificate                      │
│  • Processes AuditLogQuery                           │
│  • Returns results                                   │
└─────────────────────────────────────────────────────┘
```

## Integration with test-infra

The load tests are designed to work seamlessly with the `.test-infra` Kind cluster:

1. **Auto-detection**: Script finds `.test-infra/kubeconfig` automatically
2. **Port mapping**: Uses the correct port from kubeconfig (e.g., `https://127.0.0.1:52905`)
3. **mTLS**: Client certificates are extracted and used automatically
4. **Self-signed certs**: TLS verification is skipped by default (`insecureSkipTLSVerify: true`)

## Performance Expectations

Based on typical query performance:

| Metric | Target | Threshold |
|--------|--------|-----------|
| P50 latency | <300ms | - |
| P95 latency | <1000ms | <2000ms |
| P99 latency | <2000ms | - |
| Success rate | >98% | >95% |
| Throughput | >100 req/s | - |

## Troubleshooting

### Issue: "Cannot find kubeconfig"
**Solution**: Specify path manually
```bash
./run-load-test.sh --kubeconfig /path/to/kubeconfig
```

### Issue: "Connection refused"
**Solution**: Check API server is running
```bash
kubectl --kubeconfig ../../.test-infra/kubeconfig get pods -A
```

### Issue: "Certificate verification failed"
**Solution**: Ensure auto-extraction worked
```bash
# The script should show these messages:
# [INFO] Extracted client certificate
# [INFO] Extracted client key
# [INFO] Extracted CA certificate
```

### Issue: "No audit logs in results"
**Solution**: Generate test data
```bash
cd ../../tools/audit-log-generator
./kubernetes-load-generator.sh
```

## Next Steps

1. **Baseline**: Run `./run-load-test.sh --scenario steady` to establish baseline
2. **Stress Test**: Run `./run-load-test.sh --scenario spike` to find limits
3. **Long Running**: Modify duration in `query-load-test.ts` for soak testing
4. **Custom Queries**: Add your own query templates to `queryTemplates` array
5. **CI/CD**: Integrate into GitHub Actions or Jenkins

## Files Size

```
query-load-test.ts    : ~8 KB (source)
query-load-test.js    : 12 KB (compiled)
run-load-test.sh      : ~7 KB
README.md             : ~11 KB
```

## Dependencies

- **k6**: Load testing tool
- **Node.js**: For TypeScript compilation
- **TypeScript**: Type-safe test development
- **webpack**: Bundles TypeScript for k6
- **@types/k6**: TypeScript definitions

## License

Apache-2.0 (same as parent project)
