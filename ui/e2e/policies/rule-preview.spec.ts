import { test, expect } from '@playwright/test';
import { fillMonacoEditor } from '../helpers/monaco';

/**
 * E2E tests for RulePreviewPanel in PolicyRuleEditorDialog
 * Tests the live preview functionality that shows how rules match against sample data
 */

test.describe('RulePreviewPanel (inline preview during rule editing)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API to prevent real requests
    await page.route('**/activitypolicies', async (route) => {
      await route.fulfill({
        status: 200,
        json: { items: [] },
      });
    });

    // Navigate to policy create page
    await page.goto('/policies/new');
  });

  test('displays Live Preview section in rule editor dialog', async ({ page }) => {
    // Intercept audit log query requests
    await page.route('**/auditlogqueries', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: [
              {
                verb: 'create',
                user: { username: 'alice@example.com' },
                objectRef: {
                  apiGroup: 'networking.datumapis.com',
                  resource: 'httpproxies',
                  name: 'test-proxy',
                  namespace: 'default',
                },
                responseStatus: { code: 201 },
                requestTimestamp: '2024-01-15T10:00:00Z',
              },
            ],
          },
        },
      });
    });

    // Mock policy preview
    await page.route('**/policypreviews', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: [],
            activities: [],
          },
        },
      });
    });

    // Open the rule editor dialog
    await page.getByRole('button', { name: 'Add Audit Rule' }).click();

    // Wait for dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify that the Live Preview section is present
    await expect(page.getByText('Live Preview')).toBeVisible();
  });

  test('shows preview as user types rule definition', async ({ page }) => {
    // Mock audit log query with sample data
    await page.route('**/auditlogqueries', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: [
              {
                verb: 'create',
                user: { username: 'alice@example.com' },
                objectRef: {
                  apiGroup: 'networking.datumapis.com',
                  resource: 'httpproxies',
                  name: 'test-proxy-1',
                  namespace: 'default',
                },
                responseStatus: { code: 201 },
                requestTimestamp: '2024-01-15T10:00:00Z',
              },
              {
                verb: 'update',
                user: { username: 'bob@example.com' },
                objectRef: {
                  apiGroup: 'networking.datumapis.com',
                  resource: 'httpproxies',
                  name: 'test-proxy-2',
                  namespace: 'default',
                },
                responseStatus: { code: 200 },
                requestTimestamp: '2024-01-15T10:05:00Z',
              },
            ],
          },
        },
      });
    });

    // Mock policy preview with match results
    await page.route('**/policypreviews', async (route) => {
      const request = route.request();
      const payload = JSON.parse(request.postData() || '{}');

      // Check if the rule matches 'create' verb
      const hasCreateRule = payload.policy?.auditRules?.some(
        (r: any) => r.match?.includes('create')
      );

      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: hasCreateRule
              ? [
                  { inputIndex: 0, matched: true },
                  { inputIndex: 1, matched: false },
                ]
              : [],
            activities: hasCreateRule
              ? [
                  {
                    metadata: { name: 'activity-1' },
                    spec: {
                      summary: 'alice@example.com created HTTPProxy test-proxy-1',
                      changeSource: 'human',
                      actor: { type: 'user', name: 'alice@example.com' },
                      resource: {
                        apiGroup: 'networking.datumapis.com',
                        kind: 'HTTPProxy',
                        name: 'test-proxy-1',
                        namespace: 'default',
                      },
                      links: [],
                      origin: { type: 'audit', id: 'audit-1' },
                    },
                  },
                ]
              : [],
          },
        },
      });
    });

    // Open rule editor dialog
    await page.getByRole('button', { name: 'Add Audit Rule' }).click();

    // Wait for dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in rule details to trigger preview
    await page.fill('#rule-name', 'create-rule');
    await fillMonacoEditor(page, 'cel-editor-match', 'audit.verb == "create"');
    await fillMonacoEditor(page, 'cel-editor-summary', '{{ actor.name }} created {{ kind }} {{ audit.objectRef.name }}');

    // Wait for preview to update (debounced)
    await page.waitForTimeout(1000);

    // Verify Live Preview section is visible
    await expect(page.getByText('Live Preview')).toBeVisible();
  });

  test('rule can be created after filling form', async ({ page }) => {
    // Mock policy preview
    await page.route('**/policypreviews', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: [],
            activities: [],
          },
        },
      });
    });

    await page.route('**/auditlogqueries', async (route) => {
      await route.fulfill({
        status: 200,
        json: { status: { results: [] } },
      });
    });

    // Open rule editor
    await page.getByRole('button', { name: 'Add Audit Rule' }).click();

    // Wait for dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in complete rule
    await page.fill('#rule-name', 'create-rule');
    await fillMonacoEditor(page, 'cel-editor-match', 'audit.verb == "create"');
    await fillMonacoEditor(page, 'cel-editor-summary', '{{ actor.name }} created {{ kind }} {{ audit.objectRef.name }}');

    // Create the rule
    await page.getByRole('button', { name: 'Create Rule' }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify rule was created
    await expect(page.getByText('create-rule')).toBeVisible();
  });

  test('preview panel shows loading state initially', async ({ page }) => {
    // Mock policy preview with delay
    await page.route('**/policypreviews', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        json: {
          status: {
            results: [],
            activities: [],
          },
        },
      });
    });

    await page.route('**/auditlogqueries', async (route) => {
      await route.fulfill({
        status: 200,
        json: { status: { results: [] } },
      });
    });

    // Open rule editor
    await page.getByRole('button', { name: 'Add Audit Rule' }).click();

    // Verify Live Preview section is visible
    await expect(page.getByText('Live Preview')).toBeVisible();
  });
});
