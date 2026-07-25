import { test, expect } from '@playwright/test';

/**
 * Vue parity for the Insert > Symbol menu entry. Mirrors the React
 * e2e/tests/insert-symbol.spec.ts: the menu item opens the shared
 * InsertSymbolDialog and inserts a special character at the cursor.
 */

async function openSymbolDialog(page: import('@playwright/test').Page) {
  await page.locator('.docx-menu-dropdown__trigger', { hasText: 'Insert' }).click();
  await page.locator('.docx-menu-dropdown__item', { hasText: 'Symbol' }).click();
}

test('Vue opens the symbol dialog from the Insert menu', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });

  await openSymbolDialog(page);
  await expect(page.locator('.symbol-dialog .dialog__title')).toHaveText('Insert Symbol');
});

test('Vue inserts a chosen symbol at the cursor', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });

  // Place the cursor in the body.
  await page.locator('.layout-page-content').first().click();

  await openSymbolDialog(page);
  await expect(page.locator('.symbol-dialog')).toBeVisible();

  // Filter to a deterministic glyph (ω) and insert via the footer button.
  await page.locator('.symbol-search').fill('ω');
  await page.locator('.symbol-grid .symbol-cell', { hasText: 'ω' }).first().click();
  await page.locator('.dialog__btn--primary').click();

  await expect(page.locator('.layout-page-content')).toContainText('ω', { timeout: 10000 });
});

test('Vue inserts a special character from the Special Characters tab', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });
  await page.locator('.layout-page-content').first().click();

  await openSymbolDialog(page);
  await expect(page.locator('.symbol-dialog')).toBeVisible();

  await page.locator('.symbol-toptab', { hasText: 'Special Characters' }).click();
  await page.locator('.symbol-special__row', { hasText: 'Copyright' }).first().dblclick();

  await expect(page.locator('.layout-page-content')).toContainText('©', { timeout: 10000 });
});

test('Vue inserts a symbol carrying the chosen font', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });
  await page.locator('.layout-page-content').first().click();

  await openSymbolDialog(page);
  await expect(page.locator('.symbol-dialog')).toBeVisible();

  await page.locator('#vue-insert-symbol-font').selectOption('Arial');
  await page.locator('.symbol-search').fill('ω');
  await page.locator('.symbol-grid .symbol-cell', { hasText: 'ω' }).first().click();
  await page.locator('.dialog__btn--primary').click();

  await expect(page.locator('.paged-editor__hidden-pm span[style*="Arial"]')).toContainText('ω', {
    timeout: 10000,
  });
});
