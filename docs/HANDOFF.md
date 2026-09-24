# Development handoff — UI/UX + Atlas performance + PYQ data upgrade

Last updated: 2026-09-24 (end of the cloud session that started this upgrade).
Read this before changing anything, then verify every claim against the code.

## 1. Where the work is

| | |
| --- | --- |
| Working branch | `claude/jolly-clarke-qk4fys` |
| Built on | `claude/serene-heisenberg-5ibr5v` (the whole app; open PR markus-aurelius1/study-timer#1 → `main`, **not merged**) |
| `main` | only the initial commit (README) |

`claude/jolly-clarke-qk4fys` = every commit of PR #1 **plus** the checkpoint commit(s) of this upgrade. Do not rebase or force-push it; add commits on top.

## 2. What the project is

**Lodestar** — a calm, local-first study app for UPSC / UPPCS aspirants:
PLAN → FOCUS → TRACK → REVIEW → IMPROVE.

- **Focus**: pomodoro / countdown / open-focus timer (timestamp-based engine, survives sleep/reload), immersive mode, sounds.
- **Planner**: tasks, projects, habits, natural-language quick add, recurring tasks, calendar (events, exams, focus blocks).
- **Insights**: analytics derived from sessions, goals, heatmaps.
- **The Atlas**: an offline atlas of India + World (~800 places chosen for UPSC/UPPCS) that you explore with focus time (XP → expeditions → discoveries) and master through spaced-recall questions.
- PWA (offline, installable) + Capacitor Android/iOS projects. No account, IndexedDB only.

The README has the full feature list and architecture; this file covers the upgrade in progress.

## 3. Architecture (short)

React 19 + TypeScript + Vite 8 + Tailwind 4 + Dexie (IndexedDB) + Zustand + Motion + vite-plugin-pwa + Capacitor 8.

```
src/app        shell, hash router, theming (App.tsx wraps everything in <MotionConfig reducedMotion="user">)
src/data       typed model (types.ts), Dexie schema v2 (db.ts), seed defaults, hooks, backup/CSV, sample data (demo.ts)
src/timer      pure timer engine + tests, store, useNow
src/planner    recurrence, quick add, task selectors
src/stats      derived analytics
src/game       XP, ranks, map styles, challenges
src/atlas      atlas engine: sheet decoding (sheet.ts), gazetteer (data.ts), exploration, mastery, questions,
               living world, spatial index (spatial.ts — NEW)
src/features   screens: focus, tasks, atlas, calendar, insights, settings, audio, onboarding
src/ui         design-system primitives (Sheet, controls, feedback…)
src/lib        helpers; device.ts (NEW: prefersReducedMotion, lowPowerDevice)
tools/atlas-build  offline data pipeline → public/atlas/v1 (sheets, relief images, places.json)
tools/perf         NEW: headless-Chromium profiling + touch smoke test (own package.json)
```

**Atlas data**: `public/atlas/v1/places.json` is generated from `tools/atlas-build/content/*.mjs`
(authoring DSL in `content/dsl.mjs`: `P(kind, name, lat, lon, { st, co, lvl, el, f, aka, tags, rel, geom, … })`),
compiled by `tools/atlas-build/lib/places.mjs` (`compilePlaces`, validates states, relations, links to sheet features).
App-side type: `Place` in `src/atlas/types.ts`. User progress references places only by stable id (e.g. `in.pass.nathu-la`).
Rebuild places only: `cd tools/atlas-build && npm install && node build.mjs --places-only`.

## 4. The user's request for this upgrade (constraints that must not be lost)

Focused upgrade of the **existing** app — **do not redesign from scratch**.

1. **Atlas performance**: rAF-batched interaction, no React renders during interaction, viewport/spatial culling,
   no repeated processing of the whole dataset, fewer expensive SVG/filter/backdrop effects, pause decorative
   animation while interacting, keep smooth pan/zoom/pinch/momentum, **mobile first**. Rich when idle, light while moving.
2. **Focus screen**: clean, premium, distraction-free, consistent with the app. **Remove the Atlas image/map from the
   default timer background** (it is in immersive mode: `ExpeditionBackdrop` in `src/features/focus/ImmersiveFocus.tsx`).
   Timer/stopwatch digits: **Manrope** (already self-hosted), semibold/bold, **tabular numerals**, strong contrast.
3. **Global polish**: fix inconsistent spacing/typography, excessive blur/glass, unnecessary animation, awkward mobile
   layouts, weak hierarchy, heavy shadows/effects. Calmer, more professional, **no unnecessary new UI**.
   Respect reduced motion; optimise for mobile/low-power devices.
4. **Geography DB expansion** from the user's PYQ sources: extract geography locations/features, dedupe aliases, add
   missing places, enrich from reliable sources, **preserve provenance**, add relationships, **do not invent facts**.
   Store per place: PYQ appearance count, years asked, related topics, source references, relevance/high-yield metadata.
5. **PYQ-based prioritisation**: an **interpretable** high-yield score from PYQ frequency, recurrence, recency,
   geographic/topic importance, related-location density, and under-tested-but-important places. It is a
   **study-priority heuristic, not a prediction** of future questions. **Keep the reasoning in the data.**
6. **Do not break**: timer, planner, calendar, sessions, statistics, Atlas progression, offline functionality.
   Inspect first, profile bottlenecks, make targeted changes.

**Sources the user supplied** (use directly; the user also said they would provide PYQ PDFs — none arrived yet):
1. https://www.pmfias.com/category/prelims/protected-area-network/
2. https://www.pmfias.com/category/upsc-cse-prelims-pyqs/prelims-pyqs-geography/prelims-pyqs-mapping/ (and its paginated pages, e.g. `/page/3/`)
3. https://thedistrictminds.com/UPPSC_PYQs_Analysis_District_Minds.html
4. https://superkalam.com/upsc-preparation/resources/upsc-map-based-pyqs-2015-2025-practice-map-questions

⚠️ The cloud session **could not reach any of these** (egress policy denied pmfias.com, thedistrictminds.com,
superkalam.com, also wikipedia.org and upsc.gov.in). A local session should be able to fetch them.

## 5. Status

### Completed (committed, verified)

**Atlas performance** — `src/features/atlas/AtlasMap.tsx` (rewritten interaction core), `labels.ts`, `src/atlas/spatial.ts`, `src/lib/device.ts`, `src/index.css`:
- Base map is painted once into an **oversized layer** (`.atlas-layer`, margin ≈40% of the viewport, 25% on low-power
  devices) and moved/scaled with a CSS `translate3d/scale` while dragging — **no SVG repaint per frame**. It repaints
  crisply when the view settles (140 ms after the last movement), or mid-gesture (≤ every 220 ms) only if the painted
  margin runs out or the scale drifts beyond 0.6×–2.4×.
- Input is **rAF-batched**: pointer/wheel handlers only record positions; one frame applies them. Pan uses absolute
  anchors; pinch keeps the world point under the fingers; wheel deltas are multiplied per frame.
  Momentum is time-based (τ = 280 ms, capped fling), velocity from the last 80 ms of samples.
- **No React render during gestures**; `layoutT` state changes only on settle, inside `startTransition`.
- **Spatial grid index** (`GridIndex`) for discovered places and sheet labels (river labels indexed by course bounds);
  label layout and tap hit-testing only look at what's near the view.
- **Point names are HTML** (`.atlas-name` spans, halo via `-webkit-text-stroke` + `paint-order`), baseline-aligned with
  real font metrics (`fontMetrics`/`baselineFromTop` in `labels.ts`). Reason: Chrome re-lays out every SVG `<text>` when an
  ancestor's scale changes, which cost ~7 ms/frame (≈25–30 ms on phones) during zoom. River names stay SVG `textPath`.
- Base map SVG nodes **grouped by style** (fills by colour, rivers by width, lakes big/small, fog as one path) and
  `pointer-events: none` on all map SVGs (hit-testing was 270 ms per trace).
- Decorative motion moved off the paint path: pulse rings and ships are HTML on compositor layers; flowing rivers
  have their own layer; all **pause while moving** (`.atlas-moving`) and are **off on low-power / reduced motion** (`.atlas-calm`).
  `animateTo`/flyTo jumps instead of animating under reduced motion.
- Fixed: SVG ids (`textPath`, hatch pattern, clip, glow) are now per map instance (the review map can be open over the
  Atlas and previously shared ids). Font width cache is reset when web fonts finish loading.

Measured (production build, 390×844 @3x, 4× CPU throttle, `tools/perf/profile.mjs`):

| Gesture | Before | After |
| --- | --- | --- |
| Pan (India) | 81 frames > 50 ms, 5.1 s long tasks | 1–2 frames > 50 ms, ≤0.13 s |
| Wheel zoom in | 19.7 fps, p95 167 ms | 54–55 fps, p95 16.8 ms |
| Pan zoomed in | 73 janky frames | 0–1 |
| Wheel zoom out | 21 fps, p95 150 ms | 48–108 fps, p95 ≤ 33 ms |
| World sheet zoom out | 16 janky frames, 1.7 s long tasks | 0 |

**Sheet fix** — `src/ui/Sheet.tsx`: the backdrop closes only when the press **starts** on it. Before, tapping a place on
the map opened its card and the tap's trailing `click` immediately closed it again (pre-existing bug, reproduced on the
original build). The sheet scrim no longer uses `backdrop-blur`.

**Tests/tooling**: `src/atlas/spatial.test.ts` (new); `tools/perf/` (profile + smoke).
Verified: `npx tsc -b` clean, `npm test` 67/67, `npm run build` OK, `tools/perf/smoke.mjs` 12/12 PASS
(onboarding, timer start/pause, sheet backdrop close, all screens, Atlas tap-to-card, pan, pinch, settle, service worker,
offline reload, no page errors).

### Not started / remaining

(See the **progress log** in §8 for what has been done since this list was written.)

1. **Atlas chrome** (small, was next): replace `.glass` (backdrop blur) on map controls with solid surfaces —
   `AtlasScreen.tsx` lines ~242 (Segmented), ~273 (mobile HUD card, also has heavy `shadow-lift`), ~365 (`MapButton`).
2. **Focus screen** (task 2): see §4.2. Files: `src/features/focus/FocusScreen.tsx` (timer `span role="timer"` uses
   `font-display … font-light` → Manrope semibold + `tabular-nums`), `TimerDial.tsx` (`TimeDigits` fixed-width slots;
   SVG `feGaussianBlur` glow filter on the progress head — drop it), `ImmersiveFocus.tsx` (remove `ExpeditionBackdrop`
   from the default; `font-display font-extralight` digits → Manrope; `backdrop-blur` buttons). Optionally keep the
   expedition chart as an opt-in setting (off by default) — only if it stays a single toggle.
3. **Global polish** (task 3): `.glass` in `src/index.css` (used by `Shell.tsx` bottom nav + floating timer pill,
   `ui/feedback.tsx` toasts, Atlas controls); `InsightsScreen.tsx:~203` sticky header `backdrop-blur`; heavy
   `shadow-lift` use; numeric stats in Fraunces (`font-display`, 31 uses) — use Manrope tabular for numbers, keep
   Fraunces for headings; screenshot every screen at 390×844 and 1280×800, light + dark, and fix spacing/hierarchy.
4. **PYQ data** (tasks 4–6) — **blocked on sources in the cloud**; nothing implemented yet. Plan:
   - Fetch the four sources (and any PDFs the user provides). Extract every geography location/feature with exam,
     year, question snippet and source URL. **Never fill years/appearances from memory.**
   - Ledger: `tools/atlas-build/content/pyq/*.mjs` — one entry per question appearance
     `{ exam, year, q, places: [id | name], topic, source: { title, url } }`.
   - Build step (e.g. `tools/atlas-build/lib/pyq.mjs`, called from `build.mjs`): resolve names through a normalised
     alias index (`name` + `aka`), write unmatched names to a review report, attach to each place
     `pyq: { count, years, exams, topics, sources }`.
   - Missing places: add via `P(...)` in the matching `content/*.mjs` with facts and a provenance field
     (add `src`/`sources` to the DSL, compiler and `Place` type). Add `rel` links where the sources support them.
   - Score at build time, stored with its reasons: `yield: { score, band, parts: { frequency, recurrence, recency,
     importance, density, gap }, reasons: [...] }`. Weights documented in code; "under-tested but important" =
     high importance (level 1, key tags like ramsar/tiger-reserve/world-heritage/national) with few/no PYQs.
   - App: extend `Place` (`src/atlas/types.ts`); show PYQ history + "why high-yield" in `PlaceDetails.tsx`; sort/filter
     by priority in `Gazetteer.tsx`; use it as a tie-breaker in review ordering. Label it as a study heuristic.
   - Tests for alias resolution and scoring.

### Known issues / edge cases (by design or unverified)

- While pinching, names are the previous layout scaled (slightly soft) until the view settles (~140 ms); names for
  newly revealed areas appear on settle. A mid-gesture repaint (only when the painted margin runs out) costs one frame.
- HTML name halos rely on `paint-order` for HTML text; verify on a **real iOS Safari and Android WebView** device.
  Only headless Chromium has been tested.
- `lowPowerDevice()` is a heuristic (deviceMemory ≤ 3, ≤ 3 cores, Save-Data, reduced motion).
- On tall phones the India sheet leaves paper above/below the map (pre-existing, cosmetic).
- Double-tap zoom window is 300 ms (pre-existing).

## 6. Commands

```bash
npm ci                     # Node 22 (CI uses 22)
npm run dev                # http://localhost:5173
npm test                   # vitest (src/**/*.test.ts)
npm run typecheck          # tsc -b
npm run build              # typecheck + production build + service worker
npm run preview            # serve dist on http://localhost:4173

# Atlas data (own package)
cd tools/atlas-build && npm install && node build.mjs --places-only

# Profiling / smoke (own package; profile a production build, not the dev server)
cd tools/perf && npm install && npx playwright-core install chromium   # or set CHROMIUM_PATH
npm run build && npm run preview &                                      # from the repo root
node tools/perf/profile.mjs mylabel http://localhost:4173/
ROUTE='#/atlas?sheet=world' node tools/perf/profile.mjs world
node tools/perf/smoke.mjs http://localhost:4173/                        # exits non-zero on failure
```

Environment: no environment variables or secrets are required. Optional: `BASE=/subpath/` for sub-path builds,
`CHROMIUM_PATH` for the perf scripts. Android needs Android Studio (`npm run cap:android`), iOS needs Xcode.

## 7. Avoid

- Rewriting the app, the timer engine, the data model or the Dexie schema (a schema change needs a new Dexie version + migration + backup import support).
- Reintroducing per-frame React state or SVG attribute writes in `AtlasMap.tsx`, SVG `<text>` for point names, or
  `backdrop-filter` over the moving map.
- Hand-editing `public/atlas/v1/places.json` — edit `tools/atlas-build/content/*.mjs` and rebuild.
- Inventing PYQ years/appearances or facts; every PYQ record needs a source.
- Profiling the dev server (React dev overhead dominates).
- Force-pushing / rebasing shared branches.

## 8. Progress log (newest first) — continue from the first unchecked item

- [ ] M6 Surface PYQ data + priority in the app (PlaceDetails, Gazetteer, review order)
- [x] M5 Study-priority score in `tools/atlas-build/lib/pyq.mjs` (`scorePlaces`): parts frequency 0.30,
      recurrence 0.15, recency 0.15 (half-life 6 y, anchored to the latest ledger year), importance 0.20 (level +
      key tags), density 0.10 (linked places, asked links count double), gap 0.10 (important but asked ≤ 1×).
      Each place gets `yield: { score, band (core ≥65 / high ≥45 / medium ≥25 / low), parts, reasons[] }`;
      `places.json.yieldModel` holds weights + the "heuristic, not a prediction" note. Only runs when the ledger
      has entries (no claims without data).
- [x] M4 PYQ pipeline (infrastructure; **ledger still empty** — sources unreachable from the cloud):
      ledger `tools/atlas-build/content/pyq/{index,upsc-prelims,uppsc}.mjs` with `Q(exam, year, q, places, { topic,
      source })` from `content/dsl.mjs`; `attachPyq` resolves ids/names/aliases (normalised + descriptor-free core
      names, `{ name, kind, state }` hints), validates entries (exam, year, question text and a source link or
      `pdf:<file>#p<n>` are required), and sets `pyq: { count, years, exams, topics, sources }`; unmatched /
      ambiguous / invalid refs go to `tools/atlas-build/reports/pyq-review.json`. Places accept `src` provenance
      (→ `sources`). Tests: `cd tools/atlas-build && npm test` (8, node:test, no deps; also in CI).
      `node build.mjs --places-only` output is byte-identical while the ledger is empty.
      **Next for data:** transcribe the four sources + the user's PDFs into the ledger, rebuild, work through
      reports/pyq-review.json (add missing places via `P(..., { src })` or `aka`), rebuild.
- [x] M3 Global polish: numbers (focus stat cards, project stats, desktop sidebar clock, Insights tiles) in Manrope
      semibold tabular — Fraunces kept for headings; switching tabs now starts the new screen at the top
      (`onExitComplete` scroll reset in `App.tsx`); unused Sky CSS removed (twinkle, shooting star). Reviewed every
      screen (phone + desktop, light + dark) with `tools/perf/screens.mjs`; no layout breakage found.
      Not done (optional): per-screen spacing tweaks — nothing stood out as broken.
- [x] M2 Focus screen: `.timer-digits` (Manrope 600, tabular, -0.035em) on the focus screen and immersive clock;
      dial blur-glow filter removed and centre light toned down; immersive mode has a plain dark background by
      default — the expedition chart is opt-in (`settings.immersiveChart`, Settings › Atlas, default off, no DB
      migration needed); immersive status line shows "Until 3:17pm" / "Paused" / "Open focus" instead of repeating
      the phase; no backdrop blur on immersive buttons.
- [x] M1 Map/app chrome: `.glass` utility removed; Atlas controls, bottom nav, timer pill and toasts use solid
      `bg-surface`; Insights sticky header no longer blurs; `--shadow-lift-value` softened (light + dark).
      Added `tools/perf/screens.mjs` (phone/desktop × light/dark screenshots of every screen).
- [x] M0 Atlas performance + Sheet ghost-click fix + tools/perf + this handoff (commit 5105dca)

## 9. Ready-to-paste prompt for a new local Claude Code session

Run `claude` inside a clone of the repo on branch `claude/jolly-clarke-qk4fys`, then paste:

```text
Continue the Lodestar upgrade in this repo (markus-aurelius1/study-timer), branch
claude/jolly-clarke-qk4fys. You have no access to earlier sessions.

1. Verify first: `git status`, `git log --oneline -5`; read docs/HANDOFF.md completely (it holds the
   user's requirements, architecture, status, measurements and the milestone plan). Do not assume
   anything in it is implemented without checking the code.
2. `npm ci && npm run typecheck && npm test && npm run build`, then `npm run preview` and, in
   tools/perf, `npm install` (+ `npx playwright-core install chromium` or set CHROMIUM_PATH) and
   `node smoke.mjs http://localhost:4173/` (all PASS expected). Report branch, HEAD, results and any
   mismatch with the handoff before editing.
3. Continue from the first unchecked milestone in §8 of docs/HANDOFF.md. Follow §4 (requirements,
   especially: don't redesign, don't break timer/planner/calendar/sessions/stats/Atlas
   progression/offline, no unnecessary UI, never invent PYQ facts, keep the score interpretable with
   reasons stored in the data) and §7 (things to avoid).
4. PYQ sources (use directly; plus any PDFs the user points you to):
   https://www.pmfias.com/category/prelims/protected-area-network/
   https://www.pmfias.com/category/upsc-cse-prelims-pyqs/prelims-pyqs-geography/prelims-pyqs-mapping/ (+ /page/N/)
   https://thedistrictminds.com/UPPSC_PYQs_Analysis_District_Minds.html
   https://superkalam.com/upsc-preparation/resources/upsc-map-based-pyqs-2015-2025-practice-map-questions
5. Work in small steps; after each milestone run typecheck, tests, build and the smoke test, tick it
   in §8 of docs/HANDOFF.md, commit with a clear message and push to claude/jolly-clarke-qk4fys.
   No rebases or force-pushes; no rewrites of working code.
```
