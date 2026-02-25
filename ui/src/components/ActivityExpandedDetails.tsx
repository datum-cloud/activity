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
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* Field Changes - Most actionable, shown first */}
      {changes && changes.length > 0 && (
        <div>
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

      {/* Timestamp */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Timestamp
        </h4>
        <p className="m-0 text-foreground text-xs">
          {formatTimestampFull(timestamp)}
        </p>
      </div>

      {/* Tenant Information */}
      {tenant && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tenant
          </h4>
          <TenantBadge tenant={tenant} tenantLinkResolver={tenantLinkResolver} />
        </div>
      )}

      {/* Actor Information */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Actor
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Name:</dt>
          <dd className="m-0 text-foreground text-xs break-all">{actor.name}</dd>
          <dt className="text-muted-foreground text-xs">Type:</dt>
          <dd className="m-0 text-foreground text-xs">{actor.type}</dd>
          {actor.email && (
            <>
              <dt className="text-muted-foreground text-xs">Email:</dt>
              <dd className="m-0 text-foreground text-xs break-all">{actor.email}</dd>
            </>
          )}
          <dt className="text-muted-foreground text-xs">UID:</dt>
          <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{actor.uid}</dd>
        </dl>
      </div>

      {/* Resource Information */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Resource
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Kind:</dt>
          <dd className="m-0 text-foreground text-xs">{resource.kind}</dd>
          <dt className="text-muted-foreground text-xs">Name:</dt>
          <dd className="m-0 text-foreground text-xs">{resource.name}</dd>
          {resource.namespace && (
            <>
              <dt className="text-muted-foreground text-xs">Namespace:</dt>
              <dd className="m-0 text-foreground text-xs">{resource.namespace}</dd>
            </>
          )}
          {resource.apiGroup && (
            <>
              <dt className="text-muted-foreground text-xs">API Group:</dt>
              <dd className="m-0 text-foreground text-xs">{resource.apiGroup}</dd>
            </>
          )}
          {resource.uid && (
            <>
              <dt className="text-muted-foreground text-xs">UID:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{resource.uid}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Origin Information */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Origin
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Type:</dt>
          <dd className="m-0 text-foreground text-xs">{origin.type}</dd>
          <dt className="text-muted-foreground text-xs">ID:</dt>
          <dd className="m-0 font-mono text-xs text-muted-foreground break-all">
            {origin.id}
          </dd>
        </dl>
      </div>
    </div>
  );
}
