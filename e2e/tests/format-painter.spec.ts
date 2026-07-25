/**
 * Format Painter Tests
 *
 * Copy character formatting from one selection and paint it onto another,
 * like Word. Single click = paint once; double-click the button = sticky.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import { assertTextIsBold } from '../helpers/assertions';

const painterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Format Painter/ });

test.describe('Format Painter', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.gotoEmpty();
    await editor.waitForReady();
    await editor.focus();
  });

  test('copies bold from one word and paints it onto another (single use)', async ({ page }) => {
    await editor.typeText('Alpha Bravo');

    // Make "Alpha" bold.
    await editor.selectText('Alpha');
    await editor.applyBold();
    await assertTextIsBold(page, 'Alpha');

    // Copy Alpha's formatting, then paint it onto Bravo by double-clicking it
    // (a real mouse gesture that selects the word and releases the mouse).
    await editor.selectText('Alpha');
    await painterButton(page).click();
    await expect(painterButton(page)).toHaveAttribute('data-active', 'true');

    await page.locator('.layout-page-content').getByText('Bravo', { exact: false }).dblclick();

    await assertTextIsBold(page, 'Bravo');
    // Single use: the painter disarms after one paint.
    await expect(painterButton(page)).not.toHaveAttribute('data-active', 'true');
  });

  test('sticky mode (double-click the button) paints multiple selections', async ({ page }) => {
    // Separate lines so each word is its own painted span (unambiguous target).
    await editor.typeText('One');
    await page.keyboard.press('Enter');
    await editor.typeText('Two');
    await page.keyboard.press('Enter');
    await editor.typeText('Three');

    await editor.selectText('One');
    await editor.applyBold();

    // Double-click the button → sticky.
    await editor.selectText('One');
    await painterButton(page).dblclick();
    await expect(painterButton(page)).toHaveAttribute('data-active', 'true');

    await page.locator('.layout-page-content').getByText('Two', { exact: true }).dblclick();
    await assertTextIsBold(page, 'Two');
    // Still armed in sticky mode.
    await expect(painterButton(page)).toHaveAttribute('data-active', 'true');

    await page.locator('.layout-page-content').getByText('Three', { exact: true }).dblclick();
    await assertTextIsBold(page, 'Three');

    // Escape cancels sticky mode.
    await page.keyboard.press('Escape');
    await expect(painterButton(page)).not.toHaveAttribute('data-active', 'true');
  });
});
