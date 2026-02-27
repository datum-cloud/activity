import { format } from 'date-fns';
import type { Activity, TenantLinkResolver } from '../types/activity';
import { TenantBadge } from './TenantBadge';

export interface ActivityExpandedDetailsProps {
  /** The activity to display details for */
  activity: Activity;
  /** Optional resolver function to make tenant badges clickable */
  tenantLinkResolver?: TenantLinkResolver;
}

/**
 * Format timestamp for display
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

      {/* Compact multi-column grid layout for metadata fields */}
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 m-0 text-xs">
        {/* Timestamp - Primary info, shown first */}
        <div className="contents">
          <dt className="text-muted-foreground font-semibold">Timestamp:</dt>
          <dd className="m-0 text-foreground md:col-span-1 lg:col-span-2">
            {formatTimestampFull(timestamp)}
          </dd>
        </div>

        {/* Tenant - If present, show prominently */}
        {tenant && (
          <div className="contents">
            <dt className="text-muted-foreground font-semibold">Tenant:</dt>
            <dd className="m-0 md:col-span-1 lg:col-span-2">
              <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} />
            </dd>
          </div>
        )}

        {/* Actor Information - Grouped together */}
        <div className="contents">
          <dt className="text-muted-foreground font-semibold">Actor:</dt>
          <dd className="m-0 text-foreground break-all">{actor.name}</dd>
        </div>

        <div className="contents">
          <dt className="text-muted-foreground">Actor Type:</dt>
          <dd className="m-0 text-foreground">{actor.type}</dd>
        </div>

        {actor.email && (
          <div className="contents">
            <dt className="text-muted-foreground">Actor Email:</dt>
            <dd className="m-0 text-foreground break-all">{actor.email}</dd>
          </div>
        )}

        {/* Resource Information - Grouped together */}
        <div className="contents">
          <dt className="text-muted-foreground font-semibold">Resource:</dt>
          <dd className="m-0 text-foreground">{resource.kind}</dd>
        </div>

        <div className="contents">
          <dt className="text-muted-foreground">Resource Name:</dt>
          <dd className="m-0 text-foreground">{resource.name}</dd>
        </div>

        {resource.namespace && (
          <div className="contents">
            <dt className="text-muted-foreground">Namespace:</dt>
            <dd className="m-0 text-foreground">{resource.namespace}</dd>
          </div>
        )}

        {resource.apiGroup && (
          <div className="contents">
            <dt className="text-muted-foreground">API Group:</dt>
            <dd className="m-0 text-foreground">{resource.apiGroup}</dd>
          </div>
        )}

        {/* Origin Information */}
        <div className="contents">
          <dt className="text-muted-foreground font-semibold">Origin Type:</dt>
          <dd className="m-0 text-foreground">{origin.type}</dd>
        </div>

        {/* UIDs and IDs - Less prominent, monospace */}
        {actor.uid && (
          <div className="contents">
            <dt className="text-muted-foreground">Actor UID:</dt>
            <dd className="m-0 font-mono text-muted-foreground break-all md:col-span-1 lg:col-span-2">
              {actor.uid}
            </dd>
          </div>
        )}

        {resource.uid && (
          <div className="contents">
            <dt className="text-muted-foreground">Resource UID:</dt>
            <dd className="m-0 font-mono text-muted-foreground break-all md:col-span-1 lg:col-span-2">
              {resource.uid}
            </dd>
          </div>
        )}

        <div className="contents">
          <dt className="text-muted-foreground">Origin ID:</dt>
          <dd className="m-0 font-mono text-muted-foreground break-all md:col-span-1 lg:col-span-2">
            {origin.id}
          </dd>
        </div>
      </dl>
    </div>
  );
}
