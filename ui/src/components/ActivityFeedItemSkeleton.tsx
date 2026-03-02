import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

export interface ActivityFeedItemSkeletonProps {
  /** Whether to show as compact (for resource detail tabs) */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * ActivityFeedItemSkeleton renders a loading placeholder that matches ActivityFeedItem layout
 */
export function ActivityFeedItemSkeleton({
  compact = false,
  className = '',
}: ActivityFeedItemSkeletonProps) {
  return (
    <Card
      className={cn(
        compact ? 'p-2 mb-1.5' : 'p-2.5 mb-2',
        className
      )}
    >
      {/* Single row layout */}
      <div className="flex items-center gap-2">
        {/* Actor Avatar skeleton */}
        <Skeleton className={cn(
          'rounded-full shrink-0',
          compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
        )} />

        {/* Summary skeleton - takes remaining space */}
        <Skeleton className="h-3 flex-1 min-w-0" />

        {/* Tenant badge skeleton */}
        <Skeleton className="h-4 w-16 shrink-0" />

        {/* Timestamp skeleton */}
        <Skeleton className="h-3 w-16 shrink-0" />

        {/* Expand button skeleton */}
        <Skeleton className="h-5 w-5 shrink-0" />
      </div>
    </Card>
  );
}
