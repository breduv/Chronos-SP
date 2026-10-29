import { test, expect } from '../../fixtures/test.fixture';

test.describe('Chronos timer session journal', () => {
  test('keeps separate switched sessions after reload without inventing intervals from manual totals', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Chronos walk');
    await workViewPage.addTask('Chronos read');
    const walk = taskPage.getTaskByText('Chronos walk');
    const read = taskPage.getTaskByText('Chronos read');
    await walk.hover();
    await walk.locator('.start-task-btn').click();
    await expect(page.locator('.session-running')).toContainText('Chronos walk');
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await read.hover();
    await read.locator('.start-task-btn').click();
    await expect(page.locator('.session-entry:not(.session-running)')).toHaveCount(1);
    await expect(page.locator('.session-running')).toContainText('Chronos read');
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.locator('.current-activity button').click();
    await expect(page.locator('.session-running')).toHaveCount(0);
    await expect(page.locator('.session-entry')).toHaveCount(2);
    const ranges = await page.locator('.session-range').allTextContents();
    await page.reload();
    await expect(page.locator('.session-entry')).toHaveCount(2);
    expect(await page.locator('.session-range').allTextContents()).toEqual(ranges);
    await walk.locator('.time-wrapper').click();
    const dialog = page.locator('dialog-time-estimate');
    const timeInput = dialog.locator('input-duration-slider input').first();
    await timeInput.fill('30m');
    await timeInput.press('Tab');
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.session-entry')).toHaveCount(2);
    expect(await page.locator('.session-range').allTextContents()).toEqual(ranges);
    await page.locator('chronos-session-timeline').scrollIntoViewIfNeeded();
    await expect(page.locator('mat-snack-bar-container')).toHaveCount(0, {
      timeout: 35000,
    });
    await page.screenshot({ path: '.tmp/chronos-sessions-desktop.png', fullPage: true });
  });

  test('records outside Today and browses dates on a narrow screen', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await page.goto('/#/project/INBOX_PROJECT/tasks');
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Chronos project session');
    const task = taskPage.getTaskByText('Chronos project session');
    await task.hover();
    await task.locator('.start-task-btn').click();
    // The duration is a real running timer: give it a tick while Today is absent.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const open = JSON.parse(localStorage.getItem('CHRONOS_OPEN_SESSION') || 'null');
          return open ? open.end - open.start : 0;
        }),
      )
      .toBeGreaterThanOrEqual(1000);
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('.session-running')).toContainText(
      'Chronos project session',
    );
    await page.locator('.current-activity button').click();
    await expect(page.locator('.session-entry')).toHaveCount(1);
    const date = page.locator('chronos-session-timeline input[type="date"]');
    const today = await date.inputValue();
    await date.fill('2000-01-01');
    await expect(page.locator('.session-entry')).toHaveCount(0);
    await expect(page.locator('.empty-sessions')).toBeVisible();
    await date.fill(today);
    await expect(page.locator('.session-entry')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('chronos-session-timeline').scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({ path: '.tmp/chronos-sessions-mobile.png', fullPage: true });
  });
  test('keeps recorded sessions after a real rejected backup import', async ({
    page,
    workViewPage,
    taskPage,
    settingsPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Chronos preserve history');
    const task = taskPage.getTaskByText('Chronos preserve history');
    await task.hover();
    await task.locator('.start-task-btn').click();
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.locator('.current-activity button').click();
    await expect(page.locator('.session-entry')).toHaveCount(1);
    const ranges = await page.locator('.session-range').allTextContents();
    await page.goto('/#/config');
    await page
      .locator('mat-tab-header .mat-mdc-tab:has(mat-icon:has-text("cloud_sync"))')
      .click();
    await settingsPage.expandSection('.section-IMEX_YEAH');
    const refused = page.waitForEvent('console', {
      predicate: (message) => message.text().includes('Import process failed'),
    });
    await page.locator('file-imex input[type="file"]').setInputFiles({
      name: 'incomplete-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await refused;
    await page.goto('/#/tag/TODAY/tasks');
    await expect(page.locator('.session-entry')).toHaveCount(1);
    expect(await page.locator('.session-range').allTextContents()).toEqual(ranges);
    await page.reload();
    await expect(page.locator('.session-entry')).toHaveCount(1);
  });
});
