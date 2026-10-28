import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
  doneTasks = toSignal(this._workContextService.doneTasks$, { initialValue: [] });
  undoneTasks = toSignal(this._workContextService.undoneTasks$, { initialValue: [] });
}
