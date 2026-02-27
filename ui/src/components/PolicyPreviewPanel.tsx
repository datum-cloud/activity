import type {
  PolicyPreviewStatus,
  PolicyPreviewInput,
} from '../types/policy';
import type { ResourceRef } from '../types/activity';
import { PolicyPreviewResult } from './PolicyPreviewResult';
import { cn } from '../lib/utils';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export interface PolicyPreviewPanelProps {
  /** Preview result (if available) */
  result: PolicyPreviewStatus | null;
  /** Input data used for preview */
  inputs?: PolicyPreviewInput[];
  /** Whether preview is loading */
  isLoading: boolean;
  /** Error message */
  error: Error | null;
  /** Handler for resource link clicks in result */
  onResourceClick?: (resource: ResourceRef) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether audit logs are being loaded */
  isLoadingInputs?: boolean;
  /** Whether there are more inputs available for pagination */
  hasMoreInputs?: boolean;
  /** Whether more inputs are currently being loaded */
  isLoadingMoreInputs?: boolean;
  /** Callback to load more inputs */
  onLoadMore?: () => void;
}


/**
 * PolicyPreviewPanel displays preview results for testing policies
 */
export function PolicyPreviewPanel({
  result,
  inputs,
  isLoading,
  error,
  onResourceClick,
  className = '',
  isLoadingInputs = false,
  hasMoreInputs = false,
  isLoadingMoreInputs = false,
  onLoadMore,
}: PolicyPreviewPanelProps) {

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          Preview the activity timeline for recent resource changes.
        </p>
      </div>

      {/* Loading Inputs State */}
      {isLoadingInputs && !isLoading && !result && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading recent audit logs...</p>
          </CardContent>
        </Card>
      )}

      {/* Loading Preview State */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Generating preview...</p>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && !result && !isLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Empty State - No result yet and not loading */}
      {!result && !isLoading && !error && !isLoadingInputs && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              No preview available yet
            </p>
            <p className="text-xs text-muted-foreground">
              Define resource details and rules in the Editor tab to see a preview
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview Result */}
      {result && !isLoading && (
        <>
          <PolicyPreviewResult
            result={result}
            inputs={inputs}
            onResourceClick={onResourceClick}
          />

          {/* Load More Button */}
          {hasMoreInputs && onLoadMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoadingMoreInputs}
                className="h-8 text-xs"
              >
                {isLoadingMoreInputs ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Audit Logs'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
