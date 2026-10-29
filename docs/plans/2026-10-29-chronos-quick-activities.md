# Chronos quick activities and durable history

Status: implemented and validated on 2026-10-29. Owner demand: one-tap activities (travel, meals, study),
fixed events and habits with reminders. This increment delivers capture and durable
history first, then connects the existing scheduling and habit tools.

## Prior art

Vendor docs checked October 2026; the previous [session-journal plan](2026-10-29-chronos-session-journal.md)
contains the sources checked for these choices.

| App           | Relevant behavior                        | Take / deliberately do not take                                               |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Toggl Track   | Continue an activity as a separate entry | One-tap repeat, separate actual intervals; no billing                         |
| ActivityWatch | Daily timeline of observed activity      | Browse dates; no application surveillance                                     |
| Sunsama       | Scheduled day plan                       | Keep planned slots separate from actual capture; no mandatory planning ritual |

## Data and compatibility decision

Quick activities are ordinary SP tasks with one optional internal flag
`isChronosQuickActivity?: boolean`, false when absent. Names, rename, deletion,
project ownership and timer behavior use existing task actions; no new public API
or wire type is introduced. The Today plan omits quick-activity rows, since their
buttons already provide the controls; other task views remain available.

Chronos is a native first-party extension using the existing keyed extension-data
store (`PLUGIN_USER_DATA`) under `chronos-sp-core:session:*`. One independently
resolved record per observed interval avoids whole-history array overwrites.
Each record uses a persistent random local origin, task/start identity and segment start, and a versioned
JSON string, compatible with existing string-valued records. Other clients retain
these inert records. Existing backup/export/import and configured sync carry them
without a schema bump, new entity registration, plugin installation or dependency.
No third-party plugin is needed to enable Chronos.

There is no automatic history deletion. Expected personal use at 50 sessions/day
is about 18,250 small records/year (roughly 4–6 MB/year including keys; estimate,
not a measured database size). The view must not reparse history on timer ticks.
The existing array-backed extension store is a known scaling cost at multi-year
sizes, preferable here to adding a new sync entity without evidence. Native archive
storage may become necessary if measured startup/storage costs justify it.

A device-local durable outbox preserves uncommitted history and the running
checkpoint through reloads. Finished intervals publish through existing actions
only on local action/timer triggers, after initial sync and outside the sync
window. Replayed records never publish further records. Completed history is no
longer capped at 2,000. Legacy local entries migrate idempotently with stable IDs.
Successful dataset imports replace the history and discard the old local outbox;
failed imports preserve it. A checkpoint is intentionally device-local until the
session ends; a restart closes it at its last confirmed tick.

## Checks

Capture and outbox unit tests, quick-activity unit tests, frozen-state validation,
focused browser start/switch/stop/rename/remove/reload and backup roundtrip,
existing Chronos regression scenarios and affected Angular tests. Verify independent
record replay/convergence using the existing sync test infrastructure where available.

## Scheduling and habit slice

The day-schedule form creates existing scheduled tasks with a duration estimate
and an explicit reminder choice. It does not add a second event model. Scheduled
habits use the existing repeat engine with one optional marker on its configuration
(`isChronosHabit?: boolean`), plus existing start time, weekday and reminder fields.
Absent markers retain all existing behavior. This marker is not schedule-affecting.
The stock repeat editor preserves it through its model spread and lets users edit
or remove the series. Legacy counter-based habits remain available on Habits.

Task snapshots predating the quick-activity flag may clear that pinning in a whole
non-time snapshot; the task and time remain readable. Chronos records are inert
string data to other clients. No action strings, public API contracts or schema
versions changed. No multi-entity conflict path was added.

Validation includes the repository's real capture/IndexedDB/replay pipeline with
its in-memory transport server, in both upload orders and after restart. It does
not establish a deployed SuperSync endpoint or configure sync for the user.

Local idle corrections modify only this origin's intervals. Remote intervals are
read-only to this capture path: one writer per session keeps outbox retries from
replacing another device's later work. Explicit cross-device interval editing is
not part of this increment.

## Validation results

- `checkFile` passed for every changed TypeScript and SCSS file. Generated
  translation keys were regenerated with `npm run int` and formatted; translation
  consistency and documentation links passed.
- `test:affected`: 18,961 successes in Europe/Berlin; 6,377 successes in the
  America/Los_Angeles subset. This includes frozen persisted-state compatibility
  and both concurrent history-upload orders followed by restart.
- All 13 focused browser scenarios passed with no retries: starter/custom activity
  lifecycle, deletion/re-adding without duplicate time, new-profile backup restore,
  fixed slots including reminders, scheduled habit completion/pause, rejected
  imports, Russian defaults, persistence and the 390px layout.
- A real reminder worker delivered the opt-in event reminder to the in-app dialog.
- Android's reminder operation fixture was regenerated from its owner `buildOps()`;
  only the new optional field in `clearedFields` changed. Kotlin parser inspection
  confirms that unrelated cleared fields do not change reminder decisions.

Native Windows/Android background execution and notification delivery with the
whole application closed are not validated. No Android SDK or additional Windows
development tool was installed. The running prototype remains the WSL-served web
application; configured remote sync was not enabled for the user.
