import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { TaskService } from '../../features/tasks/task.service';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { selectTodayStr } from '../../root-store/app-state/app-state.selectors';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { ChronosRoutineComponent } from '../../features/chronos/chronos-routine.component';
import { ChronosQuickActivitiesComponent } from '../../features/chronos/chronos-quick-activities.component';
import { ChronosSessionTimelineComponent } from '../../features/chronos/chronos-session-timeline.component';

@Component({
  selector: 'chronos-day-overview',
  templateUrl: './chronos-day-overview.component.html',
  styleUrl: './chronos-day-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButton,
    TranslatePipe,
    MsToStringPipe,
    ChronosSessionTimelineComponent,
    ChronosQuickActivitiesComponent,
    ChronosRoutineComponent,
  ],
})
export class ChronosDayOverviewComponent {
  private readonly _store = inject(Store);
  private readonly _tasks = inject(TaskService);

  readonly T = T;
  readonly features = inject(GlobalConfigService).appFeatures;
  readonly today = this._store.selectSignal(selectTodayStr);
  private readonly _dateFormat = inject(DateTimeFormatService);
  readonly displayDay = computed(() =>
    this.today() ? this._dateFormat.formatDate(new Date(this.today() + 'T12:00:00')) : '',
  );
  readonly currentTask = toSignal(this._tasks.currentTask$, { initialValue: null });
  readonly currentTime = computed(
    () => this.currentTask()?.timeSpentOnDay[this.today() ?? ''] ?? 0,
  );

  pause(): void {
    this._tasks.pauseCurrent();
  }
}
