/**
 * Global setup for Playwright E2E tests.
 *
 * Configures the API connection by setting up browser storage state
 * that the example app uses to connect to the Activity API.
 *
 * Environment Variables:
 *   ACTIVITY_API_URL - URL of the Activity API server (default: empty for same-origin proxy)
 *   ACTIVITY_API_TOKEN - Optional bearer token for authentication
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility - get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const apiUrl = process.env.ACTIVITY_API_URL || '';
  const apiToken = process.env.ACTIVITY_API_TOKEN || '';

  console.log('');
  console.log('='.repeat(60));
  console.log('Playwright E2E Test Setup');
  console.log('='.repeat(60));
  console.log(`API URL: ${apiUrl || '(same-origin proxy)'}`);
  console.log(`API Token: ${apiToken ? '(configured)' : '(not configured)'}`);
  console.log('='.repeat(60));
  console.log('');

  // Create the auth directory if it doesn't exist
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Get the base URL from config
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';

  // Launch browser to set up storage state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app to set sessionStorage
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Set the API URL and token in sessionStorage
    await page.evaluate(
      ({ apiUrl, apiToken }) => {
        sessionStorage.setItem('apiUrl', apiUrl);
        if (apiToken) {
          sessionStorage.setItem('token', apiToken);
        }
      },
      { apiUrl, apiToken }
    );

    // Save the storage state
    await context.storageState({ path: path.join(authDir, 'storage-state.json') });

    console.log('Storage state saved successfully');
  } catch (error) {
    console.warn('Warning: Could not set up storage state');
    console.warn('The UI server may not be running yet (this is OK - it starts with webServer)');

    // Create a minimal storage state file so tests can still run
    const minimalState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [],
        },
      ],
    };

    fs.writeFileSync(
      path.join(authDir, 'storage-state.json'),
      JSON.stringify(minimalState, null, 2)
    );
  }

  await browser.close();
}

export default globalSetup;
