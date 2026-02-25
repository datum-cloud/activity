import { useEffect, useRef, useCallback } from 'react';
import type { K8sEvent } from '../types/k8s-event';
import type {
  EventsFeedFilters as FilterState,
  TimeRange,
} from '../hooks/useEventsFeed';
import { useEventsFeed } from '../hooks/useEventsFeed';
import { EventFeedItem } from './EventFeedItem';
import { EventsFeedFilters } from './EventsFeedFilters';
import { ActivityApiClient } from '../api/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

export interface EventsFeedProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Initial filter settings */
  initialFilters?: FilterState;
  /** Initial time range */
  initialTimeRange?: TimeRange;
  /** Number of items per page */
  pageSize?: number;
  /** Handler called when an event is clicked */
  onEventClick?: (event: K8sEvent) => void;
  /** Whether to show in compact mode (for resource detail tabs) */
  compact?: boolean;
  /** Filter to a specific namespace */
  namespace?: string;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Enable infinite scroll (default: true) */
  infiniteScroll?: boolean;
  /** Threshold in pixels for triggering load more (default: 200) */
  loadMoreThreshold?: number;
  /** Enable real-time streaming (default: false) */
  enableStreaming?: boolean;
}

/**
 * EventsFeed displays a chronological list of Kubernetes events with filtering and pagination.
 * Supports optional real-time streaming of new events.
 */
export function EventsFeed({
  client,
  initialFilters = {},
  initialTimeRange = { start: 'now-24h' },
  pageSize = 50,
  onEventClick,
  compact = false,
  namespace,
  showFilters = true,
  className = '',
  infiniteScroll = true,
  loadMoreThreshold = 200,
  enableStreaming = false,
}: EventsFeedProps) {
  // Merge namespace into initial filters if provided
  const mergedInitialFilters: FilterState = {
    ...initialFilters,
  };

  const {
    events,
    isLoading,
    error,
    hasMore,
    filters,
    timeRange,
    refresh,
    loadMore,
    setFilters,
    setTimeRange,
    isStreaming,
    startStreaming,
    stopStreaming,
    newEventsCount,
  } = useEventsFeed({
    client,
    initialFilters: mergedInitialFilters,
    initialTimeRange,
    pageSize,
    namespace,
    enableStreaming,
    autoStartStreaming: true,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  // Store the latest loadMore function in a ref to avoid observer re-subscription
  const loadMoreRef = useRef(loadMore);

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
    if (!infiniteScroll || !loadMoreTriggerRef.current) return;

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
        rootMargin: `${loadMoreThreshold}px`,
        threshold: 0,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [infiniteScroll, hasMore, isLoading, loadMoreThreshold]);

  // Handle filter changes - refresh is automatic via the hook
  const handleFiltersChange = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Handle time range changes - refresh is automatic via the hook
  const handleTimeRangeChange = useCallback(
    (newTimeRange: TimeRange) => {
      setTimeRange(newTimeRange);
    },
    [setTimeRange]
  );

  // Handle manual load more click
  const handleLoadMoreClick = useCallback(() => {
    loadMore();
  }, [loadMore]);

  // Handle streaming toggle
  const handleStreamingToggle = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);

  // Build container classes
  const containerClasses = compact
    ? `p-3 shadow-none border-border ${className}`
    : `p-4 ${className}`;

  // Build list classes
  const listClasses = compact
    ? 'max-h-[40vh] overflow-y-auto pr-2'
    : 'max-h-[70vh] overflow-y-auto pr-2';

  return (
    <Card className={containerClasses}>
      {/* Header with streaming status */}
      {enableStreaming && (
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground m-0">Events Feed</h3>
            {isStreaming && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400"></span>
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            )}
            {newEventsCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{newEventsCount} new
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStreamingToggle}
            className="text-xs h-7"
          >
            {isStreaming ? (
              <>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" fill="currentColor" />
                </svg>
                Resume
              </>
            )}
          </Button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <EventsFeedFilters
          client={client}
          filters={filters}
          timeRange={timeRange}
          onFiltersChange={handleFiltersChange}
          onTimeRangeChange={handleTimeRangeChange}
          disabled={isLoading}
          namespace={namespace}
        />
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-2 flex justify-between items-center gap-4 py-2">
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

      {/* Event List */}
      <div className={listClasses} ref={scrollContainerRef}>
        {events.length === 0 && !isLoading && (
          <div className="py-8 text-center text-muted-foreground">
            <p className="m-0">No events found</p>
            <p className="text-sm text-muted-foreground mt-1 m-0">
              Try adjusting your filters or time range
            </p>
          </div>
        )}

        {events.map((event, index) => (
          <EventFeedItem
            key={event.metadata?.uid || event.metadata?.name}
            event={event}
            onEventClick={onEventClick}
            compact={compact}
            isNew={enableStreaming && index < newEventsCount}
          />
        ))}

        {/* Load More Trigger for Infinite Scroll */}
        {infiniteScroll && hasMore && (
          <div ref={loadMoreTriggerRef} className="h-px mt-2" />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
            <div className="w-4 h-4 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
            <span>Loading events...</span>
          </div>
        )}

        {/* Load More Button (when infinite scroll is disabled) */}
        {!infiniteScroll && hasMore && !isLoading && (
          <div className="flex justify-center p-2 mt-2">
            <Button onClick={handleLoadMoreClick}>
              Load more
            </Button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && events.length > 0 && !isLoading && (
          <div className="text-center py-3 text-muted-foreground text-sm border-t border-border mt-2">
            No more events to load
          </div>
        )}
      </div>
    </Card>
  );
}
