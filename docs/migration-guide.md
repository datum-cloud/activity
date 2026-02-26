# Migration Guide: CLI v0.2.x to v0.3.0

This guide helps you migrate from the previous CLI structure to the new command organization introduced in v0.3.0.

## Summary of Changes

The Activity CLI has been restructured to provide a clearer mental model organized by data source. The old `query` command has been replaced with specific commands for each type of data.

## Breaking Changes

### Command Rename: `query` → `audit`

The `kubectl activity query` command has been renamed to `kubectl activity audit`.

**Rationale**: The old name was ambiguous - it wasn't clear what you were querying. The new name accurately describes that you're querying audit logs.

### Migration Steps

1. **Update your scripts and aliases**

   Replace all instances of `kubectl activity query` with `kubectl activity audit`:

   ```bash
   # Old command
   kubectl activity query --namespace production

   # New command
   kubectl activity audit --namespace production
   ```

2. **All flags remain the same**

   No flag names or behavior has changed. Only the command name changed:

   ```bash
   # Old
   kubectl activity query --start-time "now-7d" --filter "verb == 'delete'"

   # New
   kubectl activity audit --start-time "now-7d" --filter "verb == 'delete'"
   ```

3. **Find and replace**

   If you have scripts, a simple find-and-replace is all you need:

   ```bash
   # In your scripts
   sed -i 's/kubectl activity query/kubectl activity audit/g' your-script.sh
   ```

## New Capabilities

While migrating, take advantage of the new commands:

### Query Kubernetes Events

```bash
# Query events with 60-day retention (vs. 24-hour default)
kubectl activity events --type Warning --start-time "now-7d"

# Find pod restart reasons
kubectl activity events --involved-name my-pod --reason BackOff
```

### Human-Readable Activity Summaries

```bash
# See what happened in plain English
kubectl activity feed --change-source human

# Watch live activity
kubectl activity feed --watch

# Search for specific activities
kubectl activity feed --search "deleted secret"
```

### Test Policies Before Deployment

```bash
# Preview policy rules against sample inputs
kubectl activity policy preview -f my-policy.yaml --input samples.yaml

# Validate policy syntax
kubectl activity policy preview -f my-policy.yaml --dry-run
```

### Discover Field Values

All commands now support `--suggest` mode for field discovery:

```bash
# What users are active?
kubectl activity audit --suggest user.username

# What event reasons exist?
kubectl activity events --suggest reason

# What actors are making changes?
kubectl activity feed --suggest spec.actor.name
```

## Quick Reference

| Old Command | New Command | Notes |
|-------------|-------------|-------|
| `kubectl activity query` | `kubectl activity audit` | Same flags, new name |
| N/A | `kubectl activity events` | New - query Kubernetes events |
| N/A | `kubectl activity feed` | New - human-readable summaries |
| `kubectl activity history` | `kubectl activity history` | Unchanged |
| N/A | `kubectl activity policy preview` | New - test policies |

## Common Migration Examples

### Audit Log Queries

```bash
# Old
kubectl activity query --start-time "now-7d" --filter "verb == 'delete'"

# New
kubectl activity audit --start-time "now-7d" --filter "verb == 'delete'"
```

### Namespace Filtering

```bash
# Old
kubectl activity query --filter "objectRef.namespace == 'production'"

# New (using shorthand)
kubectl activity audit --namespace production
```

### Failed Operations

```bash
# Old
kubectl activity query --filter "responseStatus.code >= 400"

# New
kubectl activity audit --filter "responseStatus.code >= 400"
```

### Export to JSON

```bash
# Old
kubectl activity query --all-pages -o json > audit.json

# New
kubectl activity audit --all-pages -o json > audit.json
```

## Need Help?

- **Documentation**: See the [CLI User Guide](./cli-user-guide.md) for complete command reference
- **Examples**: The user guide includes 7+ workflow examples
- **Troubleshooting**: Check the troubleshooting section in the user guide
- **Issues**: Open an issue on GitHub if you encounter problems

## Timeline

- **v0.2.x and earlier**: `query` command available
- **v0.3.0**: `query` command removed, `audit` command available
- **Deprecation notice**: None - clean break (no existing production users)

## Backward Compatibility

There is no backward compatibility mode. The `query` command has been fully removed in v0.3.0.

If you need to support both versions, use version detection:

```bash
# Check CLI version
VERSION=$(kubectl activity version --client --short)

if [[ "$VERSION" < "v0.3.0" ]]; then
  kubectl activity query "$@"
else
  kubectl activity audit "$@"
fi
```

## Questions?

If you have questions about the migration:

1. Check the [CLI User Guide](./cli-user-guide.md)
2. Review the [CHANGELOG](../CHANGELOG.md)
3. Open an issue on GitHub

We're here to help make the migration as smooth as possible.
