import { test, expect } from '@playwright/test';

/**
 * E2E tests for Activity Feed changeSource filter
 * Tests that the Human/System toggle correctly filters activities
 */

test.describe('Activity Feed Source Filter', () => {
  test('Human filter sends changeSource: "human" in API request', async ({ page }) => {
    const requests: any[] = [];

    // Set up route interception BEFORE navigation
    await page.route('**/activityqueries', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '{}');
        requests.push(payload);
        console.log('Captured request:', JSON.stringify(payload.spec, null, 2));
      }
      await route.continue();
    });

    // Navigate to Activity Feed
    await page.goto('/activity-feed');

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Clear captured requests from initial load
    const initialRequestCount = requests.length;
    console.log(`Initial load made ${initialRequestCount} requests`);

    // Click Human filter and wait for the request
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes('activityqueries') && req.method() === 'POST'
    );

    await page.getByRole('button', { name: 'Human' }).click();

    // Wait for the debounced request (300ms debounce + buffer)
    await page.waitForTimeout(500);

    // Check if a new request was made after clicking Human
    const newRequests = requests.slice(initialRequestCount);
    console.log(`After clicking Human: ${newRequests.length} new requests`);

    if (newRequests.length > 0) {
      const lastRequest = newRequests[newRequests.length - 1];
      console.log('Last request spec:', JSON.stringify(lastRequest.spec, null, 2));
      expect(lastRequest.spec.changeSource).toBe('human');
    } else {
      // If Human was already selected (default), try clicking All then Human
      console.log('No new request - Human may already be selected. Clicking All then Human...');

      await page.getByRole('button', { name: 'All' }).click();
      await page.waitForTimeout(500);

      const afterAllCount = requests.length;

      await page.getByRole('button', { name: 'Human' }).click();
      await page.waitForTimeout(500);

      const humanRequests = requests.slice(afterAllCount);
      expect(humanRequests.length).toBeGreaterThan(0);

      const humanRequest = humanRequests[humanRequests.length - 1];
      console.log('Human request spec:', JSON.stringify(humanRequest.spec, null, 2));
      expect(humanRequest.spec.changeSource).toBe('human');
    }
  });

  test('System filter sends changeSource: "system" in API request', async ({ page }) => {
    const requests: any[] = [];

    await page.route('**/activityqueries', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        requests.push(JSON.parse(request.postData() || '{}'));
      }
      await route.continue();
    });

    await page.goto('/activity-feed');
    await page.waitForTimeout(1000);

    const beforeCount = requests.length;

    // Click System filter
    await page.getByRole('button', { name: 'System' }).click();
    await page.waitForTimeout(500);

    const newRequests = requests.slice(beforeCount);
    expect(newRequests.length).toBeGreaterThan(0);

    const lastRequest = newRequests[newRequests.length - 1];
    console.log('System request spec:', JSON.stringify(lastRequest.spec, null, 2));
    expect(lastRequest.spec.changeSource).toBe('system');
  });

  test('All filter does NOT include changeSource in API request', async ({ page }) => {
    const requests: any[] = [];

    await page.route('**/activityqueries', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        requests.push(JSON.parse(request.postData() || '{}'));
      }
      await route.continue();
    });

    await page.goto('/activity-feed');
    await page.waitForTimeout(1000);

    // First click Human to ensure we're not on All
    await page.getByRole('button', { name: 'Human' }).click();
    await page.waitForTimeout(500);

    const beforeCount = requests.length;

    // Now click All
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(500);

    const newRequests = requests.slice(beforeCount);
    expect(newRequests.length).toBeGreaterThan(0);

    const lastRequest = newRequests[newRequests.length - 1];
    console.log('All request spec:', JSON.stringify(lastRequest.spec, null, 2));
    expect(lastRequest.spec.changeSource).toBeUndefined();
  });

  test('Human filter returns ONLY human activities (no system)', async ({ page }) => {
    let capturedResponse: any = null;

    await page.route('**/activityqueries', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '{}');

        // Only capture when changeSource is human
        if (payload.spec?.changeSource === 'human') {
          const response = await route.fetch();
          capturedResponse = await response.json();

          console.log('=== Human filter request ===');
          console.log('Request changeSource:', payload.spec.changeSource);
          console.log('Response activities:', capturedResponse.status?.results?.length || 0);

          if (capturedResponse.status?.results?.length > 0) {
            capturedResponse.status.results.forEach((a: any, i: number) => {
              console.log(`  ${i + 1}. changeSource=${a.spec?.changeSource}`);
            });
          }

          await route.fulfill({ response, json: capturedResponse });
          return;
        }
      }
      await route.continue();
    });

    await page.goto('/activity-feed');
    await page.waitForTimeout(1000);

    // Click Human (or ensure it's selected)
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Human' }).click();
    await page.waitForTimeout(1000);

    // Check response
    if (!capturedResponse || !capturedResponse.status?.results?.length) {
      console.log('No activities returned - cannot verify filter');
      return;
    }

    // Verify ALL activities have changeSource: "human"
    const activities = capturedResponse.status.results;
    const systemActivities = activities.filter((a: any) => a.spec?.changeSource === 'system');

    if (systemActivities.length > 0) {
      console.log('ERROR: Found system activities in human-filtered response!');
      systemActivities.forEach((a: any) => {
        console.log(`  - changeSource: ${a.spec?.changeSource}, summary: ${a.spec?.summary}`);
      });
      expect(systemActivities).toHaveLength(0);
    } else {
      console.log('SUCCESS: All activities have changeSource: "human"');
    }
  });

  test('Debug: Full request/response trace', async ({ page }) => {
    console.log('\n========================================');
    console.log('DEBUG: Activity Source Filter Test');
    console.log('========================================\n');

    await page.route('**/activityqueries', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '{}');
        console.log('\n--- API REQUEST ---');
        console.log('changeSource:', payload.spec?.changeSource ?? '(not set)');
        console.log('startTime:', payload.spec?.startTime);
        console.log('endTime:', payload.spec?.endTime);

        const response = await route.fetch();
        const json = await response.json();

        console.log('\n--- API RESPONSE ---');
        console.log('Total results:', json.status?.results?.length || 0);

        if (json.status?.results?.length > 0) {
          const humanCount = json.status.results.filter((a: any) => a.spec?.changeSource === 'human').length;
          const systemCount = json.status.results.filter((a: any) => a.spec?.changeSource === 'system').length;
          console.log(`Human activities: ${humanCount}`);
          console.log(`System activities: ${systemCount}`);
        }

        await route.fulfill({ response, json });
        return;
      }
      await route.continue();
    });

    await page.goto('/activity-feed');
    console.log('\n>>> Page loaded');
    await page.waitForTimeout(1500);

    console.log('\n>>> Clicking "System" button');
    await page.getByRole('button', { name: 'System' }).click();
    await page.waitForTimeout(1000);

    console.log('\n>>> Clicking "Human" button');
    await page.getByRole('button', { name: 'Human' }).click();
    await page.waitForTimeout(1000);

    console.log('\n>>> Clicking "All" button');
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(1000);

    console.log('\n========================================');
    console.log('DEBUG TEST COMPLETE');
    console.log('========================================\n');
  });
});
