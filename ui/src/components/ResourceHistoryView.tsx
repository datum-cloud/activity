import { useEffect, useCallback, useMemo } from 'react';
import type { Activity } from '../types/activity';
import type { ActivityFeedFilters } from '../hooks/useActivityFeed';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { ActivityFeedItem } from './ActivityFeedItem';
import { ResourceLinkClickHandler } from './ActivityFeedSummary';
import { ActivityApiClient } from '../api/client';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { cn } from '../lib/utils';

/**
 * Resource filter for searching by resource attributes
 */
export interface ResourceFilter {
  /** API group of the resource (e.g., 'networking.k8s.io') */
  apiGroup?: string;
  /** Kind of the resource (e.g., 'HTTPProxy') */
  kind?: string;
  /** Namespace of the resource */
  namespace?: string;
  /** Name of the resource (supports partial match) */
  name?: string;
  /** UID of the resource (exact match, takes precedence over other filters) */
  uid?: string;
}

export interface ResourceHistoryViewProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Resource filter - can filter by UID or by apiGroup/kind/namespace/name */
  resourceFilter: ResourceFilter;
  /** Start of time range (default: 'now-30d') */
  startTime?: string;
  /** Maximum number of events to load (default: 50) */
  limit?: number;
  /** Reduced padding for embedding (default: false) */
  compact?: boolean;
  /** Handler called when an activity is clicked */
  onActivityClick?: (activity: Activity) => void;
  /** Handler called when a resource link is clicked */
  onResourceClick?: ResourceLinkClickHandler;
  /** Additional CSS class */
  className?: string;
  /** Enable real-time streaming of new activities (default: false) */
  enableStreaming?: boolean;
  /** Handler called when user wants to start a new search */
  onNewSearch?: () => void;
}

/**
 * Build resource description parts for display
 */
function buildResourceDescription(filter: ResourceFilter): {
  primary: string;
  secondary?: string;
} {
  if (filter.uid) {
    return {
      primary: `UID: ${filter.uid}`,
    };
  }

  const primary: string[] = [];
  const secondary: string[] = [];

  if (filter.kind) {
    primary.push(filter.kind);
  }
  if (filter.name) {
    primary.push(filter.name);
  }
  if (filter.namespace) {
    secondary.push(`Namespace: ${filter.namespace}`);
  }
  if (filter.apiGroup) {
    secondary.push(`API Group: ${filter.apiGroup}`);
  }

  return {
    primary: primary.length > 0 ? primary.join(' / ') : 'All Resources',
    secondary: secondary.length > 0 ? secondary.join(' · ') : undefined,
  };
}

/**
 * ResourceHistoryView displays a resource's change history as a vertical timeline.
 * Shows who changed what, when, with expandable details.
 *
 * Can filter by:
 * - UID (exact match)
 * - API Group, Kind, Namespace, Name (combined filter)
 */
export function ResourceHistoryView({
  client,
  resourceFilter,
  startTime = 'now-30d',
  limit = 50,
  compact = false,
  onActivityClick,
  onResourceClick,
  className,
  enableStreaming = false,
  onNewSearch,
}: ResourceHistoryViewProps) {
  // Build the activity feed filters from the resource filter
  const activityFilters = useMemo((): ActivityFeedFilters => {
    const filters: ActivityFeedFilters = {};

    // UID takes precedence if provided
    if (resourceFilter.uid) {
      filters.resourceUid = resourceFilter.uid;
    } else {
      // Use attribute-based filters
      if (resourceFilter.apiGroup) {
        filters.apiGroups = [resourceFilter.apiGroup];
      }
      if (resourceFilter.kind) {
        filters.resourceKinds = [resourceFilter.kind];
      }
      if (resourceFilter.namespace) {
        filters.resourceNamespaces = [resourceFilter.namespace];
      }
      if (resourceFilter.name) {
        filters.resourceName = resourceFilter.name;
      }
    }

    return filters;
  }, [resourceFilter]);

  // Create a stable key for the filter to detect changes
  const filterKey = useMemo(() => {
    return JSON.stringify(resourceFilter);
  }, [resourceFilter]);

  const {
    activities,
    isLoading,
    error,
    hasMore,
    refresh,
    loadMore,
    isStreaming,
    startStreaming,
    stopStreaming,
    newActivitiesCount,
  } = useActivityFeed({
    client,
    initialFilters: activityFilters,
    initialTimeRange: { start: startTime },
    pageSize: limit,
    enableStreaming,
    autoStartStreaming: true,
  });

  // Handle streaming toggle
  const handleStreamingToggle = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);

  // Auto-execute on mount and when filter changes
  useEffect(() => {
    refresh();
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle load more click
  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

  // Build resource description
  const resourceDescription = buildResourceDescription(resourceFilter);

  // Check if we have any valid filter criteria
  const hasValidFilter = resourceFilter.uid ||
    resourceFilter.apiGroup ||
    resourceFilter.kind ||
    resourceFilter.namespace ||
    resourceFilter.name;

  return (
    <Card className={cn(compact ? 'p-0 shadow-none border-0' : 'p-6', className)}>
      {/* Header with resource info, streaming controls, and actions */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div className="flex-1 min-w-0">
          {/* Resource description */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {resourceDescription.primary}
            </span>
            {enableStreaming && isStreaming && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400"></span>
                </span>
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            )}
            {enableStreaming && newActivitiesCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{newActivitiesCount} new
              </Badge>
            )}
          </div>
          {resourceDescription.secondary && (
            <p className="text-xs text-muted-foreground mt-1 m-0">
              {resourceDescription.secondary}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {enableStreaming && (
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
          )}
          {onNewSearch && (
            <Button variant="outline" size="sm" onClick={onNewSearch}>
              New Search
            </Button>
          )}
        </div>
      </div>

      <div>
        {/* No filter provided */}
        {!hasValidFilter && (
          <div className="py-12 text-center text-muted-foreground">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="m-0 text-sm">No resource filter specified</p>
            <p className="text-xs text-muted-foreground mt-1 m-0">
              Provide at least one filter criterion to view resource history
            </p>
          </div>
        )}

        {/* Error Display */}
        {hasValidFilter && error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-sm">{error.message}</span>
              <Button variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state (initial) */}
        {hasValidFilter && isLoading && activities.length === 0 && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin" />
            <span>Loading history...</span>
          </div>
        )}

        {/* Empty state */}
        {hasValidFilter && !isLoading && activities.length === 0 && !error && (
          <div className="py-12 text-center text-muted-foreground">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="m-0 text-sm">No history found for this resource</p>
            <p className="text-xs text-muted-foreground mt-1 m-0">
              Changes will appear here once activity policies are configured
            </p>
          </div>
        )}

        {/* Timeline */}
        {hasValidFilter && activities.length > 0 && (
          <div className="relative">
            {activities.map((activity, index) => {
              const activityId = activity.metadata?.uid || activity.metadata?.name || String(index);
              return (
                <ActivityFeedItem
                  key={activityId}
                  activity={activity}
                  variant="timeline"
                  compact={compact}
                  isFirst={index === 0}
                  isLast={index === activities.length - 1 && !hasMore}
                  onActivityClick={onActivityClick}
                  onResourceClick={onResourceClick}
                  isNew={enableStreaming && index < newActivitiesCount}
                />
              );
            })}

            {/* Loading more indicator */}
            {isLoading && activities.length > 0 && (
              <div className={cn('relative', compact ? 'pl-8' : 'pl-10')}>
                <div className="flex items-center gap-3 py-4 text-muted-foreground text-sm">
                  <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  <span>Loading more...</span>
                </div>
              </div>
            )}

            {/* Load more button */}
            {hasMore && !isLoading && (
              <div className={cn('relative', compact ? 'pl-8' : 'pl-10')}>
                {/* Continue timeline track */}
                <div
                  className={cn(
                    'absolute w-0.5 bg-border',
                    compact ? 'left-[11px] top-0 h-4' : 'left-[15px] top-0 h-5'
                  )}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-muted-foreground hover:text-foreground mt-2"
                >
                  Load more history
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Summary footer */}
        {hasValidFilter && activities.length > 0 && (
          <div className={cn(
            'text-xs text-muted-foreground mt-4 pt-3 border-t border-border',
            compact ? '' : ''
          )}>
            Showing {activities.length} event{activities.length !== 1 ? 's' : ''}
            {hasMore && ' (more available)'}
          </div>
        )}
      </div>
    </Card>
  );
}
