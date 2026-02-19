# Activity UI E2E Tests

End-to-end tests for the Activity UI component library using Playwright.

## Overview

These tests verify UI components work correctly against the real Activity API service. Tests can run in two modes:

1. **Real API Mode** (default) - Tests against a deployed Activity service
2. **Mock API Mode** - Tests with mocked responses (for offline/quick testing)

## Prerequisites

1. Install dependencies:
   ```bash
   task ui:e2e:install
   ```

2. Deploy the Activity service:
   ```bash
   task dev:setup    # Lightweight dev environment
   # or
   task test:setup   # Full HA environment
   ```

## Running Tests

### Against Real Deployment (Recommended)

```bash
# Run all tests against dev cluster
task ui:e2e:test

# This automatically:
# 1. Starts port-forward to the API server
# 2. Starts the example Remix app
# 3. Runs Playwright tests
# 4. Cleans up port-forward on exit
```

### Interactive Mode

For debugging and test development:

```bash
# Start port-forward in one terminal
task ui:e2e:port-forward

# Run tests with UI in another terminal
task ui:e2e:ui
```

### Headed Mode (Visible Browser)

```bash
task ui:e2e:headed
```

### Mock API Mode

For quick testing without a cluster:

```bash
task ui:e2e:test:mock
```

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Task
        uses: arduino/setup-task@v2

      - name: Setup test cluster
        run: task dev:setup

      - name: Install Playwright
        run: task ui:e2e:install

      - name: Run E2E tests
        run: task ui:e2e:test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: ui/playwright-report/
```

## Test Structure

```
ui/e2e/
├── fixtures/           # Shared test fixtures
│   ├── api-mocks.ts    # API mocking/configuration
│   ├── test-data.ts    # Mock data for tests
│   └── index.ts        # Fixture exports
├── tests/              # Test files
│   ├── event-type-toggle.spec.ts
│   ├── event-filters.spec.ts
│   ├── time-range.spec.ts
│   └── events-list.spec.ts
├── global-setup.ts     # Pre-test setup
└── tsconfig.json       # TypeScript config
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACTIVITY_API_URL` | URL of the Activity API server | `https://localhost:8443` |
| `ACTIVITY_API_TOKEN` | Bearer token for authentication | (none) |
| `MOCK_API` | Set to `true` for mock mode | `false` |
| `UI_BASE_URL` | URL of the UI app | `http://localhost:3000` |

### Playwright Config

See `playwright.config.ts` for full configuration options including:
- Browser selection (Chromium by default)
- Timeouts for real API calls
- Video/screenshot capture on failure
- Parallel execution settings

## Writing Tests

Tests use the custom fixture that handles API configuration:

```typescript
import { test, expect } from '../fixtures';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page, configureApi }) => {
    // Configure API connection (real or mock mode)
    await configureApi();
  });

  test('should do something', async ({ page }) => {
    await page.goto('/events');
    // Test assertions...
  });
});
```

### Mock Mode Tests

For mock-specific tests:

```typescript
test('should handle API error', async ({ page, configureApi, isMockMode }) => {
  test.skip(!isMockMode, 'Only runs in mock mode');

  await configureApi({
    errors: {
      events: { status: 500, message: 'Server error' },
    },
  });

  await page.goto('/events');
  await expect(page.getByText('Server error')).toBeVisible();
});
```

## Troubleshooting

### Port-forward issues

If tests fail with connection errors:

```bash
# Check if API is accessible
task test-infra:kubectl -- get pods -n activity-system

# Manually verify port-forward
task test-infra:kubectl -- port-forward -n activity-system svc/activity-apiserver 8443:443
curl -sk https://localhost:8443/healthz
```

### Timeout issues

Increase timeouts in `playwright.config.ts` or per-test:

```typescript
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  // ...
});
```

### Debug mode

```bash
PWDEBUG=1 task ui:e2e:test
```
