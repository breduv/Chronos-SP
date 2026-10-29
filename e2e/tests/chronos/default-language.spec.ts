import { test, expect } from '../../fixtures/test.fixture';
import { flushPendingWrites, waitForStatePersistence } from '../../utils/waits';

test.use({ locale: 'en-US' });

test.describe('Chronos default language', () => {
  test('starts in Russian even with an English browser', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    await expect(page.locator('.day-heading h1')).toHaveText('Мой день');
    await expect(page.locator('.recorded-panel h2')).toHaveText('Учтённое время');
    await page.reload();
    await expect(page.locator('.day-heading h1')).toHaveText('Мой день');
    await page.screenshot({ path: '.tmp/chronos-russian.png', fullPage: true });
  });

  for (const choice of ['English', 'System default']) {
    test(`preserves the explicit ${choice} choice after reload`, async ({
      page,
      workViewPage,
      settingsPage,
    }) => {
      await workViewPage.waitForTaskList();
      await expect(page.locator('.day-heading h1')).toHaveText('Мой день');
      await page.goto('/#/config');
      await settingsPage.expandSection('.section-localization');
      const language = page.locator('.section-localization mat-select').first();
      await language.click();
      await page.getByRole('option', { name: choice, exact: true }).click();
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await waitForStatePersistence(page);
      await flushPendingWrites(page);
      await page.goto('/#/tag/TODAY/tasks');
      await expect(page.locator('.day-heading h1')).toHaveText('Your day');
      await page.reload();
      await expect(page.locator('.day-heading h1')).toHaveText('Your day');
    });
  }
});
