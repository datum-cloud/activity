# Audit Log Query Examples

This directory contains examples demonstrating the capabilities of Activity's audit log querying functionality.

## Quick Start

Apply any example query:

```bash
kubectl apply -f basic-filtering/01-filter-by-namespace.yaml
```

View query results:

```bash
kubectl get auditlogquery events-in-production-namespace -o yaml
```

Check query status:

```bash
kubectl get auditlogquery events-in-production-namespace -o jsonpath='{.status.phase}'
```

## Example Categories

### 📁 [basic-filtering/](basic-filtering/)
**6 examples** - Simple CEL-based filtering

Learn how to filter audit events by:
- Namespace
- Verb (create, update, delete, etc.)
- Resource type (pods, deployments, etc.)
- User
- Multiple fields combined
- HTTP status codes

**Start here** if you're new to audit log querying!

### 📁 [cel-expressions/](cel-expressions/)
**5 examples** - Advanced CEL (Common Expression Language) filtering

Master complex queries using CEL expressions:
- Status code ranges (4xx, 5xx errors)
- Resource name patterns
- Multiple namespace matching
- Write operation detection
- Combined conditional logic

### 📁 [pagination/](pagination/)
**3 examples** - Result pagination

Control query results:
- Basic queries
- Filtered queries
- Cursor-based pagination for large result sets

### 📁 [security-analytics/](security-analytics/)
**4 examples** - Security monitoring and threat detection

Detect security events:
- Privilege escalation attempts (RBAC changes)
- Secret access tracking
- Failed authentication (401 errors)
- Permission denied events (403 errors)

### 📁 [troubleshooting/](troubleshooting/)
**7 examples** - Incident investigation and debugging

Investigate issues:
- Failed pod operations
- Deployment activity tracking
- Resource deletion audits
- Namespace activity monitoring
- Configuration changes
- Failed operations across cluster
- Specific resource history

### 📁 [compliance/](compliance/)
**6 examples** - Compliance and audit reporting

Generate compliance reports:
- Data access audits
- RBAC policy changes
- PCI-DSS namespace audits
- User activity reports
- Production change logs
- Write operations audit

## Key Concepts

### CEL Filtering

All queries use CEL (Common Expression Language) expressions for filtering:

```yaml
spec:
  filter: "objectRef.namespace == 'production' && verb == 'delete'"
```

### Pagination

Handle large result sets with cursor-based pagination:

```yaml
spec:
  limit: 100  # Max results (default: 100, max: 1000)

  # For next page, use continueAfter from previous response
  continueAfter: "2024-01-15T10:30:45.123456789Z"
```

Results are always ordered by timestamp in descending order (newest first).

### Query Lifecycle

Queries are processed asynchronously:

1. Create query: `kubectl apply -f query.yaml`
2. Query enters `Running` phase
3. Results populate in `status.results[]`
4. Query enters `Completed` phase
5. Use `status.continueAfter` for next page

## Available Fields for CEL Expressions

### Top-level Fields
- `auditID` - Unique event ID (UUID string)
- `verb` - Operation verb (string): get, list, create, update, patch, delete, watch
- `stage` - Audit stage (string): RequestReceived, ResponseStarted, ResponseComplete, Panic
- `stageTimestamp` - Event timestamp (timestamp)

### Nested Object Fields

Access nested fields using dot notation:

#### objectRef.*
- `objectRef.namespace` - Namespace (string)
- `objectRef.resource` - Resource type (string): pods, deployments, etc.
- `objectRef.name` - Resource name (string)

#### user.*
- `user.username` - Username (string)

#### responseStatus.*
- `responseStatus.code` - HTTP status code (int)

### CEL Operators

- **Comparison**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Boolean**: `&&` (AND), `||` (OR)
- **List membership**: `in` (e.g., `verb in ['create', 'update']`)
- **String methods**: `startsWith()`, `endsWith()`, `contains()`

## Common Query Patterns

### Find Who Deleted a Resource

```yaml
spec:
  filter: |
    verb == 'delete' &&
    objectRef.resource == 'pods' &&
    objectRef.name == 'my-pod'
  limit: 10
```

### Track Failed Operations

```yaml
spec:
  filter: "responseStatus.code >= 400"
  limit: 100
```

### Monitor Privileged Actions

```yaml
spec:
  filter: "'system:masters' in user.groups"
  limit: 200
```

### Audit Namespace Activity

```yaml
spec:
  filter: "objectRef.namespace == 'production'"
  limit: 500
```

### Detect Unusual Activity

```yaml
spec:
  filter: |
    verb == 'delete' &&
    objectRef.namespace == 'production' &&
    !user.username.startsWith('system:')
  limit: 50
```

### Find Operations from Specific IP

```yaml
spec:
  filter: "'10.0.1.100' in sourceIPs"
  limit: 100
```

## Tips and Best Practices

1. **Start Simple**: Begin with basic field filtering, then add complexity
2. **Limit Results**: Use reasonable limits (100-500) to avoid overwhelming responses
3. **Use Pagination**: For large result sets, use `continueAfter` cursor pagination
4. **Test Incrementally**: Test queries with small limits first
5. **Leverage Indexed Fields**: Queries on materialized columns are faster (namespace, verb, resource, user, status_code)
6. **Combine Conditions**: Use `&&` and `||` to build precise filters

## Performance Considerations

- **Indexed Fields**: These materialized columns are indexed for fast queries:
  - `namespace`, `verb`, `resource`, `user`, `timestamp`, `resource_name`, `status_code`
- **Limits**: Smaller limits return faster
- **CEL Complexity**: Simple expressions are faster than complex multi-condition queries
- **Results are pre-ordered**: Always returned by timestamp DESC (newest first)

## Limitations

### Not Currently Supported

The following features are **not implemented** in the current API:

- ❌ Time ranges (`timeRange.start/end`) - queries always return all events
- ❌ Aggregations (`aggregation`, `groupBy`, `functions`) - no count/group operations
- ❌ Custom ordering (`orderBy`, `orderDirection`) - always timestamp DESC
- ❌ Offset pagination - only cursor-based pagination supported
- ❌ YAML object filters - must use CEL string expressions

### Field Name Differences

Be aware of these mappings between CEL and ClickHouse:

| CEL Expression | ClickHouse Column |
|----------------|-------------------|
| `objectRef.namespace` | `namespace` |
| `objectRef.resource` | `resource` |
| `objectRef.name` | `resource_name` |
| `user.username` | `user` |
| `responseStatus.code` | `status_code` |

## Learn More

- [CEL Language Guide](https://cel.dev)
- [Kubernetes Audit Events](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [Activity Source](../../pkg/apis/activity/v1alpha1/types.go)

## Contributing Examples

Have a useful query pattern? Contribute it!

1. Add your example to the appropriate category
2. Follow the naming convention: `NN-descriptive-name.yaml`
3. Include clear comments explaining the query
4. Ensure it uses only supported features
5. Test with `kubectl apply`
6. Submit a pull request
