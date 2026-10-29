import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith, map } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { T } from '../../t.const';
import { DateService } from '../../core/date/date.service';
import { selectTodayStr } from '../../root-store/app-state/app-state.selectors';
import { LocaleDatePipe } from '../../ui/pipes/locale-date.pipe';
import { TaskRepeatCfg } from '../task-repeat-cfg/task-repeat-cfg.model';
import { Task, TaskReminderOptionId } from '../tasks/task.model';
import { DialogScheduleTaskComponent } from '../planner/dialog-schedule-task/dialog-schedule-task.component';
import { ChronosRoutineService } from './chronos-routine.service';
import { getChronosDayWindow } from './chronos-session-journal';

@Component({
  selector: 'chronos-routine',
  templateUrl: './chronos-routine.component.html',
  styleUrl: './chronos-routine.component.scss',
  imports: [MatButton, TranslatePipe, LocaleDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChronosRoutineComponent {
  private readonly _date = inject(DateService);
  private readonly _dialog = inject(MatDialog);
  readonly routine = inject(ChronosRoutineService);
  readonly habitOnly = input(false);
  readonly T = T;
  readonly today = inject(Store).selectSignal(selectTodayStr);
  readonly selectedDay = signal<string | null>(null);
  readonly day = computed(
    () => this.selectedDay() || this.today() || this._date.todayStr(),
  );
  readonly mode = signal('event');
  readonly isHabit = computed(() => this.habitOnly() || this.mode() === 'habit');
  readonly name = signal('');
  readonly start = signal(this._date.todayStr() + 'T09:00');
  readonly end = signal(this._date.todayStr() + 'T10:00');
  readonly time = signal('09:00');
  readonly weekdays = signal([1, 2, 3, 4, 5]);
  readonly reminder = signal(TaskReminderOptionId.DoNotRemind);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly options = [
    { value: TaskReminderOptionId.DoNotRemind, label: T.F.CHRONOS.REMIND_NONE },
    { value: TaskReminderOptionId.AtStart, label: T.F.CHRONOS.REMIND_AT_START },
    { value: TaskReminderOptionId.m5, label: T.F.CHRONOS.REMIND_5 },
    { value: TaskReminderOptionId.m15, label: T.F.CHRONOS.REMIND_15 },
  ];
  readonly days = [
    { day: 1, label: T.F.CHRONOS.MON },
    { day: 2, label: T.F.CHRONOS.TUE },
    { day: 3, label: T.F.CHRONOS.WED },
    { day: 4, label: T.F.CHRONOS.THU },
    { day: 5, label: T.F.CHRONOS.FRI },
    { day: 6, label: T.F.CHRONOS.SAT },
    { day: 0, label: T.F.CHRONOS.SUN },
  ];
  private readonly _dayOffset = toSignal(
    this._date.startOfNextDayDiffChange$.pipe(
      startWith(undefined),
      map(() => this._date.getStartOfNextDayDiffMs()),
    ),
    { initialValue: this._date.getStartOfNextDayDiffMs() },
  );
  readonly planned = computed(() => {
    const [start, end] = getChronosDayWindow(
      this.day(),
      this._date.getStartOfNextDayDiffMs(),
    );
    return this.routine
      .allTasks()
      .filter(
        (task) =>
          !task.parentId &&
          !task.isChronosQuickActivity &&
          !!task.dueWithTime &&
          task.dueWithTime >= start &&
          task.dueWithTime < end,
      )
      .map((task) => ({
        task,
        start: task.dueWithTime!,
        end: task.dueWithTime! + task.timeEstimate,
      }))
      .sort((a, b) => a.start - b.start);
  });
  readonly habits = computed(() =>
    this.routine.habits().map((config) => ({
      config,
      task: this.routine.taskForHabit(config, this.today() || this._date.todayStr()),
    })),
  );
  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  selectDay(event: Event): void {
    const day = this.value(event);
    this.selectedDay.set(day || null);
    if (day) {
      this.start.set(day + 'T09:00');
      this.end.set(day + 'T10:00');
    }
  }
  setReminder(event: Event): void {
    this.reminder.set(this.value(event) as TaskReminderOptionId);
  }
  toggleWeekday(day: number): void {
    this.weekdays.update((days) =>
      days.includes(day) ? days.filter((value) => value !== day) : [...days, day],
    );
  }
  async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    this.error.set(false);
    try {
      const id = this.isHabit()
        ? this.routine.addHabit({
            title: this.name(),
            time: this.time(),
            weekdays: this.weekdays(),
            reminder: this.reminder(),
          })
        : await this.routine.addEvent({
            title: this.name(),
            start: this.start(),
            end: this.end(),
            reminder: this.reminder(),
          });
      if (id) this.name.set('');
      else this.error.set(true);
    } catch {
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }
  async editHabit(config: TaskRepeatCfg): Promise<void> {
    const { DialogEditTaskRepeatCfgComponent } =
      await import('../task-repeat-cfg/dialog-edit-task-repeat-cfg/dialog-edit-task-repeat-cfg.component');
    this._dialog.open(DialogEditTaskRepeatCfgComponent, { data: { repeatCfg: config } });
  }
  editTask(task: Task): void {
    this._dialog.open(DialogScheduleTaskComponent, { data: { task, minDate: null } });
  }
}
