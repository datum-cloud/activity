import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Activity } from '../types/activity';
import { ActivityFeedSummary, ResourceLinkClickHandler } from './ActivityFeedSummary';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export interface ActivityFeedItemProps {
  /** The activity to render */
  activity: Activity;
  /** Handler called when a resource link is clicked */
  onResourceClick?: ResourceLinkClickHandler;
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
 * Get badge variant for change source
 */
function getChangeSourceVariant(changeSource: string): 'success' | 'secondary' {
  switch (changeSource) {
    case 'human':
      return 'success';
    case 'system':
    default:
      return 'secondary';
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
 * ActivityFeedItem renders a single activity in the feed
 */
export function ActivityFeedItem({
  activity,
  onResourceClick,
  onActivityClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
}: ActivityFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { spec, metadata } = activity;
  const { actor, summary, changeSource, resource, links, origin, changes } = spec;

  const handleClick = () => {
    onActivityClick?.(activity);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const timestamp = metadata?.creationTimestamp;

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
        <div className={getActorAvatarClasses(actor.type, compact)} title={actor.name}>
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
          <div className="flex justify-between items-start gap-4 mb-2">
            <ActivityFeedSummary
              summary={summary}
              links={links}
              onResourceClick={onResourceClick}
            />
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center text-xs">
            <Badge variant={getChangeSourceVariant(changeSource)} className="uppercase tracking-wide">
              {changeSource}
            </Badge>
            {!compact && (
              <>
                <span className="text-muted-foreground" title={actor.email || actor.uid}>
                  {actor.name}
                </span>
                <span className="text-muted-foreground font-mono">
                  {resource.kind}
                </span>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▼' : '▶'} Details
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          {/* Actor Information */}
          <div className="mb-4 last:mb-0">
            <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">Actor</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
              <dt className="font-medium text-muted-foreground">Name:</dt>
              <dd className="m-0 text-foreground break-all">{actor.name}</dd>
              <dt className="font-medium text-muted-foreground">Type:</dt>
              <dd className="m-0 text-foreground break-all">{actor.type}</dd>
              {actor.email && (
                <>
                  <dt className="font-medium text-muted-foreground">Email:</dt>
                  <dd className="m-0 text-foreground break-all">{actor.email}</dd>
                </>
              )}
              <dt className="font-medium text-muted-foreground">UID:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{actor.uid}</dd>
            </dl>
          </div>

          {/* Resource Information */}
          <div className="mb-4 last:mb-0">
            <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">Resource</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
              <dt className="font-medium text-muted-foreground">Kind:</dt>
              <dd className="m-0 text-foreground break-all">{resource.kind}</dd>
              <dt className="font-medium text-muted-foreground">Name:</dt>
              <dd className="m-0 text-foreground break-all">{resource.name}</dd>
              {resource.namespace && (
                <>
                  <dt className="font-medium text-muted-foreground">Namespace:</dt>
                  <dd className="m-0 text-foreground break-all">{resource.namespace}</dd>
                </>
              )}
              <dt className="font-medium text-muted-foreground">API Group:</dt>
              <dd className="m-0 text-foreground break-all">{resource.apiGroup}</dd>
              {resource.uid && (
                <>
                  <dt className="font-medium text-muted-foreground">UID:</dt>
                  <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{resource.uid}</dd>
                </>
              )}
            </dl>
          </div>

          {/* Field Changes */}
          {changes && changes.length > 0 && (
            <div className="mb-4 last:mb-0">
              <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">Changes</h4>
              <div className="flex flex-col gap-2">
                {changes.map((change, index) => (
                  <div key={index} className="p-2 bg-muted rounded text-sm">
                    <span className="block font-semibold text-foreground mb-1 font-mono">{change.field}</span>
                    {change.old && (
                      <span className="block ml-2 text-red-600 dark:text-red-400 line-through">
                        <span className="font-medium mr-1">Old:</span> {change.old}
                      </span>
                    )}
                    {change.new && (
                      <span className="block ml-2 text-green-600 dark:text-green-400">
                        <span className="font-medium mr-1">New:</span> {change.new}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Origin Information */}
          <div className="mb-4 last:mb-0">
            <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">Origin</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
              <dt className="font-medium text-muted-foreground">Type:</dt>
              <dd className="m-0 text-foreground break-all">{origin.type}</dd>
              <dt className="font-medium text-muted-foreground">ID:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{origin.id}</dd>
            </dl>
          </div>

          {/* Timestamp */}
          <div className="mb-4 last:mb-0">
            <h4 className="m-0 mb-2 text-sm font-semibold text-foreground">Timestamp</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
              <dt className="font-medium text-muted-foreground">Created:</dt>
              <dd className="m-0 text-foreground break-all">{formatTimestampFull(timestamp)}</dd>
            </dl>
          </div>
        </div>
      )}
    </Card>
  );
}
