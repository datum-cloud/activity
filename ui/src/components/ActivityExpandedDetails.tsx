import { useState } from 'react';
import { format } from 'date-fns';
import { Copy, Check } from 'lucide-react';
import type { Activity, TenantLinkResolver } from '../types/activity';
import { TenantBadge } from './TenantBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export interface ActivityExpandedDetailsProps {
  /** The activity to display details for */
  activity: Activity;
  /** Optional resolver function to make tenant badges clickable */
  tenantLinkResolver?: TenantLinkResolver;
}

/**
 * Format timestamp for display (with timezone)
 */
function formatTimestampFull(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss \'UTC\'');
  } catch {
    return timestamp;
  }
}

/**
 * CopyButton component for copying field values to clipboard
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-opacity cursor-pointer ml-1"
          aria-label={`Copy ${label}`}
        >
          {isCopied ? (
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{isCopied ? 'Copied!' : `Copy ${label}`}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * ActivityExpandedDetails renders the expanded details section for an activity.
 * Used by both feed and timeline variants of ActivityFeedItem for consistent UX.
 *
 * Section order (most to least relevant for investigation):
 * 1. Changes - what changed (most actionable)
 * 2. Timestamp - when it happened
 * 3. Tenant - scope of the activity
 * 4. Actor - who made the change
 * 5. Resource - what resource was affected
 * 6. Origin - correlation to audit logs
 */
export function ActivityExpandedDetails({ activity, tenantLinkResolver }: ActivityExpandedDetailsProps) {
  const { spec, metadata } = activity;
  const { actor, resource, origin, changes, tenant } = spec;
  const timestamp = metadata?.creationTimestamp;

  return (
    <TooltipProvider>
      <div className="mt-4 pt-4 border-t border-border">
        {/* Field Changes - Most actionable, shown first */}
        {changes && changes.length > 0 && (
          <div className="mb-3">
            <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Changes
            </h4>
            <div className="flex flex-col gap-2">
              {changes.map((change, index) => (
                <div key={index} className="p-2 bg-muted rounded text-sm">
                  <span className="block font-semibold text-foreground mb-1 font-mono text-xs">
                    {change.field}
                  </span>
                  {change.old && (
                    <span className="block ml-2 text-red-600 dark:text-red-400 text-xs">
                      <span className="font-medium mr-1">−</span>
                      <span className="line-through">{change.old}</span>
                    </span>
                  )}
                  {change.new && (
                    <span className="block ml-2 text-green-600 dark:text-green-400 text-xs">
                      <span className="font-medium mr-1">+</span>
                      {change.new}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CSS Grid layout with reduced min-width for more columns */}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-x-6 gap-y-2 m-0 text-xs">
        {/* 1. Timestamp */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Timestamp:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{formatTimestampFull(timestamp)}</span>
            <CopyButton value={formatTimestampFull(timestamp)} label="timestamp" />
          </dd>
        </div>

        {/* 2. Actor Type */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Actor Type:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{actor.type}</span>
            <CopyButton value={actor.type} label="actor type" />
          </dd>
        </div>

        {/* 3. Actor */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Actor:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{actor.name}</span>
            <CopyButton value={actor.name} label="actor name" />
          </dd>
        </div>

        {/* 4. API Group */}
        {resource.apiGroup && (
          <div className="flex gap-1 items-baseline">
            <dt className="text-muted-foreground shrink-0">API Group:</dt>
            <dd className="m-0 text-foreground flex items-center min-w-0">
              <span className="truncate">{resource.apiGroup}</span>
              <CopyButton value={resource.apiGroup} label="API group" />
            </dd>
          </div>
        )}

        {/* 5. Resource */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Resource:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{resource.kind}</span>
            <CopyButton value={resource.kind} label="resource kind" />
          </dd>
        </div>

        {/* 6. Resource Name */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Resource Name:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{resource.name}</span>
            <CopyButton value={resource.name} label="resource name" />
          </dd>
        </div>

        {/* 7. Namespace */}
        {resource.namespace && (
          <div className="flex gap-1 items-baseline">
            <dt className="text-muted-foreground shrink-0">Namespace:</dt>
            <dd className="m-0 text-foreground flex items-center min-w-0">
              <span className="truncate">{resource.namespace}</span>
              <CopyButton value={resource.namespace} label="namespace" />
            </dd>
          </div>
        )}

        {/* 8. Resource UID */}
        {resource.uid && (
          <div className="flex gap-1 items-baseline">
            <dt className="text-muted-foreground shrink-0">Resource UID:</dt>
            <dd className="m-0 font-mono text-muted-foreground flex items-center min-w-0">
              <span className="truncate">{resource.uid}</span>
              <CopyButton value={resource.uid} label="resource UID" />
            </dd>
          </div>
        )}

        {/* 9. Origin */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Origin:</dt>
          <dd className="m-0 text-foreground flex items-center min-w-0">
            <span className="truncate">{origin.type}</span>
            <CopyButton value={origin.type} label="origin type" />
          </dd>
        </div>

        {/* 10. Origin ID */}
        <div className="flex gap-1 items-baseline">
          <dt className="text-muted-foreground shrink-0">Origin ID:</dt>
          <dd className="m-0 font-mono text-muted-foreground flex items-center min-w-0">
            <span className="truncate">{origin.id}</span>
            <CopyButton value={origin.id} label="origin ID" />
          </dd>
        </div>
      </dl>
      </div>
    </TooltipProvider>
  );
}
