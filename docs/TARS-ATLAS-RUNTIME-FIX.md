# Atlas runtime crash repair — 2026-10-04

The overhaul is paused again at the owner's instruction. This repair preserves Atlas + News and the existing dirty checkout. No Focus, Planning or timer expedition code is restored. No commit, push or deployment.

## Root cause and reproduction

A fresh Chrome context opening `http://127.0.0.1:4182/#/atlas` directly reproduced the reported screen boundary. Both browser console/error-boundary arguments and Vite's forwarded client runtime log captured this actual exception:

```text
InvalidStateError: Failed to execute 'transferFromImageBitmap' on 'ImageBitmapRenderingContext': The input ImageBitmap has been detached
    at http://127.0.0.1:4182/src/features/atlas/renderer/LabelLayer.tsx:25:24
    at commitHookEffectListMount (...react-dom_client.js:6901:153)
    at commitHookLayoutEffects (...react-dom_client.js:6889:55)
    at reappearLayoutEffects (...react-dom_client.js:8207:6)
```

The boundary component stack identifies `WorkerCurve → RiverWord → LabelLayer → AtlasMap → Atlas → AtlasScreen → Screen → Suspense → ErrorBoundary`. The original source operation was `LabelLayer.tsx` line 35; Vite's transformed source reports line 25. Vite logged the same exception at 07:06:44 local time. The screen showed “This screen ran into a problem”; the shell remained usable.

`WorkerCurve` transferred the layout's `ImageBitmap` into a canvas. Transfer consumes/detaches it. React StrictMode replays the layout effect, so the second transfer throws. Separately, `useLabelLayout` closed the current generation immediately after committing it (`version <= result.sequence`), making repaint after Suspense reappearance unsafe even with a non-consuming draw.

The reduction changed empty/retired routes to Atlas and made Atlas the direct landing screen. That exposed the retained renderer's bitmap lifecycle defect during cold initialization. The failing stack contains no deleted Focus/Planning dependency. Earlier product browser helpers visited Settings first, and production builds do not exercise development StrictMode replay; their `pageerror` listeners also miss errors caught by React boundaries.

## Exact repair

- `WorkerCurve` uses synchronous 2D `drawImage` to copy pixels without detaching the layout-owned bitmap. Existing font, dimensions, glyph raster and canvas cleanup remain intact.
- `useLabelLayout` closes generations strictly older than the committed snapshot (`version < result.sequence`). The current generation stays available for effect replay; replacement/unmount closes it. Stale replies and replies after unmount still close immediately.
- Updated the bitmap ownership type comment. Tile bitmap installation has separate single-use ownership and is unchanged.
- Added a StrictMode/repeated-mount regression that models browser bitmap detachment, and extended ownership tests to require current retention, replacement closure and unmount closure.
- Added direct cold-start browser checks that visit neither Settings nor a prewarming helper and capture both console/boundary errors and page exceptions. They require actual nontransparent river pixels on phone/desktop after landing, reload and returning from News.
- Added a native recall browser integration check: use the actual generator/gazetteer to answer a real UI question, verify one durable correct attempt, Familiar after reload, recall XP and next-day due review with zero session/task/expedition records. CI runs development StrictMode checks and production cold-start checks.

## Persistence and dependency audit

No database name, schema/version, migration, repository, settings normalization, Zustand state or backup/sync path changed. Dexie remains `lodestar` version 2; all historical Focus/Planning/expedition stores remain inert and preserved. Current Affairs state/archive keys remain unchanged. No wipe/reset or data migration was needed.

Atlas imports and active hooks/actions/progression were traced: active reads are settings, recalls and claims; exploration/mastery/XP use recall; registries contain only retained actions. No active `useSessions`, `useTasks`, `useExpeditions`, timer API or deleted feature import remains in Atlas/game/app/Tars. Old action strings occur in rejection tests, and static expedition metadata remains only in the protected source package/types. Protected data and schema/repo/backup/sync content diffs are empty.

## Verification

| Check | Result |
| --- | --- |
| Typecheck | Pass: `npm run typecheck` |
| Lint | Pass: zero errors, 188 existing warnings |
| Unit/component/data tests | 225/225 across 30 files; bitmap replay and ownership regressions included |
| Atlas build/pipeline tests | 42/42: `node --test tools/atlas-build/test/*.test.mjs` |
| Production build | Pass; 154 precache entries, 7015.25 KiB |
| Direct cold-start regression | 6/6 development + 6/6 production, phone/desktop; painted river pixels and zero console/page/boundary errors |
| Native recall integration | Pass: saved exactly once, Familiar survives reload, +1 XP, next-day review; no Focus/Planning/expedition records or console errors |
| Atlas interaction smoke | 21/21: India/World, map, zoom/pan, search, inspector, phone gestures |
| Atlas/PYQ learning browser | 104/104: question types, answer/reveal, place links, inspector, recall entry and offline unvisited paper |
| Reduced-product smoke | 100/100 in both themes at 375/1366 px: retained routes/commands, offline reload, legacy sessions/tasks/expeditions/timer values preserved verbatim |
| News fixture browser | 279/279: queues, filters, reading state, archive, notes, offline cache; no page exceptions |
| Settled console health | Online/offline Atlas tiles/labels, News and Settings pass with zero runtime/console errors |
| Source review | `git diff --check` clean; protected generated data and persistence infrastructure unchanged |

News fault-injection checks intentionally emit failed-image, 503 and offline network messages. Those expected fixtures are distinct from application exceptions; the settled health and cold-start checks report no console errors. Browser evidence uses local headless Chrome and viewport emulation; hosted CI/native/WebKit/physical-device execution was not claimed or used to resume any overhaul gate.

Browser artifacts: `tools/perf/out/atlas-cold-start/{4182,4180}/`, `out/product/`, `out/vnext/learning-results-light.json`, `out/current-affairs-direct/`. Unit/build results were recorded in the local command output. Roadmap status and handoff summaries reflect the latest pause.

## Files changed in this repair

Runtime: `src/features/atlas/renderer/LabelLayer.tsx`, `src/features/atlas/renderer/useLabelLayout.ts`, `src/features/atlas/labels.ts`.

Tests/CI: `src/features/atlas/renderer/LabelLayer.test.tsx`, `src/features/atlas/renderer/useLabelLayout.test.tsx`, `tools/perf/atlas-cold-start.mjs`, `tools/perf/atlas-recall-check.mjs`, `.github/workflows/ci.yml`.

Documentation/status: `AGENTS.md`, `README.md`, `CODEX_HANDOFF.md`, `docs/HANDOFF.md`, `docs/TARS-ATLAS-NEWS-ROADMAP.md`, `docs/TARS-ATLAS-NEWS-REDUCTION.md`, this file. All other dirty changes predate this repair.

## Second regression: names and markers covered after zoom settles

The subsequent owner report was reproduced on the production preview at 1920 × 975 px in Night mode. Screenshots match the report: map geometry is visible, while geographic names and markers are absent despite valid selection targets.

DOM/computed-style snapshots before/during/after zoom contained respectively 124/124/125 label nodes. Sample label opacity remained 1, visibility was visible, display was block, clipping was none, and transforms/bounds put the words in the viewport. The sibling names/SVG symbol layers had automatic z-index and intentional pointer-events none; collision/layout did not discard their data. The actual failing condition was paint order:

- Base overview/detail containers use positive local z-indices (overview 0, detail 2, studied detail 3) to order their rasters.
- `.atlas-base` had automatic z-index and isolation and did not establish a stacking context. Its detail descendants therefore competed with the map's sibling layers and painted above them.
- Detail opacity becomes 1 when viewport coverage is ready. When an overview/fallback layer is used, words can be visible; promoting opaque detail coverage covers them again. No `isZooming`/density/settled-view condition set all label opacities to zero.

A reversible in-browser probe temporarily included the Madhya Pradesh text in hit testing and then restored its pointer-events. Before the fix the browser paint/hit stack was `detail CANVAS → detail DIV (z-index 2) → SPAN.atlas-name-text`. Setting only base isolation yielded `SPAN.atlas-name-text → detail CANVAS → detail DIV`, restoring both text and markers immediately with tile z-indices/opacity unchanged. The new regression failed against the old production build on initial India for precisely that paint-order assertion.

### Exact change and verification

Added the existing Tailwind `isolate` utility to the `BaseLayer` host (`isolation: isolate`). Tile ordering now stays inside the base stacking context, beneath later sibling labels/symbols. No label-density, collision, transform, camera, selection, glyph or raster algorithms changed. Renderer and visual design remain intact; no feature restoration, persistence changes or dependencies.

`tools/perf/atlas-label-visibility.mjs` inspects in-view names/markers and their actual ordering against opaque base canvases, temporarily restoring pointer-event participation only for the probe. It checks initial load, moving and settled zoom in/out, India/World and return-to-India, and real marker click → correct Details heading. It waits for the surviving map's own labels/tiles after the sheet crossfade, rather than reading the outgoing map. CI now runs it on the production build.

| Current label-fix check | Result |
| --- | --- |
| Paint-order/selection regression | 90/90 at 1920/1366/390 px, Paper/Night, India/World; no console/page errors |
| Original Atlas interaction browser | 21/21, including pan/zoom, search, World switch and inspector |
| Atlas/PYQ learning browser | 104/104, including canonical dialogs and offline unvisited paper |
| Development cold-start/reload/News return | 6/6; previous bitmap crash remains fixed |
| Actual Cities & ports / All layer filters | Pass in India and World: non-city marker kinds removed, then restored |
| Unit/component/data suite | 225/225 across 30 files |
| Typecheck | Pass |
| Lint | Zero errors, 188 existing warnings |
| Production build | Pass; 154 precache entries, 7015.26 KiB |
| Visual/source review | Desktop/phone screenshots show names and markers; whitespace clean; protected source packages and persistence infrastructure unchanged |

Evidence: `tools/perf/out/label-diagnostic/{initial,during,settled}.json` and screenshots, `stack-proof.json`, `isolated.png`, `out/label-visibility/before-fix.json`, `results.json` and six final screenshots. Validation is local headless Chrome; no overhaul performance/device acceptance is implied.

Files changed in this second repair only: `src/features/atlas/renderer/BaseLayer.tsx`, `tools/perf/atlas-label-visibility.mjs`, `.github/workflows/ci.yml`, `CODEX_HANDOFF.md`, `docs/HANDOFF.md`, this document. No commit/push/deploy; unrelated overhaul remains paused.
