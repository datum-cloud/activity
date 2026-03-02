import type {
  ActivityPolicy,
  ActivityPolicyList,
  ActivityPolicyRule,
} from '../../src/types/policy';

/**
 * Mock data for ActivityPolicy E2E tests
 */

/**
 * Sample audit rule for HTTPProxy creation
 */
const httpProxyCreateRule: ActivityPolicyRule = {
  name: 'httpproxy-create',
  description: 'Triggered when an HTTPProxy is created',
  match: 'verb == "create"',
  summary: '{{ actor.name }} created {{ link(kind + " " + objectRef.name, responseObject) }}',
};

/**
 * Sample audit rule for HTTPProxy deletion
 */
const httpProxyDeleteRule: ActivityPolicyRule = {
  name: 'httpproxy-delete',
  description: 'Triggered when an HTTPProxy is deleted',
  match: 'verb == "delete"',
  summary: '{{ actor.name }} deleted {{ kind }} {{ objectRef.name }}',
};

/**
 * Sample event rule for HTTPProxy readiness
 */
const httpProxyReadyRule: ActivityPolicyRule = {
  name: 'httpproxy-ready',
  description: 'Triggered when an HTTPProxy becomes ready',
  match: 'event.reason == "Ready"',
  summary: '{{ kind }} {{ event.regarding.name }} is ready',
};

/**
 * Sample policy for HTTPProxy resources
 */
const httpProxyPolicy: ActivityPolicy = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicy',
  metadata: {
    name: 'httpproxy-policy',
    resourceVersion: '12345',
    creationTimestamp: '2024-01-15T10:00:00Z',
  },
  spec: {
    resource: {
      apiGroup: 'networking.datumapis.com',
      kind: 'HTTPProxy',
      kindLabel: 'HTTP Proxy',
      kindLabelPlural: 'HTTP Proxies',
    },
    auditRules: [httpProxyCreateRule, httpProxyDeleteRule],
    eventRules: [httpProxyReadyRule],
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2024-01-15T10:00:05Z',
        reason: 'AllRulesCompiled',
        message: 'All rules compiled successfully',
      },
    ],
    observedGeneration: 1,
  },
};

/**
 * Sample policy for Gateway resources
 */
const gatewayPolicy: ActivityPolicy = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicy',
  metadata: {
    name: 'gateway-policy',
    resourceVersion: '12346',
    creationTimestamp: '2024-01-16T14:30:00Z',
  },
  spec: {
    resource: {
      apiGroup: 'networking.datumapis.com',
      kind: 'Gateway',
    },
    auditRules: [
      {
        name: 'gateway-create',
        match: 'verb == "create"',
        summary: '{{ actor.name }} created Gateway {{ objectRef.name }}',
      },
      {
        name: 'gateway-update',
        match: 'verb == "update"',
        summary: '{{ actor.name }} updated Gateway {{ objectRef.name }}',
      },
    ],
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2024-01-16T14:30:05Z',
        reason: 'AllRulesCompiled',
        message: 'All rules compiled successfully',
      },
    ],
    observedGeneration: 1,
  },
};

/**
 * Sample policy for Deployment resources (different API group)
 */
const deploymentPolicy: ActivityPolicy = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicy',
  metadata: {
    name: 'deployment-policy',
    resourceVersion: '12347',
    creationTimestamp: '2024-01-17T09:15:00Z',
  },
  spec: {
    resource: {
      apiGroup: 'apps',
      kind: 'Deployment',
    },
    auditRules: [
      {
        name: 'deployment-create',
        match: 'verb == "create"',
        summary: '{{ actor.name }} created Deployment {{ objectRef.name }}',
      },
    ],
    eventRules: [
      {
        name: 'deployment-progressing',
        match: 'event.reason == "Progressing"',
        summary: 'Deployment {{ event.regarding.name }} is progressing',
      },
    ],
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2024-01-17T09:15:05Z',
        reason: 'AllRulesCompiled',
        message: 'All rules compiled successfully',
      },
    ],
    observedGeneration: 1,
  },
};

/**
 * Mock policy with error status (compilation failed)
 */
export const mockPolicyWithError: ActivityPolicy = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicy',
  metadata: {
    name: 'broken-policy',
    resourceVersion: '12348',
    creationTimestamp: '2024-01-18T11:00:00Z',
  },
  spec: {
    resource: {
      apiGroup: 'test.datumapis.com',
      kind: 'BrokenResource',
    },
    auditRules: [
      {
        name: 'broken-rule',
        match: 'invalid.syntax.here',
        summary: 'This will fail to compile',
      },
    ],
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'False',
        lastTransitionTime: '2024-01-18T11:00:05Z',
        reason: 'CompilationFailed',
        message: 'Rule "broken-rule" failed to compile: undefined field "invalid"',
      },
    ],
    observedGeneration: 1,
  },
};

/**
 * Mock list of policies for testing list view
 */
export const mockPolicyList: ActivityPolicyList = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicyList',
  metadata: {
    resourceVersion: '12350',
  },
  items: [httpProxyPolicy, gatewayPolicy, deploymentPolicy],
};

/**
 * Single mock policy for detail view testing
 */
export const mockPolicy: ActivityPolicy = httpProxyPolicy;

/**
 * Empty policy list for empty state testing
 */
export const mockEmptyPolicyList: ActivityPolicyList = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'ActivityPolicyList',
  metadata: {
    resourceVersion: '12351',
  },
  items: [],
};
