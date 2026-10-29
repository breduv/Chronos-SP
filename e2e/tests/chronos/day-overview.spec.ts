import { test, expect } from '../../fixtures/test.fixture';
import { flushPendingWrites } from '../../utils/waits';

test.describe('Chronos day overview', () => {
  test('records and pauses activities without estimate comparison panels', async ({
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
    await expect(page.locator('.session-running .duration')).toHaveText(/[1-9]/);
    await page.locator('.current-activity button').click();
    await expect(page.locator('.current-activity')).toHaveCount(0);
    await expect(page.locator('.session-entry')).toContainText('Chronos walk');
    await expect(page.locator('.day-summary')).toHaveCount(0);
    await expect(page.locator('.recorded-panel')).toHaveCount(0);
    await flushPendingWrites(page);
    await page.reload();
    await expect(page.locator('.session-entry')).toContainText('Chronos walk');
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
    await expect(page.locator('chronos-routine')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({ path: '.tmp/chronos-mobile.png', fullPage: true });
    await page.goto('/#/project/INBOX_PROJECT/tasks');
    await expect(page.locator('work-view task-list').first()).toBeVisible();
    await expect(page.locator('chronos-day-overview')).toHaveCount(0);
  });
});
