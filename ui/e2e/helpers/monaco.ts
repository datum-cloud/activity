import type { Page } from '@playwright/test';

/**
 * Type text into a Monaco editor OR fallback textarea
 * Monaco editors don't support standard page.fill() because they use complex DOM structure.
 * This helper detects whether Monaco loaded or if we're using the fallback textarea,
 * and uses the appropriate method to fill the content.
 */
export async function fillMonacoEditor(page: Page, testId: string, text: string) {
  // Wait for the editor container to be visible
  const editor = page.getByTestId(testId);
  await editor.waitFor({ state: 'visible', timeout: 10000 });

  // Wait for Monaco to load or timeout (component has 2 second timeout to fallback)
  // We'll wait up to 8 seconds to be safe (Monaco can be slow in CI)
  await page.waitForFunction(
    (testId) => {
      const container = document.querySelector(`[data-testid="${testId}"]`);
      if (!container) return false;

      // Check for loading state
      const isLoading = container.textContent?.includes('Loading editor...');
      if (isLoading) return false; // Still loading

      // Check if Monaco loaded (has textarea.inputarea)
      const hasMonaco = container.querySelector('textarea.inputarea') !== null;
      if (hasMonaco) return true;

      // Check if fallback textarea exists
      const hasFallback = container.querySelector('textarea') !== null;
      if (hasFallback) return true;

      return false;
    },
    testId,
    { timeout: 8000 } // Wait up to 8 seconds for Monaco or fallback
  );

  // Now determine what type of editor we have
  const monacoTextarea = editor.locator('textarea.inputarea');
  const fallbackTextarea = editor.locator('textarea').first();
  const hasMonaco = (await monacoTextarea.count()) > 0;

  if (hasMonaco) {
    // Monaco editor detected - use keyboard input
    await editor.click();
    await page.waitForTimeout(100);

    // Select all and replace
    await page.keyboard.press('Meta+A');
    await page.keyboard.type(text, { delay: 5 });
  } else {
    // Fallback textarea - use standard fill
    await fallbackTextarea.fill(text);
  }
}

/**
 * Get the value from a Monaco editor OR fallback textarea
 */
export async function getMonacoEditorValue(page: Page, testId: string): Promise<string> {
  const editor = page.getByTestId(testId);

  // Wait for editor to be ready (same logic as fillMonacoEditor)
  try {
    await page.waitForFunction(
      (testId) => {
        const container = document.querySelector(`[data-testid="${testId}"]`);
        if (!container) return false;

        const isLoading = container.textContent?.includes('Loading editor...');
        if (isLoading) return false;

        const hasMonaco = container.querySelector('textarea.inputarea') !== null;
        const hasFallback = container.querySelector('textarea') !== null;

        return hasMonaco || hasFallback;
      },
      testId,
      { timeout: 8000 }
    );
  } catch (e) {
    // Log what we found for debugging
    const content = await editor.textContent();
    throw new Error(`Editor not ready for test-id ${testId}. Content: ${content}`);
  }

  // Check if we have Monaco or fallback
  const monacoLines = editor.locator('.view-line');
  const monacoTextarea = editor.locator('textarea.inputarea');
  const fallbackTextarea = editor.locator('textarea').first();

  const hasMonaco = (await monacoTextarea.count()) > 0;

  if (hasMonaco) {
    // Monaco renders content in .view-line elements
    const lines = await monacoLines.allTextContents();
    return lines.join('\n').trim();
  } else {
    // Fallback textarea
    return await fallbackTextarea.inputValue();
  }
}

/**
 * Check if a Monaco editor has a specific value
 * Useful for assertions in tests
 */
export async function expectMonacoEditorValue(page: Page, testId: string, expectedValue: string) {
  const actualValue = await getMonacoEditorValue(page, testId);
  return actualValue === expectedValue;
}
