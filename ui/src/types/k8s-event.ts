/**
 * TypeScript types for Kubernetes Events (core/v1.Event)
 * Exposed via the Activity API (activity.miloapis.com/v1alpha1)
 */

import type { ObjectMeta } from './index';
import type { FacetSpec, FacetResult } from './activity';

/**
 * Event types in Kubernetes
 */
export type K8sEventType = 'Normal' | 'Warning';

/**
 * Object reference for the regarding/related object
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
 * Event series information (for aggregated events)
 */
export interface EventSeries {
  /** Number of occurrences in this series */
  count?: number;
  /** Time of the last occurrence observed */
  lastObservedTime?: string;
}

/**
 * Kubernetes Event (events.k8s.io/v1)
 * This is the newer events API that replaces core/v1.Event
 */
export interface K8sEvent {
  apiVersion: 'events.k8s.io/v1';
  kind: 'Event';
  metadata: ObjectMeta;
  /** Object this event is about (was involvedObject in core/v1) */
  regarding: ObjectReference;
  /** Optional secondary object for more complex actions */
  related?: ObjectReference;
  /** Short, machine-understandable string that gives the reason for the event */
  reason?: string;
  /** Human-readable description of the event (was message in core/v1) */
  note?: string;
  /** Type of this event (Normal, Warning) */
  type?: K8sEventType;
  /** Time when this Event was first observed (replaces firstTimestamp) */
  eventTime?: string;
  /** What action was taken/failed regarding the object */
  action?: string;
  /** Name of the controller that emitted this event (was source.component in core/v1) */
  reportingController?: string;
  /** ID of the controller instance (was source.host in core/v1) */
  reportingInstance?: string;
  /** Data about the Event series this event represents (was count/firstTimestamp/lastTimestamp) */
  series?: EventSeries;

  // Deprecated fields from core/v1.Event (for backward compatibility during migration)
  /** @deprecated Use regarding instead */
  involvedObject?: ObjectReference;
  /** @deprecated Use note instead */
  message?: string;
  /** @deprecated Use reportingController instead */
  source?: {
    component?: string;
    host?: string;
  };
  /** @deprecated Use series.count instead */
  count?: number;
  /** @deprecated Use eventTime instead */
  firstTimestamp?: string;
  /** @deprecated Use series.lastObservedTime instead */
  lastTimestamp?: string;
  /** @deprecated Use reportingController instead */
  reportingComponent?: string;
}

/**
 * EventRecord represents a Kubernetes Event returned in EventQuery results.
 * This is a wrapper type that embeds the events.k8s.io/v1 Event to avoid
 * OpenAPI GVK conflicts while preserving full event data.
 */
export interface EventRecord {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventRecord';
  metadata: ObjectMeta;
  /** Event contains the full Kubernetes Event data in events.k8s.io/v1 format */
  event: K8sEvent;
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
 * These map to field selectors supported by the API (core/v1 Event)
 */
export const EVENT_FILTER_FIELDS: EventFilterField[] = [
  {
    name: 'involvedObject.kind',
    type: 'string',
    description: 'Kind of the object this event is about',
    examples: [
      'involvedObject.kind=Pod',
      'involvedObject.kind=Deployment',
    ],
  },
  {
    name: 'involvedObject.name',
    type: 'string',
    description: 'Name of the object this event is about',
    examples: [
      'involvedObject.name=my-pod',
    ],
  },
  {
    name: 'involvedObject.namespace',
    type: 'string',
    description: 'Namespace of the object this event is about',
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
    description: 'Component that generated the event',
    examples: [
      'source.component=kubelet',
      'source.component=kube-scheduler',
    ],
  },
  {
    name: 'metadata.namespace',
    type: 'string',
    description: 'Namespace of the event',
    examples: [
      'metadata.namespace=kube-system',
    ],
  },
];

/**
 * Event facet fields available for querying
 * These are the fields supported by EventFacetQuery (core/v1 Event)
 */
export const EVENT_FACET_FIELDS = [
  'involvedObject.kind',
  'involvedObject.namespace',
  'reason',
  'type',
  'source.component',
  'metadata.namespace',
] as const;

export type EventFacetField = typeof EVENT_FACET_FIELDS[number];

/**
 * Extract K8sEvent from EventRecord or pass through if already a K8sEvent.
 * Use this helper when you need to handle both EventRecord (from EventQuery)
 * and K8sEvent (from live events API).
 */
export function extractEvent(eventOrRecord: K8sEvent | EventRecord): K8sEvent {
  // Check if this is an EventRecord by looking for the nested 'event' field
  if ('event' in eventOrRecord && eventOrRecord.kind === 'EventRecord') {
    return (eventOrRecord as EventRecord).event;
  }
  // Already a K8sEvent
  return eventOrRecord as K8sEvent;
}

/**
 * Check if an object is an EventRecord (vs a plain K8sEvent)
 */
export function isEventRecord(obj: K8sEvent | EventRecord): obj is EventRecord {
  return obj.kind === 'EventRecord' && 'event' in obj;
}

/**
 * EventQuery request spec for querying historical events from ClickHouse
 */
export interface EventQuerySpec {
  /** Start of time range (RFC3339 or relative like "now-7d") */
  startTime: string;
  /** End of time range (RFC3339 or relative, default: now) */
  endTime: string;
  /** Namespace to filter events (optional) */
  namespace?: string;
  /** Field selector for filtering (standard Kubernetes syntax) */
  fieldSelector?: string;
  /** Maximum results per page (default: 100, max: 1000) */
  limit?: number;
  /** Pagination cursor */
  continue?: string;
}

/**
 * EventQuery status with results
 */
export interface EventQueryStatus {
  /** Matching events as EventRecord objects */
  results: EventRecord[];
  /** Pagination cursor for next page */
  continue?: string;
  /** Actual start time used (RFC3339) */
  effectiveStartTime?: string;
  /** Actual end time used (RFC3339) */
  effectiveEndTime?: string;
}

/**
 * EventQuery resource for querying historical events
 * Unlike the live events API (limited to 24h), EventQuery supports up to 60 days of history
 */
export interface EventQuery {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventQuery';
  metadata?: ObjectMeta;
  spec: EventQuerySpec;
  status?: EventQueryStatus;
}
