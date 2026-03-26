import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Activity, ResourceLinkResolver, TenantLinkResolver, TenantRenderer } from '../types/activity';
import { ActivityFeedSummary, ResourceLinkClickHandler } from './ActivityFeedSummary';
import { ActivityExpandedDetails } from './ActivityExpandedDetails';
import { TenantBadge } from './TenantBadge';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Plus, Pencil, Trash2, Activity as ActivityIcon } from 'lucide-react';

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
  /** Whether this is the last item in the list (hides bottom border, only used in timeline variant) */
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
 * Format timestamp for tooltip (in UTC)
 */
function formatTimestampFull(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  try {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')} UTC`;
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
    compact ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-xs'
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
 * Get icon container + icon color classes based on verb
 */
function getActionIconClasses(verb: string): { container: string; icon: string } {
  const normalizedVerb = normalizeVerb(verb);
  switch (normalizedVerb) {
    case 'create':
      return { container: 'bg-blue-50 dark:bg-blue-950', icon: 'text-blue-500 dark:text-blue-400' };
    case 'update':
      return { container: 'bg-green-50 dark:bg-green-950', icon: 'text-green-600 dark:text-green-400' };
    case 'delete':
      return { container: 'bg-red-50 dark:bg-red-950', icon: 'text-red-500 dark:text-red-400' };
    default:
      return { container: 'bg-slate-100 dark:bg-slate-800', icon: 'text-slate-500 dark:text-slate-400' };
  }
}

/**
 * Get the Lucide icon component for the timeline node based on verb
 */
function getTimelineIcon(verb: string): React.ElementType {
  const normalizedVerb = normalizeVerb(verb);
  switch (normalizedVerb) {
    case 'create':
      return Plus;
    case 'update':
      return Pencil;
    case 'delete':
      return Trash2;
    default:
      return ActivityIcon;
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

  // Timeline variant — flat list row with bottom border
  if (isTimeline) {
    const { container: iconBg, icon: iconColor } = getActionIconClasses(verb);
    const Icon = getTimelineIcon(verb);
    return (
      <div className={cn(!isLast && !isExpanded && 'border-b border-border', className)}>
        <div
          className={cn(
            'flex items-center gap-3 py-3 pl-4 cursor-pointer group',
            isSelected && 'bg-muted/40',
          )}
          onClick={toggleExpand}
        >
          {/* Action icon square */}
          <div
            className={cn(
              'w-8 h-8 rounded-md shrink-0 flex items-center justify-center',
              iconBg, iconColor
            )}
          >
            <Icon size={16} strokeWidth={2} />
          </div>

          {/* Summary */}
          <div className="flex-1 min-w-0 text-sm text-foreground leading-snug">
            <ActivityFeedSummary
              summary={summary}
              links={links}
              onResourceClick={onResourceClick}
              resourceLinkResolver={resourceLinkResolver}
              resourceLinkContext={{ tenant }}
            />
          </div>

          {/* Tenant badge */}
          {tenant && (
            <div className="shrink-0">
              {tenantRenderer ? tenantRenderer(tenant) : <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />}
            </div>
          )}

          {/* Timestamp */}
          <span
            className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
            title={formatTimestampFull(timestamp)}
          >
            {formatTimestamp(timestamp)}
          </span>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 py-0 px-1 text-base text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={toggleExpand}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <ActivityExpandedDetails activity={activity} tenantLinkResolver={tenantLinkResolver} compact />
        )}
      </div>
    );
  }

  // Feed variant (single-row layout)
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'shadow-sm hover:shadow-md hover:-translate-y-0.5',
        'hover:border-primary/30 dark:hover:border-primary/40',
        compact ? 'p-1.5 mb-1' : 'p-4 mb-3',
        isSelected && 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20 dark:bg-primary/10',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        className
      )}
      onClick={handleClick}
    >
      {/* Single row layout */}
      <div className="flex items-center gap-2">
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
            <span className="text-xs">⚙</span>
          ) : actor.type === 'machine account' ? (
            <span className="text-xs">🤖</span>
          ) : (
            <span className="uppercase">{getActorInitials(actor.name)}</span>
          )}
        </div>

        {/* Summary - takes remaining space */}
        <div className="flex-1 min-w-0 text-xs leading-snug">
          <ActivityFeedSummary
            summary={summary}
            links={links}
            onResourceClick={onResourceClick}
            resourceLinkResolver={resourceLinkResolver}
            resourceLinkContext={{ tenant }}
          />
        </div>

        {/* Tenant badge */}
        {tenant && (
          <div className="shrink-0">
            {tenantRenderer ? tenantRenderer(tenant) : <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} size="compact" />}
          </div>
        )}

        {/* Timestamp */}
        <span
          className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
          title={formatTimestampFull(timestamp)}
        >
          {formatTimestamp(timestamp)}
        </span>

        {/* Expand button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 py-0 px-1 text-base text-muted-foreground hover:text-foreground shrink-0"
          onClick={toggleExpand}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '−' : '+'}
        </Button>
      </div>

      {/* Expanded Details */}
      {isExpanded && <ActivityExpandedDetails activity={activity} tenantLinkResolver={tenantLinkResolver} />}
    </Card>
  );
}
