import { format } from 'date-fns';
import type { Event } from '../types';

export interface AuditLogExpandedDetailsProps {
  /** The audit event to display details for */
  event: Event;
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
 * AuditLogExpandedDetails renders the expanded details section for an audit log event.
 *
 * Section order (most to least relevant for investigation):
 * 1. Request Summary (verb, URI)
 * 2. Response Summary (status code with icon, message)
 * 3. Timestamp (full)
 * 4. User (username, UID, groups)
 * 5. Resource (kind, name, namespace, API group)
 * 6. Request Details (user agent, source IPs)
 * 7. Advanced (collapsed) - audit ID, stage, level, annotations
 * 8. Raw Objects (collapsed) - request/response JSON
 */
export function AuditLogExpandedDetails({ event }: AuditLogExpandedDetailsProps) {
  const timestamp = event.stageTimestamp || event.requestReceivedTimestamp;

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* Request Summary */}
      <div>
        <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Request Summary
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
          <dt className="text-muted-foreground text-xs">Verb:</dt>
          <dd className="m-0 text-foreground text-xs">{event.verb || 'Unknown'}</dd>
          {event.requestURI && (
            <>
              <dt className="text-muted-foreground text-xs">URI:</dt>
              <dd className="m-0 font-mono text-xs text-foreground break-all">{event.requestURI}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Response Summary */}
      {event.responseStatus && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Response Summary
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
            {event.responseStatus.code !== undefined && (
              <>
                <dt className="text-muted-foreground text-xs">Status Code:</dt>
                <dd className="m-0 text-foreground text-xs">
                  <span
                    className={
                      event.responseStatus.code >= 200 && event.responseStatus.code < 300
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {event.responseStatus.code >= 200 && event.responseStatus.code < 300 ? '✓ ' : '✗ '}
                    {event.responseStatus.code}
                  </span>
                </dd>
              </>
            )}
            {event.responseStatus.status && (
              <>
                <dt className="text-muted-foreground text-xs">Status:</dt>
                <dd className="m-0 text-foreground text-xs">{event.responseStatus.status}</dd>
              </>
            )}
            {event.responseStatus.message && (
              <>
                <dt className="text-muted-foreground text-xs">Message:</dt>
                <dd className="m-0 text-foreground text-xs">{event.responseStatus.message}</dd>
              </>
            )}
            {event.responseStatus.reason && (
              <>
                <dt className="text-muted-foreground text-xs">Reason:</dt>
                <dd className="m-0 text-foreground text-xs">{event.responseStatus.reason}</dd>
              </>
            )}
          </dl>
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

      {/* User Information */}
      {event.user ? (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            User
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
            {event.user.username && (
              <>
                <dt className="text-muted-foreground text-xs">Username:</dt>
                <dd className="m-0 text-foreground text-xs break-all">{event.user.username}</dd>
              </>
            )}
            {event.user.uid && (
              <>
                <dt className="text-muted-foreground text-xs">UID:</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{event.user.uid}</dd>
              </>
            )}
            {event.user.groups && event.user.groups.length > 0 && (
              <>
                <dt className="text-muted-foreground text-xs">Groups:</dt>
                <dd className="m-0 text-foreground text-xs">
                  {event.user.groups.join(', ')}
                </dd>
              </>
            )}
          </dl>
        </div>
      ) : null}

      {/* Resource Information */}
      {event.objectRef && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Resource
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
            {event.objectRef.resource && (
              <>
                <dt className="text-muted-foreground text-xs">Kind:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.resource}</dd>
              </>
            )}
            {event.objectRef.name && (
              <>
                <dt className="text-muted-foreground text-xs">Name:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.name}</dd>
              </>
            )}
            {event.objectRef.namespace && (
              <>
                <dt className="text-muted-foreground text-xs">Namespace:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.namespace}</dd>
              </>
            )}
            {event.objectRef.apiGroup && (
              <>
                <dt className="text-muted-foreground text-xs">API Group:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.apiGroup}</dd>
              </>
            )}
            {event.objectRef.apiVersion && (
              <>
                <dt className="text-muted-foreground text-xs">API Version:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.apiVersion}</dd>
              </>
            )}
            {event.objectRef.uid && (
              <>
                <dt className="text-muted-foreground text-xs">UID:</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{event.objectRef.uid}</dd>
              </>
            )}
            {event.objectRef.subresource && (
              <>
                <dt className="text-muted-foreground text-xs">Subresource:</dt>
                <dd className="m-0 text-foreground text-xs">{event.objectRef.subresource}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Request Details */}
      {(event.userAgent || (event.sourceIPs && event.sourceIPs.length > 0)) && (
        <div>
          <h4 className="m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Request Details
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
            {event.userAgent && (
              <>
                <dt className="text-muted-foreground text-xs">User Agent:</dt>
                <dd className="m-0 font-mono text-xs text-foreground break-all">{event.userAgent}</dd>
              </>
            )}
            {event.sourceIPs && event.sourceIPs.length > 0 && (
              <>
                <dt className="text-muted-foreground text-xs">Source IPs:</dt>
                <dd className="m-0 text-foreground text-xs">{event.sourceIPs.join(', ')}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Advanced Details (collapsed) */}
      {(event.auditID || event.stage || event.level || (event.annotations && Object.keys(event.annotations).length > 0)) && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <h4 className="inline-flex items-center m-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
              <span className="mr-1 group-open:rotate-90 transition-transform">▸</span>
              Advanced
            </h4>
          </summary>
          <div className="mt-2 pl-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm">
              {event.auditID && (
                <>
                  <dt className="text-muted-foreground text-xs">Audit ID:</dt>
                  <dd className="m-0 font-mono text-xs text-muted-foreground break-all">{event.auditID}</dd>
                </>
              )}
              {event.stage && (
                <>
                  <dt className="text-muted-foreground text-xs">Stage:</dt>
                  <dd className="m-0 text-foreground text-xs">{event.stage}</dd>
                </>
              )}
              {event.level && (
                <>
                  <dt className="text-muted-foreground text-xs">Level:</dt>
                  <dd className="m-0 text-foreground text-xs">{event.level}</dd>
                </>
              )}
              {event.annotations && Object.entries(event.annotations).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground text-xs">{key}:</dt>
                  <dd className="m-0 text-foreground text-xs break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      )}

      {/* Raw Objects (collapsed) */}
      {(event.requestObject || event.responseObject) ? (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <h4 className="inline-flex items-center m-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
              <span className="mr-1 group-open:rotate-90 transition-transform">▸</span>
              Raw Objects
            </h4>
          </summary>
          <div className="mt-2 pl-4 space-y-2">
            {event.requestObject ? (
              <div>
                <h5 className="m-0 mb-1 text-xs font-semibold text-muted-foreground">Request Object</h5>
                <pre className="m-0 p-3 bg-muted rounded overflow-x-auto text-xs font-mono">
                  {JSON.stringify(event.requestObject, null, 2)}
                </pre>
              </div>
            ) : null}
            {event.responseObject ? (
              <div>
                <h5 className="m-0 mb-1 text-xs font-semibold text-muted-foreground">Response Object</h5>
                <pre className="m-0 p-3 bg-muted rounded overflow-x-auto text-xs font-mono">
                  {JSON.stringify(event.responseObject, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
