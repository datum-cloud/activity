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
 * Get actor initials from username
 */
function getActorInitials(username?: string): string {
  if (!username) return '?';

  // Handle system accounts
  if (username.startsWith('system:')) {
    return 'SYS';
  }

  const parts = username.split(/[@\s.:-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Determine user type from username
 */
function getUserType(username?: string): 'user' | 'service-account' | 'system' {
  if (!username) return 'system';
  if (username.startsWith('system:')) return 'system';
  if (username.includes('serviceaccount') || username.startsWith('system:serviceaccount:')) return 'service-account';
  return 'user';
}

/**
 * Get Tailwind classes for actor avatar based on user type
 */
function getActorAvatarClasses(username?: string, compact?: boolean): string {
  const userType = getUserType(username);
  const baseClasses = cn(
    'rounded-full flex items-center justify-center shrink-0 font-semibold',
    compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  );

  switch (userType) {
    case 'user':
      return cn(baseClasses, 'bg-lime-200 text-slate-900 dark:bg-lime-800 dark:text-lime-100');
    case 'service-account':
      return cn(baseClasses, 'bg-muted text-muted-foreground');
    case 'system':
      return cn(baseClasses, 'bg-rose-300 text-slate-900 dark:bg-rose-800 dark:text-rose-100');
    default:
      return cn(baseClasses, 'bg-muted text-muted-foreground');
  }
}

/**
 * Get Tailwind classes for verb badge
 */
function getVerbBadgeClasses(verb?: string): string {
  const baseClasses = 'text-xs h-5';
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
          className={getActorAvatarClasses(event.user?.username, compact)}
          title={event.user?.username || 'Unknown'}
        >
          <span className="uppercase">{getActorInitials(event.user?.username)}</span>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Summary + Timestamp */}
          <div className="flex justify-between items-start gap-4 mb-2">
            <div className={cn('leading-relaxed', compact ? 'text-sm' : 'text-[0.9375rem]')}>
              {summary}
            </div>
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              title={formatTimestampFull(timestamp)}
            >
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Meta info row: Verb badge, Response status, Expand button */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Badge className={getVerbBadgeClasses(event.verb)}>
              {event.verb?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <span className={cn('inline-flex items-center gap-1', statusIndicator.className)}>
              <span className="font-semibold">{statusIndicator.icon}</span>
              {event.responseStatus?.code && (
                <span>{event.responseStatus.code}</span>
              )}
            </span>
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
      {isExpanded && <AuditLogExpandedDetails event={event} />}
    </Card>
  );
}
