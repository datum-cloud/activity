/**
 * Playwright fixtures for Activity UI E2E tests.
 *
 * Supports two modes:
 * 1. Real API mode (default): Tests run against actual Activity service deployment
 * 2. Mock API mode: Tests run with mocked API responses (for offline/CI testing)
 *
 * Set MOCK_API=true to enable mock mode.
 */

import { test as base, type Page, type Route } from '@playwright/test';
import type { K8sEventList, EventFacetQuery } from './test-data';
import { testDataPresets, createMockEventList, createMockEventFacetQuery } from './test-data';

/**
 * Mock API configuration for tests (only used when MOCK_API=true)
 */
export interface MockApiConfig {
  /** Mock events to return from the events API */
  events?: K8sEventList;
  /** Mock facets to return from the facet query API */
  facets?: EventFacetQuery;
  /** Simulate API errors */
  errors?: {
    events?: { status: number; message: string };
    facets?: { status: number; message: string };
  };
  /** Add artificial delay (ms) to simulate network latency */
  delay?: number;
}

/**
 * Check if we're running in mock mode
 */
function isMockMode(): boolean {
  return process.env.MOCK_API === 'true';
}

/**
 * Setup API mocks on a Playwright page (only in mock mode)
 */
export async function setupApiMocks(page: Page, config: MockApiConfig = {}): Promise<void> {
  if (!isMockMode()) {
    // In real mode, just set up the API connection via sessionStorage
    const apiUrl = process.env.ACTIVITY_API_URL || '';
    const apiToken = process.env.ACTIVITY_API_TOKEN || '';

    await page.addInitScript(
      ({ apiUrl, apiToken }) => {
        sessionStorage.setItem('apiUrl', apiUrl);
        if (apiToken) {
          sessionStorage.setItem('token', apiToken);
        }
      },
      { apiUrl, apiToken }
    );

    return;
  }

  // Mock mode - intercept API calls
  const {
    events = testDataPresets.mixedEvents,
    facets = testDataPresets.defaultFacets,
    errors = {},
    delay = 0,
  } = config;

  // Mock events list endpoint
  await page.route('**/apis/activity.datum.net/v1alpha1/**/events**', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (errors.events) {
      return route.fulfill({
        status: errors.events.status,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Status',
          apiVersion: 'v1',
          status: 'Failure',
          message: errors.events.message,
          code: errors.events.status,
        }),
      });
    }

    const url = new URL(route.request().url());
    const fieldSelector = url.searchParams.get('fieldSelector');

    let filteredEvents = { ...events };

    if (fieldSelector?.includes('type=')) {
      const typeMatch = fieldSelector.match(/type=(\w+)/);
      if (typeMatch) {
        const filterType = typeMatch[1];
        filteredEvents = {
          ...events,
          items: events.items.filter((e) => e.type === filterType),
        };
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(filteredEvents),
    });
  });

  // Mock events facet query endpoint
  await page.route('**/apis/activity.datum.net/v1alpha1/eventfacetqueries**', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (errors.facets) {
      return route.fulfill({
        status: errors.facets.status,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Status',
          apiVersion: 'v1',
          status: 'Failure',
          message: errors.facets.message,
          code: errors.facets.status,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(facets),
    });
  });

  // Also mock miloapis.com domain
  await page.route('**/apis/activity.miloapis.com/v1alpha1/**/events**', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (errors.events) {
      return route.fulfill({
        status: errors.events.status,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Status',
          apiVersion: 'v1',
          status: 'Failure',
          message: errors.events.message,
          code: errors.events.status,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(events),
    });
  });

  await page.route('**/apis/activity.miloapis.com/v1alpha1/eventfacetqueries**', async (route: Route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (errors.facets) {
      return route.fulfill({
        status: errors.facets.status,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Status',
          apiVersion: 'v1',
          status: 'Failure',
          message: errors.facets.message,
          code: errors.facets.status,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(facets),
    });
  });
}

/**
 * Extended test fixture with API configuration helpers
 */
export interface ApiTestFixtures {
  /** Configure API connection (real or mock based on MOCK_API env var) */
  configureApi: (config?: MockApiConfig) => Promise<void>;
  /** Check if running in mock mode */
  isMockMode: boolean;
  /** Get preset test data (only meaningful in mock mode) */
  testData: typeof testDataPresets;
  /** Helper to create custom event lists (only meaningful in mock mode) */
  createEventList: typeof createMockEventList;
  /** Helper to create custom facet queries (only meaningful in mock mode) */
  createFacetQuery: typeof createMockEventFacetQuery;
}

/**
 * Extended Playwright test with API configuration fixtures
 */
export const test = base.extend<ApiTestFixtures>({
  configureApi: async ({ page }, use) => {
    const configure = async (config: MockApiConfig = {}) => {
      await setupApiMocks(page, config);
    };
    await use(configure);
  },

  isMockMode: async ({}, use) => {
    await use(isMockMode());
  },

  testData: async ({}, use) => {
    await use(testDataPresets);
  },

  createEventList: async ({}, use) => {
    await use(createMockEventList);
  },

  createFacetQuery: async ({}, use) => {
    await use(createMockEventFacetQuery);
  },
});

export { expect } from '@playwright/test';
