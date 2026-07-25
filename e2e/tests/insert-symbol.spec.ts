/**
 * Insert Symbol Tests
 *
 * Covers the Insert > Symbol menu entry that was wired to the existing
 * InsertSymbolDialog: opening the dialog and inserting a special character
 * at the cursor.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Insert Symbol', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.gotoEmpty();
    await editor.waitForReady();
    await editor.focus();
  });

  async function openSymbolDialog(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await page.getByRole('button', { name: 'Symbol', exact: true }).click();
  }

  test('opens the symbol dialog from the Insert menu', async ({ page }) => {
    await openSymbolDialog(page);
    await expect(page.getByText('Insert Symbol', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('inserts a chosen symbol at the cursor', async ({ page }) => {
    await editor.typeText('x');
    await openSymbolDialog(page);
    await expect(page.getByText('Insert Symbol', { exact: true })).toBeVisible({ timeout: 10000 });

    // Filter to a deterministic glyph (ω, U+03C9) via the search box, select
    // it, then click the footer Insert button. (Search lowercases the query.)
    await page.getByPlaceholder('Search symbols', { exact: false }).fill('ω');
    await page.getByRole('button', { name: 'ω', exact: true }).first().click();
    await page.locator('.docx-insert-symbol-dialog-insert').click();

    // The character lands in the hidden body ProseMirror doc.
    await expect(page.locator('.paged-editor__hidden-pm')).toContainText('ω', {
      timeout: 10000,
    });
  });

  test('inserts a special character from the Special Characters tab', async ({ page }) => {
    await editor.typeText('x');
    await openSymbolDialog(page);
    await expect(page.getByText('Insert Symbol', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Special Characters', exact: true }).click();
    // Em Dash row → double-click inserts it.
    await page
      .getByRole('button', { name: /Em Dash/ })
      .first()
      .dblclick();

    await expect(page.locator('.paged-editor__hidden-pm')).toContainText('—', { timeout: 10000 });
  });

  test('inserts a symbol carrying the chosen font', async ({ page }) => {
    await editor.typeText('x');
    await openSymbolDialog(page);
    await expect(page.getByText('Insert Symbol', { exact: true })).toBeVisible({ timeout: 10000 });

    // Pick a font, then insert a glyph — it should carry that font-family.
    await page.locator('#insert-symbol-font').selectOption('Arial');
    await page.getByPlaceholder('Search symbols', { exact: false }).fill('ω');
    await page.getByRole('button', { name: 'ω', exact: true }).first().click();
    await page.locator('.docx-insert-symbol-dialog-insert').click();

    // The inserted run carries a font-family in the hidden PM.
    await expect(page.locator('.paged-editor__hidden-pm span[style*="Arial"]')).toContainText('ω', {
      timeout: 10000,
    });
  });
});
