# Activity Documentation

Activity is a Kubernetes aggregated API server that provides audit log querying capabilities backed by ClickHouse.

## Quick Start

- **[Quick Start Guide](../config/QUICK_START.md)** - Get up and running in minutes on a local kind cluster

## Documentation by Topic

### Deployment

- **[Deployment Guide](../config/README.md)** - Deploy using Kustomize with base configurations and overlays
- **[Components](../config/components/README.md)** - Modular infrastructure components (ClickHouse, NATS, Vector, Observability)

### Architecture

- **[API Server Architecture](components/apiserver-architecture.md)** - High-level architecture overview and design decisions

### API Reference

- **[API Documentation](api.md)** - Auto-generated reference for all Kubernetes resources and types

### Operations

- **[Testing](../test/README.md)** - Integration and end-to-end tests
- **[Audit Log Generator](../tools/audit-log-generator/README.md)** - Load testing and synthetic data generation
- **[Query Examples](../examples/queries/basic-filtering/README.md)** - Sample queries and usage patterns

### Development

- **Task Commands** - Use `task --list` to see all available tasks
- **API Documentation** - Run `task generate:docs` to regenerate after changing API types

## Common Tasks

```bash
# First-time setup
task dev:setup

# Development workflow
task dev:redeploy
task test-infra:kubectl -- logs -l app=activity-apiserver -n activity-system -f

# Testing
kubectl get auditlogqueries
kubectl apply -f examples/sample-query.yaml
```

## Additional Resources

- [Kubernetes API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)
- [Kustomize Documentation](https://kustomize.io/)
