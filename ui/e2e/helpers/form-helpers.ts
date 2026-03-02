import type { Page, Locator } from '@playwright/test';

/**
 * Helper functions for interacting with shadcn/ui form components in E2E tests
 */

/**
 * Fill a Select component (dropdown) with a custom value
 * This handles the pattern where you:
 * 1. Click the select trigger to open dropdown
 * 2. Click "Enter custom value..." option
 * 3. Fill the input that appears
 */
export async function fillSelectWithCustomValue(
  page: Page,
  triggerLocator: Locator,
  value: string
) {
  // Click trigger to open dropdown
  await triggerLocator.click();
  await page.waitForTimeout(200);

  // Click "Enter custom value..." option
  await page.getByRole('option', { name: /Enter custom value/i }).click();
  await page.waitForTimeout(200);

  // Wait for the input to appear and be visible
  const input = page.locator('input[type="text"]:visible').last();
  await input.waitFor({ state: 'visible', timeout: 2000 });

  // Fill the input
  await input.fill(value);
}

/**
 * Fill API Group field in PolicyResourceForm
 * Handles the Select -> Custom input pattern
 */
export async function fillApiGroup(page: Page, apiGroup: string) {
  // Find the API Group select trigger
  const selectTrigger = page.locator('label:has-text("API Group")').locator('..').locator('[role="combobox"]').first();
  await fillSelectWithCustomValue(page, selectTrigger, apiGroup);
}

/**
 * Fill Kind field in PolicyResourceForm
 * Handles the Select -> Custom input pattern
 */
export async function fillKind(page: Page, kind: string) {
  // Find the Kind select trigger
  const selectTrigger = page.locator('label:has-text("Kind")').locator('..').locator('[role="combobox"]').first();
  await fillSelectWithCustomValue(page, selectTrigger, kind);
}

/**
 * Fill resource details (API Group + Kind) in policy editor
 */
export async function fillResourceDetails(page: Page, apiGroup: string, kind: string) {
  await fillApiGroup(page, apiGroup);
  // Wait for API Group change to propagate and Kind select to become enabled
  await page.waitForTimeout(300);
  await fillKind(page, kind);
}

/**
 * Click a rule card to open edit dialog
 * Rules are displayed as clickable cards in PolicyRuleListItem
 */
export async function clickRuleToEdit(page: Page, ruleName: string) {
  // Find the rule by name and click the Edit button
  const ruleCard = page.locator(`text=${ruleName}`).locator('..').locator('..');
  const editButton = ruleCard.getByRole('button', { name: /Edit rule/i });
  await editButton.click();
}
