import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectPluginUserDataFeatureState } from '../../plugins/store/plugin-user-data.reducer';
import {
  upsertPluginUserData,
  deletePluginUserData,
} from '../../plugins/store/plugin.actions';
import { ChronosSession } from './chronos-session-journal';

export const CHRONOS_HISTORY_PREFIX = 'chronos-sp-core:session:';
export const chronosRecordId = (entry: ChronosSession): string =>
  CHRONOS_HISTORY_PREFIX + entry.id + ':' + entry.start;

export const readChronosRecord = (data: string): ChronosSession | null => {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (
      record['version'] !== 1 ||
      typeof record['id'] !== 'string' ||
      typeof record['taskId'] !== 'string' ||
      typeof record['title'] !== 'string' ||
      typeof record['start'] !== 'number' ||
      !Number.isFinite(record['start']) ||
      typeof record['end'] !== 'number' ||
      !Number.isFinite(record['end']) ||
      record['end'] <= record['start']
    )
      return null;
    return {
      id: record['id'],
      taskId: record['taskId'],
      title: record['title'],
      start: record['start'],
      end: record['end'],
    };
  } catch {
    return null;
  }
};

/** Native Chronos extension: existing independently resolved string records.
 * No plugin runtime or user-installed plugin is required. */
@Injectable({ providedIn: 'root' })
export class ChronosHistoryService {
  private readonly _store = inject(Store);
  private readonly _records = this._store.selectSignal(selectPluginUserDataFeatureState);
  readonly entries = computed(() =>
    (this._records() ?? [])
      .flatMap((record) => {
        if (!record.id.startsWith(CHRONOS_HISTORY_PREFIX)) return [];
        const entry = readChronosRecord(record.data);
        return entry ? [entry] : [];
      })
      .sort(
        (a, b) =>
          a.start - b.start || chronosRecordId(a).localeCompare(chronosRecordId(b)),
      ),
  );

  save(entry: ChronosSession): void {
    this._store.dispatch(
      upsertPluginUserData({
        pluginUserData: {
          id: chronosRecordId(entry),
          data: JSON.stringify({ version: 1, ...entry }),
        },
      }),
    );
  }

  remove(id: string): void {
    this._store.dispatch(deletePluginUserData({ pluginId: id }));
  }
}
