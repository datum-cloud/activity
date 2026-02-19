import { useState, useEffect, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Determine the appropriate update interval based on how old the timestamp is.
 * - < 1 minute: update every 10 seconds
 * - < 1 hour: update every minute
 * - < 24 hours: update every 5 minutes
 * - older: update every 30 minutes
 */
function getUpdateInterval(timestamp: Date): number {
  const now = Date.now();
  const age = now - timestamp.getTime();

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  if (age < MINUTE) {
    return 10 * SECOND; // Update every 10 seconds for very recent items
  } else if (age < HOUR) {
    return MINUTE; // Update every minute for items < 1 hour old
  } else if (age < DAY) {
    return 5 * MINUTE; // Update every 5 minutes for items < 24 hours old
  } else {
    return 30 * MINUTE; // Update every 30 minutes for older items
  }
}

/**
 * Hook that returns a relative time string that auto-updates.
 * Updates more frequently for recent timestamps and less frequently for older ones.
 *
 * @param timestamp - ISO 8601 timestamp string or undefined
 * @returns Formatted relative time string (e.g., "5 minutes ago")
 */
export function useRelativeTime(timestamp: string | undefined): string {
  const [, setTick] = useState(0);

  const date = useMemo(() => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp);
    } catch {
      return null;
    }
  }, [timestamp]);

  useEffect(() => {
    if (!date) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleUpdate = () => {
      const interval = getUpdateInterval(date);
      timeoutId = setTimeout(() => {
        setTick((t) => t + 1);
        scheduleUpdate(); // Schedule next update with potentially different interval
      }, interval);
    };

    scheduleUpdate();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [date]);

  if (!date) {
    return 'Unknown time';
  }

  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return timestamp || 'Unknown time';
  }
}

/**
 * Hook for managing relative time updates across multiple timestamps.
 * More efficient than individual useRelativeTime hooks when rendering many items.
 * Updates all timestamps at a fixed interval.
 *
 * @param interval - Update interval in milliseconds (default: 60000 = 1 minute)
 * @returns A function that formats timestamps to relative time
 */
export function useRelativeTimeFormatter(interval: number = 60000): (timestamp: string | undefined) => string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return (timestamp: string | undefined): string => {
    if (!timestamp) {
      return 'Unknown time';
    }
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return timestamp;
    }
  };
}
