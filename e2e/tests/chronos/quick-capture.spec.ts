import { test, expect } from '../../fixtures/test.fixture';
import { flushPendingWrites } from '../../utils/waits';

test('bundled quick capture is enabled initially and creates tasks in Russian', async ({
  page,
  workViewPage,
  taskPage,
}) => {
  await workViewPage.waitForTaskList();
  await page.getByRole('menuitem', { name: 'Быстрый ввод задач', exact: true }).click();
  const dialog = page.locator('plugin-dialog');
  await expect(dialog).toContainText('Быстрый ввод задач');
  await expect(dialog.getByRole('button', { name: 'Добавить задачи' })).toBeVisible();
  await dialog.locator('#bd-input').fill('Купить тетрадь\nЗабрать посылку');
  await dialog.getByRole('button', { name: 'Добавить задачи' }).click();
  await page.goto('/#/project/INBOX_PROJECT/tasks');
  await expect(taskPage.getTaskByText('Купить тетрадь')).toHaveCount(1);
  await expect(taskPage.getTaskByText('Купить тетрадь')).toBeVisible();
  await expect(taskPage.getTaskByText('Забрать посылку')).toBeVisible();
  await flushPendingWrites(page);
  await page.reload();
  await expect(taskPage.getTaskByText('Забрать посылку')).toBeVisible();
});
