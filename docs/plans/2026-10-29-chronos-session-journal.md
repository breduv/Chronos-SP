# Chronos timer session journal

Status: implemented; validation results below. Demand: the fork owner's life calendar with actual
start/end times; daily task totals cannot reconstruct them.

## Prior art

Vendor documentation checked October 2026; no hands-on claims.

| App                                                                                    | Relevant behavior                   | Take / deliberately do not take                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| [Toggl Track](https://support.toggl.com/en-us/article/creating-a-time-entry-wg8nug/)   | Entries have start/end and duration | Keep separate entries after restart; no billing or team fields                    |
| [ActivityWatch](https://docs.activitywatch.net/en/latest/features/user-interface.html) | Daily overview includes a timeline  | Show observed time in chronological order; no background application surveillance |
| [Sunsama](https://www.sunsama.com/daily-planning)                                      | Daily view and scheduled tasks      | Keep plan and observed activity distinguishable; no mandatory planning workflow   |

## Decision and scope

Add a device-local observation journal alongside the existing Today overview.
It records only real timer ticks, not changes to daily task totals. Start, pause,
switch, completion and deletion follow the current-task selector. A restart closes
an interrupted entry at its last checkpoint, excluding app downtime. Short entries
are retained. Idle-time removal trims matching recorded segments from the end.
A date picker browses the retained entries; logical day boundaries clip a crossing
entry without rewriting it. Task titles are snapshots retained after task deletion.

Existing SP totals remain authoritative and unchanged. The journal is explicitly
local, outside normal sync/backup/import; imports clear it to avoid mixing datasets.
It retains the latest 2,000 finished sessions plus one running checkpoint. Finished
entries are written only when changed; the small running checkpoint follows ticks.
No new synced model fields, actions, schema version, plugin APIs or dependencies.
A separately designed synced entry entity is required before offering multi-device
history; putting a growing array on a task would risk losing concurrent entries
through field-level last-writer-wins resolution. This bounded journal is a prototype
of capture and presentation, not that final storage contract.

## Verification

Pure tests: switches, manual-time isolation, recovery, corrections, retention,
logical midnight clipping and DST-sized day windows. Effects tests drive timer and
store streams, including navigation-independent recording and import reset.
Browser tests use real task controls: track, switch, pause, reload, edit totals,
view another day, and narrow-screen layout.

## Results

The affected Angular suite passed: 18,938 tests in Europe/Berlin and 6,377 in
the America/Los_Angeles subset. The final import-handling change additionally
passed all six focused effect tests. Eleven pure capture tests cover the
journal transitions, corrections, retention and day clipping.

Browser validation covers eight focused Chronos scenarios: the existing Today
overview and language preferences plus real timer switches, pause/reload,
manual-total isolation, recording outside Today, date navigation, the 390px
layout and a real rejected backup import that must preserve recorded history.
Lint/format checks, translation consistency, documentation links and diff
whitespace checks passed. Desktop and narrow-screen screenshots were inspected.

No synced data/wire changes were introduced. Material limitation: the journal is
local and bounded, not a multi-device or backup-complete source of history.

## Superseded storage contract

The [quick-activities increment](2026-10-29-chronos-quick-activities.md) replaces
the bounded device-only finished journal with independently persisted history.
This document describes the earlier prototype; the current data contract is in
[User Data](../wiki/3.06-User-Data.md).
