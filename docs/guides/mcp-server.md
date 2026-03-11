# MCP Server Guide

The Activity service includes a built-in MCP (Model Context Protocol) server.
Once connected, your AI assistant can query your control plane's audit logs, activity
history, and events directly — no copy-pasting kubectl output, no manual log
searches.

Ask questions in plain language:

- "What changed in the last hour?"
- "Who modified the `api-gateway` HTTP proxy?"
- "Show me all failed operations from the last 24 hours."
- "What has alice@example.com been doing this week?"

The assistant uses live data from your control plane to answer.

## How it works

The MCP server is a subcommand of the `activity` binary. It starts a
stdio-based MCP server that your AI client connects to as a local process. The
server holds a Kubernetes client and executes queries against the Activity API
on the assistant's behalf.

No data is sent to any remote service. The MCP server reads from your control plane
using your existing kubeconfig credentials.

## Prerequisites

- The `activity` binary installed and in your `$PATH`
- A kubeconfig with access to the Activity API resources
- An MCP-compatible AI client (Claude Desktop, Claude Code, Cursor, VS Code
  with an MCP extension, etc.)

## Connection setup

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "activity": {
      "command": "activity",
      "args": ["mcp", "--kubeconfig", "/path/to/your/kubeconfig"]
    }
  }
}
```

The config file is located at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code

Add the server to your project or global MCP configuration:

```json
{
  "mcpServers": {
    "activity": {
      "command": "activity",
      "args": ["mcp"]
    }
  }
}
```

When `--kubeconfig` is omitted, the server auto-detects the configuration:
in-cluster config when running inside a pod, or the default kubeconfig
location and current context otherwise.

### Using a specific kubeconfig context

To point at a specific cluster context:

```json
{
  "mcpServers": {
    "activity": {
      "command": "activity",
      "args": ["mcp", "--context", "my-staging-cluster"]
    }
  }
}
```

### Available flags

| Flag | Default | Description |
|------|---------|-------------|
| `--kubeconfig` | auto-detected | Path to kubeconfig file; uses in-cluster config when running in a pod, otherwise the default kubeconfig location |
| `--context` | current context | Kubeconfig context to use |
| `--namespace` | `default` | Namespace for namespaced resources like Activities |

## Available tools

The MCP server registers 14 tools across six categories. Your AI assistant
selects the right tool automatically based on your question.

### Audit log tools

Raw audit logs from the Kubernetes control plane. Use these when you need
precise, low-level details about API calls.

| Tool | What it does |
|------|-------------|
| `query_audit_logs` | Search audit logs with CEL filters, time ranges, and result limits |
| `get_audit_log_facets` | Get distinct values and counts for audit log fields (users, verbs, resources, namespaces) |

### Activity tools

Human-readable summaries translated from audit logs via ActivityPolicy rules.
Use these when you want plain-language descriptions like "alice created HTTP
proxy api-gateway".

| Tool | What it does |
|------|-------------|
| `query_activities` | Search activity summaries with filters for actor, resource kind, change source, and full-text search |
| `get_activity_facets` | Get distinct values for activity fields to understand who's active and what's changing |

### Investigation tools

Higher-level tools built on top of audit logs and activities, designed for
specific investigation patterns.

| Tool | What it does |
|------|-------------|
| `find_failed_operations` | Find API calls that returned 4xx or 5xx responses — useful for debugging permission denials and failed deployments |
| `get_resource_history` | Get the full change history for a specific resource by name, kind, or UID |
| `get_user_activity_summary` | Get a summary of a specific user's recent actions, including resource types touched and activity by day |

### Analytics tools

Tools for trend analysis, summaries, and period comparisons.

| Tool | What it does |
|------|-------------|
| `get_activity_timeline` | Activity counts grouped by hour or day — useful for correlating incidents with activity spikes |
| `summarize_recent_activity` | Generate a summary with top actors, most-changed resources, and key highlights for a time period |
| `compare_activity_periods` | Compare activity between two time windows to identify what changed, new actors, and volume trends |

### Event tools

Control plane events (separate from audit logs) that capture resource lifecycle
changes, provisioning status, warnings, and errors.

| Tool | What it does |
|------|-------------|
| `query_events` | Search control plane events with filters and time ranges |
| `get_event_facets` | Get distinct values for event fields (type, reason, source component, involved resource) |

### Policy tools

Tools for working with ActivityPolicy resources that define how audit logs are
translated into human-readable activities.

| Tool | What it does |
|------|-------------|
| `list_activity_policies` | List configured ActivityPolicies and their status |
| `preview_activity_policy` | Test a policy against sample audit events before deploying it |

## Example queries

The following examples show natural-language prompts you can give your AI
assistant once the MCP server is connected.

**Incident investigation**

```
What changed in the production namespace in the last two hours?
```

```
Show me all failed operations from the last 24 hours, grouped by status code.
```

```
Who last modified the secret named database-credentials?
```

**User activity review**

```
What has alice@example.com done in the last week?
```

```
Show me all resources that bob@example.com created or deleted in March.
```

**Trend analysis**

```
Compare activity this week vs last week. What changed?
```

```
When was the busiest period of control plane activity in the last 30 days?
```

**Resource history**

```
Show me the full change history for the HTTPProxy named api-gateway.
```

```
What operations were performed on deployments in the default namespace today?
```

**Policy development**

```
I'm writing an ActivityPolicy for NetworkPolicy resources. Preview it against
recent audit events to see what summaries it would generate.
```

## Time expressions

All tools that accept `startTime` and `endTime` support relative time
expressions:

| Expression | Meaning |
|-----------|---------|
| `now` | Current time |
| `now-1h` | One hour ago |
| `now-24h` | 24 hours ago |
| `now-7d` | Seven days ago |
| `now-30d` | 30 days ago |

Absolute timestamps in RFC 3339 format (`2026-03-10T14:00:00Z`) are also
accepted.

## Troubleshooting

**The server fails to start with "failed to create kubernetes config"**

The server cannot locate or parse your kubeconfig. Pass the path explicitly:

```json
"args": ["mcp", "--kubeconfig", "/absolute/path/to/kubeconfig"]
```

**Tools return empty results**

The Activity API server may not be deployed, or your kubeconfig context may
be pointing at the wrong control plane. Verify access with:

```bash
kubectl get activities --context your-context
```

**Permission denied errors in tool responses**

Your kubeconfig credentials lack access to Activity API resources. The
required resource verbs are `create` on `auditlogqueries`,
`auditlogfacetsqueries`, `activityqueries`, `activityfacetqueries`,
`eventqueries`, and `eventfacetqueries`.

**The assistant doesn't use the Activity tools**

Restart your AI client after modifying the MCP configuration. Most clients
only load MCP servers at startup.
