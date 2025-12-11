#!/usr/bin/env bash
set -euo pipefail

# Generate ClickHouse migrations ConfigMap from migrations/ directory
# This script is the bridge between migrations/ (source of truth) and
# config/components/clickhouse-migrations/configmap.yaml (Kubernetes)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/migrations"
OUTPUT_FILE="${REPO_ROOT}/config/components/clickhouse-migrations/configmap.yaml"

echo "Generating ClickHouse migrations ConfigMap..."
echo "Source: ${MIGRATIONS_DIR}"
echo "Output: ${OUTPUT_FILE}"

# Start ConfigMap
cat > "${OUTPUT_FILE}" << 'EOF'
# AUTO-GENERATED - DO NOT EDIT MANUALLY
# Generated from migrations/ directory (source of truth)
# To regenerate: task migrations:generate OR ./hack/generate-migrations-configmap.sh
#
# To add a new migration:
# 1. Create file in migrations/ (e.g., migrations/002_add_field.sql)
# 2. Run: task migrations:generate
# 3. Update job.yaml to include the new migration in volumes
# 4. Deploy: task dev:deploy

apiVersion: v1
kind: ConfigMap
metadata:
  name: clickhouse-migrations
  namespace: activity-system
  labels:
    app: clickhouse-migrations
    app.kubernetes.io/component: database
data:
  # Migration runner script
  migrate.sh: |
EOF

# Add migrate.sh with proper indentation (skip whitespace-only lines)
if [ -f "${MIGRATIONS_DIR}/migrate.sh" ]; then
    while IFS= read -r line; do
        if [ -z "${line// /}" ]; then
            # Line is empty or only whitespace - output just newline
            echo "" >> "${OUTPUT_FILE}"
        else
            # Line has content - indent it
            echo "    ${line}" >> "${OUTPUT_FILE}"
        fi
    done < "${MIGRATIONS_DIR}/migrate.sh"
else
    echo "ERROR: ${MIGRATIONS_DIR}/migrate.sh not found"
    exit 1
fi

echo "" >> "${OUTPUT_FILE}"

# Add all SQL migration files
sql_files=$(find "${MIGRATIONS_DIR}" -maxdepth 1 -name "*.sql" -type f | sort)

if [ -z "${sql_files}" ]; then
    echo "WARNING: No SQL migration files found in ${MIGRATIONS_DIR}"
fi

for migration in ${sql_files}; do
    filename=$(basename "${migration}")
    echo "  # Migration: ${filename}"
    echo "  ${filename}: |" >> "${OUTPUT_FILE}"

    # Add SQL file with proper indentation (skip whitespace-only lines)
    while IFS= read -r line; do
        if [ -z "${line// /}" ]; then
            # Line is empty or only whitespace - output just newline
            echo "" >> "${OUTPUT_FILE}"
        else
            # Line has content - indent it
            echo "    ${line}" >> "${OUTPUT_FILE}"
        fi
    done < "${migration}"

    echo "" >> "${OUTPUT_FILE}"
done

echo "✅ Generated ${OUTPUT_FILE}"
echo ""
echo "Migration files included:"
echo "${sql_files}" | sed 's|.*/|  - |'
echo ""
echo "Next steps:"
echo "1. Update job.yaml if you added new migrations"
echo "2. Deploy: task dev:deploy"
