# J-25 · Atlas label layer (in progress)

On 2026-10-03 the owner approved bringing forward only the label work needed for J-24’s phone timing gate. Both jobs need separate acceptance; later jobs stay in the formal order. No acceptance is claimed.

After the Atlas + News reduction, the owner resumed the retained overhaul. `TARS-ATLAS-NEWS-ROADMAP.md` is the active sequence; Focus/Planning/media work is retired. The renderer/label gates are unchanged.

## Production candidate

- Unscaled HTML point names and HTML anchors holding small SVG place symbols. One shared pan transform; paused compositor transform animations position anchors on zoom without per-frame SVG attributes or React state. Routes, ships, wildlife, pins and highlights retain their existing layers and coordinate handling.
- Geographic anchors keep fixed screen offsets. Fonts use the fitted view rather than live zoom; visibility/priority, abbreviations, collision avoidance, linking, hidden answers and course-window selection still use the live view.
- Text advances are measured at100px and scaled (Manrope has no optical-size axis). Real font checks found maximum error0.04405CSSpx desktop/0.02979px phone. The width/font cache avoids fractional-size growth and repeated font parsing.
- Curved river words compose cached stroke/fill glyph planes along the chosen course. The cache is bounded to256 letters, releases evicted/unmounted stores and clears fallback lettering when fonts become ready. Two tests cover cache identity, style/density invalidation, eviction, cleanup and repaint after cleanup. Three anchor/course/font tests pass.
- Independent deterministic fades use the existing220ms token. This replaces the old no-opacity rule only if the final measured budgets establish a tested equivalent. The candidate is not yet accepted.
- Point text memoization no longer depends on coordinates owned by the anchor layer. Selection/hover/press, travel, mastery and PYQ symbol metadata are retained; broad final regression/visual checks remain required.

## Failure evidence and remaining gates

The latest held-pinch sequence covers three shapes, both themes and five samples per case. Retained name size variation is below0.002% in this run; actual font metric checks pass. Five of six cases pass the positioning check: phone Paper has an8.2ms maximum against6ms; phone Night1.5ms. Earlier curved-bounding-box checks incorrectly conflated changing course angle/window with font size; the script now reads the actual painter font/display scale.

The full phone run remains a failure: J-24 timing10/11 budgets exceeded, continuous zoom249.7/195.8ms p95 and12/6 frames>100. The position callback also has outliers above6ms in that full run. Per-camera anchor motion uses animation time rather than style writes, but re-layout can change word-canvas styles; do not claim that the complete zoom sequence has zero per-element writes. Neither the opacity rule nor the new layer is accepted from partial/isolated results.

Unshipped comparison files under tools/perf/ (AtlasCanvasCandidate.tsx, atlasCandidateWorker.ts, atlas-canvas.config.mjs) build the full app with a separate resolver/output/preview on4176. Worker lettering and viewport bitmap composition are an experiment. They are never imported by the production configuration or precache. The initial isolated83-word sprite test reached16.8ms p95, but app-integrated versions still fail timing (about36ms p95 and frames>100 in later diagnostics). Hover/press/pulse fidelity, resource cancellation, fallback, offline and full browser acceptance are incomplete. This is not a replacement or a change to the standing HTML-point-name rule, and no architecture exception has been requested or inferred.

Pending: final all-shape size/position/style-write evidence; full J-24 timing; independent fades and reduced motion; screenshot/parity review; coverage, cache, fallback and offline checks; root checks and manual diff review. Timer/data/history/Focus-media contracts are untouched. Raw ignored evidence: tools/perf/out/codex-j24/ and codex-j25/; failed experiments remain diagnostics only.

### Continued placement work

A CPU trace attributed a121ms main-thread callback to placement/measurement in the unshipped full-app comparison. Production now uses a label worker with the same placement algorithm, exact bundled Manrope faces, collision/priority/course/hidden/link/preference rules, and plain minimal place DTOs. The previous committed layout remains visible while a new request is pending; generation and sheet checks reject stale results. Main-thread fallback shares the algorithm. Prefix advances, width and baseline travel with each placed label, removing repeated main-thread shaping from curve painting. Three lifecycle tests cover stale replies, sheet changes/unmount and worker failure. Real-font parity18/18 passes across India/World, three viewport sizes and three zooms. The first parity fixture mistakenly loaded Manrope Variable instead of the application's Manrope alias; corrected to the exact app faces before treating results as evidence.

Paused word motions are retained rather than recreated at every layout. Offscreen updates check old and desired positions to avoid stale visible words; the range extends for larger view scales. Markers use one indexed lookup. A narrow smoke-selector repair follows actual atlas-sym/data-place nodes in the new HTML anchors; timer, symbol tap, pan, pinch, settlement and offline reload all pass12/12.307 tests/36 files and build/typecheck pass; lint remains0 errors/402 warnings. Latest root build238 entries/7496.30KiB. These are correctness records, not final job acceptance.

The full retained-animation phone run before worker placement failed9/11 budgets: zoom-in36ms p95/max54ms/zero>100; zoom-out105.6ms/max233.2ms/2>100; pan maxima340/339.7/496.9ms; heap21.2MiB. Later quiet diagnostic runs still fail. The host has7.875GiB RAM and had0.307GiB available; closing unused owned servers raised it to0.552GiB. Owner agreed to free memory for a stable rerun. No budget has been relaxed.

Unshipped alternatives include CSS registered-number/anchor positioning, direct/promoted HTML transforms, canvas software drawing and one-batch WebGL sprites. None has met the complete gates: a sprite quiet run reached18.5/18.2ms p95 but still had286.7/321.2ms settlement frames. Serial symbol decoding and worker measurement remain experiments under tools/perf; no production renderer or architecture exception is inferred.

### Worker curve raster continuation

The existing label worker now rasterises winning curved names using the same bounded WordSprites cache as the previous main-thread painter, with injectable OffscreenCanvas surfaces. labelPaint is shared without changing its palette. Point names remain HTML. Worker bitmap transfers are consumed by separate curve canvases; resources close after their React layout commit, on stale replies and on teardown. The fourth hook test verifies these paths. Main-thread fallback remains available.

Current validation: 308/308 tests in36 files, typecheck/build passes (238 precache entries/7503.12KiB), smoke12/12 including offline reload, real-font placement18/18 and327 compared curves with exactly zero pixel error against the former glyph painter. A first direct-text worker painter failed6 of18 raster cases; it was replaced by the shared cache rather than widening the tolerance.

Timing remains a failed gate. The fresh full phone run after RAM increased to1.82GiB failed10/11 budgets (zoom89.8/160.5ms p95;3/2 frames>100; heap20.6MiB). After curve-worker painting, a short diagnostic comparison measured50.1/66.7ms p95 and2/2 frames>100. Percentage-based HTML anchors and direct CSS positioning candidates also failed and are not in the production import graph. Shared timeline experiments are likewise unshipped. Final all-shape/theme/pinch/style checks are pending; neither J-24 nor J-25 is accepted.

### Symbol/name snapshot repair and current verification

SVG place symbols have been restored to their checkpoint appearance and marker scaling. Their identities now commit with the matching worker name-layout snapshot; an SVG group transform compensates its frame into the camera layout frame until the replacement commits. This repairs doubled mutation counts while retaining hit-model coordinates. The fifth hook test verifies snapshot identity. Latest309 tests/36 files and typecheck/build pass (238 entries/7503.21KiB).

The latest six-case pinch sequence passes all shapes/Paper/Night: maximum retained width variation1.23%, exact font-size error0.044px desktop/0.030px phone, positioning maximum0.8ms desktop and3.7ms phone. Count-only phone budgets9/9 pass after shared commits: held label commits6, long-pan commits4, all retained names kept after release. The tap was invalid because its first symbol was offscreen; QA now chooses an actual visible symbol and fails if none exists. Broad selection/browser tests still need final reruns.

## Resumed reduced-product verification — 2026-10-03

No production label algorithm changed in this continuation. The isolated main/worker parity harness now accepts the same `assets` URL parameter as the tile comparison and completes 18/18 real-font layout comparisons, with 327 curved-word comparisons at MAE0. The final production held-pinch sequence passes 6/6 cases (desktop, laptop HiDPI and phone; Paper/Night), maximum width/height variation 1.23%, font metric error ≤0.0441 px, maximum positioning 0.5 ms desktop and 3.4 ms phone, no page errors.

The three full phone timing runs in `TARS-PREMIUM-J24.md` still fail the renderer gate. Their maximum label-positioning cost includes a 6.3 ms outlier, above the 6 ms phone limit. The isolated pinch pass therefore does not establish complete J-25 acceptance. See `tools/perf/out/codex-j25/pinch.json`, `layout-parity.json` and `out/resumed-final/phone-{1,2,3}.json`. Canonical questions, source ids, News data and schema are unchanged; both jobs remain in progress.

The preceding full phone run failed9/11 timing budgets (zoom116.6/133.4ms p95,4/6>100ms,heap20.7MiB), with a67.9ms positioning outlier despite2.7ms p95. The isolated pinch pass does not supersede that failure. Percentage, direct, shared-scroll and GPU-base comparisons remain unshipped and unaccepted. Neither J-24 nor J-25 is done; all later jobs remain unstarted.
