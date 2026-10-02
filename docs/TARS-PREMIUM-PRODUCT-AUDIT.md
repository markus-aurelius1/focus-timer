# TARS — Premium product quality, UX and engineering audit

**Date:** 2026-10-01 · **Scope:** `focus-timer/` working tree on `main` (HEAD `1e79fed` plus the uncommitted app-shell overhaul) · **Status:** audit and redesign plan. Written before any application code was changed; implementation has since started, see "Corrections and progress" below.

**How it was produced**

- Read all of `src/` (≈27,000 lines: shell, UI primitives, every feature screen, the Atlas renderer and engine, data layer, timer, services), `index.css`, the build config, CI, and the existing handoff documents.
- Counted actual values in use across the codebase (radii, font sizes, durations, press scales, overlays, touch targets) rather than judging by eye.
- Measured the production build (`dist/`, served by `vite preview`) with headless Chrome 154 on the development machine: Core i5-8300H, 8 GB, Intel UHD 630 (hardware raster via ANGLE/D3D11). Three shapes: desktop 1440×900 @1.25, laptop 1440×900 @2, phone 390×844 @3 with touch and 4× CPU throttle.
- Reviewed the screenshots already in `tools/perf/out/shots` and `out/audit` (phone, tablet, laptop, desktop; Paper and Night).

**Evidence conventions:** `path:line` refers to the current working tree. *Measured* means a number from `tools/perf/out/gesture-audit/*.json` or `tools/perf/out/app-audit/*.json`, or from a one-off check described in the appendix. *Counted* means a grep over `src/`. *Observed* means a screenshot.

**Limits of the evidence.** Everything was measured in headless Chrome on one Windows laptop. The "phone" numbers use a phone viewport and a throttled CPU but the laptop's GPU, so they are not a phone GPU measurement. iOS Safari and Android WebView were not tested (the handoff already lists this as open). Run-to-run variance is high, on zoom especially; every range shown is the spread across repeated passes.

**What this audit added to the repository**

- `docs/TARS-PREMIUM-PRODUCT-AUDIT.md` (this file).
- `tools/perf/gesture-audit.mjs` and `tools/perf/app-audit.mjs`: two measurement scripts. They are the verification harness the jobs in §23 refer to. They touch no application code.
- Two lines in `CODEX_HANDOFF.md` (§6 and §8) pointing to this document and the scripts, as the handoff protocol requires.

**Corrections and progress (2026-10-02)**

*One measurement in the original audit was wrong, and is corrected throughout.* The first version of `gesture-audit.mjs` awaited every wheel event. When a repaint held a frame, the input stream paused with it, so a "one-second" zoom was stretched over several seconds with real gaps in the input, and the renderer settled in each gap. That produced the "up to 26 repaints and label re-layouts per zoom" figure. With input sent at a fixed cadence regardless of frame stalls (the harness now does this through CDP), the original renderer made **4–9 repaints and 3–8 label re-layouts per zoom**, at 8.5–21 fps with a 280–470 ms p95. The finding (AT-2) and its cause stand; its size was overstated about threefold. The zoom frame-rate rows in §1 were taken with the first harness and are not comparable with the figures here. A second finding came out of the fix: Chrome delivers wheel and pointer input with the frame, so a timer cannot see input that is waiting behind a slow frame. Stillness has to be judged from the frame loop.

Jobs done so far, uncommitted in the working tree:

| Job | Result |
| --- | --- |
| J-01 Error boundaries | Route, overlay and app boundaries; one automatic reload for a stale chunk. `error-recovery.mjs`: 12 of 12. |
| J-02 Lint and format | ESLint 9 with React hooks, accessibility and two project rules; 0 errors, 445 warnings recorded as the baseline. `typescript-eslint` cannot be used (TypeScript 7 has no JS API), so the parser is Babel and there are no type-aware rules. |
| J-27 Budgets in CI | `--budget` on `gesture-audit` and `app-audit`; count-based budgets in `tools/perf/budgets/`. |
| J-11a Atlas settle and repaint policy | Rest is detected from the frame loop; no repaint starts while one is in flight. Per zoom: 2–4 repaints and 1–2 label re-layouts on all three shapes (was 4–9 and 3–8); 15–27 fps, p95 130–400 ms. Each remaining repaint still holds a frame for 400–550 ms: that is AT-1, stage B. |
| J-11b, J-11c, J-10b, J-03, J-28, J-04, J-05a–d, J-06, J-07a–c | Done; results and measurements are in `CODEX_HANDOFF.md` §5a. |
| J-08 Route state and Atlas keep-alive | Done. Scroll, views and filters return as left; the Atlas is kept mounted behind the stage and returns painted in 85–100 ms (was 320 ms plus a 0.4–1.8 s held frame). |
| J-09 Shell alignment | Done. One header column on every route; rail and full-screen changes are one layout plus a transform; phone tabs and Back are accurate; Plan uses `Tabs` with a "Lists" menu on phones. |
| J-16, J-18, J-19 | Done: Settings and the sound panel on primitives; six deletes with Undo; toasts that wait, sweep away and can be undone from the palette. |
| Focus redesign, study audio, backups | Done outside the original job list at the owner's request: a full-stage Focus room (264 generated wallpapers, 520 lines), a persistent audio engine (34 sounds, 36 generated tracks), and backups that carry notes and Current Affairs reading state. |
| J-10 Focus dial on the compositor | Superseded by the Focus redesign (the progress bar is animated the same way). No frame loop while a session runs (0 `requestAnimationFrame` callbacks a second, was 60–120). Main-thread work 17–32 ms/s on desktop (was 185–368) and 115–135 ms/s at 4× throttle (was 900–990). The 20 and 100 ms/s targets are narrowly missed: what is left is the once-a-second re-render of the timer panel and shell readouts, now job J-10b. `dial-check.mjs`: arc and head within 0.05% of the engine through pause, resume, +5 min, a clock jump and reduced motion. |

---

## Contents

1. [Executive assessment](#1-executive-assessment)
2. [Current application architecture](#2-current-application-architecture)
3. [Product surface inventory](#3-product-surface-inventory)
4. [Design-system audit](#4-design-system-audit)
5. [Interaction and tactility audit](#5-interaction-and-tactility-audit)
6. [Motion-system audit](#6-motion-system-audit)
7. [Atlas deep dive](#7-atlas-deep-dive)
8. [Focus experience audit](#8-focus-experience-audit)
9. [Quiz, popup and overlay audit](#9-quiz-popup-and-overlay-audit)
10. [Navigation and information architecture](#10-navigation-and-information-architecture)
11. [Responsive and mobile audit](#11-responsive-and-mobile-audit)
12. [Accessibility audit](#12-accessibility-audit)
13. [Performance audit](#13-performance-audit)
14. [Frontend architecture audit](#14-frontend-architecture-audit)
15. [Reliability and testing audit](#15-reliability-and-testing-audit)
16. [Recommended target design system](#16-recommended-target-design-system)
17. [Recommended target motion system](#17-recommended-target-motion-system)
18. [Recommended Atlas architecture](#18-recommended-atlas-architecture)
19. [Component-by-component redesign list](#19-component-by-component-redesign-list)
20. [P0 / P1 / P2 / P3 roadmap](#20-p0--p1--p2--p3-roadmap)
21. [Technical dependencies](#21-technical-dependencies)
22. [Risks and regressions to avoid](#22-risks-and-regressions-to-avoid)
23. [Suggested implementation jobs](#23-suggested-implementation-jobs)

---

## 1. Executive assessment

### Verdict

TARS is a well-engineered application with a coherent visual direction and an unusually sound data and timer core. It is not a rough codebase that needs rescuing. It falls short of "exceptionally polished" for seven specific, fixable reasons, and none of them requires a rewrite or a framework change.

The single largest gap is the Atlas. Panning is smooth, but zooming is not, and the cause is architectural rather than a tuning problem: every repaint re-rasterises one very large SVG layer, and the renderer repainted it 4–9 times during a one-second zoom (corrected; brought down to 2–4 by J-11a).

The second largest gap is that the design system exists as *tokens* (colours, type roles, motion durations) but not as *components*. About half of the interactive elements bypass the shared primitives, so spacing, radii, press feedback, touch-target size and loading states drift from screen to screen. The surfaces built most recently (Current Affairs, the canonical quiz and question browser, the offline panel) drifted furthest.

### What is already good and must be preserved

| Strength | Evidence |
| --- | --- |
| Timer truth lives in timestamps, replayed after sleep; session ids make effects idempotent | `src/timer/engine.ts`, `src/timer/store.ts:1-8`; 170 lines of engine tests |
| Derived state everywhere (XP, mastery, streaks, exploration); nothing is a counter that can drift | `src/atlas/useExploration.ts:28-48`, `AGENTS.md` §4 |
| All writes go through one repository with tombstones; multi-step writes are transactional | `src/data/repo.ts:37-53` |
| A real surface/ink/accent token set with two themes, and contrast asserted by a QA script | `src/index.css:94-158`, `tools/perf/job4-visual.mjs` |
| One `Sheet` primitive with a layer stack, focus trap, Escape handling, focus restore, scroll lock and drag-to-dismiss | `src/ui/Sheet.tsx:11-23`, `:72-96`, `:136-143`, `:212-233` |
| Undo toasts instead of confirm dialogs for most deletes | `src/features/tasks/TaskSheet.tsx:396-400`, `src/features/notes/NoteParts.tsx:61-81` |
| Command palette backed by a typed, validated action registry that future voice/AI can reuse | `src/tars/registry.ts`, `src/tars/runtime.ts`, `src/app/CommandPalette.tsx` |
| The Atlas camera is not React state; pans are compositor-only; fly-to uses the van Wijk–Nuij path; zoom is continuous and anchored to the pointer | `src/features/atlas/AtlasMap.tsx:251-326`, `src/features/atlas/camera.ts:30-74` |
| The Atlas cartography itself: projection choice, boundary hierarchy, halos, river lettering | Observed, `tools/perf/out/gesture-audit/desktop-held-drag.png` |
| The Focus dial: fixed-width digits, distinct idle/running/paused states, a completion moment | `src/features/focus/TimerDial.tsx`, `src/index.css:641-689` |
| Offline-first with a verified asset manifest; a registry-only news gateway with bounded sizes and no arbitrary URLs | `vite.config.ts:88-112`, `src/current-affairs/gateway.ts` |
| A browser regression suite in CI (smoke, Atlas interactions, layout audit, contrast, offline) | `.github/workflows/ci.yml:36-55` |
| Charts each have a table twin and an accessible name | `src/features/insights/charts.tsx:49-70` |

### The seven things between TARS and a premium product

| # | Problem | Kind | Headline evidence |
| --- | --- | --- | --- |
| 1 | **Atlas zoom stalls.** One monolithic SVG layer is re-rasterised on every repaint, and a settle timer that races slow frames causes a repaint storm. | Architectural | Measured: zoom runs at 14–38 fps with 430–980 ms worst frames on desktop and laptop; 4–9 full repaints and 3–8 React label re-layouts in one gesture (corrected, see above); 5–9 s of GPU raster work per second of zoom |
| 2 | **The map is empty while you drag.** Names and symbols exist only for the last settled viewport and are not laid out while a pointer is down. | Architectural | Measured: after a held drag at zoom, 5 names and 1 symbol on screen; 47 and 46 after release |
| 3 | **A running focus session keeps the main thread busy.** The dial writes SVG attributes on every animation frame for the whole session. | Architectural, small | Measured: Focus idle 0 ms/s; Focus running 185–368 ms of main-thread work per second on desktop and 900–990 ms/s at 4× CPU throttle (the thread is saturated) |
| 4 | **The design system stops at tokens.** No shared pressable, list row, progress bar, tab set, tooltip, menu or date field. | Structural | Counted: 128 raw `<button>` vs 123 primitive uses; 9 press scales; 12 hand-rolled progress bars; 24 arbitrary font sizes; 14 radius values |
| 5 | **One overlay pattern for everything.** 31 `Sheet` call sites covering 28 surfaces; on desktop every one is a centred modal. One popover, one menu, one tooltip in the whole app. | Structural | Counted; `src/ui/Sheet.tsx:107` |
| 6 | **Navigation behaves like pages.** First visits to lazy screens show a skeleton for 330–650 ms on desktop; scroll position and screen state are lost on every navigation; Back does not close a sheet; most phone controls are 24–36 px. | Structural | Measured: route timings below; at 375 px, 111 controls under 40 px across nine routes; `src/app/App.tsx:119-126`, `:307-313` |
| 7 | **No safety net for polish work.** No error boundary, no component or interaction unit tests, no linter, no performance budget. | Engineering | Counted: zero `ErrorBoundary`; 22 test files, all pure logic; `package.json` has no lint tooling |

Cosmetic problems (type sizes, radii, hover colours) are symptoms of #4. They should be fixed by building the primitives, not by a pass over each screen.

### Headline measurements

All from the production build. fps is frames delivered ÷ wall time; "worst" is the longest single frame.

| Gesture | Desktop @1.25 | Laptop @2 | Phone @3, 4× CPU |
| --- | ---: | ---: | ---: |
| Idle | 60 fps | 60 fps | 60 fps |
| Pan at fit zoom: fps / worst frame | 54–59 / 117–416 ms | 54–59 / 117–583 ms | 48–57 / 183–700 ms |
| Held drag while zoomed in: worst frame | 700 ms | 633 ms | 333 ms |
| Names on screen while held → after release | 5 → 47 | 5 → 47 | 11 → 45 |
| Symbols on screen while held → after release | 1 → 46 | 1 → 46 | 8 → 65 |
| Continuous zoom in: fps / p95 / worst | 18–38 / 33–367 / 433–550 ms | 22–29 / 83–333 / 483–983 ms | 16–19 / 250–267 / 383 ms |
| Continuous zoom out: fps / p95 / worst | 14–36 / 83–467 / 433–733 ms | 17–20 / 283–383 / 566–583 ms | 14–22 / 267–283 / 400–450 ms |
| Mouse-wheel notches out: fps / worst | 2–12 / 517–866 ms | 22 / 417 ms | 39 / 267 ms |
| Pinch in / out (touch): fps / worst | n/a | n/a | 38 / 333 ms · 43 / 267 ms |
| Full base-map repaints in one zoom gesture (corrected) | 5–9 | 7 | 4–6 |
| React label re-layouts in one zoom gesture (corrected) | 4–8 | 6 | 3–5 |
| Per-name style writes in one zoom gesture | 4,210–9,600 | 10,142–10,777 | 1,316–1,799 |
| Tap on a place → card appears | 276–286 ms | 305 ms | 330 ms |

For comparison, the repository's own MapLibre spike measured p95 frame times of 18 ms for idle, pan and wheel at the phone shape (`docs/TARS-VNEXT-JOB-2-3.md:67`). That is the level the current renderer has to reach.

Outside the Atlas (three runs each, from `tools/perf/app-audit.mjs`; desktop is unthrottled, phone shape is 4× CPU throttle; the spread between runs is real and is shown):

| Measurement | Desktop @1.25 | Phone shape, 4× CPU |
| --- | ---: | ---: |
| Focus screen, timer idle: main-thread work per second | 0 ms | 0 ms |
| Focus screen, session running: main-thread work per second | 185–368 ms | 900–990 ms |
| Immersive mode, session running | 261–364 ms | 970–991 ms |
| Home, session running elsewhere | 17–36 ms | 146–442 ms |
| Route change, in entry chunk (Home, Plan) | 48–145 ms | 240–970 ms |
| Route change, first visit to a lazy screen (Calendar, Notes, Current Affairs, Settings), skeleton shown every time | 330–644 ms | 435–1,956 ms |
| Route change, first visit to Insights | 451–573 ms | 2,156–3,343 ms |
| Route change to Atlas: first visit / second visit | 954–2,244 / 160–1,329 ms | 2,633–5,956 / 1,083–2,698 ms |
| Cold start to the Home heading (local server, no network latency) | 1.0–2.9 s | 4.6–9.8 s |
| Gazetteer (2.5 MB) requested during Home start-up | yes, at 0.6–1.4 s | yes, at 3.1–6.2 s |

### The smallest coherent set of changes

1. **Add the safety net first.** Error boundaries, a linter with two custom rules, component tests for the primitives, and the gesture audit as a CI budget.
2. **Fix the Atlas in two steps.** First stop the repaint storm and the empty-map-while-dragging behaviour inside the current renderer. Then move base-map rasterisation into a tile cache drawn off the main thread. Keep the data, projection, cartography and offline behaviour. Do not adopt MapLibre now.
3. **Make a running session cost nothing between ticks.** Drive the dial from the compositor instead of from a 60 Hz script loop.
4. **Finish the design system as components.** About twelve primitives cover nearly every drifting pattern.
5. **Split `Sheet` into a small surface family** (dialog, bottom sheet with detents, side panel, popover, menu, tooltip) and move each of the 28 sheet-based surfaces to the right member.
6. **Make navigation behave like an app.** Preload screens so no skeleton appears, keep screen state and scroll per route, let Back close the top surface, give the title one position on every screen.

Everything else in this document is detail under those six moves.

---

## 2. Current application architecture

### Stack

React 19.3 · TypeScript 7 (strict) · Vite 8 (rolldown) · Tailwind CSS 4.3 (CSS-variable tokens, utilities inline) · Motion 13 · Zustand 5 · Dexie 4 with `dexie-react-hooks` · `topojson-client` · `lucide-react` · `vite-plugin-pwa` (Workbox) · Capacitor 8 shells for Android and iOS. No chart, map, date, form or UI-kit library. Hosting is static on Vercel with one serverless function for news feeds.

### Runtime shape

```
index.html            inline script applies theme and collapsed-rail state before first paint
main.tsx              React root (StrictMode)
app/App.tsx           useBoot → ensureSeed, bootTimer, installAudio, installSoundFollow
  <MotionConfig reducedMotion="user">
    <Main>
      RuntimeSync · ShellSync · TarsContextBridge · DeepLinks · TitleSync     (render nothing)
      <Rail/>                                 fixed, ≥768 px
      .app-frame > main.stage > .stage-scroll > motion.div[key=route] > <Screen/>
      <TabBar/>                               fixed, <768 px
      MusicDock · TaskSheet · SoundSheet · SessionCompleteSheet · ContextSheet · ProfileSheet
      QuickCapture · Onboarding · ImmersiveFocus · CommandPalette · ShortcutsSheet
      ConfirmHost · Toaster                   (all mounted on every route)
```

| Concern | How it works now | Where |
| --- | --- | --- |
| Routing | Hash router; nine flat route names; sub-views in query params; one-shot params consumed after use | `src/app/router.ts` |
| Screen change | `motion.div` keyed by route name: the old screen unmounts at once, the new one fades up 6 px in 220 ms; scroll is reset to the top | `src/app/App.tsx:117-146` |
| Code splitting | Home, Focus and Tasks are in the entry chunk; Calendar, Insights, Atlas, Settings, Current Affairs and Notes are lazy; every global sheet is in the entry chunk | `src/app/App.tsx:23-51` |
| Shell layout | CSS variables on `<html>` (`--rail-size`, `--rail-w`, `--nav-bottom`, `--stage-gap`) plus `data-sidebar`, `data-chrome`, `data-session` attributes | `src/index.css:409-565` |
| Global UI state | One Zustand store of booleans (which sheet is open) plus rail and full-screen flags | `src/app/ui-store.ts` |
| Timer | Pure engine; Zustand store persists to `localStorage` on every transition and reconciles on wake | `src/timer/` |
| User data | Dexie (`lodestar` DB, schema v2). Shared live queries for sessions, tasks, claims, recalls, runs; per-consumer live queries for labels, projects, profiles, goals, events | `src/data/hooks.ts:31-58`, `:71-140` |
| Other persistence | `localStorage`: timer, theme, rail, mode memory, Atlas visit, Current Affairs read/save state, notes. Native IndexedDB: Current Affairs archive. CacheStorage: precache and news | `src/lib/storage.ts`, `src/current-affairs/` |
| Derived Atlas state | `useExploration()` computes exploration, mastery, XP and the review queue from history, cached by input identity | `src/atlas/useExploration.ts` |
| Action layer | `executeAction(id, input)` validates and runs typed actions; the palette, shortcuts, deep links and several buttons use it | `src/tars/` |
| Styling | Tailwind utilities inline; a small components layer (`.t-*` type roles, `.row`, `.press`, `.note-paper`, `.kbd`, `.skeleton`); one 947-line stylesheet | `src/index.css` |
| Motion | `src/ui/motion.ts` (durations, easings, springs, presets) with CSS twins; Motion for React-driven animation, CSS for state and decoration, rAF for the dial and the map | `src/ui/motion.ts`, `src/index.css:83-92` |
| Overlays | `Sheet` (bottom sheet <640 px, centred dialog ≥640 px), `Popover`, `Menu`, `Toaster`, `ConfirmHost`, `CommandPalette`, a rail tooltip, and a hand-rolled layers popover | `src/ui/`, `src/app/` |
| Atlas data | Build pipeline produces pre-projected TopoJSON sheets, WebP relief plates, overlays and a 2.5 MB gazetteer; all precached | `tools/atlas-build/`, `public/atlas/v1/` |
| Atlas rendering | One component: SVG base layer, SVG flow layer, mixed SVG/HTML label layer; rAF-batched gestures move layers with CSS transforms | `src/features/atlas/AtlasMap.tsx` |
| Tests | 22 Vitest files (pure logic, node environment); 42 pipeline tests; Playwright scripts for browser regression | `src/**/*.test.ts`, `tools/perf/` |

### Measured delivery

| Item | Value |
| --- | --- |
| Entry chunk | 279 KB raw, 84 KB gzip (`dist/assets/index-*.js`) |
| Initial static JS graph | about 255 KB gzip: entry 84, React 68, Motion 43, Dexie and Zustand 32, Capacitor 9, shared 19 |
| CSS | 81 KB raw, 15.5 KB gzip |
| Fonts | four WOFF2 files, 189 KB (Manrope 40, Fraunces 149) |
| Precache | 176 entries, 8.05 MB; the gazetteer alone is 2.49 MB |
| Largest lazy chunks | Atlas 65 KB, Field Review 53 KB, Current Affairs 45 KB, Insights 38 KB, Settings 33 KB (raw) |

---

## 3. Product surface inventory

### Screens

| Surface | Route · file | Lines | Frame | Column width | Loading · empty · error |
| --- | --- | ---: | --- | --- | --- |
| Home | `#/home` · `features/home/HomeScreen.tsx` | 340 | own header + `workspaceColumn('lg')` | 56 rem | none needed · text line · none |
| Focus | `#/focus` · `features/focus/FocusScreen.tsx` | 543 | own header, fits the stage | 72 rem | none · `EmptyState` in Up next · none |
| Immersive focus | overlay · `features/focus/ImmersiveFocus.tsx` | 250 | full screen, own colours | – | – |
| Plan (lists) | `#/tasks?view=` · `features/tasks/TasksScreen.tsx` | 540 | `Workspace` + toolbar tabs | 48 rem | none · `EmptyState` · toast |
| Plan (calendar) | `#/calendar` · `features/calendar/CalendarScreen.tsx` | 477 | `Workspace` + toolbar tabs | 72 rem | generic skeleton · hint text · none |
| Plan (habits) | view of Plan · `features/tasks/HabitsView.tsx` | 249 | inside Plan | 48 rem | none · `EmptyState` in a `Card` · none |
| Current Affairs | `#/current-affairs` · `features/current-affairs/CurrentAffairsScreen.tsx` | 240 | `Workspace` | 56 rem | plain text "Loading trusted feeds…" · custom text block · inline red text |
| Atlas | `#/atlas` · `features/atlas/AtlasScreen.tsx` + `AtlasMap.tsx` | 623 + 1,539 | full-bleed, no `Workspace`, no `h1` | – | flat blue panel with a pill "Unrolling the map…" · n/a · pill text |
| Notes | `#/notes` · `features/notes/NotesScreen.tsx` | 135 | `Workspace` + toolbar | 64 rem | generic skeleton · `EmptyState` · inline red text |
| Insights | `#/insights` · `features/insights/InsightsScreen.tsx` | 453 | `Workspace` + toolbar | 64 rem | generic skeleton · `EmptyState` · none |
| Settings | `#/settings` · `features/settings/SettingsScreen.tsx` | 400 | `Workspace` | 42 rem | generic skeleton · n/a · toast |

Five different column widths are in use (42, 48, 56, 64 and 72 rem), plus the full-bleed Atlas. Because each column is centred, the page title sits at a different horizontal position on almost every screen (observed in `tools/perf/out/shots/_lap1.png` and `_lap2.png`). This is the most visible "set of pages" tell in the shell.

### Navigation

| Element | File | Notes |
| --- | --- | --- |
| Rail (≥768 px) | `app/Shell.tsx:113-213` | Seven destinations, search, capture, settings, running timer, streak, offline badge. Icons only from 768 to 1023 px or when collapsed. Active item uses a shared-layout indicator. |
| Tab bar (<768 px) | `app/Shell.tsx:76-106` | Five tabs. Notes, Insights and Settings are reached only from Home rows, the Home header, or the palette. |
| Workspace header | `app/Workspace.tsx:76-109` | Sticky 56 px title row, optional toolbar, hairline once scrolled. |
| Plan tabs | `features/tasks/PlanTabs.tsx` | Seven views in a horizontally scrolling row; four are visible at 375 px with no overflow cue. |
| Command palette | `app/CommandPalette.tsx` | `Ctrl/⌘ K`; actions, places, tasks, natural-language capture. |
| Shortcuts | `app/shortcuts.ts` | `G` chords, `N`, `C`, `?`, `Space`, `F`, `S`, `Shift+F`. |

### Overlay surfaces (28 built on `Sheet`, 9 others)

| Group | Surfaces | Primitive |
| --- | --- | --- |
| Global (mounted in `App.tsx`) | Task editor, Soundscape, Session complete, Session context, Timer profiles, Quick capture, Onboarding (two steps), Shortcuts, Confirm | `Sheet` |
| Global, custom | Command palette, Immersive focus, Music dock, Toaster | bespoke |
| Focus | End session | `Sheet` |
| Plan | Project editor, Habit editor, Schedule focus block (opens on top of the task editor), Event editor | `Sheet` |
| Insights | Session editor, Goal editor | `Sheet` |
| Settings | Restore backup, Label editor | `Sheet` |
| Current Affairs | Short notes | `Sheet`; filters and analytics are inline regions toggled with `hidden` |
| Atlas | Place or region details (phone), Atlas menu (phone), Expeditions, Gazetteer, Legend, Base camp, Field review, Question browser, Canonical question | `Sheet` |
| Atlas | Inspector (desktop) | absolutely positioned `aside` |
| Atlas | Layers | hand-rolled popover (`AtlasScreen.tsx:535-623`) |
| Tasks | Subject picker | `Popover` (its only use) |
| Tasks | Project options | `Menu` (its only use) |
| Rail | Tooltips when collapsed | bespoke (`Shell.tsx:196-210`) |

### Where parts feel designed independently

| Area | What differs | Evidence |
| --- | --- | --- |
| Current Affairs | Uses none of the shared button, select, segmented or search primitives. Its own class strings give 44 px targets and `rounded-xl` controls, while the rest of the app uses 32–40 px pills. Filters appear with the `hidden` attribute, no transition. | `CurrentAffairsScreen.tsx:25-27`, `:130-176`; 13 raw buttons, 0 primitives |
| Canonical quiz, question browser, place questions, offline panel | Native radio inputs, plain "Loading…" text, no press feedback, `<Select>` inside bare `<label>`s, compressed one-line code style. | `CanonicalQuiz.tsx:38-51`, `PyqBrowser.tsx:26-39`, `PlaceQuestions.tsx:26-29`, `OfflineAtlas.tsx:42` |
| Field review vs canonical quiz | Two different answer components for the same job: tappable tiles that answer immediately, vs radio labels plus a Submit button. Different radius, feedback block, progress display and typography. | `FieldReview.tsx:148-175` vs `CanonicalQuiz.tsx:41-49` |
| Calendar | The only screen with bordered grid cards; event blocks have no hover or press state; uses an emoji as an icon. | `CalendarScreen.tsx:189`, `:208`, `:310`, `:400-412` |
| Soundscape sheet | Bordered tiles with native range inputs; play button built by hand; no press feedback. | `SoundSheet.tsx:82-90`, `:148-166` |
| Immersive focus | Hard-coded colours, its own round buttons, no haptics, no shared tokens. | `ImmersiveFocus.tsx:19`, `:91`, `:244-250` |
| Search fields | Four designs: palette, Gazetteer, session context, Current Affairs. | `CommandPalette.tsx:90-118`, `Gazetteer.tsx:99-102`, `ContextSheet.tsx:115-118`, `CurrentAffairsScreen.tsx:140-143` |
| Date and time fields | Styled ad hoc as 32 px `rounded-lg` wells, unlike the 42 px `rounded-xl` text fields beside them. | `tasks/fields.tsx:291`, `:300`, `:303`; `TaskSheet.tsx:235-242` |
| Type roles | Two overlapping systems: `.t-*` (about 120 uses) and `.type-*` (six classes, one of them used once). | `index.css:292-349`, `:939-945`; `TimerDial.tsx:216` |

---

## 4. Design-system audit

**Does TARS have a real design system?** Partly. It has a real *token* layer for colour, elevation, type roles and motion, and a documented set of rules (`CODEX_HANDOFF.md` §7). It does not have a *component* layer that enforces them. The rules are followed where the original author applied them by hand and drift everywhere else.

### 4.1 What exists

| Layer | State | Evidence |
| --- | --- | --- |
| Surface colours | Five layers (`canvas`, `bg`, `surface`, `surface-2`, `surface-3`), two hairlines, three inks. Coherent in both themes. | `index.css:94-158` |
| Semantic colours | `accent`, `primary`, `danger`, `success`, three phase colours, `chart`, `note`. No `warning` or `info`: the warning toast uses `danger`. | `index.css:107-122`; `ui/feedback.tsx:27` |
| Elevation | Three shadows (`soft`, `lift`, `dialog`) plus the convention `0 0 0 1px var(--line), var(--shadow-*)` for floating chrome. | `index.css:123-125` |
| Type roles | Eight roles (`t-display` … `t-num`) in the components layer. | `index.css:292-349` |
| Radius | Two named tokens, both 1 rem (`--radius-card`, `--radius-stage`). | `index.css:69-70` |
| Motion | Four durations, three easings, five springs, four presets, with CSS twins. | `ui/motion.ts`, `index.css:83-92` |
| Primitives | `Button`, `IconButton`, `Toggle`, `Segmented`, `Chip`, `Stepper`, `TextInput`, `TextArea`, `Select`, `Field`, `Row`, `Card`, `SectionTitle`, `Dot`, `Spinner`, `Sheet`, `Popover`, `Menu`, `Ring`, `ColorPicker`, `EmptyState`, `Toaster`. | `src/ui/` |

### 4.2 Where it breaks down (counted)

| Dimension | Tokens defined | Distinct values in use | Detail |
| --- | ---: | ---: | --- |
| Font size | 8 roles | 24 arbitrary + 6 named | `text-[13px]` ×64, `[12px]` ×49, `[15px]` ×43, `[14px]` ×21, `[12.5px]` ×14, `[11px]` ×14, `[10px]` ×14, then `13.5`, `11.5`, `14.5`, `10.5`, `15.5`, `9`… Half-pixel sizes exist to split differences between roles. |
| Type role adoption | – | – | Roles are used about 120 times; raw size utilities about 400 times. |
| Font weight | – | 4 | `semibold` ×131, `bold` ×115, `medium` ×19. Bold and semibold are used interchangeably for the same job (row titles are `font-semibold` in `TaskItem.tsx:115` and `font-bold` in `HabitsView.tsx:71`). |
| Radius | 2 | 14 | `full` ×159, `xl` ×37, `2xl` ×36, `lg` ×9, `[10px]` ×8, `[3px]` ×5, `card` ×4, `md`, `[18px]`, `[20px]`, `[22px]`, `[24px]`, `[2px]`. Containers alone use 16, 18, 20, 22 and 24 px. |
| Shadow | 3 | 11 | Three tokens, five token-plus-ring compositions written out by hand, and stray `shadow-sm` and `shadow-lg`. |
| z-index | 0 | 9 | `10`, `19`, `20`, `30`, `40`, `50`, `55`, `60`, `70`, chosen per component. |
| Durations | 4 | 22 | 100, 120, 140, 150, 180, 200, 220, 240, 260, 300, 320, 340, 360, 500, 520, 560, 600, 700, 800, 900, 1000, 1400 ms. |
| Springs | 5 | 10 | Five in `motion.ts`, five more inline. Two of the tokens (`T.calm`, `T.press`) are never used. |
| Press feedback | 1 class | 9 | `.press` 0.96, `.row` 0.992, Button 0.97, IconButton 0.94, `active:scale-90`, `-95`, `[0.99]`, Motion `whileTap` 0.93 and 0.9. |
| Hover treatment | – | 9 | `bg-surface-2` ×46, `/60` ×9, `/70` ×2, `bg-surface-3`, `brightness-110`, `border-line-strong`, `text-accent`, `text-ink`, underline. |
| Disabled | – | 4 | Opacity 25, 30, 40 and 60. |
| Progress bars | 0 | 12 | Three heights, three track colours, two animation methods (see §6). |
| Row pattern | `.row` | – | `.row` is used 6 times; 57 rows re-implement hover by hand. |
| Search field | 0 | 4 | See §3. |
| Icon size | – | 9 | `size-3`, `3.5`, `4`, `4.5`, `5`, `[17px]`, `[18px]`, `[19px]`, `[22px]`; ten different `strokeWidth` overrides. |
| Raw hex in UI code | – | – | `Legend.tsx` ×13, `ImmersiveFocus.tsx` ×6, `AtlasScreen.tsx:83-84`, `AtlasMap.tsx:1207`, `:1221`, `:1499`, `pyq/blocks.css:11`. |

### 4.3 Findings

**DS-1 · No type scale between the roles and the pixels**

- **Current state.** Eight type roles exist, but most text is sized with arbitrary pixel utilities.
- **Problem.** Twenty-four sizes within a 9–30 px range cannot read as a deliberate hierarchy; 12, 12.5, 13 and 13.5 px are indistinguishable in intent. Pixel sizes also ignore the user's browser font-size preference, while the named Tailwind sizes (rem) respect it, so half the interface scales and half does not.
- **Evidence.** §4.2; e.g. `PlaceDetails.tsx:92-93` (13 px), `:128` (15 px), `:138` (12 px), `AtlasPanel.tsx:81` (13.5 px), `:85` (12 px), `:162` (11 px).
- **Target experience.** Any two pieces of text with the same job look identical on every screen.
- **Recommended change.** A nine-step rem scale exposed only through roles (§16.2). Ban `text-[…px]` by lint rule outside `src/ui/` and the map.
- **Scope.** Product-wide. **Dependencies.** Lint in place (job J-02).

**DS-2 · Radius, elevation and z-index have no scale**

- **Current state.** Each component picks its own radius, composes its own shadow string and chooses its own z-index.
- **Problem.** Nested surfaces do not relate (a 16 px card inside a 20 px dialog inside a 24 px sheet has no rule). Stacking order is implicit: the popover is at 70, the toaster at 60, the palette at 55, sheets at 50 and a sticky toolbar at 19, each number chosen in a different file, so the next overlay has to guess.
- **Evidence.** `Sheet.tsx:107` (`z-50`), `:129-130` (24 and 20 px), `CommandPalette.tsx:72` (`z-[55]`), `:85` (18 px), `feedback.tsx:14` (`z-[60]`), `Popover.tsx:101` (`z-[70]`), `HomeScreen.tsx:135` (22 px), `AtlasScreen.tsx:373` (20 px), `:408` (18 px).
- **Target experience.** Surfaces nest with visibly related corners; a new overlay never needs a z-index decision.
- **Recommended change.** Radius scale of five steps with a concentric rule; elevation scale of four levels as utilities; a named layer scale (§16.3–16.5).
- **Scope.** Product-wide. **Dependencies.** None.

**DS-3 · Primitives cover half of the interactive surface**

- **Current state.** 123 uses of `Button` or `IconButton`; 128 raw `<button>` elements with hand-written classes. One recipe alone, the ghost icon button, is written out by hand 17 times in 11 files, in slightly different sizes and tints.
- **Problem.** Raw buttons miss haptics (`controls.tsx:49-52`), press feedback, loading state, consistent disabled state and target size. Every new screen re-decides them.
- **Evidence.** Raw buttons per file: Current Affairs 13, Shell 7, Focus 7, Soundscape 7, Atlas screen 6, Calendar 6, task fields 6. Files with raw buttons and no press feedback at all: `SoundSheet.tsx`, `MusicDock.tsx`, `TaskSheet.tsx`, `HabitsView.tsx`, `ProfileSheet.tsx`, `UnitDetails.tsx`, `AtlasPanel.tsx`, `charts.tsx`.
- **Target experience.** Every tappable thing responds the same way under the finger.
- **Recommended change.** One `Pressable` base (state layer, press scale, haptic, focus ring, minimum hit area) that `Button`, `IconButton`, `ListRow`, `Chip`, `Tab` and `Tile` compose. Lint rule: no raw `<button>` outside `src/ui/`.
- **Scope.** Product-wide. **Dependencies.** J-02, J-05.

**DS-4 · Fields are inconsistent, and native controls are unstyled**

- **Current state.** Text fields are 42 px `rounded-xl`. Date, time and datetime inputs are 32 px `rounded-lg` wells written inline. `Select` has two shapes (pill and field) with a hard-coded grey chevron that does not follow the theme. Range sliders are native with an accent colour only. Radios in the canonical quiz are native.
- **Problem.** The task editor, the densest form in the product, mixes three field heights and three radii in one list.
- **Evidence.** `controls.tsx:238-239`, `:249-262` (chevron `stroke=%23888`), `tasks/fields.tsx:291`, `:300-303`, `TaskSheet.tsx:235-242`, `SettingsScreen.tsx:156`, `SoundSheet.tsx:156-165`, `CanonicalQuiz.tsx:43`.
- **Target experience.** One field height per density, one focus treatment, sliders and pickers that look like TARS.
- **Recommended change.** `Field` family: `TextField`, `SelectField`, `DateField`, `TimeField`, `Slider`, `SearchField`, all sharing one frame component. Keep native pickers behind the styled frame (no custom calendar is needed).
- **Scope.** Product-wide. **Dependencies.** J-05.

**DS-5 · "Rows, not cards" is a rule without a component**

- **Current state.** The handoff says to prefer rows on the stage and at most one raised surface per screen. `.row` implements it, and `Row` exists in `controls.tsx:274-293`, but `Row` is never used and `.row` is used six times.
- **Problem.** Rows differ in padding (8, 10, 12, 14 px vertical), hover tint, press behaviour and trailing affordance. Bordered boxes reappear wherever a row did not exist: profile list, expedition rows, shortcut groups, checkpoint box, restore sheet.
- **Evidence.** `TaskItem.tsx:90`, `ContextSheet.tsx:59`, `ProfileSheet.tsx:86-91`, `AtlasPanel.tsx:199`, `UnitDetails.tsx:90`, `SettingsScreen.tsx:232`, `Gazetteer.tsx:137`, `ExpeditionSheet.tsx:90`.
- **Target experience.** Lists across Plan, Atlas, Settings and sheets share one rhythm and one press.
- **Recommended change.** `ListRow` (leading, title, meta, trailing, optional nested actions) with three densities, and `Group` for the hairline container used by Settings.
- **Scope.** Product-wide. **Dependencies.** J-05.

**DS-6 · Colours leak around the tokens**

- **Current state.** UI code uses raw hex in a few places; the map palette is raw hex by design.
- **Problem.** "Correct" is `--success` in the quiz feedback but `#2e8b57` on the map pin beside it; "wrong" is `--danger` vs `#c1121f`. The canonical-question table border is a fixed light grey that does not adapt to Night. The immersive screen and the Atlas loading panel ignore the theme.
- **Evidence.** `AtlasMap.tsx:1207`, `:1221`, `:1499`; `FieldReview.tsx:164-165`; `pyq/blocks.css:11`; `ImmersiveFocus.tsx:19`, `:91`; `AtlasScreen.tsx:83-84`; `Legend.tsx:23-45`.
- **Target experience.** A semantic colour means one colour.
- **Recommended change.** Add `--warning`, `--info`, `--correct`, `--incorrect` and a small `--map-ui-*` set to the tokens; keep cartographic colours in `style.ts` and have the Legend read from it instead of duplicating values.
- **Scope.** Subsystem. **Dependencies.** None.

**DS-7 · Breakpoints disagree between CSS and script**

- **Current state.** The shell switches at 768 px (CSS). `Sheet` switches from bottom sheet to dialog at 640 px (script, `useIsWide`). "Desktop" behaviour starts at 1024 px (`useIsDesktop`).
- **Problem.** Between 640 and 767 px the app shows a phone tab bar with centred desktop dialogs.
- **Evidence.** `ui/useMedia.ts:15-16`, `Sheet.tsx:58`, `:133`, `index.css:418`.
- **Recommended change.** Three named breakpoints (`compact` <768, `medium` 768–1023, `expanded` ≥1024) exported once and used by both CSS and hooks; add an input-modality signal (`pointer: coarse`) so touch behaviour does not depend on width.
- **Scope.** Product-wide. **Dependencies.** None.

**DS-8 · Dead and duplicate system code**

- `.type-operational`, `.type-body`, `.type-heading`, `.type-map`, `.type-quiz`, `.tars-presence` are defined and unused (`index.css:939-947`).
- `Row` is unused (`controls.tsx:274`). `T.calm` and `T.press` are unused (`motion.ts:34`, `:42`).
- `prefersReducedMotion` is defined twice (`lib/device.ts:3`, `lib/platform.ts:12`).
- `FONT_SERIF` equals `FONT_SANS`, and every label spec carries `serif: false` (`features/atlas/labels.ts:54-55`, `:109-120`).

Remove these as part of J-04. They cost nothing at run time but mislead the next contributor.

### 4.4 Icons

Lucide is used consistently, which is good. Sizes and stroke widths are chosen per call site. The tab bar switches stroke width between 1.8 and 2.2 on selection (`Shell.tsx:96`), which makes the icon appear to change weight rather than state. One emoji is used as an icon (`CalendarScreen.tsx:208`). Recommend three icon sizes (16, 18, 20 px) bound to control size, one stroke width, and filled variants for selected navigation.

---

## 5. Interaction and tactility audit

### 5.1 State matrix

`●` designed · `○` partial or inconsistent · `–` missing. "Press" means a visible response while the pointer is down.

| Component | Hover | Press | Focus | Active / selected | Loading | Success / error | Disabled | Touch size |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| `Button` | ● | ● 0.97 | ● | – | ● spinner | – | ● 40% | 32 / 40 / 48 |
| `IconButton` | ● | ● 0.94 | ● | ● | – | – | ○ still hovers | 32 / 40 / 48 |
| `Toggle` | – | – | ● | ● spring thumb | – | – | ● | 48 × 28 |
| `Segmented` | ○ text only | – | ● | ● sliding pill | – | – | – | 24–30 high |
| `Chip` | ○ text only | – | ● | ● | – | – | – | about 26 high |
| `Stepper` | ● | ● | ● | – | – | – | ● | 32; no press-and-hold repeat |
| Task checkbox | – | ● 0.9 | ● | ● spring tick, haptic | ○ 320 ms pending | – | – | 25 × 25 |
| Task row | ● | – | ● | – | – | – | ○ 55% when done | row |
| `.row` rows (Home, Insights log, projects) | ● | ● 0.992 | ● | ● | – | – | – | row |
| Rail item, tab bar | ● | ● | ● | ● shared indicator | – | – | – | 36–40 / 60 |
| Map toolbar buttons | ● | ● | ● | ● | – | – | – | 36 |
| Field review answer tile | ● | ● 0.99 | ● | – | ○ fieldset disabled | ● colour | ● | 48 |
| Canonical quiz option | ● | – | ○ native radio | ● border | ○ text "Saving…" | ● colour | ● | about 56 |
| Calendar day cell | ● | – | ● | – | – | – | – | 74–104 |
| Calendar event block | – | – | ● | – | – | – | – | block |
| Settings action row | ● | – | ● | – | – | ○ toast only | – | row |
| Settings line with toggle | – | – | – | – | – | – | – | only the 48 × 28 switch is tappable |
| Soundscape tile | – | – | ● | ● | ● spinner | – | – | 36 icon |
| Slider | native | native | native | – | – | – | – | native |
| Menu item | ● | – | ● | – | – | – | – | 36 |
| Popover option | ● | – | – | ● | – | – | – | 36 |
| Breadcrumb link (Atlas) | ● underline | – | ● | – | – | – | – | about 18 high |
| Map itself | ● symbol lifts | – | ● inset ring | ● ring settles | – | – | – | 18 px hit radius |

### 5.2 Findings

**IX-1 · Press feedback is uneven and often absent**

- **Current state.** Nine press scales; about a third of interactive elements have none.
- **Problem.** On touch there is no hover, so an element without a press state gives no acknowledgement until its action completes. Rows that open a sheet feel late because nothing happens until the sheet starts to move.
- **Evidence.** §4.2 press row; the task row (`TaskItem.tsx:90`) has hover only; quiz options (`CanonicalQuiz.tsx:42`), settings rows (`SettingsScreen.tsx:232`), calendar cells (`CalendarScreen.tsx:204`).
- **Target experience.** Contact is acknowledged within one frame everywhere: a state layer darkens and the element compresses slightly, then springs back on release.
- **Recommended change.** `Pressable` with two press profiles: *control* (scale 0.96, 90 ms in, spring out) and *surface* (scale 0.985, plus state-layer tint). Size-aware: large surfaces compress less. Apply through the primitives in DS-3 and DS-5.
- **Scope.** Product-wide. **Dependencies.** J-05.

**IX-2 · Things that look interactive but are not**

| Element | Why it reads as interactive | Evidence |
| --- | --- | --- |
| Home "Now" surface | The only raised card on the page; only the title text inside is a button and it has no hover or press | `HomeScreen.tsx:135`, `:237` |
| Today progress block (Home, Focus) | Looks like a widget; does nothing. Insights is the obvious destination. | `shared/TodayLine.tsx:14` |
| Rail streak | Focusable when collapsed (`tabIndex=0`) with a tooltip, but no action | `Shell.tsx:312` |
| Explorer card in the phone Atlas panel | Sits in a raised card above a tappable row | `AtlasScreen.tsx:373-374` |
| Insights facts and mini stats | Numbers with labels in a grid; no drill-down | `InsightsScreen.tsx:362-383` |
| Chart columns | Hover tooltip and focus, but no click; a day cannot be opened from its bar | `charts.tsx:174-186` |
| Mastery box on a place card | Raised well with a progress row; "Test me" is elsewhere on the card | `PlaceDetails.tsx:187-200` |

Recommended change: make each either interactive with a clear destination or visually quiet (no raised well, no pointer cursor). The Today block and chart columns should navigate; the Now surface should respond as one target.

**IX-3 · Selecting a place on the map waits 250 ms with no feedback**

- **Current state.** A single tap is held for 250 ms in case it is the first of a double tap, then selects.
- **Problem.** The measured tap-to-card time is 276–330 ms and nothing on screen changes during it, so the map feels unresponsive at exactly the moment of intent.
- **Evidence.** `AtlasMap.tsx:749-767`; measured `tapLatencyMs`.
- **Target experience.** The symbol responds on contact; the card follows.
- **Recommended change.** Show a pressed state on the hit target at `pointerdown` (ring and slight lift, written directly to the element). Select at `pointerup` without waiting. If a second tap lands within 300 ms, zoom and keep the selection. This removes the timer entirely.
- **Scope.** Atlas. **Dependencies.** None.

**IX-4 · The map has hard edges**

- **Current state.** Pan and zoom clamp abruptly at the sheet bounds and zoom limits. At the default fit on a 1440 px window, the sheet exactly covers the viewport horizontally, so a horizontal drag does nothing at all.
- **Problem.** A drag that produces no movement reads as a frozen map. There is no cue that an edge was reached.
- **Evidence.** `AtlasMap.tsx:279-295`; observed in `tools/perf/out/gesture-audit/desktop-held-drag.png`, where a 1,020 px horizontal drag left the map in place.
- **Target experience.** The map follows the finger past an edge with increasing resistance and springs back on release; zoom past a limit stretches and settles.
- **Recommended change.** Rubber-band the camera (resistance 0.55, spring back critically damped) for pan and pinch; let the default fit sit slightly inside the minimum zoom so there is always some travel.
- **Scope.** Atlas. **Dependencies.** J-11c.

**IX-5 · Toggles, steppers and sliders lack physical detail**

- **Current state.** The toggle thumb springs across but does not react to press. A whole settings row is not a target; only the switch is. The stepper does not repeat while held. Sliders are native.
- **Evidence.** `controls.tsx:110-135`, `:213-236`; `SettingsScreen.tsx:218-228`.
- **Recommended change.** Thumb widens while pressed and can be dragged; the full row toggles; stepper repeats after 400 ms with acceleration; custom `Slider` with a value bubble and a haptic tick at detents.
- **Scope.** Component. **Dependencies.** J-05.

**IX-6 · Drag feedback**

- **Current state.** Task reorder lifts the row (scale 1.02 and shadow) and persists on drop. The handle is hidden on desktop until hover and is a 16 × 24 px target on touch.
- **Evidence.** `TasksScreen.tsx:137`, `TaskItem.tsx:98-110`.
- **Recommended change.** Long-press anywhere on the row starts a drag on touch (with a haptic); the handle grows to a 44 px hit area; add a drop indicator and edge auto-scroll. Bottom sheets should also be draggable from their whole header and from the top of scrolled-to-top content, not only the handle.
- **Scope.** Component. **Dependencies.** J-05, J-07.

**IX-7 · Cursor and haptics**

- `button { cursor: pointer }` is global and correct. The map shows a pointer over places but no grab or grabbing cursor while panning (`AtlasMap.tsx:974`).
- Haptics fire from `Button`, `IconButton`, `Toggle`, `Segmented` and the rail. They do not fire from raw buttons, list rows, quiz answers before the result, sheet detents or drag starts. Recommend a small semantic map: `select`, `toggle`, `detent`, `success`, `warning`, `drag-start`, `drag-drop`, routed through `Pressable`.

---

## 6. Motion-system audit

### 6.1 Inventory

| Where | Mechanism | Timing | Interruptible | Compositor-only |
| --- | --- | --- | :-: | :-: |
| Screen change | Motion, enter only | 220 ms ease-out, 6 px rise | yes | yes |
| Screen content | CSS `.settle` stagger | 320 ms, 45 ms steps | yes | yes |
| Rail collapse, full-screen chrome | CSS transition on `width` and frame `padding` | 320 ms ease-in-out | yes | **no** (layout every frame) |
| Sheet, wide | Motion scale and y | 220 ms in, 140 ms out | yes | yes |
| Sheet, phone | Motion spring y, drag to dismiss | 420 / 40 | yes | yes |
| Popover | Motion | 140 ms | yes | yes |
| Menu | Motion, own values | 120 ms | yes | yes |
| Atlas layers popover | Motion, own values | 140 ms | yes | yes |
| Toast | Motion spring with `layout` | 380 / 34 | yes | yes |
| Tab indicators (rail, tab bar, plan, segmented) | Motion `layoutId` | four different springs | yes | yes |
| Accordions (Plan sections, quick-add panel, phone Focus fold) | Motion `height: auto` | default or 320 ms | yes | **no** |
| Task list insert and remove | Motion `layout="position"`, exit height 0 | default | yes | partly |
| Task reorder | Motion `Reorder` | spring | yes | yes |
| Quiz question change | `AnimatePresence mode="wait"`, x ±16 | 180 ms | **no** (next waits for exit) | yes |
| Progress bars | CSS or Motion on `width` (four places) | 500–800 ms | yes | **no** |
| Focus dial arc and head | rAF writing SVG attributes | every frame | yes | **no** |
| Focus dial halo, start button ring | CSS keyframes on SVG / pseudo-element | 2.8 s, 3.2 s infinite | – | no (SVG) / yes |
| Completion bloom | Motion on SVG circle | 1.4 s | no | no |
| Session chrome dim | CSS opacity | 700 ms | yes | yes |
| Theme switch | CSS, universal selector with `!important` | 260 ms | – | no (colour) |
| Atlas camera | rAF, CSS transforms on layers | continuous | yes | yes between repaints |
| Atlas names appearing | CSS colour keyframes | 220 ms | – | no (repaint, by design) |
| Atlas symbols appearing | CSS opacity | 220 ms | – | yes |
| Atlas decoration (pulses, ships, flowing rivers) | CSS keyframes | 2.2–9 s infinite | pauses while moving | mostly |
| Skeleton shimmer | CSS background-position | 1.4 s infinite | – | no |

### 6.2 Findings

**MO-1 · Tokens exist but one transition in three bypasses them**

- **Current state.** `motion.ts` defines the language. Fifteen Motion transitions and most CSS utilities set their own numbers.
- **Evidence.** Inline transitions at `AtlasPanel.tsx:36`, `AtlasScreen.tsx:294`, `:573`, `FieldReview.tsx:119`, `FocusScreen.tsx:437`, `ImmersiveFocus.tsx:95`, `SessionCompleteSheet.tsx:73`, `:157`, `Onboarding.tsx:48`, `:56`, `TodayLine.tsx:24`, `TaskItem.tsx:56`, `controls.tsx:129`, `:182`, `Menu.tsx:39`. Tailwind `duration-100/150/200/300/500/1000` used 23 times.
- **Problem.** Twenty-two durations and ten springs. The same gesture (a pill sliding to the selected tab) has four different feels.
- **Recommended change.** §17. Named roles, not numbers; a lint rule against numeric `duration` and `stiffness` outside `src/ui/motion.ts`.
- **Scope.** Product-wide. **Dependencies.** J-02, J-06.

**MO-2 · Motion carries no spatial meaning**

- **Current state.** Every screen change is the same 6 px rise. A sibling tab change, a drill-in (project list to project), a return, and a jump across the app all look identical. There are no exits and no shared elements.
- **Problem.** The interface never explains where something came from or went. Opening a task from a row, a place from a symbol, or immersive mode from the dial are hard cuts to a new surface.
- **Evidence.** `App.tsx:139-145`; `TasksScreen.tsx:91`; `ui-store.ts:51`; `ImmersiveFocus.tsx:90-95`.
- **Target experience.** Sibling views cross-fade in place. Drill-ins move along one axis and reverse on Back. A surface that represents an object grows from that object.
- **Recommended change.** Three transition types (`swap`, `push/pop`, `expand`) chosen by the navigation relationship; shared-element continuity for three high-value pairs: task row → task panel title, map symbol → place card title, dial digits → immersive digits. Use Motion `layoutId` where both ends are mounted; the View Transitions API is a later option (P3).
- **Scope.** Product-wide. **Dependencies.** Navigation state retention (J-08), surface family (J-07).

**MO-3 · Layout-animating properties**

- **Current state.** Rail width and frame padding, accordion heights and progress-bar widths animate properties that force layout on every frame.
- **Problem.** On the Atlas route the map's `ResizeObserver` fires as the stage resizes, and each call repaints the base map (`AtlasMap.tsx:500-504`). Measured on desktop: collapsing or expanding the rail over the map causes 4–5 full repaints and a worst frame of 350–383 ms; entering or leaving the full-screen map causes 1–3 repaints and a worst frame of 333–516 ms. The transition that is meant to feel like chrome sliding away stutters instead. Elsewhere the cost is small but it is still main-thread animation.
- **Evidence.** `index.css:468`, `:510-514`; `TasksScreen.tsx:182`; `QuickAdd.tsx:202`, `:236-238`; `TodayLine.tsx:24`, `AtlasPanel.tsx:36`, `charts.tsx:308`, `CurrentAffairsScreen.tsx:124`.
- **Recommended change.** Animate the rail with a transform on the rail and a single end-of-transition layout for the stage (or debounce the map's resize handling to the end of the transition as an immediate fix). Progress bars use `transform: scaleX`. Accordions use `grid-template-rows: 0fr → 1fr` or Motion layout projection.
- **Scope.** Shell and components. **Dependencies.** None for the debounce; J-05 for `Progress`.

**MO-4 · The Focus dial animates on the main thread at 60 Hz for the whole session**

See §8, finding FO-1. It is listed here because it is the most expensive animation in the product after the Atlas repaint.

**MO-5 · Blocking and non-interruptible transitions**

- The quiz uses `mode="wait"`, so the next question cannot appear until the previous one has left (`FieldReview.tsx:118`). The handoff already bans this mode around screens for the same reason.
- The session-complete sheet is delayed 1,700 ms so the bloom can play (`SessionCompleteSheet.tsx:41`). During that time the screen accepts input that the sheet will then cover.
- The task checkbox waits 320 ms before writing so its tick can play (`TaskItem.tsx:36-47`). The row stays in the list but the write is late; a second tap in that window is swallowed.
- **Recommended change.** Cross-fade questions in place with `popLayout`. Present completion inline in the dial area instead of a delayed modal (§8). Write the task completion immediately and let the row's exit animation carry the tick.

**MO-6 · Reduced motion is honoured, but bluntly**

- **Current state.** `MotionConfig reducedMotion="user"` removes transform and layout animation from Motion. A global CSS rule sets every animation and transition to 0.001 ms. The Atlas camera jumps instead of flying and momentum is disabled.
- **Problem.** The global rule also removes opacity cross-fades, which are safe and are what keeps state changes legible without movement. Spinners become a static arc, so "loading" becomes ambiguous. There is no in-app control: the OS setting is the only switch.
- **Evidence.** `index.css:743-751`, `App.tsx:103`, `AtlasMap.tsx:414`, `:686`, `:771`, `:802`.
- **Recommended change.** §17.5.
- **Scope.** Product-wide. **Dependencies.** J-06.

**MO-7 · Abrupt appearance and disappearance**

| Element | Behaviour | Evidence |
| --- | --- | --- |
| Current Affairs filters and analytics | Toggled with `hidden`; content below jumps | `CurrentAffairsScreen.tsx:116`, `:151` |
| Expedition row expansion | Conditional render, no transition | `ExpeditionSheet.tsx:110` |
| Desktop Atlas inspector | Conditional render, no enter or exit | `AtlasScreen.tsx:408` |
| Sheet body change (profile list ↔ editor, onboarding step 1 ↔ 2) | Content swaps instantly inside a sheet that changes height | `ProfileSheet.tsx:68-112`, `Onboarding.tsx:28-43` |
| Chart tooltip | Appears and disappears instantly, jumps between columns | `charts.tsx:196-198` |
| Atlas names after a gesture | All names for the new view appear together 140 ms after release | §7 |

Each should use the `swap` or `reveal` role from §17.

---

## 7. Atlas deep dive

### 7.1 What the Atlas actually uses

| Aspect | Current implementation | Where |
| --- | --- | --- |
| Rendering technology | DOM and SVG. No canvas, no WebGL, no tiles, no worker. | `AtlasMap.tsx:1103-1244` |
| Layers | (1) base: one `<svg>` in an oversized `div`; (2) flow: animated river dashes; (3) labels: SVG symbols, river names on `textPath`, route, pins, plus HTML spans for point names and pulses | `:1113-1241` |
| Projection | Done at build time. India is Lambert conformal conic, World is Robinson. The app only sees sheet pixels (India 2400 × 2104, World 2800 × 1211). | `tools/atlas-build`, `atlas/sheet.ts:1-4` |
| Geometry | TopoJSON decoded once per sheet into SVG path strings, then merged by style into about 20 very large paths | `atlas/sheet.ts:60-77`, `AtlasMap.tsx:1352-1408` |
| Relief | One WebP per sheet at sheet resolution (India 2400 × 2104, 583 KB), drawn as an SVG `<image>`; a second shade image with `mix-blend-mode` on the political plate | `:1417`, `:1427` |
| Camera | `{k, x, y}` in a ref, never React state | `:251-252` |
| Pan and drag | Pointer events, batched to one `requestAnimationFrame`; applied as a CSS `translate3d … scale` on the layers | `:563-593`, `:298-326` |
| Wheel zoom | Mouse notches ease toward a target with a 65 ms time constant around the cursor; trackpad deltas apply directly; `ctrlKey` pinch uses a higher rate | `:775-820`, `camera.ts:87-92` |
| Pinch zoom | Two pointers; scale and centre anchored to the sheet point under the fingers; zoom momentum after a quick pinch | `:565-575`, `:595-602`, `:683-706` |
| Touch extras | Double tap zooms in, two-finger tap zooms out, one finger continues panning when the other lifts | `:723-743`, `:755-759` |
| Keyboard | Arrows pan 90 px, `+` and `−` zoom, only while the map itself has focus | `:822-853` |
| Zoom interpolation | Continuous and fractional. Fly-to follows the van Wijk–Nuij path. | `camera.ts:30-74` |
| Zoom to pointer | Yes for wheel, pinch, double tap; limits are applied before the anchor so the view cannot jump at a limit | `:279-293`, `:584-588` |
| Inertia | Pan: exponential decay, 300 ms time constant, capped at 3.5 px/ms. Zoom: log-scale velocity, 140 ms decay. | `:650-680`, `:683-706` |
| Bounds | Hard clamp: the sheet always covers the viewport; zoom from "cover" to 7 × the fitted scale | `:272-295` |
| Interruption | A new pointer or trackpad wheel cancels any running animation | `:558-561`, `:607`, `:816` |
| Repaint | Writing the SVG `transform` attribute on the world group, on settle or when the painted layer is "stale" (scale ratio outside 0.6–2.4, or the painted margin exhausted), at most every 220 ms | `:329-362`, `:387` |
| Painted margin | 40% of the larger viewport side, capped at 480 px (240 px on low-power devices) | `:483` |
| Settle | 140 ms after the last camera change, unless a pointer is down | `:365-378`, `:390` |
| Labels | Greedy, priority-ordered collision in screen space, measured with canvas text metrics, computed in React on settle inside `startTransition` | `labels.ts:229-387`, `AtlasMap.tsx:1022-1049` |
| Markers | Place symbols chosen by zoom thresholds and priority, thinned on a 13 px grid | `:990-1019` |
| Spatial index | Uniform 24-column grid for places and labels. None for geometry. | `atlas/spatial.ts`, `AtlasMap.tsx:882-883` |
| Hit testing | Nearest drawn symbol within 18 px, then label anchors, then every river polyline, then area polygons smallest first, then state and country polygons | `:895-957` |
| Level of detail | Thresholds for which symbols and names appear; protected-area outlines above 1.7 ×. Geometry and relief are single-resolution. | `:995-1006`, `:236`, `labels.ts:252-306` |
| React involvement | None per frame. One commit per settle. `BaseMap` is memoised on data and style. | `:1369` |
| Responsive sizing | `ResizeObserver` re-measures, keeps the centre, repaints and settles | `:473-507` |
| Decoration | Pulses, ships and flowing rivers as CSS animations, paused while the map moves and disabled on low-power devices | `index.css:849-937` |

**Much of the wish list is already built.** Continuous fractional zoom, cursor-centred zoom, inertial panning, velocity-based continuation, rAF-driven updates, compositor transforms between repaints, interruption, and zero React work per frame all exist and are implemented with care. This matters for the recommendation: the input and camera half of the Atlas is close to right. The rendering half is what fails.

### 7.2 Renderer facts (measured)

| Fact | Desktop @1.25 | Laptop @2 | Phone @3 |
| --- | ---: | ---: | ---: |
| Map area (CSS px) | 1200 × 884 | 1200 × 884 | 390 × 784 |
| Base layer (CSS px) | 2160 × 1844 | 2160 × 1844 | 1018 × 1412 |
| Base layer (device pixels) | 6.2 MP | 15.9 MP | 12.9 MP |
| Paths in the base layer | 20 | 20 | 20 |
| Path segments, India sheet with sample history | 80,650 | 80,650 | 80,650 |
| Path segments, India sheet for a new user (fog drawn) | 148,652 | – | – |
| Largest single path | 14,613 segments (39,291 for a new user) | | |
| Path data held as strings | 1.0 MB (1.9 MB for a new user) | | |
| Names / symbols / river names at the first view | 84 / 40 / 25 | 84 / 40 / 25 | 48 / 33 / 16 |
| Label-layer DOM nodes | 479 | 479 | 336 |

The DOM is small. The cost is not node count; it is how much vector geometry is rasterised each time and how often.

### 7.3 Where the time goes

**Trace of one zoom-in burst (40 wheel events, about 0.65 s of input plus settling), desktop:**

| Thread | Work | Time |
| --- | --- | ---: |
| Main | Script (`FunctionCall`) | 342 ms |
| Main | Style recalculation | 217 ms |
| Main | Layout | 97 ms |
| Main | Paint (recording) | 99 ms |
| Main | Blocked waiting for the compositor (`WaitForCommitCompletion`) | 473 ms |
| GPU process | Raster (`GPUTask`), across 782 raster tasks | **7,432 ms** |

Zoom-out is the same shape: 247 ms script, 208 ms style, 8,696 ms raster across 826 tasks. A long pan, by contrast, needs 223 ms of raster in total. On the phone shape with a 4× CPU throttle the main thread becomes a co-bottleneck: 32–43 long tasks totalling 2.6–3.3 s per zoom gesture.

**What makes one repaint expensive** (median worst frame after a forced repaint, five samples each, sample-history profile):

| Variant | Desktop, at fit | Desktop, 3× zoom | Phone shape, at fit | Phone shape, 3× zoom |
| --- | ---: | ---: | ---: | ---: |
| Everything (as shipped) | 128 ms | 381 ms | 360 ms | 490 ms |
| Relief image only | 18 ms | 19 ms | 22 ms | 24 ms |
| Vectors only (no relief) | 105 ms | 393 ms | 366 ms | 408 ms |
| Without the dashed boundary lines | 94 ms | 258 ms | 276 ms | 208 ms |
| Without rivers | 62 ms | 234 ms | 244 ms | 268 ms |
| Compositor-only move of the painted layer | 17 ms | – | 18 ms | – |

Three conclusions follow directly:

1. **The relief image is free.** It costs one frame. The stroked vector paths are the whole cost.
2. **Cost rises with zoom**, even though at 3× most of the sheet is off screen. The browser processes every path in full and clips afterwards. There is no culling.
3. **Moving the painted layer is free.** One frame. The compositor design is sound; the repaint is the problem.

### 7.4 Why it does not feel fluid

**AT-1 · Every repaint re-rasterises the whole map**

- **Current state.** The base map is one SVG. A repaint changes the `transform` of its root group, which invalidates the entire layer: 6–16 megapixels and 80,000–150,000 stroked segments, several of them dashed and drawn twice for halos.
- **Problem.** One repaint holds a frame for 130–490 ms depending on zoom and device. Nothing can make a 400 ms operation feel continuous.
- **Evidence.** `AtlasMap.tsx:329-349`, `:1414-1482`; §7.3 tables; trace: 7.4–8.7 s of GPU raster for under a second of zoom.
- **Target experience.** Zoom detail sharpens progressively without ever pausing motion.
- **Recommended change.** Rasterise vectors into cached tiles per zoom level, off the main thread, with per-tile culling (§18, stage B).
- **Scope.** Atlas renderer. **Dependencies.** AT-2 first (it is cheap and makes the benefit of AT-1 measurable).

**AT-2 · A repaint storm: 4–9 repaints and 3–8 label re-layouts in one zoom gesture**

- **Current state.** Three mechanisms compound. (a) The view counts as stale when the scale ratio leaves 0.6–2.4, so a continuous zoom crosses a threshold repeatedly. (b) Mid-gesture repaints are allowed every 220 ms, which is shorter than one repaint takes. (c) The settle timer is a 140 ms wall-clock timeout re-armed inside the animation-frame handler; when a repaint delays the next frame beyond 140 ms the timer fires *during* the gesture, which repaints again and commits a React label layout, which delays the next frame further.
- **Problem.** The renderer spends the gesture repainting. Each settle also runs a full label layout and a React commit that is discarded moments later.
- **Evidence.** Measured with 60 wheel events at a fixed cadence: `basePaints` / `labelCommits` of 5/4 zooming in and 9/8 zooming out on desktop, 7/6 and 7/6 on the laptop shape, 4/3 and 6/5 on the phone shape. (The first version of this audit reported 16–26; that was a harness artefact, see "Corrections and progress".) With ideal behaviour both would be 1. `settle()` is the only caller of `setLayoutT` during a gesture (`AtlasMap.tsx:365-378`), so every label commit is a settle that fired while input was still arriving. Timer at `:389-390`; thresholds at `:352-362`; gap at `:224`, `:387`.
- **Target experience.** At most one repaint per zoom level crossed, and exactly one settle, after input has truly stopped.
- **Recommended change.** Decide stillness from input, not from a timer racing frames: settle only when no camera change has been *requested* for 140 ms, checked from the frame loop. Quantise repaints to discrete zoom levels (powers of √2). Never start a repaint while one is outstanding. Skip label layout during a gesture except as in AT-3.
- **Scope.** Atlas renderer. **Dependencies.** None. This is the first Atlas job.

**AT-3 · The map is empty while you drag**

- **Current state.** Names, symbols, the expedition route and pins are laid out for the settled viewport plus 20–40 px. While a pointer is down, settle is suppressed, so nothing new is laid out until release.
- **Problem.** Drag across one screen at zoom and you are looking at bare relief and outlines. On release, about fifty names and symbols appear together. Google Maps never shows an unlabelled map; this is the largest perceptual difference after the zoom stalls.
- **Evidence.** Measured: desktop held drag at zoom shows 5 names and 1 symbol; 47 and 46 after release. Phone shape: 11 and 8, then 45 and 65. Observed: `tools/perf/out/gesture-audit/desktop-held-drag-zoomed.png` and `…-released.png`. Code: `AtlasMap.tsx:390` (`if (!holding.current)`), `:999` (20 px pad), `labels.ts:236` (40 px pad).
- **Target experience.** Names are already there when an area scrolls into view; new ones fade in individually as space allows.
- **Recommended change.** Lay out for the viewport plus the painted margin (overscan), so a normal drag never leaves labelled territory. When the camera has travelled more than half the overscan or crossed a zoom level, run an incremental layout mid-gesture (in a transition, cancellable, at most every 250 ms) that keeps already-placed labels stable and only adds or removes at the edges.
- **Scope.** Atlas renderer and `labels.ts`. **Dependencies.** AT-2.

**AT-4 · Names are counter-scaled one element at a time, or not at all**

- **Current state.** While zooming on desktop, the label layer scales with the map and every name anchor gets an inverse `scale` written to its style each frame. On viewports under 768 px and on low-power devices this is skipped: names grow and shrink with the map and snap back at settle.
- **Problem.** Desktop and laptop: 4,200–10,800 style writes per gesture and 90–400 ms of style recalculation. Phone: names visibly change size during a pinch, then jump.
- **Evidence.** `AtlasMap.tsx:314-325`; measured `anchorStyleWrites` and `styleMs`.
- **Target experience.** Names keep their size and stay attached to their point at every instant, on every device.
- **Recommended change.** Put HTML names in a container that is *not* scaled. Position each name with a transform derived from the camera in one pass per frame over a typed array of anchors, or draw names on a canvas overlay in stage B. Either removes the per-element style write and the phone special case. Measure both against the trace before choosing; the handoff records that a custom property on the mixed SVG/HTML layer was a regression, which a pure-HTML container avoids.
- **Scope.** Atlas renderer. **Dependencies.** AT-2.

**AT-5 · Selection and highlights live in the base layer**

- **Current state.** The selected river, region or state outline, the fog, and the protected-area toggle are drawn inside the base SVG.
- **Problem.** Tapping a place repaints the entire map to draw one outline.
- **Evidence.** `AtlasMap.tsx:1126` (`<Highlights>` inside the world group). Measured: selecting a place causes one full repaint, two label commits and a 417 ms worst frame; switching sheet has an 867 ms worst frame.
- **Target experience.** Selection is instant and never disturbs the base map.
- **Recommended change.** Move highlights, selection and the expedition route to their own small overlay layer in sheet coordinates. Only that layer repaints.
- **Scope.** Atlas renderer. **Dependencies.** None.

**AT-6 · One level of detail**

- **Current state.** One relief image and one simplification level per sheet serve every zoom from "whole subcontinent" to 7× closer.
- **Problem.** At maximum zoom on a 1440 px window each relief pixel covers about 4.4 device pixels at 1.25× and 7 at 2×. Rivers and borders, simplified for the overview, show straight segments. Detail does not change as you approach, so zooming in reveals blur rather than information.
- **Evidence.** `public/atlas/v1/india-relief.webp` is 2400 × 2104; limits at `AtlasMap.tsx:272-277`; observed in `desktop-held-drag-zoomed-released.png` (soft relief, angular Damodar and state boundaries).
- **Target experience.** Each zoom step adds detail: sharper terrain, finer coastlines, more names.
- **Recommended change.** After the tile cache exists: a two-level relief pyramid for India (overview plus a 2× plate cut into tiles, loaded on demand and precached as a pack), and two or three geometry simplification levels emitted by the existing pipeline. This is content work in `tools/atlas-build`, not renderer work.
- **Scope.** Data pipeline and renderer. **Dependencies.** Stage B of §18. The 3 MiB precache limit and the regional-pack policy in the handoff apply.

**AT-7 · A new user sees the slowest and least attractive map**

- **Current state.** Unexplored states are covered with a grey veil and a hatch pattern. For a new user that is all of India.
- **Problem.** The subject of the map is its greyest area while neighbouring countries are in full colour (observed on a fresh profile). The fog adds two more copies of the state geometry to every repaint: 148,652 segments instead of 80,650.
- **Evidence.** `AtlasMap.tsx:1409-1412`, `:1449-1454`; observed in the built-in browser on a fresh profile.
- **Target experience.** The first view of the Atlas is the best-looking one.
- **Recommended change.** A product decision, flagged rather than prescribed: since every place is now freely accessible (`CODEX_HANDOFF.md` §4.3b), consider showing travel as a positive mark on explored regions (a tint, a boundary treatment) instead of a veil on unexplored ones. Whatever is chosen should be a cached raster, not live geometry.
- **Scope.** Atlas design. **Dependencies.** User decision.

**AT-8 · Lesser issues**

| Id | Issue | Evidence | Change |
| --- | --- | --- | --- |
| AT-8a | Tap waits 250 ms (see IX-3) | `AtlasMap.tsx:766` | Select on release; double tap zooms and keeps the selection |
| AT-8b | Hard clamps, and no horizontal travel at the default desktop fit (see IX-4) | `:279-295` | Rubber-band; fit slightly inside minimum zoom |
| AT-8c | Fly-to keeps clear of top and bottom overlays only; on desktop a target can land under the 372 px inspector | `AtlasScreen.tsx:317`, `AtlasMap.tsx:449-458` | Insets on all four sides, driven by the inspector's measured rect |
| AT-8d | Leaving the Atlas and returning re-fits, repaints and forgets sheet, camera and selection | `App.tsx:141`; second-visit time 160–1,329 ms on desktop, 1.1–1.8 s on the phone shape | Keep the Atlas mounted or persist the camera (§10) |
| AT-8e | Resize repaints per observer callback | `AtlasMap.tsx:500-504`; MO-3 | Resize the layer with a transform during the transition and repaint once at the end |
| AT-8f | Hover hit test walks every river polyline on every mouse-move frame, with no bounding-box reject | `:916-920`, `atlas/sheet.ts:250-264` | Index river segments in the existing grid |
| AT-8g | The italic convention for water and physical features is half applied: Manrope has no italic, HTML names disable synthesis, SVG river names synthesise it | `index.css:786`, `labels.ts:112-119`; observed | Either ship an italic cut for map lettering or drop the convention consistently |
| AT-8h | No grab or grabbing cursor | `:974` | Set from the gesture state |
| AT-8i | Field review mounts a second full map over the first | `FieldReview.tsx:247-258` | Share the tile cache; pause the map underneath |
| AT-8j | The map is one opaque `role="application"`; names and symbols are `aria-hidden` (see §12) | `:1108-1110`, `:1159` | An "in view" list and keyboard selection |

### 7.5 Concept-by-concept verdict

| Concept | Status | Verdict |
| --- | --- | --- |
| Continuous fractional zoom | Present | Keep |
| Cursor-centred zoom | Present and correct at limits | Keep |
| Inertial panning, velocity continuation | Present | Keep; add rubber-band at the edges |
| Gesture normalisation | Partial: wheel notch vs trackpad heuristic, line and page delta modes | Keep; move the gesture logic out of the component so it can be unit-tested |
| rAF-driven updates | Present | Keep; drive *settle* from the same loop (AT-2) |
| Compositor-friendly transforms | Present between repaints | Keep |
| Reduced React involvement during gestures | Present, defeated by the settle storm | Fix AT-2 |
| Interruption-safe animation | Present | Keep |
| Transform interpolation | Present (fly-to) | Keep |
| Spatial indexing | Places and labels only | Add for geometry (needed for tiles and for AT-8f) |
| Viewport culling | Labels and symbols only | **Add for geometry.** This is the missing piece. |
| Canvas rendering | Not used | **Recommended** for the base map, as cached tiles |
| Worker-thread computation | Not used | **Recommended** for tile rasterisation; optional later for label layout |
| Tile pyramid | Not used | **Recommended**, as raster tiles produced on the device from the existing vector data. No server, no new data format. |
| Level of detail / progressive detail | Symbols and names only | Add for relief and geometry after the tile cache (AT-6) |
| Geometry simplification | One level, at build time | Emit two or three levels |
| Label collision handling | Present, settle only | Make incremental (AT-3) |
| Preloading adjacent regions | Painted margin for the base; nothing for labels | Overscan labels; prefetch tiles one ring outside the view and one zoom level each way |
| WebGL | Not used | **Not recommended now.** Canvas tiles meet the target at this data size without the dependency and data-pipeline cost. Revisit only if the product needs street-level depth (§18.4). |

### 7.6 Can the current architecture reach the target?

**The camera, input and data architecture can. The live-SVG base layer cannot.**

Stopping the repaint storm (AT-2) and the empty-map behaviour (AT-3) inside the current renderer is cheap and will remove most stalls: a zoom would repaint two to four times instead of up to twenty-six. But each remaining repaint still costs 130–490 ms, so zoom would still hitch a few times per gesture. Reaching "no frame over 34 ms while zooming" requires that vectors are never rasterised on the frame path, which means cached tiles. That replaces roughly the 130 lines of `BaseMap` and the paint/stale logic, not the Atlas.

---

## 8. Focus experience audit

### 8.1 What works

The Focus screen is the most finished surface in the product. Keep: the dial's three states, fixed-width digits that never shift, the morphing start/pause control with its ripple, the completion bloom, the cycle slabs that echo the logo, the way the chrome recedes during a session (`index.css:547-565`), the single-viewport fit on laptops, and the keyboard model (`Space`, `F`, `S`).

### 8.2 Findings

**FO-1 · A running session keeps the main thread continuously busy**

- **Current state.** While the timer runs, `useSmoothProgress` runs a `requestAnimationFrame` loop that writes the arc's `stroke-dashoffset`, the head's `transform` and the glow's opacity on every frame. The glow has a 900 ms CSS transition that is restarted by each write. The halo and the start-button ring are CSS animations on SVG and a pseudo-element.
- **Problem.** The visible change per frame is far below one pixel (a 25-minute session moves the head 0.004° per frame). The cost is not: the product's core state, which lasts 25–90 minutes, uses a fifth to a third of a desktop core and saturates a throttled phone core. That is battery and heat on phones, and it makes anything opened during a session (a sheet, the palette) compete for the thread.
- **Evidence.** Measured over three runs, main-thread work per second: Focus idle 0 ms; Focus running 185–368 ms on desktop and 900–990 ms at 4× throttle, where the frame rate falls to 31–50 fps. `TimerDial.tsx:38-48`, `:62`, `:164-191`; `index.css:659-676`, `:710-729`.
- **Target experience.** The dial moves as smoothly as now. Between second ticks the page does no work.
- **Recommended change.** Drive the arc and head with a compositor animation whose duration is the remaining time: a CSS `rotate` on an HTML element (or a wrapper around the SVG) for the head, and a conic-gradient or rotated-mask ring for the arc, started with a negative delay equal to the elapsed time. Re-sync on pause, resume, adjust and wake. Update tick marks and the glow once per second from the existing `useNow`. Move the halo and ring pulses to HTML elements with `transform` and `opacity` only.
- **Scope.** Component (`TimerDial`, immersive progress bar). **Dependencies.** None.

**FO-2 · Immersive mode doubles the cost**

- **Current state.** The Focus screen stays mounted under the immersive overlay, so two frame loops run.
- **Evidence.** Measured: 120 rAF callbacks per second in immersive mode; 261–364 ms/s on desktop. `App.tsx:158`, `ImmersiveFocus.tsx:46-48`.
- **Recommended change.** Falls out of FO-1. Also pause the hidden dial while immersive is open.
- **Scope.** Component. **Dependencies.** FO-1.

**FO-3 · Completion is a delayed modal**

- **Current state.** When a session ends the dial blooms, then 1.7 s later a modal sheet slides up asking for a rating and a note.
- **Problem.** The calm moment is followed by an interruption that must be dismissed. On desktop it is a centred dialog over the thing you were looking at.
- **Evidence.** `SessionCompleteSheet.tsx:38-44`, `:68`; `TimerDial.tsx:194-210`.
- **Target experience.** The dial becomes the completion card in place: time focused, XP, places reached, five stars, a note field, and "Start break". Nothing covers anything; it can be ignored and the break still starts.
- **Recommended change.** Render completion inline in the dial region (desktop: dial morphs into the card; phone: a bottom sheet at a low detent that does not block the page). Keep the sheet only when the session ended while the user was on another screen.
- **Scope.** Focus. **Dependencies.** Surface family (J-07) for the detented sheet.

**FO-4 · Stopping is a three-button dialog**

- **Current state.** Stop opens a modal with "Save and stop", "Discard and reset", "Keep going".
- **Problem.** The app's own rule is Undo instead of confirmation. A modal for the most frequent mid-session decision is heavy.
- **Evidence.** `FocusScreen.tsx:303-339`.
- **Recommended change.** Stop saves immediately and shows an Undo toast with a "Discard instead" action; or the side controls morph in place into "Save" and "Discard" for a few seconds. No backdrop.
- **Scope.** Focus. **Dependencies.** None.

**FO-5 · Session context, timer profiles and sounds are modals on desktop**

- **Current state.** Each opens a centred dialog from a small control beside the dial.
- **Problem.** They are settings of the thing on screen. A dialog hides the dial and breaks the link to the control that opened them.
- **Evidence.** `ContextSheet.tsx:77`, `ProfileSheet.tsx:62`, `SoundSheet.tsx:75`.
- **Recommended change.** Anchored popovers on medium and expanded widths (context from the "What are you working on?" pill, profiles from the profile chip, sounds from the header button); bottom sheets on compact. The mode bar (three segmented controls and a chip in two rows, `FocusScreen.tsx:162-192`) can become one control that opens the profile popover.
- **Scope.** Focus. **Dependencies.** J-07.

**FO-6 · Entering and leaving immersive mode is a plain fade**

- **Current state.** A 500 ms opacity fade to a separate screen with its own hard-coded colours and its own buttons. The top controls fade to transparent but stay focusable and clickable; the bottom row correctly drops pointer events.
- **Evidence.** `ImmersiveFocus.tsx:90-95`, `:108` vs `:130`, `:244-250`.
- **Target experience.** The digits you were looking at grow into the immersive clock and everything else falls away; leaving reverses it.
- **Recommended change.** Shared-element transition for the digits; reuse `Pressable` controls; use tokens for the dark surface; apply `inert` to hidden controls.
- **Scope.** Focus. **Dependencies.** J-05, J-06.

**FO-7 · Smaller items**

| Issue | Evidence | Change |
| --- | --- | --- |
| The whole timer panel, including its closed sheet, re-renders every second | `FocusScreen.tsx:199-205` | Isolate the clock text in its own component |
| Only ±5 minute buttons; the dial cannot be manipulated | `:366-386` | Optional: drag the head to set the length while idle (P3) |
| Navigation dims to 28% opacity in session, below contrast minimums, and touch has no hover to restore it | `index.css:559-561` | Dim to about 50%, restore on any pointer activity |
| `role="timer"` appears twice when immersive is open | `FocusScreen.tsx:252`, `ImmersiveFocus.tsx:120` | Hide the underlying screen from assistive technology while immersive is open |

---

## 9. Quiz, popup and overlay audit

### 9.1 The `Sheet` primitive

`Sheet` is well made: flex column capped to the viewport, pinned header and footer, body scrolls only when needed, a layer stack so only the top surface answers Escape, a Tab trap, focus restore, counted scroll lock with scrollbar compensation, and drag-to-dismiss on phones. The problem is not its quality. It is that it is the only tool.

| Gap | Evidence |
| --- | --- |
| Two shapes only: bottom sheet under 640 px, centred dialog above. No side panel, no anchored variant, no full-screen variant, no detents. | `Sheet.tsx:107`, `:127-135` |
| Drag starts only from the handle and header, not from the top of the content | `:146`, `:151`, `:157` |
| Initial focus is applied after a 60 ms timeout, so the first key press after opening can land on the page | `:85-88` |
| The system Back gesture does not close it (no history entry) | `App.tsx:307-313`; no `popstate` handling in `src/` |
| Sheets stack as modal over modal (task → schedule block; event → confirm) | `TaskSheet.tsx:449`, `EventSheet.tsx:77` |
| Content swaps inside an open sheet are unanimated and change its height abruptly | `ProfileSheet.tsx:68`, `Onboarding.tsx:28` |
| Background content is not marked `inert`; it relies on `aria-modal` | `Sheet.tsx:121-122` |

### 9.2 Surface-by-surface recommendation

| Surface | Now | Recommended on expanded (≥1024) | On compact (<768) |
| --- | --- | --- | --- |
| Task editor | modal dialog | **side panel** on the right of the stage, list stays visible and usable | full-height sheet |
| Place and region details | floating inspector (desktop), sheet (phone) | keep inspector; animate in and out; resizable | **bottom sheet with detents** (peek, half, full) over a live map |
| Atlas menu, expeditions | modal | inspector tabs | detented sheet |
| Gazetteer and place search | modal | **command-style search** anchored under the search button, results fly the map as you arrow through them | full-screen search |
| Legend | modal | popover from the legend button | sheet |
| Layers | hand-rolled popover | `Popover` | sheet |
| Base camp | modal | popover or inspector section | sheet |
| Field review, canonical question, question browser | modal | **focused panel**: inspector width on Atlas, centred card elsewhere, map stays visible for locate questions | **full screen** |
| Session context, profiles, sounds | modal | popovers (FO-5) | sheets |
| Session complete | delayed modal | inline (FO-3) | low-detent sheet |
| End session | modal | inline or Undo (FO-4) | same |
| Quick capture | modal | keep as a small dialog near the top, palette-style | sheet |
| Project, habit, goal, event, session, label editors | modal | popover or inline expansion from the row being edited | sheet |
| Schedule focus block | modal over modal | step inside the task panel | step inside the task sheet |
| Restore backup, erase data | modal | keep as dialogs (rare, destructive, deserve weight) | keep |
| Confirm | modal | keep only for irreversible data loss; elsewhere Undo | keep |
| Shortcuts | modal | keep | not shown |
| Onboarding | modal over the app | first-run full screen with the two steps as a transition | full screen |
| Command palette | bespoke dialog | keep; adopt shared surface tokens | keep |
| Current Affairs notes | modal | side panel | sheet |
| Current Affairs filters and analytics | inline `hidden` regions | popover (filters), inline reveal with animation (analytics) | sheet (filters) |

### 9.3 Findings

**OV-1 · One overlay pattern for 28 surfaces**

- **Current state.** See §3 and §9.2.
- **Problem.** On a laptop, editing a task, picking a subject for the timer, reading a place card on a phone, and erasing all data use the same visual weight. The interface feels like a page that raises dialogs rather than an application with panels.
- **Target experience.** The surface matches the job: transient choices anchor to their control, objects open beside their list, destructive decisions get a dialog.
- **Recommended change.** A surface family sharing one core (layer stack, focus management, dismissal, history integration, motion): `Dialog`, `BottomSheet` (detents, content-drag), `SidePanel`, `Popover`, `Menu`, `Tooltip`. Each call site chooses per breakpoint with one prop.
- **Scope.** Product-wide. **Dependencies.** J-05; breakpoints (DS-7).

**OV-2 · Two different quizzes**

- **Current state.** Field review: tap a tile to answer, coloured feedback, "Next question", segmented progress. Canonical question: native radios, a Submit button, a text result, no sequence. Closing a canonical question returns to the map, not to the list it came from, so working through several questions means reopening the browser each time.
- **Problem.** The two feel like different products. The canonical flow is the weaker one, and it is the one that carries real exam questions.
- **Evidence.** `FieldReview.tsx:101-145`, `:148-175`; `CanonicalQuiz.tsx:38-50`; `AtlasScreen.tsx:420-421`.
- **Target experience.** One question surface. An answer is a large tile with a letter key. Selecting compresses it. For recall, release commits; for exam questions, selection is confirmed by Enter or a Submit that sits where the thumb is. The correct tile fills from the press point, a wrong one shakes once and the correct one is revealed. A next action is always under the same finger. Keys: `1–4` or `A–D` select, `Enter` submits or advances, `Esc` leaves with progress kept.
- **Recommended change.** A shared `Question` component set (`Prompt`, `AnswerTile`, `Feedback`, `Progress`, `QuestionMap`) used by both flows; a session wrapper that lets canonical questions run as a sequence with previous and next; persistent position in the browser list.
- **Scope.** Atlas learning. **Dependencies.** J-05, J-07. The durability rules in `CODEX_HANDOFF.md` §4.3b and §4.3d (lock after save, no invented explanations) must be preserved.

**OV-3 · Menus, popovers and tooltips are three one-off implementations**

- **Current state.** `Menu` has no arrow-key navigation, does not move focus into the menu, does not restore it, and is positioned with CSS inside its parent so it can be clipped. `Popover` is portalled and positioned but used once. The Atlas layers panel re-implements a popover. The rail has the only tooltip; everything else relies on the native `title` attribute, which is slow, unstyled and absent on touch and keyboard.
- **Evidence.** `Menu.tsx:13-62`, `Popover.tsx:21-110`, `AtlasScreen.tsx:535-623`, `Shell.tsx:196-210`, `controls.tsx:88`.
- **Recommended change.** One positioning and dismissal core for `Popover`, `Menu` and `Tooltip`: collision-aware placement, portal, roving focus for menus, type-ahead, focus return, 400 ms tooltip delay with instant follow-on, keyboard-focus tooltips.
- **Scope.** Product-wide. **Dependencies.** J-05.

**OV-4 · Confirm dialogs where Undo is the rule**

- **Current state.** Eight `confirmDialog` calls: delete event, goal, session, label, habit and project; replace everything; erase all data.
- **Evidence.** `EventSheet.tsx:77`, `GoalsSection.tsx:101`, `SessionSheet.tsx:86`, `LabelsManager.tsx:76`, `HabitsView.tsx:156`, `TasksScreen.tsx:489`, `SettingsScreen.tsx:281`, `:298`.
- **Recommended change.** Keep the last two. Convert the other six to delete-with-Undo; the repository already supports `restore` (`data/repo.ts:47-53`).
- **Scope.** Component. **Dependencies.** None.

**OV-5 · Toasts appear at the top on phones**

- **Current state.** Toasts stack at the top centre on every width, over the workspace header and its actions, far from the thumb. They auto-dismiss in 4.2 s (6.5 s with an action) and do not pause on hover or focus.
- **Evidence.** `feedback.tsx:14`, `toast.ts:26-28`.
- **Recommended change.** Bottom, above the tab bar, on compact; bottom-left of the stage on wider layouts. Pause the timer while hovered or focused; swipe to dismiss; keep the last Undo reachable from the palette so it is not time-limited.
- **Scope.** Component. **Dependencies.** None.

**OV-6 · Loading inside overlays is text that changes the surface's height**

- **Current state.** "Loading the verified question…", "Loading linked questions…", "Loading curated questions…", "Loading the atlas…".
- **Evidence.** `CanonicalQuiz.tsx:27`, `PlaceQuestions.tsx:28`, `PyqBrowser.tsx:34`, `Onboarding.tsx:35`.
- **Recommended change.** Skeletons with the final layout's dimensions; the packs are precached, so prefetch on intent (hover or focus of the row that opens them) and the state should rarely be seen.
- **Scope.** Atlas learning. **Dependencies.** J-05.

**OV-7 · Dismissal details**

- Onboarding closes and is marked complete on Escape or a backdrop press (`Onboarding.tsx:26`, `:46`), so a stray key skips the base-camp step permanently.
- The task editor saves on close, which is right, but gives no sign that it saved.
- A press that starts inside a sheet and ends on the backdrop is correctly ignored (`Sheet.tsx:64-67`, `:113-117`). Keep this.

---

## 10. Navigation and information architecture

The information architecture is sound and should be kept: five workspaces in the order of a study day, two library screens, one capture action, settings last, the timer always in the chrome. The palette and the `G` chords are good power-user tools. The problems are in how movement between screens behaves.

**NAV-1 · First visits to most screens show a skeleton for a third of a second or more**

- **Current state.** Six screens are lazy. The router updates synchronously, so React shows the `Suspense` fallback and then, once a fallback has been shown, holds it briefly before revealing content.
- **Problem.** Every first visit flashes a generic grey skeleton that does not match the destination's layout (it is a 48 rem column; the Atlas is full-bleed, Calendar is 72 rem). The chunks themselves are tiny and already in the precache.
- **Evidence.** Measured on desktop with no network latency: Calendar 353–371 ms, Notes 330–362 ms, Current Affairs 354–644 ms, Insights 451–573 ms, Settings 418 ms, and the skeleton was observed on every one. When Settings had already been visited it took 57–95 ms; Home and Plan, in the entry chunk, 48–145 ms. `App.tsx:46-51`, `:142`, `:204-217`; `router.ts:57-65`.
- **Target experience.** A tab press shows the destination within a frame or two, always.
- **Recommended change.** Import every route chunk during idle time after boot (and on pointer-down or focus of a navigation item as a fallback). Mark navigation as a transition so the current screen stays until the next one can render. Keep a skeleton only for genuine data waits, shaped like the destination.
- **Scope.** Shell. **Dependencies.** None.

**NAV-2 · Screens forget everything when you leave**

- **Current state.** A route change unmounts the screen and scrolls to the top. All view state is component state.
- **Problem.** Go from a scrolled Plan list to a task's place on the Atlas and back, and Plan is at the top again. The Atlas forgets its sheet, camera and selection. Calendar forgets its week and view, Insights its range and filter, Current Affairs its tab, search and scroll.
- **Evidence.** `App.tsx:119-126`, `:141`; `CalendarScreen.tsx:50-52`; `InsightsScreen.tsx:62-66`; `CurrentAffairsScreen.tsx:40-47`; `AtlasScreen.tsx:93-118`.
- **Target experience.** Switching workspaces is like switching windows. Each is exactly as you left it.
- **Recommended change.** Per-route view state in a small store keyed by route (`useRouteState`), scroll position saved and restored per route and query, and the Atlas kept mounted (hidden and paused) after its first visit. Reset to the top only when the user re-selects the tab they are already on.
- **Scope.** Shell and screens. **Dependencies.** None.

**NAV-3 · Back does not understand the app**

- **Current state.** Overlays do not create history entries. On Android and in the browser, Back with a sheet open leaves the screen instead of closing the sheet. The native handler sends every Back to Home. The in-app Back arrow calls `history.back()` whenever `history.length > 1`, which is true even when the previous entry is another site.
- **Evidence.** `App.tsx:307-313`; `Workspace.tsx:85`; no `popstate` listener in `src/`.
- **Target experience.** Back closes the top surface, then pops the navigation stack, then leaves.
- **Recommended change.** The surface core (OV-1) pushes a history state when a modal surface opens and closes on `popstate`. Track an in-app navigation depth so the Back arrow never leaves the app.
- **Scope.** Shell and overlays. **Dependencies.** J-07.

**NAV-4 · The page title moves on every navigation**

- **Current state.** Five column widths, each centred.
- **Evidence.** `Workspace.tsx:18-27`; widths passed in each screen; observed in `tools/perf/out/shots/_lap1.png` and `_lap2.png`.
- **Target experience.** The title, the primary action and the toolbar stay in one place while the content beneath changes.
- **Recommended change.** A full-width workspace header aligned to the stage's leading edge, with the content column choosing its own reading width underneath. With the header fixed, a cross-fade of the content alone becomes possible (MO-2).
- **Scope.** Shell. **Dependencies.** None.

**NAV-5 · Phone navigation leaves three screens off the map**

- **Current state.** Notes, Insights and Settings are not on the tab bar. While on them, the Home tab is shown as selected.
- **Evidence.** `Shell.tsx:49`, `:53`; `HomeScreen.tsx:68-76`.
- **Problem.** The selected tab is wrong, and the route back is a header arrow whose behaviour depends on browser history (NAV-3).
- **Recommended change.** Do not mark any tab as selected for off-bar screens; present them as pushed screens with a real Back. Consider making the fifth tab position a "More" surface if usage shows Notes or Insights deserve one tap.
- **Scope.** Shell. **Dependencies.** NAV-3.

**NAV-6 · Three different tab designs, and Plan's overflows silently**

- **Current state.** Plan views are navigation links with a sliding pill. Insights range, Notes view and Calendar view use `Segmented`. Current Affairs has its own three-button group. Plan has seven views in a scroller; about four fit at 375 px with no fade or hint that more exist.
- **Evidence.** `PlanTabs.tsx:25-45`, `controls.tsx:142-192`, `CurrentAffairsScreen.tsx:130-137`; observed in `tools/perf/out/shots/_phone1.png` ("Projects" cut off, Habits and Done invisible).
- **Recommended change.** One `Tabs` primitive in two sizes with an overflow fade and scroll snapping; on compact widths group Inbox, Projects, Habits and Done behind a "Lists" menu.
- **Scope.** Shell and components. **Dependencies.** J-05.

**NAV-7 · Desktop space is unused**

- **Current state.** Plan is a 48 rem column in a 1,200 px or wider stage; opening a task covers it with a dialog.
- **Evidence.** Observed in `tools/perf/out/shots/_lap2.png` (left panel).
- **Recommended change.** List and detail side by side from 1024 px (the task side panel in §9.2). This single change does more for the "application, not website" feel on desktop than any visual restyle.
- **Scope.** Plan. **Dependencies.** J-07.

---

## 11. Responsive and mobile audit

### 11.1 What adapts well

The shell has two real shapes rather than one squeezed layout: rail and inset stage from 768 px, tab bar and page scroll below. Safe areas are handled (`index.css:261-269`, `:412`, `:467`). The Focus screen sizes its dial from the viewport and fits without scrolling. Sheets become bottom sheets with a drag handle. The rail collapses to icons on tablets. `ui-audit.mjs` checks for unwanted scrollbars at four widths.

### 11.2 Findings

**RS-1 · Touch targets**

Measured at 375 px on a fresh profile: interactive elements whose smaller side is under 40 px.

| Route | Under 40 px | Typical offenders |
| --- | ---: | --- |
| Insights | 22 | range tabs 24 px high, period arrows 32, table toggle 28, chart columns 26 wide |
| Settings | 21 | segmented options 24 high, switches 48 × 28, stepper buttons 32 |
| Calendar | 18 | plan tabs 32, day/week/month 24, arrows 32, add button 32 |
| Plan | 14 | plan tabs 32, checkbox 25, quick-add buttons 36 |
| Atlas | 14 | India/World 32 high, eight map buttons at 36 |
| Focus | 13 | mode and phase tabs 24 high, checkbox 25 |
| Home | 5 | checkbox 25, quick-add buttons 36 |
| Notes | 3 | view tabs 24 |
| Current Affairs | 1 | – |

- **Problem.** 111 controls across nine routes are under 40 px, most of them the app's primary controls. Against the 44 px guideline, and with sample data loaded, `app-audit.mjs` counts 206 (71 of them on Insights, mostly chart columns). Current Affairs alone was built to 44 px, which is why it feels different in the hand.
- **Recommended change.** Decouple visual size from hit area in `Pressable`: a 28 px visual pill can carry a 44 px target through padding or a pseudo-element. Raise `Segmented` to 36 px on coarse pointers. Make the whole task-row leading edge the checkbox target.
- **Scope.** Product-wide. **Dependencies.** J-05.

**RS-2 · Atlas on a phone**

- **Current state.** The top controls wrap into two rows; zoom buttons sit at a fixed offset; a summary card covers the bottom 150 px; place details open as a modal sheet that hides the map; names scale with the map during a pinch (AT-4).
- **Evidence.** `AtlasScreen.tsx:326`, `:360`, `:371-396`, `:418`; observed in `tools/perf/out/shots/_phone2.png`.
- **Target experience.** The map fills the screen. One sheet at the bottom has three detents: a one-line peek (rank and next action), half (place card or panel), full. The map stays live behind it and re-centres above the sheet.
- **Recommended change.** Replace the fixed card and the modal details sheet with one detented `BottomSheet`; collapse map tools into search, layers and a "more" menu; drop the zoom buttons on touch (pinch and double tap exist) or move them to the trailing edge above the sheet.
- **Scope.** Atlas. **Dependencies.** J-07.

**RS-3 · Current Affairs density on a phone**

- **Current state.** Each article row stacks three 44 px action buttons vertically beside a thumbnail.
- **Problem.** About three articles fit per screen (observed in `_phone2.png`); the reading list is the screen's whole purpose.
- **Evidence.** `CurrentAffairsScreen.tsx:216-220`.
- **Recommended change.** Swipe right to mark read, swipe left to save, with the rubber-band and haptic from `Pressable`; one overflow button for remove; keep the three inline buttons from medium width up.
- **Scope.** Current Affairs. **Dependencies.** J-05.

**RS-4 · Hover-only affordances**

| Element | Behaviour on touch | Evidence |
| --- | --- | --- |
| Delete a saved sound preset | Unreachable: the button is `hidden` until hover | `SoundSheet.tsx:112` |
| Chart tooltips | Appear on tap, never dismiss until another column is tapped | `charts.tsx:140`, `:182-184` |
| Native `title` tooltips on icon buttons | Never shown | `controls.tsx:88` |

**RS-5 · Between the breakpoints**

- 640–767 px: phone tab bar with desktop-style centred dialogs (DS-7).
- 768–1023 px: the rail is present but the Atlas uses its phone layout (card and modal sheet) because the inspector starts at 1024 px (`AtlasScreen.tsx:91`, `:399`). A tablet in landscape has room for the inspector.
- ≥1440 px: columns stay 42–72 rem; the canvas around them is empty. Two-pane layouts (NAV-7) are the right use of the space; widening the columns is not.

**RS-6 · Pointer and keyboard details**

- Two-finger trackpad scroll zooms the map; it does not pan. This matches Google Maps on the web but not native map apps. Keep, but accept `Shift`+scroll or a setting for pan if users ask.
- `Escape` does not deselect a place or close the desktop inspector (`AtlasScreen.tsx:506-515` handles only full screen).
- Lists have no keyboard navigation (`J`/`K` or arrows, `X` to complete, `E` to edit). For a product with a palette and chords, this is the missing layer.
- Not verified: on-screen keyboard overlap of sheet footers on iOS (the sheet uses `dvh`, which iOS does not shrink for the keyboard), and landscape phone layouts.

---

## 12. Accessibility audit

### 12.1 What is right

Real `<button>` elements almost everywhere (no click handlers on `div` or `span` apart from the task row). Accessible names on icon buttons. Dialogs with `aria-modal`, a focus trap, Escape and focus restore. `role="timer"`, `role="switch"`, `role="checkbox"`, `role="radio"` used correctly. Every chart has a table twin and a label. Contrast of every ink and accent token on every surface is asserted at 4.5:1 by `tools/perf/job4-visual.mjs`. A visible focus ring is defined globally (`index.css:213-217`). Reduced motion is respected. Live regions exist for toasts and quiz results. The Gazetteer is an explicit non-map route to every place.

### 12.2 Findings

| Id | Finding | Evidence | Recommended change |
| --- | --- | --- | --- |
| AX-1 | `Segmented` declares `role="tablist"` and `role="tab"` but has no arrow-key movement, no roving tabindex, no `aria-controls`, and no tab panels. It is also used for plain choices (theme, week start, timer mode), where a radio group is the right pattern. | `controls.tsx:160-168`; `SettingsScreen.tsx:90-110` | `Tabs` (with panels and arrow keys) and `SegmentedControl` (radio group semantics) as two primitives |
| AX-2 | `Menu` has `role="menu"` without arrow keys, focus-on-open, type-ahead or focus return. | `Menu.tsx:13-62` | Rebuild on the popover core (OV-3) |
| AX-3 | The task row is a `div role="button"` that contains two real buttons, and it answers Enter but not Space. | `TaskItem.tsx:89-96`, `:112`, `:155` | A list item with a primary button for the title and sibling action buttons |
| AX-4 | Calendar: creating at a time slot is pointer-only; the "start block" control is a `span role="button"` nested inside a `<button>`. | `CalendarScreen.tsx:365-372`, `:400-435` | Keyboard grid navigation with Enter to create; un-nest the control |
| AX-5 | The map is one `role="application"`; all names and symbols are `aria-hidden`; a place cannot be selected from the keyboard on the map. | `AtlasMap.tsx:1108-1110`, `:1159` | Keep the Gazetteer route. Add an "In view" list (visually hidden or in the inspector) that mirrors the laid-out places and is focusable; `Tab` into the map cycles visible places; Enter selects; announce the selection |
| AX-6 | 111 controls under 40 px on phone widths. | §11, RS-1 | `Pressable` hit areas |
| AX-7 | Undo is only available for 6.5 seconds, and toasts do not pause on hover or focus. | `toast.ts:26-28` | Pause on hover/focus; keep the last undoable action reachable from the palette |
| AX-8 | The Atlas route has no `h1`; Insights jumps from `h1` to `h3`. | measured heading outline | Add a visually hidden `h1` on the Atlas; fix levels in `ChartCard` |
| AX-9 | Immersive focus is `role="dialog"` without `aria-modal` or a focus trap; its hidden top controls remain focusable; the screen underneath stays exposed. | `ImmersiveFocus.tsx:98-99`, `:108` | Use the surface core; `inert` on hidden controls and on the app beneath |
| AX-10 | About 260 text sizes are fixed in pixels and ignore the user's default font size. | §4.2 | rem-based type scale (DS-1) |
| AX-11 | Colour is the only cue for task priority (checkbox border colour) and for mastery in region lists (a coloured dot with no text). | `TaskItem.tsx:54`; `UnitDetails.tsx:93` | Add an icon or text equivalent; keep the colour |
| AX-12 | Icon buttons rely on the native `title` for their visible label. | `controls.tsx:88` | `Tooltip` primitive, also shown on keyboard focus |
| AX-13 | During a session the navigation is dimmed to 28% opacity. | `index.css:559-561` | Dim less; restore on any pointer or key activity |
| AX-14 | Background content is not `inert` while a modal is open. | `Sheet.tsx:104-121` | Set `inert` on the app root from the surface core |
| AX-16 | Every chart column is its own tab stop (24 in the hourly chart, up to 31 in a month), and heat-map cells cannot be focused. | `charts.tsx:174-186`, `:371-373` | One tab stop per chart with arrow keys between marks; the table twin stays |
| AX-15 | Loading states are text only with `role="status"`, and a spinner frozen by reduced motion is indistinguishable from a static icon. | `CanonicalQuiz.tsx:27`; `index.css:743-751`; `controls.tsx:64` | Skeletons plus a text status; a non-rotating "working" indicator under reduced motion |

None of these requires trading accessibility for polish. Most are fixed by the same primitives that fix tactility.

---

## 13. Performance audit

### 13.1 Summary

| Area | Verdict | Basis |
| --- | --- | --- |
| Idle | Excellent: 60 fps, no work | measured |
| Navigation between loaded screens | Good: 48–145 ms (Insights 235 ms) | measured |
| First visit to lazy screens | Poor for the wrong reason: 330–650 ms of skeleton with chunks already local | measured (NAV-1) |
| Cold start | Acceptable on desktop (Home at 1.0–2.9 s); slow at 4× throttle (4.6–9.8 s) | measured |
| Focus running | Poor: continuous main-thread work | measured (FO-1) |
| Atlas pan | Good between repaints; a 117–700 ms frame at the end of every gesture | measured |
| Atlas zoom | Poor | measured (§7) |
| Lists and forms | Fine at current data sizes; not virtualised | inferred from code |
| Memory | JS heap 22–26 MB on the Atlas after the gesture run | measured |

### 13.2 Findings

**PF-1 · The gazetteer loads on every route at start-up**

- **Current state.** `TarsContextBridge` is mounted in the shell on every route. It calls `useExploration`, which calls `useAtlas`, which fetches and parses `places.json` (2.5 MB, 424 KB transferred), builds four indexes over 2,273 places, then computes exploration and mastery from the full session and recall history.
- **Problem.** Home and Focus pay for the Atlas. At 4× throttle the request starts 3–4 s into start-up and its parse and indexing land in the first interactions.
- **Evidence.** `App.tsx:132`; `tars/useContext.ts:28-33`; `atlas/useExploration.ts:50-60`; `atlas/data.ts:70-80`. Measured: `places.json` requested at 0.6–1.4 s (desktop) and 3.1–6.2 s (phone shape) on a cold start to Home.
- **Target experience.** Home is interactive before any Atlas work begins.
- **Recommended change.** Load the gazetteer on idle after first paint (or on first need: Atlas route, a palette place search, a due-review count). Home's "reviews due" line can show from a cheap derived count stored with the last computation and refresh when the real one arrives. Parse and index in a worker and transfer the result.
- **Scope.** Shell and Atlas engine. **Dependencies.** None.

**PF-2 · Every global overlay is in the entry chunk**

- **Current state.** The task editor and its fields, the soundscape sheet with all fourteen synthesiser definitions, timer profiles, session context, session complete, quick capture, onboarding, the palette and the command list are statically imported by `App.tsx`.
- **Evidence.** `App.tsx:23-34`, `:39-41`; entry chunk 279 KB raw; `audio/sounds.ts` is 508 lines of synthesis code used only when a sound is switched on.
- **Recommended change.** Lazy-load each closed overlay on first open and preload them on idle. Split `sounds.ts` so definitions load with the first sound.
- **Scope.** Shell. **Dependencies.** NAV-1's preloading.

**PF-3 · Boot waits for the database before showing the shell**

- **Current state.** `useBoot` awaits `ensureSeed()` and shows a breathing logo until it resolves.
- **Evidence.** `App.tsx:55-78`, `:95-101`. Measured: first contentful paint 0.4–0.9 s, Home heading 1.0–2.9 s on desktop; 1.3–2.7 s and 4.6–9.8 s at 4× throttle.
- **Recommended change.** Render the shell (rail or tab bar, stage, header) immediately from the pre-paint theme state and fill the screen when data arrives. The rail state is already applied before first paint (`index.html:42`); extend that idea to the whole frame.
- **Scope.** Shell. **Dependencies.** None.

**PF-4 · Per-second re-renders are wider than they need to be**

- **Current state.** `useNow` drives the tab title, the rail timer, the tab bar, the Home "Now" card, the Focus panel, the expedition strip and immersive mode, each re-rendering its whole component.
- **Evidence.** `timer/useNow.ts`; `Shell.tsx:63-70`; `App.tsx:392-406`; `HomeScreen.tsx:141-151`; `FocusScreen.tsx:203`. Measured: Home with a session running costs 17–36 ms/s on desktop and 146–442 ms/s at 4× throttle.
- **Recommended change.** One clock store with a selector that returns the formatted string, so only text nodes update; isolate the digits in a leaf component.
- **Scope.** Timer UI. **Dependencies.** None.

**PF-5 · Live queries are not shared for small tables**

- **Current state.** Sessions, tasks, claims, recalls and runs use one shared live query each. Labels, projects, profiles, goals, events and settings create a new Dexie live query per consuming component; `useLookups` (two queries) is called by about a dozen components.
- **Evidence.** `data/hooks.ts:31-58` vs `:60-140`, `:160-169`.
- **Recommended change.** Use `sharedLiveQuery` for every table; have `useLookups` return memoised maps.
- **Scope.** Data layer. **Dependencies.** None.

**PF-6 · Fonts**

- Four WOFF2 files with `font-display: swap` and no preload: text reflows when Manrope arrives, and the Atlas re-measures and re-lays out every name when fonts become ready (`AtlasMap.tsx:509-521`).
- Fraunces italic (81 KB) is used by one SVG label in immersive mode (`ImmersiveFocus.tsx:235`).
- **Recommended change.** Preload Manrope Latin; drop Fraunces italic; consider `font-display: optional` for Fraunces, which is only used for display moments.

**PF-7 · Precache payload**

- 176 entries and 8.05 MB are fetched when the service worker installs, on the first visit, competing with the first session. `og-image.png` (331 KB, a social preview) is in the list twice.
- **Evidence.** `vite.config.ts:37`, `:90`; `dist/sw.js`.
- **Recommended change.** Remove `og-image.png` from `includeAssets` and the glob; defer World-sheet assets to a second precache group fetched on idle or on first use of the World sheet, while keeping the handoff's guarantee that India works offline from first launch.

**PF-8 · Not measured; flagged for a later look**

- Current Affairs classifies and clusters every retained item on the main thread whenever feed or archive data changes (`CurrentAffairsScreen.tsx:47-61`). With thousands of archived items this may be long at phone speeds.
- Insights recomputes about fifteen aggregates over all sessions on each render path (`InsightsScreen.tsx:74-184`). First-visit time at 4× throttle is 2.2–3.3 s, the slowest non-Atlas screen.
- Gazetteer search renders up to 250 rows per keystroke (`Gazetteer.tsx:132`); the Done view and session log grow without virtualisation.
- Soundscape noise buffers are filled in script loops on the main thread before the off-thread render (`audio/sounds.ts:30-60`).

### 13.3 What not to do

Optimisation theatre to avoid: memoising leaf components that render in microseconds; virtualising lists of twenty rows; moving the timer into a worker (it is already timestamp-based); replacing Dexie; adding a state library. None of these addresses a measured cost.

---

## 14. Frontend architecture audit

**Does the architecture support the requested level of polish?** Yes, with four structural additions. No rewrite and no framework migration is justified by the evidence. React, Vite, Tailwind, Motion, Zustand and Dexie are all appropriate and current.

| Id | Finding | Evidence | Consequence for polish | Recommended change |
| --- | --- | --- | --- | --- |
| AR-1 | No overlay manager. Open state lives in eight booleans in one store, in local component state, and in route params. | `ui-store.ts:7-29`; `AtlasScreen.tsx:104-115`; `TasksScreen.tsx:362` | Back cannot close surfaces; stacking is accidental; no shared transitions | A surface registry in the surface core: open, close, top-of-stack, history integration |
| AR-2 | Flat router; screens unmount; scroll resets. | `router.ts`; `App.tsx:119-146` | No retained state, no directional transitions | Keep the hash router. Add route state retention, a navigation direction signal and keep-alive for the Atlas |
| AR-3 | Styling by repeated utility strings with no variant helper. | the ghost icon-button recipe is hand-written 17 times in 11 files, e.g. `Shell.tsx:146`, `AtlasScreen.tsx:411`, `:476`, `Workspace.tsx:53`, `:85`, `CurrentAffairsScreen.tsx:26-27`, `MusicDock.tsx:102-118` | Drift is the default | Variants live in primitives; a small `variants()` helper (no dependency needed) |
| AR-4 | No error boundary anywhere. | no `ErrorBoundary`, `componentDidCatch` or `getDerivedStateFromError` in `src/` | Any render error, or a failed lazy import after a deploy, blanks the whole app including a running timer | Root, route and surface boundaries; reload-once recovery for chunk load errors |
| AR-5 | `AtlasMap.tsx` is 1,539 lines: palettes, camera, a 350-line gesture closure, hit testing, React view and SVG drawing. The pure parts (`camera.ts`, `labels.ts`, `spatial.ts`) are already separate and tested. | `AtlasMap.tsx:533-879` | The gesture logic cannot be unit-tested, so every Atlas change needs a browser run | Extract `gestures.ts` (events in, camera intents out) and `renderer/` before stage B |
| AR-6 | Three reactive mechanisms: Dexie live queries, Zustand stores, and window events. One custom event is dispatched with no listener. | `timer/store.ts:250` (`tars:session`); `notes/useStickyNotes.ts:11`; `AtlasScreen.tsx:518` | Low risk; adds mental overhead | Document the rule (persistent data: live query; session UI: store; cross-tab: storage events). Remove the dead event |
| AR-7 | Persistence is split across Dexie, `localStorage`, a second IndexedDB and CacheStorage. Notes and Current Affairs state are outside backups (documented in the handoff). | `current-affairs/notes.ts`, `personal-state.ts`, `archive.ts` | A user who restores a backup loses notes | A product decision. If notes are a first-class workspace, they belong in the backup |
| AR-8 | Code style diverges in the modules added last (`tars/*`, `atlas/pyq/*`, the canonical quiz and browser, Current Affairs): compressed single-line components, no module header. | `PyqBrowser.tsx:11-39`, `tars/commands.ts`, `tars/useContext.ts` | The visible inconsistency of those screens starts here | Formatter and lint (J-02); bring these modules to the house style when they are migrated to primitives |
| AR-9 | Media and audio lifecycle is handled well: one shared `AudioContext`, follow-the-timer by store subscription, stop on `pagehide`, YouTube unloaded when minimised. | `audio/store.ts:211`; `MusicDock.tsx:53-66`, `:122-136` | None | Keep |
| AR-10 | The action registry is the right seam for consistency: one place to add haptics, analytics, undo history and optimistic feedback. | `tars/registry.ts`, `tars/runtime.ts` | Underused: many screens still write to the repository directly | Route user-initiated mutations through it over time; not a prerequisite |

---

## 15. Reliability and testing audit

### 15.1 What is covered

| Layer | Coverage | Evidence |
| --- | --- | --- |
| Timer engine, recurrence, quick-add grammar, statistics, backup/CSV, sync merge | Good unit coverage | `src/**/*.test.ts` (22 files, about 2,300 lines) |
| Atlas engine (exploration, mastery, questions, camera path, spatial index, label hierarchy) | Good | `atlas/atlas.test.ts`, `camera.test.ts`, `spatial.test.ts` |
| Data pipeline | 42 tests | `tools/atlas-build/test/` |
| Browser regression | Smoke, Atlas interactions, layout audit at four widths, learning flows, offline, contrast, full-screen | `tools/perf/*.mjs`, run in CI |
| TypeScript | Strict, unused locals and parameters as errors, no `any`, four lint suppressions | `tsconfig.app.json` |

### 15.2 Gaps

| Id | Gap | Evidence | Risk | Recommended change |
| --- | --- | --- | --- | --- |
| RL-1 | No component or hook tests. `Sheet` focus trapping, `Popover` placement, `Segmented` keys and the task checkbox are only exercised indirectly by Playwright scripts. | Vitest runs in the node environment only (`vite.config.ts:133-136`) | A primitive refactor, which is the core of this plan, has no fast feedback | Add a DOM test environment for `src/ui/**`; one behaviour test per primitive |
| RL-2 | No linter or formatter. | `package.json`; `AGENTS.md` §3 | Style drift (AR-8); hook dependency bugs are only caught by reading | ESLint (hooks rules, a11y rules, two custom rules) and Prettier with the existing house style |
| RL-3 | No error boundaries (AR-4). | – | White screen | J-01 |
| RL-4 | No performance budget in CI. `profile.mjs` exists but is not asserted. | `.github/workflows/ci.yml` | The Atlas can regress silently; the previous audit could not establish cause for a zoom regression | Assert thresholds from `gesture-audit.mjs` counts (repaints, label commits), which are deterministic, rather than frame times, which are noisy |
| RL-5 | Lazy chunk failure is unhandled. After a deploy, an open tab with a stale index requests a chunk that no longer exists. | `App.tsx:46-51`, `:142` | Blank stage | Catch in the route boundary; reload once; the update toast already exists |
| RL-6 | Only Chromium is tested. | `CODEX_HANDOFF.md` §9 item 9 | `field-sizing`, `color-mix`, `paint-order` on HTML text, the individual `scale` property, container query units and the Fullscreen API all vary across Safari and Firefox | A WebKit run of the smoke and layout scripts; a short manual matrix on one iPhone and one Android phone before any release |
| RL-7 | "Move all to today" patches tasks one by one outside a transaction. | `TasksScreen.tsx:245-248` | Partial application; one live-query refresh per task | `db.transaction` with a single bulk update |
| RL-8 | Task completion is deferred by a 320 ms timer in the checkbox component. | `TaskItem.tsx:36-47` | If the row unmounts in that window (filter change, navigation) the completion is lost | Complete immediately; animate the exit |
| RL-9 | Toast timers are not cleared when a toast is dismissed early. | `toast.ts:28` | Harmless today | Tidy when the toaster moves (OV-5) |
| RL-10 | No Content-Security-Policy header. | `vercel.json` | Low: no HTML injection paths were found (no `innerHTML`, feed text is rendered as text, URLs are canonicalised) | Add a CSP allowing self, the YouTube frame origin and HTTPS images |

### 15.3 Security notes

The news gateway takes no URL parameter, fetches only from a registry, bounds response size and time, refuses redirects, and the parser rejects DTDs and entities (`current-affairs/gateway.ts`, `feed.ts:27-29`). Thumbnails are restricted to HTTPS public hosts and loaded with `referrerPolicy="no-referrer"`. External links carry `rel="noopener noreferrer"`. This is careful work and should not be loosened for convenience.

### 15.4 Fragile areas as TARS grows

1. **`places.json` is 2.49 MB against a 3 MiB precache limit** (`CODEX_HANDOFF.md` §9 item 2). Any gazetteer growth silently removes the Atlas from offline use. Split by sheet before it grows.
2. **Everything derived is recomputed from full history** on each change. This is correct and is why nothing drifts, but `explore()` and `computeMastery()` run on the main thread over every session and recall. At a few thousand sessions this will be felt on phones. A worker with an incremental cache keeps the model and removes the cost.
3. **The Atlas renderer's rules live in comments and the handoff** ("never put a custom property on the label layer", "no opacity on HTML names"). They were learned from 10× regressions. They need to be tests, which is what RL-4 provides.
4. **QA scripts depend on accessible names** (`CODEX_HANDOFF.md` §9 item 15). A component migration will break them unless names are preserved; treat that list as a contract (§22).

---

## 16. Recommended target design system

The aim is not a new look. Paper and Night, Manrope with Fraunces for display moments, rows on a stage, capsule controls and the gold accent are a distinct identity and should stay. The aim is that every instance of a pattern is the same instance.

### 16.1 Architecture

```
reference tokens     raw values: palette steps, the 4 px grid, the type ramp          (index.css :root)
        ↓
semantic tokens      what a value is for: surface-raised, ink-secondary, radius-lg,
                     elev-2, layer-popover, motion-swap                               (index.css @theme)
        ↓
primitives           the only place class strings for interactive elements live       (src/ui/)
        ↓
patterns             ListRow + Group, Question, Workspace header, Inspector            (src/ui/patterns/)
        ↓
screens              compose patterns; no raw <button>, no arbitrary sizes            (src/features/)
```

Two lint rules hold the line: no raw `<button>` or `role="button"` outside `src/ui/`, and no arbitrary `text-[…]`, `rounded-[…]`, `z-[…]`, `duration-[…]` or numeric Motion timings outside `src/ui/` and the map renderer.

### 16.2 Type scale

Nine roles in rem, replacing 24 pixel sizes. The mapping column says which current sizes fold into each role.

| Role | Size / line | Weight | Face | Folds in |
| --- | --- | --- | --- | --- |
| `display-l` | clamp(1.875rem, …, 2.625rem) / 1.08 | 500 | Fraunces | `t-display` |
| `display-m` | 1.625rem / 1.2 | 500 | Fraunces | place and region names (26), onboarding (28, 30), summaries (`text-2xl`), quiz prompt (22) |
| `title` | 1.1875rem / 1.25 | 700 | Manrope | `t-title`, 19–21 px |
| `heading` | 0.9375rem / 1.35 | 700 | Manrope | `t-heading`, 15–17 px bold |
| `body-l` | 0.9375rem / 1.6 | 500 | Manrope | `t-body`, 15 and 15.5 px; row titles use this at 600 |
| `body` | 0.875rem / 1.5 | 500 | Manrope | `text-sm`, 13.5, 14, 14.5 px |
| `label` | 0.8125rem / 1.3 | 650 | Manrope | `t-label`, 12.5 and 13 px |
| `meta` | 0.75rem / 1.4 | 500 | Manrope | `t-meta`, `text-xs`, 11.5 and 12 px |
| `micro` | 0.6875rem / 1.3 | 700 | Manrope | 9, 10, 10.5 and 11 px (axis ticks, badges, legend keys). 11 px is the floor. |

`num` stays a modifier (tabular figures, tighter tracking) that can be applied to any role. Weight is part of the role, which ends the bold-versus-semibold drift.

### 16.3 Spacing, size and density

- **Grid:** 4 px. Steps: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Control heights:** 28 (dense, fine pointer only), 32, 40, 48.
- **Hit area:** at least 44 × 44 on coarse pointers regardless of visual height, enforced by `Pressable`.
- **Row padding:** compact 8, regular 10, comfortable 14 px vertical; 8 px horizontal inset so the hover shape sits inside the column.
- **Gutters:** 16 (compact), 24 (medium), 32 (expanded). **Section gap:** 28 or 36.
- **Density:** a `data-density` attribute derived from pointer type, not width, so a touch laptop gets touch sizes.

### 16.4 Radius

| Token | Value | Use |
| --- | ---: | --- |
| `radius-xs` | 4 | heat-map cells, subtask boxes, colour squares |
| `radius-sm` | 8 | key caps, tooltips, small wells |
| `radius-md` | 12 | fields, rows, menu items, tiles |
| `radius-lg` | 16 | cards, groups, popovers, the stage |
| `radius-xl` | 24 | dialogs, sheets, the inspector |
| `radius-full` | 9999 | buttons, chips, tabs, toggles |

Concentric rule: an inner radius is the outer radius minus the padding between them, never less than `xs`.

### 16.5 Elevation and layers

| Elevation | Composition | Use |
| --- | --- | --- |
| `elev-0` | none | rows and text on the stage |
| `elev-1` | hairline ring + `shadow-soft` | the stage, the one raised surface per screen, fields on focus |
| `elev-2` | hairline ring + `shadow-lift` | popovers, menus, map capsules, inspector, toasts |
| `elev-3` | hairline ring + `shadow-dialog` | dialogs, sheets, the palette |

| Layer token | z | Use |
| --- | ---: | --- |
| `layer-sticky` | 10 | workspace header and toolbar |
| `layer-chrome` | 20 | rail, tab bar |
| `layer-floating` | 30 | map controls, music dock |
| `layer-immersive` | 40 | immersive focus |
| `layer-modal` | 50 | dialogs, sheets, side panels |
| `layer-palette` | 60 | command palette |
| `layer-popover` | 70 | popovers, menus |
| `layer-toast` | 80 | toasts |
| `layer-tooltip` | 90 | tooltips |

### 16.6 Colour additions

- `warning`, `info`, `correct`, `incorrect` semantic colours, each with a soft background and an ink that passes 4.5:1 on all four surfaces (extend the assertion in `job4-visual.mjs`).
- State layers as tokens: `state-hover` (ink at 6%), `state-press` (ink at 10%), `state-selected` (`accent-soft`), `state-drag` (`elev-2` plus 2% scale). A pressable shows state through one overlay element animated by opacity, not by changing its own background, so hover and press are compositor-only and identical everywhere.
- `map-ui-*` tokens for pins, selection rings and route, shared by the map and the quiz so "correct" is one green.

### 16.7 Primitives to build or rebuild

| Primitive | Replaces | Notes |
| --- | --- | --- |
| `Pressable` | every hand-written press, hover and focus class | state layer, press profile by size, haptic role, hit-area padding, `loading` and `disabled` |
| `Button`, `IconButton` | current ones, rebuilt on `Pressable` | same API; add a `success` flash state |
| `ListRow`, `Group` | 57 ad hoc rows, the unused `Row`, `Card` | densities; leading, title, meta, trailing; nested actions without nested interactive roles |
| `Tabs`, `SegmentedControl` | `Segmented`, `PlanTabs`, the Current Affairs tab group | correct roles and arrow keys; overflow fade |
| Field family | `fieldBase` plus four ad hoc date, time, search and select styles | one frame; `SearchField`, `DateField`, `TimeField`, `SelectField`, `Slider` |
| `Checkbox`, `Switch`, `RadioTile` | `TaskCheck`, `Toggle`, quiz radios | drag-capable switch; full-row targets |
| `Progress` | 12 hand-rolled bars, `Ring` | bar, ring and segmented variants; `scaleX`; value announced |
| Surface family | `Sheet`, `Popover`, `Menu`, rail tooltip, layers popover | §9 |
| `Toast` | `Toaster` | bottom placement on compact; pause on hover; swipe |
| `Skeleton` | text "Loading…" states, the generic screen skeleton | per-pattern shapes |
| `Badge`, `Chip` | status pills written inline | selected, removable, count variants |
| Question set | `FieldReview` choices and order input, `CanonicalQuiz` options | §9, OV-2 |

A hidden gallery route (for example `#/settings?gallery=1`) that renders every primitive in every state gives `shots.mjs` something to screenshot, which makes visual regression of the system itself cheap.

---

## 17. Recommended target motion system

### 17.1 Principles

1. **Acknowledge within a frame.** Contact produces a visible change before any work is done.
2. **Explain, do not decorate.** Movement shows where something came from, where it went, or what changed.
3. **Never block.** No animation delays input or data writes. Everything can be interrupted and retargeted from its current value.
4. **Compositor only.** Transform and opacity. Layout properties do not animate.
5. **Quiet.** At most one attention-seeking animation on screen. Loops stop when their container is not the focus of the screen.

### 17.2 Tokens

| Duration | Value | Role |
| --- | ---: | --- |
| `instant` | 90 ms | press in |
| `fast` | 140 ms | hover, small reveals, exits |
| `base` | 220 ms | popovers, content swap, list items |
| `slow` | 320 ms | panels, sheets, layout moves |
| `calm` | 520 ms | changes of mode (entering a session, immersive) |

| Easing | Curve | Use |
| --- | --- | --- |
| `out` | (0.2, 0.8, 0.2, 1) | arrivals |
| `in-out` | (0.65, 0, 0.35, 1) | movement between two rests |
| `in` | (0.4, 0, 1, 1) | departures |

| Spring | Stiffness / damping | Use |
| --- | --- | --- |
| `snap` | 700 / 45 | press release, switch thumb, checkbox |
| `glide` | 520 / 40 | selection indicators |
| `surface` | 420 / 40 | sheets and panels, with velocity handed over from the drag |
| `settle` | 380 / 34 | list items, toasts |

These are the existing values, consolidated. Springs are for things the user moves or that track a changing target; durations are for things that simply appear or leave.

### 17.3 Roles

| Role | What moves | Timing | Used for |
| --- | --- | --- | --- |
| `press` | scale to 0.96 (controls) or 0.985 (surfaces), state layer to press opacity | `instant` in, `snap` out | every `Pressable` |
| `hover` | state layer opacity | `fast` | fine pointers only |
| `indicator` | shared-layout pill or underline | `glide` | tabs, rail, segmented |
| `reveal` | opacity, 4 px rise | `base` `out`; exit `fast` `in` | popover, menu, tooltip, inline expansion |
| `swap` | cross-fade in place, no movement | `base` | sibling views, sheet content changes, quiz questions, filters |
| `push` / `pop` | incoming slides 24 px and fades in; outgoing fades back 2% | `slow` `out`; reversed for pop | drill-in and return |
| `expand` | shared element grows from its source; siblings fade | `slow` or `surface` | task row → panel, symbol → place card, dial → immersive |
| `surface-enter` / `-exit` | sheet or panel from its edge, backdrop fade | `surface`; exit `fast` | dialogs, sheets, side panels |
| `list-insert` / `-remove` / `-reorder` | opacity and position by layout projection | `settle` | task lists, notes, toasts |
| `progress` | `scaleX` or rotation | linear over the measured interval, or `base` for a step | bars, rings, the dial |
| `success` | one-shot: fill from the press point, tick draws, soft haptic | `base` | completing a task, a correct answer, saving |
| `attention` | slow opacity pulse | 2.4 s loop | at most one element per screen |
| `camera` | Atlas fly-to | path length, as now | Atlas only |

### 17.4 Rules

- Exits are about 60% of the matching enter.
- Stagger at most five items, 30 ms apart; never stagger on return navigation.
- Distance-proportional duration for sheets and the camera; fixed durations elsewhere.
- No `mode="wait"`. No timers that hold back a write so an animation can play.
- Loops (halo, pulses, ships, shimmer) pause when the document is hidden, when their surface is covered by a modal, and while the map moves.

### 17.5 Reduced motion

| Aspect | Policy |
| --- | --- |
| Source | `prefers-reduced-motion`, plus a Settings choice (System, Reduced, Full) written to `data-motion` on `<html>` before first paint. One helper, `motionPreference()`, replaces the two duplicate functions. |
| Movement | `push`, `pop`, `expand`, `surface-enter` and layout animations become `swap` (a cross-fade) at `fast`. They do not become instant: the cross-fade is what keeps the change legible. |
| Press | State layer only, no scale. |
| Loops | Halo, breathing ring, pulses, ships, flowing rivers and shimmer are off. |
| Progress | Still moves: it is information. The dial advances; the completion bloom becomes a colour change. |
| Loading | A spinner is replaced by a three-dot opacity pulse or the text status, so "working" is still visible. |
| Atlas | Camera moves cut with a 120 ms cross-fade; no momentum; no wheel easing; names appear without the ink-in. |
| Implementation | Targeted `[data-motion="reduced"]` rules per role replace the global `* { transition-duration: 0.001ms }` rule. `MotionConfig` reads the same value. |
| Haptics | Unchanged; they are not motion. |

---

## 18. Recommended Atlas architecture

### 18.1 Decision

Keep the data pipeline, the pre-projected sheets, the camera model, the gesture handling, the label algorithm, the gazetteer and the offline model. Replace how the base map reaches the screen, and change when and where names are laid out. Do this in three stages, each shippable and measurable on its own.

```
                         ┌──────────────────────── main thread ───────────────────────┐
 pointer / wheel / keys → gestures.ts → camera (ref) ──┬→ CSS transform on tile levels  (compositor)
                                                       ├→ overlay layer: selection, route, pins   (small SVG)
                                                       └→ label layer: names and symbols          (HTML, unscaled)
                                                              ↑ incremental layout (labels.ts), in a transition
                         └──────────────────────────────┬─────────────────────────────┘
                                                        │ tile requests (level, x, y, style key)
                         ┌──────────────── worker ──────▼─────────────────────────────┐
                         │ sheet geometry as chunked Path2D with bounding boxes         │
                         │ grid index → draw only what intersects the tile              │
                         │ OffscreenCanvas 2D → ImageBitmap → transferred back          │
                         └──────────────────────────────────────────────────────────────┘
```

### 18.2 Stage A · Stop the storm, fill the map (inside the current renderer)

No new subsystem. Each item is small and independently testable with `gesture-audit.mjs`.

| Step | Change | Removes |
| --- | --- | --- |
| A1 | Settle from the frame loop when no camera change has been requested for 140 ms; never from a timeout that can fire between delayed frames | the feedback loop in AT-2 |
| A2 | Repaint only when the zoom crosses a √2 level or the margin is exhausted; never start a repaint while one is in flight; raise the minimum gap to the measured repaint time | 4–9 repaints per gesture → 2–4 |
| A3 | Lay out names and symbols for the viewport plus the painted margin; run a throttled incremental layout while a pointer is down once the camera has moved half the margin | the empty map in AT-3 |
| A4 | Move selection, highlights and the route out of the base SVG into a small overlay layer | the 417 ms hitch on selecting a place (AT-5) |
| A5 | Select on release with a pressed state at contact; rubber-band at bounds and zoom limits; insets on four sides for fly-to | AT-8a, AT-8b, AT-8c |
| A6 | Resize by transform during shell transitions and repaint once at the end | MO-3 on the Atlas |

Expected after stage A: zoom still hitches, but two to four times per gesture instead of continuously; dragging never shows an unlabelled map; selecting is instant.

### 18.3 Stage B · Tile raster cache

**What a tile is.** A 512 × 512 device-pixel bitmap of the base map (relief or flat colours, water, boundaries, fog, areas) for one square of the sheet at one zoom level. Levels are powers of two of the sheet scale. Tiles are produced on the device from the data the app already ships. Nothing new is downloaded.

**Modules** (under `src/features/atlas/renderer/`):

| Module | Responsibility | Tested by |
| --- | --- | --- |
| `gestures.ts` | Pointer, wheel and key events in; camera intents out. Extracted from the closure at `AtlasMap.tsx:533-879` without behaviour change. | unit tests with synthetic event sequences |
| `camera.ts` | Existing. Add rubber-band and the settle clock. | existing tests plus new ones |
| `tiles.ts` | Level for a camera scale, tile range for a view, parent and child fallbacks, request ordering (centre out, then one ring of overscan, then one level each way) | unit tests |
| `tileWorker.ts` | Holds decoded geometry chunked into pieces of at most a few hundred segments with bounding boxes, indexed in a grid. Draws a tile: relief region with `drawImage`, then each style group's intersecting chunks, in the current order with the current colours. | pixel-hash test of fixed tiles in the browser harness |
| `tileCache.ts` | LRU keyed by sheet, style key, level, x, y. Budget by device memory (about 24 tiles on low-power devices, 48 otherwise). Closes bitmaps on eviction. Generation ids cancel stale requests. | unit tests |
| `BaseLayer.tsx` | One container per level, moved by CSS transform exactly as the SVG layer is today. Shows the best available tiles for the view (wanted level, else scaled parents or children), and cross-fades a level in when its visible tiles are ready. Never blank. | gesture audit |
| `OverlayLayer.tsx` | Selection, highlights, route, pins, living-world routes. Sheet coordinates, small SVG. | existing Atlas checks |
| `LabelLayer.tsx` | Names and symbols. See below. | gesture audit, Atlas checks |

**Design points**

- **Culling.** Today the largest path has 14,613 segments and is processed in full on every repaint. Chunking at decode time and a grid lookup per tile means a tile at 3× zoom draws only the few hundred segments that cross it. This is the change that makes cost independent of zoom.
- **Style parity.** Canvas 2D supports everything the SVG uses: dashes (`setLineDash`, scaled so they stay constant on screen), double-stroke halos, the hatch pattern, `multiply` and `soft-light` compositing for the shade plate. The sepia tone can be pre-applied to the relief bitmap once per style.
- **What stays out of tiles.** Anything that changes with interaction or progress: selection, route, pins, living-world decoration, and the fog (as its own tile set keyed by the explored set, so travelling does not invalidate the base).
- **Fallback.** Where `OffscreenCanvas` in a worker is unavailable, the same drawing code runs on the main thread, one tile per idle slice.
- **Compositing choice.** Two options: per-level containers of tile canvases moved by CSS transforms (keeps pan fully on the compositor, which is proven here), or one viewport canvas redrawn per frame from the bitmap cache (simpler cross-fades, a little main-thread work per frame). A one-day spike should measure both at the phone shape before committing. The first is the default.
- **Names during zoom.** Put HTML names in a container that does not scale and position them in one pass per frame; or allow names to scale only within one √2 step before an incremental re-layout replaces them. The spike measures both. Acceptance: no name changes size by more than 10% during a pinch on any device, and positioning costs under 2 ms per frame on desktop.
- **Memory.** 48 tiles is about 50 MB of bitmap, comparable to the 25–64 MB the current single layer occupies at 6–16 megapixels, and bounded.
- **Lifecycle.** With the Atlas kept alive across navigation (NAV-2), the worker and cache persist; they are released when the tab is hidden for long or memory is low.

**What this replaces:** `paint`, `stale`, the painted-margin logic and `BaseMap` (`AtlasMap.tsx:329-362`, `:483`, `:1369-1483`). **What it does not touch:** the data files, `atlas/sheet.ts` decoding (it gains a chunked output), `labels.ts`, hit testing, the gazetteer, mastery, expeditions, the service worker.

### 18.4 Stage C · Detail that arrives as you approach

Content work in `tools/atlas-build`, made worthwhile by stage B:

- A second relief level for India at twice the resolution, cut into tiles and shipped as a removable pack under the regional-pack policy already defined in `tools/build-atlas-assets.mjs`.
- Two or three simplification levels of the vector data, selected by tile level.
- Label thresholds revisited so each zoom step adds names.
- Maximum zoom raised from 7× to about 16× where data supports it.

### 18.5 Why not MapLibre now

The repository's spike showed MapLibre panning and zooming at p95 18 ms. It was declined for good reasons that still hold: 313 KB of gzip JavaScript, a Web Mercator pipeline that would replace the atlas projections that give the map its character, and unproven parity for the fog, mastery, expedition and protected-area layers, offline packs and the controlled India depiction (`tools/map-spike/README.md`).

The evidence here adds one more: the Atlas's data is small. Eighty thousand segments and one relief image do not need a GPU vector pipeline; they need to stop being re-rasterised. Stage B achieves the interaction target with no dependency and no change to the cartography.

Revisit MapLibre if the product direction becomes street-level depth, rotation and pitch, or tens of thousands of dynamic features. The spike and its notes are the starting point for that decision.

### 18.6 Targets

Targets, not promises; each is checked by `gesture-audit.mjs`. "Now" is the measured range.

| Metric | Now (desktop / phone shape) | After stage A | After stage B |
| --- | --- | --- | --- |
| Base repaints in one zoom gesture | 4–9 | ≤ 4 (done: 2–4) | 0 on the main thread |
| Label layouts in one zoom gesture | 3–8 | ≤ 4 (done: 1–2) | ≤ 4, incremental |
| Zoom p95 frame | 33–467 ms / 250–283 ms | not a target yet | ≤ 20 ms / ≤ 34 ms |
| Frames over 100 ms in one zoom | 7–38 / 25–42 | ≤ 4 | 0 |
| Worst frame at the end of a pan | 117–700 ms / 183–700 ms | ≤ 400 ms | ≤ 34 ms / ≤ 50 ms |
| Names on screen while holding a drag, as a share of after release | 11% / 24% | ≥ 80% | ≥ 80% |
| Contact → pressed feedback on a place | none | 1 frame | 1 frame |
| Release → place card | 276–330 ms | ≤ 120 ms | ≤ 120 ms |
| Select a place: worst frame | 417 ms | ≤ 50 ms | ≤ 34 ms |
| Collapse the rail over the map: repaints | 4–5 | 1 | 0 |

---

## 19. Component-by-component redesign list

Priority refers to §20. "Job" refers to §23.

### 19.1 Primitives

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| `Button` | Good API; press 0.97; no success state | Rebuild on `Pressable`; add `success` flash; hit-area padding | P0 | J-05 |
| `IconButton` | `disabled` still hovers; native `title` tooltip | `Pressable`; `Tooltip`; sizes bound to icon sizes | P0 | J-05, J-07 |
| `Toggle` → `Switch` | Thumb springs; 48 × 28; row not tappable | Pressed thumb, drag, full-row target, haptic | P0 | J-05 |
| `Segmented` | Wrong role for half its uses; no keys; 24–30 px | Split into `Tabs` and `SegmentedControl`; arrow keys; 36 px on coarse pointers | P0 | J-05 |
| `Chip` | Hover text only | `Pressable`; selected, removable and count variants | P0 | J-05 |
| `Stepper` | No hold-to-repeat | Repeat with acceleration; wheel and arrow keys | P2 | J-20 |
| Fields | Four designs | One frame; `SearchField`, `DateField`, `TimeField`, `SelectField`, `Slider` | P0 | J-05 |
| `Row`, `.row`, ad hoc rows | Three implementations | `ListRow` and `Group` | P0 | J-05 |
| `Card` | Tinted box, two uses | Fold into `Group`; one raised `Surface` | P1 | J-17 |
| Progress bars, `Ring` | Twelve bars, width animation | `Progress` | P0 | J-05 |
| `Sheet` | One shape per breakpoint | Surface family | P1 | J-07 |
| `Popover`, `Menu`, tooltip | Three one-offs | Shared core; keyboard behaviour | P1 | J-07 |
| `Toaster` | Top; no pause | Bottom on compact; pause; swipe; undo history | P2 | J-19 |
| `EmptyState` | Consistent | Keep; add an optional illustration slot | P2 | J-21 |
| Skeleton | One generic screen skeleton | Per-pattern skeletons | P2 | J-21 |
| `ColorPicker` | Works | `Pressable`; arrow keys in the radio group | P2 | J-20 |

### 19.2 Shell

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| Boot | Logo until the database opens | Shell first, content when ready | P0 | J-03 |
| Route host | Remount, scroll reset, synchronous skeleton | Preload, transition navigation, retained state, keep-alive Atlas | P0 | J-03, J-08 |
| Rail | Good; width animates layout | Transform-based collapse; `Tooltip` | P1 | J-09 |
| Tab bar | Good; wrong tab selected for off-bar screens; stroke weight changes on selection | Correct selection; filled icon for selected; 28% session dim softened | P1 | J-09 |
| Workspace header | Title position varies with column width | Full-width header; consistent action slot; content column below | P1 | J-09 |
| Command palette | Strong | Shared surface tokens; recent items; "Undo last action" | P2 | J-19 |
| Error states | None | Root, route and surface boundaries with a designed fallback | P0 | J-01 |

### 19.3 Focus

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| `TimerDial` | 60 Hz script loop | Compositor-driven arc and head; per-second ticks | P0 | J-10 |
| Start/pause control | Best control in the app | Keep; move ripple and ring to `Pressable` effects so others can use them | P2 | J-20 |
| Mode bar | Two rows, three controls | One control opening the profile popover | P1 | J-14 |
| Session context, profiles, sounds | Modals | Popovers on wide layouts | P1 | J-14 |
| Stop | Three-button modal | Save with Undo, or inline morph | P1 | J-14 |
| Session complete | Delayed modal | Inline completion card | P1 | J-14 |
| Immersive | Fade; own controls and colours | Shared-element digits; shared controls; tokens; `inert` | P2 | J-22 |
| Soundscape tiles | No press; native sliders; delete preset is hover-only | `Tile` on `Pressable`; `Slider`; visible delete | P1 | J-16 |
| Music dock | Hand-made icon buttons | `IconButton`; drag to reposition is optional | P2 | J-16 |

### 19.4 Plan

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| Task row | `div role="button"` with nested buttons; hover only; 25 px checkbox | `ListRow`; proper structure; 44 px checkbox target; swipe to complete or schedule on touch | P1 | J-13 |
| Task checkbox | 320 ms deferred write | Immediate write; `success` motion carries the tick | P0 | J-13 |
| Quick add | Strong grammar and chips | Keep; move to field primitives; animate the panel without height animation | P2 | J-13 |
| Task editor | Centred modal | Side panel on wide layouts; full sheet on phone; saved indicator | P1 | J-12 |
| Schedule block | Modal over modal | Step within the task panel | P1 | J-12 |
| Plan tabs | Overflow with no cue | `Tabs` with fade; "Lists" grouping on compact | P1 | J-09 |
| Calendar time grid | Pointer-only creation; no hover or press on blocks; nested button | Keyboard grid; `Pressable` blocks; drag to move and resize (P3) | P1 | J-17 |
| Calendar month grid | Bordered card; emoji icon | `Group`; icon from the set; press state | P1 | J-17 |
| Habit card | `Card`; 36 px day buttons | `Group` rows; `Pressable` day cells | P1 | J-17 |
| Project, habit, event, goal, session, label editors | Modals with confirm on delete | Popover or inline on wide; Undo on delete | P1 | J-12, J-18 |

### 19.5 Atlas

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| `AtlasMap` | §7 | §18 stages A and B | P0, P1 | J-11a–c, J-23–J-25 |
| Map toolbar | Eight 36 px buttons in two capsules; wraps on phones | Search, layers, more; `Tooltip`; 44 px targets on touch | P1 | J-15 |
| Layers | Hand-rolled popover | `Popover` | P1 | J-15 |
| Inspector (desktop) | Appears without transition; fixed 372 px | `SidePanel` with enter and exit; fly-to respects it | P1 | J-15 |
| Phone summary card and details sheet | Fixed card plus modal | One detented `BottomSheet` over a live map | P1 | J-15 |
| Place details | Good content hierarchy; chips and links without press states; mastery well looks tappable | `ListRow` and `Chip` primitives; "Test me" as the well's action | P1 | J-15 |
| Gazetteer | Modal with 250-row list | Anchored search; arrow through results to preview on the map; virtualised | P1 | J-15 |
| Legend | Duplicated hex values | Reads from `style.ts`; popover | P2 | J-15 |
| Expeditions | Bordered rows; expansion without transition | `ListRow` with `reveal`; inspector tab | P1 | J-15 |
| Field review | Good flow; `mode="wait"`; own tiles | Question set; `swap`; keys | P1 | J-18b |
| Canonical quiz, browser, place questions | Native radios, text loading states, no sequence | Question set; skeletons; sequence with previous and next | P1 | J-18b |
| Offline panel | One line of dense text | `ListRow` with a progress indicator | P2 | J-15 |

### 19.6 Other screens

| Component | Now | Change | Priority | Job |
| --- | --- | --- | --- | --- |
| Home "Now" surface | Not a single target | One `Pressable` surface; `expand` into Focus | P2 | J-20 |
| Today progress block | Inert | Navigates to Insights | P2 | J-20 |
| Current Affairs list | Own controls; stacked actions on phone; abrupt filters | Primitives; swipe actions; popover filters; `reveal` analytics | P1 | J-16b |
| Insights summary and charts | Clear; hover-only tooltips; no drill-down | Tap a column to open that day; animated tooltip; keyboard arrows between columns; enter animation once | P2 | J-21 |
| Insights first load | 2.2–3.3 s at 4× throttle | Defer below-the-fold charts; memoise aggregates per range | P1 | J-28 |
| Settings | Grouped lines; row not tappable; native range | `Group` and `ListRow`; full-row switches; `Slider`; "Reduce motion" choice | P1 | J-16 |
| Notes | Distinct, pleasant paper style | Keep; `list-insert` and `-remove` motion; draft autosave | P2 | J-21 |
| Quick capture | Small modal | Palette-style top dialog on wide; sheet on phone | P2 | J-12 |
| Onboarding | Modal over the app; Escape completes it | Full-screen first run; explicit skip only | P2 | J-22 |

---

## 20. P0 / P1 / P2 / P3 roadmap

Ranking is by user impact × how often it is felt × how much later work it unlocks × measured performance gain, discounted by implementation risk. Novelty is not a factor.

### P0 · Foundation

Required before substantial visual redesign. Nothing here changes how the product looks, except that the map stops stalling and the timer stops heating the phone.

| Item | Why it is P0 | Jobs |
| --- | --- | --- |
| Error boundaries and chunk-failure recovery | Every later job touches rendering; a white screen is the worst regression available | J-01 |
| Lint, format, two custom rules | Without enforcement the primitives will be bypassed again | J-02 |
| Performance budgets in CI | The Atlas rules were learned through 10× regressions; make them assertions | J-27 |
| Atlas stage A: settle clock, repaint policy, labels while dragging, overlay layer, tap and edges | Largest felt defect; cheap; no new subsystem | J-11a, J-11b, J-11c |
| Focus dial on the compositor | The core state of the product should cost nothing | J-10 |
| Instant navigation: preload, transition, shell-first boot | Felt on every tab press | J-03 |
| Start-up weight: gazetteer off the start-up path, lazy overlays, clock store | Felt on every launch, most on phones | J-28 |
| Tokens v2 and dead-code removal | The vocabulary the primitives are written in | J-04 |
| Core primitives with tests and a gallery | Everything in P1 and P2 is built from these | J-05a–d |
| Motion tokens v2 and the reduced-motion strategy | Same reason, for motion | J-06 |

### P1 · Transformation

The changes that make TARS feel like an application rather than a set of pages.

| Item | Jobs |
| --- | --- |
| Surface family with history integration (dialog, detented sheet, side panel, popover, menu, tooltip) | J-07a–c |
| Route state retention, scroll restoration, Atlas keep-alive | J-08 |
| Shell alignment: fixed header position, transform-based rail, correct tab selection, Plan tabs | J-09 |
| Atlas stage B: gesture extraction, tile worker and cache, label layer | J-23, J-24, J-25 |
| Atlas chrome: inspector as a side panel, detented sheet on phones, anchored search, toolbar | J-15 |
| One question surface for recall and exam questions | J-18b |
| Task editor as a side panel; inline editors | J-12 |
| Plan lists on primitives; immediate completion; swipe actions | J-13 |
| Focus surfaces: inline completion, no stop dialog, popovers | J-14 |
| Settings, Soundscape, Current Affairs, Calendar and Habits on primitives | J-16, J-16b, J-17 |
| Delete with Undo in place of six confirm dialogs | J-18 |
| Accessibility pass | J-29 |
| WebKit and device verification | J-30 |

### P2 · Polish

Microinteractions and consistency, worth doing only on top of P0 and P1.

| Item | Jobs |
| --- | --- |
| Toast placement, pause, swipe, undo history; palette recents | J-19 |
| Tactile details: stepper repeat, slider detents, switch drag, Home surfaces | J-20 |
| Skeletons per pattern; chart interactions; list and notes motion | J-21 |
| Immersive and onboarding transitions | J-22 |

### P3 · Advanced

Sensible only when the foundation is strong.

| Item | Note |
| --- | --- |
| Atlas stage C: second relief level, multi-level geometry, deeper zoom | J-26. Content work; needs the regional-pack policy |
| Shared-element transitions with the View Transitions API | After J-07 and J-08; Motion `layoutId` covers the three named pairs until then |
| Keyboard list navigation (`J`/`K`, `X`, `E`) and per-screen shortcut help | After J-05b |
| Derived Atlas state in a worker with an incremental cache | When history sizes make `explore()` felt |
| Calendar drag to move and resize; drag the dial to set time | After J-17 and J-10 |
| Label layout in a worker | Only if J-25 shows layout cost on the frame path |
| MapLibre | Only on the triggers in §18.5 |
| Notes and Current Affairs state in backups | A product decision (AR-7) |

### Sequence

```
J-01 ─ J-02 ─ J-27 ──────────────────────────────────────────────────────────────┐
                                                                                  │ guard-rails first
J-11a → J-11b → J-11c ──────────────→ J-23 → J-24 → J-25 ───────────→ (J-26)      │ Atlas track
J-10                                                                              │ Focus track
J-03 → J-28 → J-08 → J-09                                                         │ shell track
J-04 → J-05a → J-05b/c/d → J-06 → J-07a → J-07b/c → J-12 … J-18b → J-19 … J-22    │ system track
                                              J-29, J-30 run alongside P1
```

The four tracks are independent after the guard-rails and can be worked in parallel sessions.

---

## 21. Technical dependencies

| Dependency | Needed by | Notes |
| --- | --- | --- |
| A DOM test environment for Vitest | J-05, J-07 | A dev dependency. Limit to `src/ui/**` so logic tests stay in the fast node environment. |
| ESLint and Prettier | J-02 | Dev dependencies. Configure to the existing house style; do not reformat the repository in one commit. |
| `OffscreenCanvas` with a 2D context in a worker | J-24 | Chrome, Edge, Firefox and Safari 16.4 or later. Main-thread fallback required. |
| `ImageBitmap` transfer and `close()` | J-24 | Widely available. |
| CSS `inert` attribute | J-07, J-29 | Widely available. |
| History API state for overlays | J-07c | Works with the hash router; Capacitor's back button must call the same close path. |
| Breakpoint and pointer tokens | J-05, J-07 | DS-7. |
| The accessible-name contract for QA scripts | every migration job | `CODEX_HANDOFF.md` §9 item 15. |
| The regional-pack and precache policy | J-26, J-28 | `tools/build-atlas-assets.mjs`; the 3 MiB limit in `vite.config.ts:108`. |
| Physical devices | J-30 | One iPhone (Safari and installed PWA) and one mid-range Android phone (Chrome and the Capacitor shell). |

**No new runtime dependency is required by any job.** The repository's rule is to ask before adding one (`AGENTS.md` §5); the dev dependencies above should be confirmed with the same care.

**No Dexie schema change is required.** Route state, the overlay stack and the tile cache are in-memory. If notes move into backups (AR-7), that is a schema change and a separate decision.

---

## 22. Risks and regressions to avoid

| Risk | Why it is real here | Guard |
| --- | --- | --- |
| Breaking the QA scripts' accessible names | They locate controls by name: `Start focus…`, `Pause`, `Resume`, `Stop the timer`, `Ask Tars`, `Collapse sidebar`, `Short notes`, one `role="timer"`, five tabs in `navigation "Main"` | Treat `CODEX_HANDOFF.md` §9 item 15 as a contract; run `smoke`, `features-check`, `tars-check`, `ui-audit` after every migration job |
| Re-introducing known Atlas regressions | Custom property on the label layer; opacity on HTML names; `animation-fill-mode: both` on symbols; per-frame React state; per-frame SVG attribute writes | J-27 turns each into a count assertion before the renderer is touched |
| Timer correctness | The dial rewrite must not become a source of truth | The engine is not edited. The dial reads `progress(timer, now)` and re-syncs on every transition and wake; engine tests must stay green; add a drift check |
| Changing the look of the map | Canvas and SVG rasterise strokes, dashes and blends slightly differently | Pixel-compare tiles against SVG screenshots per style at three zoom levels; review Night and Antique by eye |
| India boundary depiction | Legally sensitive; controlled by the data pipeline | Stage B draws the same data in the same order; no data change; add the boundary layers to the pixel comparison |
| Data loss from optimistic UI | Moving writes earlier (task completion) changes failure modes | Writes stay in the repository and action layer; failure rolls the UI back with a toast; keep the atomic transactions from Job 4 |
| Persistent identifiers | `lodestar` database name, manifest id, app ids, storage keys, place ids | No job touches them; `job4-integrity.mjs` checks protected files |
| Service-worker offline guarantee | Deferring World assets or splitting the gazetteer could break "India works offline from first launch" | `job4-offline.mjs` must pass; keep India in the first precache group |
| Motion sickness and distraction | More motion is being added | Every new role has a reduced-motion form (§17.5); at most one looping animation per screen |
| Focus calm | Polishing Focus could make it busier | The rule from the handoff stands: once a session runs, everything that is not the session recedes |
| Scope creep into a rewrite | Many findings touch every screen | Migrations are per screen and behind the same primitives; no job changes routing library, state library or styling approach |
| Mass reformatting | A formatter run across 27,000 lines buries real diffs | Format only files a job touches |
| Performance theatre | Easy to add memoisation and virtualisation everywhere | Only optimise what `gesture-audit` or `app-audit` shows as a cost (§13.3) |
| Bundle growth from primitives | New surface family and question set | Track the entry chunk in `bundle-profile.mjs`; lazy-load overlays (J-28) should more than offset it |

---

## 23. Suggested implementation jobs

### Ground rules for every job

1. Read `AGENTS.md` and `CODEX_HANDOFF.md` first. Follow the "done" checklist in `AGENTS.md` §6, including the handoff update.
2. Do not commit, push or deploy without the user's approval. Ask before adding any dependency or changing the Dexie schema.
3. Keep the accessible names listed in `CODEX_HANDOFF.md` §9 item 15.
4. Baseline before, measure after, with the same script and the production build: `npm run build && npm run preview`, then from `tools/perf`:
   - `node gesture-audit.mjs http://localhost:4173/` (Atlas; results in `out/gesture-audit/`)
   - `node app-audit.mjs http://localhost:4173/` (Focus cost, navigation, start-up, touch targets; results in `out/app-audit/`)
   - `node smoke.mjs`, `node atlas-check.mjs`, `node ui-audit.mjs`, `node tars-check.mjs`, and `node features-check.mjs` against `npm run dev`
5. Every job ends with `npm run typecheck`, `npm test` and `npm run build` passing.
6. One job, one concern. If a job uncovers a separate problem, record it in the handoff rather than fixing it in passing.

The baseline numbers for this audit are in §1 and §7 and in `tools/perf/out/gesture-audit/*.json` and `out/app-audit/*.json`.

### Job index

Jobs are listed below in the order they should be executed, not in numeric order. Ids are stable so other sections can refer to them.

| Job | Priority | Track | One-line objective |
| --- | --- | --- | --- |
| J-01 | P0 | guard-rails | Error boundaries and chunk-failure recovery |
| J-02 | P0 | guard-rails | Lint, format and two custom rules |
| J-27 | P0 | guard-rails | Performance budgets in CI |
| J-11a | P0 | Atlas | Settle clock and repaint policy: end the repaint storm |
| J-11b | P0 | Atlas | Names and symbols while dragging |
| J-11c | P0 | Atlas | Overlay layer, instant tap, soft edges, quiet resize |
| J-10 | P0 | Focus | Dial on the compositor (done) |
| J-10b | P1 | Focus | Once-a-second readouts as leaf components |
| J-03 | P0 | shell | Instant navigation and shell-first boot |
| J-28 | P0 | shell | Start-up weight |
| J-04 | P0 | system | Tokens v2 and dead-code removal |
| J-05a | P0 | system | `Pressable`, `Button`, `IconButton`, `Chip`, gallery, DOM tests |
| J-05b | P0 | system | `ListRow`, `Group`, `Progress` |
| J-05c | P0 | system | `Tabs`, `SegmentedControl`, `Switch`, `Checkbox` |
| J-05d | P0 | system | Field family |
| J-06 | P0 | system | Motion tokens v2 and reduced motion |
| J-07a | P1 | system | Surface core, `Dialog`, `BottomSheet` with detents |
| J-07b | P1 | system | `Popover`, `Menu`, `Tooltip` |
| J-07c | P1 | system | `SidePanel` and Back integration |
| J-08 | P1 | shell | Route state, scroll restoration, Atlas keep-alive |
| J-09 | P1 | shell | Shell alignment |
| J-23 | P1 | Atlas | Extract gestures and renderer modules; compositing and label spike |
| J-24 | P1 | Atlas | Tile worker, cache and base layer |
| J-25 | P1 | Atlas | Label layer |
| J-15 | P1 | Atlas | Atlas chrome: inspector, detented sheet, anchored search |
| J-18b | P1 | learning | One question surface |
| J-12 | P1 | Plan | Task editor as a side panel; inline editors |
| J-13 | P1 | Plan | Plan lists on primitives |
| J-14 | P1 | Focus | Focus surfaces without modals |
| J-16 | P1 | screens | Settings and Soundscape on primitives |
| J-16b | P1 | screens | Current Affairs on primitives |
| J-17 | P1 | screens | Calendar and Habits on primitives, with keyboard |
| J-18 | P1 | screens | Delete with Undo |
| J-29 | P1 | quality | Accessibility pass |
| J-30 | P1 | quality | WebKit and device verification |
| J-19 | P2 | polish | Toasts and palette |
| J-20 | P2 | polish | Tactile details |
| J-21 | P2 | polish | Loading, empty and data-rich states |
| J-22 | P2 | polish | Immersive and onboarding transitions |
| J-26 | P3 | Atlas | Stage C: detail that arrives as you approach |

---

### J-01 · Error boundaries and chunk-failure recovery (P0)

- **Objective.** A render error or a failed lazy import never blanks the app. The shell and the timer stay alive; the user sees a calm recovery surface.
- **Affected systems.** `src/app/App.tsx` (route host, global overlays), new `src/ui/ErrorBoundary.tsx`.
- **Dependencies.** None.
- **Acceptance criteria.**
  - A throw inside any screen shows a recovery panel inside the stage; the rail or tab bar, the running timer readout and navigation still work.
  - A throw inside an overlay closes that overlay and shows a toast; the screen beneath is intact.
  - A rejected dynamic import reloads the page once (guarded so it cannot loop) and otherwise shows a "Reload" action.
  - A root boundary catches anything else with the existing database-error styling.
  - Copy follows the house style (§4.0 of the handoff).
- **Verification.** A browser check that aborts a route chunk request and asserts the recovery panel and a live timer; a DOM test that a throwing child renders the fallback; smoke and UI audit unchanged.

### J-02 · Lint, format and two custom rules (P0)

- **Objective.** Make the design-system rules enforceable and stop style drift.
- **Affected systems.** Tooling only: `package.json`, new ESLint and Prettier configuration, CI.
- **Dependencies.** User approval for dev dependencies.
- **Acceptance criteria.**
  - `npm run lint` exists and runs in CI.
  - Rules: React hooks, a JSX accessibility set, and two custom restrictions reported as warnings for now: raw `<button>` or `role="button"` outside `src/ui/`; arbitrary `text-[…]`, `rounded-[…]`, `z-[…]`, `duration-[…]` and numeric Motion timings outside `src/ui/` and `src/features/atlas/`.
  - The warning counts are printed and recorded in the handoff as the baseline (expected about 128 raw buttons and about 260 arbitrary text sizes).
  - Prettier is configured to the existing style (no semicolons, single quotes, two-space indent, wide lines). No repository-wide reformat.
- **Verification.** `npm run lint` output; CI green; `git diff --stat` shows configuration files only.

### J-27 · Performance budgets in CI (P0)

- **Objective.** Regressions in the Atlas renderer and in session cost fail the build.
- **Affected systems.** `tools/perf/gesture-audit.mjs`, `tools/perf/app-audit.mjs`, `.github/workflows/ci.yml`.
- **Dependencies.** None. Do this before J-11a so each Atlas job can tighten a budget.
- **Acceptance criteria.**
  - Both scripts accept a budget file and exit non-zero when a budget is exceeded.
  - Budgets use deterministic counts first: base repaints and label commits per gesture, names on screen while holding as a share of after release, repaints on select and on rail collapse, rAF callbacks per second while a session runs, skeleton shown on navigation. Frame-time budgets are generous and advisory because CI machines vary.
  - Initial budgets equal today's values, so the job changes no behaviour and only prevents getting worse.
- **Verification.** CI run showing the budgets evaluated; a deliberate local regression (for example lowering `MIN_REPAINT_GAP`) fails the check.

### J-11a · Atlas: settle clock and repaint policy (P0)

- **Objective.** Remove the repaint storm (AT-2).
- **Affected systems.** `src/features/atlas/AtlasMap.tsx` (`setT`, `settle`, `stale`, `paint`, the wheel and glide loops), `camera.ts` if the clock is extracted.
- **Dependencies.** J-27.
- **Acceptance criteria.**
  - In `gesture-audit`, `counts-zoom-in` and `counts-zoom-out` report `basePaints ≤ 4` and `labelCommits ≤ 4` on all three shapes (was 4–9 and 3–8). **Done:** 2–4 and 1–2; the CI budget is 5 and 3.
  - Settle never runs while camera changes are still being requested; it runs once, within 200 ms of the last one.
  - A repaint never starts while one is outstanding.
  - No change to gesture behaviour: `atlas-check.mjs` passes 21 of 21; `camera.test.ts` passes.
  - The renderer rules in `CODEX_HANDOFF.md` §7 still hold.
- **Verification.** `gesture-audit` before and after; `atlas-check`; `smoke`; tighten the J-27 budgets to the new values.

### J-11b · Atlas: names and symbols while dragging (P0)

- **Objective.** The map is never unlabelled during a drag (AT-3).
- **Affected systems.** `AtlasMap.tsx` (`visible`, `labels`, the holding logic), `labels.ts` (overscan input, stable incremental placement).
- **Dependencies.** J-11a.
- **Acceptance criteria.**
  - `held-drag-zoomed`: names and symbols on screen while held are at least 80% of the count after release, on all three shapes (today 11–24%).
  - While a pointer is down, label layout runs at most once per 250 ms and only after the camera has moved at least half the overscan.
  - At least 90% of names visible at release keep their position (within 1 px) after the post-release layout.
  - Pan frame times do not regress: `pan-zoomed` p95 stays at one frame.
- **Verification.** `gesture-audit` (the `labelsWhileHeld` and `labelsAfterRelease` fields and the screenshots with `SHOTS=1`); `atlas-check`.

### J-11c · Atlas: overlay layer, tap, edges and resize (P0)

- **Objective.** Selection is instant; the map responds at contact; edges give; shell transitions do not repaint the map.
- **Affected systems.** `AtlasMap.tsx` (`Highlights`, tap handling, `clampT`, resize effect), `AtlasScreen.tsx` (insets).
- **Dependencies.** J-11a.
- **Acceptance criteria.**
  - Selecting a place causes zero base repaints and a worst frame of at most 50 ms on desktop (today one repaint, 417 ms).
  - A pressed state is visible on the touched symbol within one frame of `pointerdown`; the place card appears within 120 ms of release (today 276–330 ms). Double tap still zooms.
  - Dragging past a bound or pinching past a limit moves with resistance and springs back; at the default fit there is visible travel in every direction.
  - Fly-to keeps the target clear of overlays on all four sides, including the desktop inspector.
  - Collapsing the rail or toggling full screen over the map causes at most one base repaint (today 4–5).
  - Reduced motion: no spring-back animation; the camera simply stops at the bound.
- **Verification.** `gesture-audit` (`tapLatencyMs`); a small addition to the audit for select, rail collapse and full screen (the one-off script used for this audit can be folded in); `atlas-check`; `fullscreen-regression`.

### J-10 · Focus dial on the compositor (P0)

- **Objective.** A running session costs almost nothing between second ticks (FO-1, FO-2).
- **Affected systems.** `src/features/focus/TimerDial.tsx`, the progress bar in `ImmersiveFocus.tsx`, dial styles in `index.css`. The engine and store are not edited.
- **Dependencies.** None.
- **Acceptance criteria.**
  - `app-audit`: "focus running" at most 20 ms/s of main-thread work on desktop and at most 100 ms/s at 4× throttle (today 185–368 and 900–990). rAF callbacks at most 2 per second while running. "immersive running" within the same limits.
  - The arc and head are within 0.5% of `progress(timer, now)` at any moment, including after pause, resume, ±5 minutes, a phase change, and five minutes with the tab hidden.
  - The dial looks the same at rest in screenshots at 375, 768, 1366 and 1920 px in both themes; the running, paused and idle states remain distinct.
  - Reduced motion: the arc still advances; halo and breathing ring are off.
- **Verification.** `app-audit`; `engine.test.ts` unchanged and passing; a browser check that samples the arc angle against the engine at several points; `ui-audit` and `shots` for the Focus states.
- **Outcome.** Done, with the cost targets narrowly missed: 17–32 ms/s on desktop and 115–135 ms/s at 4× throttle, with no frame callbacks. The arc is two half rings turned behind clips and the head a third layer, each with one Web Animations transform animation as long as the phase; `tools/perf/dial-check.mjs` is the browser check. The remainder is J-10b.

### J-10b · Once-a-second readouts as leaf components (P1)

- **Objective.** A second tick re-renders only the digits that change.
- **Affected systems.** `TimerPanel` in `src/features/focus/FocusScreen.tsx`, `useTimerReadout` in `src/app/Shell.tsx` (rail and tab bar), `ExpeditionStrip.tsx`, `ImmersiveFocus.tsx`. Today each calls `useNow` at its top, so the whole panel, the dial's 60 ticks, the controls and the navigation re-render every second.
- **Dependencies.** J-10.
- **Acceptance criteria.**
  - `app-audit`: "focus running" and "immersive running" at most 20 ms/s on desktop and 100 ms/s at 4× throttle.
  - `useNow` is called only in components that render a time; their parents do not re-render on a tick (checked with the React profiler or a render counter in a dev build).
  - The QA accessible names and the single `role="timer"` are unchanged.
- **Verification.** `app-audit`; `dial-check`; `smoke`; `tars-check`.

### J-03 · Instant navigation and shell-first boot (P0)

- **Objective.** No skeleton on navigation; the frame of the app is on screen at first paint (NAV-1, PF-3).
- **Affected systems.** `src/app/App.tsx` (boot, route host, `lazy` declarations), `src/app/router.ts`.
- **Dependencies.** J-01 (boundaries around the route host).
- **Acceptance criteria.**
  - `app-audit` routes: every screen except the Atlas reports `skeleton: false` on first visit and at most 150 ms on desktop (today 330–644 ms with a skeleton).
  - The current screen stays visible until the next one can render.
  - Route chunks are requested during idle time after boot and on pointer-down or focus of a navigation item.
  - At cold start the rail or tab bar and the stage frame are part of the first contentful paint.
  - No change to deep links or one-shot parameters.
- **Verification.** `app-audit`; `smoke`; `tars-check`; `features-check`.

### J-28 · Start-up weight (P0)

- **Objective.** Home and Focus do not pay for the Atlas or for closed overlays (PF-1, PF-2, PF-4, PF-5, PF-6, PF-7).
- **Affected systems.** `src/tars/useContext.ts`, `src/atlas/data.ts`, `src/atlas/useExploration.ts`, `src/app/App.tsx` (overlay imports), `src/data/hooks.ts`, `src/timer/useNow.ts`, `src/audio/sounds.ts`, `index.css` (fonts), `vite.config.ts` (precache groups).
- **Dependencies.** J-03.
- **Acceptance criteria.**
  - `app-audit` cold start: `gazetteerRequestedAtMs` is after the Home heading, or null until first need.
  - Entry chunk at most 200 KB raw (today 279 KB) with closed overlays loaded on first open and preloaded on idle.
  - "home, session running" at most 10 ms/s on desktop and at most 80 ms/s at 4× throttle (today 17–36 and 146–442).
  - Labels, projects, profiles, goals, events and settings use shared live queries.
  - `og-image.png` is not precached; India assets remain in the first precache group and `job4-offline.mjs` passes.
  - Due-review counts on Home and in the palette are still correct once the gazetteer has loaded.
- **Verification.** `app-audit`; `bundle-profile.mjs`; `job4-offline.mjs`; `tars-check`; `vnext-learning`.

### J-04 · Tokens v2 and dead-code removal (P0)

- **Objective.** Define the vocabulary of §16 as tokens without changing any screen yet.
- **Affected systems.** `src/index.css`, `src/ui/motion.ts`, `src/lib/device.ts`, `src/lib/platform.ts`, `src/features/atlas/labels.ts`.
- **Dependencies.** None.
- **Acceptance criteria.**
  - Type roles, radius scale, elevation utilities, layer tokens, state-layer tokens, the four added semantic colours and the breakpoint and pointer tokens exist and are documented in a short section of the handoff.
  - Contrast assertions in `job4-visual.mjs` cover the new colours.
  - Dead code listed in DS-8 is removed; one `prefersReducedMotion`.
  - No visual change: `shots.mjs` screenshots before and after match.
- **Verification.** Screenshot comparison; `job4-visual`, `job4-control-contrast`; typecheck.

### J-05a · `Pressable`, `Button`, `IconButton`, `Chip`, gallery and DOM tests (P0)

- **Objective.** One implementation of press, hover, focus, disabled, loading and hit area.
- **Affected systems.** `src/ui/` (new `Pressable.tsx`, rebuilt `controls.tsx` exports), a hidden gallery route, Vitest configuration for a DOM environment under `src/ui/`.
- **Dependencies.** J-02, J-04.
- **Acceptance criteria.**
  - `Button`, `IconButton` and `Chip` keep their current props; no call site changes.
  - Press, hover and focus are a state layer animated by opacity plus a scale, using motion tokens only.
  - On coarse pointers every `Pressable` has a hit area of at least 44 × 44 px regardless of visual size.
  - Haptics are a prop with semantic values and fire once per activation.
  - The gallery route renders every primitive in every state in both themes.
  - DOM tests cover activation by pointer, Enter and Space, disabled and loading behaviour.
- **Verification.** New unit tests; `shots.mjs` of the gallery; `job4-control-contrast`; `features-check`.

### J-05b · `ListRow`, `Group`, `Progress` (P0)

- **Objective.** One row, one grouped container, one progress indicator.
- **Affected systems.** `src/ui/`; remove the unused `Row`.
- **Dependencies.** J-05a.
- **Acceptance criteria.**
  - `ListRow` supports leading, title, meta, trailing and nested actions without nesting interactive roles; three densities; selected and disabled states.
  - `Progress` has bar, ring and segmented variants, animates with transforms only, and exposes `role="progressbar"` values.
  - Gallery entries and DOM tests for keyboard activation and nested-action isolation.
- **Verification.** Unit tests; gallery screenshots.

### J-05c · `Tabs`, `SegmentedControl`, `Switch`, `Checkbox` (P0)

- **Objective.** Correct semantics and keyboard behaviour for selection controls.
- **Affected systems.** `src/ui/`; `Segmented` and `Toggle` become thin wrappers so call sites keep working.
- **Dependencies.** J-05a.
- **Acceptance criteria.**
  - `Tabs`: `tablist`, `tab`, `tabpanel`, roving tabindex, arrow keys, Home and End, overflow fade.
  - `SegmentedControl`: radio-group semantics and arrow keys.
  - `Switch`: thumb reacts to press and can be dragged; an optional full-row label target.
  - `Checkbox`: the task tick animation as a reusable component with a 44 px target.
  - The QA scripts that select `role="tab"` (India and World, timer modes) still pass.
- **Verification.** DOM tests for keys and roles; `atlas-check`; `features-check`.

### J-05d · Field family (P0)

- **Objective.** One field frame for text, search, select, date, time and slider.
- **Affected systems.** `src/ui/`; `TextInput`, `TextArea`, `Select` keep their exports.
- **Dependencies.** J-05a.
- **Acceptance criteria.**
  - All fields share height per density, radius, focus ring and disabled style; the select chevron follows the theme.
  - `DateField` and `TimeField` wrap the native inputs so the platform pickers still open.
  - `Slider` has a styled track and thumb, keyboard support and a value label.
  - `SearchField` has a leading icon, a clear button and an optional shortcut hint.
- **Verification.** Gallery screenshots in both themes; DOM tests for labelling and keyboard.

### J-06 · Motion tokens v2 and reduced motion (P0)

- **Objective.** Motion roles as the only source of timing, and a reduced-motion mode that cross-fades instead of cutting.
- **Affected systems.** `src/ui/motion.ts`, `src/index.css`, `src/app/App.tsx` (`MotionConfig`), Settings (the motion choice), `index.html` (pre-paint attribute).
- **Dependencies.** J-04.
- **Acceptance criteria.**
  - The roles in §17.3 are exported; the fifteen inline transitions listed in MO-1 use them.
  - `data-motion` on `<html>` reflects System, Reduced or Full and is set before first paint.
  - The global `*` reduced-motion rule is replaced by per-role rules; under reduced motion, surfaces cross-fade, progress still moves, loops are off, and a loading indicator is still recognisable.
  - `AnimatePresence mode="wait"` is removed from the quiz.
- **Verification.** A browser check with `prefers-reduced-motion` emulated that asserts no transform animations run and that a sheet still fades; lint count of numeric timings outside `src/ui/` is zero for Motion props.

### J-07a · Surface core, `Dialog` and `BottomSheet` (P1)

- **Objective.** A shared core for layered surfaces, and a bottom sheet with detents.
- **Affected systems.** `src/ui/Sheet.tsx` (kept as a compatible wrapper), new `src/ui/surface/`.
- **Dependencies.** J-05a, J-06.
- **Acceptance criteria.**
  - Existing `Sheet` call sites work unchanged.
  - The core owns the layer stack, focus trap, initial focus without a timer, focus restore, scroll lock, `inert` on the background and dismissal rules.
  - `BottomSheet` supports named detents, dragging from the header and from scrolled-to-top content, velocity-based settling and a non-modal mode in which the page behind stays interactive.
  - Content changes inside an open surface cross-fade and the height animates by transform.
- **Verification.** DOM tests for focus and dismissal; `ui-audit` for every dialog at four widths; `smoke`.

### J-07b · `Popover`, `Menu`, `Tooltip` (P1)

- **Objective.** One positioning and dismissal core for anchored surfaces (OV-3).
- **Affected systems.** `src/ui/Popover.tsx`, `src/ui/Menu.tsx`, new `Tooltip`; the rail tooltip and the Atlas layers popover migrate.
- **Dependencies.** J-07a.
- **Acceptance criteria.**
  - Collision-aware placement in a portal; closes on outside press and Escape; returns focus.
  - `Menu`: arrow keys, Home and End, type-ahead, focus moves in on open.
  - `Tooltip`: 400 ms delay, instant when moving between adjacent triggers, shown on keyboard focus, never on touch; `IconButton` uses it in place of `title`.
- **Verification.** DOM tests; `atlas-check` (layers); `features-check` (rail).

### J-07c · `SidePanel` and Back integration (P1)

- **Objective.** A panel beside the content on wide layouts, and Back that closes the top surface (NAV-3).
- **Affected systems.** `src/ui/surface/`, `src/app/router.ts`, `src/app/App.tsx` (Capacitor back handler), `src/app/Workspace.tsx` (Back arrow).
- **Dependencies.** J-07a.
- **Acceptance criteria.**
  - Opening a modal surface adds a history state; browser Back, the Android back button and Escape all close the top surface and nothing else.
  - With no surface open, Back pops in-app navigation; the Back arrow never leaves the app.
  - `SidePanel` enters from the trailing edge of the stage, is resizable, and leaves the content beside it interactive.
- **Verification.** A browser check that opens a sheet, calls `history.back()` and asserts the route did not change; manual check in the Android shell (J-30).

### J-08 · Route state, scroll restoration and Atlas keep-alive (P1)

- **Objective.** Every workspace is as you left it (NAV-2, AT-8d).
- **Affected systems.** `src/app/App.tsx`, new `useRouteState`, each screen's view state, `AtlasScreen.tsx`.
- **Dependencies.** J-03.
- **Acceptance criteria.**
  - Leaving and returning restores scroll position, selected tab, filters, calendar anchor and view, Insights range, and the Atlas sheet, camera and selection.
  - Re-selecting the current tab scrolls to the top and resets transient filters.
  - `app-audit`: second visit to the Atlas at most 100 ms on desktop (today 160–1,329 ms).
  - A hidden Atlas runs no animations and holds no pointer listeners.
- **Verification.** `app-audit`; a browser check that scrolls Plan, visits the Atlas, returns and compares scroll position; `fullscreen-regression`.

### J-09 · Shell alignment (P1)

- **Objective.** Title, actions and tabs sit in one place on every screen; the rail collapses without layout animation; phone navigation is accurate (NAV-4, NAV-5, NAV-6, MO-3).
- **Affected systems.** `src/app/Workspace.tsx`, `src/app/Shell.tsx`, `src/index.css` (shell section), `src/features/tasks/PlanTabs.tsx`, Home and Focus headers.
- **Dependencies.** J-05c.
- **Acceptance criteria.**
  - The workspace title's left edge is at the same x position on every non-Atlas route at 1366 and 1920 px.
  - Rail collapse and full-screen chrome animate with transforms; no layout runs during the transition except once at the end.
  - On phones, no tab is selected on Notes, Insights or Settings; they show a Back that uses in-app history.
  - Plan tabs use `Tabs` with an overflow fade; on compact widths the less-used views sit behind one "Lists" entry.
- **Verification.** A screenshot script that records the title's bounding box per route; `ui-audit`; `features-check` (sidebar persistence); `smoke`.

### J-23 · Atlas: extract gestures and renderer modules; spike (P1)

- **Objective.** Make the Atlas testable and choose the compositing and label approach with data.
- **Affected systems.** `src/features/atlas/` (new `renderer/` folder), tests.
- **Dependencies.** J-11a–c.
- **Acceptance criteria.**
  - `gestures.ts` reproduces the current behaviour with unit tests for: pan, fling, pinch, pinch-to-pan handover, wheel notch easing, trackpad zoom, double tap, two-finger tap, keyboard.
  - `AtlasMap.tsx` is under 600 lines; no behaviour change (`atlas-check` 21 of 21; `gesture-audit` within noise).
  - A spike under `tools/` (not shipped) measures at the phone shape: tile containers moved by CSS transform versus one canvas redrawn per frame; unscaled HTML names positioned per frame versus bounded scaling with re-layout. The results and the decision are written to the handoff.
- **Verification.** New unit tests; `gesture-audit`; spike numbers recorded.

### J-24 · Atlas: tile worker, cache and base layer (P1)

- **Objective.** Vectors are never rasterised on the frame path (AT-1).
- **Affected systems.** `src/features/atlas/renderer/` (`tiles.ts`, `tileWorker.ts`, `tileCache.ts`, `BaseLayer.tsx`), `src/atlas/sheet.ts` (chunked geometry output).
- **Dependencies.** J-23.
- **Acceptance criteria.**
  - `gesture-audit` on all three shapes: continuous zoom p95 at most 20 ms on desktop and at most 34 ms at the phone shape; zero frames over 100 ms; worst frame at the end of a pan at most 50 ms.
  - The map is never blank: lower- or higher-level tiles show until the wanted level is ready, then cross-fade.
  - Physical, Political, Night and Antique styles match the SVG renderer in a pixel comparison at three zoom levels within an agreed tolerance; boundary layers are included in the comparison.
  - Tile cache is bounded (about 24 tiles on low-power devices, 48 otherwise) and releases bitmaps on eviction; JS heap after the gesture run does not grow beyond today's 22–26 MB by more than 20%.
  - Main-thread fallback works where `OffscreenCanvas` in a worker is unavailable.
  - Offline behaviour is unchanged (`job4-offline.mjs`).
- **Verification.** `gesture-audit`; pixel-comparison script; `atlas-check`; `vnext-learning` (both themes); `smoke`; `job4-offline`.

### J-25 · Atlas: label layer (P1)

- **Objective.** Names keep their size and position at every instant on every device (AT-4).
- **Affected systems.** `renderer/LabelLayer.tsx`, `labels.ts`.
- **Dependencies.** J-23 (decision), J-11b.
- **Acceptance criteria.**
  - During a pinch no name changes rendered size by more than 10% on any shape.
  - Per-element style writes during a zoom gesture are zero, or positioning costs at most 2 ms per frame on desktop and 6 ms at 4× throttle (whichever approach the spike chose).
  - Names fade in individually; none appear en masse.
  - The handoff's label rules still hold or are replaced by tested equivalents.
- **Verification.** `gesture-audit` (style writes, style time); a screenshot sequence during a pinch.

### J-15 · Atlas chrome (P1)

- **Objective.** The Atlas's surfaces match their jobs (§9.2, RS-2).
- **Affected systems.** `AtlasScreen.tsx`, `PlaceDetails.tsx`, `UnitDetails.tsx`, `AtlasPanel.tsx`, `Gazetteer.tsx`, `Legend.tsx`, `ExpeditionSheet.tsx`, `OfflineAtlas.tsx`.
- **Dependencies.** J-07a–c, J-05b, J-11c.
- **Acceptance criteria.**
  - Desktop: the inspector is a `SidePanel` with enter and exit motion; search is anchored under the search button and previews results on the map as they are arrowed through; layers and legend are popovers.
  - Phone: one detented `BottomSheet` replaces the fixed card and the modal details sheet; the map stays interactive behind it and re-centres above it; the toolbar is one row.
  - `Escape` deselects, then closes the inspector.
  - No raw buttons remain in these files; touch targets under 44 px on the Atlas route are zero in `app-audit`.
  - The Legend reads colours from `style.ts`.
- **Verification.** `atlas-check`; `vnext-learning`; `job4-state-matrix`; `ui-audit`; `app-audit` touch targets.

### J-18b · One question surface (P1)

- **Objective.** Recall and exam questions share one interaction (OV-2).
- **Affected systems.** `FieldReview.tsx`, `CanonicalQuiz.tsx`, `PyqBrowser.tsx`, `PlaceQuestions.tsx`, new `src/ui/patterns/question/`.
- **Dependencies.** J-05a, J-06, J-07a.
- **Acceptance criteria.**
  - One `AnswerTile` with idle, hover, pressed, selected, correct, incorrect and disabled states; letter keys and `1–4` select; Enter submits or advances.
  - Canonical questions run as a sequence with previous and next, and closing returns to the list position it came from.
  - Full screen on compact widths; a focused panel on wide layouts with the map visible for locate questions.
  - Durability rules are unchanged: feedback appears only after a durable save, attempts lock after save, accepted answers come only from the packs, no generated explanations.
  - Loading uses skeletons of the final layout.
- **Verification.** `vnext-learning` (104 checks, both themes); `job4-visual` (every question type); `job4-actions`; `canonical-pyq-audit`.

### J-12 · Task editor as a side panel; inline editors (P1)

- **Objective.** Objects open beside their list on wide layouts (OV-1, NAV-7).
- **Affected systems.** `TaskSheet.tsx`, `TasksScreen.tsx`, `QuickCapture.tsx`, the project, habit, goal, event, session and label editors.
- **Dependencies.** J-07a–c, J-05d.
- **Acceptance criteria.**
  - From 1024 px the task editor is a side panel; the list stays visible, scrolls, and selecting another task swaps the panel's content.
  - Scheduling a focus block is a step inside the panel, not a second modal.
  - Small editors open as popovers or inline on wide layouts and as sheets on compact.
  - Saving on close shows a brief saved indication.
  - The names `New task`, `Edit task` and the footer actions used by QA scripts are preserved.
- **Verification.** `features-check`; `job4-actions`; `ui-audit` (dialog states); `tars-check`.

### J-13 · Plan lists on primitives (P1)

- **Objective.** Task rows are structurally correct, tactile and immediate.
- **Affected systems.** `TaskItem.tsx`, `TasksScreen.tsx`, `QuickAdd.tsx`, `HomeScreen.tsx` and `FocusScreen.tsx` where they list tasks.
- **Dependencies.** J-05b, J-05c.
- **Acceptance criteria.**
  - The row is a list item with a title button and sibling action buttons; no nested interactive roles; Enter and Space both work.
  - Completion writes immediately; the row's exit animation carries the tick; Undo still works; a row that unmounts mid-animation is still completed (RL-8).
  - "Move all to today" is one transaction (RL-7).
  - On touch: swipe to complete and to schedule, long-press to reorder with a 44 px handle.
  - No raw buttons remain in these files.
- **Verification.** `features-check`; `job4-actions`; `job4-control-contrast`; planner tests; `app-audit` touch targets for Home, Plan and Focus.

### J-14 · Focus surfaces (P1)

- **Objective.** The session flow has no modal interruptions (FO-3, FO-4, FO-5).
- **Affected systems.** `FocusScreen.tsx`, `SessionCompleteSheet.tsx`, `ContextSheet.tsx`, `ProfileSheet.tsx`, `SoundSheet.tsx` entry points.
- **Dependencies.** J-07a–b, J-10.
- **Acceptance criteria.**
  - Completion appears in the dial region on the Focus screen (a low-detent sheet on phones); the sheet is used only when the session ended on another screen. Rating, note, task completion and "Start break" all work from it.
  - Stop saves immediately with an Undo toast that offers "Discard instead", or the controls morph to Save and Discard; no backdrop.
  - Context, profiles and sounds open as popovers from their controls on medium and expanded widths.
  - The names `Start focus…`, `Pause`, `Resume`, `Stop the timer`, `Timer profile: …`, `What are you working on?`, `Sounds (S)`, `Immersive mode (F)` are preserved.
- **Verification.** `smoke`; `features-check`; `tars-check`; `ui-audit` Focus states.

### J-16 · Settings and Soundscape on primitives (P1)

- **Objective.** Bring two drifted surfaces onto the system.
- **Affected systems.** `SettingsScreen.tsx`, `LabelsManager.tsx`, `SoundSheet.tsx`, `MusicDock.tsx`.
- **Dependencies.** J-05b–d.
- **Acceptance criteria.** Full-row switches; `Slider` for volumes; `ListRow` action rows with press states; the preset delete control is reachable on touch; no raw buttons; touch targets under 44 px on Settings are zero.
- **Verification.** `ui-audit`; `features-check` (sound follows the timer); `app-audit` touch targets.

### J-16b · Current Affairs on primitives (P1)

- **Objective.** The reading list looks and feels like the rest of TARS and fits more on a phone (RS-3, MO-7).
- **Affected systems.** `CurrentAffairsScreen.tsx`, `ReadingAnalytics.tsx`, `NotesSheet.tsx`, `workspace.css`.
- **Dependencies.** J-05a–d, J-07a–b.
- **Acceptance criteria.**
  - Tabs, search, selects and buttons are primitives; filters open in a popover (sheet on compact); analytics reveals with motion.
  - On compact widths rows show one overflow action and support swipe to mark read and to save; at 375 px at least five articles fit on the first screen (today about three).
  - Every `data-*` hook and accessible name used by `current-affairs-check.mjs` is preserved, including `Short notes`.
- **Verification.** `current-affairs-check.mjs` (279 checks); `ui-audit`.

### J-17 · Calendar and Habits on primitives, with keyboard (P1)

- **Objective.** The calendar is operable by keyboard and responds to touch (AX-4).
- **Affected systems.** `CalendarScreen.tsx`, `EventSheet.tsx`, `HabitsView.tsx`.
- **Dependencies.** J-05b, J-07b.
- **Acceptance criteria.** Arrow keys move through time slots and Enter creates; event blocks are `Pressable` with no nested interactive element; the month grid uses `Group`; the emoji is replaced by an icon; habit day cells are 44 px targets.
- **Verification.** `ui-audit`; `tars-check` (Calendar → Focus); DOM tests for grid keys.

### J-18 · Delete with Undo (P1)

- **Objective.** Apply the product's own rule to the six remaining confirm dialogs (OV-4).
- **Affected systems.** `EventSheet.tsx`, `GoalsSection.tsx`, `SessionSheet.tsx`, `LabelsManager.tsx`, `HabitsView.tsx`, `TasksScreen.tsx` (project).
- **Dependencies.** None.
- **Acceptance criteria.** Each delete happens at once with an Undo toast that restores the record and its dependents (habit logs, tasks' project link) exactly; tombstones are removed on restore; "Replace everything" and "Erase all data" keep their dialogs.
- **Verification.** Data tests for remove and restore round trips; `features-check` (undo).

### J-29 · Accessibility pass (P1)

- **Objective.** Close the findings in §12 not already closed by primitives.
- **Affected systems.** `AtlasMap.tsx` and `AtlasScreen.tsx` (in-view list, `h1`), `charts.tsx` (heading levels), `ImmersiveFocus.tsx`, `TaskItem.tsx` and `UnitDetails.tsx` (non-colour cues), `index.css` (session dim).
- **Dependencies.** J-07a, J-15.
- **Acceptance criteria.** The map exposes a focusable list of places in view and announces selection; every route has one `h1` and no skipped levels; immersive mode traps focus and hides the app beneath; priority and mastery have non-colour cues; an automated accessibility scan of every route and open dialog reports no serious violations.
- **Verification.** An accessibility scan added to `ui-audit`; a manual screen-reader pass of Focus, Plan and the Atlas.

### J-30 · WebKit and device verification (P1)

- **Objective.** Establish what holds outside Chromium (RL-6).
- **Affected systems.** `tools/perf` (a WebKit run), a short device checklist in `docs/`.
- **Dependencies.** Runs alongside P1; repeat after J-24.
- **Acceptance criteria.** `smoke` and `ui-audit` pass in WebKit; a recorded manual pass on one iPhone and one Android phone covering the timer through sleep, sheets with the keyboard open, the Atlas gestures, full screen, and offline reload; every difference is fixed or listed in the handoff.
- **Verification.** The checklist with results and screenshots.

### J-19 · Toasts and palette (P2)

- **Objective.** Feedback appears where the thumb is and can always be undone.
- **Affected systems.** `src/ui/feedback.tsx`, `src/ui/toast.ts`, `src/app/CommandPalette.tsx`, `src/tars/commands.ts`.
- **Dependencies.** J-05a, J-06.
- **Acceptance criteria.** Bottom placement above the tab bar on compact widths; pause on hover and focus; swipe to dismiss; timers cleared on dismiss; "Undo last action" and recent items in the palette.
- **Verification.** DOM tests; `features-check` (undo, palette).

### J-20 · Tactile details (P2)

- **Objective.** The last layer of physical feel.
- **Affected systems.** `src/ui/`, `HomeScreen.tsx`, `TodayLine.tsx`, `FocusScreen.tsx`.
- **Dependencies.** J-05a–d.
- **Acceptance criteria.** Stepper repeats with acceleration while held; slider has detent haptics; colour picker has arrow keys; the Home "Now" surface is one target; the Today block opens Insights; the start control's ripple and breathing ring are reusable `Pressable` effects; the map shows grab and grabbing cursors.
- **Verification.** DOM tests; screenshots of the gallery.

### J-21 · Loading, empty and data-rich states (P2)

- **Objective.** Nothing appears from text placeholders or jumps into place.
- **Affected systems.** `App.tsx` (skeleton), Atlas loading, `charts.tsx`, `NotesScreen.tsx`, `EmptyState`.
- **Dependencies.** J-05b, J-06.
- **Acceptance criteria.** Skeletons match the destination layout for the Atlas, Insights and Current Affairs; chart columns are tappable and open that day, tooltips animate and follow arrow keys; notes insert and remove with list motion; drafts autosave.
- **Verification.** `ui-audit`; screenshots with network throttling; DOM tests for chart keys.

### J-22 · Immersive and onboarding transitions (P2)

- **Objective.** The two changes of mode feel like one continuous move (FO-6, OV-7).
- **Affected systems.** `ImmersiveFocus.tsx`, `TimerDial.tsx`, `Onboarding.tsx`.
- **Dependencies.** J-10, J-06, J-07a.
- **Acceptance criteria.** The dial digits grow into the immersive clock and back; immersive uses tokens and shared controls; hidden controls are `inert`; onboarding is a full-screen first run that only an explicit action can skip; reduced motion replaces both with cross-fades.
- **Verification.** `fullscreen-regression`; `smoke`; screenshots.

### J-26 · Atlas stage C: detail (P3)

- **Objective.** Zooming in reveals information (AT-6).
- **Affected systems.** `tools/atlas-build` (relief pyramid, simplification levels), `tools/build-atlas-assets.mjs` (packs), `renderer/tiles.ts`, label thresholds.
- **Dependencies.** J-24; the regional-pack and precache policy; user approval for added data.
- **Acceptance criteria.** A second relief level and at least two geometry levels for India; the first precache group does not grow; packs install, verify by hash and remove cleanly; at the new maximum zoom one relief pixel covers at most two device pixels at 2×; all 2,273 place ids and the controlled depiction are unchanged.
- **Verification.** Pipeline tests; `job4-integrity`; `job4-offline`; `gesture-audit`; visual review at each level.

---

## Appendix · Measurement method

| Script | What it measures | Notes |
| --- | --- | --- |
| `tools/perf/gesture-audit.mjs` | Atlas: frame intervals and long animation frames per gesture; base repaints, label commits and per-name style writes (via a `MutationObserver`, in separate passes so the observer does not affect timing passes); names and symbols on screen while a drag is held and after release; tap-to-card time; a trace summary of main-thread and raster time for one zoom in, one zoom out and one long pan | Three shapes. `SHOTS=1` saves the held-drag screenshots. Pointer input is real CDP mouse and touch input, not synthetic DOM events. |
| `tools/perf/app-audit.mjs` | Main-thread work per second on Focus (idle, running, immersive) and on Home with a session running; route-change time and whether a skeleton was shown; cold-start milestones and when the gazetteer is requested; touch targets under 44 px per route at 375 px | Two shapes. |
| One-off checks (not kept in the repository) | Cost of a single forced repaint with groups of the base layer hidden (§7.3); repaints during rail collapse, full screen, selection and sheet switch (MO-3, AT-5) | Worth folding into `gesture-audit.mjs` as part of J-27. |

The JSON files in `out/` hold the most recent run of each script. The ranges quoted in this document combine two Atlas passes on the desktop shape, one on each of the other shapes, and three passes of the app audit; the earlier passes are recorded here, not on disk.

Frame times were sampled with `requestAnimationFrame`. A long frame with little script time and no long task means the main thread was waiting for the compositor, which the traces confirm as raster work in the GPU process. The built-in browser pane of the development tool was not used for timing: while hidden it presents frames at 1 Hz, which would have produced false results.

