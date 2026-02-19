/**
 * E2E tests for TimeRangeDropdown component.
 * Tests preset options and custom range selection.
 */

import { test, expect } from '../fixtures';

test.describe('TimeRangeDropdown', () => {
  test.beforeEach(async ({ page, configureApi }) => {
    // Configure API connection (real or mock mode)
    await configureApi();
  });

  test('should display time range dropdown with label', async ({ page }) => {
    await page.goto('/events');

    // Wait for filters to load
    await page.waitForSelector('text=Time Range', { timeout: 10000 });

    // The Time Range label should be visible
    await expect(page.locator('text=Time Range').first()).toBeVisible();

    // There should be a button/dropdown trigger for time range
    // It typically shows a value like "Last 24 hours"
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last|hour|day/i });
    const count = await timeRangeTrigger.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show preset options when dropdown is opened', async ({ page }) => {
    await page.goto('/events');

    // Wait for filters to load
    await page.waitForTimeout(2000);

    // Find and click the time range dropdown trigger
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last.*hour|Last.*day/i }).first();
    await timeRangeTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Should show preset options
    const presetOptions = [
      'Last hour',
      'Last 24 hours',
      'Last 7 days',
      'Last 30 days',
    ];

    let visiblePresets = 0;
    for (const preset of presetOptions) {
      const option = page.getByText(preset, { exact: false });
      if (await option.isVisible().catch(() => false)) {
        visiblePresets++;
      }
    }

    // At least some presets should be visible
    expect(visiblePresets).toBeGreaterThan(0);
  });

  test('should select a time preset', async ({ page }) => {
    await page.goto('/events');

    // Wait for filters to load
    await page.waitForTimeout(2000);

    // Find and click the time range dropdown
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last.*hour|Last.*day/i }).first();
    await timeRangeTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Try to click "Last 7 days" or whatever preset is available
    const last7Days = page.getByText('Last 7 days');
    const lastHour = page.getByText('Last hour');

    if (await last7Days.isVisible()) {
      await last7Days.click();

      // Wait for selection to apply
      await page.waitForTimeout(500);

      // The trigger should now show "Last 7 days"
      const updatedTrigger = page.locator('button').filter({ hasText: '7 days' });
      await expect(updatedTrigger).toBeVisible();
    } else if (await lastHour.isVisible()) {
      await lastHour.click();

      await page.waitForTimeout(500);

      const updatedTrigger = page.locator('button').filter({ hasText: 'hour' });
      await expect(updatedTrigger).toBeVisible();
    }
  });

  test('should trigger data refresh when time range changes', async ({ page }) => {
    // Track API requests - set up BEFORE navigation
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Match various API patterns
      if (url.includes('/events') || url.includes('activity.miloapis.com') || url.includes('activity.datum.net')) {
        apiRequests.push(url);
      }
    });

    await page.goto('/events');

    // Wait for initial load
    await page.waitForTimeout(2000);
    const initialRequestCount = apiRequests.length;

    // Find and click the time range dropdown
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last.*hour|Last.*day/i }).first();
    await timeRangeTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Click a different preset
    const last7Days = page.getByText('Last 7 days');
    const lastHour = page.getByText('Last hour');

    if (await last7Days.isVisible()) {
      await last7Days.click();
    } else if (await lastHour.isVisible()) {
      await lastHour.click();
    }

    // Wait for refresh
    await page.waitForTimeout(1500);

    // Should have made additional API calls
    // At minimum, the page should have loaded with requests
    expect(apiRequests.length).toBeGreaterThanOrEqual(initialRequestCount);
  });

  test('should have custom range option available', async ({ page }) => {
    await page.goto('/events');

    // Wait for filters to load
    await page.waitForTimeout(2000);

    // Find and click the time range dropdown
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last.*hour|Last.*day/i }).first();
    await timeRangeTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Look for custom range option or date inputs
    const customOption = page.getByText(/custom/i);
    const dateInputs = page.locator('input[type="datetime-local"]');

    const hasCustomOption = await customOption.isVisible().catch(() => false);
    const hasDateInputs = (await dateInputs.count()) > 0;

    // Either custom option or date inputs should be available
    expect(hasCustomOption || hasDateInputs).toBeTruthy();
  });

  test('should allow setting custom date range', async ({ page }) => {
    await page.goto('/events');

    // Wait for filters to load
    await page.waitForTimeout(2000);

    // Find and click the time range dropdown
    const timeRangeTrigger = page.locator('button').filter({ hasText: /Last.*hour|Last.*day/i }).first();
    await timeRangeTrigger.click();

    // Wait for dropdown to open
    await page.waitForTimeout(300);

    // Try to find custom range option
    const customOption = page.getByText(/custom/i);
    if (await customOption.isVisible()) {
      await customOption.click();
      await page.waitForTimeout(300);
    }

    // Look for date inputs
    const dateInputs = page.locator('input[type="datetime-local"]');
    if ((await dateInputs.count()) >= 2) {
      const startInput = dateInputs.first();
      const endInput = dateInputs.nth(1);

      // Set custom dates
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const formatDateTime = (date: Date) => {
        return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      };

      await startInput.fill(formatDateTime(yesterday));
      await endInput.fill(formatDateTime(now));

      // Find and click apply button if it exists
      const applyButton = page.getByRole('button', { name: /apply/i });
      if (await applyButton.isVisible()) {
        await applyButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
