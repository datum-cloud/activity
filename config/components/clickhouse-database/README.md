# ClickHouse Database Component

Deploys a ClickHouse cluster for storing audit events.

## What It Does

Creates a ClickHouse instance with:
- Single shard, single replica (test/dev configuration)
- Hot/cold storage tiering (local SSD + S3)
- Audit database pre-configured
- TTL policy to move old data to S3 after 90 days

## Files

- `clickhouse-installation.yaml` - ClickHouseInstallation CR
- `kustomization.yaml` - Component definition

## Storage Configuration

- **Hot Storage**: Recent data on local disks for fast queries
- **Cold Storage**: Old data on S3 for cost-effective archival

The storage policy is configured via patches in each overlay (test-infra, production, etc).

## Usage

Include in your overlay:

```yaml
# config/overlays/{env}/kustomization.yaml
components:
  - ../../components/clickhouse-database
```

Add environment-specific storage patches as needed.

## Access

```bash
# Connect to ClickHouse
kubectl exec -it clickhouse-activity-0-0-0 -n activity-system -- clickhouse-client

# Query audit events
SELECT * FROM audit.events LIMIT 10;
```

## Requirements

- ClickHouse Operator must be installed first
- S3 storage (RustFS in test, AWS S3 in production)
