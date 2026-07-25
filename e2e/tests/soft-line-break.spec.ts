/**
 * Soft line break (Shift+Enter) Tests
 *
 * Shift+Enter inserts a line break within the paragraph (`w:br`) and moves the
 * caret to the next line. A *trailing* break (nothing after it) must still
 * render the empty line it created — otherwise pressing Shift+Enter once appears
 * to do nothing.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';

test.describe('Soft line break (Shift+Enter)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.gotoEmpty();
    await editor.waitForReady();
    await editor.focus();
  });

  const softEnter = async (page: import('@playwright/test').Page) => {
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
  };

  test('a trailing Shift+Enter renders the new empty line', async ({ page }) => {
    await editor.typeText('AAA');
    await softEnter(page);

    // The paragraph now spans two painted lines even though nothing follows.
    await expect
      .poll(() => page.locator('.layout-paragraph').first().locator('.layout-line').count())
      .toBe(2);
  });

  test('Shift+Enter keeps text in one paragraph across two lines', async ({ page }) => {
    await editor.typeText('First');
    await softEnter(page);
    await editor.typeText('Second');

    // Still a single paragraph (one block), but two lines.
    await expect(page.locator('.layout-paragraph')).toHaveCount(1);
    await expect
      .poll(() => page.locator('.layout-paragraph').first().locator('.layout-line').count())
      .toBe(2);
    await expect(page.locator('.layout-page-content')).toContainText('First');
    await expect(page.locator('.layout-page-content')).toContainText('Second');
  });
});
