# Events Pipeline PR Plan

This document tracks the work needed to merge the events pipeline functionality from `poc/event-processing-pipeline` into main via stacked PRs.

## Overview

The events pipeline adds support for storing and querying Kubernetes Events alongside audit logs. This enables users to correlate cluster events (pod scheduling, image pulls, health check failures) with audit log entries for a complete picture of cluster activity.

## Stacked PR Strategy

Each PR builds on top of the previous one:

```
main
 └── feat/events-infrastructure (PR 1)
      └── feat/events-api (PR 2)
           └── feat/events-exporter (PR 3)
                └── feat/events-watch (PR 4)
                     └── feat/events-processing (PR 5)
                          └── feat/events-mcp (PR 6)
```

PRs are merged bottom-up: when PR 1 merges to main, PR 2's base changes to main, and so on.

## Source Branches

| Branch | Status | Description |
|--------|--------|-------------|
| `origin/feat/events-infrastructure` | PR created | ClickHouse schema + NATS streams |
| `origin/poc/event-processing-pipeline` | Source | Complete events implementation |
| `origin/feat/activity-ui` | Source | UI component library (separate stack) |

## PR Sequence

### PR 1: Events Infrastructure ✅ Created
**Branch:** `feat/events-infrastructure`
**Base:** `main`
**PR:** Already created

Foundational infrastructure for storing Kubernetes events.

**Changes:**
- `migrations/003_k8s_events_table.sql` - ClickHouse table schema
- `config/components/clickhouse-migrations/configmap.yaml` - Updated migrations
- `config/components/nats-streams/events-stream.yaml` - NATS EVENTS stream
- `config/components/nats-streams/events-processor-consumer.yaml` - Consumer config
- `docs/architecture/data-model.md` - Documentation updates

**Base:** `main`

---

### PR 2: Event API Types & Storage
**Branch:** `feat/events-api`
**Base:** `feat/events-infrastructure`
**Status:** Not started

Add API types and storage layer for querying events.

**Changes:**
- `pkg/apis/activity/v1alpha1/types_eventquery.go` - EventQuery API type
- `pkg/apis/activity/v1alpha1/types_eventfacetquery.go` - EventFacetQuery API type
- `pkg/apis/activity/v1alpha1/register.go` - Register new types
- `pkg/apis/activity/v1alpha1/zz_generated.deepcopy.go` - Generated code
- `internal/storage/events_clickhouse.go` - Event storage implementation
- `internal/storage/event_query_clickhouse.go` - Query builder
- `internal/storage/events_facets.go` - Facet aggregations
- `internal/storage/events_fields.go` - Field mappings
- `internal/registry/activity/events/` - REST storage handlers
- `internal/registry/activity/eventquery/` - EventQuery handler
- `internal/registry/activity/eventfacet/` - EventFacetQuery handler
- `internal/apiserver/apiserver.go` - Register new endpoints
- `pkg/client/` - Generated client code
- `pkg/generated/openapi/` - Generated OpenAPI specs
- `docs/api.md` - API documentation

**Create branch:**
```bash
git checkout feat/events-infrastructure
git checkout -b feat/events-api

# Extract files from poc/event-processing-pipeline
git checkout poc/event-processing-pipeline -- \
  pkg/apis/activity/v1alpha1/types_eventquery.go \
  pkg/apis/activity/v1alpha1/types_eventfacetquery.go \
  internal/storage/events_clickhouse.go \
  internal/storage/event_query_clickhouse.go \
  internal/storage/events_facets.go \
  internal/storage/events_fields.go \
  internal/registry/activity/events/ \
  internal/registry/activity/eventquery/ \
  internal/registry/activity/eventfacet/

# Run code generation and create PR
task generate
git add -A && git commit -m "feat: add Event API types and storage layer"
git push -u origin feat/events-api
gh pr create --base feat/events-infrastructure --title "feat: add Event API types and storage layer"
```

---

### PR 3: Event Exporter
**Branch:** `feat/events-exporter`
**Base:** `feat/events-api`
**Status:** Not started

Component that watches Kubernetes Events and exports them to NATS/ClickHouse.

**Changes:**
- `cmd/activity/event_exporter.go` - Subcommand entry point
- `cmd/activity/main.go` - Register subcommand
- `internal/eventexporter/exporter.go` - Core exporter logic
- `config/components/k8s-event-exporter/` - Kubernetes manifests
  - `deployment.yaml`
  - `rbac.yaml`
  - `serviceaccount.yaml`
  - `kustomization.yaml`
- `config/components/vector-aggregator/vector-hr.yaml` - Pipeline updates
- `config/components/vector-sidecar/vector-sidecar-hr.yaml` - Sidecar updates

**Create branch:**
```bash
git checkout feat/events-api
git checkout -b feat/events-exporter

git checkout poc/event-processing-pipeline -- \
  cmd/activity/event_exporter.go \
  internal/eventexporter/ \
  config/components/k8s-event-exporter/

git add -A && git commit -m "feat: add Kubernetes event exporter"
git push -u origin feat/events-exporter
gh pr create --base feat/events-api --title "feat: add Kubernetes event exporter"
```

---

### PR 4: Event Watch API
**Branch:** `feat/events-watch`
**Base:** `feat/events-exporter`
**Status:** Not started

Real-time streaming support for events via Watch API.

**Changes:**
- `internal/watch/events_watcher.go` - NATS-based event watcher
- `internal/registry/activity/events/watcher.go` - Watch handler integration

**Create branch:**
```bash
git checkout feat/events-exporter
git checkout -b feat/events-watch

git checkout poc/event-processing-pipeline -- \
  internal/watch/events_watcher.go \
  internal/registry/activity/events/watcher.go

git add -A && git commit -m "feat: add Event Watch API for real-time streaming"
git push -u origin feat/events-watch
gh pr create --base feat/events-exporter --title "feat: add Event Watch API for real-time streaming"
```

---

### PR 5: Event-to-Activity Processing
**Branch:** `feat/events-processing`
**Base:** `feat/events-watch`
**Status:** Not started

Process Kubernetes events into human-readable activities using ActivityPolicy.

**Changes:**
- `internal/activityprocessor/policy_adapter.go` - Adapt events to policy engine
- `internal/activityprocessor/policy_adapter_test.go` - Tests
- `internal/activityprocessor/policycache.go` - Updates for event support
- `internal/processor/event.go` - Event processing logic
- `internal/processor/event_test.go` - Tests
- `internal/processor/policy.go` - Policy evaluation for events
- `internal/processor/policy_test.go` - Tests
- `internal/processor/processor.go` - Unified processor updates
- `cmd/activity/processor.go` - Processor command updates
- `examples/basic-kubernetes/*.yaml` - Updated ActivityPolicy examples

**Create branch:**
```bash
git checkout feat/events-watch
git checkout -b feat/events-processing

git checkout poc/event-processing-pipeline -- \
  internal/activityprocessor/policy_adapter.go \
  internal/activityprocessor/policy_adapter_test.go \
  internal/processor/event.go \
  internal/processor/event_test.go \
  internal/processor/policy.go \
  internal/processor/policy_test.go \
  examples/basic-kubernetes/

git add -A && git commit -m "feat: add event-to-activity processing"
git push -u origin feat/events-processing
gh pr create --base feat/events-watch --title "feat: add event-to-activity processing"
```

---

### PR 6: MCP Tools for Events
**Branch:** `feat/events-mcp`
**Base:** `feat/events-processing`
**Status:** Not started

Add event querying capabilities to the MCP server for AI assistants.

**Changes:**
- `pkg/mcp/tools/tools.go` - Add event query tools
- `cmd/activity/mcp.go` - MCP server updates

**Create branch:**
```bash
git checkout feat/events-processing
git checkout -b feat/events-mcp

git checkout poc/event-processing-pipeline -- \
  pkg/mcp/tools/tools.go \
  cmd/activity/mcp.go

git add -A && git commit -m "feat: add MCP tools for event queries"
git push -u origin feat/events-mcp
gh pr create --base feat/events-processing --title "feat: add MCP tools for event queries"
```

---

### PR 7: Activity UI Component Library (Separate Stack)
**Branch:** `feat/activity-ui`
**Base:** `main`
**Status:** Ready

React component library for building Activity UI experiences. This is a separate stack that can be merged independently.

**Changes:**
- `ui/` - Complete component library
  - `src/components/` - React components
  - `src/hooks/` - React hooks
  - `src/api/` - API client
  - `src/types/` - TypeScript types
  - `example/` - Example Remix app
- `config/components/ui/` - Kubernetes manifests
- `ui/Taskfile.yaml` - Build tasks

**Create PR:**
```bash
gh pr create --base main --title "feat: add Activity UI component library"
```

---

## Progress Tracker

| PR | Branch | Base | Status | PR Link |
|----|--------|------|--------|---------|
| 1 | `feat/events-infrastructure` | `main` | ✅ Created | |
| 2 | `feat/events-api` | `feat/events-infrastructure` | ⬜ Not started | |
| 3 | `feat/events-exporter` | `feat/events-api` | ⬜ Not started | |
| 4 | `feat/events-watch` | `feat/events-exporter` | ⬜ Not started | |
| 5 | `feat/events-processing` | `feat/events-watch` | ⬜ Not started | |
| 6 | `feat/events-mcp` | `feat/events-processing` | ⬜ Not started | |
| 7 | `feat/activity-ui` | `main` | ⬜ Not started | |

**Legend:** ⬜ Not started | 🟡 In review | ✅ Created/Merged

## Stack Visualization

```
main ◄────────────────────────────────────────────────────┐
 │                                                        │
 ├── feat/events-infrastructure (PR 1) ✅                 │
 │    │                                                   │
 │    └── feat/events-api (PR 2)                         │
 │         │                                              │
 │         └── feat/events-exporter (PR 3)               │
 │              │                                         │
 │              └── feat/events-watch (PR 4)             │
 │                   │                                    │
 │                   └── feat/events-processing (PR 5)   │
 │                        │                               │
 │                        └── feat/events-mcp (PR 6) ────┘
 │                             (merges cascade up)
 │
 └── feat/activity-ui (PR 7) ── separate stack
```

## Merge Order

When PRs are approved, merge in order from bottom to top:
1. PR 1 merges to `main`
2. PR 2's base automatically updates to `main`, then merge
3. Continue up the stack...

## Notes

- **Stacked PRs:** Each PR builds on the previous one. GitHub will show only the incremental diff.
- **Rebasing:** If PR 1 needs changes, rebase the entire stack: `git rebase --onto new-base old-base branch`
- **PR 7 (UI)** is independent and can be merged anytime
- Run `task generate` after extracting files to update generated code
- Test each PR independently before creating the next one
