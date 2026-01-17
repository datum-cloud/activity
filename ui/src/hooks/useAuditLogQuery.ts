import { useState, useCallback } from 'react';
import type { AuditLogQuery, AuditLogQuerySpec, Event } from '../types';
import { ActivityApiClient } from '../api/client';

export interface UseAuditLogQueryOptions {
  client: ActivityApiClient;
  autoExecute?: boolean;
}

export interface UseAuditLogQueryResult {
  query: AuditLogQuery | null;
  events: Event[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  executeQuery: (spec: AuditLogQuerySpec) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

/**
 * React hook for executing audit log queries
 */
export function useAuditLogQuery({
  client,
  autoExecute = false,
}: UseAuditLogQueryOptions): UseAuditLogQueryResult {
  const [query, setQuery] = useState<AuditLogQuery | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSpec, setCurrentSpec] = useState<AuditLogQuerySpec | null>(null);

  const executeQuery = useCallback(
    async (spec: AuditLogQuerySpec) => {
      setIsLoading(true);
      setError(null);
      setCurrentSpec(spec);

      try {
        const queryName = `query-${Date.now()}`;
        const result = await client.createQuery(queryName, spec);

        console.log('[useAuditLogQuery] Query response:', {
          resultCount: result.status?.results?.length,
          continueAfter: result.status?.continueAfter,
          phase: result.status?.phase,
        });

        setQuery(result);
        setEvents(result.status?.results || []);

        // Clean up the query resource
        try {
          await client.deleteQuery(queryName);
        } catch (e) {
          console.warn('Failed to delete query:', e);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const loadMore = useCallback(async () => {
    if (!query?.status?.continueAfter || !currentSpec) {
      console.log('[useAuditLogQuery] loadMore skipped:', {
        hasContinueAfter: !!query?.status?.continueAfter,
        hasCurrentSpec: !!currentSpec,
      });
      return;
    }

    console.log('[useAuditLogQuery] Loading more with continueAfter:', query.status.continueAfter);

    setIsLoading(true);
    setError(null);

    try {
      const nextSpec: AuditLogQuerySpec = {
        ...currentSpec,
        continueAfter: query.status.continueAfter,
      };

      const queryName = `query-${Date.now()}`;
      const result = await client.createQuery(queryName, nextSpec);

      console.log('[useAuditLogQuery] loadMore response:', {
        resultCount: result.status?.results?.length,
        continueAfter: result.status?.continueAfter,
        totalEvents: events.length + (result.status?.results?.length || 0),
      });

      setQuery(result);
      setEvents((prev) => [...prev, ...(result.status?.results || [])]);

      // Clean up the query resource
      try {
        await client.deleteQuery(queryName);
      } catch (e) {
        console.warn('Failed to delete query:', e);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, query, currentSpec, events.length]);

  const reset = useCallback(() => {
    setQuery(null);
    setEvents([]);
    setError(null);
    setCurrentSpec(null);
  }, []);

  return {
    query,
    events,
    isLoading,
    error,
    hasMore: !!query?.status?.continueAfter,
    executeQuery,
    loadMore,
    reset,
  };
}
