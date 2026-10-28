import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { TaskService } from '../../features/tasks/task.service';
import { Task } from '../../features/tasks/task.model';
import { selectAllTasks } from '../../features/tasks/store/task.selectors';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { selectTodayProgress } from '../../features/work-context/store/work-context.selectors';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { DialogTimeEstimateComponent } from '../../features/tasks/dialog-time-estimate/dialog-time-estimate.component';
import { selectTodayStr } from '../../root-store/app-state/app-state.selectors';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { getChronosRecordedTasks } from './chronos-recorded-tasks';

@Component({
  selector: 'chronos-day-overview',
  templateUrl: './chronos-day-overview.component.html',
  styleUrl: './chronos-day-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButton, TranslatePipe, MsToStringPipe],
})
export class ChronosDayOverviewComponent {
  private readonly _store = inject(Store);
  private readonly _tasks = inject(TaskService);
  private readonly _context = inject(WorkContextService);
  private readonly _dialog = inject(MatDialog);

  readonly T = T;
  readonly features = inject(GlobalConfigService).appFeatures;
  readonly today = this._store.selectSignal(selectTodayStr);
  readonly progress = this._store.selectSignal(selectTodayProgress);
  readonly allTasks = this._store.selectSignal(selectAllTasks);
  readonly currentTask = toSignal(this._tasks.currentTask$, { initialValue: null });
  readonly remaining = toSignal(this._context.estimateRemainingToday$, {
    initialValue: 0,
  });
  readonly archivedTime = toSignal(this._context.workingTodayArchived$, {
    initialValue: 0,
  });
  readonly recordedTasks = computed(() =>
    getChronosRecordedTasks(this.allTasks(), this.today() ?? ''),
  );
  readonly recordedTime = computed(() =>
    this.recordedTasks().reduce(
      (total, task) => total + (task.timeSpentOnDay[this.today() ?? ''] ?? 0),
      this.archivedTime(),
    ),
  );
  readonly currentTime = computed(
    () => this.currentTask()?.timeSpentOnDay[this.today() ?? ''] ?? 0,
  );

  pause(): void {
    this._tasks.pauseCurrent();
  }

  editTime(task: Task): void {
    this._dialog.open(DialogTimeEstimateComponent, { data: { task } });
  }
}
