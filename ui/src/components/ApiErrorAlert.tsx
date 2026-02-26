import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { ApiError } from '../lib/errors';

export interface ApiErrorAlertProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function ApiErrorAlert({ error, onRetry, className }: ApiErrorAlertProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const title = isApiError ? error.friendlyTitle : 'Error';
  const message = isApiError ? error.friendlyMessage : error.message;
  const hasDetails = isApiError && (error.requestId || error.path || error.code);

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium mb-1">{title}</h4>
            <p className="text-sm opacity-90">{message}</p>
            {hasDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs mt-2 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                {showDetails ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Technical details
              </button>
            )}
            {showDetails && isApiError && (
              <div className="text-xs mt-2 opacity-70 font-mono space-y-1">
                {error.requestId && (
                  <div>
                    <span className="opacity-50">Request ID:</span> {error.requestId}
                  </div>
                )}
                {error.path && (
                  <div>
                    <span className="opacity-50">Path:</span> {error.path}
                  </div>
                )}
                {error.code && (
                  <div>
                    <span className="opacity-50">Code:</span> {error.code}
                  </div>
                )}
              </div>
            )}
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
