import { toPersistableRemindOption } from '../planner/dialog-schedule-task/task-reminder-options.const';
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
import {
  selectActiveTaskRepeatCfgs,
  selectAllTaskRepeatCfgs,
} from '../task-repeat-cfg/store/task-repeat-cfg.selectors';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { getDbDateStr } from '../../util/get-db-date-str';
import { dateStrToUtcDate } from '../../util/date-str-to-utc-date';
import { isValidSplitTime } from '../../util/is-valid-split-time';
import { getTaskRepeatCfgsForExactDayCached } from '../task-repeat-cfg/store/get-task-repeat-cfgs-for-exact-day-cached.util';
import { getRepeatDueWithTime } from '../task-repeat-cfg/store/get-repeat-due-with-time.util';
import { getChronosDayWindow } from './chronos-session-journal';

export interface ChronosDayEntry {
  id: string;
  title: string;
  notes?: string;
  start: number;
  end: number;
  task?: Task;
  repeatCfg?: TaskRepeatCfg;
}

export interface ChronosEventInput {
  title: string;
  notes?: string;
  start: string;
  end: string;
  reminder: TaskReminderOptionId;
}
export interface ChronosHabitInput {
  title: string;
  notes?: string;
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
  private readonly _activeConfigs = this._store.selectSignal(selectActiveTaskRepeatCfgs);
  readonly allTasks = this._store.selectSignal(selectAllTasks);
  readonly habits = computed(() =>
    this._configs().filter((config) => config.isChronosHabit),
  );

  isEvent(task: Task): boolean {
    // Timed recurring instances inherit their duration, but not hasPlannedTime.
    return task.timeEstimate > 0 && (!!task.hasPlannedTime || !!task.repeatCfgId);
  }
  entriesForDay(day: string, dayOffset: number): ChronosDayEntry[] {
    const [start, end] = getChronosDayWindow(day, dayOffset);
    const tasks = this.allTasks();
    const entries: ChronosDayEntry[] = tasks
      .filter(
        (task) =>
          !task.parentId &&
          !task.isChronosQuickActivity &&
          !!task.dueWithTime &&
          task.dueWithTime >= start &&
          task.dueWithTime < end,
      )
      .map((task) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        task,
        start: task.dueWithTime!,
        end: task.dueWithTime! + (this.isEvent(task) ? task.timeEstimate : 0),
      }));
    // A past day is a record of real instances, never a reconstruction from today's rule.
    if (day >= this._date.todayStr()) {
      const covered = new Set(
        tasks
          .filter(
            (task) =>
              task.repeatCfgId &&
              (task.dueWithTime
                ? task.dueWithTime >= start && task.dueWithTime < end
                : task.dueDay === day),
          )
          .map((task) => task.repeatCfgId),
      );
      const logicalDate = dateStrToUtcDate(day).getTime();
      for (const repeatCfg of getTaskRepeatCfgsForExactDayCached(
        this._activeConfigs(),
        logicalDate,
      )) {
        if (
          covered.has(repeatCfg.id) ||
          !repeatCfg.startTime ||
          !isValidSplitTime(repeatCfg.startTime)
        )
          continue;
        const repeatStart = getRepeatDueWithTime(
          repeatCfg.startTime,
          logicalDate,
          dayOffset,
        );
        entries.push({
          id: 'repeat:' + repeatCfg.id,
          title: repeatCfg.title || '',
          notes: repeatCfg.notes,
          repeatCfg,
          start: repeatStart,
          end: repeatStart + (repeatCfg.defaultEstimate || 0),
        });
      }
    }
    return entries.sort((a, b) => a.start - b.start);
  }
  repeatForTask(task: Task): TaskRepeatCfg | undefined {
    return this._configs().find((config) => config.id === task.repeatCfgId);
  }
  updateTask(task: Task, input: Omit<ChronosEventInput, 'end'>): boolean {
    const start = new Date(input.start).getTime();
    if (!input.title.trim() || !Number.isFinite(start)) return false;
    this._tasks.update(task.id, {
      title: input.title.trim(),
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
    });
    this._reschedule(task, start, input.reminder);
    return true;
  }
  private _reschedule(task: Task, start: number, reminder: TaskReminderOptionId): void {
    if (reminder === TaskReminderOptionId.DoNotRemind && task.remindAt !== undefined) {
      this._store.dispatch(TaskSharedActions.dismissReminderOnly({ id: task.id }));
    }
    this._tasks.scheduleTask(task, start, reminder, false);
  }
  async addTask(input: Omit<ChronosEventInput, 'end'>): Promise<string | null> {
    const start = new Date(input.start).getTime();
    if (!input.title.trim() || !Number.isFinite(start)) return null;
    return this._tasks.addAndSchedule(
      input.title.trim(),
      {
        projectId: INBOX_PROJECT.id,
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      },
      start,
      input.reminder,
      true,
    );
  }
  updateEvent(task: Task, input: ChronosEventInput): boolean {
    const start = new Date(input.start).getTime();
    const end = new Date(input.end).getTime();
    if (
      !input.title.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    )
      return false;
    this._tasks.update(task.id, {
      title: input.title.trim(),
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      timeEstimate: end - start,
      hasPlannedTime: true,
    });
    this._reschedule(task, start, input.reminder);
    return true;
  }
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
      {
        projectId: INBOX_PROJECT.id,
        timeEstimate: end - start,
        hasPlannedTime: true,
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      },
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
      {
        projectId: INBOX_PROJECT.id,
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      },
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
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      repeatCycle: 'WEEKLY',
      quickSetting: 'CUSTOM',
      startDate: this._date.todayStr(),
      startTime: input.time,
      remindAt: toPersistableRemindOption(input.reminder),
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
