import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { createEffect, ofType } from '@ngrx/effects';
import { combineLatest, defer, merge, from, EMPTY } from 'rxjs';
import { catchError, exhaustMap, filter, tap, withLatestFrom } from 'rxjs/operators';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { DateService } from '../../core/date/date.service';
import { ImexViewService } from '../../imex/imex-meta/imex-view.service';
import { loadAllData } from '../../root-store/meta/load-all-data.action';
import { skipDuringSyncWindow } from '../../util/skip-during-sync-window.operator';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { selectCurrentTask } from '../tasks/store/task.selectors';
import { removeTimeSpent } from '../tasks/store/task.actions';
import { ChronosSessionJournalService } from './chronos-session-journal.service';

@Injectable()
export class ChronosSessionJournalEffects {
  private readonly _store = inject(Store);
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _clock = inject(GlobalTrackingIntervalService);
  private readonly _date = inject(DateService);
  private readonly _imex = inject(ImexViewService);
  private readonly _journal = inject(ChronosSessionJournalService);

  /** The current-task pointer is local. Observe remote deletion as a real stop,
   * observation writes only the local checkpoint/outbox, not synced state. */
  publishSessions$ = createEffect(
    () =>
      merge(this._clock.tick$, this._actions$).pipe(
        skipDuringSyncWindow(),
        filter(() => !this._imex.isDataImportInProgress),
        exhaustMap(() =>
          from(this._journal.publishPending()).pipe(catchError(() => EMPTY)),
        ),
      ),
    { dispatch: false },
  );

  recordSessions$ = createEffect(
    () =>
      defer(() => {
        this._journal.recover();
        return merge(
          combineLatest([
            this._store.select(selectCurrentTask),
            this._imex.isDataImportInProgress$,
          ]).pipe(
            tap(([task]) =>
              this._journal.observe(
                this._imex.isDataImportInProgress ? null : task,
                Date.now(),
              ),
            ),
          ),
          this._clock.tick$.pipe(
            withLatestFrom(this._imex.isDataImportInProgress$),
            filter(([, isImporting]) => !isImporting),
            tap(([tick]) => this._journal.tick(tick.duration, tick.timestamp)),
          ),
          this._actions$.pipe(
            ofType(removeTimeSpent),
            tap(({ id, date, duration }) =>
              this._journal.removeTime(
                id,
                date,
                duration,
                this._date.getStartOfNextDayDiffMs(),
              ),
            ),
          ),
          this._actions$.pipe(
            ofType(loadAllData),
            withLatestFrom(this._imex.isDataImportInProgress$),
            filter(([, isImporting]) => isImporting),
            tap(() => this._journal.clear()),
          ),
        );
      }),
    { dispatch: false },
  );
}
