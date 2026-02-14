import { useState, useCallback } from 'react';
import type {
  PolicyPreviewInput,
  PolicyPreviewStatus,
  ActivityPolicyResource,
} from '../types/policy';
import type { Event } from '../types';
import type { ResourceRef } from '../types/activity';
import type { ActivityApiClient } from '../api/client';
import { PolicyPreviewResult } from './PolicyPreviewResult';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';

export interface PolicyPreviewPanelProps {
  /** Current inputs */
  inputs: PolicyPreviewInput[];
  /** Selected input indices */
  selectedIndices: Set<number>;
  /** Preview result (if available) */
  result: PolicyPreviewStatus | null;
  /** Whether preview is loading */
  isLoading: boolean;
  /** Error message */
  error: Error | null;
  /** Callback when inputs change */
  onInputsChange: (inputs: PolicyPreviewInput[]) => void;
  /** Callback to toggle selection */
  onToggleSelection: (index: number) => void;
  /** Callback to select all */
  onSelectAll: () => void;
  /** Callback to deselect all */
  onDeselectAll: () => void;
  /** Callback when preview is requested */
  onRunPreview: () => void;
  /** Handler for resource link clicks in result */
  onResourceClick?: (resource: ResourceRef) => void;
  /** Optional API client for loading real events */
  client?: ActivityApiClient;
  /** Policy resource to filter events by (optional) */
  policyResource?: ActivityPolicyResource;
  /** Whether there are selected inputs */
  hasSelection: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Format an audit event for display in the list
 */
function formatAuditEventSummary(event: Event): string {
  const verb = event.verb || 'unknown';
  const resource = event.objectRef?.resource || 'resource';
  const name = event.objectRef?.name || '';
  const user = event.user?.username?.split('@')[0] || 'unknown';
  return `${user} ${verb} ${resource}${name ? ` "${name}"` : ''}`;
}

/**
 * Format timestamp for display
 */
function formatEventTime(timestamp: string | undefined): string {
  if (!timestamp) return '';
  try {
    return format(new Date(timestamp), 'MMM d, HH:mm:ss');
  } catch {
    return timestamp;
  }
}

/**
 * Get verb badge variant
 */
function getVerbVariant(verb: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (verb) {
    case 'create':
      return 'success';
    case 'update':
    case 'patch':
      return 'warning';
    case 'delete':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * PolicyPreviewPanel provides the UI for testing policies with audit logs from the API
 */
export function PolicyPreviewPanel({
  inputs,
  selectedIndices,
  result,
  isLoading,
  error,
  onInputsChange,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onRunPreview,
  onResourceClick,
  client,
  policyResource,
  hasSelection,
  className = '',
}: PolicyPreviewPanelProps) {
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [loadEventsError, setLoadEventsError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Load real audit events from the API
  const loadRealEvents = useCallback(async () => {
    if (!client) return;

    setIsLoadingEvents(true);
    setLoadEventsError(null);

    try {
      const filters: string[] = ['verb in ["create", "update", "patch", "delete"]'];

      if (policyResource?.apiGroup) {
        filters.push(`objectRef.apiGroup == "${policyResource.apiGroup}"`);
      }
      if (policyResource?.kind) {
        const resourceName = policyResource.kind.toLowerCase() + 's';
        filters.push(`objectRef.resource == "${resourceName}"`);
      }

      const filter = filters.join(' && ');
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000);

      const queryResult = await client.createQuery('preview-events-' + Date.now(), {
        filter,
        limit: 20,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      });

      let events = queryResult.status?.results || [];

      if (events.length === 0) {
        const longerStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const longerQueryResult = await client.createQuery('preview-events-longer-' + Date.now(), {
          filter,
          limit: 20,
          startTime: longerStartTime.toISOString(),
          endTime: now.toISOString(),
        });

        events = longerQueryResult.status?.results || [];

        if (events.length === 0) {
          setLoadEventsError(
            policyResource?.apiGroup
              ? `No events found for ${policyResource.apiGroup}/${policyResource.kind || '*'} in the last 24 hours.`
              : 'No events found. Please specify an API Group and Kind first.'
          );
          return;
        }
      }

      const newInputs: PolicyPreviewInput[] = events.map((event) => ({
        type: 'audit' as const,
        audit: event,
      }));
      onInputsChange(newInputs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load events';
      if (message.includes('memory limit') || message.includes('503')) {
        setLoadEventsError('Query too broad. Please specify an API Group and Kind to narrow the search.');
      } else {
        setLoadEventsError(message);
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, [client, policyResource, onInputsChange]);

  // Handle manual JSON input
  const handleManualJsonSubmit = useCallback(() => {
    try {
      const parsed = JSON.parse(manualJson);
      let newInputs: PolicyPreviewInput[];

      if (Array.isArray(parsed)) {
        newInputs = parsed.map((item) => {
          if (item.type && (item.audit || item.event)) {
            return item as PolicyPreviewInput;
          }
          if (item.verb) {
            return { type: 'audit' as const, audit: item };
          }
          return { type: 'event' as const, event: item };
        });
      } else {
        if (parsed.type && (parsed.audit || parsed.event)) {
          newInputs = [parsed as PolicyPreviewInput];
        } else if (parsed.verb) {
          newInputs = [{ type: 'audit', audit: parsed }];
        } else {
          newInputs = [{ type: 'event', event: parsed }];
        }
      }

      onInputsChange(newInputs);
      setJsonError(null);
      setManualJson('');
      setShowAdvanced(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [manualJson, onInputsChange]);

  const selectedCount = selectedIndices.size;
  const totalCount = inputs.length;
  const canLoadEvents = client && policyResource?.apiGroup;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Test Policy
        </h3>
        <p className="text-sm text-muted-foreground">
          Load audit logs from the API to test your policy rules.
        </p>
      </div>

      {/* Load Section */}
      <Card>
        <CardContent className="pt-6">
          {!canLoadEvents && (
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Select an API Group and Kind above to load relevant audit logs.
              </AlertDescription>
            </Alert>
          )}

          {canLoadEvents && (
            <div className="mb-4">
              <Badge variant="outline" className="bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-900/50 dark:text-lime-200 dark:border-lime-700 font-mono">
                {policyResource.apiGroup}/{policyResource.kind || '*'}
              </Badge>
            </div>
          )}

          <Button
            onClick={loadRealEvents}
            disabled={isLoadingEvents || !canLoadEvents}
            className="w-full"
          >
            {isLoadingEvents ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Audit Logs from API'
            )}
          </Button>

          {loadEventsError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadEventsError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Events List */}
      {inputs.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardDescription>
                {selectedCount} of {totalCount} selected
              </CardDescription>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSelectAll}
                  disabled={selectedCount === totalCount}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeselectAll}
                  disabled={selectedCount === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="max-h-64 overflow-y-auto divide-y">
              {inputs.map((input, index) => {
                const event = input.type === 'audit' ? input.audit : null;
                const isSelected = selectedIndices.has(index);

                return (
                  <li
                    key={event?.auditID || index}
                    className={cn(
                      'transition-colors',
                      isSelected ? 'bg-green-50 dark:bg-green-950/50' : 'bg-background'
                    )}
                  >
                    <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(index)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-foreground truncate">
                          {event ? formatAuditEventSummary(event) : 'Unknown event'}
                        </span>
                        <span className="flex items-center gap-2 mt-1">
                          {event?.requestReceivedTimestamp && (
                            <span className="text-xs text-muted-foreground">
                              {formatEventTime(event.requestReceivedTimestamp)}
                            </span>
                          )}
                          {event?.verb && (
                            <Badge variant={getVerbVariant(event.verb)} className="text-xs uppercase">
                              {event.verb}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {inputs.length === 0 && !isLoadingEvents && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No audit logs loaded yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Load Audit Logs from API" to fetch recent events.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Advanced: Manual JSON Input */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform',
              showAdvanced && 'rotate-90'
            )}
          />
          Advanced: Manual JSON Input
        </button>

        {showAdvanced && (
          <Card className="mt-2">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                Paste a raw audit event JSON:
              </p>
              <Textarea
                value={manualJson}
                onChange={(e) => {
                  setManualJson(e.target.value);
                  setJsonError(null);
                }}
                rows={6}
                placeholder='{"verb": "create", "user": {"username": "..."}, ...}'
                spellCheck={false}
                className={cn(
                  'font-mono text-xs',
                  jsonError && 'border-destructive'
                )}
              />
              {jsonError && (
                <p className="text-xs text-destructive mt-1">{jsonError}</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManualJsonSubmit}
                disabled={!manualJson.trim()}
                className="mt-2"
              >
                Add from JSON
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Run Preview Button */}
      <Button
        onClick={onRunPreview}
        disabled={isLoading || !hasSelection}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running Preview...
          </>
        ) : (
          <>
            Run Preview
            {selectedCount > 0 && ` (${selectedCount} event${selectedCount !== 1 ? 's' : ''})`}
          </>
        )}
      </Button>

      {/* Error Display */}
      {error && !result && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Preview Result */}
      {result && (
        <PolicyPreviewResult
          result={result}
          onResourceClick={onResourceClick}
        />
      )}
    </div>
  );
}

// Legacy props interface for backwards compatibility
export interface LegacyPolicyPreviewPanelProps {
  input: PolicyPreviewInput;
  result: PolicyPreviewStatus | null;
  isLoading: boolean;
  error: Error | null;
  onInputChange: (input: PolicyPreviewInput) => void;
  onRunPreview: () => void;
  onResourceClick?: (resource: ResourceRef) => void;
  client?: ActivityApiClient;
  policyResource?: ActivityPolicyResource;
  className?: string;
}
