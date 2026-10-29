import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import {
  ChronosHistoryService,
  chronosRecordId,
  readChronosRecord,
} from './chronos-history.service';
import { selectPluginUserDataFeatureState } from '../../plugins/store/plugin-user-data.reducer';
import { ChronosSession } from './chronos-session-journal';
import { upsertPluginUserData } from '../../plugins/store/plugin.actions';

const a: ChronosSession = {
  id: 'device-a/session-1',
  taskId: 'walk',
  title: 'Walk',
  start: 100,
  end: 200,
};
const b: ChronosSession = { ...a, id: 'device-b/session-1' };
const record = (entry: ChronosSession): { id: string; data: string } => ({
  id: chronosRecordId(entry),
  data: JSON.stringify({ version: 1, ...entry }),
});

describe('ChronosHistoryService', () => {
  let store: MockStore;
  let service: ChronosHistoryService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            {
              selector: selectPluginUserDataFeatureState,
              value: [record(a), record(b), { id: 'other:record', data: '{}' }],
            },
          ],
        }),
      ],
    });
    store = TestBed.inject(MockStore);
    service = TestBed.inject(ChronosHistoryService);
  });
  afterEach(() => store.resetSelectors());
  it('keeps simultaneous sessions from two origins as independent records', () => {
    expect(service.entries().length).toBe(2);
    expect(chronosRecordId(a)).not.toBe(chronosRecordId(b));
  });
  it('saves one existing single-entity operation, without a whole-history blob', () => {
    const dispatch = spyOn(store, 'dispatch');
    service.save(a);
    expect(dispatch).toHaveBeenCalledWith(
      upsertPluginUserData({ pluginUserData: record(a) }),
    );
  });
  it('does not turn loaded or replayed records into additional writes', () => {
    const dispatch = spyOn(store, 'dispatch');
    store.overrideSelector(selectPluginUserDataFeatureState, [record(b), record(a)]);
    store.refreshState();
    expect(service.entries().length).toBe(2);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('ignores unknown versions, damaged JSON and invalid time ranges', () => {
    expect(readChronosRecord('{')).toBeNull();
    expect(readChronosRecord(JSON.stringify({ version: 2, ...a }))).toBeNull();
    expect(readChronosRecord(JSON.stringify({ version: 1, ...a, end: 99 }))).toBeNull();
  });
});
