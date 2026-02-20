#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(dirname "${BASH_SOURCE[0]}")/..

# Output directory for generated RBAC
OUTPUT_DIR="${SCRIPT_ROOT}/config/base/generated"

echo "Generating RBAC manifests from kubebuilder annotations..."

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Generate RBAC using controller-gen
# Scans for +kubebuilder:rbac annotations in the controller package
go tool controller-gen \
  rbac:roleName=activity-controller-manager \
  paths="${SCRIPT_ROOT}/internal/controller/..." \
  output:rbac:dir="${OUTPUT_DIR}"

# Rename the generated file for clarity
if [ -f "${OUTPUT_DIR}/role.yaml" ]; then
  mv "${OUTPUT_DIR}/role.yaml" "${OUTPUT_DIR}/controller-manager-rbac.yaml"
fi

echo ""
echo "RBAC generation complete!"
echo ""
echo "Generated:"
echo "  - ClusterRole: ${OUTPUT_DIR}/controller-manager-rbac.yaml"
echo ""
echo "Note: The generated file contains the ClusterRole only."
echo "ServiceAccount and ClusterRoleBinding are maintained separately."
