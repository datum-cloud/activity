import { format } from 'date-fns';
import type { K8sEvent } from '../types/k8s-event';

export interface EventExpandedDetailsProps {
  /** The event to display details for */
  event: K8sEvent;
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
 * Get the regarding object (handling both new and deprecated field names)
 */
function getRegarding(event: K8sEvent) {
  return event.regarding || event.involvedObject || {};
}

/**
 * Get the reporting controller (handling both new and deprecated field names)
 */
function getReportingController(event: K8sEvent): string | undefined {
  return event.reportingController || event.reportingComponent || event.source?.component;
}

/**
 * Get the reporting instance (handling both new and deprecated field names)
 */
function getReportingInstance(event: K8sEvent): string | undefined {
  return event.reportingInstance || event.source?.host;
}

/**
 * EventExpandedDetails renders the expanded details section for an event.
 *
 * Section order (most to least relevant for investigation):
 * 1. Regarding Object - what resource is affected (was involvedObject in core/v1)
 * 2. Timestamps - when it happened
 * 3. Reporting Controller - what component generated the event (was source in core/v1)
 * 4. Action - what action was taken/failed
 * 5. Metadata - event UIDs and versions
 */
export function EventExpandedDetails({ event }: EventExpandedDetailsProps) {
  const regarding = getRegarding(event);
  const reportingController = getReportingController(event);
  const reportingInstance = getReportingInstance(event);
  const { eventTime, action, metadata, related } = event;

  // For backward compatibility, also check deprecated fields
  // Note: events.k8s.io/v1 uses "deprecatedFirstTimestamp" and "deprecatedLastTimestamp"
  const firstTimestamp = event.firstTimestamp || event.deprecatedFirstTimestamp;
  const lastTimestamp = event.lastTimestamp || event.deprecatedLastTimestamp || event.series?.lastObservedTime;
  const count = event.series?.count || event.count || event.deprecatedCount;

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      {/* Regarding Object - Most actionable, shown first (was involvedObject in core/v1) */}
      <div>
        <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Regarding Object
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Kind:</dt>
          <dd className="m-0 text-foreground text-xs">{regarding.kind || 'Unknown'}</dd>
          <dt className="text-muted-foreground text-xs">Name:</dt>
          <dd className="m-0 text-foreground text-xs">{regarding.name || 'Unknown'}</dd>
          {regarding.namespace && (
            <>
              <dt className="text-muted-foreground text-xs">Namespace:</dt>
              <dd className="m-0 text-foreground text-xs">{regarding.namespace}</dd>
            </>
          )}
          {regarding.apiVersion && (
            <>
              <dt className="text-muted-foreground text-xs">API Version:</dt>
              <dd className="m-0 text-foreground text-xs">{regarding.apiVersion}</dd>
            </>
          )}
          {regarding.uid && (
            <>
              <dt className="text-muted-foreground text-xs">UID:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{regarding.uid}</dd>
            </>
          )}
          {regarding.fieldPath && (
            <>
              <dt className="text-muted-foreground text-xs">Field Path:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{regarding.fieldPath}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Timestamps */}
      <div>
        <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Timestamps
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-sm">
          {eventTime && (
            <>
              <dt className="text-muted-foreground text-xs">Event Time:</dt>
              <dd className="m-0 text-foreground text-xs">{formatTimestampFull(eventTime)}</dd>
            </>
          )}
          {firstTimestamp && (
            <>
              <dt className="text-muted-foreground text-xs">First Seen:</dt>
              <dd className="m-0 text-foreground text-xs">{formatTimestampFull(firstTimestamp)}</dd>
            </>
          )}
          {lastTimestamp && (
            <>
              <dt className="text-muted-foreground text-xs">Last Seen:</dt>
              <dd className="m-0 text-foreground text-xs">{formatTimestampFull(lastTimestamp)}</dd>
            </>
          )}
          {count && count > 1 && (
            <>
              <dt className="text-muted-foreground text-xs">Count:</dt>
              <dd className="m-0 text-foreground text-xs">{count} times</dd>
            </>
          )}
        </dl>
      </div>

      {/* Reporting Controller (was Source in core/v1) */}
      {(reportingController || reportingInstance) && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Reporting Controller
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-sm">
            {reportingController && (
              <>
                <dt className="text-muted-foreground text-xs">Controller:</dt>
                <dd className="m-0 text-foreground text-xs">{reportingController}</dd>
              </>
            )}
            {reportingInstance && (
              <>
                <dt className="text-muted-foreground text-xs">Instance:</dt>
                <dd className="m-0 text-foreground text-xs">{reportingInstance}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Action */}
      {action && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Action
          </h4>
          <p className="m-0 text-foreground text-xs">{action}</p>
        </div>
      )}

      {/* Related Object */}
      {related && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Related Object
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-sm">
            {related.kind && (
              <>
                <dt className="text-muted-foreground text-xs">Kind:</dt>
                <dd className="m-0 text-foreground text-xs">{related.kind}</dd>
              </>
            )}
            {related.name && (
              <>
                <dt className="text-muted-foreground text-xs">Name:</dt>
                <dd className="m-0 text-foreground text-xs">{related.name}</dd>
              </>
            )}
            {related.namespace && (
              <>
                <dt className="text-muted-foreground text-xs">Namespace:</dt>
                <dd className="m-0 text-foreground text-xs">{related.namespace}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div>
          <h4 className="m-0 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Metadata
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 m-0 text-sm">
            {metadata.name && (
              <>
                <dt className="text-muted-foreground text-xs">Name:</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{metadata.name}</dd>
              </>
            )}
            {metadata.uid && (
              <>
                <dt className="text-muted-foreground text-xs">UID:</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{metadata.uid}</dd>
              </>
            )}
            {metadata.resourceVersion && (
              <>
                <dt className="text-muted-foreground text-xs">Resource Version:</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{metadata.resourceVersion}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
