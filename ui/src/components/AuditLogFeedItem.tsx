import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Event } from '../types';
import { AuditLogExpandedDetails } from './AuditLogExpandedDetails';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export interface AuditLogFeedItemProps {
  /** The audit event to render */
  event: Event;
  /** Handler called when the item is clicked */
  onEventClick?: (event: Event) => void;
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Whether to show as compact (for resource detail tabs) */
  compact?: boolean;
  /** Whether this is a newly streamed event */
  isNew?: boolean;
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
 * Get Tailwind classes for verb badge
 */
function getVerbBadgeClasses(verb?: string): string {
  const baseClasses = 'text-[9px] h-4 px-1.5 py-0';
  const normalized = verb?.toLowerCase();

  switch (normalized) {
    case 'create':
      return cn(baseClasses, 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300');
    case 'update':
    case 'patch':
      return cn(baseClasses, 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300');
    case 'delete':
      return cn(baseClasses, 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300');
    default:
      return cn(baseClasses, 'bg-muted text-muted-foreground');
  }
}

/**
 * Get response status indicator (✓ or ✗)
 */
function getResponseStatusIndicator(code?: number): { icon: string; className: string } {
  if (!code) {
    return { icon: '?', className: 'text-muted-foreground' };
  }

  if (code >= 200 && code < 300) {
    return { icon: '✓', className: 'text-green-600 dark:text-green-400' };
  }

  return { icon: '✗', className: 'text-red-600 dark:text-red-400' };
}

/**
 * Build human-readable summary
 */
function buildAuditSummary(event: Event): string {
  const username = event.user?.username || 'Unknown user';
  const verb = event.verb || 'performed action';
  const kind = event.objectRef?.resource || 'resource';
  const name = event.objectRef?.name || '';
  const namespace = event.objectRef?.namespace;

  let summary = `${username} ${verb} ${kind}`;
  if (name) {
    summary += ` ${name}`;
  }
  if (namespace) {
    summary += ` in ${namespace}`;
  }

  return summary;
}

/**
 * AuditLogFeedItem renders a single audit log event in the feed
 */
export function AuditLogFeedItem({
  event,
  onEventClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
  defaultExpanded = false,
}: AuditLogFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleClick = () => {
    onEventClick?.(event);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const timestamp = event.stageTimestamp || event.requestReceivedTimestamp;
  const summary = buildAuditSummary(event);
  const statusIndicator = getResponseStatusIndicator(event.responseStatus?.code);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:border-gray-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-gray-600',
        compact ? 'p-2 mb-1.5' : 'p-2.5 mb-2',
        isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-2">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Single row layout: Summary + Metadata + Timestamp + Expand */}
          <div className="flex items-center gap-2">
            {/* Summary - takes remaining space */}
            <div className="text-xs text-muted-foreground leading-snug flex-1 min-w-0 truncate" title={summary}>
              {summary}
            </div>

            {/* Verb badge */}
            <Badge className={getVerbBadgeClasses(event.verb)}>
              {event.verb?.toUpperCase() || 'UNKNOWN'}
            </Badge>

            {/* Response status */}
            <span className={cn('inline-flex items-center gap-1 text-xs shrink-0', statusIndicator.className)}>
              <span className="font-semibold">{statusIndicator.icon}</span>
              {event.responseStatus?.code && (
                <span>{event.responseStatus.code}</span>
              )}
            </span>

            {/* Timestamp */}
            <span
              className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0"
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
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && <AuditLogExpandedDetails event={event} />}
    </Card>
  );
}
