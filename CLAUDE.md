# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Activity is a Kubernetes extension that provides queryable audit logs, events, and human-readable activity summaries. It's built as an aggregated API server, making it work natively with kubectl and Kubernetes clients.

**Module**: `go.miloapis.com/activity`

## Build and Development Commands

All development tasks use [Task](https://taskfile.dev). Run `task --list` to see all available commands.

### Building

```bash
task build                    # Build the activity binary to bin/activity
task dev:build                # Build container image (ghcr.io/datum-cloud/activity:dev)
```

### Testing

```bash
go test ./...                 # Run all Go tests
go test ./internal/cel/...    # Run tests in a specific package
go test -run TestName ./...   # Run a specific test
```

### Code Generation

```bash
task generate                 # Run all code generation (OpenAPI, RBAC, migrations, docs)
task generate:openapi         # Generate Kubernetes OpenAPI definitions
task generate:rbac            # Generate RBAC manifests from kubebuilder annotations
task generate:docs            # Generate API reference documentation
```

### UI Component Library

The UI is a React component library in `/ui`:

```bash
cd ui && npm install && npm run build    # Build the library
cd ui && npm run lint                    # Lint TypeScript
cd ui && npm run type-check              # Type check
```

Or via Task:
```bash
task ui:build                            # Build component library
task ui:example:dev                      # Run example app in dev mode
```

## Architecture

### Components

- **activity-apiserver**: Kubernetes aggregated API server that handles queries and Watch streams
- **activity-processor**: Processes audit logs/events through ActivityPolicy rules to generate Activities
- **activity-controller-manager**: Manages ActivityPolicy lifecycle and status
- **kubectl-activity**: CLI plugin for command-line querying
- **activity-ui**: React component library for web interfaces

### Data Pipeline

1. **Audit logs/Events** → Published to NATS JetStream by control plane
2. **Vector** → Receives from NATS, routes to ClickHouse and back to NATS for processing
3. **activity-processor** → Consumes audit events, applies ActivityPolicy rules, produces Activities
4. **ClickHouse** → Stores audit logs, events, and activities for long-term querying
5. **etcd** → Stores ActivityPolicy resources with Watch support

### API Resources (`activity.miloapis.com/v1alpha1`)

| Resource | Type | Purpose |
|----------|------|---------|
| AuditLogQuery | Ephemeral | Execute audit log searches |
| AuditLogFacetsQuery | Ephemeral | Get distinct values for autocomplete |
| Activity | Read-only | Query translated activity records |
| ActivityFacetQuery | Ephemeral | Get distinct activity field values |
| ActivityPolicy | Persistent | Define translation rules (CEL-based) |
| PolicyPreview | Ephemeral | Test policies against sample inputs |
| EventQuery | Ephemeral | Query cluster events |
| EventFacetQuery | Ephemeral | Get distinct event field values |

### Key Directories

- `cmd/activity/` - Main binary entrypoint (subcommands: apiserver, processor, controller-manager)
- `internal/apiserver/` - Aggregated API server implementation
- `internal/storage/` - ClickHouse storage backend
- `internal/cel/` - CEL expression engine for ActivityPolicy rules
- `internal/processor/` - Activity translation processor
- `internal/controller/` - Kubernetes controller for ActivityPolicy
- `internal/watch/` - Watch API implementation via NATS consumers
- `pkg/apis/activity/v1alpha1/` - API type definitions
- `pkg/mcp/` - MCP (Model Context Protocol) server implementation
- `config/` - Kustomize deployment manifests
- `migrations/` - ClickHouse schema migrations

## Development Environment

### Lightweight Dev Setup (single-replica, minimal resources)

```bash
task dev:setup               # Full setup: cluster + dependencies + deploy
task dev:redeploy            # Quick rebuild and redeploy after code changes
```

### Full Test Environment (HA with S3 storage)

```bash
task test:setup              # Full HA setup with 3-replica ClickHouse
task test:redeploy           # Quick rebuild and redeploy
```

### Cluster Access

```bash
task test-infra:kubectl -- <args>        # Run kubectl against dev cluster
task test-infra:kubectl -- get pods -n activity-system
task test-infra:kubectl -- logs -l app=activity-apiserver -n activity-system -f
```

### Database Migrations

```bash
task migrations:new NAME=description     # Create new migration file
task migrations:generate                 # Generate ConfigMap from migrations
task migrations:cluster:verify           # Verify schema in cluster
```

## Multi-Tenancy Model

Data is scoped by tenant:
- **Platform**: All data across all tenants
- **Organization**: Data within a specific organization
- **Project**: Data within a specific project
- **User**: Actions performed by a specific user

Scopes are NOT hierarchically inclusive - query each scope directly.

## ActivityPolicy Translation

ActivityPolicy resources define how audit logs/events are translated into human-readable Activities using CEL expressions:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ActivityPolicy
spec:
  resource:
    apiGroup: networking.datumapis.com
    kind: HTTPProxy
  auditRules:
    - match: "audit.verb == 'create'"
      summary: "{{ actor }} created {{ link(kind + ' ' + audit.objectRef.name, audit.responseObject) }}"
```

## Technology Stack

- **Go 1.25+** - Backend implementation
- **NATS JetStream** - Durable event streaming
- **Vector** - Data pipeline routing
- **ClickHouse** - Analytics storage
- **etcd** - Policy persistence
- **React/TypeScript** - UI components
