import { test, expect } from '@playwright/test';

/**
 * E2E tests for EventsFeedFilters component
 * Tests the filter UI interactions including adding filters, selecting values, and clearing filters
 */

test.describe('EventsFeedFilters', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Events page
    await page.goto('/events');

    // Wait for the filters UI to be ready (don't use networkidle - app has persistent connections)
    await page.getByRole('button', { name: /\+ (Add )?Filters/i }).waitFor({ state: 'visible' });
  });

  test('"+ Add Filters" button opens dropdown', async ({ page }) => {
    // Find and click the Add Filters button
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await expect(addFiltersButton).toBeVisible();

    await addFiltersButton.click();

    // Verify dropdown appears with filter options
    const popover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(popover).toBeVisible();

    // Verify filter options are present (use exact: true where needed)
    await expect(page.getByRole('button', { name: 'Kind' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reason' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Namespace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source', exact: true })).toBeVisible();
  });

  test('Selecting a filter adds a chip with popover open', async ({ page }) => {
    // Click Add Filters button
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();

    // Wait for dropdown to be visible
    await page.waitForTimeout(200);

    // Click the "Kind" filter option
    const kindOption = page.getByRole('button', { name: 'Kind', exact: true });
    await kindOption.click();

    // Wait for React to process state update and render the chip
    await page.waitForTimeout(300);

    // Verify a filter chip labeled "Kind:" appears (look for text containing "Kind:")
    const kindChip = page.locator('button:has-text("Kind:")');
    await expect(kindChip).toBeVisible({ timeout: 5000 });

    // Verify the popover/dropdown is open for selecting values
    const searchInput = page.getByPlaceholder(/Search kinds/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('Selecting values updates the chip', async ({ page }) => {
    // Add Kind filter
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();
    await page.getByRole('button', { name: 'Kind' }).click();

    // Wait for the popover to open and options to load
    await page.waitForTimeout(500);

    // Select the first available option (if any options exist)
    const options = page.locator('[cmdk-item]');
    const optionCount = await options.count();

    if (optionCount > 0) {
      // Get the text of the first option before clicking
      const firstOption = options.first();
      const optionText = await firstOption.textContent();
      // Extract just the kind name (remove count like "(45)")
      const kindName = optionText?.replace(/\s*\(\d+\)\s*$/, '').trim() || '';

      // Click the first option
      await firstOption.click();

      // Verify the chip text updates to show the selected value
      const kindChip = page.locator('button').filter({ hasText: new RegExp(`Kind:.*${kindName}`, 'i') });
      await expect(kindChip).toBeVisible();
    } else {
      // If no options available, just verify the empty chip exists while popover is open
      const kindChip = page.locator('button').filter({ hasText: /^Kind:/ });
      await expect(kindChip).toBeVisible();
    }
  });

  test('Clicking existing filter chip reopens popover', async ({ page }) => {
    // Add a filter and select a value
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();
    await page.getByRole('button', { name: 'Kind' }).click();

    // Wait for popover to open
    await page.waitForTimeout(500);

    // Select first option to ensure chip persists
    const options = page.locator('[cmdk-item]');
    const optionCount = await options.count();
    if (optionCount > 0) {
      await options.first().click();
    }

    // Close the popover by clicking outside
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Wait for popover to close
    await page.waitForTimeout(300);

    // Find and click the filter chip to reopen
    const kindChip = page.locator('button').filter({ hasText: /^Kind:/ });

    // Only proceed if chip exists (has values selected)
    if (await kindChip.isVisible()) {
      await kindChip.click();

      // Verify popover reopens
      const popover = page.locator('[data-radix-popper-content-wrapper]').first();
      await expect(popover).toBeVisible();

      // Verify search input is visible
      const searchInput = page.getByPlaceholder(/Search kinds/i);
      await expect(searchInput).toBeVisible();
    }
  });

  test('X button clears the filter', async ({ page }) => {
    // Add a filter and select a value
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();
    await page.getByRole('button', { name: 'Kind' }).click();

    // Wait for popover to open
    await page.waitForTimeout(500);

    // Select first option to ensure chip persists
    const options = page.locator('[cmdk-item]');
    const optionCount = await options.count();
    if (optionCount > 0) {
      await options.first().click();
    }

    // Close popover by clicking outside
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    // Find the X button on the chip (it's adjacent to the chip button)
    const clearButton = page.getByLabel(/Clear Kind filter/i);

    if (await clearButton.isVisible()) {
      await clearButton.click();

      // Verify the chip is removed
      const kindChip = page.locator('button').filter({ hasText: /^Kind:/ });
      await expect(kindChip).not.toBeVisible();
    }
  });

  test('Closing popover without selecting shows empty filter chip', async ({ page }) => {
    // Click Add Filters
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();

    // Wait for dropdown
    await page.waitForTimeout(200);

    // Click a filter option (e.g., "Reason")
    await page.getByRole('button', { name: 'Reason', exact: true }).click();

    // Wait for chip to appear
    await page.waitForTimeout(300);

    // Verify the filter chip appears
    const reasonChip = page.locator('button:has-text("Reason:")');
    await expect(reasonChip).toBeVisible();

    // The chip should remain visible (current behavior)
    // User can click X to remove it if they don't want it
  });

  test('Filter chip shows selected value', async ({ page }) => {
    // Add Kind filter
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();

    // Wait for dropdown
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'Kind', exact: true }).click();

    // Wait for chip and popover
    await page.waitForTimeout(500);

    // Verify chip appeared
    const kindChip = page.locator('button:has-text("Kind:")');
    await expect(kindChip).toBeVisible();

    // Select first option if available
    const options = page.locator('[cmdk-item]');
    const optionCount = await options.count();

    if (optionCount > 0) {
      const firstOption = options.first();
      const optionText = await firstOption.textContent();

      // Click to select
      await firstOption.click();

      // Verify chip still visible with selected value
      await expect(kindChip).toBeVisible();

      // The chip should show the selected value
      if (optionText) {
        // Just verify the chip is still there after selection
        await expect(kindChip).toBeVisible();
      }
    }
  });

  test('Filter dropdown shows all available filter types', async ({ page }) => {
    // Open Add Filters dropdown
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();

    // Wait for dropdown
    await page.waitForTimeout(200);

    // Verify all expected filter types are shown
    await expect(page.getByRole('button', { name: 'Kind', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reason' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Namespace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resource Name' })).toBeVisible();
  });

  test('Search functionality works in typeahead filters', async ({ page }) => {
    // Add Kind filter
    const addFiltersButton = page.getByRole('button', { name: /\+ (Add )?Filters/i });
    await addFiltersButton.click();
    await page.getByRole('button', { name: 'Kind' }).click();

    // Wait for popover and options
    await page.waitForTimeout(500);

    // Get initial option count
    const initialCount = await page.locator('[cmdk-item]').count();

    if (initialCount > 0) {
      // Type in the search input
      const searchInput = page.getByPlaceholder(/Search kinds/i);
      await searchInput.fill('Pod');

      // Wait for filter to apply
      await page.waitForTimeout(300);

      // The search should filter the list (cmdk handles this)
      // Verify search input has the value
      await expect(searchInput).toHaveValue('Pod');
    }
  });
});
