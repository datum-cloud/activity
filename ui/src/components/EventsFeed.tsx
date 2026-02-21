import React, { useState } from 'react';
import { useEventsFeed } from '../hooks/useEventsFeed';
import { useEventFacets } from '../hooks/useEventFacets';
import type { ActivityApiClient } from '../api/client';
import type { K8sEvent } from '../types/k8s-event';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { TimeRangeDropdown } from './ui/time-range-dropdown';
import { MultiCombobox } from './ui/multi-combobox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, RefreshCw, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface EventsFeedProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Initial time range (default: now-24h) */
  initialTimeRange?: { start: string; end?: string };
  /** Page size (default: 50) */
  pageSize?: number;
  /** Namespace to filter events (optional) */
  namespace?: string;
  /** Enable real-time streaming (default: false) */
  enableStreaming?: boolean;
  /** Show filter controls (default: true) */
  showFilters?: boolean;
  /** Callback when an event is clicked */
  onEventClick?: (event: K8sEvent) => void;
}

/**
 * EventsFeed component - displays Kubernetes events with filtering and real-time updates
 */
export function EventsFeed({
  client,
  initialTimeRange = { start: 'now-24h' },
  pageSize = 50,
  namespace,
  enableStreaming = false,
  showFilters = true,
  onEventClick,
}: EventsFeedProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const {
    events,
    isLoading,
    error,
    hasMore,
    filters,
    timeRange,
    refresh,
    loadMore,
    setFilters,
    setTimeRange,
    isStreaming,
    startStreaming,
    stopStreaming,
    newEventsCount,
  } = useEventsFeed({
    client,
    initialTimeRange,
    pageSize,
    namespace,
    enableStreaming,
    autoStartStreaming: true,
  });

  const facets = useEventFacets(client, timeRange, filters);

  const timeRangePresets = [
    { key: 'now-1h', label: 'Last hour' },
    { key: 'now-6h', label: 'Last 6 hours' },
    { key: 'now-24h', label: 'Last 24 hours' },
    { key: 'now-7d', label: 'Last 7 days' },
    { key: 'now-30d', label: 'Last 30 days' },
  ];

  const handleTimeRangeChange = (preset: string) => {
    setTimeRange({ start: preset });
  };

  const handleCustomTimeRange = (start: string, end: string) => {
    setTimeRange({ start, end });
  };

  const toggleEventExpanded = (eventName: string) => {
    setExpandedEvent(expandedEvent === eventName ? null : eventName);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Events</h2>
          {isStreaming && (
            <Badge variant="outline" className="gap-1">
              <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              Live
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableStreaming && (
            <Button
              variant="outline"
              size="sm"
              onClick={isStreaming ? stopStreaming : startStreaming}
            >
              {isStreaming ? 'Stop Stream' : 'Start Stream'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Time Range Picker */}
      <div className="flex items-center gap-2">
        <Label>Time Range:</Label>
        <TimeRangeDropdown
          presets={timeRangePresets}
          selectedPreset={timeRange.start}
          onPresetSelect={handleTimeRangeChange}
          onCustomRangeApply={handleCustomTimeRange}
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Event Type */}
              <div className="space-y-2">
                <Label>Event Type</Label>
                <MultiCombobox
                  options={[
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Warning', label: 'Warning' },
                  ]}
                  values={filters.eventType && filters.eventType !== 'all' ? [filters.eventType] : []}
                  onValuesChange={(values: string[]) => {
                    setFilters({
                      ...filters,
                      eventType: values.length === 0 ? 'all' : values[0] as 'Normal' | 'Warning',
                    });
                  }}
                  placeholder="All types"
                />
              </div>

              {/* Involved Object Kind */}
              <div className="space-y-2">
                <Label>Resource Kind</Label>
                <MultiCombobox
                  options={facets.involvedKinds.map((k: { value: string; count: number }) => ({
                    value: k.value,
                    label: `${k.value} (${k.count})`,
                  }))}
                  values={filters.involvedKinds || []}
                  onValuesChange={(values: string[]) => {
                    setFilters({ ...filters, involvedKinds: values });
                  }}
                  placeholder="All kinds"
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason</Label>
                <MultiCombobox
                  options={facets.reasons.map((r: { value: string; count: number }) => ({
                    value: r.value,
                    label: `${r.value} (${r.count})`,
                  }))}
                  values={filters.reasons || []}
                  onValuesChange={(values: string[]) => {
                    setFilters({ ...filters, reasons: values });
                  }}
                  placeholder="All reasons"
                />
              </div>

              {/* Namespace */}
              {!namespace && (
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <MultiCombobox
                    options={facets.namespaces.map((n: { value: string; count: number }) => ({
                      value: n.value,
                      label: `${n.value} (${n.count})`,
                    }))}
                    values={filters.namespaces || []}
                    onValuesChange={(values: string[]) => {
                      setFilters({ ...filters, namespaces: values });
                    }}
                    placeholder="All namespaces"
                  />
                </div>
              )}

              {/* Source Component */}
              <div className="space-y-2">
                <Label>Source</Label>
                <MultiCombobox
                  options={facets.sourceComponents.map((c: { value: string; count: number }) => ({
                    value: c.value,
                    label: `${c.value} (${c.count})`,
                  }))}
                  values={filters.sourceComponents || []}
                  onValuesChange={(values: string[]) => {
                    setFilters({ ...filters, sourceComponents: values });
                  }}
                  placeholder="All sources"
                />
              </div>

              {/* Involved Object Name */}
              <div className="space-y-2">
                <Label>Resource Name</Label>
                <Input
                  type="text"
                  placeholder="Filter by name..."
                  value={filters.involvedName || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, involvedName: e.target.value });
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New events banner */}
      {newEventsCount > 0 && (
        <Alert>
          <AlertDescription>
            {newEventsCount} new event{newEventsCount > 1 ? 's' : ''} received.{' '}
            <Button variant="link" size="sm" onClick={refresh} className="p-0 h-auto">
              Refresh to view
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && events.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500">No events found for the selected filters.</p>
            <Button variant="link" onClick={refresh} className="mt-2">
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Events list */}
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((event: K8sEvent) => (
            <EventItem
              key={event.metadata?.name || event.metadata?.uid}
              event={event}
              isExpanded={expandedEvent === event.metadata?.name}
              onToggleExpand={() => toggleEventExpanded(event.metadata?.name || '')}
              onClick={() => onEventClick?.(event)}
            />
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500 text-center">
        Showing {events.length} event{events.length !== 1 ? 's' : ''}
        {hasMore && ' (more available)'}
      </div>
    </div>
  );
}

interface EventItemProps {
  event: K8sEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick?: () => void;
}

function EventItem({ event, isExpanded, onToggleExpand, onClick }: EventItemProps) {
  const isWarning = event.type === 'Warning';
  const timestamp = event.lastTimestamp || event.firstTimestamp || event.eventTime;

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isWarning ? 'border-orange-200 bg-orange-50/50' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isWarning ? (
                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
              <Badge variant={isWarning ? 'destructive' : 'default'} className="flex-shrink-0">
                {event.type || 'Normal'}
              </Badge>
              <Badge variant="outline" className="flex-shrink-0">
                {event.reason || 'Unknown'}
              </Badge>
              {event.count && event.count > 1 && (
                <Badge variant="secondary" className="flex-shrink-0">
                  x{event.count}
                </Badge>
              )}
              <span className="text-xs text-gray-500 flex-shrink-0">
                {timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : ''}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {event.involvedObject.kind}/{event.involvedObject.name}
                </span>
                {event.involvedObject.namespace && (
                  <Badge variant="outline" className="text-xs">
                    {event.involvedObject.namespace}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-700">{event.message}</p>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2 text-xs text-gray-600">
                  {event.source && (
                    <div>
                      <span className="font-medium">Source:</span> {event.source.component}
                      {event.source.host && ` (${event.source.host})`}
                    </div>
                  )}
                  {event.reportingComponent && (
                    <div>
                      <span className="font-medium">Reporting Component:</span>{' '}
                      {event.reportingComponent}
                    </div>
                  )}
                  {event.firstTimestamp && event.lastTimestamp && event.firstTimestamp !== event.lastTimestamp && (
                    <div>
                      <span className="font-medium">First seen:</span>{' '}
                      {formatDistanceToNow(new Date(event.firstTimestamp), { addSuffix: true })}
                    </div>
                  )}
                  {event.action && (
                    <div>
                      <span className="font-medium">Action:</span> {event.action}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
