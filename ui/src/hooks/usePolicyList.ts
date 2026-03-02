import { useState, useCallback, useMemo } from 'react';
import type { ActivityPolicy, PolicyGroup } from '../types/policy';
import { ActivityApiClient } from '../api/client';

/**
 * Options for the usePolicyList hook
 */
export interface UsePolicyListOptions {
  /** API client instance */
  client: ActivityApiClient;
  /** Whether to group policies by API group (default: true) */
  groupByApiGroup?: boolean;
}

/**
 * Result returned by the usePolicyList hook
 */
export interface UsePolicyListResult {
  /** List of all policies */
  policies: ActivityPolicy[];
  /** Policies grouped by API group */
  groups: PolicyGroup[];
  /** Whether the list is loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Reload the policy list */
  refresh: () => Promise<void>;
  /** Delete a policy by name */
  deletePolicy: (name: string) => Promise<void>;
  /** Whether a delete is in progress */
  isDeleting: boolean;
}

/**
 * Group policies by their API group
 */
function groupPoliciesByApiGroup(policies: ActivityPolicy[]): PolicyGroup[] {
  const groupMap = new Map<string, ActivityPolicy[]>();

  for (const policy of policies) {
    const apiGroup = policy.spec.resource.apiGroup || '(core)';
    const existing = groupMap.get(apiGroup) || [];
    existing.push(policy);
    groupMap.set(apiGroup, existing);
  }

  // Sort groups by API group name
  const sortedGroups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([apiGroup, policies]) => ({
      apiGroup,
      // Sort policies by kind, then by name
      policies: policies.sort((a, b) => {
        const kindCompare = a.spec.resource.kind.localeCompare(b.spec.resource.kind);
        if (kindCompare !== 0) return kindCompare;
        return (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
      }),
    }));

  return sortedGroups;
}

/**
 * React hook for managing the policy list
 */
export function usePolicyList({
  client,
  groupByApiGroup = true,
}: UsePolicyListOptions): UsePolicyListResult {
  const [policies, setPolicies] = useState<ActivityPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Compute grouped policies
  const groups = useMemo(() => {
    if (!groupByApiGroup) {
      return [{ apiGroup: 'All Policies', policies }];
    }
    return groupPoliciesByApiGroup(policies);
  }, [policies, groupByApiGroup]);

  // Fetch all policies
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.listPolicies();
      setPolicies(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Delete a policy and refresh the list
  const deletePolicy = useCallback(
    async (name: string) => {
      setIsDeleting(true);
      setError(null);

      try {
        await client.deletePolicy(name);
        // Remove from local state immediately for responsiveness
        setPolicies((prev) => prev.filter((p) => p.metadata?.name !== name));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err; // Re-throw so caller can handle
      } finally {
        setIsDeleting(false);
      }
    },
    [client]
  );

  return {
    policies,
    groups,
    isLoading,
    error,
    refresh,
    deletePolicy,
    isDeleting,
  };
}
