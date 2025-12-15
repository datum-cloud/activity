# ClickHouse Schema Migrations

Versioned SQL migrations for the ClickHouse audit database.

## Quick Start

```bash
# Create a new migration
task migrations:new NAME=add_field_name

# Test locally
task migrations:local

# Generate ConfigMap for Kubernetes
task migrations:generate
```

## File Naming

Migrations use the pattern: `{version}_{description}.sql`

- Version: 3-digit number (001, 002, 003)
- Description: snake_case description

Examples:
- `001_initial_schema.sql`
- `002_add_user_field.sql`

## How It Works

Migrations run automatically on deployment via a Kubernetes Job that:
- Checks the `audit.schema_migrations` table for applied migrations
- Runs only new migrations in order
- Self-deletes after 5 minutes (recreated by GitOps)

Always use `IF NOT EXISTS` / `IF EXISTS` to make migrations idempotent.

## See Also

- [Migration Component README](../config/components/clickhouse-migrations/README.md) - Kubernetes deployment details
