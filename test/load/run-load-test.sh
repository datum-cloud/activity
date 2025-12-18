#!/usr/bin/env bash

set -euo pipefail

# Script to run k6 load tests for the Activity
# This script handles setting up the environment and running various load test scenarios

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
API_SERVER_URL="${API_SERVER_URL:-https://localhost:6443}"
NAMESPACE_FILTER="${NAMESPACE_FILTER:-default}"
SCENARIO="${SCENARIO:-all}"
OUTPUT_DIR="${SCRIPT_DIR}/results"
USE_CLOUD="${USE_CLOUD:-false}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-}"
USE_CLIENT_CERTS="${USE_CLIENT_CERTS:-true}"

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Run k6 load tests for the Activity

OPTIONS:
    -u, --url URL               API server URL (default: https://localhost:6443)
    -n, --namespace NS          Namespace filter for queries (default: default)
    -s, --scenario SCENARIO     Test scenario: steady, ramp, spike, all (default: all)
    -t, --token TOKEN           Kubernetes bearer token (or set KUBE_TOKEN env var)
    -k, --kubeconfig PATH       Path to kubeconfig file (default: auto-detect)
    -o, --output DIR            Output directory for results (default: ./results)
    -c, --cloud                 Run test on k6 Cloud
    --no-client-certs           Disable client certificate authentication
    -h, --help                  Show this help message

EXAMPLES:
    # Run all scenarios against local API server (auto-detects test-infra kubeconfig)
    $0

    # Run only steady load test
    $0 --scenario steady

    # Run with specific kubeconfig
    $0 --kubeconfig ~/.kube/config

    # Run against remote API server with token (no client certs)
    $0 --url https://api.example.com:6443 --token \$(kubectl get secret -n kube-system -o jsonpath='{.data.token}' | base64 -d) --no-client-certs

    # Run spike test on k6 Cloud
    $0 --scenario spike --cloud

ENVIRONMENT VARIABLES:
    API_SERVER_URL      API server URL
    KUBE_TOKEN          Kubernetes bearer token
    NAMESPACE_FILTER    Namespace to use in query filters
    USE_CLOUD           Set to 'true' to use k6 Cloud

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_SERVER_URL="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE_FILTER="$2"
            shift 2
            ;;
        -s|--scenario)
            SCENARIO="$2"
            shift 2
            ;;
        -t|--token)
            KUBE_TOKEN="$2"
            shift 2
            ;;
        -k|--kubeconfig)
            KUBECONFIG_PATH="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -c|--cloud)
            USE_CLOUD="true"
            shift
            ;;
        --no-client-certs)
            USE_CLIENT_CERTS="false"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    print_error "k6 is not installed"
    print_info "Install k6 from: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Auto-detect kubeconfig if not specified
if [[ -z "${KUBECONFIG_PATH}" ]]; then
    if [[ -f "${PROJECT_ROOT}/.test-infra/kubeconfig" ]]; then
        KUBECONFIG_PATH="${PROJECT_ROOT}/.test-infra/kubeconfig"
        print_info "Auto-detected test-infra kubeconfig: ${KUBECONFIG_PATH}"
    elif [[ -f "${HOME}/.kube/config" ]]; then
        KUBECONFIG_PATH="${HOME}/.kube/config"
        print_info "Using default kubeconfig: ${KUBECONFIG_PATH}"
    fi
fi

# Extract client certificates from kubeconfig if requested
if [[ "${USE_CLIENT_CERTS}" == "true" ]] && [[ -n "${KUBECONFIG_PATH}" ]] && [[ -f "${KUBECONFIG_PATH}" ]]; then
    print_info "Extracting client certificates from kubeconfig..."

    # Create temporary directory for certificates
    CERT_DIR=$(mktemp -d)
    trap "rm -rf ${CERT_DIR}" EXIT

    # Extract client certificate
    if grep -q "client-certificate-data:" "${KUBECONFIG_PATH}"; then
        grep "client-certificate-data:" "${KUBECONFIG_PATH}" | awk '{print $2}' | base64 -d > "${CERT_DIR}/client.crt"
        export CLIENT_CERT_PATH="${CERT_DIR}/client.crt"
        print_info "Extracted client certificate"
    fi

    # Extract client key
    if grep -q "client-key-data:" "${KUBECONFIG_PATH}"; then
        grep "client-key-data:" "${KUBECONFIG_PATH}" | awk '{print $2}' | base64 -d > "${CERT_DIR}/client.key"
        export CLIENT_KEY_PATH="${CERT_DIR}/client.key"
        print_info "Extracted client key"
    fi

    # Extract CA certificate
    if grep -q "certificate-authority-data:" "${KUBECONFIG_PATH}"; then
        grep "certificate-authority-data:" "${KUBECONFIG_PATH}" | awk '{print $2}' | base64 -d > "${CERT_DIR}/ca.crt"
        export CA_CERT_PATH="${CERT_DIR}/ca.crt"
        print_info "Extracted CA certificate"
    fi

    # Extract server URL if not already set
    if [[ "${API_SERVER_URL}" == "https://localhost:6443" ]] && grep -q "server:" "${KUBECONFIG_PATH}"; then
        API_SERVER_URL=$(grep "server:" "${KUBECONFIG_PATH}" | head -1 | awk '{print $2}')
        print_info "Extracted API server URL: ${API_SERVER_URL}"
    fi
fi

# Check if we need to build the test
if [[ ! -f "${SCRIPT_DIR}/dist/query-load-test.js" ]] || [[ "${SCRIPT_DIR}/query-load-test.ts" -nt "${SCRIPT_DIR}/dist/query-load-test.js" ]]; then
    print_info "Building TypeScript load tests..."
    cd "${SCRIPT_DIR}"

    if [[ ! -d "node_modules" ]]; then
        print_info "Installing dependencies..."
        npm install
    fi

    npm run build
    cd "${PROJECT_ROOT}"
    print_success "Build completed"
fi

# Set up environment variables
export API_SERVER_URL
export NAMESPACE_FILTER
export KUBE_TOKEN="${KUBE_TOKEN:-}"

print_info "Load test configuration:"
print_info "  API Server: ${API_SERVER_URL}"
print_info "  Namespace Filter: ${NAMESPACE_FILTER}"
print_info "  Scenario: ${SCENARIO}"
print_info "  Output: ${OUTPUT_DIR}"
print_info "  k6 Cloud: ${USE_CLOUD}"
if [[ -n "${CLIENT_CERT_PATH:-}" ]]; then
    print_info "  Auth Method: Client Certificates"
elif [[ -n "${KUBE_TOKEN:-}" ]]; then
    print_info "  Auth Method: Bearer Token"
else
    print_warning "  Auth Method: None (this may fail)"
fi

# Determine k6 command
K6_CMD="k6 run"
if [[ "${USE_CLOUD}" == "true" ]]; then
    K6_CMD="k6 cloud"
    print_warning "Running on k6 Cloud - make sure you have logged in with 'k6 login cloud'"
fi

# Common k6 options
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
K6_OPTIONS=(
    --include-system-env-vars
    --out "json=${OUTPUT_DIR}/results-${TIMESTAMP}.json"
    --summary-export="${OUTPUT_DIR}/summary-${TIMESTAMP}.json"
)

# Run the appropriate scenario(s)
run_scenario() {
    local scenario=$1
    local scenario_name=$2

    print_info "Running ${scenario_name} test..."

    if ${K6_CMD} \
        "${K6_OPTIONS[@]}" \
        --env "SCENARIO=${scenario}" \
        "${SCRIPT_DIR}/dist/query-load-test.js"; then
        print_success "${scenario_name} test completed"
        return 0
    else
        print_error "${scenario_name} test failed"
        return 1
    fi
}

EXIT_CODE=0

case ${SCENARIO} in
    steady)
        run_scenario "steady_load" "Steady Load" || EXIT_CODE=$?
        ;;
    ramp)
        run_scenario "ramp_up" "Ramp Up" || EXIT_CODE=$?
        ;;
    spike)
        run_scenario "spike" "Spike" || EXIT_CODE=$?
        ;;
    all)
        run_scenario "steady_load" "Steady Load" || EXIT_CODE=$?
        run_scenario "ramp_up" "Ramp Up" || EXIT_CODE=$?
        run_scenario "spike" "Spike" || EXIT_CODE=$?
        ;;
    *)
        print_error "Unknown scenario: ${SCENARIO}"
        print_info "Valid scenarios: steady, ramp, spike, all"
        exit 1
        ;;
esac

if [[ ${EXIT_CODE} -eq 0 ]]; then
    print_success "All load tests completed successfully"
    print_info "Results saved to: ${OUTPUT_DIR}"
else
    print_error "Some load tests failed"
    exit ${EXIT_CODE}
fi
