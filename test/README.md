# End-to-End Tests

This directory contains end-to-end tests for Activity using [Chainsaw](https://kyverno.github.io/chainsaw/).

## Structure

```
test/
├── README.md           # This file
└── e2e/               # End-to-end test suites
    ├── auditlog/      # AuditLogQuery tests
    ├── filters/       # CEL filter expression tests
    └── pagination/    # Pagination tests
```

## Running Tests

### Prerequisites

1. Test infrastructure must be running:
   ```bash
   task dev:setup
   ```

2. ClickHouse must be populated with test data

### Run All Tests

```bash
task test:end-to-end
```

### Run Specific Test Suite

```bash
task test:end-to-end -- auditlog
task test:end-to-end -- filters
```

## Writing Tests

Tests use Chainsaw's declarative test format. Each test directory contains:

- `chainsaw-test.yaml` - Test metadata and configuration
- `01-*.yaml` - Test steps (numbered for execution order)
- `02-*.yaml` - Additional test steps

### Example Test Structure

```yaml
# chainsaw-test.yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: auditlog-query-basic
spec:
  description: Test basic AuditLogQuery operations
  steps:
  - try:
    - apply:
        file: 01-create-query.yaml
    - assert:
        file: 01-assert-results.yaml
```

## Test Data

Test data setup and seeding scripts will be added to support repeatable test scenarios.

## Notes

- Tests run against Activity deployed in the test-infra cluster
- ClickHouse backend must be properly configured and seeded
- Each test should be idempotent and clean up after itself
