# Tars product reduction — 2026-10-03

Implemented in the existing `handoff/claude-overhaul` checkout at `3e43def`, preserving its pre-existing Atlas renderer/label work. No commit, push or deployment. The overhaul was paused during this reduction, briefly resumed for retained surfaces, then paused again on 2026-10-04 for the Atlas runtime regression repair. See `TARS-ATLAS-NEWS-ROADMAP.md` for paused scope and `TARS-ATLAS-RUNTIME-FIX.md` for repair evidence. J-23 remains accepted; J-24/J-25 remain unaccepted. Focus/Planning jobs and media follow-ups are retired. The reduction and all persistence decisions below remain in force.

## Dependency audit and disposition

| Area | Dependencies identified before removal | Decision |
| --- | --- | --- |
| Focus | `src/timer`, `src/audio`, Focus/audio screens, session analytics, ambient wallpaper/quotes, profile/session controls, reminders/notifications/wake lock, Focus actions and initialization | Delete runtime modules, exclusive tests/assets and launcher shortcuts. Remove keep-awake/local-notifications packages and native registrations. No timer engine, reconciliation, audio singleton or session subscription starts. |
| Planning | `src/planner`, tasks/calendar/habits, goals/planning analytics, quick capture, task actions and route view-memory | Delete screens, grammar/state/actions, seeds, hooks, CSV/demo helpers and obsolete QA. Shared route-state/scroll memory remains. |
| Atlas | `src/atlas`, Atlas screens/map renderer, game progression/challenges, canonical PYQ runtime, recall history; exploration/panel/living map formerly depended on sessions/expeditions | Preserve map/entities/questions/search/filters/recall/offline data. Remove timer travel, expedition runs/actions/overlays/gates/base camp, revision-task action, minute XP/challenges and expedition-only river animation. Existing recall history supplies familiarity coverage, mastery, due reviews and XP. Keep daily review and weekly recall/pass challenges with existing ids/targets/rewards. |
| News | `src/current-affairs`, CurrentAffairsScreen, API gateway, archive, reading state, note storage/hook/components, shared shell/services | Preserve feed/relevance/provenance, UI and storage. Standalone Notes surface removed; News notes remain. Only coupling comments and navigation tests change. |
| Shared | React/Dexie/Zustand/Motion/TopoJSON, design primitives/surfaces, theme/haptics/fullscreen/files/install/lifecycle, settings, repo/tombstones/sync/backup | Retain infrastructure consumed by Atlas/News or required for existing data compatibility. Remove unused legacy UI wrappers after tracing references; retain the actual shared surface library. Remove unused dexie-react-hooks package. |

Runtime import traversal from `src/main.tsx` plus TypeScript/build checks found no references to deleted modules. The News gateway is intentionally server-only, used by `api/current-affairs.ts` and development middleware. Test-only JSON assets/directory URLs are valid and outside a static module-import graph. All remaining source modules are reached by the client, server or retained tests. Atlas worker/cache code is retained; no performance-roadmap work was resumed.

## Product behavior

Primary navigation is **Atlas | News** on rail and phone. Search/commands and shared Settings remain auxiliary controls. Landing is Atlas. Old Home/Focus/Tasks/Planning/Calendar/Notes/Insights/audio and unknown hashes canonicalize to `#/atlas`, dropping their legacy query parameters. Old command ids are unavailable; stored palette recents are filtered to retained commands. Shortcuts expose G A / G W / G S, Ctrl/⌘ K, sidebar, shortcuts reference and Atlas map controls.

No Focus-time progression remains. Current XP consists of capped recall XP and retained Atlas-native challenge claims; historical Focus/discovery/expedition claims remain stored but are ignored in active XP. Rank thresholds and map styles are retained. Warm coverage styling now reflects existing recall familiarity. Every place remains accessible, including places never studied. No new gamification was created.

PWA manifest and Android launcher shortcuts open Atlas/News. Brand description/social preview reflects Atlas + News. Removed notification SW helper and exclusive icons are absent from the precache. Shared install identity and both native URL schemes remain unchanged.

## Persistence and schema decisions

- `src/data/db.ts` and `types.ts` are unchanged. Database name remains `lodestar`; schema v2 and historical v1/v2 migrations are unchanged. No database version bump or deletion migration.
- Historical labels/projects/tasks/sessions/profiles/goals/habits/habitLogs/events/audioPresets/playlists/expeditions, reminder log and legacy settings shape remain for compatibility. Boot seeds shared settings only; none of the obsolete runtime hooks/initializers/readers remain.
- `src/data/repo.ts`, `sync.ts`, `backup.ts` and `backup-extras.ts` remain unchanged. Existing backups v1/v2/v3 and `lodestar` import identity still work; all historical sync tables remain exportable/mergeable. Explicit backup replace/erase keeps its existing user-confirmed behavior.
- Existing raw `tars.timer.v1`, `lodestar.timer.v1`, audio/background preferences and obsolete persisted values are neither migrated nor deleted by startup; they have no active consumer. Shared theme/Atlas key migration remains.
- News reading state, notes and archive retain their current keys/stores and backup behavior. Canonical question attempts retain their persistence.
- Generated Atlas/PYQ/relevance data, ids and provenance are unchanged. `ATLAS_V2_AT` is unchanged. Static expedition metadata/types remain in the generated places package to avoid rewriting authoritative source data, but have no runtime index/action/reader.

Preservation tests seed every historical sync table, run boot twice, compare records/settings, and round-trip v3 backups. Browser smoke seeds old session/task/expedition records and a running timer snapshot, then checks them verbatim after reload, legacy links, navigation and offline reload. No extra sessions or expedition writes appear.

## Acceptance evidence

Run locally on Windows with system Chrome against the final production preview (`127.0.0.1:4176`) or the News fixture production server.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: 0 errors, 188 warnings (existing design/accessibility warning policy) |
| `npm test` | 224/224, 29 files; includes retained Atlas/PYQ/News/backup/migration/UI tests and new reduction/preservation checks |
| `npm run build` | Pass; 154 precache entries, 7015.10 KiB |
| Product smoke | 100/100 at 375/1366 px, light/dark: routes, actions, palette copy, navigation, independent places/News, data preservation and offline reload; no page errors |
| Atlas interactions | 21/21 phone/desktop: pan/zoom/search, sheet switching, all-place access and selection positioning; no page errors |
| Learning | 104/104 each light/dark: all canonical question shapes, answer locking/reveal, persisted attempts, recall and unopened question offline; no page errors |
| News | 279/279: reading/saved queues, archive, filters, analytics, note fidelity/Undo/print, reload and real Workbox cache; no page errors |
| Layout audit | All 30 retained surfaces/checks at 375/1366 px, light/dark; no layout problems |
| Fullscreen | Four repeated exits restore shell/viewport; no page errors |
| Offline integrity | 9/9 clean-install checks with HTTP cache disabled: app/question/answer from SW, all 111 hashes verified, stale cache rejected and restored |
| Recovery | 6/6: failed lazy chunk reloads once, stage recovery/nav remain and reload/Atlas navigation recover |
| Settled map/console health | Painted bitmap tiles online and offline; News/Settings load; no unexpected console or runtime errors |
| Diff/data review | No missing runtime imports, no changes to Dexie schema/migrations/backup/sync, Atlas/PYQ/relevance source data or place ids; whitespace check clean |

Initial new-test assertions incorrectly expected same-day recall due, and old/browser assertions assumed five tabs, a modal desktop inspector or immediate rendering. Corrected assertions use existing next-day review rules and actual retained surfaces/readiness; clean full reruns pass. The map health check copies bitmaprenderer canvases for inspection instead of requesting incompatible 2D contexts. No rendering/performance changes were made to satisfy QA timing.

Evidence is local and ignored: `tools/perf/out/product/`, `out/vnext/learning-results-*.json`, `out/current-affairs-direct/results.json` and `out/job4/offline-results.json`. CI now runs retained browser regressions plus the reduced-product smoke. Native projects were updated for dependency/shortcut removal but Android/iOS builds and physical-device tests were not run. Live publisher availability is outside fixture acceptance; gateway/relevance unit tests and unchanged source pipeline are preserved. The optional previous-build SW upgrade variant was not run.
