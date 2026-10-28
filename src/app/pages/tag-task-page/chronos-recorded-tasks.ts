import { Task } from '../../features/tasks/task.model';

// Parents already contain their children's time. Match WorkContextService's
// day total and keep the stored order stable while the timer ticks.
export const getChronosRecordedTasks = (tasks: Task[], day: string): Task[] =>
  tasks.filter((task) => !task.parentId && (task.timeSpentOnDay[day] ?? 0) > 0);
