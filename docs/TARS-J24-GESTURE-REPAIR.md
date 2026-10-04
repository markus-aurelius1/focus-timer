# J-24 gesture performance investigation — 2026-10-04

**Investigation closed by owner release decision (2026-10-04).** Stop performance work and do not investigate J-25. The application is frozen and accepted for private Cloudflare deployment with a documented synthetic gesture-benchmark exception on the current host. This historical report, its four failures and all budgets remain preserved; its proposed investigation directions are not current authorization. See [current release decision](TARS-PRODUCTION-READINESS.md) and [deployment-only handoff](TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md). No further gesture run or renderer experiment is part of the release freeze.

**Status: BLOCKED.** The presentation remains accepted and frozen; J-25 remains out of scope. The complete final hard-gate command finishes with **4 of 33 budgets exceeded**. The owner additionally authorized investigation of the Chrome/headless benchmark environment and freed memory for a controlled rerun. No replacement architecture has been implemented; the source-level stop boundary is documented below. J-24 performance acceptance remains open.

## Baseline, scope and preservation

Started from HEAD 43560abe415292e7c548f4180bab0c463265a6fd on handoff/claude-overhaul, with the authoritative 46 modified tracked paths and 16 untracked entries. The accepted entry production result was 16/33 failed limits: phone zoom p95 36.0/36.1ms, long/back pan maxima 411.9/411.2ms. Entry source copies, hashes of 550 non-document files and all three raw timing JSONs are preserved under tools/perf/out/j24-repair.

No production-source, renderer, camera, label, News, shell, UI, data, PYQ, persistence, schema, ID, dependency, budget or test change is retained. All 550 entry file hashes remain identical. The earlier two-line native/GPU fallback repair is preserved exactly. Only authorization/handoff/report documentation changed. No commit, push or deployment.

## Measured bottleneck and uncertainty

Large rAF frame-delivery gaps occur without corresponding JavaScript long tasks. The fresh complete baseline reproduced phone long/back-pan maxima 411.4/395.4ms and failed 24/33 limits. A timed API profile measured the slowest tile drawArrays call at 1.5ms; the sampled tile API calls do not explain a 400ms pause. CPU profiling reproduces 388.8/386.5ms long/back-pan gaps while recording no long tasks. Native/program/idle attribution is substantial; this is not proof of a specific driver or OS cause.

The decisive control removes the entire application, navigates to about:blank and installs only plain placeholder elements so the identical pan measurement/input sequence can run. Its back-pan has a **430.2ms** maximum and **two frames >100ms**, with zero Atlas code, tile/label work, layout or long tasks. Repeated independent empty-page controls also paused: 483.1ms installed Chrome, 383.3ms bundled headless Chromium. A desktop CPU1 empty page paused for 266.7ms. Therefore neither Atlas code nor CPU4 emulation is necessary to produce this large-stall symptom. This does not establish that every zoom failure has the same cause. The exact external cause of those pauses remains unresolved.

The unmasked API-instrumented failing phone run recorded no tile texture upload during its failing timing phases. Its 2,416 tile draw calls cost 206ms total, maximum 3.3ms; 45 bitmap transfers cost 11.5ms total, maximum 2.7ms. A 95.7ms tile upload occurred in a different masked diagnostic cohort; it is not evidence that uploads caused the unmasked 400ms pauses. An incremental-upload renderer experiment was therefore not implemented.

Host counters recorded a minimum 273MB free physical RAM and peaks of 55,065 page-ins/sec. After the owner freed memory, an original-command rerun still failed 14/33 limits. Paging is an observed pressure condition, not a proven exclusive explanation or a gate waiver. The timer-policy experiment honored requested timer resolution on owned Chrome processes only, preserving other power policies and CPU4; it still failed 7/33 limits and is rejected as a sufficient cure. No OS-wide timer, power-plan, priority or CPU-emulation change was made.

A bounded Windows CPU/context-switch recording captured zero lost events. The renderer had waits up to 184.729ms (UserRequest) and 172.529ms (Executive), but the longest recorded CPU-emulation suspension was 14.469ms. This rejects the unsupported claim that a 400ms throttle-thread suspension was identified. That control timed out and has no complete JavaScript frame log, so its scheduler events cannot establish an exact cause of a particular rAF gap. Recording was stopped; ETW/process metadata remain ignored local artifacts.

The default Playwright headless-shell uses SwiftShader/software compositing on this host: desktop zoom p95 116.7/83.4ms, with trace time dominated by ReadPixels/command-buffer waits/software composition. This rejected diagnostic was deliberately stopped, has no 33-budget verdict and is not used as final acceptance. The installed full Chromium executable could not launch in the restricted environment (spawn UNKNOWN); its separately recorded unrestricted comparison uses Intel/D3D11. Browser build, execution restrictions and time are separate variables; do not attribute an improvement to one without matched evidence.

Enabling Chrome tracing materially changes timing: the traced first three pans measured 33.5/33.2/50.0ms. That cohort is diagnostic only and is not used to claim acceptance. The original script and untouched limits remain the acceptance authority.

## Hypotheses and experiments

All experiments used isolated browser contexts and ignored diagnostic scripts; none modified application sources or the shipped test harness. Visibility suppression was used solely to attribute costs, never to claim a correct or passing product. No hidden/deferred rendering, altered camera timing, reduced pixel quality or J-25 optimization is shipped.

| Phone cohort | Pan short / long / back max ms | Frames >100ms, short / long / back |
| --- | --- | --- |
| Accepted presentation entry | 375.8 / 411.9 / 411.2 | 2 / 1 / 4 |
| Fresh full baseline, unchanged application | 427.7 / 411.4 / 395.4 | 3 / 2 / 2 |
| Native tile presentation diagnostic; WebGL tile context disabled | 388.7 / 394 / 394.1 | 2 / 2 / 3 |
| Tile visibility isolation; not a product candidate | 49.9 / 66.8 / 33.3 | 0 / 0 / 0 |
| Label visibility isolation; not a product candidate | 17.2 / 17.2 / 245.8 | 0 / 0 / 1 |
| Empty-page input/measurement control | 18.6 / 18.8 / 430.2 | 0 / 0 / 2 |
| Original command after owner freed memory; 14/33 fail | 133.3 / 133.2 / 116.6 | 6 / 2 / 3 |
| Owned-process timer policy; 7/33 fail | 33.4 / 50.2 / 66.8 | 0 / 0 / 0 |
| Final complete cohort: stock-unrestricted-gate-1; 4 of 33 budgets exceeded | 33.4 / 33.3 / 50.1 | 0 / 0 / 0 |

The native-tile hypothesis was rejected: it still fails 9/11 phone limits and has approximately 394ms pan stalls. Tile/label visibility isolation does not establish a safe J-24-only cure; stalls remain. The empty-page reproduction establishes an outside-app source for the large-stall symptom. Rejected runtime switches and visibility changes exist only in disposable diagnostic browser contexts, not source.

## J-24 stop boundary: work attribution

The stricter diagnostic terminates only the chosen tile or label worker after initial preparation, suppresses its WebGL draws/uploads, and hides its presentation in a disposable browser. Hook counters confirm that the named workers and GPU calls were suppressed. It retains original phone viewport/DPR/CPU4 and the same input/measurement sequence. This is an intentionally incomplete map used for attribution only, never a product candidate or passing gate.

| Phone diagnostic | Zoom-in p95 ms | Zoom-out p95 ms | Frames >100ms in / out |
| --- | --- | --- | --- |
| Unmasked timing control | 33.4 | 150 | 1 / 6 |
| Tile work suppressed, first sample | 33.3 | 50 | 1 / 0 |
| Label work suppressed, first sample | 33.2 | 16.8 | 0 / 0 |
| Tile work suppressed, verified repeat | 33.3 | 66.7 | 2 / 2 |
| Label work suppressed, verified repeat | 16.9 | 16.9 | 0 / 0 |

Verified tile suppression: {"mask":"no-tile-work","stoppedWorkers":["http://127.0.0.1:4177/assets/tileWorker-CxK-PjCO.js"],"skippedDraws":2428,"skippedUploads":0}. Verified label suppression: {"mask":"no-label-work","stoppedWorkers":["http://127.0.0.1:4177/assets/labelWorker-BiJQwH-1.js"],"skippedDraws":1270,"skippedUploads":0}.

Even removing tile work does not meet every zoom gate. Suppressing the protected label/symbol presentation greatly reduces zoom-out cost. Independent external pauses still occur, including a 983ms unmasked pan gap with no JavaScript long task and >400ms pans with tile work suppressed. A faster tile scheduler/cache cannot by itself remove those outside-tile costs. The source-level stop boundary is therefore reached: the next architectural investigation would concern the label/symbol compositor presentation and its shared gesture transforms (J-25/protected camera rendering path), with strict pixel, fixed-size label, hit-testing and camera-behavior parity. No implementation of that change is authorized or retained; a new map engine is not proposed. Exact replacement design remains unproven, and the environment pauses also need a stable benchmark host.

Hidden native fallback planes were not separate composited layers: changing them to display:none left the zoomed tree at 15 layers. That hypothesis was rejected. Measured tile canvas backing-store estimates were 52MiB initially and 110MiB zoomed (native plus packed copies, excluding GPU/driver allocation); these estimates do not establish a tile-memory leak or justify cache degradation. No cache-bound change is shipped.

## Direct final metrics

Unmodified command: node tools/perf/gesture-audit.mjs http://127.0.0.1:4177/ --budget=tools/perf/budgets/tiles.json. Final raw cohort: stock-unrestricted-gate-1; browser/environment metadata in stock-unrestricted-gate-1-result.json. Timing ran serially, with the same viewport/DPR/CPU-throttle profiles and all 33 unchanged limits. No acceptance claim is made from instrumented or visibility-isolated cohorts. Original stock failures and rejected environment treatments remain preserved; differences between runs are not a measured application-code speedup.

| Shape | Entry zoom-in/out p95 ms | Final zoom-in/out p95 ms | Entry long/back pan max ms | Final long/back pan max ms |
| --- | --- | --- | --- | --- |
| desktop | 16.9/16.9 | 17/16.9 | 20.2/17.1 | 49.9/17.8 |
| laptop-hidpi | 18.4/18.7 | 16.9/17 | 442.1/371.5 | 17.2/17.3 |
| phone | 36/36.1 | 33.3/116.6 | 411.9/411.2 | 33.3/50.1 |

Final failed limits:

- phone · zoom-in-continuous · over100: 2 is over the budget of 0
- phone · zoom-out-continuous · p95: 116.6 is over the budget of 34
- phone · zoom-out-continuous · over100: 5 is over the budget of 0
- phone · pan-back · max: 50.1 is over the budget of 50

## Required verification

The production preview uses 4177; the independent production pixel harness uses 4179. All requested retained functional/parity checks were rerun on the unchanged accepted source. No assertion, performance limit or pixel tolerance changed.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; 0 errors / 175 warnings |
| `npm test` | PASS; 31 files / 229 tests |
| `node --test tools/atlas-build/test/canonical-pyq.test.mjs tools/atlas-build/test/gazetteer.test.mjs tools/atlas-build/test/pyq.test.mjs` | PASS; 42 tests |
| `npm run build` | PASS; 157 precache entries |
| `node tools/perf/atlas-tile-surface-check.mjs http://127.0.0.1:4177/` | PASS; 24 states |
| `node tools/perf/smoke.mjs http://127.0.0.1:4177/` | PASS; 100 checks |
| `node tools/perf/atlas-check.mjs http://127.0.0.1:4177/` | PASS; 21 checks |
| `node tools/perf/atlas-renderer-check.mjs http://127.0.0.1:4177/` | PASS; 5 modes |
| `node tools/perf/atlas-label-visibility.mjs http://127.0.0.1:4177/` | PASS; 90 checks |
| `node tools/perf/atlas-label-check.mjs http://127.0.0.1:4177/` | PASS; 6 configurations |
| `SCHEME=light node tools/perf/vnext-learning.mjs http://127.0.0.1:4177/` | PASS; 104 checks |
| `SCHEME=dark node tools/perf/vnext-learning.mjs http://127.0.0.1:4177/` | PASS; 104 checks |
| `node tools/perf/fullscreen-regression.mjs http://127.0.0.1:4177/` | PASS; 4 cycles |
| `node tools/perf/product-health.mjs http://127.0.0.1:4177/` | PASS; online/offline and no unexpected console errors |
| `node tools/perf/atlas-pixel.mjs 'http://127.0.0.1:4179/tools/perf/atlas-pixel.html?assets=http%3A%2F%2F127.0.0.1%3A4177%2F'` | PASS; 120 comparisons |
| `node tools/perf/atlas-label-parity.mjs 'http://127.0.0.1:4179/tools/perf/atlas-pixel.html?assets=http%3A%2F%2F127.0.0.1%3A4177%2F'` | PASS; 18 comparisons |
| `node tools/perf/job4-offline.mjs http://127.0.0.1:4177/ tools/perf/out/editorial/baseline-source/dist` | PASS; 16 clean-install/build-upgrade checks |
| node tools/perf/gesture-audit.mjs http://127.0.0.1:4177/ --budget=tools/perf/budgets/tiles.json | FAIL; 4 of 33 budgets exceeded |

The standalone pixel and label-parity harness initially targeted an unavailable default asset server (4173). Rerunning its existing assets URL parameter against production 4177 produced the passing results above. Original endpoint failures are retained separately; no tolerance or assertion changed. The formal six-configuration label check passes (phone Light 0.5ms / Dark 1.2ms); instrumentation-heavy gesture cohorts also contain isolated position-cost outliers and are not silently treated as a positioning-cost improvement.

## Next bounded action and stop boundary

Do not implement a map-engine replacement, shared tile/label surface, camera change, J-25 rewrite or pixel degradation without separate authorization. Benchmark-environment investigation was authorized and completed through the cohorts recorded here. The exact failed limits above remain deployment blockers. The no-tile-work diagnostic establishes cost outside J-24; the proposed next scope is protected label/symbol compositor profiling and a concrete parity-preserving presentation design before implementation. The exact architecture is not yet proven. Environment reproduction and host pressure remain an independent verification blocker.

Dexie declarations/migrations, stable IndexedDB/PWA/native/deep-link IDs, News Read/Saved, dormant article notes, canonical PYQs and recall/history remain identical to the accepted entry tree. No user state was cleared.

## Evidence and working tree

Raw artifacts: entry-timing.log and entry-*.json; fresh-baseline.log and fresh-baseline-*.json; baseline-phone-trace/profile.json; baseline-pan-phone-trace.json; traced-audit.log; cpu-pan-phone.json/cpu-analysis.log; native-tiles.log/native-tiles-phone.json; isolate-*.log/json; surface-*.log/json; environment-*.log/json; memory-*.json; windows-cpu-control.etl and etw-waits-*.csv; final-direct-gate.log/final-*.json; idle-gate-*.log/json; timer-gate-1*.log/json; bundled-gate-1*.log/json (partial, stopped); full-chromium-gate-*.log/json; stock-unrestricted-gate-1*.log/json; verification/*-results.json and per-suite logs; entry-hashes.json/current-changes.json/comparison.json. These remain under tools/perf/out/j24-repair and are ignored diagnostic output. Failed or interrupted runs without a verdict are not complete acceptance runs.

Primary context for interpreting diagnostics: [Windows timer-resolution policy](https://learn.microsoft.com/en-us/windows/win32/api/timeapi/nf-timeapi-timebeginperiod), [per-process power policy](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation), [context-switch event fields](https://learn.microsoft.com/en-us/windows/win32/etw/cswitch). These document mechanisms, not the cause of an individual measured pause.

Final working tree: 46 modified tracked paths and 17 untracked entries, including this new report. HEAD is unchanged. The existing redesign edits remain intact. No commit, push or deployment.
