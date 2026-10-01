# Tars vNext Jobs 2–3

Work is uncommitted on `main`, preserving Job 1. Safety copy: `../job1-safety-20261001/` contains the original 130 changed/untracked files and a binary tracked patch. The canonical package, 149-question curation, existing Atlas data and permanent IDs are preserved.

## Job 2

Implemented universal map/knowledge access. Existing `discovered`, session histories, `ATLAS_V2_AT`, deterministic survey/expedition allocation and recall checkpoints continue unchanged internally. UI describes this history as travel. Recall establishes Familiar/Strong/Mastered independently of travel; reviewed untravelled places return in the due queue.

Desktop uses a floating, collapsible inspector over the full map canvas. Collapse retains selection; reopen restores it. Mobile uses the same detail content in the existing bottom sheet, yielding to recall/quiz sheets. Geographic references exclude publisher/PDF/workbook records and page clutter. Small map text uses Manrope with separate geographic styles and halos.

`CanonicalQuiz` renders exact Job 1 structures through `AtlasPyqBody`, four native keyboard-operable radios, explicit submit, locked answer state and final supplied alternative answers. Feedback contains only correctness, the selected key, accepted keys and meaningful mapped relations. Incorrect options/incidental relations do not become learning destinations. `PlaceQuestions` uses canonical family totals, and loads only papers linked to a selected place. CDS remains enrichment; legacy priority weights are untouched.

Persistence: **no schema migration or new table**. Optional non-indexed `RecallAttempt.pyq` fields store canonical ID, question/answer hashes, selected/accepted keys and eligible primary-stem place IDs. One attempt is written through the existing repository; its eligible relations are expanded only when deriving mastery. Full bodies are never persisted. Existing v2 backups, sync and tombstones round-trip the fields; older v1/v2 records remain valid. A PYQ is its own recall type, so it does not falsely count as map/location/order recall.

Offline: all 100 curated JSON assets total less than 0.6 MiB, each below the unchanged 3 MiB Workbox limit. They now join precache with content revisions; hash query parameters map to those bytes. JS reads remain lazy. The full corpus, archives and reports are not bundled. Core precache measured 7,439.99 KiB at the Job 2 checkpoint.

Acceptance gate complete: root 98/98 tests, Atlas-build 42/42 (zero skipped), typecheck and production build pass. Existing feature QA passed 18/18; smoke 12/12 and Atlas interaction checks passed. The new learning QA covers all eight admitted question types, A–D submission/locking/reveal, both navigation directions, overlay/collapse, mobile and an unvisited paper offline. Learning QA passed 104/104 in each theme. All four widths (375/768/1366/1920) and Paper/Night were checked in responsive audit sweeps; the final repaired 1920 Night/fullscreen case passed, including four repeat exits restoring chrome. No layout problems remain in checked states. The measured curated data is exactly 526,535 bytes across 100 files.

## Job 3 implementation

The Job 2 hard gate passed before this work began. Production retains the controlled bundled SVG Atlas. The isolated MapLibre/PMTiles experiment is reproducible under `tools/map-spike/`; it demonstrates promising WebGL interaction but does not establish cold-offline, required study-layer, target-phone GPU or deeper-content parity. The decision is to retain the working renderer, with no root runtime dependency additions. `tools/map-spike/README.md` describes its controls, archive and acceptance gaps.

Atlas now includes optional curated PYQ hotspots, family/year/type catalogue filters and a mapped-place view. Hotspots count distinct questions across 211 meaningful places; distractor/incidental relations contribute neither hotspots nor mastery. The catalogue uses the unchanged 149-question inventory and exact canonical identities. Question bodies remain paper-lazy in JavaScript. Existing relief, cartographic layers, expedition routes and controlled India depiction remain; all knowledge is accessible independently of travel. Mastery symbols and search badges no longer require Travelled state. Failed first recall says Recall started, and never implies travel. Compact viewports scale labels with the camera during motion and restore crisp sizing at rest, avoiding per-frame SVG writes and text rasterization.

The additive `tools/build-atlas-assets.mjs` inventory records 111 assets / 5,762,934 bytes: 10 original Atlas assets / 5,218,412 bytes, 100 canonical runtime assets / 526,535 bytes, and hotspot metadata / 17,987 bytes. Its separate manifest is 40,324 bytes. Each asset has an ID, content-hash version, exact bytes, tier, bundled/removable policy and compatibility. The manifest identity is `d9eb9da8897a9c6120a47e96a105e014501a734c060acd53f2befb25cf847aab`. Builds reproduced the same identity. CORE and INDIA are bundled/precached. REGIONAL has no published packs; ONLINE has zero map-cache budget. The offline panel reports actual precache installation rather than dummy download/remove states. No high-detail planet is bundled.

`src/tars/registry.ts` defines the requested actions with typed inputs and live availability. `runtime.ts` resolves current IDs and calls existing repositories/timer APIs. Validation rejects unknown fields, malformed dates/durations, invalid IDs and unavailable execution; guarded mutations reject duplicate asynchronous starts/creation/completion. Duration requests choose a compatible countdown before changing state, including stopwatch-task cases. Unlinked Calendar blocks explicitly clear prior task/project/subject context; linked blocks retain their intended task. Future AI/voice proposals use this same boundary. Detailed editing forms retain existing repository operations.

`context.ts` derives route, timer/task, selected place/PYQ, today's priority-ordered plan, due recall, active expedition/checkpoint/next stop and persisted focus activity. `useContext.ts` bridges shared live queries; selection is transient and day changes refresh on midnight/wake. No chatbot prose, extra progress ledger or per-frame context state.

The command surface now combines exact/alias place search, existing-subject matching, deterministic intents, action validation and contextual ranking. All requested command forms are supported. Subject-duration commands require a unique existing subject; normal quick capture can create it (`Read Polity today @Polity`). Ambiguous names are search results, never guessed destinations. Unsupported control requests do not silently become tasks. No cloud model controls the application.

A compact Tars launcher is available across primary routes, with an applicable desktop next action and up to three palette suggestions. Existing active-timer presence remains. Idle Focus shows real planned/review counts; completion connects saved duration with actual expedition minutes and reached places. Task→Focus, Focus→task completion, Calendar→Focus, expedition→place, place↔PYQ, place→revision task, recall→place and Insights→source-session access share the natural workflow. Primary routes/deep links stay intact, Focus remains home and Settings stays secondary.

The shared design refresh reduces card borders/shadows, opens Insights charts/statistics and uses explicit operational/body/heading/numeric/map/quiz typography roles. Small operational headings and map labels use Manrope; Fraunces remains for large headings. Paper/Night, shared Sheet dialogs, touch targets and existing motion/reduced-motion conventions continue across screens. Mature editing layouts retain their established controls.

CI now adds production Chromium smoke, Atlas, Tars workflow, both learning themes and selected responsive cohorts. Local verification below passed; the hosted GitHub workflow has not been executed because no push/PR was authorized.

## Measured comparison

The baseline was reconstructed from `git archive HEAD` plus the untouched pre-Job-2 safety files in a separate `../job1-profile-baseline/` directory. Its build reproduced the original Job 1 entry/Atlas hashes. No working-tree reset or source edit was used. The old profiler leaked rAF loops across samples; `profile.mjs` and the spike now use generation tokens. Initial uncorrected profiles are superseded. Measurements below are single headless Chromium runs at 390×844 and 4× CPU throttle, not physical-device or statistical guarantees.

| Artifact | Job 1 baseline | Final |
|---|---:|---:|
| Entry JS, raw | 328,308 B | 256,303 B |
| Static initial import graph, raw | 838,992 B | 798,310 B |
| Static initial import graph, gzip with Node defaults | 265,879 B | 254,350 B |
| Atlas route, raw | 49,693 B | 63,008 B |
| Deferred FieldReview/map renderer chunk | embedded in initial graph | about 52.08 kB |
| Full PWA precache | 55 entries / 6,905.84 KiB | 165 entries / 7,525.24 KiB |
| Original map/data assets | 5,218,412 B | unchanged |
| Curated PYQ data | 526,535 B | unchanged; now all precached |

Static import totals exclude dynamic imports, including service-worker registration. The larger Atlas route adds canonical catalogue/learning and offline controls; its renderer is deferred from initial Focus. A warmed/onboarded Settings→Focus→Atlas run measured 1,373.0→1,314.3 ms to two frames after initial Atlas geometry (4× CPU). Requested JS before Atlas in that setup was 879,514→838,965 bytes, including the setup Settings route. It is not a cold-start measure. Warm-route JS heap was 21.59→21.68 MB; heap is a snapshot, not peak memory.

| Corrected gesture sample | Baseline FPS / p95 ms | Final FPS / p95 ms |
|---|---:|---:|
| Idle | 57.0 / 18.2 | 57.0 / 18.1 |
| Pan | 48.0 / 18.2 | 45.1 / 18.2 |
| Wheel zoom in | 21.7 / 213.1 | 12.7 / 244.5 |
| Pan zoomed | 42.5 / 18.3 | 43.1 / 18.3 |
| Wheel zoom out | 9.1 / 278.8 | 28.7 / 193.8 |
| Wheel notches | 29.6 / 206.7 | 25.9 / 199.9 |

The final zoom-out sample improved, while zoom-in FPS regressed and notch results varied substantially across runs (54.0–199.9ms p95 in the final phone-policy iterations). The reported table uses the last run rather than the best sample. The final max zoom-in interval was 379.6 ms. No overall gesture-performance win is claimed. This is a remaining performance risk, not a universal smoothness claim. Post-gesture JS heap was 26.70→23.26 MB, with GC/workload caveats. No per-frame React state or SVG attribute updates were introduced.

The corrected isolated candidate measured 1,046.5 ms from its own map construction through layer readiness; that excludes prior module import and is not comparable to the warmed app route measure. Candidate p95 idle/pan/wheel: 18.2 / 18.7 / 18.2 ms; maxima 54.6 / 396.6 / 54.4 ms. Its shorter workloads and simplified layers differ from the production profiler. Candidate JS heap snapshot: 9.25 MB; browser distribution cost: 1,145,514 raw / 312,591 gzip JS bytes plus 83,310 CSS bytes. PMTiles archive: 276 tiles / 482,682 bytes, only existing z0–4 detail. Cold-offline installation, full study-layer functionality and physical GPU performance remain unverified. The lighter prototype is not evidence of production feature parity.

## Final validation

- Root: **112/112 tests**, 15 files; typecheck and production build pass.
- Atlas-build: **42/42 tests**, zero skipped with the original external canonical ZIP.
- Production Tars workflow: **51/51 checks**, desktop Paper and 375px Night/touch/reduced-motion. Includes natural duration, pause/resume, tomorrow planning, Calendar block→task focus, one durable 25-minute session, expedition minutes/reached stop, catalogue filters, exact-place command, canonical answer/hash/role-safe history, independent Familiar badges in place/search, revision task, Insights and offline quiz.
- Learning: **104/104 in each of Paper and Night**, all eight admitted structures, A–D submit/lock/reveal, both navigation directions, mobile sheet, overlay/collapse, keyboard basics and an unvisited paper offline.
- Features: **21/21**, including audio-follow, quick capture, undo, commands, fullscreen/sidebar, missing-ID fail-without-mutation, stopwatch-task duration safety and unlinked Calendar blocks clearing previous task context.
- Production smoke: **12/12**. Atlas interactions: **21/21**, including desktop coverage/search/fly-to, zoom limits, touch double-tap and two-finger zoom-out; rerun after the compact-label optimization passed.
- Responsive audit: **148 checked states**, 375/768/1366/1920 × Paper/Night; no layout problems. Additional Atlas layout sweep passed 16/16 map/fullscreen states across all eight cohorts. Four repeated fullscreen exits restored Focus chrome/viewport with no page errors.
- Manual screenshot inspection: desktop Paper Focus, desktop Night map, mobile Night complex matching and the stratified canonical structured-question screenshots. No invented explanations or reconstructed content.
- `git diff --check` passes. `/review` is unavailable in this tool environment; a self-review inspected action races/reference validation, profile selection, mastery roles, source cleanup, cache scope, legacy identities and preservation.
- Preservation: **123 Job 1 source/artifact files compared byte-for-byte: zero changed**; original Atlas files have no Git diff. `src/atlas/explore.ts`, timer engine/store and DB schema are unchanged. ZIP SHA remains `a86e3b62e749500158cb5406cabfd4aef58e395cf6b6ed90932afbb1ec058d71`. New production places/coordinates added by Jobs 2–3: **0**. Existing 2,273 IDs, the 149-question subset (CSE72/PCS30/CDS47), 6,829 geographic-review occurrences and 213 candidate groups are preserved.

Evidence lives in ignored `tools/perf/out/`: `vnext-preservation.json`, `tars/results.json`, `vnext/learning-results-{light,dark}.json`, `vnext-ui-audit.log`, `vnext-atlas-final.log`, `vnext-features-final.log`, `vnext-smoke-final.log`, `job1-corrected.json`, `vnext-final.json`, `vnext-load.json`, `*-bundle.json`, `spike/results.json` and screenshots. Reproduction commands are in `CODEX_HANDOFF.md` §8; use production preview for everything except the existing source-module feature check.

## Status and remaining work

| Major item | Status | Limit |
|---|---|---|
| Job 2 access/travel/mastery, inspector and canonical quiz | COMPLETE | physical-device checks pending |
| Role-safe durable history and legacy compatibility | COMPLETE | no schema migration |
| Map spike and retain/replace decision | COMPLETE | prototype limits explicitly measured/reported |
| Atlas study interface, hotspots, catalogue, labels and controlled offline core | COMPLETE | existing cartographic content preserved |
| Gesture performance | PARTIAL | zoom-in regressed under throttle; physical-device profiling pending |
| Deeper regional cartography/zoom content | PARTIAL | existing 7× fit limit; no newly sourced detailed basemap |
| CORE/INDIA asset/version/install-status architecture | COMPLETE | offline requires initial service-worker installation |
| Optional REGIONAL downloads/removal and ONLINE range-loaded detail | DEFERRED | no verified packs/provider published; budgets/contracts explicit |
| Shared design-system/typography refresh | COMPLETE | mature screen editors retain established layouts |
| Typed actions, deterministic context/intents and Tars presence | COMPLETE | exact/unique known entities; no open-language/cloud control |
| Cross-feature continuity | COMPLETE | existing session/subject drill-down retained |
| Local tests/build/headless QA | COMPLETE | hosted CI execution pending push authorization |
| Physical iOS Safari / Android / WebView acceptance | DEFERRED | none performed in this run |

No material data-migration blocker. Remaining risks are phone GPU/frame variability, zoom-in spikes, browser-specific text halos/fullscreen behavior, the pre-existing World travel-coverage gap and unresolved geographic/data-quality queues. The map engine was retained because production parity was not demonstrated, rather than promoting an incomplete experiment.

Recommended next task: physical iOS/Android validation of timer wake/reload, touch camera/labels, fullscreen fallback, offline installation, complex PYQs and the connected study flow; then source/license a bounded regional-detail pilot and prove full renderer parity before any replacement. Geographic review remains a separate audited data task.

## Files and dependency boundary

Major changed/new modules: `src/tars/*` (registry/runtime/context/intents/commands/presence/selection/day and tests); `src/atlas/{access,mastery,assets.test,useHotspots}` and `src/atlas/pyq/{experience,catalog,browse}`; `src/features/atlas/{CanonicalQuiz,PlaceQuestions,PyqBrowser,OfflineAtlas,AtlasScreen,AtlasMap,PlaceDetails,PlaceSources,AtlasPanel,Gazetteer,ExpeditionSheet,Legend,FieldReview,UnitDetails,labels}`; app palette/shell/shortcuts/deep links; Focus/task/calendar action entry points and completion; Insights charts/mastery; shared Sheet/controls/CSS; `tools/build-atlas-assets.mjs`, `public/atlas-assets/v1/*`, `tools/map-spike/*`, new/updated QA scripts, `.github/workflows/ci.yml`, build/cache configuration and handoff/agent documentation. Job 1 canonical source, build pipeline and original generated outputs are not edited by Jobs 2–3.

**Root runtime dependencies added: 0. Database migrations: 0.** Isolated development dependencies: maplibre-gl 6.11.2, pmtiles 4.5.0, geojson-vt 5.0.4, vt-pbf 3.1.3, with their own lockfile. Root dependency/lock changes already present from Job 1 are preserved. No commit, push, PR or deployment occurred.

Exact Jobs 2–3 inventory: **82 files**, compared with the reconstructed Job 1 working tree. The root lockfile and all original Job 1 generated/source assets match the safety copy.

```text
.github/workflows/ci.yml
.gitignore
AGENTS.md
CODEX_HANDOFF.md
docs/TARS-VNEXT-JOB-2-3.md
package.json
public/atlas-assets/v1/manifest.json
public/atlas-assets/v1/pyq-hotspots.json
src/app/App.tsx
src/app/CommandPalette.tsx
src/app/Shell.tsx
src/app/shortcuts.ts
src/atlas/access.ts
src/atlas/assets.test.ts
src/atlas/mastery.ts
src/atlas/pyq/browse.ts
src/atlas/pyq/catalog.ts
src/atlas/pyq/experience.test.ts
src/atlas/pyq/experience.ts
src/atlas/useHotspots.ts
src/data/types.ts
src/features/atlas/AtlasMap.tsx
src/features/atlas/AtlasPanel.tsx
src/features/atlas/AtlasScreen.tsx
src/features/atlas/CanonicalQuiz.tsx
src/features/atlas/ExpeditionSheet.tsx
src/features/atlas/FieldReview.tsx
src/features/atlas/Gazetteer.tsx
src/features/atlas/Legend.tsx
src/features/atlas/OfflineAtlas.tsx
src/features/atlas/PlaceDetails.tsx
src/features/atlas/PlaceQuestions.tsx
src/features/atlas/PlaceSources.tsx
src/features/atlas/PyqBrowser.tsx
src/features/atlas/UnitDetails.tsx
src/features/atlas/labels.ts
src/features/calendar/CalendarScreen.tsx
src/features/calendar/EventSheet.tsx
src/features/focus/ExpeditionStrip.tsx
src/features/focus/FocusScreen.tsx
src/features/focus/ImmersiveFocus.tsx
src/features/focus/SessionCompleteSheet.tsx
src/features/focus/TimerDial.tsx
src/features/insights/AtlasInsights.tsx
src/features/insights/InsightsScreen.tsx
src/features/insights/charts.tsx
src/features/shared/focusOnTask.ts
src/features/tasks/TaskItem.tsx
src/features/tasks/TaskSheet.tsx
src/features/tasks/TasksScreen.tsx
src/index.css
src/tars/ContextMoment.tsx
src/tars/TarsPresence.tsx
src/tars/commands.ts
src/tars/context.ts
src/tars/intents.ts
src/tars/registry.ts
src/tars/runtime.ts
src/tars/selection.ts
src/tars/tars.test.ts
src/tars/useContext.ts
src/tars/useDay.ts
src/ui/Sheet.tsx
src/ui/controls.tsx
tools/build-atlas-assets.mjs
tools/map-spike/README.md
tools/map-spike/check.mjs
tools/map-spike/index.html
tools/map-spike/package-lock.json
tools/map-spike/package.json
tools/map-spike/prepare.mjs
tools/map-spike/server.mjs
tools/perf/atlas-check.mjs
tools/perf/bundle-profile.mjs
tools/perf/features-check.mjs
tools/perf/fullscreen-regression.mjs
tools/perf/load-profile.mjs
tools/perf/profile.mjs
tools/perf/tars-check.mjs
tools/perf/ui-audit.mjs
tools/perf/vnext-learning.mjs
vite.config.ts
```
