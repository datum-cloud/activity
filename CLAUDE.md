# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Activity is a Kubernetes extension that lets you query cluster audit logs and events using familiar Kubernetes tools. It's built as an aggregated API server, making it feel like a natural part of Kubernetes.

## Build Commands

This project uses [Task](https://taskfile.dev) as the build system.

```bash
# Build the Go binary
task build

# Run all code generation (OpenAPI, migrations, docs, diagrams)
task generate

# Generate specific artifacts
task generate:openapi      # Kubernetes OpenAPI definitions
task generate:docs         # API reference documentation
task migrations:generate   # ClickHouse migrations ConfigMap
```

## Testing

```bash
# Run Go tests
go test ./...

# Run a specific test
go test ./internal/cel/... -run TestPolicyMatcher

# UI tests (lint + type-check)
task ui:test
task ui:lint
task ui:type-check
```

## Development Workflow

```bash
# Setup lightweight dev environment (single-replica ClickHouse)
task dev:setup

# Deploy to dev cluster
task dev:deploy

# Quick rebuild and redeploy during iteration
task dev:redeploy

# View logs
task test-infra:kubectl -- logs -l app=activity-apiserver -n activity-system -f
```

For full HA testing with 3-replica ClickHouse and S3 storage:
```bash
task test:setup
task test:deploy
task test:redeploy
```

## UI Development

```bash
task ui:build           # Build component library
task ui:dev             # Watch mode for components
task ui:example:dev     # Run example Next.js app
```

## Architecture

### Components

The system consists of a single binary (`activity`) with multiple subcommands:

- **activity apiserver** - Kubernetes aggregated API server exposing query resources
- **activity processor** - Translates raw audit events into human-readable activities using CEL-based ActivityPolicy resources
- **activity controller-manager** - Watches and manages ActivityPolicy custom resources
- **activity event-exporter** - Exports Kubernetes events to ClickHouse
- **activity mcp** - Model Context Protocol server for AI assistants

### Data Flow

```
Kubernetes API Server (audit webhook)
    ↓
Vector Sidecar (collects logs)
    ↓
NATS JetStream (durable message queue)
    ↓
Vector Aggregator (transforms/routes)
    ↓
ClickHouse (long-term storage)
    ↓
Activity API Server (query interface)
```

### Key Directories

- `cmd/activity/` - Main binary entry point with subcommands
- `internal/apiserver/` - Aggregated API server setup
- `internal/storage/` - ClickHouse storage layer
- `internal/registry/activity/` - API resource implementations (auditlog, events, policy, facet)
- `internal/cel/` - CEL expression evaluation for filtering and policy matching
- `pkg/apis/activity/v1alpha1/` - Custom Resource Definitions
- `pkg/client/` - Generated Kubernetes client
- `config/overlays/dev/` - Development deployment manifests
- `migrations/` - ClickHouse SQL migrations
- `ui/` - React component library

### API Resources

- `AuditLogQuery` - Query audit logs via CEL expressions
- `AuditLogFacetQuery` - Get distinct field values for filtering
- `Activity` - Query human-readable activity records
- `ActivityFacetQuery` - Get activity field values
- `ActivityPolicy` - Define translation rules for resources
- `PolicyPreview` - Test policies against sample inputs
- `Event` - Kubernetes events stored in ClickHouse

## Accessing the Dev Cluster

All kubectl commands go through the test-infra task wrapper:

```bash
# Run kubectl commands against the dev cluster
task test-infra:kubectl -- <kubectl args>

# Examples:
task test-infra:kubectl -- get pods -n activity-system
task test-infra:kubectl -- logs -l app=activity-apiserver -n activity-system -f
task test-infra:kubectl -- get activitypolicies
task test-infra:kubectl -- describe activitypolicy core-pods

# Port forward the UI
task test-infra:kubectl -- port-forward -n activity-system svc/activity-ui 8080:80

# Port forward Grafana (observability)
task test-infra:kubectl -- port-forward -n telemetry-system svc/grafana-service 3000:3000
```

### Deploying Policy Changes

After editing ActivityPolicy YAML files in `examples/`:

```bash
# Apply updated policies
task test-infra:kubectl -- apply -k examples/basic-kubernetes/

# Verify policies are ready
task test-infra:kubectl -- get activitypolicies
```

### Useful Debugging Commands

```bash
# Check all resources in activity-system namespace
task test-infra:kubectl -- get all -n activity-system

# View ClickHouse pods
task test-infra:kubectl -- get pods -l clickhouse.altinity.com/chi=activity-clickhouse -n activity-system

# Check NATS streams
task test-infra:kubectl -- get streams -n activity-system

# Restart a deployment after code changes
task test-infra:kubectl -- rollout restart -n activity-system deployment/activity-apiserver
```

## Key Dependencies

- **ClickHouse** - OLAP database for audit logs, events, activities
- **NATS JetStream** - Durable event buffering
- **CEL** - Common Expression Language for policy matching and query filtering
- **Vector** - Log collection and transformation
