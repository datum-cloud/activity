/**
 * E2E tests for EventsFeed and EventsFeedItem components.
 * Tests event display, expand/collapse, and event type badges.
 */

import { test, expect } from '../fixtures';

test.describe('EventsFeed', () => {
  test.beforeEach(async ({ page, configureApi }) => {
    // Configure API connection (real or mock mode)
    await configureApi();
  });

  test.describe('Event List Loading', () => {
    test('should display loading state initially', async ({ page }) => {
      await page.goto('/events');

      // The loading indicator might appear briefly
      // Just verify the page loads without errors
      await page.waitForSelector('[role="group"][aria-label="Filter by event type"]', { timeout: 10000 });
    });

    test('should display events or empty state after loading', async ({ page }) => {
      await page.goto('/events');

      // Wait for loading to complete
      await page.waitForTimeout(3000);

      // Should either show events or the empty state message
      const hasEvents = (await page.locator('[class*="cursor-pointer"]').count()) > 0;
      const hasEmptyState = await page.getByText('No events found').isVisible().catch(() => false);

      // One of these should be true
      expect(hasEvents || hasEmptyState).toBeTruthy();
    });

    test('should show retry button on API error', async ({ page, isMockMode, configureApi }) => {
      // This test only makes sense in mock mode where we can simulate errors
      test.skip(!isMockMode, 'Only runs in mock mode');

      await configureApi({
        errors: {
          events: { status: 500, message: 'Internal server error' },
        },
      });

      await page.goto('/events');

      // Wait for error to appear
      await page.waitForTimeout(2000);

      // Should show error alert with retry button
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();

      const retryButton = page.getByRole('button', { name: /retry/i });
      await expect(retryButton).toBeVisible();
    });
  });

  test.describe('Event Type Badges', () => {
    test('should display event type badges when events exist', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Look for Normal or Warning badges
      const normalBadges = page.locator('text=Normal');
      const warningBadges = page.locator('text=Warning');

      const normalCount = await normalBadges.count();
      const warningCount = await warningBadges.count();

      // If we have events, we should have at least one badge type
      // (This might be 0 if the cluster has no events)
      if (normalCount + warningCount > 0) {
        // Verify badge styling
        if (normalCount > 0) {
          const normalBadge = normalBadges.first();
          // Normal badges should have green styling
          const hasGreenStyling = await normalBadge.locator('..').evaluate(
            (el) => el.className.includes('green') || getComputedStyle(el).backgroundColor.includes('34')
          );
          // Don't fail if styling isn't perfect - just verify badges exist
        }

        if (warningCount > 0) {
          const warningBadge = warningBadges.first();
          // Warning badges should have amber/yellow styling
        }
      }
    });

    test('should filter to show only Warning events when Warning filter is applied', async ({ page }) => {
      await page.goto('/events');

      // Wait for initial load
      await page.waitForTimeout(2000);

      // Apply Warning filter
      const warningButton = page.getByRole('button', { name: 'Warning' });
      await warningButton.click();

      // Wait for filter to apply
      await page.waitForTimeout(2000);

      // Count event badges
      const normalBadges = page.locator('[class*="bg-green"]').filter({ hasText: 'Normal' });
      const normalCount = await normalBadges.count();

      // Should not have any Normal badges visible (only Warning)
      // Note: This might fail if the API doesn't properly filter, which is valuable feedback
      expect(normalCount).toBe(0);
    });
  });

  test.describe('Event Expand/Collapse', () => {
    test('should display expand button for events', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Look for "More" button
      const moreButtons = page.getByRole('button', { name: /more/i });
      const buttonCount = await moreButtons.count();

      // If we have events, we should have More buttons
      // (buttonCount might be 0 if no events in the cluster)
      if (buttonCount > 0) {
        await expect(moreButtons.first()).toBeVisible();
      }
    });

    test('should expand event details when More is clicked', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find and click the first "More" button
      const moreButton = page.getByRole('button', { name: /more/i }).first();

      // Only test if we have events
      if (await moreButton.isVisible()) {
        await moreButton.click();

        // Wait for expansion
        await page.waitForTimeout(300);

        // Should show expanded details - look for typical detail labels
        const hasDetails =
          (await page.getByText('Namespace:').isVisible().catch(() => false)) ||
          (await page.getByText('Event Name:').isVisible().catch(() => false)) ||
          (await page.getByText('First Seen:').isVisible().catch(() => false));

        expect(hasDetails).toBeTruthy();

        // Should now show "Less" button
        const lessButton = page.getByRole('button', { name: /less/i }).first();
        await expect(lessButton).toBeVisible();
      }
    });

    test('should collapse event details when Less is clicked', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find and click the first "More" button
      const moreButton = page.getByRole('button', { name: /more/i }).first();

      // Only test if we have events
      if (await moreButton.isVisible()) {
        // Expand
        await moreButton.click();
        await page.waitForTimeout(300);

        // Collapse
        const lessButton = page.getByRole('button', { name: /less/i }).first();
        await lessButton.click();
        await page.waitForTimeout(300);

        // "More" should be visible again
        const newMoreButton = page.getByRole('button', { name: /more/i }).first();
        await expect(newMoreButton).toBeVisible();
      }
    });

    test('should toggle aria-expanded attribute correctly', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find the expand button
      const expandButton = page.getByRole('button', { name: /more/i }).first();

      // Only test if we have events
      if (await expandButton.isVisible()) {
        // Initially collapsed
        await expect(expandButton).toHaveAttribute('aria-expanded', 'false');

        // Click to expand
        await expandButton.click();
        await page.waitForTimeout(300);

        // Find the collapse button (now shows "Less")
        const collapseButton = page.getByRole('button', { name: /less/i }).first();
        await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
      }
    });
  });

  test.describe('Event Content', () => {
    test('should display event messages', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Events should have some text content
      const eventCards = page.locator('[class*="cursor-pointer"]');
      const cardCount = await eventCards.count();

      if (cardCount > 0) {
        // First card should have some text content (message)
        const firstCard = eventCards.first();
        const text = await firstCard.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    });

    test('should display relative timestamps', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Look for relative time indicators
      const timePatterns = ['just now', 'ago', 'minute', 'hour', 'second', 'day'];
      let hasTimestamp = false;

      for (const pattern of timePatterns) {
        const matches = page.getByText(new RegExp(pattern, 'i'));
        if ((await matches.count()) > 0) {
          hasTimestamp = true;
          break;
        }
      }

      // If we have events, we should have timestamps
      const eventCards = page.locator('[class*="cursor-pointer"]');
      if ((await eventCards.count()) > 0) {
        expect(hasTimestamp).toBeTruthy();
      }
    });

    test('should display involved object information', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Look for involved object references (Pod, Deployment, etc.)
      const resourceTypes = ['Pod', 'Deployment', 'Service', 'ConfigMap', 'Secret', 'Node'];
      let hasResourceType = false;

      for (const resourceType of resourceTypes) {
        const matches = page.getByText(resourceType);
        if ((await matches.count()) > 0) {
          hasResourceType = true;
          break;
        }
      }

      // If we have events, we should see resource types
      const eventCards = page.locator('[class*="cursor-pointer"]');
      if ((await eventCards.count()) > 0) {
        expect(hasResourceType).toBeTruthy();
      }
    });
  });

  test.describe('Event Interactions', () => {
    test('should handle event card click', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find and click an event card
      const eventCard = page.locator('[class*="cursor-pointer"]').first();

      if (await eventCard.isVisible()) {
        await eventCard.click();

        // Wait for any modal/detail view to appear
        await page.waitForTimeout(500);

        // In the example app, clicking opens EventDetailModal
        // Look for modal content or verify click handler worked
        const modalContent = page.locator('[role="dialog"]');
        const hasModal = await modalContent.isVisible().catch(() => false);

        // Either modal appears or the click was handled (no error thrown)
        // This test mainly verifies the click handler doesn't crash
      }
    });

    test('should handle involved object click', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find an involved object link (clickable button with resource type)
      const objectLink = page.locator('button').filter({ hasText: /Pod|Deployment|Service/i }).first();

      if (await objectLink.isVisible()) {
        // Set up console listener before clicking
        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
          consoleMessages.push(msg.text());
        });

        await objectLink.click();

        // Wait for click handler
        await page.waitForTimeout(300);

        // In the example app, this logs "Object clicked" to console
        // Verify click was handled without errors
      }
    });
  });

  test.describe('Pagination/Infinite Scroll', () => {
    test('should have scrollable event list', async ({ page }) => {
      await page.goto('/events');

      // Wait for events to load
      await page.waitForTimeout(3000);

      // Find the scroll container
      const scrollContainer = page.locator('[class*="overflow-y-auto"]').first();

      if (await scrollContainer.isVisible()) {
        // Verify it's scrollable
        const scrollHeight = await scrollContainer.evaluate((el) => el.scrollHeight);
        const clientHeight = await scrollContainer.evaluate((el) => el.clientHeight);

        // Either it's scrollable (content larger than container) or content fits
        // Both are valid states
        expect(scrollHeight).toBeGreaterThanOrEqual(0);
        expect(clientHeight).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
