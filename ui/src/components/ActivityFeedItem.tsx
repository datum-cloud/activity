import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Activity, ResourceLinkResolver, TenantLinkResolver } from '../types/activity';
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
    compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
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
  const { actor, summary, changeSource, links, tenant } = spec;

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
            compact ? 'p-3 mb-3' : 'p-4 mb-4',
            isSelected && 'border-rose-300 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30'
          )}
        >
          {/* Header: Summary + Timestamp */}
          <div className="flex justify-between items-start gap-4 mb-2">
            <div className={cn('leading-relaxed text-xs')}>
              <ActivityFeedSummary
                summary={summary}
                links={links}
                onResourceClick={onResourceClick}
                resourceLinkResolver={resourceLinkResolver}
                resourceLinkContext={{ tenant }}
              />
            </div>
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Meta info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={cn(
              'inline-flex items-center gap-1',
              changeSource === 'human'
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground'
            )}>
              {changeSource === 'human' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {changeSource}
            </span>
            {onActorClick ? (
              <button
                type="button"
                className="bg-transparent border-none p-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={handleActorClick}
                title="Filter by this actor"
              >
                by {actor.name}
              </button>
            ) : (
              <span className="text-xs">by {actor.name}</span>
            )}
            {tenant && (
              <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▾ Less' : '▸ More'}
            </Button>
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
        compact ? 'p-3 mb-2' : 'p-4 mb-3',
        isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-4">
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
            <span className={compact ? 'text-base' : 'text-xl'}>⚙</span>
          ) : actor.type === 'machine account' ? (
            <span className={compact ? 'text-base' : 'text-xl'}>🤖</span>
          ) : (
            <span className="uppercase">{getActorInitials(actor.name)}</span>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Summary + Timestamp */}
          <div className="flex justify-between items-start gap-4 mb-2">
            <div className={cn('leading-relaxed text-xs')}>
              <ActivityFeedSummary
                summary={summary}
                links={links}
                onResourceClick={onResourceClick}
                resourceLinkResolver={resourceLinkResolver}
                resourceLinkContext={{ tenant }}
              />
            </div>
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Meta info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={cn(
              'inline-flex items-center gap-1',
              changeSource === 'human'
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground'
            )}>
              {changeSource === 'human' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {changeSource}
            </span>
            {onActorClick ? (
              <button
                type="button"
                className="bg-transparent border-none p-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={handleActorClick}
                title="Filter by this actor"
              >
                by {actor.name}
              </button>
            ) : (
              <span className="text-xs">by {actor.name}</span>
            )}
            {tenant && (
              <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▾ Less' : '▸ More'}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && <ActivityExpandedDetails activity={activity} tenantLinkResolver={tenantLinkResolver} />}
    </Card>
  );
}
