/**
 * Mock test data for Playwright E2E tests.
 * Provides realistic K8sEvent and facet data for API mocking.
 */

// Define types locally to avoid build-time dependencies on the dist folder
// These match the types in ui/dist/types/k8s-event.d.ts

interface ObjectMeta {
  name?: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
}

interface ObjectReference {
  apiVersion?: string;
  kind?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  resourceVersion?: string;
  fieldPath?: string;
}

interface EventSource {
  component?: string;
  host?: string;
}

export interface K8sEvent {
  apiVersion: 'v1';
  kind: 'Event';
  metadata: ObjectMeta;
  involvedObject: ObjectReference;
  reason?: string;
  message?: string;
  type?: 'Normal' | 'Warning';
  source?: EventSource;
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventTime?: string;
}

export interface K8sEventList {
  apiVersion: 'v1';
  kind: 'EventList';
  metadata?: {
    continue?: string;
    resourceVersion?: string;
  };
  items: K8sEvent[];
}

interface FacetValue {
  value: string;
  count: number;
}

interface FacetResult {
  field: string;
  values: FacetValue[];
}

export interface EventFacetQuery {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventFacetQuery';
  spec: {
    facets: Array<{ field: string }>;
  };
  status?: {
    facets: FacetResult[];
  };
}

/**
 * Generate a mock K8sEvent
 */
export function createMockEvent(overrides: Partial<K8sEvent> = {}): K8sEvent {
  const now = new Date();
  const uid = Math.random().toString(36).substring(7);

  return {
    apiVersion: 'v1',
    kind: 'Event',
    metadata: {
      name: `event-${uid}`,
      namespace: overrides.metadata?.namespace || 'default',
      uid: uid,
      creationTimestamp: now.toISOString(),
    },
    involvedObject: {
      apiVersion: 'v1',
      kind: 'Pod',
      name: 'test-pod',
      namespace: 'default',
      uid: 'pod-uid-123',
    },
    reason: 'Scheduled',
    message: 'Successfully assigned default/test-pod to node-1',
    type: 'Normal',
    source: {
      component: 'default-scheduler',
      host: 'control-plane',
    },
    count: 1,
    firstTimestamp: now.toISOString(),
    lastTimestamp: now.toISOString(),
    ...overrides,
  };
}

/**
 * Create a list of mock events for testing
 */
export function createMockEventList(
  count: number = 10,
  options: {
    continueToken?: string;
    hasMore?: boolean;
    typeDistribution?: { normal: number; warning: number };
  } = {}
): K8sEventList {
  const { continueToken, hasMore = false, typeDistribution = { normal: 7, warning: 3 } } = options;

  const events: K8sEvent[] = [];
  const now = new Date();

  // Create normal events
  for (let i = 0; i < Math.min(typeDistribution.normal, count); i++) {
    const eventTime = new Date(now.getTime() - i * 60000); // 1 minute apart
    events.push(
      createMockEvent({
        metadata: {
          name: `normal-event-${i}`,
          namespace: i % 2 === 0 ? 'default' : 'kube-system',
          uid: `normal-${i}`,
          creationTimestamp: eventTime.toISOString(),
        },
        involvedObject: {
          apiVersion: 'v1',
          kind: i % 3 === 0 ? 'Pod' : i % 3 === 1 ? 'Deployment' : 'Service',
          name: `resource-${i}`,
          namespace: i % 2 === 0 ? 'default' : 'kube-system',
          uid: `obj-uid-${i}`,
        },
        reason: ['Scheduled', 'Pulled', 'Created', 'Started'][i % 4],
        message: `Event message ${i}`,
        type: 'Normal',
        source: {
          component: ['kubelet', 'default-scheduler', 'deployment-controller'][i % 3],
        },
        firstTimestamp: eventTime.toISOString(),
        lastTimestamp: eventTime.toISOString(),
      })
    );
  }

  // Create warning events
  for (let i = 0; i < Math.min(typeDistribution.warning, count - typeDistribution.normal); i++) {
    const eventTime = new Date(now.getTime() - (typeDistribution.normal + i) * 60000);
    events.push(
      createMockEvent({
        metadata: {
          name: `warning-event-${i}`,
          namespace: 'default',
          uid: `warning-${i}`,
          creationTimestamp: eventTime.toISOString(),
        },
        involvedObject: {
          apiVersion: 'v1',
          kind: 'Pod',
          name: `failing-pod-${i}`,
          namespace: 'default',
          uid: `failing-obj-${i}`,
        },
        reason: ['BackOff', 'Failed', 'FailedScheduling', 'Unhealthy'][i % 4],
        message: `Warning: something went wrong ${i}`,
        type: 'Warning',
        source: {
          component: 'kubelet',
        },
        firstTimestamp: eventTime.toISOString(),
        lastTimestamp: eventTime.toISOString(),
        count: i + 1,
      })
    );
  }

  return {
    apiVersion: 'v1',
    kind: 'EventList',
    metadata: {
      continue: hasMore ? 'continue-token-xyz' : undefined,
      resourceVersion: '12345',
    },
    items: events,
  };
}

/**
 * Create a mock EventFacetQuery response
 */
export function createMockEventFacetQuery(): EventFacetQuery {
  return {
    apiVersion: 'activity.miloapis.com/v1alpha1',
    kind: 'EventFacetQuery',
    spec: {
      facets: [
        { field: 'involvedObject.kind' },
        { field: 'involvedObject.namespace' },
        { field: 'reason' },
        { field: 'type' },
        { field: 'source.component' },
      ],
    },
    status: {
      facets: [
        {
          field: 'involvedObject.kind',
          values: [
            { value: 'Pod', count: 45 },
            { value: 'Deployment', count: 30 },
            { value: 'Service', count: 15 },
            { value: 'ConfigMap', count: 10 },
          ],
        },
        {
          field: 'involvedObject.namespace',
          values: [
            { value: 'default', count: 50 },
            { value: 'kube-system', count: 35 },
            { value: 'monitoring', count: 15 },
          ],
        },
        {
          field: 'reason',
          values: [
            { value: 'Scheduled', count: 25 },
            { value: 'Pulled', count: 20 },
            { value: 'Created', count: 15 },
            { value: 'Started', count: 15 },
            { value: 'BackOff', count: 10 },
            { value: 'Failed', count: 8 },
            { value: 'Unhealthy', count: 7 },
          ],
        },
        {
          field: 'type',
          values: [
            { value: 'Normal', count: 75 },
            { value: 'Warning', count: 25 },
          ],
        },
        {
          field: 'source.component',
          values: [
            { value: 'kubelet', count: 45 },
            { value: 'default-scheduler', count: 25 },
            { value: 'deployment-controller', count: 20 },
            { value: 'replicaset-controller', count: 10 },
          ],
        },
      ],
    },
  };
}

/**
 * Create a mock EventFacetQuery with custom facet values
 */
export function createCustomEventFacetQuery(
  facets: Array<{ field: string; values: Array<{ value: string; count: number }> }>
): EventFacetQuery {
  return {
    apiVersion: 'activity.miloapis.com/v1alpha1',
    kind: 'EventFacetQuery',
    spec: {
      facets: facets.map((f) => ({ field: f.field })),
    },
    status: {
      facets,
    },
  };
}

/**
 * Test data presets for common scenarios
 */
export const testDataPresets = {
  /**
   * Events list with mostly normal events
   */
  normalEvents: createMockEventList(10, {
    typeDistribution: { normal: 10, warning: 0 },
  }),

  /**
   * Events list with mostly warning events
   */
  warningEvents: createMockEventList(10, {
    typeDistribution: { normal: 0, warning: 10 },
  }),

  /**
   * Mixed events (default distribution)
   */
  mixedEvents: createMockEventList(10),

  /**
   * Empty events list
   */
  emptyEvents: {
    apiVersion: 'v1',
    kind: 'EventList',
    metadata: {},
    items: [],
  } as K8sEventList,

  /**
   * Events list with pagination
   */
  paginatedEvents: createMockEventList(20, {
    hasMore: true,
  }),

  /**
   * Default facet query response
   */
  defaultFacets: createMockEventFacetQuery(),
};
