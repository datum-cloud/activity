import { useState } from 'react';
import { format } from 'date-fns';
import type { K8sEvent, K8sEventType, ObjectReference } from '../types/k8s-event';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export interface EventsFeedItemProps {
  /** The event to render */
  event: K8sEvent;
  /** Handler called when an involved object is clicked */
  onObjectClick?: (object: ObjectReference) => void;
  /** Handler called when the item is clicked */
  onEventClick?: (event: K8sEvent) => void;
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Whether to show as compact */
  compact?: boolean;
  /** Whether this is a newly streamed event */
  isNew?: boolean;
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
function getEventTypeBadge(type?: K8sEventType): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string } {
  if (type === 'Warning') {
    return {
      variant: 'default',
      className: 'bg-amber-500 hover:bg-amber-500/80 text-white',
    };
  }
  return {
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-500/80 text-white',
  };
}

/**
 * Format involved object display
 */
function formatInvolvedObject(obj?: ObjectReference): string {
  if (!obj) return 'Unknown';
  const parts = [obj.kind, obj.namespace, obj.name].filter(Boolean);
  if (obj.namespace && obj.name) {
    return `${obj.kind || 'Object'} ${obj.namespace}/${obj.name}`;
  }
  if (obj.name) {
    return `${obj.kind || 'Object'} ${obj.name}`;
  }
  return parts.join('/') || 'Unknown';
}

/**
 * EventsFeedItem renders a single Kubernetes event in the feed
 */
export function EventsFeedItem({
  event,
  onObjectClick,
  onEventClick,
  isSelected = false,
  className = '',
  compact = false,
  isNew = false,
}: EventsFeedItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { involvedObject, reason, message, type, source, count, firstTimestamp, lastTimestamp, metadata } = event;
  const eventTypeBadge = getEventTypeBadge(type);

  const handleClick = () => {
    onEventClick?.(event);
  };

  const handleObjectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (involvedObject && onObjectClick) {
      onObjectClick(involvedObject);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const displayTimestamp = lastTimestamp || firstTimestamp || metadata?.creationTimestamp;
  const relativeTime = useRelativeTime(displayTimestamp);

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
        {/* Event Type Badge */}
        <div className="shrink-0">
          <Badge
            variant={eventTypeBadge.variant}
            className={cn('text-xs font-medium', eventTypeBadge.className)}
          >
            {type || 'Normal'}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Message + Timestamp */}
          <div className="flex justify-between items-start gap-4 mb-2">
            <div className={cn('leading-relaxed text-foreground', compact ? 'text-sm' : 'text-[0.9375rem]')}>
              {message || 'No message'}
            </div>
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(displayTimestamp)}
            >
              {relativeTime}
            </span>
          </div>

          {/* Meta info row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {/* Reason */}
            {reason && (
              <Badge variant="outline" className="text-xs font-normal">
                {reason}
              </Badge>
            )}

            {/* Involved Object */}
            <button
              type="button"
              onClick={handleObjectClick}
              className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              {formatInvolvedObject(involvedObject)}
            </button>

            {/* Source Component */}
            {source?.component && (
              <span className="text-muted-foreground">
                via {source.component}
              </span>
            )}

            {/* Count */}
            {count && count > 1 && (
              <span className="text-muted-foreground">
                ({count} times)
              </span>
            )}

            {/* Expand button */}
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
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {/* Event Namespace */}
            {metadata?.namespace && (
              <>
                <span className="text-muted-foreground">Namespace:</span>
                <span className="font-mono text-foreground">{metadata.namespace}</span>
              </>
            )}

            {/* Event Name */}
            {metadata?.name && (
              <>
                <span className="text-muted-foreground">Event Name:</span>
                <span className="font-mono text-foreground truncate" title={metadata.name}>
                  {metadata.name}
                </span>
              </>
            )}

            {/* Involved Object UID */}
            {involvedObject?.uid && (
              <>
                <span className="text-muted-foreground">Object UID:</span>
                <span className="font-mono text-foreground truncate" title={involvedObject.uid}>
                  {involvedObject.uid}
                </span>
              </>
            )}

            {/* Field Path */}
            {involvedObject?.fieldPath && (
              <>
                <span className="text-muted-foreground">Field Path:</span>
                <span className="font-mono text-foreground">{involvedObject.fieldPath}</span>
              </>
            )}

            {/* Source Host */}
            {source?.host && (
              <>
                <span className="text-muted-foreground">Source Host:</span>
                <span className="font-mono text-foreground">{source.host}</span>
              </>
            )}

            {/* First Timestamp */}
            {firstTimestamp && (
              <>
                <span className="text-muted-foreground">First Seen:</span>
                <span className="text-foreground">{formatTimestampFull(firstTimestamp)}</span>
              </>
            )}

            {/* Last Timestamp */}
            {lastTimestamp && (
              <>
                <span className="text-muted-foreground">Last Seen:</span>
                <span className="text-foreground">{formatTimestampFull(lastTimestamp)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
