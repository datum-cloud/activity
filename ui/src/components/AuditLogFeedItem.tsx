import { useState } from 'react';
import type { Event } from '../types';
import { AuditLogExpandedDetails } from './AuditLogExpandedDetails';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { TableCell, TableRow } from '@datum-cloud/datum-ui/table';
import { Timestamp } from './Timestamp';

// Number of columns rendered for the audit log table. Used by the colSpan
// on the expanded-detail row so it spans the full width.
export const AUDIT_LOG_COLUMN_COUNT = 5;

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
 * Get Tailwind classes for verb badge
 */
function getVerbBadgeClasses(verb?: string): string {
  const baseClasses = 'text-[0.55rem] h-5 px-2 py-1 leading-3';
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
    <>
      <TableRow
        data-state={isSelected ? 'selected' : undefined}
        className={cn(
          'cursor-pointer',
          isNew && 'bg-green-50/40 dark:bg-green-950/20',
          className
        )}
        onClick={(e) => {
          toggleExpand(e);
          handleClick();
        }}
        aria-expanded={isExpanded}
      >
        <TableCell className="py-2 align-middle whitespace-nowrap">
          <Badge className={getVerbBadgeClasses(event.verb)}>
            {event.verb?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </TableCell>
        <TableCell
          className="py-2 align-middle"
          style={{ width: '100%', maxWidth: 0, overflow: 'hidden' }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="text-sm leading-snug"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {summary}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[480px] whitespace-normal break-words">
              {summary}
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="py-2 align-middle whitespace-nowrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold',
              statusIndicator.className
            )}
          >
            <span>{statusIndicator.icon}</span>
            {event.responseStatus?.code ? <span>{event.responseStatus.code}</span> : null}
          </span>
        </TableCell>
        <TableCell className="py-2 align-middle whitespace-nowrap text-sm text-muted-foreground">
          <Timestamp value={timestamp} />
        </TableCell>
        <TableCell className="py-2 align-middle w-10">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-6 w-6 p-0 text-base text-muted-foreground hover:text-foreground"
            onClick={toggleExpand}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={AUDIT_LOG_COLUMN_COUNT} className="p-0">
            <AuditLogExpandedDetails event={event} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
