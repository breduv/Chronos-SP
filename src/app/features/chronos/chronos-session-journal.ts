export interface ChronosSession {
  /** Stable local origin; optional for the first prototype's saved entries. */
  id?: string;
  taskId: string;
  title: string;
  start: number;
  /** Last timer-confirmed endpoint, never the time the app was reopened. */
  end: number;
}

export interface ChronosJournal {
  entries: ChronosSession[];
  open: ChronosSession | null;
}

export const closeChronosSession = (journal: ChronosJournal): ChronosJournal => {
  const open = journal.open;
  if (!open) return journal;
  return {
    open: null,
    entries:
      open.end > open.start
        ? [
            ...journal.entries.filter((e) =>
              open.id && e.id
                ? e.id !== open.id || e.start !== open.start
                : e.taskId !== open.taskId || e.start !== open.start,
            ),
            open,
          ]
        : journal.entries,
  };
};

export const observeChronosTask = (
  journal: ChronosJournal,
  task: { id: string; title: string } | null,
  now: number,
): ChronosJournal => {
  if (task && journal.open?.taskId === task.id) {
    return task.title === journal.open.title
      ? journal
      : {
          ...journal,
          open: { ...journal.open, title: task.title },
        };
  }
  const closed = closeChronosSession(journal);
  return task
    ? {
        ...closed,
        open: { taskId: task.id, title: task.title, start: now, end: now },
      }
    : closed;
};

/** Consume only the shared timer, never task.timeSpent or manual additions. */
export const tickChronosSession = (
  journal: ChronosJournal,
  duration: number,
  timestamp: number,
): ChronosJournal => {
  const open = journal.open;
  if (!open || duration <= 0) return journal;
  const end = Math.max(open.end, Math.min(timestamp, open.end + duration));
  return end === open.end ? journal : { ...journal, open: { ...open, end } };
};

/** Calendar-day arithmetic keeps 23/25-hour days intact. Offset matches DateService. */
export const getChronosDayWindow = (day: string, offset: number): [number, number] => {
  const start = new Date(day + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime() + offset, end.getTime() + offset];
};

export const clipChronosSession = (
  session: ChronosSession,
  start: number,
  end: number,
): ChronosSession | null => {
  const clippedStart = Math.max(start, session.start);
  const clippedEnd = Math.min(end, session.end);
  return clippedEnd > clippedStart
    ? {
        ...session,
        start: clippedStart,
        end: clippedEnd,
      }
    : null;
};

/** Remove a duration from matching sessions, newest first, within one logical day.
 * Splitting preserves any time outside that day and leaves real gaps visible. */
export const removeChronosTime = (
  journal: ChronosJournal,
  taskId: string,
  duration: number,
  dayStart: number,
  dayEnd: number,
): ChronosJournal => {
  let remaining = duration;
  const trim = (session: ChronosSession): ChronosSession[] => {
    if (session.taskId !== taskId || remaining <= 0) return [session];
    const overlap = clipChronosSession(session, dayStart, dayEnd);
    if (!overlap) return [session];
    const removed = Math.min(remaining, overlap.end - overlap.start);
    remaining -= removed;
    const cutStart = overlap.end - removed;
    return [
      ...(cutStart > session.start ? [{ ...session, end: cutStart }] : []),
      ...(session.end > overlap.end ? [{ ...session, start: overlap.end }] : []),
    ];
  };
  const openParts = journal.open ? trim(journal.open) : [];
  const openChanged = journal.open && openParts[0] !== journal.open;
  const parts = journal.entries.map((entry) => [entry]);
  for (let i = parts.length - 1; i >= 0 && remaining > 0; i--) {
    parts[i] = trim(journal.entries[i]);
  }
  // Continue after the old checkpoint, not at the shortened endpoint; otherwise
  // the next tick would fill the removed idle stretch back in.
  return {
    open:
      openChanged && journal.open
        ? { ...journal.open, start: journal.open.end }
        : journal.open,
    entries: [...parts.flat(), ...(openChanged ? openParts : [])],
  };
};
