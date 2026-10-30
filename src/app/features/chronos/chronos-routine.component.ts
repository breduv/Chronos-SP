import {
  TASK_REMINDER_OPTIONS,
  toPersistableRemindOption,
  TASK_REMINDER_OPTIONS_WITHOUT_LONG_LEAD,
} from '../planner/dialog-schedule-task/task-reminder-options.const';
import { millisecondsDiffToRemindOption } from '../tasks/util/remind-option-to-milliseconds';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  effect,
  untracked,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith, map } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
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
import { MarkdownComponent } from 'ngx-markdown';
import { ChronosRoutineService } from './chronos-routine.service';

@Component({
  selector: 'chronos-routine',
  templateUrl: './chronos-routine.component.html',
  styleUrl: './chronos-routine.component.scss',
  imports: [
    MatButton,
    TranslatePipe,
    LocaleDatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatExpansionModule,
    MarkdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChronosRoutineComponent {
  private readonly _date = inject(DateService);
  private readonly _dialog = inject(MatDialog);
  readonly routine = inject(ChronosRoutineService);
  readonly habitOnly = input(false);
  readonly T = T;
  readonly today = inject(Store).selectSignal(selectTodayStr);
  readonly selectedDay = model<string | null>(null);
  readonly day = computed(
    () => this.selectedDay() || this.today() || this._date.todayStr(),
  );
  readonly mode = signal('event');
  readonly expanded = signal(false);
  readonly editing = signal<Task | null>(null);
  readonly isHabit = computed(() => this.habitOnly() || this.mode() === 'habit');
  readonly name = signal('');
  readonly notes = signal('');
  readonly notesOpen = signal<string | null>(null);
  readonly start = signal(this._date.todayStr() + 'T09:00');
  readonly end = signal(this._date.todayStr() + 'T10:00');
  readonly time = signal('09:00');
  readonly weekdays = signal([1, 2, 3, 4, 5]);
  readonly reminder = signal(TaskReminderOptionId.DoNotRemind);
  readonly error = signal(false);
  readonly saving = signal(false);
  constructor() {
    effect(() => {
      const day = this.day();
      untracked(() => {
        this.start.set(day + 'T09:00');
        this.end.set(day + 'T10:00');
        this.cancelEdit();
      });
    });
  }
  readonly options = computed(() =>
    this.isHabit() ? TASK_REMINDER_OPTIONS_WITHOUT_LONG_LEAD : TASK_REMINDER_OPTIONS,
  );
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
  readonly planned = computed(() =>
    this.routine.entriesForDay(this.day(), this._dayOffset()),
  );
  readonly habits = computed(() =>
    this.routine.habits().map((config) => ({
      config,
      task: this.routine.taskForHabit(config, this.day()),
    })),
  );
  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  selectDay(event: Event): void {
    const day = this.value(event);
    this.selectedDay.set(day || null);
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
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(false);
    try {
      const eventInput = {
        title: this.name(),
        notes: this.notes(),
        start: this.start(),
        end: this.end(),
        reminder: this.reminder(),
      };
      const editing = this.editing();
      const id = editing
        ? this.mode() === 'task'
          ? this.routine.updateTask(editing, eventInput)
          : this.routine.updateEvent(editing, eventInput)
        : this.mode() === 'task' && !this.habitOnly()
          ? await this.routine.addTask(eventInput)
          : this.isHabit()
            ? this.routine.addHabit({
                title: this.name(),
                notes: this.notes(),
                time: this.time(),
                weekdays: this.weekdays(),
                reminder: this.reminder(),
              })
            : await this.routine.addEvent(eventInput);
      if (id) {
        this.name.set('');
        this.notes.set('');
        this.editing.set(null);
      } else this.error.set(true);
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
    if (!task.dueWithTime) return;
    const local = (value: number): string => {
      const date = new Date(value);
      const offsetMs = date.getTimezoneOffset() * 60000;
      return new Date(value - offsetMs).toISOString().slice(0, 16);
    };
    this.editing.set(task);
    this.mode.set(this.routine.isEvent(task) ? 'event' : 'task');
    this.name.set(task.title);
    this.notes.set(task.notes || '');
    this.start.set(local(task.dueWithTime));
    this.end.set(local(task.dueWithTime + task.timeEstimate));
    this.reminder.set(millisecondsDiffToRemindOption(task.dueWithTime, task.remindAt));
    this.error.set(false);
    this.expanded.set(true);
  }
  async editRepeat(task: Task): Promise<void> {
    const { DialogEditTaskRepeatCfgComponent } =
      await import('../task-repeat-cfg/dialog-edit-task-repeat-cfg/dialog-edit-task-repeat-cfg.component');
    this._dialog.open(DialogEditTaskRepeatCfgComponent, {
      data: {
        task,
        repeatCfg: this.routine.repeatForTask(task),
        defaultRemindOption: toPersistableRemindOption(
          millisecondsDiffToRemindOption(task.dueWithTime || 0, task.remindAt),
        ),
      },
    });
  }
  cancelEdit(): void {
    this.editing.set(null);
    this.name.set('');
    this.notes.set('');
    this.error.set(false);
  }
}
