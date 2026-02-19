/**
 * E2E test fixtures index.
 * Re-exports all fixtures for easy importing in tests.
 */

export {
  test,
  expect,
  setupApiMocks,
  type MockApiConfig,
  type ApiTestFixtures,
} from './api-mocks';

export {
  createMockEvent,
  createMockEventList,
  createMockEventFacetQuery,
  createCustomEventFacetQuery,
  testDataPresets,
  type K8sEvent,
  type K8sEventList,
  type EventFacetQuery,
} from './test-data';
