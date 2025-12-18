# Chainsaw End-to-End Testing Proposal for Activity API Server

## Executive Summary

This proposal outlines a comprehensive end-to-end testing strategy using [Chainsaw](https://kyverno.github.io/chainsaw/latest/) to validate the Activity aggregated API server. Chainsaw is a declarative, Kubernetes-native testing framework that enables testing of custom resources and API servers without requiring programming knowledge.

## Background

The Activity project provides a Kubernetes aggregated API server that exposes audit log querying capabilities through the `AuditLogQuery` custom resource. The API server:

- Queries audit logs from ClickHouse via an aggregated API endpoint (`activity.miloapis.com/v1alpha1`)
- Implements an ephemeral resource pattern (like `TokenReview` or `SubjectAccessReview`) where queries execute immediately without persisting to etcd
- Supports CEL (Common Expression Language) filters for complex query expressions
- Provides cursor-based pagination for large result sets
- Enforces tenant isolation and RBAC-based access control
- Validates time ranges, filters, and query parameters

Currently, the project has:
- Unit tests for individual components
- Load testing infrastructure for performance validation
- Example query manifests demonstrating API usage
- An empty `test/e2e/` directory awaiting test implementation

## Why Chainsaw?

Chainsaw is the ideal testing framework for Activity because:

1. **Kubernetes-Native**: Designed specifically for testing Kubernetes resources, custom resources, and API servers
2. **Declarative YAML Tests**: No programming required - tests are written in YAML using familiar Kubernetes manifest structure
3. **Comprehensive Assertions**: Built-in support for validating resource state, status fields, and error responses
4. **Multi-Step Workflows**: Supports complex test scenarios with setup, execution, assertion, and cleanup phases
5. **Test Isolation**: Each test runs independently with proper cleanup
6. **CI/CD Integration**: Generates JUnit-compatible test reports for integration with CI pipelines
7. **Error Testing**: Supports both positive and negative testing scenarios (success and error cases)

## Implementation Architecture

### Test Structure

```
test/
├── README.md                          # Test documentation
├── chainsaw-test.yaml                 # Global Chainsaw configuration
├── e2e/                               # End-to-end test suites
│   ├── 01-basic-queries/              # Basic query operations
│   │   ├── chainsaw-test.yaml         # Test suite metadata
│   │   ├── 01-simple-query.yaml       # Create and validate a basic query
│   │   ├── 02-time-range-query.yaml   # Test time range filtering
│   │   └── 03-result-ordering.yaml    # Verify newest-first ordering
│   ├── 02-cel-filters/                # CEL expression filtering
│   │   ├── chainsaw-test.yaml
│   │   ├── 01-simple-filters.yaml     # Basic equality filters
│   │   ├── 02-complex-filters.yaml    # Compound expressions (&&, ||)
│   │   ├── 03-string-functions.yaml   # startsWith, endsWith, contains
│   │   ├── 04-nested-fields.yaml      # objectRef.namespace, user.username
│   │   └── 05-list-operations.yaml    # 'in' operator
│   ├── 03-pagination/                 # Pagination and cursors
│   │   ├── chainsaw-test.yaml
│   │   ├── 01-basic-pagination.yaml   # Multiple pages with continueAfter
│   │   ├── 02-page-size-limits.yaml   # Validate limit parameter
│   │   └── 03-cursor-stability.yaml   # Cursor consistency across queries
│   ├── 04-validation/                 # Input validation and error handling
│   │   ├── chainsaw-test.yaml
│   │   ├── 01-missing-required.yaml   # Missing startTime/endTime
│   │   ├── 02-invalid-time-format.yaml # Malformed time strings
│   │   ├── 03-time-range-errors.yaml  # endTime before startTime
│   │   ├── 04-cel-syntax-errors.yaml  # Invalid CEL expressions
│   │   ├── 05-cel-field-errors.yaml   # Unknown fields in filter
│   │   ├── 06-limit-validation.yaml   # Negative or excessive limits
│   │   ├── 07-invalid-cursor.yaml     # Tampered or invalid cursors
│   │   └── 08-max-time-window.yaml    # Query window exceeds maximum
│   ├── 05-time-formats/               # Time range parsing
│   │   ├── chainsaw-test.yaml
│   │   ├── 01-relative-time.yaml      # now-7d, now-24h syntax
│   │   ├── 02-absolute-time.yaml      # RFC3339 timestamps
│   │   └── 03-mixed-time.yaml         # Combination of relative/absolute
│   ├── 06-scope-isolation/            # Tenant isolation and RBAC
│   │   ├── chainsaw-test.yaml
│   │   ├── 01-namespace-isolation.yaml # Users see only their namespace
│   │   ├── 02-admin-access.yaml       # Platform admins see all events
│   │   └── 03-rbac-enforcement.yaml   # RBAC rules enforced
│   └── 07-integration/                # Full workflow scenarios
│       ├── chainsaw-test.yaml
│       ├── 01-troubleshooting.yaml    # Simulate incident investigation
│       ├── 02-compliance-audit.yaml   # Generate compliance reports
│       └── 03-security-analysis.yaml  # Detect suspicious activity
└── fixtures/                          # Shared test data
    ├── seed-data.yaml                 # Test audit events to seed ClickHouse
    └── rbac/                          # Test users and RBAC policies
        ├── admin-user.yaml
        ├── namespace-user.yaml
        └── restricted-user.yaml
```

## Test Scenarios

### 1. Basic Query Operations

**Objective**: Validate fundamental query functionality

**Test Cases**:
- Create a simple query with time range and verify results are returned
- Verify results are ordered newest-first (descending by stageTimestamp)
- Query with no filter returns all events in time range
- Query with large time range respects default limit (100)

**Example Test Structure**:
```yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: basic-query-operations
spec:
  description: Test basic AuditLogQuery creation and result validation
  steps:
    - name: execute-basic-query
      try:
        - apply:
            file: query.yaml
        - assert:
            file: expected-response.yaml
```

### 2. CEL Filter Expressions

**Objective**: Validate CEL expression parsing and execution

**Test Cases**:
- Simple equality filters: `verb == 'delete'`
- Compound expressions: `verb == 'delete' && objectRef.namespace == 'production'`
- String functions: `user.username.startsWith('system:serviceaccount:')`
- Nested field access: `objectRef.resource`, `user.username`, `responseStatus.code`
- List membership: `verb in ['create', 'update', 'delete']`
- Numeric comparisons: `responseStatus.code >= 400`

**Example Test**:
```yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: cel-filter-validation
spec:
  steps:
    - name: test-equality-filter
      try:
        - apply:
            resource:
              apiVersion: activity.miloapis.com/v1alpha1
              kind: AuditLogQuery
              metadata:
                name: delete-operations
              spec:
                startTime: "now-24h"
                endTime: "now"
                filter: "verb == 'delete'"
                limit: 100
        - assert:
            resource:
              apiVersion: activity.miloapis.com/v1alpha1
              kind: AuditLogQuery
              metadata:
                name: delete-operations
              (status.results[?verb != 'delete']): []  # All results should be delete operations
```

### 3. Pagination

**Objective**: Verify cursor-based pagination works correctly

**Test Cases**:
- First page returns results and `continueAfter` cursor
- Subsequent pages use cursor to fetch next batch
- Final page returns empty `continueAfter`
- Cursor remains stable across identical queries
- Invalid cursor returns validation error
- Page size respects limit parameter (max 1000)

**Test Flow**:
1. Create query with `limit: 50`
2. Assert `status.results` has ≤50 events and `status.continueAfter` is non-empty
3. Create second query with same parameters + `continueAfter` from step 2
4. Assert different results returned
5. Repeat until `continueAfter` is empty

### 4. Input Validation

**Objective**: Ensure robust error handling and user guidance

**Test Cases**:
- Missing required fields (startTime, endTime) → HTTP 422 Invalid
- Invalid time format → HTTP 422 with helpful error message
- endTime before startTime → HTTP 422 with validation error
- Invalid CEL syntax → HTTP 422 with syntax error details and hints
- Unknown CEL field → HTTP 422 with available fields listed
- Negative limit → HTTP 422
- Limit exceeds maximum (>1000) → HTTP 422 with maximum value
- Time window exceeds maximum (>30 days) → HTTP 422 with suggested approach
- Tampered cursor → HTTP 422

**Example Error Test**:
```yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: validation-errors
spec:
  steps:
    - name: test-malformed-cel-filter
      try:
        - apply:
            resource:
              apiVersion: activity.miloapis.com/v1alpha1
              kind: AuditLogQuery
              metadata:
                name: malformed-filter
              spec:
                startTime: "now-1h"
                endTime: "now"
                filter: "verb = 'delete'"  # Wrong: single = instead of ==
                limit: 10
        - assert:
            resource:
              apiVersion: v1
              kind: Status
              status: Failure
              code: 422
              reason: Invalid
              (message): "~.*single '='.*"  # Error mentions the problem
```

### 5. Time Format Parsing

**Objective**: Validate flexible time parsing

**Test Cases**:
- Relative time: `now-7d`, `now-24h`, `now-30m`
- Absolute time: RFC3339 timestamps with timezone
- Mixed: `startTime: "2024-01-01T00:00:00Z"` and `endTime: "now"`
- Edge cases: `now`, very old dates

### 6. Scope Isolation and RBAC

**Objective**: Verify tenant isolation works correctly

**Test Cases**:
- Namespace-scoped users only see events in their namespace
- Platform admin users see all events across namespaces
- Organization-scoped users see events in their organization
- RBAC rules prevent unauthorized access

**Implementation Note**: These tests require creating ServiceAccounts with different RBAC permissions and impersonating them during queries.

### 7. End-to-End Integration Scenarios

**Objective**: Validate real-world usage patterns

**Test Scenarios**:

**Troubleshooting Workflow**:
1. Seed ClickHouse with audit events for a deployment failure
2. Query for all events in namespace during time window
3. Filter for deployment-related operations
4. Verify user can identify who deleted the deployment

**Compliance Audit**:
1. Query all secret access operations
2. Filter by specific namespace
3. Export results for compliance reporting

**Security Analysis**:
1. Query failed authentication attempts (`responseStatus.code == 401`)
2. Query privilege escalation attempts
3. Identify suspicious patterns

## Test Data Management

### Seeding Test Data

Before running tests, ClickHouse must be populated with known test data:

**Approach 1: Generate Synthetic Events**
- Use the existing `tools/audit-log-generator` to create predictable test events
- Generate events with known properties (specific verbs, namespaces, users, timestamps)
- Publish to NATS, which flows through Vector to ClickHouse

**Approach 2: Direct ClickHouse Insertion**
- Create SQL scripts to insert test audit events directly
- Faster and more deterministic than event pipeline
- Useful for testing edge cases and specific scenarios

**Recommended Structure**:
```yaml
# test/fixtures/seed-data.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-seed-data
  namespace: activity-system
data:
  seed.sh: |
    #!/bin/bash
    # Generate 1000 test events covering:
    # - Multiple verbs (get, list, create, update, delete)
    # - Multiple namespaces (default, production, staging)
    # - Multiple users (system:admin, john@example.com, service accounts)
    # - Time range: last 7 days
    # - Various response codes (200, 201, 404, 403, 500)

    /app/audit-log-generator \
      -nats-url=nats://nats.nats-system:4222 \
      -count=1000 \
      -rate=100 \
      -subject=audit.k8s.test \
      -source=chainsaw-test-fixture
```

### Test Isolation

Each test should be isolated and not interfere with others:

1. **Use Unique Names**: Generate unique resource names per test
2. **Time-based Filtering**: Query specific time windows for each test
3. **Source Tags**: Tag test data with unique identifiers
4. **Cleanup**: Use Chainsaw's `finally` block to clean up resources

## Chainsaw Configuration

### Global Configuration

```yaml
# test/chainsaw-test.yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Configuration
metadata:
  name: activity-e2e-tests
spec:
  timeouts:
    apply: 10s
    assert: 30s
    cleanup: 10s
    delete: 10s
    error: 10s
    exec: 10s
  skipDelete: false  # Ensure cleanup runs
  failFast: false    # Run all tests even if one fails
  parallel: 4        # Run tests in parallel
  reportFormat: JSON  # Generate JSON test reports
```

### Test Suite Configuration

Each test directory has a `chainsaw-test.yaml`:

```yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: cel-filter-tests
spec:
  description: Validate CEL expression filtering
  timeouts:
    assert: 30s  # Queries may take longer
  steps:
    - try:
        - apply:
            file: 01-simple-filters.yaml
        - assert:
            file: 01-expected.yaml
      finally:
        - delete:
            ref:
              apiVersion: activity.miloapis.com/v1alpha1
              kind: AuditLogQuery
              name: simple-filter-test
```

## Running Tests

### Installation

```bash
# Install Chainsaw
brew install kyverno/kyverno/chainsaw
# or
go install github.com/kyverno/chainsaw@latest
```

### Local Development

```bash
# 1. Start test infrastructure
task dev:setup

# 2. Seed test data
task test:seed-data

# 3. Run all e2e tests
chainsaw test --test-dir ./test/e2e

# 4. Run specific test suite
chainsaw test --test-dir ./test/e2e/02-cel-filters

# 5. Run with verbose output
chainsaw test --test-dir ./test/e2e -v 4
```

### CI/CD Integration

```yaml
# .github/workflows/e2e-tests.yaml
name: E2E Tests
on: [pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup test infrastructure
        run: task dev:setup

      - name: Seed test data
        run: task test:seed-data

      - name: Install Chainsaw
        run: go install github.com/kyverno/chainsaw@latest

      - name: Run E2E tests
        run: chainsaw test --test-dir ./test/e2e --report-format JSON --report-name e2e-results.json

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: e2e-results.json
```

### Task Integration

Update [Taskfile.yaml](../Taskfile.yaml:395):

```yaml
test:seed-data:
  desc: Seed ClickHouse with test data for e2e tests
  silent: true
  cmds:
    - |
      set -e
      echo "🌱 Seeding ClickHouse with test data..."

      # Generate deterministic test events
      {{.TOOL_DIR}}/audit-log-generator \
        -nats-url=nats://localhost:4222 \
        -count=1000 \
        -rate=100 \
        -subject=audit.k8s.test \
        -source=e2e-test-fixture \
        -seed=12345  # Fixed seed for reproducibility

      echo "⏳ Waiting for events to be processed..."
      sleep 10

      echo "✅ Test data seeded successfully"

test:end-to-end:
  desc: Run end-to-end tests using Chainsaw
  silent: true
  cmds:
    - |
      set -e
      echo "🧪 Running end-to-end tests with Chainsaw..."

      # Check if Chainsaw is installed
      if ! command -v chainsaw &> /dev/null; then
        echo "❌ Chainsaw not found. Install with:"
        echo "   brew install kyverno/kyverno/chainsaw"
        echo "   or go install github.com/kyverno/chainsaw@latest"
        exit 1
      fi

      # Verify test infrastructure is running
      if ! task test-infra:kubectl -- get deployment activity-apiserver -n activity-system &>/dev/null; then
        echo "❌ Test infrastructure not running"
        echo "Please run: task dev:setup"
        exit 1
      fi

      # Seed test data if needed
      echo "📋 Ensuring test data is seeded..."
      task test:seed-data

      # Run tests
      echo ""
      echo "🚀 Executing Chainsaw tests..."

      TEST_DIR="${TEST_DIR:-./test/e2e}"

      if [ -n "{{.CLI_ARGS}}" ]; then
        TEST_DIR="./test/e2e/{{.CLI_ARGS}}"
      fi

      chainsaw test \
        --test-dir "$TEST_DIR" \
        --report-format JSON \
        --report-name test-results.json \
        -v 4

      echo ""
      echo "✅ E2E tests complete!"
      echo "📊 Results saved to test-results.json"

test:end-to-end:watch:
  desc: Run e2e tests in watch mode during development
  silent: true
  cmds:
    - |
      echo "👀 Running tests in watch mode..."
      echo "Press Ctrl+C to exit"

      while true; do
        chainsaw test --test-dir ./test/e2e -v 4
        echo ""
        echo "⏳ Waiting for changes... (polling every 10s)"
        sleep 10
      done
```

## Success Metrics

The e2e test suite will be considered successful when:

1. **Coverage**: Tests cover all critical API paths
   - ✅ Basic query operations
   - ✅ All CEL filter operators
   - ✅ Pagination workflows
   - ✅ All validation error cases
   - ✅ Time format variations
   - ✅ RBAC and scope isolation

2. **Reliability**: Tests pass consistently (>99% success rate)

3. **Performance**: Full test suite completes in <5 minutes

4. **Maintainability**: Tests are declarative and easy to update

5. **CI Integration**: Tests run automatically on every PR

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Test data conflicts between parallel tests | Flaky tests | Use unique timestamps and source identifiers per test |
| ClickHouse query lag | Tests fail waiting for data | Add sufficient sleep/wait periods after seeding |
| Test environment not ready | Tests cannot run | Add pre-flight checks in test infrastructure |
| Chainsaw learning curve | Slow test development | Provide examples and templates |
| Test data pollution | Growing test database | Implement cleanup jobs or recreate DB before tests |

## Timeline and Milestones

### Phase 1: Foundation (Week 1)
- Install and configure Chainsaw
- Create test structure and global configuration
- Implement test data seeding
- Create 5 basic query tests

### Phase 2: Core Functionality (Week 2)
- Implement CEL filter tests (10 tests)
- Implement pagination tests (5 tests)
- Implement time format tests (5 tests)

### Phase 3: Validation and Errors (Week 3)
- Implement all validation error tests (10 tests)
- Implement RBAC and scope isolation tests (5 tests)

### Phase 4: Integration and Polish (Week 4)
- Implement end-to-end scenario tests (5 tests)
- Add CI/CD integration
- Documentation and examples
- Performance tuning

**Total**: ~45 tests covering all major functionality

## Alternatives Considered

### Ginkgo + Gomega
**Pros**: More powerful, programmatic control, widely used
**Cons**: Requires Go programming, higher learning curve, more boilerplate

**Decision**: Chainsaw is better suited for declarative Kubernetes resource testing

### Kubernetes E2E Framework
**Pros**: Official Kubernetes testing framework
**Cons**: Very heavyweight, designed for core Kubernetes testing, not custom resources

**Decision**: Too complex for our needs

### Custom Bash Scripts
**Pros**: Simple, direct control
**Cons**: No structure, hard to maintain, poor error reporting

**Decision**: Not scalable or maintainable

## Conclusion

Chainsaw provides the ideal balance of simplicity, power, and Kubernetes-native integration for testing the Activity API server. Its declarative YAML-based approach lowers the barrier to writing tests while providing comprehensive assertion capabilities.

By implementing this testing strategy, we will:
- Gain confidence in API behavior across all scenarios
- Catch regressions early in development
- Improve API reliability and user experience
- Enable safe refactoring and feature development
- Provide living documentation of API capabilities

## Next Steps

1. **Review and Approve**: Stakeholders review this proposal
2. **Prototype**: Create 3-5 example tests to validate approach
3. **Full Implementation**: Execute the 4-week timeline
4. **Iterate**: Gather feedback and expand test coverage as needed

## References

- [Chainsaw Documentation](https://kyverno.github.io/chainsaw/latest/)
- [Activity API Types](../pkg/apis/activity/v1alpha1/types.go)
- [Activity API Server Implementation](../internal/apiserver/apiserver.go)
- [Example Queries](../examples/queries/)
- [Test Infrastructure](../test/README.md)
