import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { map, startWith } from 'rxjs/operators';
import { DateService } from '../../core/date/date.service';
import { selectTodayStr } from '../../root-store/app-state/app-state.selectors';
import { LocaleDatePipe } from '../../ui/pipes/locale-date.pipe';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { clipChronosSession, getChronosDayWindow } from './chronos-session-journal';
import { ChronosSessionJournalService } from './chronos-session-journal.service';

@Component({
  selector: 'chronos-session-timeline',
  templateUrl: './chronos-session-timeline.component.html',
  styleUrl: './chronos-session-timeline.component.scss',
  imports: [TranslatePipe, LocaleDatePipe, MsToStringPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChronosSessionTimelineComponent {
  private readonly _date = inject(DateService);
  readonly journal = inject(ChronosSessionJournalService);
  readonly T = T;
  readonly today = inject(Store).selectSignal(selectTodayStr);
  readonly selectedDay = signal<string | null>(null);
  readonly day = computed(
    () => this.selectedDay() || this.today() || this._date.todayStr(),
  );
  private readonly _offset = toSignal(
    this._date.startOfNextDayDiffChange$.pipe(
      startWith(undefined),
      map(() => this._date.getStartOfNextDayDiffMs()),
    ),
    { initialValue: this._date.getStartOfNextDayDiffMs() },
  );
  private readonly _window = computed(() =>
    getChronosDayWindow(this.day(), this._offset()),
  );
  readonly finished = computed(() => {
    const [start, end] = this._window();
    return this.journal.entries().flatMap((entry) => {
      const clipped = clipChronosSession(entry, start, end);
      return clipped ? [clipped] : [];
    });
  });
  readonly running = computed(() => {
    const open = this.journal.open();
    const [start, end] = this._window();
    return open ? clipChronosSession(open, start, end) : null;
  });

  selectDay(event: Event): void {
    this.selectedDay.set((event.target as HTMLInputElement).value || null);
  }
}
