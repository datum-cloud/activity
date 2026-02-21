import { format } from 'date-fns';
import type { K8sEvent } from '../types/k8s-event';

export interface EventExpandedDetailsProps {
  /** The event to display details for */
  event: K8sEvent;
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
 * EventExpandedDetails renders the expanded details section for an event.
 *
 * Section order (most to least relevant for investigation):
 * 1. Involved Object - what resource is affected
 * 2. Timestamps - when it happened (first/last)
 * 3. Source - what component generated the event
 * 4. Action - what action was taken/failed
 * 5. Metadata - event UIDs and versions
 */
export function EventExpandedDetails({ event }: EventExpandedDetailsProps) {
  const { involvedObject, source, firstTimestamp, lastTimestamp, eventTime, action, reportingComponent, reportingInstance, count, metadata, related } = event;

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* Involved Object - Most actionable, shown first */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Involved Object
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Kind:</dt>
          <dd className="m-0 text-foreground text-xs">{involvedObject.kind || 'Unknown'}</dd>
          <dt className="text-muted-foreground text-xs">Name:</dt>
          <dd className="m-0 text-foreground text-xs">{involvedObject.name || 'Unknown'}</dd>
          {involvedObject.namespace && (
            <>
              <dt className="text-muted-foreground text-xs">Namespace:</dt>
              <dd className="m-0 text-foreground text-xs">{involvedObject.namespace}</dd>
            </>
          )}
          {involvedObject.apiVersion && (
            <>
              <dt className="text-muted-foreground text-xs">API Version:</dt>
              <dd className="m-0 text-foreground text-xs">{involvedObject.apiVersion}</dd>
            </>
          )}
          {involvedObject.uid && (
            <>
              <dt className="text-muted-foreground text-xs">UID:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{involvedObject.uid}</dd>
            </>
          )}
          {involvedObject.fieldPath && (
            <>
              <dt className="text-muted-foreground text-xs">Field Path:</dt>
              <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{involvedObject.fieldPath}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Timestamps */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Timestamps
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
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

      {/* Source Information */}
      {(source || reportingComponent) && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Source
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
            {source?.component && (
              <>
                <dt className="text-muted-foreground text-xs">Component:</dt>
                <dd className="m-0 text-foreground text-xs">{source.component}</dd>
              </>
            )}
            {source?.host && (
              <>
                <dt className="text-muted-foreground text-xs">Host:</dt>
                <dd className="m-0 text-foreground text-xs">{source.host}</dd>
              </>
            )}
            {reportingComponent && (
              <>
                <dt className="text-muted-foreground text-xs">Reporting Component:</dt>
                <dd className="m-0 text-foreground text-xs">{reportingComponent}</dd>
              </>
            )}
            {reportingInstance && (
              <>
                <dt className="text-muted-foreground text-xs">Reporting Instance:</dt>
                <dd className="m-0 text-foreground text-xs">{reportingInstance}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Action */}
      {action && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Action
          </h4>
          <p className="m-0 text-foreground text-xs">{action}</p>
        </div>
      )}

      {/* Related Object */}
      {related && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Related Object
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
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
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Metadata
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
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
