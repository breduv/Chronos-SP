import {
  SyncFuzzHarness,
  FuzzDevice,
} from '../../op-log/testing/integration/sync-fuzz/sync-fuzz-harness';
import { PluginUserData } from '../../plugins/plugin-persistence.model';
import { upsertPluginUserData } from '../../plugins/store/plugin.actions';
import { ChronosSession } from './chronos-session-journal';
import { chronosRecordId, readChronosRecord } from './chronos-history.service';

// Real reducers, IndexedDB, capture, upload/download and replay; the transport
// server is the repository's in-memory server, not a deployed SuperSync instance.
describe('Chronos independently synchronized history', () => {
  let harness: SyncFuzzHarness;
  let a: FuzzDevice;
  let b: FuzzDevice;
  beforeEach(async () => {
    harness = await SyncFuzzHarness.create();
    a = await harness.addDevice('A');
    b = await harness.addDevice('B');
  }, 60000);
  afterEach(() => SyncFuzzHarness.dispose());
  for (const first of ['A', 'B']) {
    it(`preserves concurrent sessions in both clients when ${first} uploads first and after restart`, async () => {
      const one: ChronosSession = {
        id: 'a-session',
        taskId: 'road',
        title: 'Road',
        start: 100,
        end: 200,
      };
      const two: ChronosSession = { ...one, id: 'b-session', title: 'Study' };
      for (const [device, entry] of [
        [a, one],
        [b, two],
      ] as const) {
        await harness.as(device, () =>
          harness.dispatch(
            upsertPluginUserData({
              pluginUserData: {
                id: chronosRecordId(entry),
                data: JSON.stringify({ version: 1, ...entry }),
              },
            }),
          ),
        );
      }
      const devices = first === 'A' ? [a, b] : [b, a];
      for (const device of [...devices, ...devices])
        expect(await harness.sync(device)).toBeTrue();
      for (const device of [a, b]) {
        const state = await harness.syncedState(device);
        const entries = ((state.pluginUserData || []) as PluginUserData[]).map((record) =>
          readChronosRecord(record.data),
        );
        expect(entries).toContain(one);
        expect(entries).toContain(two);
        expect(await harness.pendingOpCount(device)).toBe(0);
        await harness.restart(device);
        expect(
          ((await harness.syncedState(device)).pluginUserData as PluginUserData[])
            ?.length,
        ).toBe(2);
      }
      expect(harness.events).toEqual([]);
    }, 60000);
  }
});
