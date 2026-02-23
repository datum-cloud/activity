# AI Tools User Guide

This guide shows how to use the AI tooling available for the Activity service to investigate platform activity, understand what's happening in your cluster, and author ActivityPolicy resources.

## Overview

The Activity service exposes a **Model Context Protocol (MCP) server** that gives AI assistants direct access to audit logs, activity summaries, Kubernetes events, and policy management. Combined with a Claude Code plugin, this creates two complementary ways to work with Activity data through natural language:

| Tool | Best For |
|------|---------|
| **MCP server** (Claude Desktop, VS Code) | Ongoing investigation sessions, iterative analysis, complex multi-step queries |
| **Claude Code plugin** (`/investigate`, agents) | Developer workflows, policy authoring, in-editor analysis |

Both surfaces expose the same 13+ underlying tools. The difference is the interface—one is conversational in a chat client, the other lives inside Claude Code.

## What the AI Can Do

The MCP server exposes tools across six functional areas:

### Audit Logs
Raw control-plane audit events from Kubernetes. Use these when you need precise low-level detail.

- **`query_audit_logs`** — Search audit events by time range and CEL filter
- **`get_audit_log_facets`** — Discover distinct values (who acted, what verbs, which namespaces)

### Activities (Human-Readable Summaries)
Translated summaries like "alice@example.com created HTTPProxy api-gateway". Requires ActivityPolicy resources to be configured.

- **`query_activities`** — Search activity summaries with filters for actor, resource kind, change source, and free text
- **`get_activity_facets`** — Discover top actors, resource types, and human vs. automated changes

### Investigation
High-level tools that combine multiple queries to answer common investigation questions.

- **`find_failed_operations`** — Surface 4xx/5xx errors; useful for debugging permission issues or failed deployments
- **`get_resource_history`** — Full change timeline for a specific resource (by name or UID)
- **`get_user_activity_summary`** — Summarize what a specific user did, broken down by resource kind and day

### Analytics
Tools for surfacing patterns, trends, and anomalies across time.

- **`get_activity_timeline`** — Hourly or daily activity counts; useful for identifying quiet periods or anomalous spikes
- **`summarize_recent_activity`** — Top actors, top resources, and highlights for any time window
- **`compare_activity_periods`** — Diff two time periods to find what increased, decreased, or appeared

### Policy Management
Tools for authoring and validating ActivityPolicy resources that define how audit logs are translated into human-readable Activities.

- **`list_activity_policies`** — List all configured policies with their status
- **`preview_activity_policy`** — Test a policy definition against sample audit events before deploying

### Events
Control-plane events (distinct from audit logs—these are Kubernetes Event objects).

- **`query_events`** — Search events by namespace, involved object, reason, and type
- **`get_event_facets`** — Discover common event types and source components

---

## Setup

### Option 1: MCP Server (Claude Desktop / VS Code)

The Activity service includes an `.mcp.json` configuration at the repository root. When you open this project in Claude Code or another MCP-compatible tool, it automatically registers the Activity MCP server.

For Claude Desktop, add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "activity": {
      "command": "activity",
      "args": [
        "mcp",
        "--kubeconfig", "/path/to/your/kubeconfig"
      ]
    }
  }
}
```

Or for development (running directly from source):

```json
{
  "mcpServers": {
    "activity": {
      "command": "go",
      "args": [
        "run", "./cmd/activity",
        "mcp",
        "--kubeconfig", ".test-infra/kubeconfig"
      ]
    }
  }
}
```

**Optional flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--kubeconfig` | Path to kubeconfig file | In-cluster config or `~/.kube/config` |
| `--context` | Kubeconfig context | Current context |
| `--namespace` | Namespace for namespaced resources | `default` |

### Option 2: Claude Code Plugin (datum-activity)

The `datum-activity` plugin (available from the Claude Code plugin marketplace) adds two specialized agents and a set of skills directly into Claude Code:

- **`activity-analyst` agent** — Investigates platform activity across audit logs, activities, and events
- **`timeline-designer` agent** — Guides you through creating ActivityPolicy resources from requirements through to testing
- **`/investigate` command** — Quick-start command for natural language investigation queries
- **`investigate` skill** — Audit log and activity query patterns with CEL filter examples
- **`analytics` skill** — Timeline, period comparison, and summary report generation
- **`policy-design` skill** — ActivityPolicy structure, templates, and design workflows

---

## Common Workflows

### Incident Investigation: "Who deleted my pod?"

The most common use case. Start with a natural language question; the AI will choose the right tools and narrow the results.

**With Claude Desktop (MCP):**

> "What happened to the nginx deployment in the production namespace in the last 2 hours?"

The AI will call `query_activities` filtered by resource name and time, then follow up with `get_resource_history` if you want the full diff timeline.

**With Claude Code (`/investigate`):**

```
/investigate Who deleted the nginx deployment in production?
```

The agent will query audit logs using `find_failed_operations` and `query_audit_logs`, surface the relevant event, and present the actor, timestamp, and request details.

**Useful follow-up questions:**
- "Show me everything that user did in the last 24 hours" → `get_user_activity_summary`
- "Was this accidental or part of a deployment?" → `get_activity_timeline` to see surrounding activity
- "Has this resource been deleted before?" → `get_resource_history` for the full history

---

### Security Audit: "Who accessed secrets recently?"

> "Summarize secret access in the last 7 days. Show me who accessed them and flag anything unusual."

The AI will:
1. Call `query_audit_logs` with `objectRef.resource == 'secrets'`
2. Call `get_audit_log_facets` on `user.username` to rank top accessors
3. Call `compare_activity_periods` to identify if secret access increased vs. the prior period

**Useful follow-up questions:**
- "Focus on service accounts only" → adds `user.username.startsWith('system:serviceaccount:')` filter
- "Were there any failed secret reads?" → `find_failed_operations` with resource filter

---

### Change Tracking: "What changed in production last week?"

> "Give me a summary of all write operations in the production namespace last week."

The AI will:
1. Call `summarize_recent_activity` for the last 7 days
2. Call `get_activity_facets` on `spec.resource.kind` to rank most-changed resource types
3. Optionally drill into specific resource kinds with `query_activities`

**Useful follow-up questions:**
- "Who made the most changes?" → `get_activity_facets` on `spec.actor.name`
- "Were changes mostly human or automated?" → `get_activity_facets` on `spec.changeSource`
- "Show me the timeline of changes" → `get_activity_timeline` with `bucketSize: "day"`

---

### Anomaly Detection: "Is activity today unusual?"

> "Compare today's activity to the same period last week. Flag anything that's significantly different."

The AI will call `compare_activity_periods` with appropriate baseline/comparison windows and surface resources or actors with increased or newly appearing activity.

---

### Policy Authoring: "Help me create activity summaries for HTTPProxy"

This workflow uses the `timeline-designer` agent or the `policy-design` skill.

> "I want human-readable activity summaries for HTTPProxy resources in the networking.datumapis.com API group. Help me create the ActivityPolicy."

The agent will:
1. Call `list_activity_policies` to check if one already exists
2. Ask about your desired summary format (e.g., "alice created HTTP proxy api-gateway")
3. Draft the ActivityPolicy YAML with CEL expressions in `match` and `summary` fields
4. Call `preview_activity_policy` with sample audit events to validate the rules
5. Show you what the generated summaries would look like before you deploy

**Example policy structure the agent will help you build:**

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
metadata:
  name: httpproxy-activity
spec:
  resource:
    apiGroup: networking.datumapis.com
    kind: HTTPProxy
  auditRules:
    - match: "audit.verb == 'create'"
      summary: "{{ actor }} created {{ link(kind + ' ' + audit.objectRef.name, audit.responseObject) }}"
    - match: "audit.verb == 'delete'"
      summary: "{{ actor }} deleted {{ kind }} {{ audit.objectRef.name }}"
    - match: "audit.verb in ['update', 'patch']"
      summary: "{{ actor }} updated {{ kind }} {{ audit.objectRef.name }}"
```

**To test before deploying:**

> "Test this policy against a real create event for an HTTPProxy"

The agent will call `query_audit_logs` to find an actual create event, then run it through `preview_activity_policy` to show the generated summary.

---

### Compliance Reporting: "Generate a change report for the last 30 days"

> "Generate a compliance report showing all write operations in the billing namespace for the last 30 days, grouped by actor."

The AI will:
1. Call `summarize_recent_activity` for the 30-day window
2. Call `get_activity_facets` to rank actors and resource types
3. Call `get_activity_timeline` with `bucketSize: "day"` to show the trend
4. Optionally call `compare_activity_periods` to compare vs. the prior 30 days

---

## Filter Reference

Both audit log and activity queries accept **CEL (Common Expression Language)** filter expressions.

### Audit Log Filters

| Scenario | Filter |
|----------|--------|
| All write operations | `verb in ['create', 'update', 'delete', 'patch']` |
| Deletions only | `verb == 'delete'` |
| Specific namespace | `objectRef.namespace == 'production'` |
| Specific resource type | `objectRef.resource == 'secrets'` |
| Specific resource name | `objectRef.name == 'my-service'` |
| Specific user | `user.username == 'alice@example.com'` |
| Service accounts | `user.username.startsWith('system:serviceaccount:')` |
| Failed requests | `responseStatus.code >= 400` |
| Forbidden errors | `responseStatus.code == 403` |

### Activity Filters

Activities support structured fields rather than CEL:

| Parameter | Values | Example |
|-----------|--------|---------|
| `changeSource` | `human`, `system` | Filter automated vs. human changes |
| `actorName` | email or username | `alice@example.com` |
| `resourceKind` | Kubernetes kind | `HTTPProxy`, `Deployment` |
| `apiGroup` | API group | `networking.datumapis.com` |
| `search` | Free text | `"deleted"`, `"api-gateway"` |

### Time Range Syntax

Both relative and absolute formats are supported:

| Format | Example |
|--------|---------|
| Relative | `now-30m`, `now-2h`, `now-7d`, `now-1w` |
| Absolute (ISO 8601) | `2024-01-15T10:30:00Z` |
| Absolute with offset | `2024-12-25T12:00:00-05:00` |

---

## Tips for Effective AI Queries

**Start broad, then narrow.** Ask a general question first (e.g., "what happened today?"), then use the AI's findings to focus follow-up questions. This mirrors how investigation naturally works and lets the AI use facets to guide filtering.

**Name the resource specifically.** The more specific the resource name, namespace, or actor, the better the results. "Who changed the api-gateway HTTPProxy in the networking namespace?" will yield a more precise answer than "what changed recently?"

**Use activities for human context, audit logs for precision.** Activities give you readable summaries ("alice created api-gateway") but only cover resource types that have ActivityPolicy definitions. Audit logs cover everything but require more interpretation.

**Ask the AI to explain its filters.** If you're unsure what CEL expression to use, ask: "What filter would I use to find all secret deletions?" The AI can translate plain English intent into the correct expression.

**Iterate on policies with preview.** When authoring ActivityPolicy resources, always use `preview_activity_policy` before deploying. Ask the AI to find real audit events for the target resource kind and run them through the policy to validate the output.

**Compare periods for anomaly detection.** The `compare_activity_periods` tool is most useful when you suspect something changed—ask "compare activity this week vs. last week" after an incident to identify what was different.

---

## Architecture: How the AI Accesses Activity Data

```
Claude / AI Assistant
        │
        │ MCP Protocol (stdio)
        ▼
  activity mcp server
        │
        │ Kubernetes API
        ▼
  activity-apiserver (aggregated API server)
        │
        │
   ┌────┴────┐
   │         │
ClickHouse  etcd
(audit logs, (ActivityPolicy
 activities,  resources)
 events)
```

The MCP server runs as a local process and communicates with the Activity API server using your kubeconfig credentials. All queries are executed server-side in ClickHouse—the MCP server only handles protocol translation between the AI and the Kubernetes API.

---

## Troubleshooting

**"No tools available" in Claude Desktop**

Verify the MCP server starts correctly:
```bash
go run ./cmd/activity mcp --kubeconfig .test-infra/kubeconfig
```
Check stderr for startup errors. Common causes: kubeconfig path is wrong, or the Activity API server is not running in the cluster.

**"No results returned"**

- Check your time range—the default is `now-7d`. If the event occurred outside this window, specify a wider range.
- Verify the resource name is plural for audit log queries (`secrets`, not `secret`).
- Try a broader query first (no filter, wide time range), then narrow down.

**"Activity results are empty but audit logs have data"**

Activities require ActivityPolicy resources to be configured for the target resource type. Use `list_activity_policies` to see which resource types have policies. If there's no policy for your resource, raw audit logs will still work.

**"Query failed: unauthorized"**

Your kubeconfig user needs RBAC permissions to create the ephemeral query resources (e.g., `AuditLogQuery`, `ActivityQuery`). Contact your cluster administrator if you're missing access.

---

## See Also

- [CLI User Guide](./cli-user-guide.md) — Using `kubectl activity` directly
- [API Reference](./api.md) — Full API specifications
- [Architecture Overview](./architecture/README.md) — How the system is structured
- [ActivityPolicy authoring](../pkg/apis/activity/v1alpha1/) — API type definitions
