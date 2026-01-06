import { useState } from 'react';
import { format } from 'date-fns';
import type { Event } from '../types';

export interface AuditEventViewerProps {
  events: Event[];
  className?: string;
  onEventSelect?: (event: Event) => void;
}

/**
 * AuditEventViewer displays a list of audit events with details
 */
export function AuditEventViewer({
  events,
  className = '',
  onEventSelect,
}: AuditEventViewerProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpansion = (auditId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (expandedEvents.has(auditId)) {
      newExpanded.delete(auditId);
    } else {
      newExpanded.add(auditId);
    }
    setExpandedEvents(newExpanded);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    try {
      return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const getVerbBadgeClass = (verb?: string) => {
    switch (verb?.toLowerCase()) {
      case 'create':
        return 'verb-badge verb-create';
      case 'update':
      case 'patch':
        return 'verb-badge verb-update';
      case 'delete':
        return 'verb-badge verb-delete';
      case 'get':
      case 'list':
      case 'watch':
        return 'verb-badge verb-read';
      default:
        return 'verb-badge';
    }
  };

  if (events.length === 0) {
    return (
      <div className={`audit-event-viewer ${className}`}>
        <div className="no-events">No events found</div>
      </div>
    );
  }

  return (
    <div className={`audit-event-viewer ${className}`}>
      <div className="event-list">
        {events.map((event) => {
          const auditId = event.auditID || '';
          const isExpanded = expandedEvents.has(auditId);

          return (
            <div
              key={auditId}
              className={`event-item ${selectedEvent?.auditID === auditId ? 'selected' : ''}`}
              onClick={() => handleEventClick(event)}
            >
              <div className="event-summary">
                <div className="event-main-info">
                  <span className={getVerbBadgeClass(event.verb)}>
                    {event.verb?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <span className="event-resource">
                    {event.objectRef?.resource || 'N/A'}
                  </span>
                  {event.objectRef?.namespace && (
                    <span className="event-namespace">
                      ns: {event.objectRef.namespace}
                    </span>
                  )}
                  {event.objectRef?.name && (
                    <span className="event-name">{event.objectRef.name}</span>
                  )}
                </div>
                <div className="event-meta-info">
                  <span className="event-user">{event.user?.username || 'N/A'}</span>
                  <span className="event-timestamp">
                    {formatTimestamp(event.stageTimestamp)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEventExpansion(auditId);
                    }}
                    className="expand-toggle"
                    type="button"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="event-details">
                  <div className="detail-section">
                    <h4>Event Information</h4>
                    <dl>
                      <dt>Audit ID:</dt>
                      <dd>{event.auditID || 'N/A'}</dd>
                      <dt>Stage:</dt>
                      <dd>{event.stage || 'N/A'}</dd>
                      <dt>Level:</dt>
                      <dd>{event.level || 'N/A'}</dd>
                      <dt>Request URI:</dt>
                      <dd className="uri">{event.requestURI || 'N/A'}</dd>
                      {event.userAgent && (
                        <>
                          <dt>User Agent:</dt>
                          <dd className="user-agent">{event.userAgent}</dd>
                        </>
                      )}
                      {event.sourceIPs && event.sourceIPs.length > 0 && (
                        <>
                          <dt>Source IPs:</dt>
                          <dd>{event.sourceIPs.join(', ')}</dd>
                        </>
                      )}
                    </dl>
                  </div>

                  {event.user && (
                    <div className="detail-section">
                      <h4>User Information</h4>
                      <dl>
                        <dt>Username:</dt>
                        <dd>{event.user.username || 'N/A'}</dd>
                        <dt>UID:</dt>
                        <dd>{event.user.uid || 'N/A'}</dd>
                        {event.user.groups && event.user.groups.length > 0 && (
                          <>
                            <dt>Groups:</dt>
                            <dd>{event.user.groups.join(', ')}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}

                  {event.responseStatus && (
                    <div className="detail-section">
                      <h4>Response Status</h4>
                      <dl>
                        <dt>Code:</dt>
                        <dd>{event.responseStatus.code || 'N/A'}</dd>
                        <dt>Status:</dt>
                        <dd>{event.responseStatus.status || 'N/A'}</dd>
                        {event.responseStatus.message && (
                          <>
                            <dt>Message:</dt>
                            <dd>{event.responseStatus.message}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}

                  {event.annotations && Object.keys(event.annotations).length > 0 && (
                    <div className="detail-section">
                      <h4>Annotations</h4>
                      <dl>
                        {Object.entries(event.annotations).map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}:</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {(event.requestObject || event.responseObject) ? (
                    <div className="detail-section">
                      <h4>Request/Response Data</h4>
                      {event.requestObject ? (
                        <details>
                          <summary>Request Object</summary>
                          <pre>{JSON.stringify(event.requestObject, null, 2)}</pre>
                        </details>
                      ) : null}
                      {event.responseObject ? (
                        <details>
                          <summary>Response Object</summary>
                          <pre>{JSON.stringify(event.responseObject, null, 2)}</pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
