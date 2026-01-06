import { useState, useEffect, useRef } from 'react';
import { SimpleQueryBuilder } from './SimpleQueryBuilder';
import { AuditEventViewer } from './AuditEventViewer';
import { useAuditLogQuery } from '../hooks/useAuditLogQuery';
import type { AuditLogQuerySpec, Event } from '../types';
import type { ActivityApiClient } from '../api/client';

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

  const resultsRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleExecuteQuery = async () => {
    await executeQuery(querySpec);
  };

  const handleReset = () => {
    reset();
    setQuerySpec({ filter: '', limit: 100 });
  };

  // Infinite scroll: detect when user scrolls near bottom
  useEffect(() => {
    const resultsElement = resultsRef.current;
    if (!resultsElement) {
      console.log('[InfiniteScroll] No results element found');
      return;
    }

    console.log('[InfiniteScroll] Setting up scroll listener', { hasMore, isLoading, eventCount: events.length });

    const handleScroll = () => {
      // Don't trigger if already loading or no more data
      if (loadingRef.current || !hasMore || isLoading) {
        console.log('[InfiniteScroll] Skip loading:', { loading: loadingRef.current, hasMore, isLoading });
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = resultsElement;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      console.log('[InfiniteScroll] Scroll detected:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        scrollPercentage: (scrollPercentage * 100).toFixed(1) + '%'
      });

      // Load more when user scrolls to 80% of the content
      if (scrollPercentage > 0.8) {
        console.log('[InfiniteScroll] Triggering loadMore()');
        loadingRef.current = true;
        loadMore().finally(() => {
          loadingRef.current = false;
          console.log('[InfiniteScroll] loadMore() completed');
        });
      }
    };

    resultsElement.addEventListener('scroll', handleScroll);
    return () => {
      console.log('[InfiniteScroll] Removing scroll listener');
      resultsElement.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoading, loadMore, events.length]);

  return (
    <div className={`audit-log-query ${className}`}>
      <div className="query-builder-section">
        <SimpleQueryBuilder
          onFilterChange={async (spec) => {
            setQuerySpec(spec);
            await executeQuery(spec);
          }}
          initialLimit={querySpec.limit}
        />
      </div>

      {error && (
        <div className="query-error">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {events.length > 0 && (
        <div className="query-results-section">
          <div className="results-header">
            <h3>Results ({events.length} events{hasMore ? '+' : ''})</h3>
          </div>

          <div className="results-scroll-container" ref={resultsRef}>
            <AuditEventViewer events={events} onEventSelect={onEventSelect} />

            {isLoading && (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <span>Loading more events...</span>
              </div>
            )}

            {!hasMore && events.length > 0 && (
              <div className="end-of-results">
                End of results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
