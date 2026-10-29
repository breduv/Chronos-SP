import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { TaskService } from '../tasks/task.service';
import { Task, TaskReminderOptionId } from '../tasks/task.model';
import { INBOX_PROJECT } from '../project/project.const';
import { TaskRepeatCfgService } from '../task-repeat-cfg/task-repeat-cfg.service';
import {
  DEFAULT_TASK_REPEAT_CFG,
  TASK_REPEAT_WEEKDAY_MAP,
  TaskRepeatCfg,
} from '../task-repeat-cfg/task-repeat-cfg.model';
import { selectAllTaskRepeatCfgs } from '../task-repeat-cfg/store/task-repeat-cfg.selectors';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { getDbDateStr } from '../../util/get-db-date-str';

export interface ChronosEventInput {
  title: string;
  start: string;
  end: string;
  reminder: TaskReminderOptionId;
}
export interface ChronosHabitInput {
  title: string;
  time: string;
  weekdays: number[];
  reminder: TaskReminderOptionId;
}

@Injectable({ providedIn: 'root' })
export class ChronosRoutineService {
  private readonly _tasks = inject(TaskService);
  private readonly _repeat = inject(TaskRepeatCfgService);
  private readonly _date = inject(DateService);
  private readonly _store = inject(Store);
  private readonly _configs = this._store.selectSignal(selectAllTaskRepeatCfgs);
  readonly allTasks = this._store.selectSignal(selectAllTasks);
  readonly habits = computed(() =>
    this._configs().filter((config) => config.isChronosHabit),
  );

  async addEvent(input: ChronosEventInput): Promise<string | null> {
    const start = new Date(input.start).getTime();
    const end = new Date(input.end).getTime();
    if (
      !input.title.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    )
      return null;
    return this._tasks.addAndSchedule(
      input.title.trim(),
      { projectId: INBOX_PROJECT.id, timeEstimate: end - start, hasPlannedTime: true },
      start,
      input.reminder,
      true,
    );
  }
  addHabit(input: ChronosHabitInput): string | null {
    if (
      !input.title.trim() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ||
      !input.weekdays.length
    )
      return null;
    const id = this._tasks.add(
      input.title.trim(),
      false,
      { projectId: INBOX_PROJECT.id },
      false,
      true,
    );
    const days = Object.fromEntries(
      TASK_REPEAT_WEEKDAY_MAP.map((key, day) => [key, input.weekdays.includes(day)]),
    );
    this._repeat.addTaskRepeatCfgToTask(id, INBOX_PROJECT.id, {
      ...DEFAULT_TASK_REPEAT_CFG,
      ...days,
      title: input.title.trim(),
      isChronosHabit: true,
      repeatCycle: 'WEEKLY',
      quickSetting: 'CUSTOM',
      startDate: this._date.todayStr(),
      startTime: input.time,
      remindAt: input.reminder,
      // Missed habits don't become a growing pile of overdue daily tasks.
      skipOverdue: true,
    });
    return id;
  }
  taskForHabit(config: TaskRepeatCfg, day: string): Task | undefined {
    return this.allTasks().find(
      (task) =>
        task.repeatCfgId === config.id &&
        (task.dueWithTime
          ? getDbDateStr(
              new Date(task.dueWithTime - this._date.getStartOfNextDayDiffMs()),
            )
          : task.dueDay || getDbDateStr(task.created)) === day,
    );
  }
  toggleDone(task: Task): void {
    this._tasks.update(task.id, { isDone: !task.isDone });
  }
  pauseHabit(config: TaskRepeatCfg): void {
    this._repeat.updateTaskRepeatCfg(config.id, { isPaused: !config.isPaused });
  }
}
