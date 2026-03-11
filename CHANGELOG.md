# Changelog

A high-level summary of what changed in each release. For the full story —
context, examples, and migration guidance — follow the release notes link in
each section.

---

## v0.3.0 — Unreleased

v0.3.0 transforms Activity from an audit log query service into a full platform
for understanding what happens inside your control plane. Audit logs and Kubernetes
events can now be translated into plain-language summaries, explored through an
embeddable UI, streamed in real time, and queried from AI assistants — all from
the same API surface.

- **Human-readable activity feed** — Define ActivityPolicy resources with CEL
  expressions to turn audit events into summaries like "Alice created HTTPProxy
  for myservice.com."
- **Kubernetes events as a first-class data type** — Search, filter, and stream
  control plane events alongside audit logs using EventQuery and EventFacetQuery.
- **ReindexJob** — Backfill activity records from historical data when you add
  or update a policy, so your feed reflects the complete picture.
- **`@datum-cloud/activity-ui` React component library** — Embed an activity
  feed, policy editor, PolicyPreview panel, and event explorer directly in your
  platform UI.
- **MCP server and Claude Code plugin** — Ask AI assistants like Claude "what
  changed last week?" and get answers drawn from real activity records. The
  `milo-activity` Claude Code plugin adds guided workflows for incident
  investigation, user auditing, and policy authoring.
- **Real-time Watch API** — Stream activity and event updates as they happen
  using standard Kubernetes Watch semantics, no polling required.
- **Structured logging, Grafana dashboards, and TLS/mTLS** — Production-grade
  observability and secure internal connections out of the box.
- **IAM roles for all API resources** — Least-privilege access control across
  the full Activity API surface, including ReindexJob.

Full release notes: [docs/releases/v0.3.0.md](docs/releases/v0.3.0.md)

---

## v0.2.0 — 2026-01-21

Added resource change history: you can now trace how a specific resource
evolved over time, seeing the full sequence of operations that brought it to its
current state.

---

## v0.1.0 — 2026-01-20

The initial release, introducing the core audit log query platform. Activity
launched as a Kubernetes aggregated API server backed by ClickHouse, queryable
with standard Kubernetes clients and kubectl.

- **Aggregated API server** — Query audit logs through the Kubernetes API with
  kubectl, client-go, or any Kubernetes-native tooling.
- **ClickHouse storage** with secure TLS connections and support for
  high-availability deployments with replicated storage.
- **kubectl-activity CLI plugin** — Command-line access to audit log queries
  without writing raw API calls.
- **User-scoped queries** with UID filtering and private IP scrubbing from log
  records.
- **Grafana dashboards** for query performance observability.
- **Milo IAM integration** and a CI/CD pipeline publishing container images and
  Kustomize bundles on every release.

CLI usage guide: [docs/cli-user-guide.md](docs/cli-user-guide.md)
