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
 * Get the regarding object (handling both new and deprecated field names)
 */
function getRegarding(event: K8sEvent) {
  return event.regarding || event.involvedObject || {};
}

/**
 * Get the event note/message (handling both new and deprecated field names)
 */
function getNote(event: K8sEvent): string | undefined {
  return event.note || event.message;
}

/**
 * Get the reporting controller (handling both new and deprecated field names)
 */
function getReportingController(event: K8sEvent): string | undefined {
  return event.reportingController || event.source?.component;
}

/**
 * Get the event count (handling both new and deprecated field names)
 */
function getCount(event: K8sEvent): number | undefined {
  return event.series?.count || event.count;
}

/**
 * Get the best timestamp to display (handling both new and deprecated field names)
 * For recurring events (series), prefer lastObservedTime as it reflects the most recent occurrence.
 * For single events, use eventTime.
 */
function getTimestamp(event: K8sEvent): string | undefined {
  // For series events, lastObservedTime is the most recent occurrence
  if (event.series?.lastObservedTime) {
    return event.series.lastObservedTime;
  }
  // For single events, use eventTime (eventsv1) or fall back to legacy fields
  return event.eventTime || event.lastTimestamp || event.firstTimestamp;
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

  // Use helper functions to handle both new and deprecated field names
  const regarding = getRegarding(event);
  const note = getNote(event);
  const count = getCount(event);
  const timestamp = getTimestamp(event);
  const reportingController = getReportingController(event);
  const { type, reason } = event;

  const handleClick = () => {
    onEventClick?.(event);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const isWarning = type === 'Warning';

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:border-rose-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-rose-600',
        compact ? 'p-2 mb-1.5' : 'p-2.5 mb-2',
        isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
        isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
        isWarning && !isSelected && 'border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-2">
        {/* Event Type Icon */}
        <div className="shrink-0 flex items-start pt-0.5">
          {getEventTypeIcon(type)}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Single row layout: Object + Message + Metadata */}
          <div className="flex items-start gap-2 mb-1">
            {/* Regarding Object - inline with type badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={getEventTypeBadgeVariant(type)} className="text-xs h-5">
                {type || 'Normal'}
              </Badge>
              <span className="text-xs font-medium text-foreground whitespace-nowrap">
                {regarding.kind || 'Unknown'}/{regarding.name || 'Unknown'}
              </span>
            </div>

            {/* Note - takes remaining space */}
            {note && (
              <p className="text-xs text-muted-foreground leading-snug m-0 flex-1 min-w-0 truncate" title={note}>
                {note}
              </p>
            )}

            {/* Timestamp - aligned right */}
            <span
              className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Second row: Additional badges and metadata with expand button */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {reason && (
                <Badge variant="outline" className="text-xs h-4 py-0">
                  {reason}
                </Badge>
              )}
              {count && count > 1 && (
                <Badge variant="secondary" className="text-xs h-4 py-0">
                  x{count}
                </Badge>
              )}
              {regarding.namespace && (
                <Badge variant="outline" className="text-xs h-4 py-0">
                  {regarding.namespace}
                </Badge>
              )}
              {reportingController && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {reportingController}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▾' : '▸'}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && <EventExpandedDetails event={event} />}
    </Card>
  );
}
