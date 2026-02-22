# Activity CLI User Guide

The Activity CLI makes it easy to query and analyze your Kubernetes cluster's audit logs, events, and human-readable activity summaries. Instead of digging through log files or complex log aggregation systems, you can use simple commands to answer questions like "who deleted that secret?" or "what changed in production last week?"

## What is the Activity CLI?

The Activity CLI is a command-line tool that lets you search through Kubernetes audit logs, events, and activity summaries using familiar kubectl-style commands. It connects to the Activity API server, which indexes data in a fast ClickHouse database, giving you instant answers to questions about cluster activity.

Think of it as a search engine for everything that happens in your cluster—deployments, secrets, configuration changes, deletions, and more.

The CLI is designed to be flexible and can be used in two ways:

1. **As a standalone kubectl plugin** (`kubectl-activity`) - Use it directly with `kubectl activity` commands
2. **Embedded in your own CLI** - The Activity CLI is built as a reusable Go library that can be integrated into custom command-line tools, allowing you to add audit log querying capabilities to your own applications

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

If you're building your own CLI tool, you can embed the Activity commands using the `NewActivityCommand()` function. This allows you to provide audit log querying capabilities within your own application:

```go
import (
    "github.com/spf13/cobra"
    activitycmd "go.miloapis.com/activity/pkg/cmd"
)

// Add activity command to your root command
rootCmd.AddCommand(activitycmd.NewActivityCommand(activitycmd.ActivityCommandOptions{}))
```

You can customize the behavior by providing your own factory, IO streams, or config flags through `ActivityCommandOptions`:

```go
// Custom configuration
opts := activitycmd.ActivityCommandOptions{
    Factory:     myKubectlFactory,
    IOStreams:   myIOStreams,
    ConfigFlags: myConfigFlags,
}
rootCmd.AddCommand(activitycmd.NewActivityCommand(opts))
```

## Commands Overview

The Activity CLI provides several commands organized by data source:

| Command | Purpose | Data Source |
|---------|---------|-------------|
| `audit` | Query audit logs | Raw Kubernetes audit events |
| `events` | Query Kubernetes events | Cluster events with 60-day retention |
| `feed` | Query activity summaries | Human-readable activity descriptions |
| `history` | View resource change history | Resource-specific audit log timeline |
| `policy preview` | Test ActivityPolicy rules | Policy validation and testing |
| `version` | Show CLI and server version | Version information |

## Common Patterns

Before diving into individual commands, let's cover patterns used across all commands.

### Time Range Filtering

All query commands support time range filtering with `--start-time` and `--end-time`:

**Relative time formats:**
- `now-30m` - 30 minutes ago
- `now-2h` - 2 hours ago
- `now-7d` - 7 days ago
- `now-1w` - 1 week ago
- Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks)

**Absolute time formats:**
- `2024-01-01T00:00:00Z` - RFC3339 format with timezone
- `2024-12-25T12:00:00-05:00` - With timezone offset

**Examples:**
```bash
# Last 24 hours (default)
kubectl activity audit

# Last week
kubectl activity audit --start-time "now-7d"

# Specific time range
kubectl activity audit --start-time "2024-01-01T00:00:00Z" --end-time "2024-01-31T23:59:59Z"
```

### Pagination

Control result pagination across all commands:

```bash
# Limit results per page (default: 25)
kubectl activity audit --limit 100

# Get next page using continuation token
kubectl activity audit --continue-after "eyJhbGciOiJ..."

# Fetch all results automatically
kubectl activity audit --all-pages
```

### Output Formats

All commands support standard kubectl output formats:

```bash
# Table format (default, human-readable)
kubectl activity audit

# JSON output
kubectl activity audit -o json

# YAML output
kubectl activity audit -o yaml

# Custom output with JSONPath
kubectl activity audit -o jsonpath='{.items[*].verb}'

# Custom output with Go templates
kubectl activity audit -o go-template='{{range .items}}{{.verb}} {{.user.username}}{{"\n"}}{{end}}'

# Suppress table headers
kubectl activity audit --no-headers
```

### Suggest Mode (Field Discovery)

Discover distinct values for fields to help build filters:

```bash
# What users are active?
kubectl activity audit --suggest user.username

# What resource types exist?
kubectl activity feed --suggest spec.resource.kind

# What event reasons are common?
kubectl activity events --suggest reason
```

Output shows field values with occurrence counts:

```
FIELD: user.username
VALUE                                  COUNT
alice@example.com                      142
bob@example.com                        89
system:serviceaccount:default:my-sa    67
```

## Command Reference

### `kubectl activity audit`

Query raw Kubernetes audit logs. This is the most detailed view, showing every API operation recorded by the audit system.

**Use when you need:**
- Detailed API operation information
- Access to response codes and error details
- Fine-grained filtering on audit log fields

**Basic usage:**

```bash
# Recent activity (last 24 hours)
kubectl activity audit

# Last 7 days of activity
kubectl activity audit --start-time "now-7d"
```

**Shorthand filters:**

Shorthand flags provide quick filtering without writing CEL expressions:

```bash
# Filter by namespace
kubectl activity audit --namespace production

# Filter by resource type
kubectl activity audit --resource secrets

# Filter by API verb
kubectl activity audit --verb delete

# Filter by user
kubectl activity audit --user alice@example.com

# Combine multiple filters (AND logic)
kubectl activity audit --namespace production --verb delete
```

**CEL filter expressions:**

Use `--filter` for complex queries with CEL (Common Expression Language):

```bash
# Failed operations
kubectl activity audit --filter "responseStatus.code >= 400"

# Service account activity
kubectl activity audit --filter "user.username.startsWith('system:serviceaccount:')"

# Multiple resource types
kubectl activity audit --filter "objectRef.resource in ['secrets', 'configmaps']"

# Combine with shorthand flags
kubectl activity audit --namespace production \
  --filter "verb in ['create', 'update', 'delete', 'patch']"
```

**Table output:**

```
TIMESTAMP                  VERB    USER                   RESOURCE                          STATUS
2026-02-21T15:30:00Z      delete  alice@example.com      production/secrets/db-password    200
2026-02-21T15:25:00Z      update  system:sa:controller   production/deployments/api        200
2026-02-21T15:20:00Z      create  bob@example.com        default/configmaps/app-config     201
```

**Common use cases:**

```bash
# Find who deleted a specific resource
kubectl activity audit --verb delete \
  --filter "objectRef.name == 'my-pod'"

# Track down failed operations
kubectl activity audit --filter "responseStatus.code >= 400"

# Security audit: all secret access
kubectl activity audit --resource secrets

# Generate compliance report
kubectl activity audit --start-time "now-30d" \
  --namespace production \
  --all-pages -o json > production-audit.json
```

### `kubectl activity events`

Query Kubernetes events with 60-day retention. This provides much longer retention than the native Kubernetes Events API (which only keeps events for 24 hours).

**Use when you need:**
- Pod restart reasons
- Mount failures
- Image pull errors
- Scheduling problems
- Warning events over time

**Basic usage:**

```bash
# Recent events (last 24 hours)
kubectl activity events

# Last week of events
kubectl activity events --start-time "now-7d"
```

**Filtering:**

```bash
# Warning events only
kubectl activity events --type Warning

# Events for a specific pod
kubectl activity events --involved-name my-pod --involved-kind Pod

# Events by reason
kubectl activity events --reason FailedMount

# Events in a namespace
kubectl activity events -n production

# Use standard Kubernetes field selectors
kubectl activity events --field-selector "involvedObject.kind=Pod,type=Warning"
```

**Table output:**

```
LAST SEEN              TYPE      REASON         OBJECT                MESSAGE
2026-02-21T15:30:00Z   Warning   FailedMount    Pod/my-app-xyz        Unable to mount volume
2026-02-21T15:25:00Z   Normal    Pulled         Pod/my-app-abc        Successfully pulled image
2026-02-21T15:20:00Z   Warning   BackOff        Pod/crashing-pod      Back-off restarting failed
```

**Common use cases:**

```bash
# Debug pod restarts
kubectl activity events --involved-name my-pod \
  --type Warning --start-time "now-1h"

# Find all mount failures in the last week
kubectl activity events --reason FailedMount --start-time "now-7d"

# Discover what event reasons exist
kubectl activity events --suggest reason

# Get all warning events across the cluster
kubectl activity events --type Warning --all-pages
```

### `kubectl activity feed`

Query human-readable activity summaries. This is the primary command for understanding what happened in your cluster in plain English.

**Use when you need:**
- Easy-to-read activity descriptions
- Filtering by human vs. system changes
- Live monitoring of cluster changes
- Quick understanding of "what happened"

**Basic usage:**

```bash
# Recent activity (last 24 hours)
kubectl activity feed

# Last 7 days
kubectl activity feed --start-time "now-7d"
```

**Filtering:**

```bash
# Human-initiated changes only
kubectl activity feed --change-source human

# System/controller changes only
kubectl activity feed --change-source system

# Activities by a specific user
kubectl activity feed --actor alice@example.com

# Activities for a specific resource type
kubectl activity feed --kind Deployment

# Search activity summaries
kubectl activity feed --search "deleted secret"

# Filter by namespace
kubectl activity feed -n production

# Complex filters with CEL
kubectl activity feed --filter "spec.resource.kind in ['Deployment', 'StatefulSet']"
```

**Watch mode:**

Monitor live activity as it happens:

```bash
# Watch for new activities (live feed)
kubectl activity feed --watch

# Watch human changes only
kubectl activity feed --change-source human --watch

# Watch specific namespace
kubectl activity feed -n production --watch
```

**Output formats:**

Table format (default):
```
TIMESTAMP                  ACTOR                SOURCE   SUMMARY
2026-02-21T15:30:00Z      alice@example.com    human    created HTTPProxy api-gateway
2026-02-21T15:25:00Z      controller:contour   system   updated status of HTTPProxy api-gateway
2026-02-21T15:20:00Z      bob@example.com      human    deleted ConfigMap old-config
```

Summary format (`-o summary`):
```
alice created HTTPProxy api-gateway
controller:contour updated status of HTTPProxy api-gateway
bob deleted ConfigMap old-config
```

**Common use cases:**

```bash
# See what humans are doing right now
kubectl activity feed --change-source human --watch

# Find who made recent changes to deployments
kubectl activity feed --kind Deployment

# Search for specific activity
kubectl activity feed --search "created HTTPProxy"

# Discover active users
kubectl activity feed --suggest spec.actor.name

# Get feed for a specific resource
kubectl activity feed --resource-uid "abc123-def456-..."
```

### `kubectl activity history`

View the change history of a specific resource with optional diffs between versions.

**Use when you need:**
- Resource change timeline
- Diffs showing what changed
- Tracking configuration drift
- Understanding who changed what and when

**Basic usage:**

```bash
# View history of a deployment
kubectl activity history deployments api-server -n production

# View history with diffs
kubectl activity history configmaps app-config -n default --diff

# Last 7 days only
kubectl activity history secrets db-password -n production --start-time "now-7d"
```

**Table output:**

```
TIMESTAMP                  VERB    USER                STATUS
2026-02-21T15:30:00Z      update  alice@example.com   200
2026-02-21T12:00:00Z      patch   bob@example.com     200
2026-02-18T09:00:00Z      create  alice@example.com   201
```

**Diff output (`--diff`):**

```
TIMESTAMP                  VERB    USER                STATUS
2026-02-21T15:30:00Z      update  alice@example.com   200

--- before
+++ after
@@ -1,5 +1,5 @@
 spec:
-  replicas: 3
+  replicas: 5
   selector:
     matchLabels:
       app: api-server
```

**Common use cases:**

```bash
# See complete change history with diffs
kubectl activity history secrets database-credentials -n production --diff

# Track configuration changes
kubectl activity history configmaps app-settings -n default --all-pages

# Export history for analysis
kubectl activity history deployments my-app -n default -o json > history.json
```

### `kubectl activity policy preview`

Test ActivityPolicy rules before deploying them. This enables rapid policy development with immediate feedback.

**Use when you need:**
- Policy rule validation
- Testing policy matching logic
- Verifying activity summary output
- Iterating on policy development

**Basic usage:**

```bash
# Preview policy with sample inputs
kubectl activity policy preview -f policy.yaml --input samples.yaml

# Validate policy syntax only
kubectl activity policy preview -f policy.yaml --dry-run

# JSON output for scripting
kubectl activity policy preview -f policy.yaml --input samples.yaml -o json
```

**Input file format:**

Create a YAML file with sample audit events:

```yaml
# samples.yaml
inputs:
  - type: audit
    audit:
      verb: create
      user:
        username: alice@example.com
      objectRef:
        apiGroup: networking.datumapis.com
        resource: httpproxies
        name: api-gateway
        namespace: production
      responseStatus:
        code: 201

  - type: audit
    audit:
      verb: delete
      user:
        username: bob@example.com
      objectRef:
        apiGroup: networking.datumapis.com
        resource: httpproxies
        name: old-proxy
        namespace: default
      responseStatus:
        code: 200
```

**Table output:**

```
INPUT                                      MATCHED   RULE   ACTIVITY SUMMARY
audit: create httpproxies/api-gateway     yes       0      alice created HTTPProxy api-gateway
audit: delete httpproxies/old-proxy       yes       1      bob deleted HTTPProxy old-proxy
audit: get httpproxies/test               no        -      -
```

**Error output:**

When rules have errors, they're displayed inline:

```
INPUT                                      MATCHED   RULE   ERROR
audit: create httpproxies/test            error     0      CEL compilation failed: undefined field 'nonexistent'
```

**Common use cases:**

```bash
# Test policy during development
kubectl activity policy preview -f my-policy.yaml --input test-cases.yaml

# Validate syntax before deployment
kubectl activity policy preview -f my-policy.yaml --dry-run

# Quick iteration loop
# 1. Edit policy.yaml
# 2. Run preview
# 3. Verify output
# 4. Repeat until correct
```

### `kubectl activity version`

Show version information for the CLI and connected server.

```bash
# Show both client and server versions
kubectl activity version

# Client version only
kubectl activity version --client

# Short format (version numbers only)
kubectl activity version --short

# JSON output
kubectl activity version -o json
```

Output:
```
Client Version: v0.3.0
Server Version: v0.3.0
API Version: activity.miloapis.com/v1alpha1
```

## User Workflows

### Workflow 1: Incident Investigation

"Something deleted my pod, who did it?"

```bash
# Start broad - what deletions happened recently?
kubectl activity audit --verb delete --start-time "now-1h"

# Narrow down to the specific pod
kubectl activity audit --verb delete --resource pods \
  --filter "objectRef.name == 'my-pod'"

# Or check the activity feed for human-readable context
kubectl activity feed --search "deleted pod my-pod"
```

### Workflow 2: Monitoring Live Changes

"I want to see what's happening in production right now"

```bash
# Watch human-initiated changes
kubectl activity feed -n production --change-source human --watch
```

### Workflow 3: Compliance Audit

"Generate a report of all changes in production last month"

```bash
# Export all write operations
kubectl activity audit \
  --start-time "now-30d" \
  --namespace production \
  --filter "verb in ['create', 'update', 'delete', 'patch']" \
  --all-pages \
  -o json > production-changes.json
```

### Workflow 4: Policy Development

"I'm writing a policy for HTTPProxy resources and want to test it"

```bash
# Create sample inputs
cat > samples.yaml << 'EOF'
inputs:
  - type: audit
    audit:
      verb: create
      user: { username: alice@example.com }
      objectRef:
        apiGroup: networking.datumapis.com
        resource: httpproxies
        name: test-proxy
EOF

# Test the policy
kubectl activity policy preview -f my-policy.yaml --input samples.yaml

# Iterate: edit policy, re-run preview
```

### Workflow 5: Discovering Filter Values

"What actors have been active? What resource types exist?"

```bash
# Who's active?
kubectl activity feed --suggest spec.actor.name

# What resources have activities?
kubectl activity feed --suggest spec.resource.kind

# Use the results to build filters
kubectl activity feed --actor alice@example.com --kind Deployment
```

### Workflow 6: Event Investigation

"My pod keeps restarting, what events are related?"

```bash
# Find warning events for the pod
kubectl activity events --involved-name my-pod \
  --type Warning --start-time "now-1h"

# Look for mount failures specifically
kubectl activity events --reason FailedMount --start-time "now-7d"
```

### Workflow 7: Security Auditing

"Track all secret access in the last 24 hours"

```bash
# Find all secret access
kubectl activity audit --resource secrets

# Find secret access with failures
kubectl activity audit --resource secrets \
  --filter "responseStatus.code >= 400"

# Monitor live secret access
kubectl activity feed --kind Secret --watch
```

## Filter Reference

### Audit Log Fields (for `audit` command)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `verb` | string | API action | `verb == 'delete'` |
| `auditID` | string | Unique event ID | `auditID == 'abc-123'` |
| `user.username` | string | Actor username | `user.username == 'alice@example.com'` |
| `user.uid` | string | Actor UID | `user.uid == 'abc-123'` |
| `responseStatus.code` | int | HTTP response code | `responseStatus.code >= 400` |
| `objectRef.namespace` | string | Target namespace | `objectRef.namespace == 'production'` |
| `objectRef.resource` | string | Resource type (plural) | `objectRef.resource == 'secrets'` |
| `objectRef.name` | string | Resource name | `objectRef.name == 'my-app'` |
| `objectRef.apiGroup` | string | API group | `objectRef.apiGroup == 'apps'` |

### Activity Fields (for `feed` command)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `spec.changeSource` | string | "human" or "system" | `spec.changeSource == 'human'` |
| `spec.actor.name` | string | Actor display name | `spec.actor.name == 'alice@example.com'` |
| `spec.actor.type` | string | "user", "serviceaccount", "controller" | `spec.actor.type == 'user'` |
| `spec.resource.kind` | string | Resource kind | `spec.resource.kind == 'Deployment'` |
| `spec.resource.name` | string | Resource name | `spec.resource.name == 'my-app'` |
| `spec.resource.namespace` | string | Resource namespace | `spec.resource.namespace == 'production'` |
| `spec.summary` | string | Activity summary text | `spec.summary.contains('deleted')` |

### Event Fields (for `events` command)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `type` | string | "Normal" or "Warning" | `--type Warning` |
| `reason` | string | Event reason | `--reason FailedMount` |
| `involvedObject.kind` | string | Object kind | `--involved-kind Pod` |
| `involvedObject.name` | string | Object name | `--involved-name my-pod` |

### CEL Operators and Functions

| Operator/Function | Description | Example |
|-------------------|-------------|---------|
| `==`, `!=` | Equality | `verb == 'delete'` |
| `<`, `>`, `<=`, `>=` | Comparison | `responseStatus.code >= 400` |
| `&&`, `\|\|`, `!` | Logical | `verb == 'delete' && objectRef.namespace == 'prod'` |
| `in` | List membership | `verb in ['create', 'update', 'delete']` |
| `startsWith()` | String prefix | `user.username.startsWith('system:')` |
| `endsWith()` | String suffix | `objectRef.name.endsWith('-prod')` |
| `contains()` | String containment | `spec.summary.contains('deleted')` |

## Global Flags

These flags are inherited by all subcommands:

```bash
--kubeconfig string     Path to the kubeconfig file
--context string        The name of the kubeconfig context to use
--cluster string        The kubeconfig cluster to use
--user string           The kubeconfig user to use
-v, --verbose int       Verbosity level (0-9)
```

## Tips and Best Practices

1. **Start broad, then filter** - Begin with a wide time range and basic filters, then narrow down based on what you find.

2. **Use `feed` for understanding, `audit` for details** - The feed command gives you human-readable summaries, while audit gives you raw details.

3. **Use `--diff` for investigations** - When tracking down what changed in a resource, the `--diff` flag shows you exactly what was modified.

4. **Save complex queries** - Create shell aliases or scripts for frequently-used queries:
   ```bash
   alias prod-deletions='kubectl activity audit --namespace production --verb delete'
   alias watch-prod='kubectl activity feed -n production --change-source human --watch'
   ```

5. **Use `--all-pages` carefully** - This fetches all results, which can be a lot of data for broad queries. Start with a limited query to see how many results you're dealing with.

6. **Leverage output formats** - Use `-o json` or `-o yaml` with tools like `jq` for post-processing:
   ```bash
   kubectl activity audit -o json | jq '.items[] | select(.verb=="delete") | .objectRef.name'
   ```

7. **Optimize time ranges** - Narrower time ranges return results faster. If you know approximately when something happened, use that to your advantage.

8. **Use suggest mode for discovery** - When you don't know what values exist for a field, use `--suggest` to discover them.

9. **Test policies before deploying** - Always use `policy preview` to validate your ActivityPolicy rules before applying them to the cluster.

## Troubleshooting

**"Query failed: connection refused"**
- Ensure the Activity API server is running and accessible
- Check your kubeconfig and context settings
- Verify the aggregated API service is registered: `kubectl get apiservices | grep activity`

**"Query failed: unauthorized"**
- Verify you have the necessary RBAC permissions to query audit logs
- Contact your cluster administrator for access
- Check if you can access other Activity resources: `kubectl get activitypolicies`

**No results returned**
- Double-check your time range (default is last 24 hours)
- Verify your filter syntax using simple filters first
- Ensure the resource type name is correct (use plural form: `secrets`, not `secret`)
- Try running without filters to see if there's any data

**"Watch mode is not yet implemented"**
- Watch mode for the feed command is coming in a future release
- Use periodic queries as a workaround: `watch kubectl activity feed --change-source human`

**Suggest mode returns no values**
- Verify you're using the correct field name
- Check if there's any data in the time range
- Try a wider time range: `--start-time "now-7d"`

## Migration from Previous Version

If you were using the old `query` command, here's how to migrate:

| Old Command | New Command |
|-------------|-------------|
| `kubectl activity query` | `kubectl activity audit` |
| `kubectl activity query --namespace prod` | `kubectl activity audit --namespace prod` |
| `kubectl activity query --filter "..."` | `kubectl activity audit --filter "..."` |

All flags remain the same, only the command name changed from `query` to `audit`.

## Learn More

- For API details, see [docs/api.md](./api.md)
- For architecture information, see [docs/architecture/README.md](./architecture/README.md)
- For development information, see the main [README.md](../README.md)
- For ActivityPolicy documentation, see the API reference
