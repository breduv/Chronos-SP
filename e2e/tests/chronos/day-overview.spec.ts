import { test, expect } from '../../fixtures/test.fixture';

test.describe('Chronos day overview', () => {
  test('records, pauses and corrects task time with persistence after reload', async ({
    page,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();
    await workViewPage.addTask('Chronos walk');
    const task = taskPage.getTaskByText('Chronos walk');
    await task.hover();
    await task.locator('.start-task-btn').click();
    await expect(page.locator('.current-activity')).toContainText('Chronos walk');
    const recorded = page.locator('.recorded-task').filter({ hasText: 'Chronos walk' });
    await expect(recorded).toBeVisible();
    await page.locator('.current-activity button').click();
    await expect(page.locator('.current-activity')).toHaveCount(0);
    await recorded.click();
    const dialog = page.locator('dialog-time-estimate');
    const timeInput = dialog.locator('input-duration-slider input').first();
    await timeInput.fill('30m');
    await timeInput.press('Tab');
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    await expect(recorded.locator('.duration')).toHaveText('30m');
    await expect(page.locator('.day-summary')).toContainText('30m');
    await page.reload();
    await expect(recorded.locator('.duration')).toHaveText('30m');
    await expect(page.locator('.current-activity')).toHaveCount(0);
    await page.screenshot({ path: '.tmp/chronos-desktop.png', fullPage: true });
  });

  test('fits a narrow screen and keeps the original project layout', async ({
    page,
    workViewPage,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await workViewPage.waitForTaskList();
    await expect(page.locator('chronos-day-overview')).toBeVisible();
    await expect(page.locator('.recorded-panel')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({ path: '.tmp/chronos-mobile.png', fullPage: true });
    await page.goto('/#/project/INBOX_PROJECT/tasks');
    await expect(page.locator('work-view task-list').first()).toBeVisible();
    await expect(page.locator('chronos-day-overview')).toHaveCount(0);
  });
});
