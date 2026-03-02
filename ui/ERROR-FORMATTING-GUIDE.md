# Custom Error Formatting Guide

The Activity UI library now supports custom error formatting, allowing you to provide organization-specific error messages to your users.

## Overview

All components that display errors now accept an optional `errorFormatter` prop. This allows you to:

- Customize error messages for your organization's tone and style
- Provide context-specific guidance (e.g., who to contact for permissions)
- Map technical errors to user-friendly messages
- Add custom error handling logic

## Type Definitions

```typescript
/**
 * Formatted error for display to users
 */
export interface FormattedError {
  /** User-friendly error message */
  message: string;
  /** Technical details for advanced users (optional) */
  technical?: string;
}

/**
 * Function that formats errors for display
 */
export type ErrorFormatter = (error: Error) => FormattedError;
```

## Components Supporting errorFormatter

The following components accept the `errorFormatter` prop:

- `ActivityFeed`
- `EventsFeed`
- `ResourceHistoryView`
- `PolicyList`
- `PolicyEditor`
- `AuditLogQueryComponent`
- `ApiErrorAlert`

## Default Error Formatter

The library provides a `defaultErrorFormatter` that uses the friendly error properties from `ApiError` and `NetworkError`:

```typescript
import { defaultErrorFormatter } from '@miloapis/activity-ui';

// Uses built-in friendly messages like:
// - "You'll need permissions for this — reach out to your admin..."
// - "That took too long — might be a heavy query. Try a shorter time range?"
// - "Lost connection to the cluster..."
```

## Basic Usage

### Using the Default Formatter

If you don't provide an `errorFormatter`, the default formatter is used automatically:

```tsx
<ActivityFeed
  client={client}
  // errorFormatter not specified = uses defaultErrorFormatter
/>
```

### Custom Error Messages

Provide your own error formatter to customize messages:

```tsx
import { ErrorFormatter } from '@miloapis/activity-ui';

const customErrorFormatter: ErrorFormatter = (error) => {
  if (error.message.includes("403")) {
    return {
      message: "Access denied. Contact support@yourcompany.com for help.",
      technical: error.message,
    };
  }

  if (error.message.includes("timeout")) {
    return {
      message: "Query timed out. Try a shorter time range or contact #platform-support.",
      technical: error.message,
    };
  }

  // Fallback
  return {
    message: "Something went wrong. Please try again.",
    technical: error.message,
  };
};

<ActivityFeed
  client={client}
  errorFormatter={customErrorFormatter}
/>
```

### Extending the Default Formatter

You can use the default formatter as a starting point and override specific cases:

```tsx
import { defaultErrorFormatter, type ErrorFormatter, ApiError } from '@miloapis/activity-ui';

const customErrorFormatter: ErrorFormatter = (error) => {
  // Get the default formatting first
  const defaultFormatted = defaultErrorFormatter(error);

  // Override for specific status codes
  if (error instanceof ApiError && error.statusCode === 403) {
    return {
      message: "You don't have permission. Contact your team admin to request access.",
      technical: defaultFormatted.technical,
    };
  }

  // For all other errors, use the default
  return defaultFormatted;
};

<ActivityFeed
  client={client}
  errorFormatter={customErrorFormatter}
/>
```

## Advanced Patterns

### Organization-Specific Error Handling

```tsx
const errorFormatter: ErrorFormatter = (error) => {
  const defaultFormatted = defaultErrorFormatter(error);

  // Map errors to internal support channels
  if (error instanceof ApiError) {
    const supportLinks = {
      401: "Authentication failed. Refresh the page or visit https://auth.company.com",
      403: "Permission denied. Request access via https://iam.company.com",
      404: "Service not found. Check #platform-status on Slack",
      500: "Server error. Filed incident ticket automatically.",
    };

    const customMessage = supportLinks[error.statusCode];
    if (customMessage) {
      return {
        message: customMessage,
        technical: defaultFormatted.technical,
      };
    }
  }

  return defaultFormatted;
};
```

### Localization

```tsx
const errorFormatter: ErrorFormatter = (error) => {
  const locale = getUserLocale(); // Your locale detection

  if (locale === 'es') {
    return {
      message: "Algo salió mal. Inténtalo de nuevo.",
      technical: error.message,
    };
  }

  return defaultErrorFormatter(error);
};
```

### Error Tracking Integration

```tsx
import * as Sentry from '@sentry/react';

const errorFormatter: ErrorFormatter = (error) => {
  // Log to error tracking
  Sentry.captureException(error);

  // Return user-friendly message
  return {
    message: "We've logged this error and will investigate. Please try again.",
    technical: error.message,
  };
};
```

## Example: Complete Implementation

```tsx
import {
  ActivityFeed,
  ActivityApiClient,
  defaultErrorFormatter,
  ApiError,
  NetworkError,
  type ErrorFormatter,
} from '@miloapis/activity-ui';

const customErrorFormatter: ErrorFormatter = (error) => {
  const defaultFormatted = defaultErrorFormatter(error);

  // Handle API errors
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 403:
        return {
          message: "Access denied. Contact your admin at admin@company.com",
          technical: defaultFormatted.technical,
        };
      case 404:
        return {
          message: "Activity service unavailable. Check #platform-status",
          technical: defaultFormatted.technical,
        };
      default:
        return defaultFormatted;
    }
  }

  // Handle network errors
  if (error instanceof NetworkError) {
    return {
      message: "Connection lost. Check your VPN and try again.",
      technical: error.message,
    };
  }

  // Fallback to default
  return defaultFormatted;
};

export function MyActivityFeed() {
  const client = new ActivityApiClient({ baseUrl: '/api' });

  return (
    <ActivityFeed
      client={client}
      errorFormatter={customErrorFormatter}
      initialTimeRange={{ start: 'now-7d' }}
    />
  );
}
```

## Error Display Behavior

When an error occurs:

1. The error is passed to your `errorFormatter` (or `defaultErrorFormatter`)
2. The returned `FormattedError` is displayed in an alert
3. The `message` is shown prominently
4. The `technical` details are hidden behind a "Show technical details" toggle
5. If available, a retry button is shown

## Best Practices

1. **Always provide a user-friendly message**: Don't expose raw error messages to end users
2. **Include actionable guidance**: Tell users what they can do (contact someone, try a different approach, etc.)
3. **Preserve technical details**: Put the original error message in the `technical` field for debugging
4. **Be consistent**: Use the same tone and format across all your error messages
5. **Test error states**: Verify your custom formatter works for different error types

## Migration Guide

If you're currently using the default error handling, no changes are needed. The `errorFormatter` prop is optional and defaults to `defaultErrorFormatter`.

To customize error messages:

1. Import `ErrorFormatter` type and `defaultErrorFormatter` function
2. Create your custom formatter function
3. Pass it to the component via the `errorFormatter` prop
4. Test by triggering various error conditions
