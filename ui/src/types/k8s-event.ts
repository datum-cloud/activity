/**
 * TypeScript types for Kubernetes Events (core/v1.Event)
 * Exposed via the Activity API (activity.miloapis.com/v1alpha1)
 */

import type { ObjectMeta, FacetSpec, FacetResult } from './index';

/**
 * Event types in Kubernetes
 */
export type K8sEventType = 'Normal' | 'Warning';

/**
 * Object reference for the involved object
 */
export interface ObjectReference {
  apiVersion?: string;
  kind?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  resourceVersion?: string;
  fieldPath?: string;
}

/**
 * Event source information
 */
export interface EventSource {
  component?: string;
  host?: string;
}

/**
 * Kubernetes Event (core/v1.Event)
 */
export interface K8sEvent {
  apiVersion: 'v1';
  kind: 'Event';
  metadata: ObjectMeta;
  /** Object this event is about */
  involvedObject: ObjectReference;
  /** Short, machine-understandable string that gives the reason for the event */
  reason?: string;
  /** Human-readable description of the event */
  message?: string;
  /** Type of this event (Normal, Warning) */
  type?: K8sEventType;
  /** Component reporting this event */
  source?: EventSource;
  /** Number of times this event has occurred */
  count?: number;
  /** Time when this event was first recorded */
  firstTimestamp?: string;
  /** Time when this event was last recorded */
  lastTimestamp?: string;
  /** Time when this event was first observed */
  eventTime?: string;
  /** What action was taken/failed regarding the object */
  action?: string;
  /** Optional secondary object for more complex actions */
  related?: ObjectReference;
  /** Name of the controller that emitted this event */
  reportingComponent?: string;
  /** ID of the controller instance */
  reportingInstance?: string;
}

/**
 * Kubernetes Event list response with pagination
 */
export interface K8sEventList {
  apiVersion: 'v1';
  kind: 'EventList';
  metadata?: {
    continue?: string;
    resourceVersion?: string;
  };
  items: K8sEvent[];
}

/**
 * Query parameters for listing Kubernetes Events
 */
export interface K8sEventListParams {
  /** Namespace to list events from (empty for all namespaces) */
  namespace?: string;
  /** Field selector for filtering (e.g., "involvedObject.name=my-pod") */
  fieldSelector?: string;
  /** Label selector for filtering */
  labelSelector?: string;
  /** Maximum results per page */
  limit?: number;
  /** Pagination cursor */
  continue?: string;
  /** Watch for changes */
  watch?: boolean;
  /** Start Watch from this version */
  resourceVersion?: string;
}

// ============================================
// EventFacetQuery Types
// ============================================

/**
 * Event facet query request spec
 */
export interface EventFacetQuerySpec {
  /** Time range for the facet query */
  timeRange?: {
    start?: string;
    end?: string;
  };
  /** List of facets to query (1-10 facets) */
  facets: FacetSpec[];
}

/**
 * Event facet query status with results
 */
export interface EventFacetQueryStatus {
  facets: FacetResult[];
}

/**
 * Event facet query resource
 * Used to discover available filter values from actual event data
 */
export interface EventFacetQuery {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventFacetQuery';
  spec: EventFacetQuerySpec;
  status?: EventFacetQueryStatus;
}

// ============================================
// Event Filter Fields for UI Help
// ============================================

/**
 * Event filter field definition for autocomplete and help
 */
export interface EventFilterField {
  name: string;
  type: 'string' | 'enum';
  description: string;
  enumValues?: string[];
  examples?: string[];
}

/**
 * Available filter fields for Kubernetes Events
 * These map to field selectors supported by the API
 */
export const EVENT_FILTER_FIELDS: EventFilterField[] = [
  {
    name: 'involvedObject.kind',
    type: 'string',
    description: 'Kind of the involved object',
    examples: [
      'involvedObject.kind=Pod',
      'involvedObject.kind=Deployment',
    ],
  },
  {
    name: 'involvedObject.name',
    type: 'string',
    description: 'Name of the involved object',
    examples: [
      'involvedObject.name=my-pod',
    ],
  },
  {
    name: 'involvedObject.namespace',
    type: 'string',
    description: 'Namespace of the involved object',
    examples: [
      'involvedObject.namespace=default',
    ],
  },
  {
    name: 'reason',
    type: 'string',
    description: 'Event reason',
    examples: [
      'reason=Scheduled',
      'reason=Pulled',
      'reason=Created',
      'reason=Started',
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description: 'Event type',
    enumValues: ['Normal', 'Warning'],
    examples: [
      'type=Normal',
      'type=Warning',
    ],
  },
  {
    name: 'source.component',
    type: 'string',
    description: 'Source component that generated the event',
    examples: [
      'source.component=kubelet',
      'source.component=default-scheduler',
    ],
  },
  {
    name: 'namespace',
    type: 'string',
    description: 'Namespace of the event',
    examples: [
      'namespace=kube-system',
    ],
  },
];

/**
 * Event facet fields available for querying
 * These are the fields supported by EventFacetQuery
 */
export const EVENT_FACET_FIELDS = [
  'involvedObject.kind',
  'involvedObject.namespace',
  'reason',
  'type',
  'source.component',
  'namespace',
] as const;

export type EventFacetField = typeof EVENT_FACET_FIELDS[number];
