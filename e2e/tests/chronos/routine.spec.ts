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
    await routine.locator('.routine-notes').fill('Аудитория 204. Взять тетрадь.');
    await routine.locator('.event-start').fill('2099-01-05T09:00');
    await routine.locator('.event-end').fill('2099-01-05T10:30');
    await routine.locator('.routine-reminder').selectOption('m15');
    await routine.locator('button[type="submit"]').click();
    const event = routine
      .locator('.planned-slots li')
      .filter({ hasText: 'Пара по математике' });
    await expect(event).toContainText('09:00');
    await expect(event).toContainText('10:30');
    await event.getByRole('button', { name: 'Подробности', exact: true }).click();
    await expect(event.locator('.entry-notes')).toHaveText(
      'Аудитория 204. Взять тетрадь.',
    );
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
    await event.locator('.edit-entry').click();
    await expect(routine.locator('.routine-notes')).toHaveValue(
      'Аудитория 204. Взять тетрадь.',
    );
    await routine.locator('.routine-notes').fill('Аудитория 305.');
    await routine.locator('.event-end').fill('2099-01-05T11:15');
    await routine.locator('button[type="submit"]').click();
    await expect(event).toContainText('11:15');
    await flushPendingWrites(page);
    await page.reload();
    await routine.locator('.routine-day').fill('2099-01-05');
    await expect(event).toContainText('11:15');
    await event.getByRole('button', { name: 'Подробности', exact: true }).click();
    await expect(event.locator('.entry-notes')).toHaveText('Аудитория 305.');
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
    await task.locator('.edit-entry').click();
    await expect(routine.locator('.event-end')).toHaveCount(0);
    await routine.locator('.routine-notes').fill('Уточнить адрес');
    await routine.locator('.event-start').fill('2099-01-05T15:00');
    await routine.locator('button[type="submit"]').click();
    await expect(task).toContainText('15:00');
    await task.getByRole('button', { name: 'Подробности', exact: true }).click();
    await expect(task.locator('.entry-notes')).toHaveText('Уточнить адрес');
  });
  test('shares the selected day between schedule, history and heading', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    const routine = page.locator('chronos-routine');
    const historyDate = page.locator('chronos-session-timeline input[type="date"]');
    const today = await routine.locator('.routine-day').inputValue();
    await routine.locator('.routine-day').fill('2099-01-05');
    await expect(historyDate).toHaveValue('2099-01-05');
    await expect(page.locator('.day-date')).toHaveText('05.01.2099');
    await expect(page.locator('.day-plan')).toHaveCount(0);
    await historyDate.fill('2000-02-10');
    await expect(routine.locator('.routine-day')).toHaveValue('2000-02-10');
    await routine.locator('mat-expansion-panel-header').click();
    await expect(routine.locator('.event-start')).toHaveValue('2000-02-10T09:00');
    await page
      .locator('.day-heading')
      .getByRole('button', { name: 'Сегодня', exact: true })
      .click();
    await expect(historyDate).toHaveValue(today);
    await expect(routine.locator('.routine-day')).toHaveValue(today);
    await expect(page.locator('.day-plan')).toBeVisible();
  });
  test('configures a class every other week through native repeat settings', async ({
    page,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();
    const routine = page.locator('chronos-routine');
    await routine.locator('.routine-day').fill('2099-01-05');
    await routine.locator('mat-expansion-panel-header').click();
    await routine.locator('.routine-name').fill('Семинар');
    await routine.locator('.routine-notes').fill('Корпус 2');
    await routine.locator('button[type="submit"]').click();
    const entry = routine.locator('.planned-slots li').filter({ hasText: 'Семинар' });
    await entry.locator('.edit-repeat').click();
    const dialog = page.locator('dialog-edit-task-repeat-cfg');
    await dialog.locator('mat-select').first().click();
    await page.getByRole('option', { name: 'Выборочная настройка', exact: true }).click();
    await dialog.locator('.repeat-cycle input').fill('2');
    await dialog.locator('.repeat-cycle mat-select').click();
    await page.getByRole('option', { name: 'Недели', exact: true }).click();
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    await flushPendingWrites(page);
    await page.reload();
    await routine.locator('.routine-day').fill('2099-01-05');
    await entry.locator('.edit-repeat').click();
    await expect(dialog.locator('.repeat-cycle input')).toHaveValue('2');
    await expect(dialog.locator('.repeat-cycle mat-select')).toContainText('Недели');
    await page.screenshot({ path: '.tmp/chronos-repeat.png', fullPage: true });
    await page.keyboard.press('Escape');
    await routine.locator('.routine-day').fill('2099-01-19');
    await expect(entry).toContainText('09:00');
    await expect(entry).toContainText('10:00');
    await expect(entry).toContainText('По расписанию');
    await entry.getByRole('button', { name: 'Подробности', exact: true }).click();
    await expect(entry.locator('.entry-notes')).toHaveText('Корпус 2');
    await routine.locator('.routine-day').fill('2099-01-12');
    await expect(entry).toHaveCount(0);
  });
});
