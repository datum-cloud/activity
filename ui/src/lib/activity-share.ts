import type { EffectiveTimeRange } from '../types/activity';

/**
 * Generate a shareable URL for the current activity view.
 *
 * The shareable URL:
 * - Uses absolute timestamps (not relative like "now-1h")
 * - Disables streaming so the view is static
 * - Preserves all current filters
 *
 * This ensures the shared link shows the exact same data regardless of
 * when someone opens it.
 *
 * @param basePath - Current route path (e.g., "/activity/feed")
 * @param effectiveTimeRange - Server-calculated effective time range
 * @param filters - Current filter state
 * @param origin - Window origin for absolute URL (e.g., "https://staff.datum.cloud")
 */
export function generateShareableUrl(
  basePath: string,
  effectiveTimeRange: EffectiveTimeRange,
  filters: Record<string, string>,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const params = new URLSearchParams();

  // Use absolute timestamps from server-calculated range
  params.set('start', effectiveTimeRange.startTime);
  params.set('end', effectiveTimeRange.endTime);

  // Disable streaming for shared links (static view)
  params.set('streaming', 'false');

  // Preserve all current filters
  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== 'start' && key !== 'end' && key !== 'streaming') {
      params.set(key, value);
    }
  }

  return `${origin}${basePath}?${params.toString()}`;
}

/**
 * Copy text to clipboard and return success status
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
