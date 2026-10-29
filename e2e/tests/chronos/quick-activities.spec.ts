import { test, expect } from '../../fixtures/test.fixture';
import {
  skipOnboardingForE2E,
  waitForAppReady,
  flushPendingWrites,
} from '../../utils/waits';
import { SettingsPage } from '../../pages/settings.page';
import { readFile } from 'node:fs/promises';

test.describe('Chronos quick activities and durable history', () => {
  test('starts, switches, stops and manages custom activities with reload persistence', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    await page.getByRole('button', { name: 'Дорога', exact: true }).click();
    await expect(
      page.locator('.quick-activity').filter({ hasText: 'Дорога' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.getByRole('button', { name: 'Еда', exact: true }).click();
    await expect(page.locator('.session-running')).toContainText('Еда');
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.locator('.quick-activity').filter({ hasText: 'Еда' }).click();
    await expect(page.locator('.session-entry')).toHaveCount(2);
    await expect(page.locator('.session-running')).toHaveCount(0);
    await page.locator('chronos-quick-activities header button').click();
    await page
      .locator('chronos-quick-activities input[name="activity"]')
      .fill('Дорога домой');
    await page.locator('chronos-quick-activities button[type="submit"]').click();
    // Read the live input value rather than relying on the HTML value attribute.
    const name = page.locator('chronos-quick-activities li input').last();
    await name.fill('Домой на электричке');
    await name.press('Tab');
    await expect(
      page.locator('.quick-activity').filter({ hasText: 'Домой на электричке' }),
    ).toBeVisible();
    await flushPendingWrites(page);
    await page.reload();
    await expect(page.locator('.session-entry')).toHaveCount(2);
    await expect(
      page.locator('.quick-activity').filter({ hasText: 'Домой на электричке' }),
    ).toBeVisible();
    await page.locator('chronos-quick-activities header button').click();
    await page.locator('chronos-quick-activities li').last().getByRole('button').click();
    await expect(
      page.locator('.quick-activity').filter({ hasText: 'Домой на электричке' }),
    ).toHaveCount(0);
    await expect(page.locator('.session-entry')).toHaveCount(2);
    await page.locator('chronos-quick-activities li').first().getByRole('button').click();
    await expect(
      page
        .locator('chronos-quick-activities')
        .getByRole('button', { name: 'Дорога', exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .locator('chronos-quick-activities')
        .getByRole('button', { name: 'Дорога', exact: true }),
    ).toHaveCount(0);
    await page.locator('chronos-quick-activities header button').click();
    await page.locator('chronos-quick-activities input[name="activity"]').fill('Дорога');
    await page.locator('chronos-quick-activities button[type="submit"]').click();
    await expect(
      page.locator('.quick-activity').filter({ hasText: 'Дорога' }),
    ).toHaveCount(1);
    await expect(
      page.locator('.recorded-task').filter({ hasText: 'Дорога' }),
    ).toHaveCount(1);
  });

  test('restores finished history and activity buttons into a fresh browser from a normal backup', async ({
    page,
    browser,
    workViewPage,
    settingsPage,
    baseURL,
  }) => {
    await workViewPage.waitForTaskList();
    await page.getByRole('button', { name: 'Дорога', exact: true }).click();
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.locator('.quick-activity').filter({ hasText: 'Дорога' }).click();
    await expect(page.locator('.session-entry')).toHaveCount(1);
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('CHRONOS_HISTORY_OUTBOX') || '{"entries":[]}')
              .entries.length,
        ),
      )
      .toBe(0);
    await flushPendingWrites(page);
    await page.goto('/#/config');
    await page
      .locator('mat-tab-header .mat-mdc-tab:has(mat-icon:has-text("cloud_sync"))')
      .click();
    await settingsPage.expandSection('.section-IMEX_YEAH');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('file-imex button:has(mat-icon:has-text("file_upload"))').click();
    const backup = await downloadPromise;
    const backupPath = await backup.path();
    expect(backupPath).toBeTruthy();
    const exported = JSON.parse(await readFile(backupPath!, 'utf8'));
    expect(
      exported.data.pluginUserData.some((record: { id: string }) =>
        record.id.startsWith('chronos-sp-core:session:'),
      ),
    ).toBe(true);
    const context = await browser.newContext({ baseURL });
    try {
      const restored = await context.newPage();
      await restored.addInitScript(skipOnboardingForE2E);
      await restored.goto('/');
      await waitForAppReady(restored);
      await expect(restored.locator('.session-entry')).toHaveCount(0);
      await restored.goto('/#/config');
      await restored
        .locator('mat-tab-header .mat-mdc-tab:has(mat-icon:has-text("cloud_sync"))')
        .click();
      await new SettingsPage(restored).expandSection('.section-IMEX_YEAH');
      await restored.locator('file-imex input[type="file"]').setInputFiles(backupPath!);
      await expect(restored).toHaveURL(/tag\/TODAY\/tasks/);
      await expect(restored.locator('.session-entry')).toHaveCount(1);
      await expect(restored.locator('.session-entry')).toContainText('Дорога');
      await expect(
        restored.locator('.quick-activity').filter({ hasText: 'Дорога' }),
      ).toBeVisible();
      await restored.reload();
      await expect(restored.locator('.session-entry')).toHaveCount(1);
      await restored.screenshot({
        path: '.tmp/chronos-durable-history.png',
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });
});
