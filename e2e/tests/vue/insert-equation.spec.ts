import { test, expect } from '@playwright/test';

/**
 * Vue parity for Insert > Equation: the dialog opens and a typed linear
 * expression inserts a `math` node the painter renders as real math.
 */

async function openEquationDialog(page: import('@playwright/test').Page) {
  await page.locator('.docx-menu-dropdown__trigger', { hasText: 'Insert' }).click();
  await page.locator('.docx-menu-dropdown__item', { hasText: 'Equation' }).click();
}

test('Vue opens the equation dialog from the Insert menu', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });

  await openEquationDialog(page);
  await expect(page.locator('.equation-dialog .dialog__title')).toHaveText('Insert Equation');
});

test('Vue inserts a typed equation and paints it as math', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });
  await page.locator('.layout-page-content').first().click();

  await openEquationDialog(page);
  await expect(page.locator('.equation-dialog')).toBeVisible();

  await page.locator('.equation-input').fill('mc^2');
  await page.locator('.equation-insert').click();

  await expect(page.locator('.layout-run-math').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.layout-run-math .docx-math-render').first()).toContainText('mc', {
    timeout: 10000,
  });
});
