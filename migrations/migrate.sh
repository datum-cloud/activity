#!/bin/bash
set -euo pipefail

# ClickHouse Migration Runner
# This script applies versioned SQL migrations to a ClickHouse database
# It tracks applied migrations in the audit.schema_migrations table

# Configuration from environment variables
CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-clickhouse}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-9000}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-audit}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"
CLICKHOUSE_SECURE="${CLICKHOUSE_SECURE:-false}"
CLICKHOUSE_CLIENT_EXTRA_ARGS="${CLICKHOUSE_CLIENT_EXTRA_ARGS:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build clickhouse-client command with authentication
clickhouse_cmd() {
    local query="$1"
    local cmd="clickhouse-client ${CLICKHOUSE_CLIENT_EXTRA_ARGS} --host=${CLICKHOUSE_HOST} --port=${CLICKHOUSE_PORT} --user=${CLICKHOUSE_USER}"

    if [ -n "${CLICKHOUSE_PASSWORD}" ]; then
        cmd="${cmd} --password=${CLICKHOUSE_PASSWORD}"
    fi

    echo "${query}" | ${cmd}
}

# Wait for ClickHouse to be ready
wait_for_clickhouse() {
    log_info "Waiting for ClickHouse to be ready at ${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if clickhouse_cmd "SELECT 1" &>/dev/null; then
            log_success "ClickHouse is ready!"
            return 0
        fi

        log_info "Attempt $attempt/$max_attempts: ClickHouse not ready yet, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "ClickHouse did not become ready within the timeout period"
    return 1
}

# Wait for all replicas in the cluster to be healthy and ready
# This function will wait indefinitely until all replicas are online and healthy
wait_for_cluster_ready() {
    local expected_replicas="${EXPECTED_REPLICAS:-3}"
    log_info "Waiting for all $expected_replicas replica(s) in the 'activity' cluster to be ready..."
    log_info "This will wait indefinitely until the cluster is healthy."

    local attempt=1

    while true; do
        # Check if the 'activity' cluster exists and has the expected number of replicas
        local cluster_exists=$(clickhouse_cmd "SELECT count() FROM system.clusters WHERE cluster='activity'" 2>/dev/null || echo "0")

        if [ "$cluster_exists" -eq 0 ]; then
            log_info "Attempt $attempt: 'activity' cluster not yet registered in system.clusters, waiting..."
            sleep 5
            attempt=$((attempt + 1))
            continue
        fi

        # Get total number of replicas in the cluster
        local total_replicas=$(clickhouse_cmd "SELECT count() FROM system.clusters WHERE cluster='activity'" 2>/dev/null || echo "0")

        # Get number of healthy replicas (errors_count=0 means no connection errors)
        local healthy_replicas=$(clickhouse_cmd "SELECT count() FROM system.clusters WHERE cluster='activity' AND errors_count=0" 2>/dev/null || echo "0")

        # Check if we have at least the expected number of healthy replicas
        if [ "$total_replicas" -ge "$expected_replicas" ] && [ "$healthy_replicas" -ge "$expected_replicas" ]; then
            log_success "All $expected_replicas replicas are registered and healthy!"

            # Additional check: verify Keeper connectivity for distributed DDL
            log_info "Verifying ClickHouse Keeper connectivity for distributed DDL..."
            if clickhouse_cmd "SELECT count() FROM system.zookeeper WHERE path='/clickhouse/activity'" &>/dev/null; then
                log_success "ClickHouse Keeper is accessible and cluster coordination is ready!"

                # Final verification: display cluster topology
                log_info "Cluster topology:"
                clickhouse_cmd "
                    SELECT
                        cluster,
                        shard_num,
                        replica_num,
                        host_name,
                        port,
                        errors_count
                    FROM system.clusters
                    WHERE cluster = 'activity'
                    ORDER BY shard_num, replica_num
                    FORMAT PrettyCompact
                " || true

                return 0
            else
                log_info "Attempt $attempt: Keeper connectivity not ready yet, waiting..."
            fi
        else
            log_info "Attempt $attempt: $healthy_replicas/$total_replicas healthy replicas (expected: $expected_replicas), waiting..."
        fi

        sleep 5
        attempt=$((attempt + 1))
    done
}

# Initialize the schema_migrations table if it doesn't exist
init_migrations_table() {
    log_info "Verifying schema_migrations table..."

    # Note: Both database and schema_migrations table creation are handled by the
    # first migration (001_initial_schema.sql). This function simply verifies
    # the table exists before we try to query it for already-applied migrations.
    #
    # We don't create it here because:
    # 1. The table should be created with the Replicated database engine for HA
    # 2. All schema changes should go through the migration system for consistency
    # 3. The first migration will create both the database and this tracking table

    # Check if the table exists (will be created by first migration if not)
    local table_exists=$(clickhouse_cmd "
        SELECT count()
        FROM system.tables
        WHERE database = '${CLICKHOUSE_DATABASE}' AND name = 'schema_migrations'
    " 2>/dev/null || echo "0")

    if [ "${table_exists}" -eq 0 ]; then
        log_info "Schema migrations table does not exist yet - will be created by first migration"
    else
        log_success "Schema migrations table exists and is ready"
    fi
}

# Calculate checksum of a file
calculate_checksum() {
    local file="$1"
    sha256sum "${file}" | awk '{print $1}'
}

# Check if a migration has already been applied
is_migration_applied() {
    local version="$1"

    # If the schema_migrations table doesn't exist yet, no migrations have been applied
    # This handles the case for the very first migration which creates the table
    local result=$(clickhouse_cmd "
        SELECT count(*)
        FROM ${CLICKHOUSE_DATABASE}.schema_migrations
        WHERE version = ${version}
    " 2>/dev/null || echo "0")

    [ "${result}" -gt 0 ]
}

# Record a migration as applied
record_migration() {
    local version="$1"
    local name="$2"
    local checksum="$3"

    clickhouse_cmd "
        INSERT INTO ${CLICKHOUSE_DATABASE}.schema_migrations
        (version, name, checksum)
        VALUES (${version}, '${name}', '${checksum}')
    "
}

# Apply a single migration file
apply_migration() {
    local migration_file="$1"
    local filename=$(basename "${migration_file}")

    # Extract version and name from filename (e.g., 001_initial_schema.sql)
    if [[ ! "${filename}" =~ ^([0-9]{3})_(.+)\.sql$ ]]; then
        log_warning "Skipping ${filename}: doesn't match naming convention {version}_{name}.sql"
        return 0
    fi

    local version="${BASH_REMATCH[1]}"
    local name="${BASH_REMATCH[2]}"
    local version_num=$((10#${version}))  # Convert to decimal, removing leading zeros
    local checksum=$(calculate_checksum "${migration_file}")

    # Check if already applied
    if is_migration_applied "${version_num}"; then
        log_info "Migration ${version}_${name} already applied, skipping"
        return 0
    fi

    log_info "Applying migration ${version}_${name}..."

    # Read and execute the migration file
    # We use --multiquery to allow multiple statements in one file
    local cmd="clickhouse-client ${CLICKHOUSE_CLIENT_EXTRA_ARGS} --host=${CLICKHOUSE_HOST} --port=${CLICKHOUSE_PORT} --user=${CLICKHOUSE_USER}"

    if [ -n "${CLICKHOUSE_PASSWORD}" ]; then
        cmd="${cmd} --password=${CLICKHOUSE_PASSWORD}"
    fi

    cmd="${cmd} --multiquery"

    if cat "${migration_file}" | ${cmd}; then
        # Record the migration as applied
        record_migration "${version_num}" "${name}" "${checksum}"
        log_success "Migration ${version}_${name} applied successfully"
        return 0
    else
        log_error "Failed to apply migration ${version}_${name}"
        return 1
    fi
}

# Apply all pending migrations
apply_migrations() {
    log_info "Looking for migration files in ${MIGRATIONS_DIR}..."

    if [ ! -d "${MIGRATIONS_DIR}" ]; then
        log_error "Migrations directory ${MIGRATIONS_DIR} not found"
        return 1
    fi

    # Find all .sql files and sort them by version number
    # Note: ConfigMaps in Kubernetes mount files as symlinks, so we don't use -type f
    local migration_files=$(find "${MIGRATIONS_DIR}" -maxdepth 1 -name "*.sql" | sort)

    if [ -z "${migration_files}" ]; then
        log_warning "No migration files found in ${MIGRATIONS_DIR}"
        return 0
    fi

    local migrations_count=0
    local applied_count=0

    while IFS= read -r migration_file; do
        migrations_count=$((migrations_count + 1))
        if apply_migration "${migration_file}"; then
            applied_count=$((applied_count + 1))
        else
            log_error "Migration failed, stopping"
            return 1
        fi
    done <<< "${migration_files}"

    log_success "Migrations complete: ${applied_count} applied out of ${migrations_count} total"

    # Show current migration status
    show_migration_status
}

# Show current migration status
show_migration_status() {
    log_info "Current migration status:"
    clickhouse_cmd "
        SELECT
            version,
            name,
            applied_at,
            substring(checksum, 1, 12) as checksum_short
        FROM ${CLICKHOUSE_DATABASE}.schema_migrations
        ORDER BY version
        FORMAT PrettyCompact
    " || log_warning "Could not fetch migration status"
}

# Verify schema matches expected state
verify_schema() {
    log_info "Verifying schema..."

    # Check if audit.events table exists
    local events_table_exists=$(clickhouse_cmd "
        SELECT count()
        FROM system.tables
        WHERE database = '${CLICKHOUSE_DATABASE}' AND name = 'events'
    ")

    if [ "${events_table_exists}" -eq 0 ]; then
        log_error "Table ${CLICKHOUSE_DATABASE}.events does not exist!"
        return 1
    fi

    log_success "Schema verification passed"

    # Show table structure
    log_info "Table structure:"
    clickhouse_cmd "
        DESCRIBE TABLE ${CLICKHOUSE_DATABASE}.events
        FORMAT PrettyCompact
    " || true
}

# Main execution
main() {
    log_info "ClickHouse Migration Runner Starting..."
    log_info "Target: ${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}"
    log_info "Database: ${CLICKHOUSE_DATABASE}"
    log_info "Migrations Directory: ${MIGRATIONS_DIR}"
    echo ""

    log_info "IMPORTANT: This migration script should only run against a single replica."
    log_info "The Replicated database engine automatically propagates DDL changes to all replicas."
    echo ""

    # Wait for ClickHouse to be ready
    if ! wait_for_clickhouse; then
        log_error "Failed to connect to ClickHouse"
        exit 1
    fi

    # Display which replica we're connected to
    log_info "Connected to replica:"
    clickhouse_cmd "SELECT hostName() as host, getMacro('replica') as replica_name" || true

    echo ""

    # Wait for all cluster replicas to be healthy
    if ! wait_for_cluster_ready; then
        log_error "Cluster is not fully healthy"
        exit 1
    fi

    echo ""

    # Verify migrations tracking (table will be created by first migration)
    init_migrations_table

    echo ""

    # Apply all pending migrations
    if ! apply_migrations; then
        log_error "Migration process failed"
        exit 1
    fi

    echo ""

    # Verify schema
    if ! verify_schema; then
        log_error "Schema verification failed"
        exit 1
    fi

    echo ""
    log_success "All migrations completed successfully!"
}

# Run main function
main "$@"
