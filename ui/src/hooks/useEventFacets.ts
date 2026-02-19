import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActivityApiClient } from '../api/client';
import type { FacetValue } from '../types';
import type { TimeRange, EventsFeedFilters } from './useEventsFeed';

/**
 * Result returned by the useEventFacets hook
 */
export interface UseEventFacetsResult {
  /** Distinct involved object kinds with counts */
  involvedKinds: FacetValue[];
  /** Distinct event reasons with counts */
  reasons: FacetValue[];
  /** Distinct event types with counts */
  eventTypes: FacetValue[];
  /** Distinct source components with counts */
  sourceComponents: FacetValue[];
  /** Distinct namespaces with counts */
  namespaces: FacetValue[];
  /** Whether facets are loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Manually refresh facets */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch Kubernetes event facets for filter dropdowns.
 * Results are cached based on time range to avoid redundant fetches.
 */
export function useEventFacets(
  client: ActivityApiClient,
  timeRange: TimeRange,
  _filters: EventsFeedFilters = {} // Reserved for future filtering
): UseEventFacetsResult {
  const [involvedKinds, setInvolvedKinds] = useState<FacetValue[]>([]);
  const [reasons, setReasons] = useState<FacetValue[]>([]);
  const [eventTypes, setEventTypes] = useState<FacetValue[]>([]);
  const [sourceComponents, setSourceComponents] = useState<FacetValue[]>([]);
  const [namespaces, setNamespaces] = useState<FacetValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the last fetched parameters to avoid redundant fetches
  const lastFetchedRef = useRef<string | null>(null);

  const fetchFacets = useCallback(async () => {
    // Create a cache key from time range
    const cacheKey = `${timeRange.start}-${timeRange.end || 'now'}`;

    // Skip if we already fetched for these parameters
    if (lastFetchedRef.current === cacheKey) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.queryEventFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end,
        },
        facets: [
          { field: 'involvedObject.kind', limit: 50 },
          { field: 'reason', limit: 50 },
          { field: 'type', limit: 10 },
          { field: 'source.component', limit: 50 },
          { field: 'namespace', limit: 50 },
        ],
      });

      const facets = result.status?.facets || [];

      // Extract involved object kinds
      const kindFacet = facets.find((f) => f.field === 'involvedObject.kind');
      setInvolvedKinds(kindFacet?.values || []);

      // Extract event reasons
      const reasonFacet = facets.find((f) => f.field === 'reason');
      setReasons(reasonFacet?.values || []);

      // Extract event types
      const typeFacet = facets.find((f) => f.field === 'type');
      setEventTypes(typeFacet?.values || []);

      // Extract source components
      const componentFacet = facets.find((f) => f.field === 'source.component');
      setSourceComponents(componentFacet?.values || []);

      // Extract namespaces
      const namespaceFacet = facets.find((f) => f.field === 'namespace');
      setNamespaces(namespaceFacet?.values || []);

      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange.start, timeRange.end]);

  // Fetch on mount and when time range changes
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);

  // Force refresh function that bypasses cache
  const refresh = useCallback(async () => {
    lastFetchedRef.current = null;
    await fetchFacets();
  }, [fetchFacets]);

  return {
    involvedKinds,
    reasons,
    eventTypes,
    sourceComponents,
    namespaces,
    isLoading,
    error,
    refresh,
  };
}
