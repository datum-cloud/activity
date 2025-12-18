# Basic Filtering Examples

Simple field-based filtering for common audit log queries.

## Examples

1. **[01-filter-by-namespace.yaml](01-filter-by-namespace.yaml)** - Filter events in a specific namespace
2. **[02-filter-by-verb.yaml](02-filter-by-verb.yaml)** - Filter by operation type (create, update, delete, etc.)
3. **[03-filter-by-resource-type.yaml](03-filter-by-resource-type.yaml)** - Filter operations on specific resource types
4. **[04-filter-by-user.yaml](04-filter-by-user.yaml)** - Track activity by specific users
5. **[05-multiple-filters.yaml](05-multiple-filters.yaml)** - Combine multiple filters (AND logic)
6. **[06-filter-by-status-code.yaml](06-filter-by-status-code.yaml)** - Find failed operations

## Usage

Apply a query:
```bash
kubectl apply -f basic-filtering/01-filter-by-namespace.yaml
```

View results:
```bash
kubectl get auditlogquery events-in-production-namespace -o yaml
```

## Filter Fields

All basic filters use exact matching:

- `namespace` - Kubernetes namespace name
- `verb` - Operation: get, list, create, update, patch, delete, watch
- `resource` - Resource type: pods, deployments, services, etc.
- `resourceName` - Specific resource name
- `user` - Username (exact match)

## Combining Filters

Multiple filters use AND logic:

```yaml
spec:
  filter:
    namespace: production
    resource: pods
    verb: create
```

This matches events that are:
- In production namespace AND
- On pods resource AND
- Create operations

## Next Steps

For more complex queries, see:
- [CEL Expressions](../cel-expressions/) - Complex conditional logic
- [Time and Pagination](../time-and-pagination/) - Time-scoped queries
