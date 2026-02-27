export interface ApiErrorResponse {
  requestId?: string;
  code?: string;
  error?: string;
  reason?: string;
  message?: string;
  path?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code?: string,
    message?: string,
    public requestId?: string,
    public path?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get friendlyTitle(): string {
    switch (this.statusCode) {
      case 401:
        return 'Hey, who goes there? 🔐';
      case 403:
        return 'Access denied 🚫';
      case 404:
        return 'Service not found 🔍';
      case 408:
        return 'Taking a while... ⏱️';
      case 429:
        return 'Whoa, slow down there! 🐌';
      case 500:
        return 'Oops, something broke 😅';
      case 502:
        return 'Service unavailable 💤';
      case 503:
        return 'Service unavailable 💤';
      case 504:
        return 'Request timed out ⏱️';
      default:
        return 'Well, that didn\'t work 🤔';
    }
  }

  get friendlyMessage(): string {
    if (this.statusCode === 403) {
      return "You'll need permissions for this — reach out to your admin and we'll get you sorted.";
    }
    if (this.statusCode === 401) {
      return "Session expired — no worries, a quick refresh will get you back in.";
    }
    if (this.statusCode === 404) {
      return "The activity service isn't responding — we're looking into it. Try again in a moment?";
    }
    if (this.statusCode === 408 || this.statusCode === 504) {
      return "That took too long — might be a heavy query. Try a shorter time range?";
    }
    if (this.statusCode === 429) {
      return "Too many requests right now — we're on it. Give it a moment and retry?";
    }
    if (this.statusCode === 500) {
      return "The activity service hit a bump. We're on it — try again shortly?";
    }
    if (this.statusCode === 502 || this.statusCode === 503) {
      return "The activity service isn't responding — we're looking into it. Try again in a moment?";
    }
    return this.message || "Something went sideways. We're keeping an eye on things — try again?";
  }

  get suggestion(): string | null {
    return null;
  }

  get severity(): 'warning' | 'error' {
    // Temporary or client-side errors are warnings
    if (this.statusCode === 408 || this.statusCode === 429 || this.statusCode === 503 || this.statusCode === 504) {
      return 'warning';
    }
    // Permission and auth errors are warnings (user can fix)
    if (this.statusCode === 401 || this.statusCode === 403) {
      return 'warning';
    }
    // Other errors are more serious
    return 'error';
  }
}

/**
 * Represents a network error (connection refused, DNS failure, etc.)
 */
export class NetworkError extends Error {
  constructor(message?: string) {
    super(message || 'Network error');
    this.name = 'NetworkError';
  }

  get friendlyTitle(): string {
    return 'Connection trouble 🌐';
  }

  get friendlyMessage(): string {
    return "Lost connection to the cluster. These things happen — check your connection and retry.";
  }

  get suggestion(): string | null {
    return null;
  }

  get severity(): 'warning' | 'error' {
    return 'warning';
  }
}

export function parseApiError(status: number, body: string): ApiError {
  try {
    const data = JSON.parse(body) as ApiErrorResponse;
    return new ApiError(
      status,
      data.code,
      data.error || data.reason || data.message,
      data.requestId,
      data.path
    );
  } catch {
    return new ApiError(status, undefined, body || 'Unknown error');
  }
}

/**
 * Default error formatter that uses the friendly error properties if available,
 * otherwise falls back to the error message.
 */
export function defaultErrorFormatter(error: Error): { message: string; technical?: string } {
  // Check if it's a friendly error (has friendlyMessage and severity)
  const isFriendly = 'friendlyMessage' in error && 'severity' in error;

  if (isFriendly) {
    const friendlyError = error as Error & {
      friendlyTitle: string;
      friendlyMessage: string;
      severity: 'warning' | 'error';
    };

    return {
      message: friendlyError.friendlyMessage,
      technical: error.message !== friendlyError.friendlyMessage ? error.message : undefined,
    };
  }

  // Fall back to basic error message
  return {
    message: error.message || 'Something unexpected happened. Try again?',
  };
}
