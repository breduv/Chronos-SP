import { test, expect } from '../../fixtures/test.fixture';
import { flushPendingWrites } from '../../utils/waits';

test.describe('Chronos day schedule and habit reminders', () => {
  test('creates a fixed time slot on a selected day without inventing actual time', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    const routine = page.locator('chronos-routine');
    await routine.locator('.routine-day').fill('2099-01-05');
    await routine.locator('mat-expansion-panel-header').click();
    await routine.locator('.routine-name').fill('Пара по математике');
    await routine.locator('.event-start').fill('2099-01-05T09:00');
    await routine.locator('.event-end').fill('2099-01-05T10:30');
    await routine.locator('.routine-reminder').selectOption('m15');
    await routine.locator('button[type="submit"]').click();
    const event = routine
      .locator('.planned-slots li')
      .filter({ hasText: 'Пара по математике' });
    await expect(event).toContainText('09:00');
    await expect(event).toContainText('10:30');
    await expect(page.locator('.session-entry')).toHaveCount(0);
    await flushPendingWrites(page);
    await page.reload();
    await routine.locator('.routine-day').fill('2099-01-05');
    await expect(event).toContainText('10:30');
    await page.setViewportSize({ width: 390, height: 844 });
    await routine.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    await page.screenshot({ path: '.tmp/chronos-routine-mobile.png', fullPage: true });
    await event.getByRole('button').click();
    await routine.locator('.event-end').fill('2099-01-05T11:15');
    await routine.locator('button[type="submit"]').click();
    await expect(event).toContainText('11:15');
    await flushPendingWrites(page);
    await page.reload();
    await routine.locator('.routine-day').fill('2099-01-05');
    await expect(event).toContainText('11:15');
  });

  test('creates a habit with weekdays and a reminder, marks it done and pauses the series', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    await page.goto('/#/habits');
    const routine = page.locator('habit-page chronos-routine');
    await routine.locator('mat-expansion-panel-header').click();
    await routine.locator('.routine-name').fill('Читать перед сном');
    await routine.locator('.habit-time').fill('23:59');
    for (const box of await routine.locator('fieldset input[type="checkbox"]').all())
      await box.check();
    await routine.locator('.routine-reminder').selectOption('AtStart');
    await routine.locator('button[type="submit"]').click();
    const habit = routine
      .locator('.scheduled-habits li')
      .filter({ hasText: 'Читать перед сном' });
    await expect(habit).toContainText('23:59');
    await habit.getByRole('button', { name: 'Выполнить', exact: true }).click();
    await expect(
      habit.getByRole('button', { name: 'Выполнено', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await habit.getByRole('button', { name: 'Приостановить', exact: true }).click();
    await expect(
      habit.getByRole('button', { name: 'Возобновить', exact: true }),
    ).toBeVisible();
    await flushPendingWrites(page);
    await page.reload();
    await expect(habit).toContainText('Выполнено');
    await expect(habit).toContainText('Возобновить');
    await page.screenshot({ path: '.tmp/chronos-habits.png', fullPage: true });
  });
  test('delivers an opt-in event reminder through the real reminder worker', async ({
    page,
    workViewPage,
  }) => {
    test.setTimeout(60000);
    await workViewPage.waitForTaskList();
    const times = await page.evaluate(() => {
      const start = new Date();
      start.setSeconds(0, 0);
      start.setMinutes(start.getMinutes() - 1);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      const format = (date: Date): string => {
        const pad = (value: number): string => String(value).padStart(2, '0');
        return (
          date.getFullYear() +
          '-' +
          pad(date.getMonth() + 1) +
          '-' +
          pad(date.getDate()) +
          'T' +
          pad(date.getHours()) +
          ':' +
          pad(date.getMinutes())
        );
      };
      return { start: format(start), end: format(end) };
    });
    const routine = page.locator('tag-task-page chronos-routine');
    await routine.locator('mat-expansion-panel-header').click();
    await routine.locator('.routine-name').fill('Напомнить о занятии');
    await routine.locator('.event-start').fill(times.start);
    await routine.locator('.event-end').fill(times.end);
    await routine.locator('.routine-reminder').selectOption('AtStart');
    await routine.locator('button[type="submit"]').click();
    await expect(page.locator('dialog-view-task-reminder')).toContainText(
      'Напомнить о занятии',
      { timeout: 30000 },
    );
  });
  test('adds a reminder task without an end time', async ({ page, workViewPage }) => {
    await workViewPage.waitForTaskList();
    const routine = page.locator('chronos-routine');
    await routine.locator('.routine-day').fill('2099-01-05');
    await routine.locator('mat-expansion-panel-header').click();
    await routine.locator('.routine-kind').selectOption('task');
    await routine.locator('.routine-name').fill('Позвонить');
    await expect(routine.locator('.event-end')).toHaveCount(0);
    await routine.locator('.event-start').fill('2099-01-05T14:00');
    await routine.locator('.routine-reminder').selectOption('AtStart');
    await routine.locator('button[type="submit"]').click();
    const task = routine.locator('.planned-slots li').filter({ hasText: 'Позвонить' });
    await expect(task).toContainText('14:00');
    await expect(task).not.toContainText('—');
    await flushPendingWrites(page);
    await page.reload();
    await routine.locator('.routine-day').fill('2099-01-05');
    await expect(task).toBeVisible();
  });
});
