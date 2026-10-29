import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject, Subscription } from 'rxjs';
import { Action } from '@ngrx/store';
import { ChronosSessionJournalEffects } from './chronos-session-journal.effects';
import { ChronosSessionJournalService } from './chronos-session-journal.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { Tick } from '../../core/global-tracking-interval/tick.model';
import { DateService } from '../../core/date/date.service';
import { ImexViewService } from '../../imex/imex-meta/imex-view.service';
import { loadAllData } from '../../root-store/meta/load-all-data.action';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { ChronosHistoryService } from './chronos-history.service';
import { signal } from '@angular/core';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { SyncTriggerService } from '../../imex/sync/sync-trigger.service';
import { HydrationStateService } from '../../op-log/apply/hydration-state.service';
import { OperationCaptureService } from '../../op-log/capture/operation-capture.service';
import { LS } from '../../core/persistence/storage-keys.const';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { selectCurrentTask } from '../tasks/store/task.selectors';
import { removeTimeSpent } from '../tasks/store/task.actions';

const START = new Date('2026-10-28T10:00:00').getTime();
const task = (id: string): Task => ({
  ...DEFAULT_TASK,
  id,
  title: id,
  projectId: 'INBOX_PROJECT',
});

describe('ChronosSessionJournalEffects', () => {
  let store: MockStore;
  let journal: ChronosSessionJournalService;
  let ticks: Subject<Tick>;
  let actions: Subject<Action>;
  let subscription: Subscription;
  let imex: ImexViewService;
  const setCurrent = (current: Task | null): void => {
    store.overrideSelector(selectCurrentTask, current);
    store.refreshState();
  };

  beforeEach(() => {
    localStorage.removeItem(LS.CHRONOS_HISTORY_OUTBOX);
    localStorage.removeItem(LS.CHRONOS_SESSIONS);
    localStorage.removeItem(LS.CHRONOS_OPEN_SESSION);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(START));
    ticks = new Subject<Tick>();
    actions = new Subject<Action>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OperationCaptureService,
          useValue: { hasUnrecoveredPersistFailure: () => false },
        },
        ChronosSessionJournalEffects,
        ChronosSessionJournalService,
        DateService,
        ImexViewService,
        {
          provide: ChronosHistoryService,
          useValue: {
            entries: signal([]),
            save: jasmine.createSpy('save'),
            remove: jasmine.createSpy('remove'),
          },
        },
        {
          provide: OperationWriteFlushService,
          useValue: { flushPendingWrites: () => Promise.resolve() },
        },
        { provide: SyncTriggerService, useValue: { isInitialSyncDoneSync: () => true } },
        { provide: HydrationStateService, useValue: { isInSyncWindow: () => false } },
        provideMockStore({ selectors: [{ selector: selectCurrentTask, value: null }] }),
        { provide: GlobalTrackingIntervalService, useValue: { tick$: ticks } },
        { provide: LOCAL_ACTIONS, useValue: actions },
      ],
    });
    store = TestBed.inject(MockStore);
    journal = TestBed.inject(ChronosSessionJournalService);
    imex = TestBed.inject(ImexViewService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    store.resetSelectors();
    jasmine.clock().uninstall();
    localStorage.removeItem(LS.CHRONOS_HISTORY_OUTBOX);
    localStorage.removeItem(LS.CHRONOS_SESSIONS);
    localStorage.removeItem(LS.CHRONOS_OPEN_SESSION);
  });

  const start = (): void => {
    subscription = TestBed.inject(
      ChronosSessionJournalEffects,
    ).recordSessions$.subscribe();
  };

  it('records ticks independently of the page and ignores changes in task totals', () => {
    start();
    setCurrent(task('a'));
    ticks.next({ duration: 3000, timestamp: START + 3000, date: '2026-10-28' });
    setCurrent({ ...task('a'), timeSpent: 999999 });
    expect(journal.open()?.end).toBe(START + 3000);
    setCurrent(null);
    expect(journal.entries().length).toBe(1);
    expect(journal.entries()[0].end).toBe(START + 3000);
    expect(
      JSON.parse(localStorage.getItem(LS.CHRONOS_HISTORY_OUTBOX) || '{}').entries.length,
    ).toBe(1);
  });

  it('recovers a checkpoint without adding the time the app was closed', () => {
    // Injected journal has not read these fields until the next instance.
    TestBed.resetTestingModule();
    localStorage.setItem(
      LS.CHRONOS_OPEN_SESSION,
      JSON.stringify({
        taskId: 'old',
        title: 'Old',
        start: START - 10000,
        end: START - 7000,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OperationCaptureService,
          useValue: { hasUnrecoveredPersistFailure: () => false },
        },
        { provide: ChronosHistoryService, useValue: { entries: signal([]) } },
        {
          provide: OperationWriteFlushService,
          useValue: { flushPendingWrites: () => Promise.resolve() },
        },
      ],
    });
    const restored = TestBed.inject(ChronosSessionJournalService);
    restored.recover();
    expect(restored.entries()[0].end).toBe(START - 7000);
    expect(restored.open()).toBeNull();
  });

  it('clears only when an import replaces data, without recording import ticks', () => {
    start();
    setCurrent(task('a'));
    ticks.next({ duration: 3000, timestamp: START + 3000, date: '2026-10-28' });
    imex.setDataImportInProgress(true);
    ticks.next({ duration: 3000, timestamp: START + 6000, date: '2026-10-28' });
    expect(journal.open()).toBeNull();
    expect(journal.entries().length).toBe(1);
    actions.next({ type: loadAllData.type });
    expect(journal.entries()).toEqual([]);
  });

  it('preserves history when import validation fails before any replacement', () => {
    start();
    setCurrent(task('a'));
    ticks.next({ duration: 3000, timestamp: START + 3000, date: '2026-10-28' });
    imex.setDataImportInProgress(true);
    imex.setDataImportInProgress(false);
    expect(journal.entries().length).toBe(1);
    expect(journal.entries()[0].end).toBe(START + 3000);
    expect(journal.open()?.taskId).toBe('a');
  });

  it('applies local idle corrections without changing task state', () => {
    start();
    setCurrent(task('a'));
    ticks.next({ duration: 3000, timestamp: START + 3000, date: '2026-10-28' });
    actions.next(removeTimeSpent({ id: 'a', date: '2026-10-28', duration: 1000 }));
    expect(journal.entries()[0].end).toBe(START + 2000);
    expect(journal.open()?.start).toBe(START + 3000);
  });

  it('reports a storage failure and keeps the live checkpoint in memory', () => {
    start();
    setCurrent(task('a'));
    spyOn(localStorage, 'setItem').and.throwError('Quota exceeded');
    ticks.next({ duration: 3000, timestamp: START + 3000, date: '2026-10-28' });
    expect(journal.open()?.end).toBe(START + 3000);
    expect(journal.storageFailed()).toBeTrue();
  });
});
