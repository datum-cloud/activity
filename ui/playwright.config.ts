import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Activity UI E2E tests.
 *
 * Tests run against the Activity UI deployed in the Kubernetes cluster.
 * Port-forwarding is handled by the test task.
 *
 * Usage:
 *   # Run against dev cluster (port-forward is started automatically)
 *   task ui:e2e:test
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e/tests',

  // Global setup to configure API connection
  globalSetup: './e2e/global-setup.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  // Default timeout for tests (increased for real API calls)
  timeout: 60000,

  // Expect timeout (increased for real data loading)
  expect: {
    timeout: 10000,
  },

  // Shared settings for all the projects below
  use: {
    // Base URL for the UI app (port-forwarded from cluster)
    baseURL: process.env.UI_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure (helpful for debugging real deployment issues)
    video: 'on-first-retry',

    // Storage state with API URL configured
    storageState: './e2e/.auth/storage-state.json',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer config - we test against the deployed UI via port-forward
  // webServer is disabled because the UI is already deployed in the cluster

  // Output directory for test artifacts
  outputDir: './e2e/test-results',
});
