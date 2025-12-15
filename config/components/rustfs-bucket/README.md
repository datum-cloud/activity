# RustFS S3 Bucket Component

Creates an S3 bucket for ClickHouse cold storage.

## What It Does

Runs an init Job that:
- Creates an S3 bucket named `clickhouse-cold`
- Uses RustFS as the S3-compatible storage backend
- Provides credentials via Secret for ClickHouse to access the bucket

## Files

- `bucket-init-job.yaml` - Job that creates the S3 bucket
- `secret.yaml` - S3 access credentials
- `configmap.yaml` - Bucket initialization script
- `kustomization.yaml` - Component definition

## Usage

Include in your overlay:

```yaml
# config/overlays/{env}/kustomization.yaml
components:
  - ../../components/rustfs-bucket
```

## Environment-Specific Configuration

**Test/Dev**: Uses RustFS (included)
**Production**: Replace with AWS S3, MinIO, or another S3 provider

## Verify

```bash
# Check bucket creation Job
kubectl get jobs -n activity-system

# View init Job logs
kubectl logs job/rustfs-bucket-init -n activity-system
```

## Requirements

- RustFS must be deployed first (or another S3 provider)
