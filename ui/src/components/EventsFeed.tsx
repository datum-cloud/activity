import { useEffect, useRef, useCallback } from 'react';
import type { K8sEvent } from '../types/k8s-event';
import type { EffectiveTimeRangeCallback, ErrorFormatter } from '../types/activity';
import type {
  EventsFeedFilters as FilterState,
  TimeRange,
} from '../hooks/useEventsFeed';
import { useEventsFeed } from '../hooks/useEventsFeed';
import { EventFeedItem } from './EventFeedItem';
import { EventFeedItemSkeleton } from './EventFeedItemSkeleton';
import { EventsFeedFilters } from './EventsFeedFilters';
import { ActivityApiClient } from '../api/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ApiErrorAlert } from './ApiErrorAlert';

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
  /** Handler called when a resource name is clicked. If provided, resource names become clickable. */
  onResourceClick?: (resource: {
    kind: string;
    name: string;
    namespace?: string;
    uid?: string;
  }) => void;
  /** Whether to show in compact mode (for resource detail tabs) */
  compact?: boolean;
  /** Filter to a specific namespace */
  namespace?: string;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Filters that should be locked and hidden from the UI (programmatically set by parent) */
  hiddenFilters?: Array<'involvedKinds' | 'reasons' | 'namespaces' | 'sourceComponents' | 'involvedName' | 'eventType'>;
  /** Additional CSS class */
  className?: string;
  /** Enable infinite scroll (default: true) */
  infiniteScroll?: boolean;
  /** Threshold in pixels for triggering load more (default: 200) */
  loadMoreThreshold?: number;
  /** Enable real-time streaming (default: false) */
  enableStreaming?: boolean;
  /** Callback invoked when the effective time range is resolved */
  onEffectiveTimeRangeChange?: EffectiveTimeRangeCallback;
  /** Custom error formatter for customizing error messages */
  errorFormatter?: ErrorFormatter;
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
  onResourceClick,
  compact = false,
  namespace,
  showFilters = true,
  hiddenFilters = [],
  className = '',
  infiniteScroll = true,
  loadMoreThreshold = 200,
  enableStreaming = false,
  onEffectiveTimeRangeChange,
  errorFormatter,
}: EventsFeedProps) {
  // Merge namespace into initial filters if provided
  const mergedInitialFilters: FilterState = {
    ...initialFilters,
  };

  const {
    events,
    isLoading,
    isRefreshing,
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

  // Build container classes - use flex layout to properly fill available space
  // flex-1 min-h-0 allows the Card to fill parent flex container and enable child scrolling
  const containerClasses = compact
    ? `flex-1 min-h-0 flex flex-col p-2 shadow-none border-border ${className}`
    : `flex-1 min-h-0 flex flex-col p-3 ${className}`;

  // Build list classes - use flex-1 min-h-0 for flex-based scrolling
  const listClasses = 'flex-1 min-h-0 overflow-y-auto pr-2';

  return (
    <Card className={containerClasses}>
      {/* Header with streaming status */}
      {enableStreaming && (
        <div className="flex items-center justify-between mb-1 pb-0.5 border-b border-border">
          <div className="flex items-center gap-2">
            {isStreaming && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400"></span>
                </span>
                <span className="text-xs text-muted-foreground">Streaming events...</span>
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
          hiddenFilters={hiddenFilters}
        />
      )}

      {/* Error Display */}
      <ApiErrorAlert error={error} onRetry={refresh} className="mb-4" errorFormatter={errorFormatter} />

      {/* Event List */}
      <div className={listClasses} ref={scrollContainerRef}>
        {/* Skeleton Loading State - show when loading/refreshing and no items yet */}
        {(isLoading || isRefreshing) && events.length === 0 && (
          <>
            {Array.from({ length: 8 }).map((_, index) => (
              <EventFeedItemSkeleton key={index} compact={compact} />
            ))}
          </>
        )}

        {/* Empty State - only show when not loading/refreshing */}
        {!isLoading && !isRefreshing && events.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="m-0">No events found</p>
            <p className="text-sm text-muted-foreground mt-2 m-0">
              Try adjusting your filters or time range
            </p>
          </div>
        )}

        {events.map((event, index) => (
          <EventFeedItem
            key={event.metadata?.uid || event.metadata?.name}
            event={event}
            onEventClick={onEventClick}
            onResourceClick={onResourceClick}
            compact={compact}
            isNew={enableStreaming && index < newEventsCount}
          />
        ))}

        {/* Load More Trigger for Infinite Scroll */}
        {infiniteScroll && hasMore && (
          <div ref={loadMoreTriggerRef} className="h-px mt-4" />
        )}

        {/* Load More Button (when infinite scroll is disabled) */}
        {!infiniteScroll && hasMore && !isLoading && (
          <div className="flex justify-center p-4 mt-4">
            <Button onClick={handleLoadMoreClick}>
              Load more
            </Button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && events.length > 0 && !isLoading && (
          <div className="text-center py-6 text-muted-foreground text-sm border-t border-border mt-4">
            No more events to load
          </div>
        )}
      </div>
    </Card>
  );
}
