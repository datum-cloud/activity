import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { K8sEvent } from '../types/k8s-event';
import { EventExpandedDetails } from './EventExpandedDetails';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export interface EventFeedItemProps {
  /** The event to render */
  event: K8sEvent;
  /** Handler called when the item is clicked */
  onEventClick?: (event: K8sEvent) => void;
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
 * Get badge variant based on event type
 */
function getEventTypeBadgeVariant(type?: string): 'default' | 'destructive' {
  return type === 'Warning' ? 'destructive' : 'default';
}

/**
 * Get icon for event type
 */
function getEventTypeIcon(type?: string) {
  if (type === 'Warning') {
    return (
      <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * EventFeedItem renders a single Kubernetes event in the feed
 */
export function EventFeedItem({
  event,
  onEventClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
  defaultExpanded = false,
}: EventFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { type, reason, message, involvedObject, count, lastTimestamp, firstTimestamp, eventTime } = event;

  const handleClick = () => {
    onEventClick?.(event);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const timestamp = lastTimestamp || firstTimestamp || eventTime;
  const isWarning = type === 'Warning';

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:border-rose-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-rose-600',
        compact ? 'p-3 mb-2' : 'p-4 mb-3',
        isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        isWarning && !isSelected && 'border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-4">
        {/* Event Type Icon */}
        <div className={cn('shrink-0 flex items-start', compact ? 'pt-0.5' : 'pt-1')}>
          {getEventTypeIcon(type)}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Badges + Timestamp */}
          <div className="flex justify-between items-start gap-4 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getEventTypeBadgeVariant(type)} className={compact ? 'text-xs' : 'text-sm'}>
                {type || 'Normal'}
              </Badge>
              {reason && (
                <Badge variant="outline" className={compact ? 'text-xs' : 'text-sm'}>
                  {reason}
                </Badge>
              )}
              {count && count > 1 && (
                <Badge variant="secondary" className={compact ? 'text-xs' : 'text-sm'}>
                  x{count}
                </Badge>
              )}
            </div>
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Involved Object */}
          <div className={cn('mb-2', compact ? 'text-sm' : 'text-[0.9375rem]')}>
            <span className="font-medium text-foreground">
              {involvedObject.kind || 'Unknown'}/{involvedObject.name || 'Unknown'}
            </span>
            {involvedObject.namespace && (
              <Badge variant="outline" className="ml-2 text-xs">
                {involvedObject.namespace}
              </Badge>
            )}
          </div>

          {/* Message */}
          {message && (
            <p className={cn('text-muted-foreground leading-relaxed m-0 mb-2', compact ? 'text-xs' : 'text-sm')}>
              {message}
            </p>
          )}

          {/* Meta info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {event.source?.component && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.source.component}
              </span>
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
      {isExpanded && <EventExpandedDetails event={event} />}
    </Card>
  );
}
