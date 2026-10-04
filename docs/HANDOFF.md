**Current owner deployment authorization — 2026-10-05:** prepare one release checkpoint, push only `handoff/claude-overhaul`, and deploy the accepted Atlas/News/Settings application to Cloudflare Pages. Application behavior stays frozen; no performance work or J-25. No authentication configuration. Earlier publication prohibitions below describe prior tasks and are superseded for this deployment only.

**Latest owner decision, 2026-10-04: application accepted for private Cloudflare deployment with a documented current-host synthetic gesture exception.** Source is frozen; stop all performance work, J-25 investigation and renderer/compositor experiments. The historical four failed gesture limits and all budgets remain unchanged for future stable/physical-device validation. Only the eight requested minimal sanity checks run now. No temporary experimental application changes remain; all 550 entry non-document hashes match. No authentication configuration, commit, push or deployment. [Release decision](TARS-PRODUCTION-READINESS.md); [deployment handoff](TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md); [preserved historical profiling](TARS-J24-GESTURE-REPAIR.md).

**Historical final readiness contract before the J-24 authorization, 2026-10-04:** preserve the local redesign and runtime repairs. Desktop 56px product bar; mobile 52px top + 56px Atlas/News bottom navigation with safe areas. Desktop News uses a 180px collection rail and wide editorial rows. Collapsed search, contextual filters/Sources and compact map options remain. No Notes/reader, productivity surfaces, schema/data/ID changes or publication. The newer J-24-only authorization supersedes that job's prior scope restriction. J-25, camera/labels, canonical data/PYQs, migrations and IDs remain protected. Presentation evidence: [TARS-PRODUCTION-READINESS.md](TARS-PRODUCTION-READINESS.md).

> Current contract, 2026-10-04: Editorial Cartography presentation work is authorized for Atlas + external-link News + auxiliary Settings. No active Notes/reader/detail UI; historical notes and all other personal state remain intact. Focus, Planning and timer expeditions remain removed. Renderer/camera/label/tile/cache, canonical data/PYQ grading, IDs and Dexie migrations are protected; J-24/J-25 remain unauthorized and unaccepted. No commit/push/PR/deployment. See TARS-EDITORIAL-REDESIGN.md for current baseline/acceptance and ../CODEX_HANDOFF.md §0a. This file is a historical milestone log.

# Development handoff — UI/UX + Atlas performance + PYQ data upgrade + Atlas v2 + Tars rebrand & UI overhaul

> Final verification: [TARS-PRODUCTION-READINESS.md](TARS-PRODUCTION-READINESS.md). Core/News/renderer behavior, fallback parity, labels and persistence pass. Hard gesture timing remains a deployment blocker. Historical repair results and authorization below are superseded by the final owner contract. No migration or publication.

Last updated: 2026-09-26 (local session: M10 — rename Lodestar → Tars and premium UI/UX pass, see §11; before that M9 Atlas v2).
Read this before changing anything, then verify every claim against the code.

## 1. Where the work is

| | |
| --- | --- |
| Working branch (M9) | `claude/atlas-gazetteer-rebuild`, branched from `claude/jolly-clarke-qk4fys` at `fec9da0` |
| Earlier work | `claude/jolly-clarke-qk4fys` (M0–M7), built on `claude/serene-heisenberg-5ibr5v` (the whole app; PR markus-aurelius1/study-timer#1 → `main`, **not merged**) |
| `main` | only the initial commit (README) |

Do not rebase or force-push shared branches; add commits on top. §10 describes the M9 upgrade (Atlas v2).

## 2. What the project is

**Tars** (called **Lodestar** until M10) — a calm, local-first study app for UPSC / UPPCS aspirants:
PLAN → FOCUS → TRACK → REVIEW → IMPROVE.

- **Focus**: pomodoro / countdown / open-focus timer (timestamp-based engine, survives sleep/reload), immersive mode, sounds.
- **Planner**: tasks, projects, habits, natural-language quick add, recurring tasks, calendar (events, exams, focus blocks).
- **Insights**: analytics derived from sessions, goals, heatmaps.
- **The Atlas**: an offline atlas of India + World (~1,180 places chosen for UPSC/UPPCS) that you explore with focus time (XP → expeditions → discoveries) and master through spaced-recall questions.
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

**Sources the user supplied** (use directly; the user's PYQ PDFs arrived in `pyq-sources/` and were transcribed in M7 — the web pages below are not yet):
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
- Renaming the identifiers that still say "lodestar" (§11.3): the IndexedDB name, the PWA manifest `id`, the
  Android/iOS app id, the legacy `lodestar://` scheme and the legacy-key migration. They carry users' data and installs.
- `AnimatePresence mode="wait"` around whole screens (a stuck exit once left the old screen showing – §11.4).

## 8. Progress log (newest first) — continue from the first unchecked item

- [x] M10 **Tars rebrand + premium UI/UX pass** (see §11). Verified: `npx tsc -b` clean; `npm test` 88/88;
      `npm run build` OK; `tools/perf/smoke.mjs` 12/12 (production build); `tools/perf/atlas-check.mjs` 18/18;
      new `tools/perf/ui-audit.mjs` — no unwanted scrollbars at 375/768/1366/1920 px, light + dark, every screen and
      dialog; new `tools/perf/features-check.mjs` 18/18 (sound follows pause/resume/stop, task creation with
      subject/tags, undo, palette capture, sidebar persistence, Atlas + immersive full-screen sync). Not committed.

- [x] M9 **Atlas v2** (see §10): gazetteer 1,181 → **2,273 places** (India 705 → 1,126, World 476 → 1,147), every
      one linked to Wikipedia (2,262) and Wikidata; 98 of 101 Ramsar sites, 59 tiger reserves, 107 national parks,
      18 biosphere reserves, 204 national capitals, 83 strategic and 15 facility places; overlay geometry for 777
      places (courses and outlines); PYQ ledger now matches 1,044 places (0 unmatched, 0 ambiguous; 119 names
      explained as not mapped, down from 305). Coordinate audit of version 1 (`reports/coords-audit.json`): 2 real
      errors fixed (Koodli, Kunchikal Falls), the rest are deliberate label positions of large features.
      Map: all places drawn (undiscovered muted), layers/filters, global search with fly-to, camera paths, eased
      wheel, zoom gestures, hover, keyboard, constant-size names while zooming, fades, style cross-fade.
      Verified (production build, headless Chromium): `npx tsc -b` clean; `npm test` 77/77; atlas-build tests 15/15;
      `tools/perf/smoke.mjs` 12/12; `tools/perf/atlas-check.mjs` 18/18 (desktop wheel/dbl-click/shift/keys/hover/layers/
      search→fly→card across sheets; phone double tap, two-finger tap, search→fly→card above the sheet).
      Profile (390×844 @3x, 4× CPU throttle, before → after, with ~2× the places drawn): pan 11 → 2 frames > 50 ms;
      wheel zoom in 18.6 → 37.4 fps (p95 283 → 67 ms); pan zoomed 44.6 → 55.9 fps (13 → 5 janky); wheel zoom out
      20.7 → 30.9 fps (p95 250 → 83 ms); mouse-wheel notches 25.8 fps. Lessons: never put a custom property on the
      label layer (it restyles every SVG node below; 800 ms frames), never use opacity on HTML names (a paint layer
      each), no `animation-fill-mode: both` on symbols (slow style path on every recalc).
      Follow-ups: (1) the World discovery gap (§10.2); (2) 21 India rivers have no course in Natural Earth or OSM
      (drawn as symbols) — a full `node build.mjs` with `line: trace(...)` could add them; (3) 3 Ramsar sites
      (Sakhya Sagar, Ankasamudra, Gogabeel) and Glaw Lake have no position in any open source; (4) real-device check
      on iOS Safari / Android WebView.

- [ ] M8 **Remaining (optional follow-ups):** (1) transcribe the four web sources in §4 (reachable from a local
      session; not done in M7, which used the user's PDFs); (2) Indian rivers that PYQs name but the India sheet
      does not draw (Mandakini, Barakar, Tons, Pindar, Kshipra, …; listed as RIVER in
      `content/pyq/not-mapped.mjs`) need a full `node build.mjs` with `line: trace(...)` courses — not possible
      with `--places-only`; (3) real-device check of the Atlas (iOS Safari + Android WebView: map-name halos use
      `paint-order` on HTML text).
- [x] M7 PYQ data from the user's PDFs (`pyq-sources/`, git-ignored — copyrighted compilations):
      - `content/pyq/uppsc.mjs`: 572 questions → 654 ledger entries (one per paper a question is tagged with) from
        "UPPSC 1990-2026 Papers – Geography / Uttar Pradesh Special". Parsed with PyMuPDF (column-ordered text
        blocks → question, options, exam tags, answer); every question read and its place references curated by
        hand; exam tags normalised (UPPCS Prelims/Mains, UP RO/ARO, UP Lower Sub., UP UDA/LDA, UPPSC GIC/RI,
        UP BEO). Not transcribed: questions about states/UTs, countries, tribes, crops, minerals/mines, energy
        plants, institutions, culture — they name no atlas place.
      - `content/pyq/upsc-prelims.mjs`: 129 UPSC CSE Prelims entries from the UPSC sections of the ForumIAS PYQ
        Workbook (General Geography), read from page images (its OCR text layer is too jumbled); stems condensed.
      - Every entry cites `pdf:<file>#p<page>`; in places.json the pages are grouped per PDF
        (`{ title, url: 'pdf:<file>', pages }`, `SourceRef.pages`), which keeps places.json at ~1.0 MB / 161 KB gzip.
      - 380 new places (121 India, 259 World) with `src`: position and first-sentence fact from Wikipedia (Wikidata
        coordinates where Wikipedia had none), countries derived from the sheet; aliases (`aka`) added to 17
        existing places (Palghat, Anaimudi, Tarai, Satluj, Tista, Gersoppa Falls, Gobind Sagar, Selvas, …).
        Rule: physical features, protected areas, ports, dams and world capitals are added; towns only when asked
        in ≥ 2 questions or in UPSC Prelims. Arctic Ocean's label position (80° N, 10° W) is chosen for the sheet.
      - `content/pyq/not-mapped.mjs`: 259 names deliberately left out, each with a reason; the build moves them to
        `explained` in `reports/pyq-review.json` (`explainUnmatched` in `lib/pyq.mjs`, tested). Result:
        **0 unmatched, 0 ambiguous, 0 invalid**, 305 explained references; 885 places carry PYQ history.
      - Tests: `tools/atlas-build` 10 (page grouping, not-mapped split, committed ledger fully resolved or explained).
      - App check (`tools/perf/pyqcheck.mjs`, phone viewport, sample history): Gazetteer › Order › Study priority lists
        India as Arabian Sea 86, Chenab 86, Tungabhadra 85, Beas/Ganga/Narmada/Sutlej/Yamuna 84 and World as
        Mediterranean 85, Red Sea 80, Atlantic 78, Suez Canal 78; discovered place cards show "Past papers" (e.g.
        Kolleru: Top priority 70, asked 8× in 5 exams, 2010–2023, Ramsar site, both sources, the heuristic note);
        undiscovered places keep the existing "Not yet discovered" card. Bands: 135 core, 193 high, 420 medium,
        433 low; score rises with PYQ count (0 asked: median 15, 1: 25, 2–4: 45, 5+: 70).
      - Caveat: the PDFs are geography papers, so national parks and other protected areas (asked in environment
        sections) are under-represented — Kaziranga, Corbett, Harike show "important but not yet seen". The PMF IAS
        protected-area source in §4 would fill this.
- [x] M6 App side (renders only once places.json carries PYQ data — verified with a throwaway fixture injected
      into dist/, never committed): `Place.pyq/yield/sources` + `PlacesFile.yieldModel` types; "Past papers" panel on
      the place card (`src/features/atlas/PastPapers.tsx`: asked N× in <exams>, year chips, reasons, source links,
      "heuristic, not a prediction"); Gazetteer "Order: A–Z | Study priority" with score badges (hidden without
      data); review queue takes new places and equally-overdue reviews highest-priority first
      (`dueForReview(..., priority)`; unchanged without data; test added). Same place on both sheets (New Delhi)
      resolves to both instead of "ambiguous".
- [ ] M7 **Remaining:** transcribe the PYQ sources into `tools/atlas-build/content/pyq/` (needs network access to the
      four sites and/or the user's PDFs), add missing places with `src` provenance, rebuild (`npm run places` in
      tools/atlas-build), review `reports/pyq-review.json`, spot-check scores in the app; real-device check of the
      Atlas (iOS Safari + Android WebView: map-name halos use `paint-order` on HTML text).
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

## 10. Atlas v2 — the gazetteer rebuild (M9, 2026-09-26)

**Request (verbatim scope, condensed):** ~1,000 high-value India and ~1,000 World locations from authoritative sources
(no invented places, coordinates or facts; provenance kept); audit, match and deduplicate against the existing
gazetteer without losing user progress; map every feature as a point, line or outline; Google/Apple/Mapbox-quality
interaction (smooth wheel/trackpad/pinch/double-tap zoom, momentum, animated fly-to, focal point preserved, labels that
appear progressively, no snapping); performance on mobile with the full dataset; search, filters, layers, easy
India ↔ World navigation; UPSC metadata kept apart from geographic facts; remove the "Sources: UPPSC Question Papers …
A study heuristic …" lines from place cards (provenance stays in the detail view); verify; deploy to Vercel.

### 10.1 Data pipeline (tools/atlas-build/gazetteer + lib)

```
content/candidates/{india,world}.mjs   curated candidates: C(kind, 'Wikipedia title', { lvl, why, tags, sub, … })
content/candidates/lists/*.json        official lists read from Wikipedia list articles that cite their owners:
                                       Ramsar (RSIS), tiger reserves (NTCA), national parks (MoEFCC/WII),
                                       biosphere reserves (MoEFCC/UNESCO MAB); national capitals from Natural Earth
gazetteer/lists.mjs                    refreshes the lists
gazetteer/link-existing.mjs            links every version 1 place to its Wikipedia article + Wikidata item
                                       → content/sources/links.json (+ hand overrides in link-overrides.mjs)
gazetteer/generate.mjs                 resolves candidates → content/generated/{india,world}.json (+ enrich.json
                                       for existing places) and reports/generate-review.json
lib/wiki.mjs                           cached, rate-limited Wikipedia / Wikidata / Overpass / Nominatim client
                                       (.cache/wiki, git-ignored)
lib/overlay.mjs                        {sheet}-overlay.json: river courses and outlines for places the base sheet
                                       does not draw (Natural Earth 10m by wikidataid, then OSM by wikidata tag)
```

Rules the generator enforces:
- Position: Wikidata P625, else the article, else (designated sites without an article) OpenStreetMap/Nominatim.
  When Wikidata and Wikipedia disagree by > 20 km on a point feature, the more precise value wins (Wikidata sometimes
  holds whole degrees; Wikipedia had a sign error for Kudremukh). Nothing is filled from memory; candidates with no
  position are listed in `reports/generate-review.json` (`noCoords`) and left out.
- Facts: sentences taken verbatim from the article's lead (`gazetteer/facts.mjs`: pronunciations/native-script
  glosses stripped, etymology/census/transport sentences skipped), plus designation facts from the official list
  (e.g. "Designated a Ramsar site on 19 August 2002 (901 km²)").
- Relations from Wikidata statements when the target is in the gazetteer (mouth → tributaryOf/flowsInto, mountain
  range, located next to a river, located in a physical feature).
- Dedupe: same Wikidata item as an existing place → enrich that place (tags, list facts, sources) instead of adding;
  same distinctive name nearby → same; hand merges in `MERGE_INTO` (a reservoir and its dam…). National capitals may
  exist on both sheets (as New Delhi already did).
- Matching articles is strict (`gazetteer/match.mjs`): the distinctive part of the name must match exactly (a redirect
  from a title built from the name counts), the description's head noun must not say it is something else ("District
  of…", "Town in…"), and point features must lie near the authored position. Tests: `tools/atlas-build/test/gazetteer.test.mjs`.

### 10.2 Progression safety (do not break)

- `content/sources/v1-lock.json` snapshots every version 1 place with its level and fog unit. The compiler keeps those
  fixed and warns loudly if a version 1 place goes missing; the pipeline test checks it.
- Version 2 places carry `added: 2`. `explore.ts`: survey finds timed before `ATLAS_V2_AT` (2026-09-26 00:00 UTC)
  follow the version 1 order, so an existing history uncovers exactly the places it did; later finds use the full
  order (new places near base camp come first). `developmentOf` and the ship/developed rule count a version 2 place
  only once it is discovered, so no state loses a level to new data. Tests in `src/atlas/atlas.test.ts` ("data versions").
- Expeditions are unchanged. **Open design question for the user:** only 45 World places lie on an expedition and the
  free survey is India-only, so most World places can never be discovered (their notes stay locked, the map still shows
  them). Options: more World expeditions, or let the survey reach the World sheet after the release date.

### 10.3 App

- Every place is on the map; undiscovered ones are muted (symbols at 50% opacity, names by colour mixing — opacity on
  HTML names gave each its own paint layer and made re-layout ~10× slower). Layers menu (`LayersMenu` in
  AtlasScreen): style, "Places not yet discovered", "Protected areas & disputed regions", category chips
  (`features/atlas/groups.ts`), persisted in `settings.atlasLayers` (defaulted in `seed.ts`, survives backups).
- Overlay (`sheet.ts` loads `{sheet}-overlay.json`, optional): extra river courses + labels, `areas` (park / water /
  region / land). Parks draw from 1.7× zoom (`.atlas-near`), water always, disputed regions dashed crimson; the selected
  place's outline, course or region is highlighted; taps inside an outline open its place.
- New kinds `strategic` (borders, corridors, disputed/conflict areas) and `facility` (nuclear, space, defence sites).
- Place card: designation chips; "Past papers" (no sources paragraph, no heuristic line); undiscovered places also show
  past papers and "Show on the map"; `PlaceSources` = one collapsed "Sources (n) · 27.39° N, 88.83° E" row.
- Gazetteer: searches both sheets (other-sheet results badged), names, aliases, states/countries, kinds, designations
  ("ramsar", "tiger reserve"); precomputed index; picking any place flies to it (switching sheet first).
- Camera (`features/atlas/camera.ts`, tested): van Wijk–Nuij zoom-and-pan path for every camera move (fly-to, fit,
  zoom buttons, double-tap), duration from path length; mouse-wheel notches ease towards an accumulated target around
  the cursor (`isWheelNotch`), trackpad scroll/pinch apply directly; double-click/tap zooms in, Shift+double-click and
  two-finger tap zoom out; pinch release has zoom momentum; arrow/+/- keys; hover lifts symbols (desktop); a tap on open
  map waits 260 ms for a possible double tap (places open at once); names and symbols are counter-scaled (`--inv`) while
  zooming so they keep their size, off on low-power devices; names/symbols fade in; no re-layout while a finger is down.
- India ↔ World switch cross-fades; the previous sheet stays until the next is ready.

### 10.4 Status and follow-ups

See §8 (M9) for what was verified and the measurements.

## 11. Tars — rebrand and premium UI/UX pass (M10, 2026-09-26)

### 11.1 The request (condensed)

Rename Lodestar → Tars everywhere (UI, titles, meta/OG/Twitter, manifest, icons, package, README, code) and make the
app feel premium and bug-free, following the existing stack: (1) capture subject, tags and all metadata when a task
is created (fast quick add that expands to the full field set); (2) dialogs that fit their content – sticky header and
footer, body scrolls only when needed, never sideways; (3) no unwanted scrollbars; focus view and home fit any
screen (dvh/svh, safe areas); (4) timer audio must pause/resume/stop with the timer and clean up; (5) collapsible,
persisted sidebar and a Fullscreen-API toggle for the Atlas; (6) rebrand incl. Vercel project rename (manual);
(7) a premium timer screen (tabular digits, continuous ring, distinct idle/running/paused, tactile controls,
completion moment, in-session calm, seamless timer/stopwatch switch); (8) a consistent motion system respecting
reduced motion; (9) extras as time allows (palette, shortcuts, NL quick add, undo, skeletons, a11y, streak, offline).

### 11.2 What changed (by file)

- **Dialogs** `ui/Sheet.tsx`: flex column capped to the viewport (`100dvh − safe top` on phones, `min(88dvh, 900px)`
  on wider screens); `header` prop for custom title rows; pinned footer (`footer` prop, or `<SheetFooter>` from deep
  inside the content via a portal slot); `<SheetActions>` wraps instead of overflowing; body `overflow-x: hidden`;
  focus trap; a shared layer stack (`pushLayer`/`isTopLayer`) so Escape closes only the top dialog/popover/palette.
  Every editor dialog moved its buttons to the footer (secondary actions as icon buttons at the start).
- **Scroll** `ui/scrollLock.ts` (counted, pads the removed scrollbar), `html { overflow-x: clip }`, themed scrollbars.
  Focus screen: `lg:h-dvh` with the today panel scrolling inside itself; on phones the timer fills the first screen
  (`100svh` minus tab bar and safe areas). Immersive mode locks page scroll.
- **Audio** `audio/follow.ts` (+ `followAction.ts`, tested): subscribes to the timer store, so every path moves the
  sound; `useAudio.stop()` (quick fade, voices released → restarts from the top); `pagehide` stops sound; chime nodes
  are released; `MusicDock` follows the timer through the IFrame API (pause / stopVideo / resume if it paused it) and
  the soundscape and YouTube never play together. The old React effect in `App.tsx` (pause never paused; stop from
  paused never stopped) is gone.
- **Tasks** `planner/quickAdd.ts` (`#tag`, `+project`, `~45m/~1h30m`, `inferSubject`), `planner/tasks.ts`
  (`normalizeTags`, `tagUsage`, `restoreTask`, `#Name` → existing project for compatibility), `data/repo.ts`
  (`restore`), `features/tasks/fields.tsx` (SubjectPicker with search/create/colours, TagInput, PriorityPicker,
  DateQuick, DeadlineField, EstimateField, ProfilePicker, ProjectPicker, FieldRow), `QuickAdd.tsx` (two tiers),
  `TaskSheet.tsx` (same fields, delete → Undo), `TaskItem.tsx` (subject + tags), tag filter, CSV `tags` column,
  `focusOnTask` applies the task's profile.
- **Timer** `features/focus/FocusScreen.tsx`, `TimerDial.tsx` (rAF ring written to the SVG, `useSmoothProgress`, bloom),
  `timer/store.ts` (`phaseEnded`), `SessionCompleteSheet` (waits for the bloom), `ImmersiveFocus` (fullscreen sync),
  CSS `.dial[data-state]`, `.ripple`, `.timer-main`.
- **Shell** `app/Shell.tsx` (collapsible sidebar, tooltips, streak/offline), `app/App.tsx` (`ShellSync` → `data-sidebar`,
  `data-chrome`, `data-session` on `<html>`; enter-only screen transitions; skeleton; offline toasts),
  `app/CommandPalette.tsx`, `app/ShortcutsSheet.tsx`, `app/shortcuts.ts`, `ui/Popover.tsx`, `ui/motion.ts`,
  `services/fullscreen.ts` (`onFullscreenExit`, `useIsFullscreen`), Atlas `useAtlasFullscreen` in `AtlasScreen.tsx`.
- **Brand** `ui/Logo.tsx`, `assets/icon.svg`, `public/favicon.svg`, all PNGs + `public/og-image.png` via
  `scripts/generate-icons.mjs`, `index.html` meta (canonical/OG/Twitter use `%SITE_URL%`, see `vite.config.ts`),
  manifest, package names, native strings, `lib/storage.ts` (key migration, tested), backup `app: 'tars'`.

### 11.3 Deliberately still "lodestar" (do not rename)

| Identifier | Where | Why |
| --- | --- | --- |
| IndexedDB name `lodestar` | `data/db.ts` `DB_NAME` | every install's data lives there; a new name = empty app |
| PWA manifest `id: 'lodestar-study'` | `vite.config.ts` | the installed app's identity; keeping it lets installs pick up the new name/icons |
| `app.lodestar.study` | `capacitor.config.ts`, Android `applicationId`/package, iOS bundle id | store identity; changing it publishes a different app |
| `lodestar://` scheme | Android manifest, iOS plist, `App.tsx` | accepted alongside `tars://` for links/shortcuts made before |
| legacy keys / backups / SW message | `lib/storage.ts`, `data/backup.ts`, `App.tsx` | old values are read once and moved; old backups import |

### 11.4 Notes and follow-ups

- **Manual:** rename the Vercel project (Settings → General → Project Name, e.g. `tars-study`). The canonical/OG URLs
  follow `VERCEL_PROJECT_PRODUCTION_URL` automatically; the old `*.vercel.app` link stops working unless a redirect or
  custom domain is set up. `.vercel/project.json` (local CLI link) keeps working by project id.
- Store listings/app ids for Android/iOS are unchanged (see 11.3); regenerate launcher assets with
  `scripts/generate-icons.mjs` after any mark change.
- Screen transitions are enter-only: once, in dev right after an edit, `AnimatePresence mode="wait"` left the Settings
  screen showing under the Atlas route. Not reproducible since; the exit animation was removed so it cannot recur.
- The progress ring keeps moving under reduced motion (it is information, not decoration); decorative animations
  (halo, breathing ring, blink, ripple) collapse.
- Not done: drag-and-drop for subjects (tasks and subtasks already reorder); real-device checks (iOS Safari
  full-screen fallback, Android WebView) – only headless Chromium was used.
