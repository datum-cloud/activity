import { useState, useEffect, useRef } from 'react';
import { SimpleQueryBuilder } from './SimpleQueryBuilder';
import { AuditEventViewer } from './AuditEventViewer';
import { useAuditLogQuery } from '../hooks/useAuditLogQuery';
import type { AuditLogQuerySpec, Event } from '../types';
import type { ActivityApiClient } from '../api/client';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

export interface AuditLogQueryComponentProps {
  client: ActivityApiClient;
  className?: string;
  onEventSelect?: (event: Event) => void;
  initialFilter?: string;
  initialLimit?: number;
}

/**
 * Complete audit log query component with filter builder and results viewer
 */
export function AuditLogQueryComponent({
  client,
  className = '',
  onEventSelect,
  initialFilter,
  initialLimit,
}: AuditLogQueryComponentProps) {
  const [querySpec, setQuerySpec] = useState<AuditLogQuerySpec>({
    filter: initialFilter || '',
    limit: initialLimit || 100,
  });

  const { events, isLoading, error, hasMore, executeQuery, loadMore, reset } =
    useAuditLogQuery({ client });

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  return (
    <Card className={`flex flex-col p-6 ${className}`}>
      <SimpleQueryBuilder
        client={client}
        onFilterChange={async (spec) => {
          setQuerySpec(spec);
          await executeQuery(spec);
        }}
        initialLimit={querySpec.limit}
        disabled={isLoading}
      />

      {error && (
        <Alert variant="destructive" className="my-6">
          <AlertDescription>
            <strong>Error:</strong> {error.message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && events.length === 0 && (
        <div className="flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm">
          <div className="w-5 h-5 border-[3px] border-muted border-t-[hsl(var(--datum-canyon-clay))] rounded-full animate-spin"></div>
          <span>Searching audit logs...</span>
        </div>
      )}

      {!isLoading && events.length === 0 && !error && (
        <div className="p-12 text-center text-muted-foreground">
          <p className="m-0">No audit events found</p>
          <p className="text-sm text-muted-foreground/70 mt-2">Adjust your filters or time range and search again</p>
        </div>
      )}

      {events.length > 0 && (
        <div>
          <AuditEventViewer events={events} onEventSelect={onEventSelect} />

          {/* Load More Trigger for Infinite Scroll */}
          {hasMore && <div ref={loadMoreTriggerRef} className="h-px mt-4" />}

          {isLoading && (
            <div className="flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm">
              <div className="w-5 h-5 border-[3px] border-muted border-t-[hsl(var(--datum-canyon-clay))] rounded-full animate-spin"></div>
              <span>Loading more events...</span>
            </div>
          )}

          {!hasMore && events.length > 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm border-t border-border mt-4">
              End of results
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
