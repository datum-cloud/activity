import { useState, useEffect, useRef, useCallback } from 'react';
import { formatISO, subDays } from 'date-fns';
import { AuditLogFilters, buildAuditLogCEL, type AuditLogFilterState, type TimeRange } from './AuditLogFilters';
import { AuditLogFeedItem } from './AuditLogFeedItem';
import { useAuditLogQuery } from '../hooks/useAuditLogQuery';
import type { AuditLogQuerySpec, Event } from '../types';
import type { ActivityApiClient } from '../api/client';
import type { EffectiveTimeRangeCallback } from '../types/activity';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

// Debounce delay for filter changes (ms)
const FILTER_DEBOUNCE_MS = 300;

// Default page size for infinite scroll
const DEFAULT_PAGE_SIZE = 100;

export interface AuditLogQueryComponentProps {
  client: ActivityApiClient;
  className?: string;
  onEventSelect?: (event: Event) => void;
  initialFilters?: AuditLogFilterState;
  initialTimeRange?: TimeRange;
  /** Callback invoked when the effective time range is resolved */
  onEffectiveTimeRangeChange?: EffectiveTimeRangeCallback;
}

/**
 * Complete audit log query component with filter builder and results viewer
 */
export function AuditLogQueryComponent({
  client,
  className = '',
  onEventSelect,
  initialFilters = {},
  initialTimeRange = {
    start: formatISO(subDays(new Date(), 1)),
    end: formatISO(new Date()),
  },
  onEffectiveTimeRangeChange,
}: AuditLogQueryComponentProps) {
  const [filters, setFilters] = useState<AuditLogFilterState>(initialFilters);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);

  const { events, isLoading, error, hasMore, executeQuery, loadMore } =
    useAuditLogQuery({ client });

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Store the latest loadMore function in a ref to avoid observer re-subscription
  const loadMoreRef = useRef(loadMore);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialLoadRef = useRef(false);

  // Build query spec from current filter state
  const buildQuerySpec = useCallback((): AuditLogQuerySpec => {
    const spec: AuditLogQuerySpec = {
      filter: buildAuditLogCEL(filters) || '',
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: DEFAULT_PAGE_SIZE,
    };
    return spec;
  }, [filters, timeRange]);

  // Execute query with current filters
  const refresh = useCallback(async () => {
    const spec = buildQuerySpec();
    await executeQuery(spec);
    hasInitialLoadRef.current = true;
  }, [buildQuerySpec, executeQuery]);

  // Handle filter changes with debounced auto-refresh
  const handleFiltersChange = useCallback(
    (newFilters: AuditLogFilterState) => {
      setFilters(newFilters);

      // Cancel any pending debounced refresh
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }

      // Debounce the refresh to avoid excessive API calls
      filterDebounceRef.current = setTimeout(() => {
        filterDebounceRef.current = null;
      }, FILTER_DEBOUNCE_MS);
    },
    []
  );

  // Handle time range changes with debounced auto-refresh
  const handleTimeRangeChange = useCallback(
    (newTimeRange: TimeRange) => {
      setTimeRange(newTimeRange);

      // Cancel any pending debounced refresh
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }

      // Debounce the refresh
      filterDebounceRef.current = setTimeout(() => {
        filterDebounceRef.current = null;
      }, FILTER_DEBOUNCE_MS);
    },
    []
  );

  // Auto-refresh when filters or time range change (debounced)
  useEffect(() => {
    // Skip the initial render - we'll handle that separately
    if (!hasInitialLoadRef.current) {
      return;
    }

    // Cancel any pending refresh
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }

    // Debounce the refresh
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
      refresh();
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
  }, [filters, timeRange, refresh]);

  // Auto-execute on mount
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update the ref whenever loadMore changes
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoading) {
          // Call through the ref to always use the latest function
          loadMoreRef.current();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, []);

  return (
    <Card className={`flex flex-col p-6 ${className}`}>
      {/* Filters */}
      <AuditLogFilters
        client={client}
        filters={filters}
        timeRange={timeRange}
        onFiltersChange={handleFiltersChange}
        onTimeRangeChange={handleTimeRangeChange}
        disabled={isLoading}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-4 flex justify-between items-center gap-4">
          <AlertDescription className="text-sm">{error.message}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Loading State (initial load) */}
      {isLoading && events.length === 0 && (
        <div className="flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm">
          <div className="w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin"></div>
          <span>Searching audit logs...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && events.length === 0 && !error && (
        <div className="p-12 text-center text-muted-foreground">
          <p className="m-0">No audit events found</p>
          <p className="text-sm text-muted-foreground mt-2 m-0">
            Try adjusting your filters or time range
          </p>
        </div>
      )}

      {/* Event List with Infinite Scroll */}
      {events.length > 0 && (
        <div className="max-h-[70vh] overflow-y-auto pr-2" ref={scrollContainerRef}>
          {events.map((event, index) => (
            <AuditLogFeedItem
              key={event.auditID || `event-${index}`}
              event={event}
              onEventClick={onEventSelect}
            />
          ))}

          {/* Load More Trigger for Infinite Scroll */}
          {hasMore && <div ref={loadMoreTriggerRef} className="h-px mt-4" />}

          {/* Loading Indicator (pagination) */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm">
              <div className="w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin"></div>
              <span>Loading more events...</span>
            </div>
          )}

          {/* End of Results */}
          {!hasMore && events.length > 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground text-sm border-t border-border mt-4">
              End of results
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
