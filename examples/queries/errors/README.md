# Query Error Examples

This directory contains examples of common query errors and their structured error responses.

## Structured Error Format

When a query fails validation, the API returns a structured Kubernetes `Status` object (HTTP 4xx or 5xx) with detailed error information:

```json
{
  "kind": "Status",
  "apiVersion": "v1",
  "status": "Failure",
  "message": "Human-readable error summary",
  "reason": "Machine-readable reason code",
  "code": 422,
  "details": {
    "name": "query-name",
    "kind": "AuditLogQuery",
    "causes": [
      {
        "reason": "FieldValueInvalid",
        "message": "Detailed error with hints",
        "field": "spec.filter"
      }
    ]
  }
}
```

## Error Types

### Filter Validation Errors (HTTP 422)

**Reason:** `Invalid`
**Field:** `spec.filter`
**Cause Type:** `FieldValueInvalid`

Returned when the CEL filter expression has syntax errors or references undefined fields.

**Examples:**
- Using `=` instead of `==` for comparison
- Referencing non-existent fields
- Type mismatches
- Invalid syntax

See: [malformed-filter.yaml](./malformed-filter.yaml)

### Connection Errors (HTTP 503)

**Reason:** `ServiceUnavailable`

Returned when the API server cannot connect to the ClickHouse backend.

**Example response:**
```json
{
  "status": "Failure",
  "reason": "ServiceUnavailable",
  "code": 503,
  "message": "Unable to connect to audit log storage: connection refused"
}
```

### Timeout Errors (HTTP 504)

**Reason:** `Timeout`
**Retry After:** 10 seconds

Returned when a query takes too long to execute.

**Example response:**
```json
{
  "status": "Failure",
  "reason": "Timeout",
  "code": 504,
  "message": "Query execution timed out: context deadline exceeded",
  "details": {
    "retryAfterSeconds": 10
  }
}
```

## Using Errors in a GUI

The structured error format makes it easy to display user-friendly error messages in a GUI:

```typescript
interface KubernetesStatus {
  status: "Success" | "Failure";
  message: string;
  reason: string;
  code: number;
  details?: {
    name: string;
    kind: string;
    causes?: Array<{
      reason: string;  // Machine-readable: "FieldValueInvalid", etc.
      message: string; // Human-readable with hints
      field: string;   // JSON path: "spec.filter"
    }>;
    retryAfterSeconds?: number;
  };
}

function handleQueryError(error: KubernetesStatus) {
  if (error.code === 422 && error.details?.causes) {
    // Validation error - show field-specific errors
    error.details.causes.forEach(cause => {
      if (cause.field === "spec.filter") {
        // Highlight the filter field in the UI
        // Show the detailed message with hints
        showFieldError("filter", cause.message);
      }
    });
  } else if (error.code === 503) {
    // Service unavailable - show connection error
    showError("Cannot connect to audit log storage. Please try again later.");
  } else if (error.code === 504 && error.details?.retryAfterSeconds) {
    // Timeout - show retry option
    showError(`Query timed out. Retry in ${error.details.retryAfterSeconds} seconds.`);
  } else {
    // Generic error
    showError(error.message);
  }
}
```

## Common Filter Errors

### 1. Single `=` instead of `==`

**Wrong:**
```yaml
filter: "verb = 'delete'"
```

**Error:**
```
Syntax error: token recognition error at: '= '
Hint: Use '==' for equality comparison (not single '=')
```

**Correct:**
```yaml
filter: "verb == 'delete'"
```

### 2. Undefined Field Reference

**Wrong:**
```yaml
filter: "ns == 'default'"  # 'ns' is not defined
```

**Error:**
```
undeclared reference to 'ns'
Hint: Field 'ns' is not available. Check the list of available fields below.
```

**Correct:**
```yaml
filter: "objectRef.namespace == 'default'"
```

### 3. Type Mismatch

**Wrong:**
```yaml
filter: "user.startsWith('admin')"  # user is an object, not a string
```

**Error:**
```
found no matching overload for 'startsWith' applied to 'map(string, dyn).(string)'
Hint: Check that you're using the correct types and operators for each field
```

**Correct:**
```yaml
filter: "user.username.startsWith('admin')"
```

## Testing Errors

To test error handling:

```bash
# Submit a malformed query
kubectl create -f examples/queries/errors/malformed-filter.yaml

# You should receive an error similar to:
# Error from server (Invalid): error when creating "examples/queries/errors/malformed-filter.yaml":
# AuditLogQuery.activity.miloapis.com "malformed-filter-example" is invalid:
# spec.filter: Invalid value: "verb == \"delete\" || verb = \"list\"":
# Invalid CEL expression at position 25: Syntax error: token recognition error at: '= '
#
# Hint: Use '==' for equality comparison (not single '=')
```

## Available Fields Reference

See the main [CEL expressions guide](../cel-expressions/README.md) for a complete list of available fields and operators.
