/**
 * Insert Equation Tests
 *
 * Covers the Insert > Equation flow: the dialog opens, a linear (LaTeX-style)
 * expression is inserted as a `math` node, and the painter renders it as real
 * math (not fallback text).
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Insert Equation', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.gotoEmpty();
    await editor.waitForReady();
    await editor.focus();
  });

  async function openEquationDialog(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await page.getByRole('button', { name: 'Equation', exact: true }).click();
  }

  test('opens the equation dialog from the Insert menu', async ({ page }) => {
    await openEquationDialog(page);
    await expect(page.getByText('Insert Equation', { exact: true })).toBeVisible({
      timeout: 10000,
    });
  });

  test('inserts a typed equation and paints it as math', async ({ page }) => {
    await editor.typeText('E=');
    await openEquationDialog(page);
    await expect(page.getByText('Insert Equation', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await page.locator('.docx-equation-dialog textarea').fill('mc^2');
    await page.locator('.docx-equation-insert').click();

    // The painter emits a math run (real layout), not a plain text fallback.
    await expect(page.locator('.layout-run-math').first()).toBeVisible({ timeout: 10000 });
    // The rendered math contains its content.
    await expect(page.locator('.layout-run-math .docx-math-render').first()).toContainText('mc', {
      timeout: 10000,
    });
  });

  test('inserts a fraction from the gallery', async ({ page }) => {
    await openEquationDialog(page);
    await expect(page.getByText('Insert Equation', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Quadratic formula' }).click();
    await page.locator('.docx-equation-insert').click();

    await expect(page.locator('.layout-run-math').first()).toBeVisible({ timeout: 10000 });
  });
});
