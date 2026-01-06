/**
 * TypeScript types for the Activity API (activity.miloapis.com/v1alpha1)
 * Based on Kubernetes audit events and custom query resources
 */

// Kubernetes Audit Event types
export interface ObjectReference {
  resource?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  apiGroup?: string;
  apiVersion?: string;
  resourceVersion?: string;
  subresource?: string;
}

export interface UserInfo {
  username?: string;
  uid?: string;
  groups?: string[];
  extra?: Record<string, string[]>;
}

export interface Event {
  level?: string;
  auditID?: string;
  stage?: string;
  requestURI?: string;
  verb?: string;
  user?: UserInfo;
  impersonatedUser?: UserInfo;
  sourceIPs?: string[];
  userAgent?: string;
  objectRef?: ObjectReference;
  responseStatus?: {
    metadata?: Record<string, unknown>;
    status?: string;
    message?: string;
    reason?: string;
    code?: number;
  };
  requestObject?: unknown;
  responseObject?: unknown;
  requestReceivedTimestamp?: string;
  stageTimestamp?: string;
  annotations?: Record<string, string>;
}

// Activity API specific types
export type QueryPhase = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface AuditLogQuerySpec {
  /**
   * CEL expression for filtering audit events
   * Available fields:
   * - timestamp: time.Time
   * - ns: string (namespace)
   * - verb: string
   * - resource: string
   * - user: string
   * - level: string
   * - stage: string
   * - uid: string
   * - requestURI: string
   * - sourceIPs: []string
   */
  filter?: string;

  /**
   * Maximum number of results (default: 100, max: 1000)
   */
  limit?: number;

  /**
   * Cursor for pagination (timestamp from previous query's status.continueAfter)
   */
  continueAfter?: string;

  /**
   * Start time for the query (ISO 8601 timestamp)
   * Required by the API
   */
  startTime?: string;

  /**
   * End time for the query (ISO 8601 timestamp)
   * Required by the API
   */
  endTime?: string;
}

export interface AuditLogQueryStatus {
  phase?: QueryPhase;
  results?: Event[];
  continueAfter?: string;
  message?: string;
}

export interface ObjectMeta {
  name?: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AuditLogQuery {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'AuditLogQuery';
  metadata?: ObjectMeta;
  spec: AuditLogQuerySpec;
  status?: AuditLogQueryStatus;
}

export interface AuditLog {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'AuditLog';
  metadata?: ObjectMeta;
  event: Event;
}

// Filter helper types
export interface FilterField {
  name: string;
  type: 'string' | 'timestamp' | 'array' | 'number';
  description: string;
  examples?: string[];
}

export const FILTER_FIELDS: FilterField[] = [
  // Top-level fields
  {
    name: 'auditID',
    type: 'string',
    description: 'Unique audit event ID',
    examples: [
      'auditID == "abc-123-def-456"'
    ]
  },
  {
    name: 'verb',
    type: 'string',
    description: 'HTTP verb (get, list, create, update, delete, patch, watch)',
    examples: [
      'verb == "delete"',
      'verb in ["create", "update", "delete"]'
    ]
  },
  {
    name: 'level',
    type: 'string',
    description: 'Audit level (Metadata, Request, RequestResponse)',
    examples: [
      'level == "RequestResponse"'
    ]
  },
  {
    name: 'stage',
    type: 'string',
    description: 'Event stage (RequestReceived, ResponseStarted, ResponseComplete, Panic)',
    examples: [
      'stage == "ResponseComplete"'
    ]
  },
  {
    name: 'requestURI',
    type: 'string',
    description: 'The request URI path',
    examples: [
      'requestURI.contains("/api/v1")',
      'requestURI.startsWith("/apis/")'
    ]
  },
  {
    name: 'userAgent',
    type: 'string',
    description: 'Client user agent string',
    examples: [
      'userAgent.contains("kubectl")',
      'userAgent.startsWith("Mozilla")'
    ]
  },
  {
    name: 'sourceIPs',
    type: 'array',
    description: 'Source IP addresses',
    examples: [
      'sourceIPs.exists(ip, ip.startsWith("10."))'
    ]
  },
  {
    name: 'stageTimestamp',
    type: 'timestamp',
    description: 'Event timestamp',
    examples: [
      'stageTimestamp >= timestamp("2024-01-01T00:00:00Z")',
      'stageTimestamp <= timestamp("2024-12-31T23:59:59Z")'
    ]
  },

  // Nested objectRef fields (use dot notation)
  {
    name: 'objectRef.namespace',
    type: 'string',
    description: 'Kubernetes namespace of the resource',
    examples: [
      'objectRef.namespace == "production"',
      'objectRef.namespace in ["prod", "staging"]'
    ]
  },
  {
    name: 'objectRef.resource',
    type: 'string',
    description: 'Resource type (pods, deployments, secrets, etc.)',
    examples: [
      'objectRef.resource == "secrets"',
      'objectRef.resource in ["secrets", "configmaps"]'
    ]
  },
  {
    name: 'objectRef.name',
    type: 'string',
    description: 'Name of the resource',
    examples: [
      'objectRef.name == "my-secret"',
      'objectRef.name.startsWith("prod-")'
    ]
  },
  {
    name: 'objectRef.uid',
    type: 'string',
    description: 'UID of the resource',
    examples: [
      'objectRef.uid == "abc-123-def-456"'
    ]
  },
  {
    name: 'objectRef.apiGroup',
    type: 'string',
    description: 'API group of the resource',
    examples: [
      'objectRef.apiGroup == "apps"',
      'objectRef.apiGroup == ""'
    ]
  },

  // Nested user fields (use dot notation)
  {
    name: 'user.username',
    type: 'string',
    description: 'Username who performed the action',
    examples: [
      'user.username.startsWith("system:")',
      'user.username.contains("admin")',
      'user.username == "kubernetes-admin"'
    ]
  },
  {
    name: 'user.groups',
    type: 'array',
    description: 'User groups',
    examples: [
      'user.groups.exists(g, g == "system:masters")'
    ]
  },

  // Nested responseStatus fields (use dot notation)
  {
    name: 'responseStatus.code',
    type: 'number',
    description: 'HTTP response status code',
    examples: [
      'responseStatus.code >= 400',
      'responseStatus.code == 200',
      'responseStatus.code >= 200 && responseStatus.code < 300'
    ]
  }
];
