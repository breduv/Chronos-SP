import {
  ChronosJournal,
  ChronosSession,
  closeChronosSession,
  observeChronosTask,
  tickChronosSession,
  clipChronosSession,
  getChronosDayWindow,
  removeChronosTime,
} from './chronos-session-journal';

const MIN = 60000;
const START = new Date('2026-10-28T10:00:00').getTime();
const at = (minutes: number): number => {
  const offset = minutes * MIN;
  return START + offset;
};
const empty = (): ChronosJournal => ({ entries: [], open: null });
const task = { id: 'a', title: 'Walk' };
const track = (): ChronosJournal =>
  tickChronosSession(observeChronosTask(empty(), task, START), 2 * MIN, at(2));

describe('Chronos session journal', () => {
  it('keeps separate sessions when switching, pausing and restarting a task', () => {
    let journal = observeChronosTask(track(), { id: 'b', title: 'Read' }, at(2));
    journal = tickChronosSession(journal, MIN, at(3));
    journal = observeChronosTask(journal, null, at(3));
    journal = observeChronosTask(journal, task, at(5));
    journal = tickChronosSession(journal, MIN, at(6));
    journal = closeChronosSession(journal);
    expect(journal.entries.map((e) => [e.taskId, e.start, e.end])).toEqual([
      ['a', START, at(2)],
      ['b', at(2), at(3)],
      ['a', at(5), at(6)],
    ]);
  });

  it('does not infer any time from task totals or a rename', () => {
    const journal = track();
    const renamed = observeChronosTask(journal, { ...task, title: 'New name' }, at(20));
    expect(renamed.open?.end).toBe(at(2));
    expect(renamed.open?.title).toBe('New name');
  });

  it('recovers at the last timer checkpoint and deduplicates a partial save', () => {
    const journal = track();
    const recovered = closeChronosSession(journal);
    expect(recovered.entries[0].end).toBe(at(2));
    expect(
      closeChronosSession({ entries: recovered.entries, open: journal.open }).entries
        .length,
    ).toBe(1);
    expect(closeChronosSession(recovered)).toBe(recovered);
  });

  it('keeps short tracked sessions but discards starts without a tick', () => {
    const started = observeChronosTask(empty(), task, START);
    expect(closeChronosSession(started).entries).toEqual([]);
    const short = tickChronosSession(started, 800, START + 800);
    expect(closeChronosSession(short).entries[0].end - START).toBe(800);
  });

  it('does not credit before the start, beyond the clock, or on a negative tick', () => {
    const started = observeChronosTask(empty(), task, START);
    const ticked = tickChronosSession(started, MIN, START + 500);
    expect(ticked.open?.end).toBe(START + 500);
    expect(tickChronosSession(ticked, -MIN, START + MIN)).toBe(ticked);
  });

  it('retains finished history beyond the prototype cap without mutating it', () => {
    const entries: ChronosSession[] = Array.from({ length: 2000 }, (_, i) => ({
      taskId: 'old',
      title: 'Old',
      start: i * MIN,
      end: (i + 1) * MIN,
    }));
    const before = { ...track(), entries };
    const after = closeChronosSession(before);
    expect(after.entries.length).toBe(2001);
    expect(after.entries[0].start).toBe(0);
    expect(before.entries).toBe(entries);
    expect(before.open).not.toBeNull();
  });

  it('removes idle time newest first only from the requested task and day', () => {
    const journal = {
      entries: [
        { taskId: 'a', title: 'Walk', start: START - MIN, end: START },
        { taskId: 'b', title: 'Read', start: START, end: START + MIN },
      ],
      open: { taskId: 'a', title: 'Walk', start: START + MIN, end: at(3) },
    };
    const result = removeChronosTime(journal, 'a', 2.5 * MIN, START - MIN, at(4));
    expect(result.open?.start).toBe(at(3));
    expect(result.open?.end).toBe(at(3));
    expect(result.entries[0].end).toBe(at(-0.5));
    expect(result.entries[1]).toBe(journal.entries[1]);
  });

  it('preserves both sides of a correction on a crossing session', () => {
    const entry = { taskId: 'a', title: 'Walk', start: START - MIN, end: START + MIN };
    const result = removeChronosTime(
      { entries: [entry], open: null },
      'a',
      MIN / 2,
      START - MIN,
      START,
    );
    expect(result.entries).toEqual([
      { ...entry, end: at(-0.5) },
      { ...entry, start: START },
    ]);
  });

  it('does not fill removed idle time back in on the next tick', () => {
    const result = removeChronosTime(track(), 'a', MIN, START, at(3));
    const ticked = tickChronosSession(result, MIN, at(3));
    expect(ticked.entries[0].end).toBe(START + MIN);
    expect(ticked.open?.start).toBe(at(2));
    expect(ticked.open?.end).toBe(at(3));
  });

  it('clips crossings at the logical day boundary, excluding other days', () => {
    const [start, end] = getChronosDayWindow('2026-10-28', 4 * 60 * MIN);
    const entry = { taskId: 'a', title: 'Read', start: start - MIN, end: start + MIN };
    expect(new Date(start).getHours()).toBe(4);
    expect(clipChronosSession(entry, start, end)).toEqual({ ...entry, start });
    expect(clipChronosSession({ ...entry, end: start }, start, end)).toBeNull();
  });

  it('uses local calendar arithmetic on daylight-saving transitions', () => {
    const day = '2026-10-25';
    const [start, end] = getChronosDayWindow(day, 0);
    const next = new Date(day + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    expect(end).toBe(next.getTime());
    expect(new Date(end).getHours()).toBe(0);
    expect(end - start).toBeGreaterThanOrEqual(23 * 60 * MIN);
    expect(end - start).toBeLessThanOrEqual(25 * 60 * MIN);
  });
});
