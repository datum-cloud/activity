import type { PolicyPreviewStatus, PreviewActivity, PolicyPreviewInputResult } from '../types/policy';
import type { ResourceRef } from '../types/activity';
import { ActivityFeedSummary } from './ActivityFeedSummary';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface PolicyPreviewResultProps {
  /** Preview result status */
  result: PolicyPreviewStatus;
  /** Handler for resource link clicks */
  onResourceClick?: (resource: ResourceRef) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Get summary statistics from results
 */
function getResultStats(results: PolicyPreviewInputResult[] | undefined): {
  total: number;
  matched: number;
  errors: number;
} {
  if (!results || results.length === 0) {
    return { total: 0, matched: 0, errors: 0 };
  }
  return {
    total: results.length,
    matched: results.filter((r) => r.matched).length,
    errors: results.filter((r) => !!r.error).length,
  };
}

/**
 * Format actor name for display
 */
function formatActorName(actor: PreviewActivity['spec']['actor']): string {
  if (!actor) return 'Unknown';
  if (actor.email) return actor.email;
  if (actor.name) return actor.name;
  return 'Unknown';
}

/**
 * Format timestamp for display
 */
function formatTimestamp(metadata: PreviewActivity['metadata']): string {
  if (!metadata?.creationTimestamp) return '';
  try {
    const date = new Date(metadata.creationTimestamp);
    return date.toLocaleTimeString();
  } catch {
    return '';
  }
}

/**
 * PolicyPreviewResult displays the results of a policy preview execution
 */
export function PolicyPreviewResult({
  result,
  onResourceClick,
  className = '',
}: PolicyPreviewResultProps) {
  const hasError = !!result.error;
  const activities = result.activities || [];
  const results = result.results || [];
  const stats = getResultStats(results);

  // Handle legacy single-input response format
  const isLegacyFormat = !results.length && (result.matched !== undefined || result.generatedSummary);
  if (isLegacyFormat) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          {/* Legacy Match Status Badge */}
          <div className="flex items-center gap-3 mb-4">
            {hasError ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Error
              </Badge>
            ) : result.matched ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Matched
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                No Match
              </Badge>
            )}

            {result.matched && !hasError && result.matchedRuleIndex !== undefined && (
              <span className="text-sm text-muted-foreground">
                {result.matchedRuleType === 'audit' ? 'Audit' : 'Event'} Rule #{result.matchedRuleIndex + 1}
              </span>
            )}
          </div>

          {hasError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <pre className="text-xs font-mono whitespace-pre-wrap">{result.error}</pre>
              </AlertDescription>
            </Alert>
          )}

          {result.matched && result.generatedSummary && !hasError && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Generated Summary:</p>
              <div className="p-3 rounded-md bg-muted">
                <ActivityFeedSummary
                  summary={result.generatedSummary}
                  links={result.generatedLinks}
                  onResourceClick={onResourceClick}
                />
              </div>
            </div>
          )}

          {!result.matched && !hasError && (
            <p className="text-sm text-muted-foreground">
              No rules matched the provided input. Check your match expressions.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // New multi-input format
  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={stats.matched > 0 ? 'success' : 'secondary'}>
            {stats.matched} matched
          </Badge>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">{stats.total} tested</span>
          {stats.errors > 0 && (
            <>
              <span className="text-muted-foreground">/</span>
              <Badge variant="destructive">{stats.errors} errors</Badge>
            </>
          )}
        </div>
      </div>

      {/* General Error */}
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <pre className="text-xs font-mono whitespace-pre-wrap">{result.error}</pre>
          </AlertDescription>
        </Alert>
      )}

      {/* Activity Stream */}
      {activities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Activity Stream</CardTitle>
              <Badge variant="outline">{activities.length} activities</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {activities.map((activity, index) => (
                <li key={activity.metadata?.name || index} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {formatActorName(activity.spec.actor)}
                    </span>
                    <Badge
                      variant={activity.spec.changeSource === 'system' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {activity.spec.changeSource}
                    </Badge>
                    {activity.metadata?.creationTimestamp && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(activity.metadata)}
                      </span>
                    )}
                  </div>

                  <div className="mb-2">
                    <ActivityFeedSummary
                      summary={activity.spec.summary}
                      links={activity.spec.links}
                      onResourceClick={onResourceClick}
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {activity.spec.resource.kind && (
                        <>
                          {activity.spec.resource.namespace && `${activity.spec.resource.namespace}/`}
                          {activity.spec.resource.name}
                        </>
                      )}
                    </span>
                    <span>
                      via {activity.spec.origin.type}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Per-Input Results (collapsed by default) */}
      {results.length > 0 && results.some((r) => !r.matched || r.error) && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span className="group-open:rotate-90 transition-transform">
              ▶
            </span>
            {stats.total - stats.matched} inputs did not match
            {stats.errors > 0 && ` (${stats.errors} with errors)`}
          </summary>
          <Card className="mt-2">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {results
                  .filter((r) => !r.matched || r.error)
                  .map((inputResult) => (
                    <li
                      key={inputResult.inputIndex}
                      className={cn(
                        'p-3 flex items-center justify-between text-sm',
                        inputResult.error && 'bg-destructive/10'
                      )}
                    >
                      <span className="text-muted-foreground">Input #{inputResult.inputIndex + 1}</span>
                      {inputResult.error ? (
                        <Badge variant="destructive" className="text-xs">
                          {inputResult.error}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No matching rule</span>
                      )}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </details>
      )}

      {/* No Matches */}
      {stats.matched === 0 && !hasError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No rules matched any of the {stats.total} input{stats.total !== 1 ? 's' : ''}.
            Check your match expressions.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
