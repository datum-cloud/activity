/**
 * URL State Management Utilities
 *
 * Provides functions to serialize and deserialize filter state and time ranges
 * to/from URL query parameters for deep linking and bookmarkability.
 */

/**
 * Serialize an array to comma-separated string
 */
function serializeArray(arr: string[] | undefined): string | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr.join(',');
}

/**
 * Deserialize comma-separated string to array
 */
function deserializeArray(str: string | null): string[] | undefined {
  if (!str) return undefined;
  return str.split(',').filter(Boolean);
}

/**
 * Activity Feed Filter State
 */
export interface ActivityFeedUrlState {
  changeSource?: string;
  search?: string;
  resourceKinds?: string[];
  actorNames?: string[];
  apiGroups?: string[];
  resourceNamespaces?: string[];
  resourceName?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * Events Feed Filter State
 */
export interface EventsFeedUrlState {
  eventType?: string;
  search?: string;
  involvedKinds?: string[];
  reasons?: string[];
  namespaces?: string[];
  sourceComponents?: string[];
  involvedName?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * Serialize activity feed state to URLSearchParams
 */
export function serializeActivityState(state: ActivityFeedUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.changeSource && state.changeSource !== 'all') {
    params.set('changeSource', state.changeSource);
  }
  if (state.search) {
    params.set('search', state.search);
  }
  if (state.resourceKinds) {
    const serialized = serializeArray(state.resourceKinds);
    if (serialized) params.set('resourceKinds', serialized);
  }
  if (state.actorNames) {
    const serialized = serializeArray(state.actorNames);
    if (serialized) params.set('actorNames', serialized);
  }
  if (state.apiGroups) {
    const serialized = serializeArray(state.apiGroups);
    if (serialized) params.set('apiGroups', serialized);
  }
  if (state.resourceNamespaces) {
    const serialized = serializeArray(state.resourceNamespaces);
    if (serialized) params.set('resourceNamespaces', serialized);
  }
  if (state.resourceName) {
    params.set('resourceName', state.resourceName);
  }
  if (state.startTime) {
    params.set('startTime', state.startTime);
  }
  if (state.endTime) {
    params.set('endTime', state.endTime);
  }

  return params;
}

/**
 * Deserialize activity feed state from URLSearchParams
 */
export function deserializeActivityState(searchParams: URLSearchParams): ActivityFeedUrlState {
  return {
    changeSource: searchParams.get('changeSource') || undefined,
    search: searchParams.get('search') || undefined,
    resourceKinds: deserializeArray(searchParams.get('resourceKinds')),
    actorNames: deserializeArray(searchParams.get('actorNames')),
    apiGroups: deserializeArray(searchParams.get('apiGroups')),
    resourceNamespaces: deserializeArray(searchParams.get('resourceNamespaces')),
    resourceName: searchParams.get('resourceName') || undefined,
    startTime: searchParams.get('startTime') || undefined,
    endTime: searchParams.get('endTime') || undefined,
  };
}

/**
 * Serialize events feed state to URLSearchParams
 */
export function serializeEventsState(state: EventsFeedUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.eventType && state.eventType !== 'all') {
    params.set('eventType', state.eventType);
  }
  if (state.search) {
    params.set('search', state.search);
  }
  if (state.involvedKinds) {
    const serialized = serializeArray(state.involvedKinds);
    if (serialized) params.set('involvedKinds', serialized);
  }
  if (state.reasons) {
    const serialized = serializeArray(state.reasons);
    if (serialized) params.set('reasons', serialized);
  }
  if (state.namespaces) {
    const serialized = serializeArray(state.namespaces);
    if (serialized) params.set('namespaces', serialized);
  }
  if (state.sourceComponents) {
    const serialized = serializeArray(state.sourceComponents);
    if (serialized) params.set('sourceComponents', serialized);
  }
  if (state.involvedName) {
    params.set('involvedName', state.involvedName);
  }
  if (state.startTime) {
    params.set('startTime', state.startTime);
  }
  if (state.endTime) {
    params.set('endTime', state.endTime);
  }

  return params;
}

/**
 * Deserialize events feed state from URLSearchParams
 */
export function deserializeEventsState(searchParams: URLSearchParams): EventsFeedUrlState {
  return {
    eventType: searchParams.get('eventType') || undefined,
    search: searchParams.get('search') || undefined,
    involvedKinds: deserializeArray(searchParams.get('involvedKinds')),
    reasons: deserializeArray(searchParams.get('reasons')),
    namespaces: deserializeArray(searchParams.get('namespaces')),
    sourceComponents: deserializeArray(searchParams.get('sourceComponents')),
    involvedName: searchParams.get('involvedName') || undefined,
    startTime: searchParams.get('startTime') || undefined,
    endTime: searchParams.get('endTime') || undefined,
  };
}
