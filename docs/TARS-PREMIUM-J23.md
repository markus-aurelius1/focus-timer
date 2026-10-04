# J-23 · Renderer extraction and decision

Date: 2026-10-03. Base: `handoff/claude-overhaul`, `3e43def`. Uncommitted continuation; no push, merge or deployment authorized. J-23 is accepted; J-24 is the next job.

## Checkpoint reproduction

Locked dependencies restored with `npm ci --prefer-offline --no-audit --no-fund` (an offline-only attempt lacked one cached package). No dependency versions changed. Typecheck clean; 282/282 tests; lint 0 errors / 402 warnings; build 236 precache entries / 7,456.56 KiB. Production smoke 12/12, fullscreen regression, shell 49/49, header 19/19, Tars 51/51, learning 104/104 (Paper), Current Affairs 279/279, dial 24/24, error recovery 7/7, contrast 40/40 and layout 375/1366 Paper/Night passed. Dev actions 23/23 and audio 28/28 passed.

The first dev feature checks timed out with the Welcome dialog still open: the QA helper's 1.5 s wait could skip lazy onboarding. `tools/perf/lib.mjs` now waits for seeded settings and the actual first-run surface. The dev feature suite then passed 21/21; no application onboarding or timer code changed.

Atlas initially passed 20/21 (two-finger tap timing); a quiet unchanged-build rerun passed 21/21. Route-state passed 26/27 under load: desktop Atlas revisit shown 243 ms / painted 299 ms / worst subsequent frame 19 ms, exceeding the documented 100 ms limit. This remains unresolved baseline evidence, not a newly introduced application regression.

The extracted build also reproduced the intermittent two-finger QA failure under concurrent browser load. `atlas-check.mjs` now waits for the previous gesture to settle, supplies explicit timestamps for its intended 60 ms two-finger contact, and waits for the zoom-out to settle. Desktop synthetic double-clicks also preserve a 100 ms input interval, and the fullscreen layout audit waits for the rail visibility transition and stage animation to finish. Gesture and layout assertions are unchanged. The timestamped run passed 21/21; the extracted controller itself still uses exactly the checkpoint event-time logic.

The first full gesture run exceeded the desktop selection count budget (1 base repaint instead of 0). The harness now waits for the preceding gesture's actual settlement and two frames before starting the independent selection pass. A fresh count run against the unchanged checkpoint build passed all 29 budgets, with desktop selection at 0 base repaints. Budgets were not widened. App audit passed all 10 desktop/phone budgets. Full timing runs retain the existing repaint stalls:

| Shape | Zoom-in p95 / max / frames >100 ms | Zoom-out p95 / max / frames >100 ms | Long-pan p95 / max / frames >100 ms | JS heap |
| --- | --- | --- | --- | --- |
| Desktop, DPR 1.25 | 300.0 / 749.8 / 4 | 266.5 / 766.4 / 9 | 16.8 / 349.7 / 1 | 23.2 MB |
| Laptop HiDPI, DPR 2 | 183.2 / 749.6 / 3 | 566.5 / 982.9 / 7 | 16.8 / 283.2 / 1 | 22.8 MB |
| Phone shape, DPR 3, 4× CPU | 399.7 / 533.1 / 8 | 633.0 / 633.0 / 15 | 83.3 / 349.9 / 12 | 22.7 MB |

Raw baseline logs, reports and selected screenshots: ignored `tools/perf/out/codex-checkpoint/`. Browser: system Chrome on Windows; Intel UHD Graphics 630 / ANGLE Direct3D11. No physical phone claim.

## Extraction

`AtlasMap.tsx` is 514 non-trailing lines, below the required 600. Public exports are preserved. Modules under `src/features/atlas/renderer/`:

- `types.ts`: public map contract and settled layout frame.
- `palette.ts`: unchanged Day, Night and Antique palette.
- `SvgLayers.tsx`: unchanged base, flowing rivers and highlight layers; retained as the J-24 reference.
- `glyphs.tsx`: memoised symbols, river names and HTML names.
- `useMapCamera.ts`: existing camera refs, compositor placement, hard/soft bounds, resizing, rest detection, sleep, fitting and imperative handles.
- `gestures.ts`: extracted pointer/wheel/key controller and attach/detach lifecycle.

The palette, glyph, SVG and gesture bodies were compared text-identical to the checkpoint apart from export declarations and indentation. Stable camera ref objects are listed in the derived layout dependencies; their identity does not change. Ten unit tests exercise actual event sequences: batched pan and rested release, momentum, anchored pinch, pinch-to-pan handover, accumulating eased wheel notches, batched trackpad zoom, double tap, two-finger tap versus moved pinch, keyboard ownership and cleanup. Existing camera tests still cover camera flight.

No timer/data/Atlas allocation, IDs, coordinates, cartography, schema, assets, service-worker policy or runtime dependency changed. The owner-rejected generated Focus media/lines remain unchanged; the required quality follow-up is in `CODEX_HANDOFF.md` §4.15.

## Isolated spike

Run `CHROMIUM_PATH=<system Chrome> node tools/perf/atlas-renderer-spike.mjs http://localhost:4173/` against the checkpoint production preview. The script is not imported by the app. It captures the actual shipped base SVG, embeds its existing local images, rasterises it once, and runs the same 180-frame 1×→2× zoom/pan path three times per approach. Phone shape 390×844, DPR 3, CPU 4×; source layer 1018×1412 CSS px; 24 tile canvases; 50 actual visible HTML names. Results: ignored `tools/perf/out/atlas-renderer-spike/phone.json`.

| Approach | Frame p95, three samples (ms) | JS submission p95, three samples (ms) | Name writes per sample |
| --- | --- | --- | --- |
| CSS-transformed tile container | 16.8 / 16.8 / 16.8 | 1.0 / 1.2 / 1.7 | 0 |
| One canvas redrawn each frame | 16.8 / 16.8 / 16.9 | 1.4 / 3.4 / 3.8 | 0 |
| Unscaled HTML names positioned per frame | 33.4 / 33.4 / 33.5 | 4.7 / 6.4 / 4.5 | 9,000 |
| Bounded scaling, re-position at +8% | 66.6 / 50.3 / 33.4 | 2.3 / 2.1 / 1.3 | 800 |

**Decision:** use per-level tile containers moved with CSS transforms for J-24. Both base approaches had similar median frame delivery, but CSS avoided per-frame canvas drawing and had consistently lower submission cost. Choose unscaled HTML name positioning for J-25: it keeps rendered text size constant and had steadier frame delivery than scaling text. J-25 must optimise/profile positioning to meet ≤2 ms desktop / ≤6 ms at 4×; one spike sample was 6.4 ms, so this is not J-25 acceptance. If that cannot meet the gate, revisit the choice with measured alternatives.

**Limits:** compositing only, with already-rasterised tiles; worker drawing, chunk culling, eviction, level swaps and pixel parity are not measured. Bounded mode repositions the same label set and does not perform collision layout. Its maximum name scale was 1.079861 (+7.986%), but its frame delivery was worse and varied during warm-up. No physical-device or complete production renderer result is claimed.

## J-23 acceptance

| Gate | Result |
| --- | --- |
| Typecheck | pass |
| Root tests | 292/292 pass (32 files) |
| Lint | 0 errors / 402 warnings, unchanged |
| Build | pass; 236 precache entries / 7,457.46 KiB |
| Atlas behaviour, smoke, fullscreen, Tars, responsive themes | pass: settled Atlas 21/21, smoke 12/12, fullscreen, Tars 51/51, dev features 21/21; layout 375/1366 Paper/Night |
| Three-shape gesture audit / counts versus baseline | 29/29 gesture and 10/10 app budgets pass; quiet replay supports no introduced repaint regression, with limitations below |
| Isolated spike and recorded decision | pass, with limits above |
| Diff review / handoff | pass: camera, gesture, palette, glyph and SVG bodies compared to the checkpoint; public exports preserved; protected paths unchanged; handoff updated |

J-23 accepted. The initial extracted run had mixed timings: desktop zoom-out p95 633.2 ms versus 266.5 ms baseline, while zoom-in and phone pan were faster. A quiet replay used an isolated `git archive 3e43def` tree on :4174 and the extracted build on :4173. Tailwind in the isolated tree scanned additional files; its compiled base stylesheet was replaced only in the ignored profiling artifact with the exact 97,328-byte `index-BYz1pWsv.css` stylesheet whose hash matched the reproduced checkpoint and extracted builds. Application source and geometry remained the checkpoint. Both quiet desktop runs passed all 16 budgets.

| Quiet desktop measurement | Checkpoint | Extracted J-23 |
| --- | --- | --- |
| Long-pan p95 / max | 16.8 / 383.0 ms | 16.9 / 266.4 ms |
| Zoom-in p95 / max | 149.9 / 949.5 ms | 116.6 / 649.7 ms |
| Zoom-out p95 / max | 1,449.4 / 1,965.7 ms | 233.3 / 1,049.6 ms |
| Zoom-out frames >100 ms | 9 | 9 |
| JS heap | 22.5 MB | 24.1 MB |

The opposite timing direction on the quiet replay, stable paint budgets, identical camera/gesture bodies and unchanged pan delivery support no introduced regression within the observed SVG/GPU variation. This is a limited local comparison, not a claimed performance win or statistical equivalence across devices. Repaint stalls remain for J-24. Raw quiet reports are `out/codex-checkpoint/quiet-desktop.json` and `out/codex-j23/quiet-desktop.json`.
