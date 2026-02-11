# Activity

Ever wonder who changed that production secret? Or need to track down who deleted a deployment last week? Activity
makes it easy to ask questions about what's happening in your Kubernetes clusters.

## What is this?

Activity is a Kubernetes extension that lets you query your cluster's audit logs using familiar Kubernetes
tools. Instead of digging through log files, you can use `kubectl` to ask questions like "show me all the deletions in
production" or "who accessed secrets in the last hour?"

Think of it as a search engine for everything that happens in your cluster. It's built as an aggregated API server,
which means it feels like a natural part of Kubernetes, not a bolt-on tool.

## Components

Activity consists of several components that work together:

- **activity-apiserver**: Kubernetes aggregated API server that processes audit log queries
- **activity-ui**: React component library for building web interfaces
- **kubectl-activity**: kubectl plugin for command-line querying

## What can it do right now?

- **Ask powerful questions** using CEL expressions: "Find all secret deletions by users whose name starts with
  'system:'"
- **Filter by what matters**: time ranges, namespaces, actions (create/update/delete), resource types, users, and more
- **Fast queries** thanks to a high-performance ClickHouse backend with smart indexing
- **Works like Kubernetes** because it's built as an aggregated API server—use `kubectl` or any Kubernetes client
- **Multi-tenant by design** so teams can only see their own activity

## What's coming next?

We're working on some exciting features to make activity tracking even more powerful:

**Human-readable activity summaries** - Right now, you get raw audit events. Soon, you'll see friendly descriptions like
"Alice deleted the production-db secret in the billing namespace" instead of decoding JSON structures.

**Flexible, dynamic descriptions** - We're building a system that lets you define how events should be described for
your organization. Want to call them "changes" instead of "updates"? Prefer different phrasing for different teams? No
problem—and you won't need to re-process historical data to make changes.

These features are part of our vision to transform raw audit logs into clear, actionable insights that anyone can
understand. You can follow the detailed roadmap in [this enhancement
proposal](https://github.com/datum-cloud/enhancements/issues/469).

## Documentation

- [Architecture Overview](docs/architecture/README.md) - System design and components
- [API Reference](docs/api.md) - API specifications

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
- Go 1.24.0 or later
- [Task](https://taskfile.dev) for development workflows
- Docker for building container images

## License

See [LICENSE](LICENSE) for details.

---

**Questions or feedback?** Open an issue—we're here to help!
