import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActivityApiClient } from '../api/client';
import type { FacetValue } from '../types/activity';
import type { TimeRange, ActivityFeedFilters } from './useActivityFeed';

/**
 * Build CEL filter expression from filter options for facet queries.
 * This allows facet dropdowns to show only values relevant to the current filter selection.
 */
function buildFacetFilter(filters: ActivityFeedFilters): string | undefined {
  const conditions: string[] = [];

  // Change source filter
  if (filters.changeSource && filters.changeSource !== 'all') {
    conditions.push(`spec.changeSource == "${filters.changeSource}"`);
  }

  // Resource UID filter (for resource-specific views)
  if (filters.resourceUid) {
    conditions.push(`spec.resource.uid == "${filters.resourceUid}"`);
  }

  // Resource kinds filter (multi-select)
  if (filters.resourceKinds && filters.resourceKinds.length > 0) {
    if (filters.resourceKinds.length === 1) {
      conditions.push(`spec.resource.kind == "${filters.resourceKinds[0]}"`);
    } else {
      const kindConditions = filters.resourceKinds.map((k) => `spec.resource.kind == "${k}"`);
      conditions.push(`(${kindConditions.join(' || ')})`);
    }
  }

  // Actor names filter (multi-select)
  if (filters.actorNames && filters.actorNames.length > 0) {
    if (filters.actorNames.length === 1) {
      conditions.push(`spec.actor.name == "${filters.actorNames[0]}"`);
    } else {
      const actorConditions = filters.actorNames.map((a) => `spec.actor.name == "${a}"`);
      conditions.push(`(${actorConditions.join(' || ')})`);
    }
  }

  // API groups filter (multi-select)
  if (filters.apiGroups && filters.apiGroups.length > 0) {
    if (filters.apiGroups.length === 1) {
      conditions.push(`spec.resource.apiGroup == "${filters.apiGroups[0]}"`);
    } else {
      const groupConditions = filters.apiGroups.map((g) => `spec.resource.apiGroup == "${g}"`);
      conditions.push(`(${groupConditions.join(' || ')})`);
    }
  }

  // Resource namespaces filter (multi-select)
  if (filters.resourceNamespaces && filters.resourceNamespaces.length > 0) {
    if (filters.resourceNamespaces.length === 1) {
      conditions.push(`spec.resource.namespace == "${filters.resourceNamespaces[0]}"`);
    } else {
      const nsConditions = filters.resourceNamespaces.map((ns) => `spec.resource.namespace == "${ns}"`);
      conditions.push(`(${nsConditions.join(' || ')})`);
    }
  }

  // Custom CEL filter
  if (filters.customFilter) {
    conditions.push(`(${filters.customFilter})`);
  }

  return conditions.length > 0 ? conditions.join(' && ') : undefined;
}

/**
 * Result returned by the useFacets hook
 */
export interface UseFacetsResult {
  /** Distinct resource kinds with counts */
  resourceKinds: FacetValue[];
  /** Distinct actor names with counts */
  actorNames: FacetValue[];
  /** Distinct API groups with counts */
  apiGroups: FacetValue[];
  /** Distinct resource namespaces with counts */
  resourceNamespaces: FacetValue[];
  /** Whether facets are loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Manually refresh facets */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch activity facets for filter dropdowns.
 * When filters are provided, facet results are narrowed to show only
 * values relevant to the current filter selection.
 */
export function useFacets(
  client: ActivityApiClient,
  timeRange: TimeRange,
  filters: ActivityFeedFilters = {}
): UseFacetsResult {
  const [resourceKinds, setResourceKinds] = useState<FacetValue[]>([]);
  const [actorNames, setActorNames] = useState<FacetValue[]>([]);
  const [apiGroups, setApiGroups] = useState<FacetValue[]>([]);
  const [resourceNamespaces, setResourceNamespaces] = useState<FacetValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the last fetched parameters to avoid redundant fetches
  const lastFetchedRef = useRef<string | null>(null);

  const fetchFacets = useCallback(async () => {
    // Build filter from current filter state
    const filter = buildFacetFilter(filters);

    // Create a cache key from time range and filter
    const cacheKey = `${timeRange.start}-${timeRange.end || 'now'}-${filter || ''}`;

    // Skip if we already fetched for these parameters
    if (lastFetchedRef.current === cacheKey) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.queryFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end,
        },
        filter,
        facets: [
          { field: 'spec.resource.kind', limit: 50 },
          { field: 'spec.actor.name', limit: 50 },
          { field: 'spec.resource.apiGroup', limit: 50 },
          { field: 'spec.resource.namespace', limit: 50 },
        ],
      });

      const facets = result.status?.facets || [];

      // Extract resource kinds
      const kindFacet = facets.find((f) => f.field === 'spec.resource.kind');
      setResourceKinds(kindFacet?.values || []);

      // Extract actor names
      const actorFacet = facets.find((f) => f.field === 'spec.actor.name');
      setActorNames(actorFacet?.values || []);

      // Extract API groups
      const apiGroupFacet = facets.find((f) => f.field === 'spec.resource.apiGroup');
      setApiGroups(apiGroupFacet?.values || []);

      // Extract resource namespaces
      const namespaceFacet = facets.find((f) => f.field === 'spec.resource.namespace');
      setResourceNamespaces(namespaceFacet?.values || []);

      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange.start, timeRange.end, filters]);

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
    resourceKinds,
    actorNames,
    apiGroups,
    resourceNamespaces,
    isLoading,
    error,
    refresh,
  };
}
