import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActivityApiClient } from '../api/client';
import type { FacetValue } from '../types/activity';

/**
 * Time range for facet queries
 */
export interface AuditLogTimeRange {
  start: string;
  end: string;
}

/**
 * Result returned by the useAuditLogFacets hook
 */
export interface UseAuditLogFacetsResult {
  /** Distinct verbs (actions) with counts */
  verbs: FacetValue[];
  /** Distinct resource types with counts */
  resources: FacetValue[];
  /** Distinct namespaces with counts */
  namespaces: FacetValue[];
  /** Distinct usernames with counts */
  usernames: FacetValue[];
  /** Whether facets are loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Manually refresh facets */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch audit log facets for filter dropdowns
 */
export function useAuditLogFacets(
  client: ActivityApiClient,
  timeRange: AuditLogTimeRange | null
): UseAuditLogFacetsResult {
  const [verbs, setVerbs] = useState<FacetValue[]>([]);
  const [resources, setResources] = useState<FacetValue[]>([]);
  const [namespaces, setNamespaces] = useState<FacetValue[]>([]);
  const [usernames, setUsernames] = useState<FacetValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the last fetched time range to avoid redundant fetches
  const lastFetchedRef = useRef<string | null>(null);

  const fetchFacets = useCallback(async () => {
    if (!timeRange) return;

    // Create a cache key from the time range
    const cacheKey = `${timeRange.start}-${timeRange.end}`;

    // Skip if we already fetched for this time range
    if (lastFetchedRef.current === cacheKey && verbs.length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.queryAuditLogFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end,
        },
        facets: [
          { field: 'verb', limit: 20 },
          { field: 'objectRef.resource', limit: 50 },
          { field: 'objectRef.namespace', limit: 50 },
          { field: 'user.username', limit: 50 },
        ],
      });

      const facets = result.status?.facets || [];

      // Extract verbs
      const verbFacet = facets.find((f) => f.field === 'verb');
      setVerbs(verbFacet?.values || []);

      // Extract resources
      const resourceFacet = facets.find((f) => f.field === 'objectRef.resource');
      setResources(resourceFacet?.values || []);

      // Extract namespaces
      const namespaceFacet = facets.find((f) => f.field === 'objectRef.namespace');
      setNamespaces(namespaceFacet?.values || []);

      // Extract usernames
      const usernameFacet = facets.find((f) => f.field === 'user.username');
      setUsernames(usernameFacet?.values || []);

      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange, verbs.length]);

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
    verbs,
    resources,
    namespaces,
    usernames,
    isLoading,
    error,
    refresh,
  };
}
