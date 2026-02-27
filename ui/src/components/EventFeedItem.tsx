import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { K8sEvent } from '../types/k8s-event';
import { EventExpandedDetails } from './EventExpandedDetails';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export interface EventFeedItemProps {
  /** The event to render */
  event: K8sEvent;
  /** Handler called when the item is clicked */
  onEventClick?: (event: K8sEvent) => void;
  /** Handler called when the resource name is clicked. If provided, the resource name becomes clickable. */
  onResourceClick?: (resource: {
    kind: string;
    name: string;
    namespace?: string;
    uid?: string;
  }) => void;
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
  return event.series?.count || event.count || event.deprecatedCount;
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
  // For single events, use eventTime (eventsv1) or fall back to deprecated/legacy fields
  // Note: events.k8s.io/v1 uses "deprecatedFirstTimestamp" and "deprecatedLastTimestamp"
  return (
    event.eventTime ||
    event.deprecatedLastTimestamp ||
    event.deprecatedFirstTimestamp ||
    event.lastTimestamp ||
    event.firstTimestamp
  );
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
 * EventFeedItem renders a single Kubernetes event in the feed
 */
export function EventFeedItem({
  event,
  onEventClick,
  onResourceClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
  defaultExpanded = false,
}: EventFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);

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

  const handleCopyResourceName = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (regarding.name) {
      try {
        await navigator.clipboard.writeText(regarding.name);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy resource name:', err);
      }
    }
  };

  const handleResourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onResourceClick && regarding.name) {
      onResourceClick({
        kind: regarding.kind || 'Unknown',
        name: regarding.name,
        namespace: regarding.namespace,
        uid: regarding.uid,
      });
    }
  };

  const isWarning = type === 'Warning';

  return (
    <TooltipProvider delayDuration={0}>
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200',
          'hover:border-gray-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-gray-600',
          compact ? 'p-2 mb-1.5' : 'p-2.5 mb-2',
          isSelected && 'border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50',
          isNew && 'border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30',
          isWarning && !isSelected && 'border-red-300 dark:border-red-600',
          className
        )}
        onClick={handleClick}
      >
        <div className="flex gap-2">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Single row layout: Message + Object + Timestamp + Expand */}
            <div className="flex items-center gap-2">
              {/* Note with count - takes remaining space */}
              {note && (
                <p className="text-xs text-muted-foreground leading-snug m-0 flex-1 min-w-0 truncate" title={note}>
                  {note}{count && count > 1 && <span className="text-xs text-muted-foreground"> (x{count})</span>}
                </p>
              )}

              {/* Regarding Object with Tooltip and Copy Button */}
              <div className="group flex items-center gap-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "text-xs font-medium text-foreground whitespace-nowrap truncate min-w-0 max-w-[120px]",
                        onResourceClick && "cursor-pointer hover:underline hover:text-primary transition-colors"
                      )}
                      onClick={onResourceClick ? handleResourceClick : undefined}
                    >
                      {regarding.name || 'Unknown'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {regarding.namespace
                        ? `${regarding.kind || 'Unknown'} in namespace ${regarding.namespace}`
                        : regarding.kind || 'Unknown'}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyResourceName}
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-opacity cursor-pointer"
                      aria-label="Copy resource name"
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Click to copy</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Timestamp */}
              <span
                className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0"
                title={formatTimestampFull(timestamp)}
              >
                {formatTimestamp(timestamp)}
              </span>

              {/* Expand button - larger and positioned at the end */}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 py-0 px-1 text-muted-foreground hover:text-foreground shrink-0"
                onClick={toggleExpand}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && <EventExpandedDetails event={event} />}
      </Card>
    </TooltipProvider>
  );
}
