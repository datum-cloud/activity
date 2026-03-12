# Activity

Ever wonder who changed that production secret? Or need to understand what happened before an incident? Activity
turns Kubernetes audit logs and control plane events into plain-language summaries you can search, stream, and
explore — using familiar Kubernetes tools.

## What is this?

Activity is a Kubernetes extension that translates raw audit logs and control plane events into a queryable activity
feed. You define how events are described using ActivityPolicy resources and CEL expressions — "Alice created
HTTPProxy for myservice.com" instead of decoding JSON structures. The feed is searchable by actor, resource, time
range, and more, and updates in real time via the Kubernetes Watch API.

It's built as an aggregated API server, so it works natively with `kubectl` and any Kubernetes client.

## Components

Activity consists of several components that work together:

- **activity-apiserver**: Kubernetes aggregated API server that handles queries, Watch streams, and the ActivityPolicy API
- **activity-processor**: Processes audit logs and control plane events through ActivityPolicy rules to generate Activity records
- **activity-controller-manager**: Manages ActivityPolicy lifecycle, status, and ReindexJob execution
- **activity-ui**: React component library (`@datum-cloud/activity-ui` on npm) for embedding activity exploration in your platform UI
- **kubectl-activity**: kubectl plugin for command-line querying
- **MCP server**: Exposes activity data to AI assistants via the Model Context Protocol

## What can it do right now?

- **Human-readable activity feed** — Define ActivityPolicy resources with CEL expressions to translate audit logs and control plane events into plain-language summaries. Test policies safely with the PolicyPreview API before deploying.
- **Control plane events** — Search and stream control plane events (pod restarts, scheduler decisions, BackOff messages) alongside audit logs using EventQuery and EventFacetQuery.
- **Powerful queries** using CEL expressions: "Find all secret deletions by users whose name starts with 'system:'"
- **Filter by what matters**: time ranges, namespaces, actions (create/update/delete), resource types, actors, and more
- **Real-time streaming** — Watch API support for Activity and Event resources so dashboards update instantly without polling
- **Reindex history** — Use ReindexJob to backfill Activity records when you add or update a policy, so your feed reflects the full history
- **AI integration** — Query activity data from AI assistants via the MCP server. The `milo-activity` Claude Code plugin adds guided investigation, auditing, and policy authoring workflows.
- **Embeddable UI** — Drop-in React components for activity feeds, policy editors, PolicyPreview panels, and event explorers
- **Fast queries** backed by a high-performance ClickHouse storage layer with smart indexing
- **Works like Kubernetes** because it's built as an aggregated API server — use `kubectl` or any Kubernetes client
- **Multi-tenant by design** so teams can only see their own activity

## Documentation

**Guides**
- [Activity Policies](docs/guides/activity-policies.md) - Writing CEL-based translation rules
- [Control Plane Events](docs/guides/control-plane-events.md) - Querying and streaming events
- [MCP Server](docs/guides/mcp-server.md) - Setting up AI assistant integration
- [ReindexJob](docs/guides/reindex-jobs.md) - Backfilling history when policies change
- [CLI User Guide](docs/cli-user-guide.md) - Complete guide to using the Activity CLI

**Reference**
- [API Reference](docs/api.md) - API specifications
- [Architecture Overview](docs/architecture/README.md) - System design and components
- [Migration Guide](docs/migration-guide.md) - Upgrading from previous versions

**Releases**
- [v0.3.0 Release Notes](docs/releases/v0.3.0.md)

## Who is this for?

- **Platform teams** who need to understand cluster activity across multiple tenants
- **Security teams** investigating incidents or building compliance reports
- **Developers** debugging "who changed what" questions
- **Anyone** who's ever wished Kubernetes audit logs were easier to query

## Prerequisites

**For users:**
- Kubernetes 1.34+ cluster
- kubectl configured to access your cluster

**For developers:**
- Go 1.25+
- [Task](https://taskfile.dev) for development workflows
- Docker for building container images

## License

See [LICENSE](LICENSE) for details.

---

**Questions or feedback?** Open an issue—we're here to help!
