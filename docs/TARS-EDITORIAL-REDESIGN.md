# Editorial Cartography redesign — 2026-10-04

**Density correction, 2026-10-04:** content takes priority over chrome. Preserve Phase 1 tokens/themes/fonts. Phase 2 uses one 48px top bar with Atlas/News navigation at every width and safe-area clearance; no mobile bottom navigation. Phase 3 uses a compact News header/state tabs, search expanded on demand, filters/Sources in a contextual sheet/dialog and dense editorial rows. Phase 4 uses one small World/India + search + options strip, compact zoom, and no persistent bottom utility dock. Legend, fit, hotspots, fullscreen, review and Atlas tools remain inside Map options. Existing contextual inspectors, data and personal state remain. This supersedes earlier spacious layout instructions. Evidence: `docs/TARS-DENSITY-CORRECTION.md`.

> Pre-repair verification snapshot. The owner subsequently authorized bounded runtime repairs. See [the latest repair checkpoint](TARS-PRODUCTION-READINESS.md): final News 251 and renderer 5-mode suites pass; phone label cost and hard gesture timing still prevent production acceptance. Historical measurements below remain preserved and are not the latest repair results.

The owner's current instruction authorizes presentation and interaction work on Atlas, News and auxiliary Settings. It supersedes the earlier overhaul pause. J-24/J-25 remain protected and unaccepted. No publication is authorized.

## Preflight

- Local authoritative checkout: `focus-timer`, branch `handoff/claude-overhaul`, HEAD `43560abe415292e7c548f4180bab0c463265a6fd`.
- Initial `git status --short --branch`: clean, tracking `origin/handoff/claude-overhaul`. Diff stat/name-only and uncommitted-file inventory: empty.
- Read AGENTS, roadmap, operational handoff, scripts, shell/router/theme/palette, shared surfaces, Atlas selection/details/review, News workspace and personal-state mechanisms, Settings.
- Protected map: `AtlasMap.tsx`, renderer workers, tile/cache/camera/label algorithms and their font metrics. Presentation lives in `AtlasScreen.tsx`, details and review surfaces. Selection invokes existing select/reveal/fly methods; no renderer replacement.
- News: existing RSS gateway → classifier → clusters/workspace → local archive. Read/Saved/ignored/article note use `tars.current-affairs.state.v1`, keyed by canonical URLs and patched across cluster members. Saved retains existing precedence. Article notes have an 8,000-character limit and no timestamp field. Dated independent short notes remain in `tars.current-affairs.notes.v1`, with immutable creation dates and 300-character limit. No new storage/schema.
- Legacy identifiers, Dexie v1/v2 and generated source remain protected. Root/unknown/retired routes already resolve to Atlas.

## Baseline

- `npm run typecheck`: pass.
- `npm run lint`: pass, 0 errors / 188 existing warnings.
- `npm test`: 30 files / 225 tests pass.
- `npm run build`: pass, 154 precache entries.
- `node tools/perf/smoke.mjs http://localhost:4173/`: 100 checks pass, no page errors.
- `node tools/perf/product-health.mjs http://localhost:4173/`: online/offline painted tiles and retained routes pass, no console/runtime errors.
- `node tools/perf/gesture-audit.mjs http://localhost:4173/ phone --budget=tools/perf/budgets/gesture.json`: baseline already exceeds hard renderer timing gates (continuous zoom-in p95 233.2 ms, max 533.1 ms). This is not UI acceptance and not authorization to modify J-24/J-25.

## Verification record

The owner's later News delta is authoritative: no active Notes controls/editor/pane, no article detail/reader. Both note stores remain dormant. Phase 1 was retained, not reset or discarded.

| Phase | Bounded implementation | Checkpoint |
| --- | --- | --- |
| 1 | Midnight/Ivory semantic tokens, blue interaction/gold knowledge, local OFL Geist/Newsreader, control radii; Manrope cartographic metrics retained | Shared primitive/surface tests: 30 pass; typecheck/build pass |
| 2 | One 48px top product bar at every width; no bottom switcher; auxiliary search/theme/Settings; routes/kept Atlas unchanged | Route/deep-link tests 6 pass; production smoke 100 pass |
| 3 | Dense editorial RSS rows, slim header/state tabs, collapsed search, contextual filters/Sources, excerpts/real thumbnails, archive/Read/Saved/remove Undo; no Notes or reader UI | News unit tests 81 pass; revised production fixture suite 251 pass |
| 4 | Small region/search/options strip, compact zoom, no persistent utility dock; selected right inspector and existing 144/420/full mobile detents; facts/relations/PYQ/mastery hierarchy | Atlas interaction suite 21 pass, desktop/phone; no renderer edits |
| 5 | One-question focused review, native radios/AnswerTile, icon/text verdicts and keyboard shortcuts; retained Settings categories | Learning 104 checks each theme; typecheck/build pass |
| 6 | Responsive/theme/focus/reduced-motion/offline/paint-order hardening, surface-stack/native Back integration and verification | Final results below; hard renderer timing remains a separate blocking acceptance constraint |

### Deliberate audit adaptations

- Sidebar collapse/expand workloads become News/Settings return workloads with the **same** repaint ceilings. Fullscreen and error recovery check the top product bar; mobile navigation retains two >=44px products. Map coverage/camera/selection/gesture assertions stay intact.
- News Notes/analytics UI expectations are replaced by direct Open Original/publisher assertions, no Notes/editor/reader assertions and preservation of both dormant note mechanisms. Classifier, queues, cluster precedence, archive, cross-tab, failure/offline and Workbox cache assertions remain.
- Cold-start/News checks select the visible rail or mobile tabs; retained learning/label harnesses wait for actual map/label readiness before measurements. No arbitrary timing delay, threshold reduction or golden concealment.
- Added `editorial-check.mjs`: 1440x900, 1280x800, 1024x768, 390x844 in both themes; idle/selected/related/search/layers, mobile detents, canonical neutral/selected/correct/incorrect, direct publisher links, Read/Saved reload, dormant notes, archive/search/filters/Sources, Settings, reduced motion and actual kept-map overlay paint order. Images/results are in ignored `tools/perf/out/editorial/matrix/`.

### Invariants checked

No changes to `AtlasMap.tsx`, renderer/camera/label/tile/cache algorithms, `src/atlas`, `src/data`, `src/current-affairs` logic, personal-state/feed/archive hooks, canonical/generated source packages, package dependencies or native/PWA identity configuration. `lodestar`, `lodestar-study`, `app.lodestar.study` and `lodestar://` remain. UI calls existing selection, grading, durable attempt and Read/Saved patches; dormant notes are preserved verbatim. No commit, push, PR or deployment.

### Investigation records

An unchanged local-HEAD archive was built in ignored `tools/perf/out/editorial/baseline-source/`, without checking out/resetting the authoritative tree. Its original News suite passes 279 checks. The redesigned suite intermittently lost the API cache after failed refresh in earlier full runs; isolated Workbox and a full diagnostic run pass (5 and 251 checks), with no cache deletions recorded and no feed/persistence application change. Final normal rerun is recorded below. Initial simultaneous browser/unit runs exhausted two Vitest worker startups; final core validation runs without concurrent browsers.

Hard timing is evaluated using the existing `tools/perf/budgets/tiles.json`, independently of the repaint/coverage count budgets in `gesture.json`. A passing count suite cannot override failed timing. J-24/J-25 remain untouched and unaccepted.

## Final functional verification

Commands ran from `focus-timer` with `CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`. Production application URL: `http://localhost:4173/`; development checks used `http://localhost:5173/`. The separate production pixel/parity harness used `http://localhost:4175/tools/perf/atlas-pixel.html`. Raw logs, screenshots and the non-destructive HEAD comparison are retained in ignored `tools/perf/out/editorial/`.

| Exact command / suite | Final result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 errors, 176 warnings (baseline 188) |
| `npm test` | PASS: 30 files, 225 tests (baseline 225) |
| `npm run build` | PASS: 158 precache entries (baseline 154) |
| `node tools/perf/smoke.mjs http://localhost:4173/` | PASS: 100 checks |
| `node tools/perf/atlas-check.mjs http://localhost:4173/` | PASS: 21 checks |
| `$env:SCHEME='light'; node tools/perf/vnext-learning.mjs http://localhost:4173/` and the same with `'dark'` | PASS: 104 checks per theme |
| `node tools/perf/ui-audit.mjs http://localhost:4173/` | PASS: 8 viewport sizes, both themes; no layout problems |
| `node tools/perf/editorial-check.mjs http://localhost:4173/` | PASS: 267 checks; all four requested sizes, both themes |
| `node tools/perf/current-affairs-check.mjs http://localhost:4173/` | **FAIL in final full run after 247 passing checks:** last successful API cache missing after 503. Earlier full runs passed 251; direct links, Read/Saved and dormant-note checks pass. See cache comparison below. |
| `node tools/perf/fullscreen-regression.mjs http://localhost:4173/` | PASS: 4 repeated exit cycles |
| `node tools/perf/error-recovery.mjs http://localhost:4173/ http://localhost:5173/` | PASS: 12/12 production/development checks |
| `node tools/perf/job4-offline.mjs http://localhost:4173/ tools/perf/out/editorial/baseline-source/dist` | PASS: 16 checks, clean installation and unchanged-HEAD-build upgrade |
| `node tools/perf/product-health.mjs http://localhost:4173/` | PASS: settled online/offline painted tiles, News and Settings; no runtime errors |
| `node tools/perf/atlas-renderer-check.mjs http://localhost:4173/` | PASS: 5 worker/fallback/low-power/error/delayed modes |
| `node tools/perf/atlas-pixel.mjs http://localhost:4175/tools/perf/atlas-pixel.html` | PASS: 120 comparisons; unchanged pixel thresholds |
| `node tools/perf/atlas-label-parity.mjs http://localhost:4175/tools/perf/atlas-pixel.html` | PASS: 18 comparisons |
| `node tools/perf/atlas-label-check.mjs http://localhost:4173/` | **FAIL in final run: 5/6 gates pass**, phone positioning 6.9ms exceeds 6ms. Earlier isolated run passed 6/6 at 2.7ms; fonts/retained sizes still pass. |
| `node tools/perf/atlas-label-visibility.mjs http://localhost:4173/` | PASS: 90 paint-order/selection checks, 3 sizes, both themes |
| `node tools/perf/atlas-cold-start.mjs http://localhost:4173/` and `… http://localhost:5173/` | PASS: 6 cases each |
| `node tools/perf/atlas-recall-check.mjs http://localhost:5173/` | PASS: one saved attempt, grading/mastery reload, +1 XP, next-day due; no legacy Focus writes |
| Existing `budget.mjs` applied to full gesture JSON with `tools/perf/budgets/gesture.json` | PASS: 29/29 repaint/coverage/count gates |
| `git diff --check` | PASS |

Earlier overloaded label measurements failed (phone 7.9/11.1ms vs 6ms), then an isolated run passed; the latest run fails one gate at 6.9ms. Logs retain every outcome. No algorithm or threshold was changed. The latest full News run again fails the intermittent 503 cache assertion after 247 checks; no business/persistence repair was introduced. These functional results do not grant J-24/J-25 performance acceptance.

## Performance gate and acceptance status

**STATUS: Partial.** The requested presentation and interaction work is implemented, including the owner's revised external-link-only News requirement. Full acceptance is withheld because hard Atlas frame-timing budgets, one label-position cost gate, and the latest full News cache assertion do not pass. Renderer optimization/J-24/J-25 is not authorized and was not attempted.

Final command: `node tools/perf/gesture-audit.mjs http://localhost:4173/ <shape> --budget=tools/perf/budgets/tiles.json`, run serially for `desktop`, `laptop-hidpi`, and `phone`. The budget file is unchanged. Final JSON copies and measurements are in `tools/perf/out/editorial/final-<shape>.json` and `timing-summary.json`.

| Shape | Zoom in p95 / max / frames >100ms | Zoom out p95 / max / frames >100ms | Pan max: short / long / back | Failed hard limits |
| --- | --- | --- | --- | --- |
| Desktop | 33.5 / 150 / 1 | 49.4 / 66.6 / 0 | 83.3 / 66.6 / 66.6 | 6/11 |
| HiDPI | 33.3 / 66.8 / 0 | 33.3 / 50.1 / 0 | 66.7 / 66.6 / 66.6 | 5/11 |
| Phone, 4x CPU | 83.3 / 249.9 / 2 | 999.7 / 1216.1 / 17 | 233.3 / 133.2 / 2332.2 | 10/11 |

All times are milliseconds. Total: **21 of 33 limits fail**. All three heap limits pass (18.6MB), and all 29 repaint/coverage/count limits pass. Desktop/HiDPI zoom p95 must remain <=20ms, phone <=34ms, zero frames >100ms, and pan max <=50ms. Count success does not override timing failures.

The initial phone baseline failed 9/11 timing limits. An archived unchanged-HEAD desktop build later passed 11/11. Earlier redesigned serial runs failed 3/11 desktop, 1/11 HiDPI and 8/11 phone; a further isolated desktop run failed 4/11. Measurements are volatile and the retained map dimensions also differ (new desktop 1440x844, phone 390x736). These samples do not establish an improvement or prove every failure pre-existing. They expose an unresolved full-width Atlas performance risk. Raw failures remain retained. No threshold/golden was lowered or failing assertion deleted.

A presentation-only CSS diagnostic scoped the shell's additional stacking context to the inactive kept map. That bounded adjustment is retained: inactive overlays remain contained behind News; active Atlas avoids an unnecessary parent context. Subsequent timing still fails. No renderer internals were changed to chase those results.

## Deviations and working tree

- Hard Atlas frame timing and one label-position cost gate remain unaccepted; J-24/J-25 remain protected. The full News cache test also has an unresolved intermittent failure. These block complete acceptance.
- Physical iPhone/Android, packaged Capacitor runtime and WebKit acceptance were not available. Native identifiers/configuration remain untouched; Back uses the existing shared surface stack. Desktop mobile emulation is not physical-device acceptance.
- No active News notes UI exists. Historical article notes have no durable timestamps; they remain untouched and unexposed, so no fabricated dates or migrations were added.
- Local official-upstream WOFF2 fonts and OFL metadata are bundled; no font substitution deviation or runtime dependency was required.
- Branch remains `handoff/claude-overhaul`, HEAD `43560abe415292e7c548f4180bab0c463265a6fd`. 33 tracked files modified; five new path groups (report, fonts, Atlas presentation CSS, QuestionSurface, editorial audit). No source/package deletion, migration or publication. Build-generated Atlas inventories are byte-equivalent in Git.
- **No commit, push, PR or deployment.** No pre-existing local changes were discarded; initial authoritative tree was clean. Ignored artifacts include preflight/baseline/checkpoint/final evidence and a `git archive` HEAD comparison, never a reset/checkout of the working tree.

### Final News cache comparison

The latest full News run passes 247 assertions then fails `Workbox: 503 preserves last successful response` (CacheStorage keys empty). A separate diagnostic also failed; a later early-instrumented diagnostic passed all five offline assertions and recorded no cache deletion calls. Instrumentation is optional and does not change production code or assertions.

To compare identical cache assertions across source versions, the fixture harness supports optional `CA_DIST` (default unchanged `dist/`) and existing `--workbox-only`. `$env:CA_DIST='tools/perf/out/editorial/baseline-source/dist'; node tools/perf/current-affairs-check.mjs --workbox-only` passes three of three runs; clearing `CA_DIST` and running the same command against the redesigned build also passes three of three runs. All six use the same unmodified cache/offline assertions, with `CACHE_DIAGNOSTIC` unset. Results: `cache-comparison.txt`, `baseline-workbox-1..3.log`, `current-workbox-1..3.log`.

This does not establish a root cause or reclassify the latest full-suite failure as a pass. The existing SW cache policy and feed/personal-state code remain untouched. Read/Saved and dormant notes still pass reload/cross-tab checks; archive fallback and clean-install/build-upgrade offline behavior pass independently. No loss of personal state is observed. A cache repair beyond presentation requires a separately scoped runtime investigation; complete acceptance is withheld.
