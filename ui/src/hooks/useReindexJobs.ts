import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReindexJob, ReindexJobListResource } from '../types/reindex';
import type { WatchEvent } from '../types/activity';
import { ActivityApiClient } from '../api/client';

/**
 * Options for the useReindexJobs hook
 */
export interface UseReindexJobsOptions {
  /** API client instance */
  client: ActivityApiClient;
  /** Whether to watch for real-time updates (default: true) */
  watch?: boolean;
  /** Whether to auto-refresh on mount (default: true) */
  autoRefresh?: boolean;
}

/**
 * Result returned by the useReindexJobs hook
 */
export interface UseReindexJobsResult {
  /** List of all reindex jobs */
  jobs: ReindexJob[];
  /** Whether the list is loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Reload the job list */
  refresh: () => Promise<void>;
  /** Delete a job by name */
  deleteJob: (name: string) => Promise<void>;
  /** Whether a delete is in progress */
  isDeleting: boolean;
  /** Whether watching is active */
  isWatching: boolean;
}

/**
 * React hook for managing ReindexJobs with optional real-time watching
 */
export function useReindexJobs({
  client,
  watch = true,
  autoRefresh = true,
}: UseReindexJobsOptions): UseReindexJobsResult {
  const [jobs, setJobs] = useState<ReindexJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchStopRef = useRef<(() => void) | null>(null);
  const resourceVersionRef = useRef<string | undefined>(undefined);

  // Fetch all jobs
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result: ReindexJobListResource = await client.listReindexJobs();
      setJobs(result.items || []);
      // Store resource version for watch resumption
      if (result.metadata?.resourceVersion) {
        resourceVersionRef.current = result.metadata.resourceVersion;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Delete a job and refresh the list
  const deleteJob = useCallback(
    async (name: string) => {
      setIsDeleting(true);
      setError(null);

      try {
        await client.deleteReindexJob(name);
        // Remove from local state immediately for responsiveness
        setJobs((prev) => prev.filter((j) => j.metadata?.name !== name));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err; // Re-throw so caller can handle
      } finally {
        setIsDeleting(false);
      }
    },
    [client]
  );

  // Start watching for updates
  const startWatch = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
    }

    setIsWatching(true);

    const { stop } = client.watchReindexJobs({
      resourceVersion: resourceVersionRef.current,
      onEvent: (event: WatchEvent<ReindexJob>) => {
        const job = event.object;
        const name = job.metadata?.name;

        if (!name) return;

        setJobs((prev) => {
          // Update resource version
          if (job.metadata?.resourceVersion) {
            resourceVersionRef.current = job.metadata.resourceVersion;
          }

          switch (event.type) {
            case 'ADDED':
              // Add if not exists
              if (prev.find((j) => j.metadata?.name === name)) {
                return prev;
              }
              return [...prev, job];

            case 'MODIFIED':
              // Update existing
              return prev.map((j) => (j.metadata?.name === name ? job : j));

            case 'DELETED':
              // Remove from list
              return prev.filter((j) => j.metadata?.name !== name);

            default:
              return prev;
          }
        });
      },
      onError: (err: Error) => {
        console.error('Watch error:', err);
        setIsWatching(false);
        // Try to reconnect after a delay
        setTimeout(() => {
          if (watch) {
            startWatch();
          }
        }, 5000);
      },
      onClose: () => {
        setIsWatching(false);
      },
    });

    watchStopRef.current = stop;
  }, [client, watch]);

  // Initial load and watch setup
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }

    // Start watching if enabled
    if (watch) {
      // Wait for initial load to complete before watching
      const timer = setTimeout(() => {
        startWatch();
      }, 1000);

      return () => {
        clearTimeout(timer);
        if (watchStopRef.current) {
          watchStopRef.current();
          watchStopRef.current = null;
        }
      };
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchStopRef.current) {
        watchStopRef.current();
        watchStopRef.current = null;
      }
    };
  }, []);

  return {
    jobs,
    isLoading,
    error,
    refresh,
    deleteJob,
    isDeleting,
    isWatching,
  };
}
