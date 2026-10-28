# Chronos first prototype

Status: Implemented and validated. Owner: breduv's personal fork. Tracking: this local implementation.
Verified: 2026-10-28. Complete when the Today screen works with real tasks,
tracking, duration edits, reload, and a narrow-screen layout in WSL.

## Prior art

Checked vendor documentation, October 2026; no hands-on claims.

| App                                                                                  | Day planning                          | Actual time                                             | Take / deliberately do not take                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [TickTick](https://help.ticktick.com/articles/7063851189372190720)                   | Tasks can be placed in a calendar     | Calendar placement alone does not establish actual time | Keep quick access to the existing calendar; do not duplicate its drag-and-drop                          |
| [Sunsama](https://www.sunsama.com/daily-planning)                                    | Daily tasks, estimates and timeboxing | Estimates describe planned work                         | Make the day the entry point; skip integrations and a mandatory planning ceremony                       |
| [Toggl Track](https://support.toggl.com/en-us/article/creating-a-time-entry-wg8nug/) | Timer or manual capture               | Explicit entries with duration and start/end            | Make the current activity and corrections easy to reach; do not invent intervals from SP's daily totals |

The demand is the fork owner's request for a personal calendar/time tracker.
The existing task, schedule, habit and history screens already cover most
planning workflows; a separate persistence system would introduce divergence.

## First slice

Enhance the existing Today page, preserving its task controls and context.
Show remaining estimated time, recorded time including the young archive,
completion count, current activity, and a task-level time breakdown. Open the
existing duration dialog for corrections. Respect the existing feature flags
for calendar and habit navigation. Other tag/project pages retain their layout.

The breakdown covers non-archived tasks and groups subtasks under their parent,
matching WorkContextService's daily total. Archived time is displayed separately.
This is a duration summary, not a chronological history or a full archive report.
It does not create new persisted fields, actions, sync formats, dependencies or
alerts. Exact intervals, historical editing across dates and data migration
remain separate work. Logical day boundaries use the existing store clock.

## Development

Ubuntu 24.04 in WSL, source at `~/projects/Chronos-SP`, Node from `.nvmrc`.
Dependencies and browser-test tools live inside Linux. The Windows checkout is
an initial clone; this prototype's working copy is the Linux repository.
