import { useEffect, useRef, useCallback, useState } from 'react';
import type { Activity, ResourceRef, ResourceLinkResolver } from '../types/activity';
import type {
  ActivityFeedFilters as FilterState,
  TimeRange,
} from '../hooks/useActivityFeed';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { ActivityFeedItem } from './ActivityFeedItem';
import { ActivityFeedFilters } from './ActivityFeedFilters';
import { ActivityApiClient } from '../api/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

export interface ActivityFeedProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Initial filter settings */
  initialFilters?: FilterState;
  /** Initial time range */
  initialTimeRange?: TimeRange;
  /** Number of items per page */
  pageSize?: number;
  /** Handler called when a resource link is clicked (deprecated: use resourceLinkResolver) */
  onResourceClick?: (resource: ResourceRef) => void;
  /** Function that resolves resource references to URLs */
  resourceLinkResolver?: ResourceLinkResolver;
  /** Handler called when an activity is clicked */
  onActivityClick?: (activity: Activity) => void;
  /** Whether to show in compact mode (for resource detail tabs) */
  compact?: boolean;
  /** Filter to a specific resource UID */
  resourceUid?: string;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Enable infinite scroll (default: true) */
  infiniteScroll?: boolean;
  /** Threshold in pixels for triggering load more (default: 200) */
  loadMoreThreshold?: number;
  /** Handler called when user wants to create a policy (for empty state) */
  onCreatePolicy?: () => void;
  /** Enable real-time streaming (default: false) */
  enableStreaming?: boolean;
}

/**
 * ActivityFeed displays a chronological list of activities with filtering and pagination.
 * Supports optional real-time streaming of new activities.
 */
export function ActivityFeed({
  client,
  initialFilters = { changeSource: 'human' },
  initialTimeRange = { start: 'now-7d' },
  pageSize = 30,
  onResourceClick,
  resourceLinkResolver,
  onActivityClick,
  compact = false,
  resourceUid,
  showFilters = true,
  className = '',
  infiniteScroll = true,
  loadMoreThreshold = 200,
  onCreatePolicy,
  enableStreaming = false,
}: ActivityFeedProps) {
  // Merge resourceUid into initial filters if provided
  const mergedInitialFilters: FilterState = {
    ...initialFilters,
    resourceUid: resourceUid || initialFilters.resourceUid,
  };

  const {
    activities,
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
    newActivitiesCount,
  } = useActivityFeed({
    client,
    initialFilters: mergedInitialFilters,
    initialTimeRange,
    pageSize,
    enableStreaming,
    autoStartStreaming: true,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Track whether policies exist in the system
  const [hasPolicies, setHasPolicies] = useState<boolean | null>(null);
  const [policiesLoading, setPoliciesLoading] = useState(true);

  // Check for policies on mount
  useEffect(() => {
    const checkPolicies = async () => {
      try {
        const policyList = await client.listPolicies();
        setHasPolicies((policyList.items?.length ?? 0) > 0);
      } catch {
        // If we can't check policies, assume they might exist
        setHasPolicies(true);
      } finally {
        setPoliciesLoading(false);
      }
    };
    checkPolicies();
  }, [client]);

  // Auto-execute on mount
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    if (!infiniteScroll || !loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
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
  }, [infiniteScroll, hasMore, isLoading, loadMore, loadMoreThreshold]);

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

  // Handle actor click - filter by actor name
  const handleActorClick = useCallback((actorName: string) => {
    setFilters({
      ...filters,
      actorNames: [actorName],
    });
  }, [filters, setFilters]);

  // Build container classes
  const containerClasses = compact
    ? `p-4 shadow-none border-border ${className}`
    : `p-6 ${className}`;

  // Build list classes
  const listClasses = compact
    ? 'max-h-[40vh] overflow-y-auto pr-2'
    : 'max-h-[60vh] overflow-y-auto pr-2';

  return (
    <Card className={containerClasses}>
      {/* Header with streaming status */}
      {enableStreaming && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-foreground m-0">Activity Feed</h3>
            {isStreaming && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400"></span>
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            )}
            {newActivitiesCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{newActivitiesCount} new
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStreamingToggle}
            className="text-xs"
          >
            {isStreaming ? (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <ActivityFeedFilters
          client={client}
          filters={filters}
          timeRange={timeRange}
          onFiltersChange={handleFiltersChange}
          onTimeRangeChange={handleTimeRangeChange}
          disabled={isLoading}
        />
      )}

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

      {/* No Policies Empty State */}
      {!policiesLoading && hasPolicies === false && (
        <div className="flex flex-col items-center py-12 px-8 text-center bg-muted border border-dashed border-border rounded-xl mb-4">
          <div className="flex justify-center mb-4 text-muted-foreground">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </div>
          <h3 className="m-0 mb-2 text-lg font-semibold text-foreground leading-snug">Get started with activity logging</h3>
          <p className="m-0 mb-6 text-sm leading-relaxed text-muted-foreground max-w-[400px]">
            Activity policies define which resources to track and how to summarize changes.
            Create your first policy to start seeing activity logs here.
          </p>
          {onCreatePolicy && (
            <Button onClick={onCreatePolicy}>
              Create Policy
            </Button>
          )}
        </div>
      )}

      {/* Activity List */}
      <div className={listClasses} ref={scrollContainerRef}>
        {activities.length === 0 && !isLoading && hasPolicies !== false && (
          <div className="py-12 text-center text-muted-foreground">
            <p className="m-0">No activities found</p>
            <p className="text-sm text-muted-foreground mt-2 m-0">
              Try adjusting your filters or time range
            </p>
          </div>
        )}

        {activities.map((activity, index) => (
          <ActivityFeedItem
            key={activity.metadata?.uid || activity.metadata?.name}
            activity={activity}
            onResourceClick={onResourceClick}
            resourceLinkResolver={resourceLinkResolver}
            onActorClick={handleActorClick}
            onActivityClick={onActivityClick}
            compact={compact}
            isNew={enableStreaming && index < newActivitiesCount}
          />
        ))}

        {/* Load More Trigger for Infinite Scroll */}
        {infiniteScroll && hasMore && (
          <div ref={loadMoreTriggerRef} className="h-px mt-4" />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
            <span>Loading activities...</span>
          </div>
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
        {!hasMore && activities.length > 0 && !isLoading && (
          <div className="text-center py-6 text-muted-foreground text-sm border-t border-border mt-4">
            No more activities to load
          </div>
        )}
      </div>
    </Card>
  );
}
