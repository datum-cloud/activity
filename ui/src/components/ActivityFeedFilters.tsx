import { useState, useCallback, useEffect, useRef } from 'react';
import { formatISO, subHours, subDays } from 'date-fns';

// Debounce delay for search input (ms)
const SEARCH_DEBOUNCE_MS = 300;
import type { ActivityFeedFilters as FilterState } from '../hooks/useActivityFeed';
import type { TimeRange } from '../hooks/useActivityFeed';
import type { ActivityApiClient } from '../api/client';
import { useFacets } from '../hooks/useFacets';
import { ChangeSourceToggle, ChangeSourceOption } from './ChangeSourceToggle';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { MultiCombobox } from './ui/multi-combobox';
import { TimeRangeDropdown } from './ui/time-range-dropdown';

export interface ActivityFeedFiltersProps {
  /** API client instance for fetching facets */
  client: ActivityApiClient;
  /** Current filter state */
  filters: FilterState;
  /** Current time range */
  timeRange: TimeRange;
  /** Handler called when filters change */
  onFiltersChange: (filters: FilterState) => void;
  /** Handler called when time range changes */
  onTimeRangeChange: (timeRange: TimeRange) => void;
  /** Handler called when search is submitted */
  onSearch?: () => void;
  /** Whether the filters are disabled (e.g., during loading) */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Whether to show the search input */
  showSearch?: boolean;
  /** Whether to show resource filters (kind, actor) */
  showAdvancedFilters?: boolean;
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
 * ActivityFeedFilters provides filter controls for the activity feed
 */
export function ActivityFeedFilters({
  client,
  filters,
  timeRange,
  onFiltersChange,
  onTimeRangeChange,
  disabled = false,
  className = '',
  showSearch = true,
}: ActivityFeedFiltersProps) {
  const { resourceKinds, actorNames, apiGroups, resourceNamespaces, isLoading: facetsLoading, error: facetsError } = useFacets(client, timeRange, filters);

  // Log facets error for debugging
  if (facetsError) {
    console.error('Failed to load facets:', facetsError);
  }
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [resourceNameValue, setResourceNameValue] = useState(filters.resourceName || '');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resourceNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Sync search value when filters change externally
  useEffect(() => {
    if (filters.search !== searchValue) {
      setSearchValue(filters.search || '');
    }
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync resource name value when filters change externally
  useEffect(() => {
    if (filters.resourceName !== resourceNameValue) {
      setResourceNameValue(filters.resourceName || '');
    }
  }, [filters.resourceName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      if (resourceNameDebounceRef.current) {
        clearTimeout(resourceNameDebounceRef.current);
      }
    };
  }, []);

  // Handle change source change
  const handleChangeSourceChange = useCallback(
    (value: ChangeSourceOption) => {
      onFiltersChange({
        ...filters,
        changeSource: value,
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

  // Handle search input change with debouncing
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);

      // Cancel any pending debounced update
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      // Debounce the filter update
      searchDebounceRef.current = setTimeout(() => {
        searchDebounceRef.current = null;
        onFiltersChange({
          ...filters,
          search: value || undefined,
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [filters, onFiltersChange]
  );

  // Handle search clear - immediate update
  const handleSearchClear = useCallback(() => {
    // Cancel any pending debounced update
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    setSearchValue('');
    onFiltersChange({
      ...filters,
      search: undefined,
    });
  }, [filters, onFiltersChange]);

  // Handle resource kinds change (multi-select)
  const handleResourceKindsChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      resourceKinds: values.length > 0 ? values : undefined,
    });
  };

  // Handle actor names change (multi-select)
  const handleActorNamesChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      actorNames: values.length > 0 ? values : undefined,
    });
  };

  // Handle API groups change (multi-select)
  const handleApiGroupsChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      apiGroups: values.length > 0 ? values : undefined,
    });
  };

  // Handle resource namespaces change (multi-select)
  const handleResourceNamespacesChange = (values: string[]) => {
    onFiltersChange({
      ...filters,
      resourceNamespaces: values.length > 0 ? values : undefined,
    });
  };

  // Handle resource name change with debouncing
  const handleResourceNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setResourceNameValue(value);

      // Cancel any pending debounced update
      if (resourceNameDebounceRef.current) {
        clearTimeout(resourceNameDebounceRef.current);
      }

      // Debounce the filter update
      resourceNameDebounceRef.current = setTimeout(() => {
        resourceNameDebounceRef.current = null;
        onFiltersChange({
          ...filters,
          resourceName: value || undefined,
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [filters, onFiltersChange]
  );

  // Handle resource name clear - immediate update
  const handleResourceNameClear = useCallback(() => {
    if (resourceNameDebounceRef.current) {
      clearTimeout(resourceNameDebounceRef.current);
      resourceNameDebounceRef.current = null;
    }

    setResourceNameValue('');
    onFiltersChange({
      ...filters,
      resourceName: undefined,
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
    <div className={`mb-6 pb-6 border-b border-border ${className}`}>
      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Change Source Toggle */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Source
          </Label>
          <ChangeSourceToggle
            value={filters.changeSource || 'all'}
            onChange={handleChangeSourceChange}
            disabled={disabled}
          />
        </div>

        {/* Resource Kind */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Kind
          </Label>
          <MultiCombobox
            options={resourceKinds
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.resourceKinds || []}
            onValuesChange={handleResourceKindsChange}
            placeholder="All"
            searchPlaceholder="Search kinds..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Actor */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Actor
          </Label>
          <MultiCombobox
            options={actorNames
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.actorNames || []}
            onValuesChange={handleActorNamesChange}
            placeholder="All"
            searchPlaceholder="Search actors..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Namespace */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Namespace
          </Label>
          <MultiCombobox
            options={resourceNamespaces
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.resourceNamespaces || []}
            onValuesChange={handleResourceNamespacesChange}
            placeholder="All"
            searchPlaceholder="Search namespaces..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* API Group */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            API Group
          </Label>
          <MultiCombobox
            options={apiGroups
              .filter((facet) => facet.value)
              .map((facet) => ({
                value: facet.value,
                label: facet.value,
                count: facet.count,
              }))}
            values={filters.apiGroups || []}
            onValuesChange={handleApiGroupsChange}
            placeholder="All"
            searchPlaceholder="Search API groups..."
            disabled={disabled}
            loading={facetsLoading}
            className="min-w-[140px]"
          />
        </div>

        {/* Resource Name */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Name
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={resourceNameValue}
              onChange={handleResourceNameChange}
              placeholder="Filter by name..."
              className="min-w-[140px] pr-8"
              disabled={disabled}
            />
            {resourceNameValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={handleResourceNameClear}
                disabled={disabled}
                aria-label="Clear resource name"
              >
                ×
              </Button>
            )}
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Search
            </Label>
            <div className="relative">
              <Input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search activities..."
                className="pr-8"
                disabled={disabled}
              />
              {searchValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={handleSearchClear}
                  disabled={disabled}
                  aria-label="Clear search"
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        )}

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
