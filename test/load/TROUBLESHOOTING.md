# Troubleshooting Guide

Common issues and solutions for the k6 load tests.

## "expected string value in NamedValue for query parameter"

**Error Message:**
```
ERRO[0169] Query failed: complex_timestamp_range, Status: 400, Body: {"kind":"Status",...,"message":"Failed to execute query: failed to query ClickHouse: expected string value in NamedValue for query parameter",...}
```

**Cause:**
The `continueAfter` pagination parameter was being passed as an empty string or invalid value to ClickHouse.

**Fix Applied:**
Updated `createQueryRequest()` to strictly validate `continueAfter` before including it in the query spec:

```typescript
// Only add continueAfter if it's a valid non-empty string
if (continueAfter && typeof continueAfter === 'string' && continueAfter.trim().length > 0) {
  spec.continueAfter = continueAfter;
}
```

**Prevention:**
The pagination code now validates the cursor value twice:
1. When extracting from API response
2. When creating the next query request

---

## "User system:anonymous cannot create resource"

**Error Message:**
```
Status: 403, Body: {"message":"...is forbidden: User \"system:anonymous\" cannot create resource..."}
```

**Cause:**
Client certificates are not being sent with the request.

**Solution:**
1. Ensure `CLIENT_CERT_PATH` and `CLIENT_KEY_PATH` environment variables are set
2. Verify certificates are extracted from kubeconfig:
   ```bash
   grep "client-certificate-data:" ~/.kube/config | awk '{print $2}' | base64 -d > /tmp/client.crt
   ```
3. Check that k6 is loading the certificates (look for the warning about `tlsAuth.domains`)

**Quick Fix:**
Use the helper script which auto-extracts certificates:
```bash
./run-load-test.sh
```

---

## CEL Field Name Errors (422 Invalid)

**Error Message:**
```
Status: 422, Body: {"message":"...Invalid CEL expression...undeclared reference to 'ns'..."}
```

**Cause:**
Query templates using incorrect field names.

**Correct Field Names:**
- ✅ `objectRef.namespace` (not `ns`)
- ✅ `objectRef.resource` (not `resource`)
- ✅ `user.username` (not `user`)
- ✅ `stageTimestamp` (not `timestamp`)

**Solution:**
Update query templates to use the correct field names. See `query-load-test.ts` for examples.

---

## ClickHouse Memory Limit Exceeded

**Error Message:**
```
Status: 400, Body: {"message":"...memory limit exceeded: would use 1.98 GiB..."}
```

**Cause:**
Queries returning too many results exceed ClickHouse memory limits.

**Solutions:**

1. **Reduce query limits** in templates:
   ```typescript
   {
     name: 'simple_verb_filter',
     filter: "verb == 'create'",
     limit: 50,  // Reduced from 100
   }
   ```

2. **Add more specific filters:**
   ```typescript
   {
     name: 'recent_creates',
     filter: "verb == 'create' && objectRef.namespace == 'default'",
     limit: 100,
   }
   ```

3. **Increase ClickHouse memory:**
   Edit ClickHouse config:
   ```xml
   <max_memory_usage>4000000000</max_memory_usage>
   ```

4. **Disable memory-intensive queries temporarily:**
   Comment out the problematic templates in `queryTemplates` array.

---

## TLS Certificate Verification Failed

**Error Message:**
```
ERRO[0001] Request Failed error="Get \"https://127.0.0.1:52905/...\": x509: certificate signed by unknown authority"
```

**Cause:**
Self-signed certificates without proper CA verification.

**Solution:**
The load tests already set `insecureSkipTLSVerify: true` by default. If this error still occurs:

```bash
export K6_INSECURE_SKIP_TLS_VERIFY=true
./run-load-test.sh
```

---

## Connection Refused

**Error Message:**
```
ERRO[0001] Request Failed error="Get \"https://127.0.0.1:52905/...\": dial tcp 127.0.0.1:52905: connect: connection refused"
```

**Cause:**
API server not running or port incorrect.

**Solution:**

1. **Check API server is running:**
   ```bash
   kubectl --kubeconfig .test-infra/kubeconfig get pods -n activity-system
   ```

2. **Verify correct port:**
   ```bash
   grep "server:" .test-infra/kubeconfig
   ```

3. **Port forward if needed:**
   ```bash
   kubectl port-forward -n activity-system svc/activity-apiserver 6443:443
   ```

---

## No Audit Logs Returned

**Issue:**
All queries return 0 results.

**Cause:**
No audit log data in ClickHouse.

**Solution:**

1. **Check if data exists:**
   ```bash
   kubectl exec -n activity-system chi-activity-clickhouse-activity-0-0-0 -- \
     clickhouse-client --query "SELECT count(*) FROM audit.events"
   ```

2. **Generate test data:**
   ```bash
   cd tools/audit-log-generator
   ./kubernetes-load-generator.sh
   ```

3. **Wait for data to be indexed:**
   Data may take a few seconds to appear in ClickHouse.

---

## k6 Not Installed

**Error Message:**
```
[ERROR] k6 is not installed
```

**Solution:**

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

---

## Build Errors (TypeScript/Webpack)

**Error Message:**
```
ERROR in ./query-load-test.ts
Module build failed...
```

**Solution:**

1. **Clean and rebuild:**
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be >= 18
   ```

3. **Type check first:**
   ```bash
   npm run type-check
   ```

---

## Thresholds Failed

**Message:**
```
✗ http_req_duration.............: avg=2.5s p(95)=5.1s
ERRO[0301] some thresholds have failed
```

**Cause:**
Performance doesn't meet defined thresholds.

**Solutions:**

1. **Adjust thresholds in `query-load-test.ts`:**
   ```typescript
   thresholds: {
     http_req_duration: ['p(95)<5000'],  // Increased from 2000ms
     query_success_rate: ['rate>0.90'],  // Reduced from 0.95
   }
   ```

2. **Reduce load:**
   - Decrease number of VUs
   - Increase iteration sleep time
   - Reduce query complexity

3. **Optimize API server:**
   - Add database indexes
   - Increase API server resources
   - Optimize ClickHouse queries

---

## Getting Help

If you encounter other issues:

1. **Check logs:**
   ```bash
   # API server logs
   kubectl logs -n activity-system -l app=activity-apiserver --tail=100

   # ClickHouse logs
   kubectl logs -n activity-system chi-activity-clickhouse-activity-0-0-0 --tail=100
   ```

2. **Increase k6 logging:**
   ```bash
   k6 run --log-output=stdout --log-format=raw dist/query-load-test.js
   ```

3. **Test with single VU:**
   Edit `query-load-test.ts` to use 1 VU for easier debugging.

4. **Check documentation:**
   - [README.md](./README.md) - Full documentation
   - [QUICKSTART.md](./QUICKSTART.md) - Getting started guide
   - [k6 docs](https://k6.io/docs/) - Official k6 documentation
