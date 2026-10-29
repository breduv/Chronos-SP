import { Injectable, computed, inject, signal } from '@angular/core';
import { LS } from '../../core/persistence/storage-keys.const';
import { lsGetJSON } from '../../util/ls-util';
import { OperationCaptureService } from '../../op-log/capture/operation-capture.service';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { ChronosHistoryService, chronosRecordId } from './chronos-history.service';
import {
  ChronosJournal,
  ChronosSession,
  closeChronosSession,
  getChronosDayWindow,
  observeChronosTask,
  removeChronosTime,
  tickChronosSession,
} from './chronos-session-journal';

interface HistoryOutbox {
  entries: ChronosSession[];
  deleted: string[];
}

@Injectable({ providedIn: 'root' })
export class ChronosSessionJournalService {
  private readonly _history = inject(ChronosHistoryService);
  private readonly _flush = inject(OperationWriteFlushService);
  private readonly _capture = inject(OperationCaptureService);
  private readonly _origin =
    localStorage.getItem(LS.CHRONOS_ORIGIN) || crypto.randomUUID();
  private readonly _outbox = signal(
    lsGetJSON<HistoryOutbox>(LS.CHRONOS_HISTORY_OUTBOX, { entries: [], deleted: [] }),
  );
  private readonly _open = signal(
    lsGetJSON<ChronosSession | null>(LS.CHRONOS_OPEN_SESSION, null),
  );
  private readonly _storageFailed = signal(false);
  private _generation = 0;
  readonly open = this._open.asReadonly();
  readonly storageFailed = this._storageFailed.asReadonly();
  readonly entries = computed(() => {
    const outbox = this._outbox();
    const merged = new Map(
      this._history.entries().map((entry) => [chronosRecordId(entry), entry]),
    );
    outbox.deleted.forEach((id) => merged.delete(id));
    outbox.entries.forEach((entry) => merged.set(chronosRecordId(entry), entry));
    return [...merged.values()].sort((a, b) => a.start - b.start);
  });

  recover(): void {
    try {
      localStorage.setItem(LS.CHRONOS_ORIGIN, this._origin);
    } catch {
      this._storageFailed.set(true);
    }
    const legacy = lsGetJSON<ChronosSession[]>(LS.CHRONOS_SESSIONS, []);
    const entries = new Map(
      this.entries().map((entry) => [chronosRecordId(entry), entry]),
    );
    legacy.forEach((entry) => {
      const migrated = this._identify(entry);
      entries.set(chronosRecordId(migrated), migrated);
    });
    this._apply(
      closeChronosSession({
        entries: [...entries.values()],
        open: this._open() ? this._identify(this._open()!) : null,
      }),
    );
    // Delete the old cache only after its data is in the crash-safe outbox.
    if (!this._storageFailed()) localStorage.removeItem(LS.CHRONOS_SESSIONS);
  }

  observe(task: { id: string; title: string } | null, now: number): void {
    const open = this._open();
    if (task?.id === open?.taskId && task?.title === open?.title) return;
    if (!task && !open) return;
    this._apply(observeChronosTask(this._state(), task, now));
  }
  tick(duration: number, timestamp: number): void {
    const current = this._open();
    const next = tickChronosSession({ entries: [], open: current }, duration, timestamp);
    if (next.open === current) return;
    this._open.set(next.open);
    try {
      localStorage.setItem(LS.CHRONOS_OPEN_SESSION, JSON.stringify(next.open));
    } catch {
      this._storageFailed.set(true);
    }
  }
  removeTime(taskId: string, date: string, duration: number, offset: number): void {
    const [start, end] = getChronosDayWindow(date, offset);
    const state = this._state();
    const isOwned = (entry: ChronosSession): boolean =>
      !!entry.id?.startsWith(this._origin + ':');
    const trimmed = removeChronosTime(
      { entries: state.entries.filter(isOwned), open: state.open },
      taskId,
      duration,
      start,
      end,
    );
    // Local idle correction describes time tracked here, not another device's
    // intervals. Keeping one writer per session also makes outbox retry safe.
    this._apply({
      ...trimmed,
      entries: [
        ...state.entries.filter((entry) => !isOwned(entry)),
        ...trimmed.entries,
      ].sort((a, b) => a.start - b.start),
    });
  }
  clear(): void {
    this._generation++;
    this._open.set(null);
    this._outbox.set({ entries: [], deleted: [] });
    this._saveLocal();
    localStorage.removeItem(LS.CHRONOS_SESSIONS);
  }

  /** Invoked only from guarded local action/timer effects, never a selector. */
  async publishPending(): Promise<void> {
    const pending = this._outbox();
    if (!pending.entries.length && !pending.deleted.length) return;
    if (this._capture.hasUnrecoveredPersistFailure()) {
      this._storageFailed.set(true);
      return;
    }
    const generation = this._generation;
    try {
      pending.deleted.forEach((id) => this._history.remove(id));
      pending.entries.forEach((entry) => this._history.save(entry));
      await this._flush.flushPendingWrites();
      if (generation !== this._generation) return;
      // A drained queue means attempts completed, not necessarily durable writes.
      if (this._capture.hasUnrecoveredPersistFailure()) {
        this._storageFailed.set(true);
        return;
      }
      const current = this._outbox();
      this._outbox.set({
        entries: current.entries.filter((entry) => !pending.entries.includes(entry)),
        deleted: current.deleted.filter((id) => !pending.deleted.includes(id)),
      });
      this._saveLocal();
    } catch {
      this._storageFailed.set(true);
    }
  }

  private _identify(entry: ChronosSession): ChronosSession {
    return entry.id
      ? entry
      : { ...entry, id: this._origin + ':' + entry.taskId + ':' + entry.start };
  }
  private _state(): ChronosJournal {
    return { entries: this.entries(), open: this._open() };
  }
  private _apply(next: ChronosJournal): void {
    const before = this.entries();
    const outbox = this._outbox();
    const beforeById = new Map(before.map((entry) => [chronosRecordId(entry), entry]));
    const afterById = new Map(
      next.entries.map((entry) => {
        const identified = this._identify(entry);
        return [chronosRecordId(identified), identified] as const;
      }),
    );
    if (next.entries !== before) {
      const pending = new Map(
        outbox.entries.map((entry) => [chronosRecordId(entry), entry]),
      );
      const deleted = new Set(outbox.deleted);
      beforeById.forEach((entry, id) => {
        if (!afterById.has(id)) {
          pending.delete(id);
          deleted.add(id);
        }
      });
      afterById.forEach((entry, id) => {
        if (JSON.stringify(entry) !== JSON.stringify(beforeById.get(id))) {
          pending.set(id, entry);
          deleted.delete(id);
        }
      });
      this._outbox.set({ entries: [...pending.values()], deleted: [...deleted] });
    }
    const open = next.open ? this._identify(next.open) : null;
    if (open === this._open() && next.entries === before) return;
    this._open.set(open);
    this._saveLocal();
  }
  private _saveLocal(): void {
    try {
      localStorage.setItem(LS.CHRONOS_HISTORY_OUTBOX, JSON.stringify(this._outbox()));
      localStorage.setItem(LS.CHRONOS_OPEN_SESSION, JSON.stringify(this._open()));
      this._storageFailed.set(false);
    } catch {
      this._storageFailed.set(true);
    }
  }
}
