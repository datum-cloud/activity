import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Activity, ResourceLinkResolver, TenantLinkResolver, TenantRenderer } from '../types/activity';
import { ActivityFeedSummary, ResourceLinkClickHandler } from './ActivityFeedSummary';
import { ActivityExpandedDetails } from './ActivityExpandedDetails';
import { TenantBadge } from './TenantBadge';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

export interface ActivityFeedItemProps {
  /** The activity to render */
  activity: Activity;
  /** Handler called when a resource link is clicked (deprecated: use resourceLinkResolver) */
  onResourceClick?: ResourceLinkClickHandler;
  /** Function that resolves resource references to URLs */
  resourceLinkResolver?: ResourceLinkResolver;
  /** Function that resolves tenant references to URLs */
  tenantLinkResolver?: TenantLinkResolver;
  /** Custom renderer for tenant badges (overrides default TenantBadge) */
  tenantRenderer?: TenantRenderer;
  /** Handler called when the actor name or avatar is clicked */
  onActorClick?: (actorName: string) => void;
  /** Handler called when the item is clicked */
  onActivityClick?: (activity: Activity) => void;
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Whether to show as compact (for resource detail tabs) */
  compact?: boolean;
  /** Whether this is a newly streamed activity */
  isNew?: boolean;
  /** Layout variant: 'feed' (default) or 'timeline' */
  variant?: 'feed' | 'timeline';
  /** Whether this is the first item in the list (hides timeline head, only used in timeline variant) */
  isFirst?: boolean;
  /** Whether this is the last item in the list (hides timeline tail, only used in timeline variant) */
  isLast?: boolean;
  /** Whether the item starts expanded */
  defaultExpanded?: boolean;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return timestamp;
  }
}

/**
 * Format timestamp for tooltip
 */
function formatTimestampFull(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return timestamp;
  }
}

/**
 * Get avatar initials from actor name
 */
function getActorInitials(name: string): string {
  const parts = name.split(/[@\s.]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get Tailwind classes for actor avatar based on actor type
 */
function getActorAvatarClasses(actorType: string, compact: boolean): string {
  const baseClasses = cn(
    'rounded-full flex items-center justify-center shrink-0 font-semibold',
    compact ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
  );
  switch (actorType) {
    case 'user':
      return cn(baseClasses, 'bg-lime-200 text-slate-900 dark:bg-lime-800 dark:text-lime-100');
    case 'controller':
      return cn(baseClasses, 'bg-rose-300 text-slate-900 dark:bg-rose-800 dark:text-rose-100');
    case 'machine account':
      return cn(baseClasses, 'bg-muted text-muted-foreground');
    default:
      return cn(baseClasses, 'bg-muted text-muted-foreground');
  }
}

/**
 * Extract verb from activity summary (e.g., "alice created HTTPProxy" -> "created")
 */
function extractVerb(summary: string): string {
  const words = summary.split(/\s+/);
  if (words.length >= 2) {
    return words[1].toLowerCase();
  }
  return 'unknown';
}

/**
 * Normalize verb to a canonical form for coloring
 */
function normalizeVerb(verb: string): 'create' | 'update' | 'delete' | 'other' {
  const normalized = verb.toLowerCase();
  if (normalized.includes('create') || normalized.includes('add')) return 'create';
  if (normalized.includes('delete') || normalized.includes('remove')) return 'delete';
  if (normalized.includes('update') || normalized.includes('patch') || normalized.includes('modify') || normalized.includes('change') || normalized.includes('edit')) return 'update';
  return 'other';
}

/**
 * Get timeline node classes based on verb
 */
function getTimelineNodeClasses(verb: string): string {
  const normalizedVerb = normalizeVerb(verb);
  switch (normalizedVerb) {
    case 'create':
      return 'bg-green-500';
    case 'update':
      return 'bg-amber-500';
    case 'delete':
      return 'bg-red-500';
    default:
      return 'bg-muted-foreground';
  }
}

/**
 * ActivityFeedItem renders a single activity in the feed or timeline
 */
export function ActivityFeedItem({
  activity,
  onResourceClick,
  resourceLinkResolver,
  tenantLinkResolver,
  tenantRenderer,
  onActorClick,
  onActivityClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
  variant = 'feed',
  isFirst = false,
  isLast = false,
  defaultExpanded = false,
}: ActivityFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { spec, metadata } = activity;
  const { actor, summary, links, tenant } = spec;

  const handleClick = () => {
    onActivityClick?.(activity);
  };

  const handleActorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onActorClick) {
      onActorClick(actor.name);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const timestamp = metadata?.creationTimestamp;
  const verb = extractVerb(summary);
  const isTimeline = variant === 'timeline';

  // Timeline variant wrapper
  if (isTimeline) {
    return (
      <div
        className={cn(
          'relative cursor-pointer group flex',
          compact ? 'pl-7' : 'pl-9',
          className
        )}
        onClick={handleClick}
      >
        {/* Timeline column - contains line and dot */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 flex flex-col items-center',
            compact ? 'w-7' : 'w-9'
          )}
        >
          {/* Top line segment (connects to previous item) */}
          <div
            className={cn(
              'w-0.5 flex-1',
              isFirst ? 'bg-transparent' : 'bg-border'
            )}
            style={{ minHeight: compact ? 12 : 16 }}
          />

          {/* Timeline node (dot) - centered */}
          <div
            className={cn(
              'rounded-full shrink-0 z-10',
              compact ? 'w-2.5 h-2.5' : 'w-3 h-3',
              getTimelineNodeClasses(verb)
            )}
          />

          {/* Bottom line segment (connects to next item) */}
          <div
            className={cn(
              'w-0.5 flex-1',
              isLast ? 'bg-transparent' : 'bg-border'
            )}
          />
        </div>

        {/* Event content card */}
        <div
          className={cn(
            'flex-1 border border-border rounded-lg transition-all duration-200',
            'hover:border-rose-300 hover:shadow-sm dark:hover:border-rose-600',
            compact ? 'px-3 py-2 mb-2' : 'px-3 py-2 mb-2',
            isSelected && 'border-rose-300 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30'
          )}
        >
          {/* Header: Summary + Timestamp */}
          <div className="flex justify-between items-center gap-4">
            <div className={cn('leading-snug text-xs')}>
              <ActivityFeedSummary
                summary={summary}
                links={links}
                onResourceClick={onResourceClick}
                resourceLinkResolver={resourceLinkResolver}
                resourceLinkContext={{ tenant }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tenant && (
                tenantRenderer ? tenantRenderer(tenant) : <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />
              )}
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                title={formatTimestampFull(timestamp)}
              >
                {formatTimestamp(timestamp)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="w-5 h-5 p-0 text-2xl text-muted-foreground hover:text-foreground flex items-center justify-center"
                onClick={toggleExpand}
                aria-expanded={isExpanded}
              >
                {isExpanded ? '▾' : '▸'}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && <ActivityExpandedDetails activity={activity} tenantLinkResolver={tenantLinkResolver} />}
        </div>
      </div>
    );
  }

  // Feed variant (original layout)
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:border-rose-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-rose-600',
        compact ? 'px-3 py-2 mb-1' : 'px-3 py-2 mb-2',
        isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3 items-center">
        {/* Actor Avatar */}
        <div
          className={cn(
            getActorAvatarClasses(actor.type, compact),
            onActorClick && 'cursor-pointer hover:opacity-80 transition-opacity'
          )}
          title={actor.name}
          onClick={onActorClick ? handleActorClick : undefined}
        >
          {actor.type === 'controller' ? (
            <span className={compact ? 'text-xs' : 'text-sm'}>⚙</span>
          ) : actor.type === 'machine account' ? (
            <span className={compact ? 'text-xs' : 'text-sm'}>🤖</span>
          ) : (
            <span className="uppercase">{getActorInitials(actor.name)}</span>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Summary + Timestamp */}
          <div className="flex justify-between items-center gap-4">
            <div className={cn('leading-snug text-xs')}>
              <ActivityFeedSummary
                summary={summary}
                links={links}
                onResourceClick={onResourceClick}
                resourceLinkResolver={resourceLinkResolver}
                resourceLinkContext={{ tenant }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tenant && (
                tenantRenderer ? tenantRenderer(tenant) : <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />
              )}
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                title={formatTimestampFull(timestamp)}
              >
                {formatTimestamp(timestamp)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="w-5 h-5 p-0 text-2xl text-muted-foreground hover:text-foreground flex items-center justify-center"
                onClick={toggleExpand}
                aria-expanded={isExpanded}
              >
                {isExpanded ? '▾' : '▸'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && <ActivityExpandedDetails activity={activity} tenantLinkResolver={tenantLinkResolver} />}
    </Card>
  );
}
