import { useState, useEffect } from 'react';
import {
  subMinutes,
  subHours,
  subDays,
  subWeeks,
  startOfDay,
  endOfDay,
  formatISO
} from 'date-fns';

export interface DateTimeRange {
  start: string; // ISO 8601 timestamp
  end: string;   // ISO 8601 timestamp
}

export interface DateTimeRangePickerProps {
  onChange: (range: DateTimeRange) => void;
  initialRange?: DateTimeRange;
  className?: string;
}

type PresetKey =
  | 'last15min'
  | 'last1hour'
  | 'last6hours'
  | 'last24hours'
  | 'last7days'
  | 'last30days'
  | 'today'
  | 'custom';

interface TimeRangePreset {
  label: string;
  getValue: () => DateTimeRange;
}

const PRESETS: Record<PresetKey, TimeRangePreset> = {
  last15min: {
    label: 'Last 15 minutes',
    getValue: () => ({
      start: formatISO(subMinutes(new Date(), 15)),
      end: formatISO(new Date()),
    }),
  },
  last1hour: {
    label: 'Last 1 hour',
    getValue: () => ({
      start: formatISO(subHours(new Date(), 1)),
      end: formatISO(new Date()),
    }),
  },
  last6hours: {
    label: 'Last 6 hours',
    getValue: () => ({
      start: formatISO(subHours(new Date(), 6)),
      end: formatISO(new Date()),
    }),
  },
  last24hours: {
    label: 'Last 24 hours',
    getValue: () => ({
      start: formatISO(subHours(new Date(), 24)),
      end: formatISO(new Date()),
    }),
  },
  last7days: {
    label: 'Last 7 days',
    getValue: () => ({
      start: formatISO(subDays(new Date(), 7)),
      end: formatISO(new Date()),
    }),
  },
  last30days: {
    label: 'Last 30 days',
    getValue: () => ({
      start: formatISO(subDays(new Date(), 30)),
      end: formatISO(new Date()),
    }),
  },
  today: {
    label: 'Today',
    getValue: () => ({
      start: formatISO(startOfDay(new Date())),
      end: formatISO(endOfDay(new Date())),
    }),
  },
  custom: {
    label: 'Custom range',
    getValue: () => ({
      start: formatISO(subHours(new Date(), 1)),
      end: formatISO(new Date()),
    }),
  },
};

// Helper function to convert ISO string to datetime-local format
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
 * DateTimeRangePicker component for selecting time ranges for audit log queries.
 * Supports both preset ranges (last 7 days, last 24 hours, etc.) and custom date/time selection.
 */
export function DateTimeRangePicker({
  onChange,
  initialRange,
  className = '',
}: DateTimeRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('last24hours');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Initialize with initial range or default preset
  useEffect(() => {
    if (initialRange) {
      setCustomStart(formatDatetimeLocal(initialRange.start));
      setCustomEnd(formatDatetimeLocal(initialRange.end));
      setIsCustom(true);
      setSelectedPreset('custom');
    } else {
      // Auto-apply the default preset on mount
      const range = PRESETS['last24hours'].getValue();
      onChange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);

    if (preset === 'custom') {
      setIsCustom(true);
      // If switching to custom, initialize with current values or defaults
      if (!customStart || !customEnd) {
        const defaultRange = PRESETS.last24hours.getValue();
        setCustomStart(formatDatetimeLocal(defaultRange.start));
        setCustomEnd(formatDatetimeLocal(defaultRange.end));
      }
    } else {
      setIsCustom(false);
      const range = PRESETS[preset].getValue();
      onChange(range);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      const range: DateTimeRange = {
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd).toISOString(),
      };
      onChange(range);
    }
  };

  const handleCustomStartChange = (value: string) => {
    setCustomStart(value);
  };

  const handleCustomEndChange = (value: string) => {
    setCustomEnd(value);
  };

  return (
    <div className={`datetime-range-picker ${className}`}>
      <div className="preset-buttons">
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`preset-button ${selectedPreset === key ? 'active' : ''}`}
            onClick={() => handlePresetChange(key)}
          >
            {PRESETS[key].label}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="custom-range-inputs">
          <div className="datetime-input-group">
            <label htmlFor="custom-start">
              <strong>Start time</strong>
            </label>
            <input
              id="custom-start"
              type="datetime-local"
              value={customStart}
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className="datetime-input"
            />
          </div>

          <div className="datetime-input-group">
            <label htmlFor="custom-end">
              <strong>End time</strong>
            </label>
            <input
              id="custom-end"
              type="datetime-local"
              value={customEnd}
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className="datetime-input"
            />
          </div>

          <button
            type="button"
            onClick={handleCustomApply}
            className="apply-custom-button"
            disabled={!customStart || !customEnd}
          >
            Apply Custom Range
          </button>
        </div>
      )}
    </div>
  );
}
