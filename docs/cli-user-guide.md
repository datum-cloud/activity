# Activity CLI User Guide

The Activity CLI makes it easy to query and analyze your Kubernetes cluster's
audit logs. Instead of digging through log files or complex log aggregation
systems, you can use simple commands to answer questions like "who deleted that
secret?" or "what changed in production last week?"

## What is the Activity CLI?

The Activity CLI is a command-line tool that lets you search through Kubernetes
audit logs using familiar kubectl-style commands. It connects to the Activity
API server, which indexes audit logs in a fast ClickHouse database, giving you
instant answers to questions about cluster activity.

Think of it as a search engine for everything that happens in your
cluster—deployments, secrets, configuration changes, deletions, and more.

The CLI is designed to be flexible and can be used in two ways:
1. **As a standalone kubectl plugin** (`kubectl-activity`) - Use it directly
   with `kubectl activity` commands
2. **Embedded in your own CLI** - The Activity CLI is built as a reusable Go
   library that can be integrated into custom command-line tools, allowing you
   to add audit log querying capabilities to your own applications

## Installation

### As a kubectl Plugin

The Activity CLI works as a kubectl plugin. Once installed, you can use it with:

```bash
kubectl activity <command>
```

Or directly as:

```bash
kubectl-activity <command>
```

### Embedding in Your CLI

If you're building your own CLI tool, you can embed the Activity commands using
the `NewActivityCommand()` function. This allows you to provide audit log
querying capabilities within your own application:

```go
import (
    "github.com/spf13/cobra"
    activitycmd "go.miloapis.com/activity/pkg/cmd"
)

// Add activity command to your root command
rootCmd.AddCommand(activitycmd.NewActivityCommand(activitycmd.ActivityCommandOptions{}))
```

You can customize the behavior by providing your own factory, IO streams, or
config flags through `ActivityCommandOptions`:

```go
// Custom configuration
opts := activitycmd.ActivityCommandOptions{
    Factory:     myKubectlFactory,
    IOStreams:   myIOStreams,
    ConfigFlags: myConfigFlags,
}
rootCmd.AddCommand(activitycmd.NewActivityCommand(opts))
```

## Commands

The Activity CLI provides two main commands:

### 1. `query` - Search audit logs

Use `query` to search audit logs across your cluster using time ranges and
filters.

**Basic usage:**
```bash
# View recent activity (last 24 hours by default)
kubectl activity query

# Search the last hour
kubectl activity query --start-time "now-1h"

# Search a specific time range
kubectl activity query --start-time "now-7d" --end-time "now"
```

**Filtering results:**

Use CEL (Common Expression Language) filters to narrow down results:

```bash
# Find all deletions
kubectl activity query --filter "verb == 'delete'"

# Find deletions in a specific namespace
kubectl activity query --filter "verb == 'delete' && objectRef.namespace == 'production'"

# Find secret access
kubectl activity query --filter "objectRef.resource == 'secrets'"

# Find failed operations
kubectl activity query --filter "responseStatus.code >= 400"

# Find service account activity
kubectl activity query --filter "user.username.startsWith('system:serviceaccount:')"

# Combine multiple conditions
kubectl activity query --filter "verb in ['create', 'update', 'delete', 'patch'] && objectRef.namespace == 'production'"
```

**Output formats:**

The query command supports standard kubectl output formats:

```bash
# Table format (default)
kubectl activity query

# JSON output
kubectl activity query -o json

# YAML output
kubectl activity query -o yaml

# Custom output with JSONPath
kubectl activity query -o jsonpath='{.items[*].verb}'

# Custom output with Go templates
kubectl activity query -o go-template='{{range .items}}{{.verb}} {{.user.username}}{{"\n"}}{{end}}'
```

**Pagination:**

```bash
# Limit results per page (default: 25)
kubectl activity query --limit 100

# Get the next page using a continuation token
kubectl activity query --continue-after "eyJhbGciOiJ..."

# Fetch all results automatically across all pages
kubectl activity query --all-pages
```

### 2. `history` - View resource change history

Use `history` to see how a specific resource has changed over time.

**Basic usage:**
```bash
# View history of a domain resource
kubectl activity history domains example-com -n production

# View history with diff to see what changed
kubectl activity history configmaps app-config -n default --diff

# View changes from the last 7 days
kubectl activity history secrets api-credentials -n default --start-time "now-7d"
```

**Examples:**

```bash
# View all changes to a specific DNS record
kubectl activity history dnsrecordsets dns-record-www-example-com -n production

# See detailed diffs between versions
kubectl activity history configmaps app-settings -n default --diff

# View in JSON format
kubectl activity history domains example-com -n default -o json

# Get complete history across all pages
kubectl activity history secrets db-password -n default --all-pages
```

**Output modes:**

- **Table (default)**: Shows a table with timestamp, verb, user, and status code
- **`--diff`**: Shows unified diff between consecutive resource versions with
  color-coded changes
- **`-o json/yaml`**: Output raw audit events in structured format

## Time Formats

The Activity CLI supports two types of time formats:

**Relative time:**
- `now-30m` - 30 minutes ago
- `now-2h` - 2 hours ago
- `now-7d` - 7 days ago
- `now-1w` - 1 week ago
- Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks)

**Absolute time:**
- `2024-01-01T00:00:00Z` - RFC3339 format with timezone
- `2024-12-25T12:00:00-05:00` - With timezone offset

## Common Use Cases

### Incident Investigation

```bash
# Find who deleted a resource in the last hour
kubectl activity query --start-time "now-1h" \
  --filter "verb == 'delete' && objectRef.name == 'my-service'"

# Track down failed operations
kubectl activity query --filter "responseStatus.code >= 400"
```

### Security Auditing

```bash
# Find all secret access in the last 24 hours
kubectl activity query --filter "objectRef.resource == 'secrets'"

# Track privilege escalation attempts
kubectl activity query --filter "verb == 'create' && objectRef.resource == 'rolebindings'"

# Monitor service account activity
kubectl activity query --filter "user.username.startsWith('system:serviceaccount:')"
```

### Compliance Reporting

```bash
# Generate a report of all changes in production
kubectl activity query --start-time "now-30d" \
  --filter "objectRef.namespace == 'production' && verb in ['create', 'update', 'delete', 'patch']" \
  --all-pages -o json > production-changes.json

# Track configuration changes
kubectl activity query --filter "objectRef.resource in ['configmaps', 'secrets']" \
  --all-pages
```

### Change Tracking

```bash
# See complete history of a critical resource
kubectl activity history secrets database-credentials -n production --diff

# Track domain configuration changes
kubectl activity history domains api-example-com -n default --all-pages
```

## Global Flags

The Activity CLI inherits standard kubectl flags for cluster connectivity:

```bash
--kubeconfig string     Path to the kubeconfig file
--context string        The name of the kubeconfig context to use
--namespace string, -n  Namespace scope
```

## Filter Reference

Common filter expressions using CEL:

| Filter | Description |
|--------|-------------|
| `verb == 'delete'` | All deletions |
| `verb in ['create', 'update', 'delete', 'patch']` | Write operations |
| `objectRef.namespace == 'production'` | Events in production namespace |
| `objectRef.resource == 'secrets'` | Secret access |
| `objectRef.name == 'my-app'` | Specific resource name |
| `user.username == 'alice@example.com'` | Actions by specific user |
| `user.username.startsWith('system:serviceaccount:')` | Service account activity |
| `responseStatus.code >= 400` | Failed requests |
| `responseStatus.code == 200` | Successful requests |

You can combine filters with `&&` (AND) and `\|\|` (OR):

```bash
kubectl activity query --filter "verb == 'delete' && objectRef.namespace == 'production'"
```

## Tips and Best Practices

1. **Start broad, then filter**: Begin with a wide time range and basic filters,
   then narrow down based on what you find.

2. **Use `--diff` for investigations**: When tracking down what changed in a
   resource, the `--diff` flag shows you exactly what was modified.

3. **Save complex queries**: Create shell aliases or scripts for frequently-used
   queries:
   ```bash
   alias prod-deletions='kubectl activity query --filter "verb == '\''delete'\'' && objectRef.namespace == '\''production'\''"'
   ```

4. **Use `--all-pages` carefully**: This fetches all results, which can be a lot
   of data for broad queries. Start with a limited query to see how many results
   you're dealing with.

5. **Leverage output formats**: Use `-o json` or `-o yaml` with tools like `jq`
   for post-processing:
   ```bash
   kubectl activity query -o json | jq '.items[] | select(.verb=="delete") | .objectRef.name'
   ```

6. **Optimize time ranges**: Narrower time ranges return results faster. If you
   know approximately when something happened, use that to your advantage.

## Troubleshooting

**"Query failed: connection refused"**
- Ensure the Activity API server is running and accessible
- Check your kubeconfig and context settings

**"Query failed: unauthorized"**
- Verify you have the necessary RBAC permissions to query audit logs
- Contact your cluster administrator for access

**No results returned**
- Double-check your time range (default is last 24 hours)
- Verify your filter syntax using simple filters first
- Ensure the resource type name is correct (use plural form: `secrets`, not
  `secret`)

## Learn More

- For API details, see [docs/api.md](./api.md)
- For development information, see the main [README.md](../README.md)
