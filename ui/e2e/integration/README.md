# Integration Tests for Activity UI

This directory contains end-to-end integration tests that run against a **real API backend**. Unlike the mocked E2E tests in `ui/e2e/policies/`, these tests interact with actual Kubernetes API servers and ClickHouse storage.

## Purpose

Integration tests verify that the UI works correctly with the real Activity API backend, including:

- Creating, reading, updating, and deleting ActivityPolicy resources
- Real CEL expression evaluation via PolicyPreview
- Real audit log queries from ClickHouse
- Kubernetes API interactions (authentication, validation, etc.)

## Prerequisites

Before running integration tests, you need a running development environment:

### 1. Start the Dev Cluster

From the repository root:

```bash
task dev:setup
```

This command will:
- Create a local KIND cluster
- Deploy Activity components (apiserver, processor, controller)
- Set up dependencies (NATS, ClickHouse, etcd)
- Forward the API server to `localhost:6443`

### 2. Start the Example App

From the `ui/example` directory:

```bash
cd ui/example
npm install
npm run dev
```

The example app will be available at `http://localhost:3000`.

### 3. Verify the Environment

Check that the API server is accessible:

```bash
curl -k http://localhost:6443/apis/activity.miloapis.com/v1alpha1
```

You should see a JSON response with API resource information.

## Running the Tests

From the `ui/` directory:

```bash
# Run all integration tests
npm run test:e2e:integration

# Run with visible browser (headed mode)
npm run test:e2e:integration:headed

# Run a specific test file
npx playwright test --config=playwright.integration.config.ts policy-crud.integration.ts

# Run a specific test by name
npx playwright test --config=playwright.integration.config.ts -g "can create a new policy"
```

## Test Configuration

Integration tests use a separate Playwright configuration file: `playwright.integration.config.ts`

Key differences from the mocked E2E tests:

| Setting | Mocked Tests | Integration Tests |
|---------|--------------|-------------------|
| Test Directory | `ui/e2e/policies/` | `ui/e2e/integration/` |
| Timeout | 30s | 60s |
| Parallelization | Yes | No (serial execution) |
| Web Server | Auto-started | Manual (assumed running) |
| API Calls | Mocked | Real backend |

## Test Data Cleanup

Integration tests create real Kubernetes resources that need to be cleaned up. The test suite handles cleanup automatically:

1. **After each test**: Policies created during the test are deleted via `cleanupPolicy()` helper
2. **On test failure**: Cleanup still runs to prevent resource leaks
3. **Manual cleanup**: If tests crash, you can manually delete policies:

```bash
# List all policies
kubectl get activitypolicies

# Delete a specific test policy
kubectl delete activitypolicy test-policy-1234567890
```

## Test Structure

### Helper Functions (`helpers.ts`)

- `generateUniquePolicyName()` - Generate unique policy names to avoid conflicts
- `cleanupPolicy()` - Delete a policy via the UI
- `setupApiConnection()` - Configure API connection in the example app
- `navigateToPolicies()` - Navigate to the policy list page
- `policyExists()` - Check if a policy exists in the list

### Test Cases (`policy-crud.integration.ts`)

| Test | What It Validates |
|------|-------------------|
| `can create a new policy with audit rules` | Full policy creation flow with API group selection and rule configuration |
| `can edit an existing policy and add rules` | Policy updates are persisted to the backend |
| `policy preview evaluates rules against real audit logs` | CEL evaluation works with real audit log data from ClickHouse |
| `can delete a policy` | Policy deletion removes the resource from the cluster |
| `policy list shows created policies` | Policies are correctly displayed in the UI after creation |

## Troubleshooting

### Test Timeout Errors

If tests timeout, check:

1. **API server is running**: `curl -k http://localhost:6443/apis/activity.miloapis.com/v1alpha1`
2. **Example app is running**: Visit `http://localhost:3000` in your browser
3. **ClickHouse is healthy**: `task test-infra:kubectl -- get pods -n activity-system`

### Authentication Errors

If you see 401/403 errors:

1. Check that the API server is configured for local development (no auth required)
2. Verify the example app is connecting to the correct API URL (`http://localhost:6443`)

### Policy Not Found After Creation

If a policy is created but not visible:

1. Check controller logs: `task test-infra:kubectl -- logs -l app=activity-controller-manager -n activity-system`
2. Verify the policy exists: `kubectl get activitypolicies`
3. Check for validation errors in the policy status

### ClickHouse Connection Errors

If preview tests fail due to missing audit logs:

1. Verify ClickHouse is running: `task test-infra:kubectl -- get pods -l app=clickhouse`
2. Check migrations ran successfully: `task migrations:cluster:verify`
3. Verify audit logs are being ingested (may take a few minutes after cluster startup)

### Cleanup Failures

If cleanup fails and policies are left behind:

```bash
# List all test policies
kubectl get activitypolicies | grep test-policy

# Delete all test policies at once
kubectl delete activitypolicies -l test=true

# Or delete manually
kubectl delete activitypolicy test-policy-1234567890
```

## Best Practices

### Writing New Integration Tests

1. **Always generate unique names**: Use `generateUniquePolicyName()` to avoid conflicts
2. **Track created resources**: Add policy names to the `createdPolicies` array for automatic cleanup
3. **Use realistic data**: Test with API groups and resource kinds that actually exist in the cluster
4. **Handle both success and failure**: Test should pass whether audit logs exist or not (empty state is valid)
5. **Add appropriate waits**: Use `page.waitForTimeout()` for animations, `page.waitForURL()` for navigation

### Debugging Tests

Run tests in headed mode to see what's happening:

```bash
npm run test:e2e:integration:headed
```

Enable Playwright debug mode:

```bash
PWDEBUG=1 npm run test:e2e:integration
```

Take screenshots on specific steps:

```typescript
await page.screenshot({ path: 'debug-screenshot.png' });
```

## CI/CD Integration

When running in CI, ensure:

1. Dev environment is set up before tests run: `task dev:setup`
2. Tests run serially (already configured in `playwright.integration.config.ts`)
3. Retries are enabled for flaky network issues (configured: 2 retries on CI)
4. Artifacts (screenshots, videos, traces) are collected on failure

Example GitHub Actions workflow:

```yaml
- name: Setup dev environment
  run: task dev:setup

- name: Start example app
  run: cd ui/example && npm run dev &

- name: Run integration tests
  run: cd ui && npm run test:e2e:integration

- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-results
    path: ui/playwright-report/
```

## Coverage

Integration tests focus on **critical paths**, not comprehensive coverage:

- ✅ Core CRUD operations (create, read, update, delete)
- ✅ Real API interactions (CEL evaluation, audit log queries)
- ✅ End-to-end user workflows
- ❌ Edge cases (use unit tests)
- ❌ UI component variations (use mocked E2E tests)
- ❌ Performance testing (use load tests)

## Related Documentation

- [Mocked E2E Tests](../policies/README.md) - Component-level UI tests with mocked API
- [Playwright Configuration](../../playwright.config.ts) - Main E2E test configuration
- [Integration Test Config](../../playwright.integration.config.ts) - Integration-specific settings
- [Activity API Documentation](../../../docs/api.md) - API reference for understanding test behavior
