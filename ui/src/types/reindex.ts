/**
 * TypeScript types for ReindexJob management
 * Based on the ReindexJob API (activity.miloapis.com/v1alpha1)
 */

import type { ObjectMeta } from './index';

/**
 * Phase represents the lifecycle phase of a ReindexJob
 */
export type ReindexJobPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed';

/**
 * Time range for reindexing
 */
export interface ReindexTimeRange {
  /**
   * Start time (relative like "now-7d" or absolute ISO 8601)
   * Relative: "now-30d", "now-2h", "now-30m" (units: s, m, h, d, w)
   * Absolute: "2026-02-01T00:00:00Z"
   */
  startTime: string;
  /**
   * End time (defaults to "now" if omitted)
   * Uses same formats as startTime
   */
  endTime?: string;
}

/**
 * Selector for which policies to reindex
 */
export interface ReindexPolicySelector {
  /** List of ActivityPolicy names (mutually exclusive with matchLabels) */
  names?: string[];
  /** Label selector (mutually exclusive with names) */
  matchLabels?: Record<string, string>;
}

/**
 * Specification for a ReindexJob
 */
export interface ReindexJobSpec {
  /** Time window of events to re-index */
  timeRange: ReindexTimeRange;
  /** Optional selector for specific policies */
  policySelector?: ReindexPolicySelector;
}

/**
 * Status of a ReindexJob
 */
export interface ReindexJobStatus {
  /** Current lifecycle phase */
  phase?: ReindexJobPhase;
  /** Human-readable description of the current state */
  message?: string;
  /** When processing began */
  startedAt?: string;
  /** When processing finished (success or failure) */
  completedAt?: string;
}

/**
 * ReindexJob resource for re-processing historical audit logs and events
 */
export interface ReindexJob {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'ReindexJob';
  metadata: ObjectMeta;
  spec: ReindexJobSpec;
  status?: ReindexJobStatus;
}

/**
 * List of ReindexJob resources (Kubernetes list type)
 */
export interface ReindexJobListResource {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'ReindexJobList';
  metadata?: {
    continue?: string;
    resourceVersion?: string;
  };
  items: ReindexJob[];
}

/**
 * Helper type for creating a new ReindexJob
 */
export interface CreateReindexJobParams {
  name: string;
  spec: ReindexJobSpec;
}

/**
 * Check if a ReindexJob is in a terminal state
 */
export function isReindexJobTerminal(job: ReindexJob): boolean {
  return job.status?.phase === 'Succeeded' || job.status?.phase === 'Failed';
}

/**
 * Check if a ReindexJob is currently running
 */
export function isReindexJobRunning(job: ReindexJob): boolean {
  return job.status?.phase === 'Running';
}

/**
 * Get a human-readable status message
 */
export function getReindexJobStatusMessage(job: ReindexJob): string {
  if (job.status?.message) {
    return job.status.message;
  }

  const phase = job.status?.phase;
  switch (phase) {
    case 'Pending':
      return 'Waiting to start';
    case 'Running':
      return 'Processing events';
    case 'Succeeded':
      return 'Completed successfully';
    case 'Failed':
      return 'Failed';
    default:
      return 'Unknown status';
  }
}

/**
 * Get duration of a ReindexJob
 */
export function getReindexJobDuration(job: ReindexJob): string | null {
  const startedAt = job.status?.startedAt;
  const completedAt = job.status?.completedAt;

  if (!startedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
