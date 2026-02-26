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
        return 'Authentication Required';
      case 403:
        return 'Permission Denied';
      case 404:
        return 'Not Found';
      case 429:
        return 'Too Many Requests';
      case 500:
      case 502:
      case 503:
        return 'Server Error';
      default:
        return 'Request Failed';
    }
  }

  get friendlyMessage(): string {
    if (this.statusCode === 403) {
      return "You don't have permission to access this resource. Contact your administrator if you believe this is an error.";
    }
    if (this.statusCode === 401) {
      return 'Your session may have expired. Please refresh the page or sign in again.';
    }
    if (this.statusCode >= 500) {
      return 'The server encountered an error. Please try again later.';
    }
    if (this.statusCode === 404) {
      return 'The requested resource was not found.';
    }
    if (this.statusCode === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    return this.message || 'An unexpected error occurred.';
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
