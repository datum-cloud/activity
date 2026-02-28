import { test, expect } from '@playwright/test';

test('Debug: Log all network requests', async ({ page }) => {
  // Log ALL requests
  page.on('request', (request) => {
    if (request.url().includes('activity') || request.url().includes('api')) {
      console.log(`>> REQUEST: ${request.method()} ${request.url()}`);
      if (request.method() === 'POST' && request.postData()) {
        try {
          const data = JSON.parse(request.postData()!);
          console.log('   POST data:', JSON.stringify(data, null, 2).substring(0, 500));
        } catch {
          console.log('   POST data (raw):', request.postData()?.substring(0, 200));
        }
      }
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('activity') || response.url().includes('api')) {
      console.log(`<< RESPONSE: ${response.status()} ${response.url()}`);
    }
  });

  console.log('\n=== Navigating to /activity-feed ===\n');
  await page.goto('/activity-feed');
  await page.waitForTimeout(2000);

  console.log('\n=== Clicking System button ===\n');
  await page.getByRole('button', { name: 'System' }).click();
  await page.waitForTimeout(1000);

  console.log('\n=== Clicking Human button ===\n');
  await page.getByRole('button', { name: 'Human' }).click();
  await page.waitForTimeout(1000);

  console.log('\n=== Test complete ===\n');
});
