import { useState, useCallback, useEffect, useRef } from 'react';
import { formatISO, subDays } from 'date-fns';
import type { ActivityApiClient } from '../api/client';
import type { K8sEventType } from '../types/k8s-event';
import type { EventsFeedFilters as FilterState, TimeRange } from '../hooks/useEventsFeed';
import { useEventFacets } from '../hooks/useEventFacets';
import { EventTypeToggle, type EventTypeOption } from './EventTypeToggle';
import { cn } from '../lib/utils';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { MultiCombobox } from './ui/multi-combobox';
import { TimeRangeDropdown } from './ui/time-range-dropdown';

// Debounce delay for name input (ms)
const NAME_DEBOUNCE_MS = 300;

export interface EventsFeedFiltersProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Current filter settings */
  filters: FilterState;
  /** Current time range */
  timeRange: TimeRange;
  /** Handler called when filters change */
  onFiltersChange: (filters: FilterState) => void;
  /** Handler called when time range changes */
  onTimeRangeChange: (timeRange: TimeRange) => void;
  /** Whether the filters are disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Preset time ranges
 */
const TIME_PRESETS = [
  { key: 'now-1h', label: 'Last hour' },
  { key: 'now-24h', label: 'Last 24 hours' },
  { key: 'now-7d', label: 'Last 7 days' },
  { key: 'now-30d', label: 'Last 30 days' },
];

/**
 * Helper function to convert ISO string to datetime-local format
 */
const formatDatetimeLocal = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Check if the current time range matches a preset
 */
const getSelectedPreset = (timeRange: TimeRange): string => {
  const preset = TIME_PRESETS.find((p) => timeRange.start === p.key);
  return preset ? preset.key : 'custom';
};

/**
 * EventsFeedFilters provides filter controls for the events feed
 */
export function EventsFeedFilters({
  client,
  filters,
  timeRange,
  onFiltersChange,
  onTimeRangeChange,
  disabled = false,
  className = '',
}: EventsFeedFiltersProps) {
  // Fetch facets for filter dropdowns
  const {
    involvedKinds,
    reasons,
    sourceComponents,
    namespaces,
    isLoading: facetsLoading,
    error: facetsError,
  } = useEventFacets(client, timeRange, filters);

  // Log facets error for debugging
  if (facetsError) {
    console.error('Failed to load event facets:', facetsError);
  }

  const [involvedNameValue, setInvolvedNameValue] = useState(filters.involvedName || '');
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom time range state
  const selectedPreset = getSelectedPreset(timeRange);
  const [customStart, setCustomStart] = useState(() => {
    if (selectedPreset === 'custom') {
      return formatDatetimeLocal(timeRange.start);
    }
    return formatDatetimeLocal(formatISO(subDays(new Date(), 1)));
  });
  const [customEnd, setCustomEnd] = useState(() => {
    if (selectedPreset === 'custom' && timeRange.end) {
      return formatDatetimeLocal(timeRange.end);
    }
    return formatDatetimeLocal(formatISO(new Date()));
  });

  // Sync involved name value when filters change externally
  useEffect(() => {
    if (filters.involvedName !== involvedNameValue) {
      setInvolvedNameValue(filters.involvedName || '');
    }
  }, [filters.involvedName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) {
        clearTimeout(nameDebounceRef.current);
      }
    };
  }, []);

  // Handle event type change
  const handleEventTypeChange = useCallback(
    (value: EventTypeOption) => {
      onFiltersChange({
        ...filters,
        eventType: value === 'all' ? undefined : (value as K8sEventType),
      });
    },
    [filters, onFiltersChange]
  );

  // Handle time range preset selection
  const handleTimePresetSelect = useCallback(
    (presetKey: string) => {
      onTimeRangeChange({
        start: presetKey,
        end: undefined,
      });
    },
    [onTimeRangeChange]
  );

  // Handle custom time range apply
  const handleCustomRangeApply = useCallback(
    (start: string, end: string) => {
      setCustomStart(start);
      setCustomEnd(end);
      onTimeRangeChange({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
    },
    [onTimeRangeChange]
  );

  // Handle namespaces change (multi-select)
  const handleNamespacesChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      namespaces: values.length > 0 ? values : undefined,
    });
  };

  // Handle involved kinds change (multi-select)
  const handleInvolvedKindsChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      involvedKinds: values.length > 0 ? values : undefined,
    });
  };

  // Handle reasons change (multi-select)
  const handleReasonsChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      reasons: values.length > 0 ? values : undefined,
    });
  };

  // Handle source components change (multi-select)
  const handleSourceComponentsChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      sourceComponents: values.length > 0 ? values : undefined,
    });
  };

  // Handle involved name change with debouncing
  const handleInvolvedNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInvolvedNameValue(value);

      // Cancel any pending debounced update
      if (nameDebounceRef.current) {
        clearTimeout(nameDebounceRef.current);
      }

      // Debounce the filter update
      nameDebounceRef.current = setTimeout(() => {
        nameDebounceRef.current = null;
        onFiltersChange({
          ...filters,
          involvedName: value || undefined,
        });
      }, NAME_DEBOUNCE_MS);
    },
    [filters, onFiltersChange]
  );

  // Handle involved name clear - immediate update
  const handleInvolvedNameClear = useCallback(() => {
    if (nameDebounceRef.current) {
      clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = null;
    }

    setInvolvedNameValue('');
    onFiltersChange({
      ...filters,
      involvedName: undefined,
    });
  }, [filters, onFiltersChange]);

  // Get display label for time range
  const getTimeRangeLabel = () => {
    const preset = TIME_PRESETS.find((p) => p.key === selectedPreset);
    if (preset) return preset.label;
    if (selectedPreset === 'custom' && timeRange.start && timeRange.end) {
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return 'Select time range';
  };

  return (
    <div className={cn('mb-6 pb-6 border-b border-border', className)}>
      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Event Type Toggle */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Type
          </Label>
          <EventTypeToggle
            value={filters.eventType || 'all'}
            onChange={handleEventTypeChange}
            disabled={disabled}
          />
        </div>

        {/* Namespace */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Namespace
          </Label>
          <MultiCombobox
            options={namespaces
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.namespaces || []}
            onValuesChange={handleNamespacesChange}
            placeholder="All"
            searchPlaceholder="Search namespaces..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Involved Kind */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Kind
          </Label>
          <MultiCombobox
            options={involvedKinds
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.involvedKinds || []}
            onValuesChange={handleInvolvedKindsChange}
            placeholder="All"
            searchPlaceholder="Search kinds..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Reason */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Reason
          </Label>
          <MultiCombobox
            options={reasons
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.reasons || []}
            onValuesChange={handleReasonsChange}
            placeholder="All"
            searchPlaceholder="Search reasons..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Source Component */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Source
          </Label>
          <MultiCombobox
            options={sourceComponents
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.sourceComponents || []}
            onValuesChange={handleSourceComponentsChange}
            placeholder="All"
            searchPlaceholder="Search sources..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Involved Object Name */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Name
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={involvedNameValue}
              onChange={handleInvolvedNameChange}
              placeholder="Filter by name..."
              className="min-w-[140px] pr-8"
              disabled={disabled}
            />
            {involvedNameValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={handleInvolvedNameClear}
                disabled={disabled}
                aria-label="Clear name filter"
              >
                ×
              </Button>
            )}
          </div>
        </div>

        {/* Time Range Dropdown - Right aligned */}
        <div className="flex flex-col gap-2 ml-auto">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Time Range
          </Label>
          <TimeRangeDropdown
            presets={TIME_PRESETS}
            selectedPreset={selectedPreset}
            onPresetSelect={handleTimePresetSelect}
            onCustomRangeApply={handleCustomRangeApply}
            customStart={customStart}
            customEnd={customEnd}
            disabled={disabled}
            displayLabel={getTimeRangeLabel()}
          />
        </div>
      </div>
    </div>
  );
}
