# J-24 · Atlas tile renderer (in progress)

Continuation from handoff/claude-overhaul, checkpoint 3e43def. J-23 was accepted first. On 2026-10-03 the owner authorized bringing forward the J-25 label work necessary for J-24’s phone gate. Both jobs still require separate acceptance. No later roadmap job has started. No commit, push, main merge or deployment is authorized.

Current scope supersedes that checkpoint: Focus, Planning, timer expeditions and their media were removed. The owner has resumed only Atlas/News/shared overhaul work under `TARS-ATLAS-NEWS-ROADMAP.md`. The obsolete media-quality follow-up is retired. All persistence/source-data protections remain in force.

## Implementation

- 512-device-pixel tile addresses at powers of two. Centre-first visible requests, an overscan ring, then adjacent levels; dense DPR3 coverage chooses a level that fits the bounded cache.
- Stroke chunks capped at256 segments, with bounding boxes, grid lookup and accumulated dash offsets. Complete rounded polygon paths retain holes and winding. No source coordinates, data or place IDs change.
- A worker owns source images and native paths. Software-backed drawing avoids competing with the page GPU. One pending bitmap and idle uploads bound transfer pressure. Main-thread fallback uses the same painter, one tile per idle slice.
- Canvas LRU24 low-power/48 normal; eviction detaches and releases backing stores. An overview stays beneath requested levels. The previous level stays visible until wanted coverage is complete, then fades. Adjacent prefetch canvases stay detached.
- Travel has independent keys and complete replacement tiles for intersecting units. Ready progress tiles replace the matching base canvas while retaining its cache resource; no duplicated boundary stroke or accumulated tint. The abandoned masked-overlay branch has been removed.
- Style and travel signatures map to short, bounded keys; camera frames do not hash full colour/source arrays. Requests reject stale IDs/generations. Navigation pauses work; long-hidden views release and recreate resources. Release is guarded against obsolete timers; worker callbacks reject obsolete instances.
- Parks follow the existing1.7× fitted close-zoom threshold, changed at rest. Controlled-region visibility remains independent of the park threshold.
- Opaque uploads composite transparent relief nodata over the actual Paper/Night/Antique page background. Theme changes update those keys. This repairs a black-nodata regression found by visual inspection; earlier painter-only parity was insufficient.

## Evidence

- Root304/304 tests in35 files; typecheck/build pass (237 precache entries/7,484.31KiB before removal of the unused mask branch). Lint0 errors/402 warnings, matching the checkpoint. Source updates still require final build/checks before acceptance.
- Atlas21/21; learning104/104 in Paper and104/104 in Night. Clean-install offline checks pass, including unvisited canonical question/answer, local timer/calendar actions and content hash verification. Repeat offline against the final worker build.
- Worker, low-power, shared-painter fallback and delayed-worker modes passed bounded cache,49-point coverage sampling and release/recreate checks before the latest upload/background changes. The production60-second release timer was mapped to100ms only in QA; coverage is geometry sampling, not pixel proof. Repeat against the final candidate.
- Current parity:96/96 samples at an **engineering provisional** MAE<=2/255 and<=1% pixels with channel delta>32. Maximum MAE1.115751, high-delta fraction0.421525%. The opaque-context comparison composites the SVG reference over the same paper and includes complete progress results. India/World × Physical/Political/Night/Antique × three zoom levels include explicit Trans-Karakoram, Syunik, Arunachal Pradesh and Indonesia samples plus boundary vertices. No owner-agreed tolerance or job acceptance is claimed; screenshot review remains required.
- The first full candidate passed desktop/HiDPI continuous zoom (16.8–17.2ms p95, zero>100ms), but failed phone. The latest full unscaled-HTML/compositor/symbol candidate also failed10/11 phone timing budgets: continuous in249.7ms p95/12 frames>100; out195.8ms/6>100; pan maximums exceed50ms. Heap21.5MiB meets31.2MiB. This run predates short keys, restored park threshold and paper composition; it is a failure record, not final evidence.

## Gates still open

All-shape timing (desktop<=20ms, phone4×<=34ms, zero>100ms, pan-end<=50ms); final coverage/style/progress/lifecycle/fallback checks; agreed pixel tolerance and visual review; final smoke/offline/Atlas/learning/theme/layout checks; counts budgets, heap and diff review. The current timing file conservatively checks the whole pan maximum, not just its end. Neither J-24 nor J-25 is accepted.

Raw ignored artifacts: tools/perf/out/codex-j24/. Main-thread traces use CrRendererMain metadata, not the busy tile worker. Hardware is Windows/system Chrome/Intel UHD630 at emulated shapes, not a physical phone.

### Continued verification

Latest root build/typecheck passes238 precache entries/7496.30KiB;307 tests in36 files pass. Smoke12/12 passes against the worker-placement build, including the migrated symbol tap selector and offline reload. The fallback now cancels/ closes a pending idle bitmap and advances its revision before replacing a failed worker. Renderer QA adds a forced worker-error/stale-response mode; its latest run is pending. Worker label placement has a separate18/18 main/worker real-font parity record and does not alter base cartography or history.

Latest full retained-animation phone results, preceding worker placement, still fail9/11 budgets: continuous zoom36/105.6ms p95,0/2>100ms,pan maxima340/339.7/496.9ms,heap21.2MiB. Low available RAM (0.307GiB out of7.875GiB;0.552GiB after stopping unused owned servers) is a material benchmark condition. Owner agreed to free memory; final timing must be rerun and pass, not dismissed as environment noise. No gate is waived and later jobs remain unstarted.

### Fresh-memory timing and worker recovery

All five renderer modes pass, including the injected worker-error mode and stale bitmap callback. Cache24/48 bounds, visible fallback coverage and release/recovery checks remain passing. A fresh full phone run after the owner freed memory failed10/11 budgets: zoom p95 89.8/160.5ms,3/2 frames>100; whole-pan maxima820.6/838.7/751.9ms; JS heap20.6MiB. These failures are retained. Whole-pan maxima are a conservative diagnostic, broader than the audit’s pan-end window.

The necessary J-25 work now moves curved glyph painting to the existing worker with pixel-identical output (327 curve comparisons, MAE0). Current308 tests and production typecheck/build pass (238 precache entries/7503.12KiB), smoke12/12. A subsequent short phone comparison still misses timing at50.1/66.7ms p95 with2/2 frames>100. Final full timing, visual/offline reruns and owner-agreed map pixel tolerance remain pending. J-15 and later work have not started.

### Shared snapshots and coarse fallback repair

The shared-commit source passes309 tests/36 files and typecheck/build (238 entries/7503.21KiB). The most recent full phone run before that repair remains a failure:9/11 budgets, zoom116.6/133.4ms p95,4/6 frames>100,pan maxima133.3/83.3/166.6ms,heap20.7MiB. A later count-only run passes9/9 after symbol/name snapshot coupling. Its tap selected an offscreen symbol, so the harness now requires an actually visible symbol and needs rerun; no selection success is inferred from that record.

Pinch screenshots revealed a genuine coarse-fallback defect missed by the earlier96 parity samples: stroke widths used raster density instead of the requested ink scale, so fallback boundaries became huge when enlarged. The overview now keys and paints with the wanted ink scale, retains its predecessor until both planes exist, reserves their cache capacity and stays beneath detail via layer order. Production overview build passes238 entries/7503.67KiB; renderer5/5 passes, including ink-scale agreement, cache bounds, never-blank samples and recovery. Expanded parity adds24 coarse whole-sheet cases at three distinct view/raster ratios. Initial expanded parity failed six India Physical/Antique cases at the unchanged provisional high-delta limit; high-quality image downsampling is being tested, not a threshold relaxation. Final source checks and visual/timing acceptance remain pending.

## Resumed Atlas + News checkpoint — 2026-10-03

The owner resumed the overhaul after retiring Focus/Planning. J-24 remains the active gate. `BaseLayer` now retains the queue/LRU order for equivalent ready coverage, including adjacent-level prefetch addresses. Incomplete coverage continues to retry; pause, style reset, worker fallback and resource release clear the reuse key. Camera placement, cache limits, ink scales, source geometry and persistence are unchanged. This is a bounded queue optimization, not a claim that the frame stalls are fixed.

The isolated parity harness accepts an `assets` URL parameter so it can use the actual production preview. It no longer retains 240 full-size canvases or requests one enormous screenshot: 16 bounded reference/painter pairs remain reviewable. The initial numerical run passed all cases but its full-page capture timed out; the revised runner completes successfully.

- Renderer correctness: 5/5 modes (worker, low-power 24 tiles, no-OffscreenCanvas fallback, delayed worker and worker failure). Every sampled coverage grid has zero misses; cache bounds, ink-scale agreement and hidden release/recreate pass with no page errors. This is sampled geometry coverage, not per-pixel proof.
- Tile parity: 120/120 against unchanged provisional MAE ≤2/255 and >32-channel-delta pixels ≤1%; maximum MAE 1.180472, maximum high-delta fraction 0.421524%. Includes the 24 coarse fallback cases; high-quality downsampling now passes. Owner agreement on the tolerance is still pending. Representative controlled-region/reference pairs were visually inspected; source packages and ids are unchanged.
- Final-code phone timing: three serial production runs at 390×844, DPR3, CPU4× on the Windows Intel UHD630 host. Free RAM at run start: 2094/1482/1776 MB. No concurrent test/build/browser suite ran during those timings. This is emulation, not a physical-phone result.

| Measurement | Median | Range across 3 runs | Gate |
| --- | --- | --- | --- |
| Continuous zoom-in p95 | 53.3 ms | 33.4–99.8 ms | ≤34 ms, failed |
| Continuous zoom-out p95 | 100 ms | 83.4–150 ms | ≤34 ms, failed |
| Zoom-in worst frame | 316.5 ms | 266.8–499.9 ms | Zero >100 ms; counts 2/3/1, failed |
| Zoom-out worst frame | 250 ms | 199.9–349.7 ms | Zero >100 ms; counts 1/7/2, failed |
| Whole short-pan worst frame | 133.2 ms | 36.1–133.3 ms | Harness ≤50 ms, failed |
| Whole long-pan worst frame | 83.3 ms | 66.7–373.7 ms | Harness ≤50 ms, failed |
| Whole back-pan worst frame | 266.6 ms | 149.9–409.4 ms | Harness ≤50 ms, failed |
| JS heap | 18.5 MiB | 18.3–18.7 MiB | ≤31.2 MiB, passed |

Budget failures: 8/11, 9/11 and 8/11. The existing pan harness measures the entire gesture; it is conservative relative to the specification's end-pan wording and has not been weakened. Full-gesture label positioning maximum ranges 4.8–6.3 ms (median 5.9); an isolated passing pinch sequence does not supersede the 6.3 ms phone outlier. Traces still contain substantial `Layerize`, style update and commit work; memory alone does not explain the failure. The earlier baseline and first guard trial had different free-memory conditions, so no attributable before/after speedup is claimed.

Evidence (ignored): `tools/perf/out/resumed-baseline/phone.json`, `out/resumed-queue-check/phone-initial-guard.json`, `out/resumed-final/phone-{1,2,3}.json`, `out/resumed-final/summary.json`, `out/codex-j24/renderer-check.json`, `out/codex-j24/pixel.json` and 16 `pixel-*.png` pairs. Root production build passes with 154 precache entries / 7015.33 KiB. Retained product/map/offline/console regressions pass; broader final regression results are in `CODEX_HANDOFF.md` §5b.

J-24/J-25 remain unaccepted. J-15 and later jobs have not been advanced past the failing renderer gate. No thresholds, architecture rules, database declarations, runtime dependencies or generated data were changed. No commit, push, merge or deployment.
