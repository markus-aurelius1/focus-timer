**2026-10-05 deployment task:** owner now explicitly authorizes one release checkpoint, push of `handoff/claude-overhaul` only and Cloudflare deployment. The accepted application remains frozen and the release decision below is unchanged. Deployment-only wiring/configuration is recorded in [Cloudflare handoff](TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md); no authentication or performance investigation is authorized. Historical no-publication statements below describe the prior readiness task.

# TARS final production-readiness pass — 2026-10-04

**STATUS: APPLICATION ACCEPTED FOR PRIVATE CLOUDFLARE DEPLOYMENT WITH AN OWNER-APPROVED SYNTHETIC GESTURE-BENCHMARK EXCEPTION.** Performance work is stopped and the accepted application source is frozen. No J-25 investigation, further renderer/compositor experiments or gesture rerun is authorized in this release pass. No deployment, authentication configuration, commit or push occurred.

## RELEASE DECISION

Application accepted for private Cloudflare deployment with a documented
synthetic gesture-benchmark exception on the current host. Existing gesture
budgets remain unchanged for future validation on a stable/physical device.

This is the explicit owner release decision, not a 33/33 gesture pass. Independent `about:blank` controls reproduced >400ms pauses without TARS/Atlas code; the exact external cause remains unresolved. Preserve the [historical J-24 profiling report](TARS-J24-GESTURE-REPAIR.md) and ignored raw measurements under `tools/perf/out/j24-repair/`. Earlier investigation proposals are historical and do not authorize further work.

The last complete synthetic timing run still fails these **four unchanged limits**:

| Phone measurement | Last measured result | Existing limit |
| --- | --- | --- |
| Zoom-in frames >100ms | 2 | 0 |
| Zoom-out p95 | 116.6ms | 34ms |
| Zoom-out frames >100ms | 5 | 0 |
| Back-pan maximum | 50.1ms | 50ms |

The timing result remains **29/33 pass, 4/33 fail**. No budget, assertion or timing metric was altered or deleted. It was not rerun after the owner stopped performance work.

## Final minimal release sanity — 2026-10-04

Only the eight requested checks ran, serially against the frozen source and current production build. Installed Chrome was selected through the existing test-only `CHROMIUM_PATH` support. Raw logs and exit records: `tools/perf/out/release-sanity/results.json` and per-suite logs in that directory. News uses production fixtures, not live Cloudflare publisher/auth verification.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; 0 errors, 175 existing warnings |
| `npm test` | PASS; 31 files, 229 tests |
| `npm run build` | PASS; output `dist/`, manifest/service worker, 157 precache entries |
| `node tools/perf/smoke.mjs http://127.0.0.1:4177/` | PASS; 100 checks, no page errors |
| `node tools/perf/current-affairs-check.mjs` | PASS; 251 checks, no page errors |
| `node tools/perf/atlas-check.mjs http://127.0.0.1:4177/` | PASS; 21 checks, no page errors |
| `node tools/perf/product-health.mjs http://127.0.0.1:4177/` | PASS; retained Atlas/News/Settings online and offline, no unexpected console/runtime errors |

Atlas rendering/search/selection and News work. Read/Saved persist through reload/cross-tab actions; dormant article-note and dated-note data remain preserved. No Notes UI, article reader, iframe or internal article-detail surface exists. Canonical PYQs/grading/recall/history retain the accepted source and packages: the earlier passing canonical/learning/recall verification below and in the J-24 report remains applicable; those extra suites were intentionally not rerun in this minimal set.

All **550 non-document entry hashes match** after the production build and sanity checks. No temporary experimental application edits remain to discard, and no temporary J-24 profiling/runtime switches leaked into production. Dexie declarations/migrations and stable identifiers (`lodestar`, `lodestar-study`, `app.lodestar.study`, `lodestar://`) remain unchanged. Existing accepted presentation/runtime edits were preserved exactly.

Current branch `handoff/claude-overhaul`, HEAD `43560abe415292e7c548f4180bab0c463265a6fd`; final working tree has **46 modified tracked paths and 18 untracked entries**, including the deployment handoff. No commit, push, deployment or authentication configuration. Build/backend/environment/routing/PWA/Cloudflare facts are in the [concise deployment handoff](TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md).

## Historical presentation-pass baseline

The sections below preserve the earlier implementation and verification record, including its original timing failures. They predate the later J-24 measurements and owner release exception above; historical blocking/scope statements are not the current release decision.

## Implemented

- **Shell:** 56px desktop top bar; mobile 52px top and 56px Atlas/News bottom navigation, plus safe areas. Settings and shared search remain auxiliary; no permanent desktop sidebar or retired productivity surfaces.
- **News:** wide editorial rows with a 180px desktop collection rail, compact mobile state navigation, on-demand search/filters, secondary Archive/Sources, direct safe canonical publisher links and existing Read/Saved state. No Notes pane/action/tab, article reader, iframe or scraping. Loading, stale/partial feeds, failure, empty date/filter and offline cache remain concise.
- **Atlas:** map dominates the viewport; small World/India, search and options strip, compact zoom and contextual utilities. Place selection opens a 400–432px inspector with 24px edge spacing or a detented mobile sheet; idle has no inspector. Missing places and empty search do not fabricate content.
- **Recall:** retained focused single-question presentation, tactile answer options and icon/text verdicts; canonical/native grading, explanations, mastery, attempts and recall history are preserved.
- **Settings/themes:** auxiliary Appearance, Atlas, News, General and Data/offline controls; Light/Dark/System. Geist/Newsreader, established semantic roles and protected Atlas font metrics remain. Secondary text/state contrast and coarse-pointer targets were corrected; decorative map loops were removed.
- **Hardening:** notification positioning preserves mobile zoom access. The only final-pass renderer change is a narrowly required two-line fallback fix: when packing exceeds the existing pixel budget, clear GPU readiness and remove its stale texture so native tiles remain visible. No camera/label/painter/cache-budget rewrite. The parity audit now also rejects stale GPU presentation hiding an unpacked native plane.

## Verification

Installed Chrome was selected through CHROMIUM_PATH. Tests ran serially against the production preview at 4177; dev-only diagnostics use 4178; the unchanged pixel harness uses 4179. Shell-style environment prefixes below describe PowerShell environment assignments used by the runner. Existing real package scripts were used. No limit, assertion or pixel tolerance was weakened and no snapshots were blindly accepted.

Core checks and all affected map/runtime checks were rerun after the narrow fallback fix. News, density/editorial/UI matrices, canonical preview and independent pixel/label-painter comparisons had already passed after the final presentation edits; the fallback branch does not change their presentation or painter inputs. Latest exit records: core-results.json, browser-results.json, fallback-results.json and supplemental-results.json under tools/perf/out/final. Earlier failures remain under first-run/pre-fallback for provenance.

| Command | Final result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; 0 errors; 175 warnings |
| `npm test` | PASS; 31 files / 229 tests |
| `node --test tools/atlas-build/test/canonical-pyq.test.mjs tools/atlas-build/test/gazetteer.test.mjs tools/atlas-build/test/pyq.test.mjs` | PASS; 42 tests |
| `npm run build` | PASS; 157 precache entries |
| `node tools/perf/density-check.mjs http://127.0.0.1:4177/` | PASS; 411 checks |
| `node tools/perf/editorial-check.mjs http://127.0.0.1:4177/` | PASS; 267 checks |
| `node tools/perf/current-affairs-check.mjs` | PASS; 251 checks |
| `node tools/perf/smoke.mjs http://127.0.0.1:4177/` | PASS; 100 checks |
| `node tools/perf/atlas-check.mjs http://127.0.0.1:4177/` | PASS; 21 checks |
| `node tools/perf/atlas-renderer-check.mjs http://127.0.0.1:4177/` | PASS; 5 modes |
| `node tools/perf/atlas-label-anchor-check.mjs http://127.0.0.1:4177/` | PASS; 40 checks |
| `node tools/perf/atlas-label-visibility.mjs http://127.0.0.1:4177/` | PASS; 90 checks |
| `node tools/perf/atlas-label-check.mjs http://127.0.0.1:4177/` | PASS; 6 configurations |
| `node tools/perf/atlas-cold-start.mjs http://127.0.0.1:4177/` | PASS; 6 checks |
| `SCHEME=light node tools/perf/vnext-learning.mjs http://127.0.0.1:4177/` | PASS; 104 checks |
| `SCHEME=dark node tools/perf/vnext-learning.mjs http://127.0.0.1:4177/` | PASS; 104 checks |
| `VIEWPORTS=390,1024,1280,1440 node tools/perf/ui-audit.mjs http://127.0.0.1:4177/` | PASS; 4 widths, both themes |
| `node tools/perf/fullscreen-regression.mjs http://127.0.0.1:4177/` | PASS; 4 checks |
| `node tools/perf/job4-offline.mjs http://127.0.0.1:4177/ tools/perf/out/editorial/baseline-source/dist` | PASS; 16 checks |
| `node tools/perf/error-recovery.mjs http://127.0.0.1:4177/ http://127.0.0.1:4178/` | PASS; 12/12 checks |
| `node tools/perf/product-health.mjs http://127.0.0.1:4177/` | PASS; online + offline retained surfaces |
| `node tools/perf/gesture-audit.mjs http://127.0.0.1:4177/ --counts --budget=tools/perf/budgets/gesture.json` | PASS; 29/29 budgets |
| `node tools/perf/gesture-audit.mjs http://127.0.0.1:4177/ --budget=tools/perf/budgets/tiles.json` | FAIL; 16 of 33 budgets exceeded |
| `node tools/perf/atlas-pixel.mjs http://127.0.0.1:4179/tools/perf/atlas-pixel.html` | PASS; 120 comparisons |
| `node tools/perf/atlas-label-parity.mjs http://127.0.0.1:4179/tools/perf/atlas-pixel.html` | PASS; 18 comparisons |
| `node tools/perf/atlas-cold-start.mjs http://127.0.0.1:4178/` | PASS; 6 checks |
| `node tools/perf/atlas-recall-check.mjs http://127.0.0.1:4178/` | PASS; saved once / reload / next-day due |
| `node tools/perf/readiness-states.mjs http://127.0.0.1:4177/` | PASS; 81 checks |
| `node tools/perf/atlas-tile-surface-check.mjs http://127.0.0.1:4177/` | PASS; 24 states |
| `node tools/perf/canonical-pyq-audit.mjs` | PASS; 149 questions at each of 375px and 1280px |

## Visual and accessibility acceptance

Inspected screenshot/browser evidence covers 1440×900, 1280×800, 1024×768 and 390×844 in Dark and Light: default India/World map, collapsed/open search, options/layers, selected/related inspector and mobile detents, neutral/selected/correct/incorrect quiz, all News collections, Archive/Sources/search/filters, settings and loading/error/stale/partial/empty/offline states. Matrices: tools/perf/out/editorial/matrix and tools/perf/out/final/states; inspected contact sheets: mobile-contact.png, desktop-contact.png, context-contact.png, tablet-contact.png, tablet-alternate-contact.png and failure-contact.png under out/final.

The 390px map has 736px available height; persistent map controls occupy about 4.94% of it. News fixture articles start at y≈177px, with three complete rows above the bottom switcher. At 1440px the map is 844px high with about 1.17% persistent-control coverage; News starts at y≈144px and shows five complete fixture rows. No horizontal page overflow was found. Keyboard/Escape, overlay focus restoration, accessible names/dialogs, active/pressed states, non-colour verdict/state cues, reduced motion and semantic text-role contrast were checked; tested text roles meet 4.5:1 on four theme surfaces.

## Performance — deployment blocker

The entry baseline was measured on the authoritative modified checkout BEFORE this final pass, using the same unmodified tools/perf/budgets/tiles.json and installed browser/device profiles. Baseline: **13 of 33 budgets exceeded**. Final: **16 of 33 budgets exceeded**. This is a hard failure, not a gate waiver or a production-ready claim. Historical pre-redesign evidence also shows the phone zoom gate failed (p95 233.2/133.3ms in tools/perf/out/editorial/baseline-timing-budget.log).

Continuous-zoom p95 in milliseconds; frame counts show zoom-in/zoom-out frames >100ms:

| Shape | Zoom-in baseline → final | Zoom-out baseline → final | >100ms frames baseline → final |
| --- | --- | --- | --- |
| desktop | 16.9 → 16.9 | 17 → 16.9 | 0/0 → 0/0 |
| laptop-hidpi | 17.1 → 18.4 | 17.3 → 18.7 | 0/2 → 1/0 |
| phone | 249.8 → 36 | 199.9 → 36.1 | 4/13 → 2/0 |

| Metric | Baseline ms | Final ms | Hard limit ms |
| --- | --- | --- | --- |
| Phone pan-short maximum | 649.7 | 375.8 | ≤50 |
| Phone pan-long maximum | 149.8 | 411.9 | ≤50 |
| Phone pan-back maximum | 1549.4 | 411.2 | ≤50 |

Phone label-position cost: baseline light 3.1 ms, dark 2.3 ms; final light 2.3 ms, dark 1.4 ms, all within the unchanged 6ms ceiling. The historical 10ms label failure is superseded. Repaint/count budgets pass 29/29. GPU/native pixel parity passes 24/24 after the isolated fallback fix; its original sustained mismatch (MAE 7.88, 7.75% high-error samples, versus ≤2 / ≤1%) is retained in pre-fallback logs.

These are local Chrome/emulation samples, with variability; zoom improvements do not establish complete gesture acceptance or prove every metric regression-free. Exact final failed limits:

- laptop-hidpi · zoom-in-continuous · over100: 1 is over the budget of 0
- laptop-hidpi · pan-short · max: 425.7 is over the budget of 50
- laptop-hidpi · pan-short · over100: 3 is over the budget of 0
- laptop-hidpi · pan-long · max: 442.1 is over the budget of 50
- laptop-hidpi · pan-long · over100: 3 is over the budget of 0
- laptop-hidpi · pan-back · max: 371.5 is over the budget of 50
- laptop-hidpi · pan-back · over100: 3 is over the budget of 0
- phone · zoom-in-continuous · p95: 36 is over the budget of 34
- phone · zoom-in-continuous · over100: 2 is over the budget of 0
- phone · zoom-out-continuous · p95: 36.1 is over the budget of 34
- phone · pan-short · max: 375.8 is over the budget of 50
- phone · pan-short · over100: 2 is over the budget of 0
- phone · pan-long · max: 411.9 is over the budget of 50
- phone · pan-long · over100: 1 is over the budget of 0
- phone · pan-back · max: 411.2 is over the budget of 50
- phone · pan-back · over100: 4 is over the budget of 0

J-24/J-25 were not entered. Further protected renderer optimization requires separate authorization. Physical iPhone/Android, packaged native runtime and WebKit were not verified by this local Chrome pass.

## Persistence, security and next deployment step

Dexie schema/migrations and all underlying personal-state modules are unchanged. IndexedDB **lodestar**, PWA ID **lodestar-study**, native ID **app.lodestar.study** and **lodestar://** remain unchanged. News Read/Saved and both dormant article-note stores survive reload/cross-tab; no note migration or deletion. Canonical/native recall writes, mastery/history, XP and due state are verified. All 2,273 unique Atlas IDs, all 149 canonical PYQs (72 CSE / 30 PCS / 47 CDS), canonical manifest hashes and generated packages are preserved.

Of 275 entry-protected file hashes, 274 are identical; the sole difference is BaseLayer.tsx's two-line fallback repair. Camera, labels, tile painter/cache, data/models/packages and native files are unchanged since entry. Additional Git checks find no changes to persistence/canonical/native/package contracts versus HEAD.

Production build, manifest/service-worker/precache, hash routes/direct place links/retired-route compatibility and clean/upgrade offline behavior pass. No new Vercel-only frontend dependency, localhost endpoint, client secret or app OAuth was introduced. Existing /api/current-affairs gateway/proxy and safe RSS text/external-link handling are retained. Cloudflare hosting/backend adapter and Access + Google allowlist configuration remain the separate deployment/auth task; no deployment or authentication verification is claimed here.

## Working tree

Branch handoff/claude-overhaul; HEAD remains 43560abe415292e7c548f4180bab0c463265a6fd. The pass began with 45 modified tracked paths and 15 untracked entries; final tree has 46 modified tracked paths and 16 untracked entries. Existing edits and Phase 1 remain intact. **No commit, push, PR or deployment.**

---

## Historical repair checkpoint (superseded)

The prior checkpoint is preserved below for provenance. Its scope, metrics and clean-tree statement describe that earlier execution, not this final pass.

# TARS repair checkpoint — 2026-10-04

**Status: Partial. The presentation redesign is implemented; production readiness is not accepted.** The final bounded verification passes core, News and renderer behavior, but fails both phone label-position cost gates. Hard gesture timing remains unaccepted. The owner's final instruction to finish quickly ends further optimization experiments; it does not waive performance gates.

## Implemented product

Editorial Cartography now covers the Atlas/News desktop and mobile shell, Midnight/Ivory semantic themes, locally licensed Geist/Newsreader, editorial external-link News, contextual Atlas inspector/mobile detents, single-question recall and auxiliary Settings. There is no active Notes UI, article reader or article-detail pane. Read/Saved, search, filters, archive and Sources use existing mechanisms. Historical notes remain dormant and intact.

The earlier complete responsive, theme, keyboard, reduced-motion and offline matrix is recorded in [the redesign report](TARS-EDITORIAL-REDESIGN.md). Its measurements are a pre-repair snapshot, not the current repair result.

## Retained bounded repairs

- News `useFeeds` aborts unfinished requests on cleanup, but no longer aborts completed responses. Aborting a completed response could cancel the service worker's outstanding cloned-body cache write. Two regression tests cover completed-response preservation and unfinished-request cancellation; cache policy and persistence remain unchanged.
- Atlas tile uploads are paced outside motion, with one pending bitmap and cancellation on pause/release/unmount. Planning/attachment waits for rest. Readiness requires both overview and detail coverage with consistent ink scale. The existing worker, bitmap renderer, tile painter, cache budgets and fallback remain.
- Identical curved-label rasters reuse their copied canvas. Point labels use a single HTML span where individual CSS translation is supported, with the original two-span fallback and unchanged metrics/anchors. Existing camera and per-word animation remain. A geometry audit checks real label coordinates during held zoom in both paths.
- Unsuccessful renderer/compositor experiments were removed from source; their measurements remain in ignored diagnostic output. No new map engine, shared scroll clock, CPU tile-copy path or visibility-hiding optimization is retained.

## Latest verification on the retained source

Installed Chrome was selected with `CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`. Commands ran serially, without concurrent unit/browser suites. Raw logs: `tools/perf/out/editorial/ready-*.log`; exit summary: `ready-results.txt`.

| Command | Latest result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errors / 176 warnings (baseline 188) |
| `npm test` | PASS, 31 files / 228 tests (baseline 30 / 225) |
| `npm run build` | PASS, 158 precache entries |
| `node tools/perf/current-affairs-check.mjs` | PASS, 251 checks; direct canonical links, no Notes/reader, Read/Saved and dormant notes across reload/cross-tab, archive, 503 cache preservation and offline; no page errors |
| `node tools/perf/atlas-renderer-check.mjs http://localhost:4173/` | PASS, all 5 modes: worker, low-power, fallback, delayed worker, worker error; coverage, ink parity, cache bounds and hidden/re-entry recovery |
| `node tools/perf/atlas-label-anchor-check.mjs http://localhost:4173/` | PASS, 40 actual-coordinate checks across both themes, desktop/phone, native translation/fallback and idle/held/settled zoom |
| `node tools/perf/atlas-label-check.mjs http://localhost:4173/` | FAIL, 4/6 configurations pass. Phone Light and Dark each cost 10 ms versus the unchanged 6 ms ceiling. Desktop and HiDPI cost 0.4–0.5 ms; font/size/retained-label checks pass in all six |

The earlier full redesign run also covered smoke (100), Atlas (21), learning (104 per theme), UI audit, editorial matrix (267), fullscreen (4), error recovery (12 production + 12 development), clean/upgrade offline (16), product health, pixel (120), parity (18), visibility (90), cold starts (6 production + 6 development) and recall persistence. These were not all rerun after the final bounded repairs; do not present them as fresh final production acceptance.

Hard timing was repeatedly measured with unchanged `tools/perf/budgets/tiles.json` through `gesture-audit.mjs`. The pre-repair full run failed 21/33 limits; later phone repair cohorts also failed. Some rejected experiments improved isolated samples, but none established complete acceptance and none is accepted as a substitute. No fresh all-shape timing rerun was performed after the final source restoration, to honor the request to finish quickly. Timing therefore remains **unaccepted**, not passed or waived. Earlier 29/29 repaint/count success cannot override these limits. Raw failures and cohort provenance remain in `tools/perf/out/editorial/`.

## Invariants and limitations

The renderer is retained with the bounded repairs above. Camera code, tile painter/cache implementation, canonical Atlas/generated packages and stable place IDs, canonical PYQ data/grading, recall/mastery history, Dexie schema/migrations and News personal-state modules have no substantive diff. IndexedDB `lodestar`, manifest `lodestar-study`, native `app.lodestar.study` and `lodestar://` stay unchanged. Package manifests and native project configuration have no substantive diff. No data migration, dependency or personal-state deletion.

Hard gesture performance and phone label cost block complete acceptance. J-24/J-25 are not marked accepted. Physical iPhone/Android, packaged native runtime and WebKit were not verified; desktop emulation cannot establish those results. Historical article notes have no durable timestamp field, remain unexposed, and acquire no fabricated dates.

Branch `handoff/claude-overhaul`, HEAD `43560abe415292e7c548f4180bab0c463265a6fd`; local changes remain uncommitted. Initial tree was clean and Phase 1 was preserved. **No commit, push, PR or deployment.**
