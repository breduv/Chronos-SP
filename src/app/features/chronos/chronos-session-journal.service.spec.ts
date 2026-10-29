import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LS } from '../../core/persistence/storage-keys.const';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { OperationCaptureService } from '../../op-log/capture/operation-capture.service';
import { ChronosHistoryService, chronosRecordId } from './chronos-history.service';
import { ChronosSession } from './chronos-session-journal';
import { ChronosSessionJournalService } from './chronos-session-journal.service';

const START = 100000;
describe('ChronosSessionJournalService durable outbox', () => {
  let service: ChronosSessionJournalService;
  let failed: boolean;
  let history: ReturnType<typeof signal<ChronosSession[]>>;
  let save: jasmine.Spy;
  let flush: jasmine.Spy;
  const clean = (): void => {
    [
      LS.CHRONOS_SESSIONS,
      LS.CHRONOS_OPEN_SESSION,
      LS.CHRONOS_HISTORY_OUTBOX,
      LS.CHRONOS_ORIGIN,
    ].forEach((key) => localStorage.removeItem(key));
  };
  beforeEach(() => {
    clean();
    failed = false;
    history = signal<ChronosSession[]>([]);
    save = jasmine.createSpy('save').and.callFake((entry: ChronosSession) => {
      const id = chronosRecordId(entry);
      history.set([...history().filter((old) => chronosRecordId(old) !== id), entry]);
    });
    flush = jasmine.createSpy('flush').and.resolveTo(undefined);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ChronosHistoryService,
          useValue: { entries: history, save, remove: jasmine.createSpy('remove') },
        },
        { provide: OperationWriteFlushService, useValue: { flushPendingWrites: flush } },
        {
          provide: OperationCaptureService,
          useValue: { hasUnrecoveredPersistFailure: () => failed },
        },
      ],
    });
    service = TestBed.inject(ChronosSessionJournalService);
    service.recover();
  });
  afterEach(clean);
  const track = (): void => {
    service.observe({ id: 'walk', title: 'Walk' }, START);
    service.tick(1000, START + 1000);
    service.observe(null, START + 1000);
  };
  const pendingCount = (): number =>
    JSON.parse(localStorage.getItem(LS.CHRONOS_HISTORY_OUTBOX) || '{}').entries.length;

  it('removes the outbox only after confirmed writes and keeps the durable history visible', async () => {
    track();
    expect(pendingCount()).toBe(1);
    await service.publishPending();
    expect(save).toHaveBeenCalledTimes(1);
    expect(pendingCount()).toBe(0);
    expect(service.entries().length).toBe(1);
    await service.publishPending();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('retains recoverable data after a rejected write or failed persistence latch', async () => {
    track();
    flush.and.callFake(async () => {
      failed = true;
    });
    await service.publishPending();
    expect(pendingCount()).toBe(1);
    expect(service.storageFailed()).toBeTrue();
    await service.publishPending();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('does not write completed history or rebuild the outbox on timer ticks', () => {
    service.observe({ id: 'walk', title: 'Walk' }, START);
    const writes = spyOn(localStorage, 'setItem').and.callThrough();
    service.tick(1000, START + 1000);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.calls.mostRecent().args[0]).toBe(LS.CHRONOS_OPEN_SESSION);
    expect(save).not.toHaveBeenCalled();
  });
  it('uses the same durable key when retrying a local entry after restart', async () => {
    track();
    const first = service.entries()[0];
    flush.and.rejectWith(new Error('disk unavailable'));
    await service.publishPending();
    await service.publishPending();
    expect(save.calls.allArgs().map((args) => chronosRecordId(args[0]))).toEqual([
      chronosRecordId(first),
      chronosRecordId(first),
    ]);
    expect(pendingCount()).toBe(1);
  });
  it('keeps newly finished sessions that arrived while a flush was in flight', async () => {
    let finish: (() => void) | undefined;
    flush.and.returnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    track();
    const saving = service.publishPending();
    service.observe({ id: 'read', title: 'Read' }, START + 2000);
    service.tick(1000, START + 3000);
    service.observe(null, START + 3000);
    finish!();
    await saving;
    expect(pendingCount()).toBe(1);
    expect(service.entries().length).toBe(2);
  });
  it("does not trim another device's session during a local idle correction", () => {
    const foreign: ChronosSession = {
      id: 'another-device:walk:100000',
      taskId: 'walk',
      title: 'Walk elsewhere',
      start: START,
      end: START + 2000,
    };
    history.set([foreign]);
    track();
    service.removeTime('walk', '1970-01-01', 500, 0);
    expect(service.entries().find((entry) => entry.id === foreign.id)).toEqual(foreign);
    expect(service.entries().find((entry) => entry.id !== foreign.id)?.end).toBe(
      START + 500,
    );
  });
});
