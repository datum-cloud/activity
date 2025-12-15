# ClickHouse Operator Dependency

Installs the ClickHouse Operator via Flux HelmRelease.

## What It Does

Deploys the Altinity ClickHouse Operator which:
- Manages ClickHouseInstallation custom resources
- Handles ClickHouse cluster lifecycle
- Configures storage, replication, and scaling

## Files

- `helmrelease.yaml` - Flux HelmRelease for the operator
- `helmrepository.yaml` - Helm repository definition
- `namespace.yaml` - clickhouse-system namespace
- `kustomization.yaml` - Dependency definition

## Usage

Apply before deploying ClickHouse clusters:

```bash
kubectl apply -k config/dependencies/clickhouse-operator
```

Or include in Flux Kustomization with dependency ordering.

## Verify

```bash
# Check operator deployment
kubectl get pods -n clickhouse-system

# Check HelmRelease
kubectl get helmrelease -n clickhouse-system
```

## Version

Using Altinity ClickHouse Operator chart version 0.24.0
