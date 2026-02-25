#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(dirname "${BASH_SOURCE[0]}")/..
MODULE_NAME="go.miloapis.com/activity"

# Find code-generator
CODEGEN_PKG=$(go list -m -f '{{.Dir}}' k8s.io/code-generator 2>/dev/null)

if [ -z "${CODEGEN_PKG}" ]; then
    echo "ERROR: k8s.io/code-generator not found in go.mod"
    echo "Run: go get k8s.io/code-generator@v0.34.2"
    exit 1
fi

echo "Using code-generator from: ${CODEGEN_PKG}"

# Clean generated code
echo "Cleaning old generated code..."
rm -rf "${SCRIPT_ROOT}/pkg/client"

# Source the code generation helper
source "${CODEGEN_PKG}/kube_codegen.sh"

# Generate all (client, lister, informer, deepcopy)
echo "Generating clientset, listers, informers, and deepcopy..."
kube::codegen::gen_client \
  --with-watch \
  --output-dir "${SCRIPT_ROOT}/pkg/client" \
  --output-pkg "${MODULE_NAME}/pkg/client" \
  --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
  "${SCRIPT_ROOT}/pkg/apis"

# Generate deepcopy
echo "Generating deepcopy..."
kube::codegen::gen_helpers \
  --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
  "${SCRIPT_ROOT}/pkg/apis"

# Generate OpenAPI definitions
echo "Generating OpenAPI definitions..."
go run k8s.io/kube-openapi/cmd/openapi-gen \
  --go-header-file "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
  --output-dir "${SCRIPT_ROOT}/pkg/generated/openapi" \
  --output-pkg "${MODULE_NAME}/pkg/generated/openapi" \
  --output-file zz_generated.openapi.go \
  --report-filename /dev/null \
  "${MODULE_NAME}/pkg/apis/activity/v1alpha1" \
  "k8s.io/apimachinery/pkg/apis/meta/v1" \
  "k8s.io/apimachinery/pkg/api/resource" \
  "k8s.io/apimachinery/pkg/runtime" \
  "k8s.io/apimachinery/pkg/version" \
  "k8s.io/apiserver/pkg/apis/audit/v1" \
  "k8s.io/api/authentication/v1" \
  "k8s.io/api/authorization/v1" \
  "k8s.io/api/core/v1" \
  "k8s.io/api/events/v1"

# Generate OpenAPIModelName methods for our types
# Note: The upstream --output-model-name-file flag doesn't work well when processing
# external k8s.io packages (tries to write to read-only module cache), so we use a
# custom script that parses the generated OpenAPI file and creates methods for our types only.
echo "Generating OpenAPIModelName methods..."
"${SCRIPT_ROOT}/hack/generate-model-names.sh"

echo ""
echo "Code generation complete!"
echo ""
echo "Generated:"
echo "  - Deepcopy functions: pkg/apis/activity/v1alpha1/zz_generated.deepcopy.go"
echo "  - Clientset: pkg/client/clientset/versioned/"
echo "  - Listers: pkg/client/listers/"
echo "  - Informers: pkg/client/informers/"
echo "  - OpenAPI: pkg/generated/openapi/"
echo "  - OpenAPI model names: pkg/apis/activity/v1alpha1/zz_generated.model_name.go"
