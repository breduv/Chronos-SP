import { DEFAULT_TASK, Task } from '../../features/tasks/task.model';
import { getChronosRecordedTasks } from './chronos-recorded-tasks';

describe('getChronosRecordedTasks', () => {
  const day = '2026-10-28';
  const task = (id: string, updates: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    projectId: 'INBOX_PROJECT',
    id,
    title: id,
    ...updates,
  });

  it('includes unscheduled and completed tasks worked on the selected day', () => {
    const tasks = [
      task('unscheduled', { timeSpentOnDay: { [day]: 1000 } }),
      task('done', { isDone: true, timeSpentOnDay: { [day]: 2000 } }),
      task('yesterday', { timeSpentOnDay: { ['2026-10-27']: 3000 } }),
      task('empty'),
    ];
    expect(getChronosRecordedTasks(tasks, day).map((t) => t.id)).toEqual([
      'unscheduled',
      'done',
    ]);
  });

  it('does not double count subtasks included in their parent total', () => {
    const parent = task('parent', {
      subTaskIds: ['child'],
      timeSpentOnDay: { [day]: 2000 },
    });
    const child = task('child', {
      parentId: 'parent',
      timeSpentOnDay: { [day]: 2000 },
    });
    expect(getChronosRecordedTasks([parent, child], day)).toEqual([parent]);
  });

  it('preserves task order and leaves the source unchanged', () => {
    const first = task('first', { timeSpentOnDay: { [day]: 1000 } });
    const second = task('second', { timeSpentOnDay: { [day]: 9000 } });
    const tasks = [first, second];
    expect(getChronosRecordedTasks(tasks, day)).toEqual([first, second]);
    expect(tasks).toEqual([first, second]);
  });

  it('updates the day without carrying over earlier time', () => {
    const tasks = [task('today', { timeSpentOnDay: { [day]: 1000 } })];
    expect(getChronosRecordedTasks(tasks, '2026-10-29')).toEqual([]);
  });
});
