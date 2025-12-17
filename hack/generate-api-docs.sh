#!/usr/bin/env bash

# Copyright 2024 The Activity Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${SCRIPT_ROOT}"

# Configuration
DOCS_OUTPUT_FILE="docs/api.md"
API_SOURCE_PATH="./pkg/apis"
TOOL_BIN="${SCRIPT_ROOT}/bin"
CRD_REF_DOCS_VERSION="v0.1.0"

echo "🔄 Generating API documentation..."
echo ""

# Ensure bin directory exists
mkdir -p "${TOOL_BIN}"
mkdir -p "$(dirname "${DOCS_OUTPUT_FILE}")"

# Check if crd-ref-docs is installed
if [ ! -f "${TOOL_BIN}/crd-ref-docs" ]; then
    echo "📦 Installing crd-ref-docs ${CRD_REF_DOCS_VERSION}..."
    GOBIN="${TOOL_BIN}" go install github.com/elastic/crd-ref-docs@${CRD_REF_DOCS_VERSION}
    echo "✅ crd-ref-docs installed"
    echo ""
fi

# Generate the documentation configuration if it doesn't exist
CONFIG_FILE="${SCRIPT_ROOT}/.crd-ref-docs.yaml"
if [ ! -f "${CONFIG_FILE}" ]; then
    echo "📝 Creating documentation configuration at ${CONFIG_FILE}..."
    cat > "${CONFIG_FILE}" <<EOF
# Configuration for crd-ref-docs
# See: https://github.com/elastic/crd-ref-docs

processor:
  # Ignore certain fields that are not relevant for API documentation
  ignoreFields:
    - "TypeMeta$"
    - "ObjectMeta$"
    - "ListMeta$"

renderer:
  kubernetesVersion: 1.34

output:
  # Use markdown format
  markdown:
    headerDepth: 1
EOF
    echo "✅ Configuration created"
    echo ""
fi

echo "📚 Generating API documentation from ${API_SOURCE_PATH}..."
"${TOOL_BIN}/crd-ref-docs" \
    --source-path="${API_SOURCE_PATH}" \
    --config="${CONFIG_FILE}" \
    --renderer=markdown \
    --output-path="${DOCS_OUTPUT_FILE}"

echo ""
echo "✅ API documentation generated successfully!"
echo ""
echo "📄 Documentation written to: ${DOCS_OUTPUT_FILE}"
echo ""
echo "Next steps:"
echo "  - Review the generated documentation"
echo "  - Commit: git add ${DOCS_OUTPUT_FILE} && git commit -m 'docs: update API reference'"
echo ""