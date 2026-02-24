# E2E Tests for Activity UI

This directory contains end-to-end tests for the Activity UI components using Playwright.

## Setup

Install Playwright and browsers:

```bash
cd ui
npm install
npx playwright install chromium
```

## Running Tests

The example app must be running at http://localhost:3000 for the tests to work. The Playwright config will automatically start the dev server, but you can also start it manually:

```bash
# Start the example app (in a separate terminal)
cd ui/example
npm run dev
```

### Run all tests

```bash
cd ui
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
cd ui
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
cd ui
npm run test:e2e:headed
```

### Run specific test file

```bash
cd ui
npx playwright test events-filters.spec.ts
```

### Run tests with debugging

```bash
cd ui
npx playwright test --debug
```

## Test Structure

### events-filters.spec.ts

Tests the EventsFeedFilters component interactions:

- **Add Filters button** - Opens dropdown with available filter options
- **Filter selection** - Adds filter chip and opens value selection popover
- **Value selection** - Updates chip text with selected values
- **Chip clicking** - Reopens popover for editing
- **Clear button** - Removes filter chip
- **Pending filter cleanup** - Removes empty filter chips when closed without selecting
- **Multiple filters** - Can add multiple filters simultaneously
- **Active filter state** - Already-active filters are disabled in dropdown
- **Search functionality** - Typeahead search filters options

## Key Selectors

The tests use these patterns to locate elements:

- **Add Filters button**: `getByRole('button', { name: /\+ (Add )?Filters/i })`
- **Filter chips**: `getByRole('button', { name: /^Kind:/i })`
- **Popover content**: `locator('[data-radix-popper-content-wrapper]')`
- **Filter options**: `getByRole('button', { name: 'Kind' })`
- **Search input**: `getByPlaceholder(/Search kinds/i)`
- **Clear button**: `getByRole('button', { name: /Clear Kind filter/i })`

## Viewing Test Results

After running tests, view the HTML report:

```bash
cd ui
npx playwright show-report
```

## CI Integration

Tests are configured to:
- Run in headless mode on CI (`forbidOnly: true`)
- Retry failed tests twice on CI
- Run tests serially on CI (`workers: 1`)
- Automatically start the dev server before tests

## Troubleshooting

### Tests fail with "Target closed" or "Navigation timeout"

The example app may not have started in time. Increase the `webServer.timeout` in `playwright.config.ts`.

### Tests fail to find elements

The component structure may have changed. Update the selectors in the test file to match the current DOM structure.

### Mock API not available

The example app uses a mock API client. Ensure the app is properly configured for testing.
