import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { CommonModule } from '@angular/common';
import { SimpleCounterService } from '../../features/simple-counter/simple-counter.service';
import { HabitTrackerComponent } from '../../features/simple-counter/habit-tracker/habit-tracker.component';
import { ChronosRoutineComponent } from '../../features/chronos/chronos-routine.component';
import { map } from 'rxjs/operators';

@Component({
  selector: 'habit-page',
  standalone: true,
  imports: [CommonModule, HabitTrackerComponent, ChronosRoutineComponent, TranslatePipe],
  template: `
    <div class="page-wrapper">
      <chronos-routine [habitOnly]="true" />
      <details
        class="legacy-habits"
        [open]="((simpleCounters$ | async)?.length || 0) > 0"
      >
        <summary>{{ T.F.CHRONOS.UNSCHEDULED_HABITS | translate }}</summary>
        <habit-tracker
          [simpleCounters]="(simpleCounters$ | async) || []"
          [disabledSimpleCounters]="(disabledSimpleCounters$ | async) || []"
        ></habit-tracker>
      </details>
    </div>
  `,
  styles: [
    `
      .legacy-habits summary {
        cursor: pointer;
        padding-block: var(--s2);
      }
      .page-wrapper {
        padding: var(--s2);
        width: 100%;
        margin: 0 auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitPageComponent {
  readonly T = T;
  private _simpleCounterService = inject(SimpleCounterService);
  simpleCounters$ = this._simpleCounterService.enabledSimpleCounters$;
  disabledSimpleCounters$ = this._simpleCounterService.simpleCounters$.pipe(
    map((counters) => counters.filter((c) => !c.isEnabled)),
  );
}
