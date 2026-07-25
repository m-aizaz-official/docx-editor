import { test, expect } from '@playwright/test';
import { assertTextIsBold } from '../../helpers/assertions';

/**
 * Vue parity for Format Painter: copy character formatting from one selection
 * and paint it onto another (double-click a word = a real select + release).
 */

const painterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Format Painter/ });

test('Vue copies bold from one word and paints it onto another', async ({ page }) => {
  await page.goto('http://localhost:5174/?e2e=1&empty=1');
  await page.waitForSelector('.docx-editor-vue__pages .layout-page', { timeout: 15000 });
  await page.locator('.layout-page-content').first().click();
  await page.keyboard.type('Alpha Bravo');

  // Bold "Alpha".
  await page.locator('.layout-page-content').getByText('Alpha', { exact: false }).dblclick();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await assertTextIsBold(page, 'Alpha');

  // Copy Alpha's formatting and paint onto Bravo.
  await page.locator('.layout-page-content').getByText('Alpha', { exact: false }).dblclick();
  await painterButton(page).click();
  await expect(painterButton(page)).toHaveAttribute('data-active', 'true');

  await page.locator('.layout-page-content').getByText('Bravo', { exact: false }).dblclick();
  await assertTextIsBold(page, 'Bravo');
  await expect(painterButton(page)).not.toHaveAttribute('data-active', 'true');
});
