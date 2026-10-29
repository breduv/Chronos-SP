import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChronosDayOverviewComponent } from './chronos-day-overview.component';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { TaskListComponent } from '../../features/tasks/task-list/task-list.component';
import { WorkViewComponent } from '../../features/work-view/work-view.component';

@Component({
  selector: 'tag-task-page',
  templateUrl: './tag-task-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WorkViewComponent,
    ChronosDayOverviewComponent,
    TaskListComponent,
    CdkDropListGroup,
    TranslatePipe,
  ],
  host: { ['[style.overflow-y]']: "isToday() ? 'auto' : null" },
})
export class TagTaskPageComponent {
  private _workContextService = inject(WorkContextService);

  readonly T = T;
  readonly isToday = this._workContextService.isTodayListSignal;

  backlogTasks = toSignal(this._workContextService.backlogTasks$, { initialValue: [] });
  private _doneTasks = toSignal(this._workContextService.doneTasks$, {
    initialValue: [],
  });
  private _undoneTasks = toSignal(this._workContextService.undoneTasks$, {
    initialValue: [],
  });
  readonly undoneTasks = computed(() =>
    this.isToday()
      ? this._undoneTasks().filter((task) => !task.isChronosQuickActivity)
      : this._undoneTasks(),
  );
  readonly doneTasks = computed(() =>
    this.isToday()
      ? this._doneTasks().filter((task) => !task.isChronosQuickActivity)
      : this._doneTasks(),
  );
}
