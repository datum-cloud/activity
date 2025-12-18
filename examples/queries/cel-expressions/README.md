# CEL Expression Examples

Advanced filtering using Common Expression Language (CEL) for complex queries.

## Examples

1. **[01-complex-status-filtering.yaml](01-complex-status-filtering.yaml)** - Filter by HTTP status code ranges
2. **[03-resource-name-pattern.yaml](03-resource-name-pattern.yaml)** - Match resources by name patterns
3. **[04-multiple-namespaces.yaml](04-multiple-namespaces.yaml)** - Query across multiple namespaces
4. **[05-write-operations.yaml](05-write-operations.yaml)** - Detect all write operations
5. **[07-combined-conditions.yaml](07-combined-conditions.yaml)** - Complex multi-condition queries

## CEL Basics

CEL expressions allow complex boolean logic:

```yaml
spec:
  celExpression: |
    response.code >= 400 && response.code < 600
```

### Operators

- `==` - Equals
- `!=` - Not equals
- `<`, `<=`, `>`, `>=` - Comparisons
- `&&` - Logical AND
- `||` - Logical OR
- `!` - Logical NOT
- `in` - List membership
- `.contains()` - String contains
- `.startsWith()` - String starts with
- `.endsWith()` - String ends with
- `.matches()` - Regex match

### Common Patterns

**Status Code Ranges:**
```cel
response.code >= 400 && response.code < 500  # Client errors
response.code >= 500  # Server errors
```

**List Membership:**
```cel
verb in ['create', 'update', 'patch', 'delete']  # Write ops
objectRef.namespace in ['production', 'staging']  # Multiple namespaces
```

**String Operations:**
```cel
objectRef.name.startsWith('prod-')
user.username.contains('admin')
!user.username.contains('system:')
```

**Complex Conditions:**
```cel
objectRef.namespace == 'production' &&
verb in ['create', 'update', 'patch', 'delete'] &&
responseStatus.code >= 400 &&
!user.username.startsWith('system:')
```

## Available Fields

See the [main README](../README.md#cel-expression-fields) for complete field list.

## CEL Resources

- [CEL Language Definition](https://cel.dev)
- [CEL by Example](https://github.com/google/cel-spec/blob/master/doc/intro.md)

## Next Steps

- [Security Analytics](../security-analytics/) - Pre-built security queries
- [Troubleshooting](../troubleshooting/) - Debugging queries
