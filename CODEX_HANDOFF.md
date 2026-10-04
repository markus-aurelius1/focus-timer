**Current owner deployment authorization — 2026-10-05:** prepare one release checkpoint, push only `handoff/claude-overhaul`, and deploy the accepted Atlas/News/Settings application to Cloudflare Pages. Application behavior stays frozen; no performance work or J-25. No authentication configuration. Earlier publication prohibitions below describe prior tasks and are superseded for this deployment only.

**Current owner release freeze (2026-10-04): STOP PERFORMANCE WORK.** Application source is accepted and frozen. Do not investigate J-25, run renderer/compositor experiments or retry the current host's gesture gate. Application accepted for private Cloudflare deployment with a documented synthetic gesture-benchmark exception on the current host. Existing gesture budgets remain unchanged for future validation on a stable/physical device. Preserve all four measured failures and profiling reports. Run only typecheck/lint/unit/build/smoke/current-affairs-check/atlas-check/product-health, record the release decision and deployment handoff, then stop. No deployment, authentication configuration, commit or push in this task. Current decision: `docs/TARS-PRODUCTION-READINESS.md`; next-task deployment facts: `docs/TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md`.

**Historical J-24 checkpoint (2026-10-04): timing gate failed.** The owner subsequently stopped performance work and accepted the private-release exception above. Final complete stock-Chrome unrestricted audit fails 4/33 unchanged limits (phone zoom-in >100ms frames, zoom-out p95/>100ms frames, pan-back 50.1ms). All requested functional/core/parity suites pass. Verified suppression of all tile worker/GPU presentation work still leaves phone zoom-out at 66.7ms p95; suppressing protected label work yields 16.9ms for both zoom directions. Independent empty-page and tile-free pan pauses establish an additional external timing source. No replacement architecture is implemented or authorized. All 550 entry non-document hashes match. Full historical commands, raw cohorts and limitations: `docs/TARS-J24-GESTURE-REPAIR.md`. No commit, push or deployment.

**Historical final production-readiness contract before the J-24 authorization (2026-10-04):** continue the authoritative local edits; do not restart or revert Phase 1. Atlas/News/Settings/shared search only. Desktop has a 56px top bar; mobile has a 52px top bar and 56px Atlas/News bottom switcher, plus safe areas. Desktop News uses a 180px collection rail and the remaining width for editorial rows. This supersedes the earlier 48px/no-bottom-navigation density arrangement. Existing renderer repairs are retained; renderer/camera/labels/tile/cache, canonical data/PYQs/grading/history, migrations and IDs were protected again. The newer J-24 authorization above supersedes only that job's scope restriction. No gate waiver, commit, push or deployment. Presentation verification: `docs/TARS-PRODUCTION-READINESS.md`.

# CODEX_HANDOFF.md — Tars (Atlas · News)

Last updated: 2026-10-04 (final production-readiness pass). HEAD remains `43560abe415292e7c548f4180bab0c463265a6fd` on `handoff/claude-overhaul`. This pass began with the existing modified local tree, which remains authoritative and uncommitted. No commit, push, PR or deployment is authorized. Older checkpoints below are historical. Current evidence: `docs/TARS-PRODUCTION-READINESS.md`.

**Maintenance rule (for every agent; the full protocol and the "done" checklist are in `AGENTS.md`):** update this file as part of any change: features, fixes, refactors, dependencies, config or design decisions. Edit the relevant section; do not rewrite the whole file. If the change touches a feature that produces user-facing content, update that feature's entry in §4 so it states the **current standard**, not only that the feature exists. Add one line to §6. `docs/HANDOFF.md` is the older, longer milestone log (measurements, user requirements per milestone); keep the two consistent. Verify every claim here against the code before relying on it.

---

## 0a. Current product contract – 2026-10-04 (read this first)

**Local News preview diagnosis (2026-10-04):** the preview started inside the restricted Codex execution environment could serve local assets but its outbound publisher fetches failed with `EACCES`, producing HTTP 503 / `All publishers are unavailable` for all 39 feeds despite the browser being online. The same Guardian/Indian Express RSS probes returned HTTP 200 outside that environment. Restarted the owned preview at `http://127.0.0.1:4174/` with network-enabled execution (`npm run preview -- --host 127.0.0.1 --port 4174 --strictPort`) and refreshed the existing in-app News tab: real publisher articles load, 27 current rows shown. Some individual sources remain unavailable. No application-code change, user-state reset or cache deletion. This environment repair does not resolve the separate fixture 503-cache regression. Proof: `tools/perf/out/density/live-news-restored.png`.

**Historical density correction, 2026-10-04 (superseded by the final contract above):** content takes priority over chrome. Preserve Phase 1 tokens/themes/fonts. Phase 2 uses one 48px top bar with Atlas/News navigation at every width and safe-area clearance; no mobile bottom navigation. Phase 3 uses a compact News header/state tabs, search expanded on demand, filters/Sources in a contextual sheet/dialog and dense editorial rows. Phase 4 uses one small World/India + search + options strip, compact zoom, and no persistent bottom utility dock. Legend, fit, hotspots, fullscreen, review and Atlas tools remain inside Map options. Existing contextual inspectors, data and personal state remain. This supersedes earlier spacious layout instructions. Final density177/editorial267/Atlas21/fullscreen4/smoke100 checks, 229 unit tests, typecheck/build and lint pass. News passes 247 checks before its existing 503-cache assertion fails again, including in isolation; offline-cache and earlier renderer acceptance are not waived. Evidence: `docs/TARS-DENSITY-CORRECTION.md`.

**Final verification: BLOCKED.** Core, News, presentation, offline, recovery, recall, labels (phone Light 2.3ms / Dark 1.4ms) and GPU/native fallback parity (24 states) pass. Hard gesture timing fails 16/33 limits versus 13/33 at entry; phone zoom p95 is 36.0/36.1ms versus ≤34ms and pan maxima still exceed 50ms. Full commands, provenance and exact blockers: `docs/TARS-PRODUCTION-READINESS.md`. The historical 10 ms phone label failure is superseded by current passing measurements. No threshold waiver, commit, push, PR or deployment. The final pass includes only a two-line renderer fallback repair: clear GPU readiness/remove the stale texture when a packed plane exceeds the retained pixel budget.

**Latest 2026-10-04 owner instruction: implement the Editorial Cartography presentation/interaction redesign.** This supersedes the earlier pause for UI work only. Preserve the local tree, renderer/camera/label/tile/cache subsystem, canonical data/PYQs/grading, stable identities, Dexie migrations and personal history. J-23 remains accepted; J-24/J-25 are protected and unaccepted. The later News delta removes all active Notes UI and keeps its stored state dormant. No commit/push/PR/deployment, dependencies or migrations. Evidence: `docs/TARS-EDITORIAL-REDESIGN.md`; earlier renderer repairs remain recorded in `docs/TARS-ATLAS-RUNTIME-FIX.md`.

Tars has two primary products: **Atlas | News**. Desktop uses a 56px top bar; phones use a 52px top bar and 56px Atlas/News bottom switcher. Safe-area insets are additional. Settings and global search remain auxiliary; no permanent shell sidebar. Desktop News has a 180px collection rail and wide article list. Landing/unknown/retired routes canonicalize to `#/atlas`; visible News retains `#/current-affairs`. Midnight Atlas and Ivory Atlas retain semantic roles, locally licensed Geist/Newsreader and protected Manrope map metrics; secondary/feedback text colours are corrected for contrast. Atlas keeps its existing mounted lifecycle and stacking isolation. No renderer replacement. The narrowly required fallback fix invalidates stale GPU presentation when packing falls back to native tiles; no camera, label, painter or cache-budget change.

Place selection opens an opaque right inspector (400–432px, 24px edge spacing) or non-modal mobile sheet (144/420/available-height detents); idle has no empty panel. Existing facts, relationships, PYQ links and recall mastery remain. Canonical and native recall use a single focused question surface (560px desktop/full mobile), existing grading/history, native controls/AnswerTile, text/icon answer verdicts and keyboard shortcuts. Settings shows Appearance, Atlas, News, General and existing Data/install controls. Native Back joins the existing surface stack.

**Atlas rendering contract (2026-10-04 repair):** worker river bitmaps remain owned by the committed label layout. Canvases copy pixels without consuming the bitmap; the owner closes superseded/stale/unmounted resources, not the currently visible snapshot. StrictMode effect replay and direct cold starts must render painted river lettering with no boundary/console errors. This is a regression repair, not J-24/J-25 acceptance.

**Atlas paint order (2026-10-04 second regression):** the `.atlas-base` container establishes its own stacking context with `isolation: isolate`. Overview/detail/studied tile z-indices order rasters inside that container; they must never cover sibling SVG symbols or HTML labels. Verify actual paint order, not just DOM counts or computed opacity, before/during/after zoom and India/World switches. The browser regression runs at 1920/1366/390 px in both themes.

**Removed:** Focus pages/timer engine/store/reconciliation/session writes; Pomodoro, profiles, onboarding, Focus analytics, ambient audio/music/wallpapers/quotes, reminders/notifications/wake lock; Planning/tasks/calendar/habits/goals/quick capture and standalone Home/Notes/Insights surfaces; timer expeditions/base camp/revision tasks/travel overlay and Focus-time XP/challenges. Removed exclusive packages: Capacitor keep-awake/local-notifications and dexie-react-hooks. Web/native launcher shortcuts now point to Atlas and News. Obsolete feature browser harnesses and their CI invocations were replaced with the reduced product regression.

**Retained shared infrastructure:** shell-first/deferred loading, kept Atlas, commands, route state, UI/motion/AnswerTile/surfaces, themes/haptics/fullscreen/install, lifecycle/files, Dexie/repo/tombstones/sync, v1–v3 JSON backup/restore, News note hook/storage/archive and publisher gateway. Atlas map/entities/ids/PYQs/questions/filters/offline inventory stay intact. Mastery/coverage/XP use recall history; existing daily review and weekly recall/pass challenges remain. Historical Focus/expedition/discovery challenge claims remain stored but no longer contribute to active XP. Warm coverage styling now denotes recall familiarity. No replacement gamification was introduced.

**Database decision:** `lodestar` Dexie v1/v2 declarations and migrations are unchanged. Historical sessions/tasks/profiles/calendar/goals/habits/audio/expeditions and their types remain for compatibility, sync and export. Their runtime hooks/seeding/initializers are gone. Existing settings fields and raw `tars.timer.v1` / `lodestar.timer.v1` / audio keys remain untouched and unused; fresh installs seed shared settings only. Explicit user-requested backup replacement/erase continues its existing confirmation flow. News reading state/notes/archive and quiz-attempt persistence retain their current stores/keys/backup behavior. Generated Atlas source still contains inert expedition metadata; no runtime expedition index, hook or action reads it. All 2,273 place ids and canonical data remain unchanged.

**Current output specs (supersede historical entries below):** News is an editorial RSS publisher-link collection with Today, To Read, Read, Saved, Archive, Sources, search and filters. Headline/Open Original open the canonical URL directly in the established safe external context. No Notes controls/editor/pane, internal reader, article-detail surface, publisher embed or scraped body. Article-note and dated-note stores are untouched and dormant. RSS classifier/feed/archive and Read/Saved precedence/persistence are unchanged. Atlas factual/PYQ provenance, mastery and due recall rules/ids remain unchanged. Existing exports preserve historical records and old backup compatibility. No removed products in active navigation/commands.

Validation and dependency map: `docs/TARS-ATLAS-NEWS-REDUCTION.md`. Browser results below are historical unless explicitly listed in that document. Changes remain uncommitted and pre-existing Atlas work is preserved.

## 0. Historical handoff checkpoint – 2026-10-02

Claude stopped the premium-roadmap overhaul here at the owner's request and handed over to Codex. This section is the state of play; §5a has the per-job detail and measurements, `docs/TARS-PREMIUM-PRODUCT-AUDIT.md` §23 has every job's definition and acceptance criteria.

**Repository state when this was written**

- Working copy: `C:\Users\hario\Downloads\T.A.R.S\focus-timer`, remote `origin` = `https://github.com/markus-aurelius1/focus-timer.git`.
- Base: branch `main`, HEAD `1e79fedfe986060b19e84c305f83e579e6b7b659` ("Tars vNext: Complete learning and Current Affairs workspace").
- Everything since then was uncommitted on `main`: 173 paths in `git status` (about 107 tracked files changed, +7,328 / −3,971 lines, plus 66 new untracked paths and 5 deletions). It contains, in order of age: the app-shell UI overhaul and Current Affairs cleanup (both from before the roadmap), then the roadmap jobs listed below.
- The checkpoint is one commit of that whole tree on the branch `handoff/claude-overhaul`. `main` itself is not moved. Nothing was deployed.
- Not in git, by design: `tools/perf/out/` (screenshots and audit JSON, 369 MB), `dist/`, `node_modules/`, `pyq-sources/`, `.env*`.

**Roadmap position**

The audit's execution order is: J-01, J-02, J-27, J-11a, J-11b, J-11c, J-10, J-10b, J-03, J-28, J-04, J-05a–d, J-06, J-07a–c, J-08, J-09, J-23, J-24, J-25, J-15, J-18b, J-12, J-13, J-14, J-16, J-16b, J-17, J-18, J-29, J-30, J-19, J-20, J-21, J-22, J-26.

- **Checkpoint reached:** everything up to and including **J-09** was done, plus J-16, J-18 and J-19 from further down. **Codex continuation, 2026-10-03:** J-23 accepted; J-24 and the owner-approved necessary J-25 label work are in progress. Neither has passed final acceptance. Details: `docs/TARS-PREMIUM-J23.md`, `docs/TARS-PREMIUM-J24.md` and `docs/TARS-PREMIUM-J25.md`.
- **Stopped before:** J-23 (the Atlas renderer track) and J-18b (the question surface). Neither was started. J-18b had only been read: the QA contracts for it are listed under "next action" below.

| State | Jobs |
| --- | --- |
| Done (25) | J-23, J-01, J-02, J-27, J-11a, J-11b, J-11c, J-10 (superseded by the Focus redesign), J-10b, J-03, J-28, J-04, J-05a, J-05b, J-05c, J-05d, J-06, J-07a, J-07b, J-07c, J-08, J-09, J-16, J-18, J-19 |
| Done outside the job list, at the owner's request | Focus redesign (full-stage study room, 264 generated wallpapers, 520 lines); study-audio engine (34 sounds, 36 generated tracks, persistent across routes); backups carrying notes and Current Affairs reading state (format v3) |
| Partly done | **J-14** Focus surfaces: completion card in place, Stop morphs to Save/Discard, no backdrop – *remaining:* context and timer-profile surfaces are still `Sheet`s, not popovers, on wide layouts (sounds is a `SidePanel`). **J-22**: immersive mode is the same screen with the chrome hidden (done); *remaining:* onboarding as a full-screen first run. **J-06**: tokens and reduced motion done; *remaining:* a lint rule for numeric Motion timings and migrating inline transitions. **J-07c**: *remaining:* wire the Capacitor back button to `closeTopSurface()` (`src/ui/surface/core.ts`). **J-20**: Stepper hold-repeat and Slider detent haptics exist in the primitives; nothing else started. |
| In progress | J-24 (tile worker/cache) and the J-25 label work needed for its phone gate; owner approved this limited sequencing exception on 2026-10-03. Both acceptance gates remain pending. |
| Not started, in execution order | J-15, J-18b, J-12, J-13, J-16b, J-17, J-29, J-30, J-20 (rest), J-21, J-22 (rest), J-26. J-25 is in progress under the limited exception above; its separate final gate remains pending. |
| Expected to be deferred | **J-30** needs a WebKit browser download and a manual pass on a physical iPhone and Android phone. **J-26** needs new map data (network, pipeline run) and the owner's approval. |

**Owner's decisions and constraints (still in force)**

- **Owner correction, 2026-10-03 (supersedes the generated-content acceptance and next-action advice below):** generated Focus wallpapers/audio are not acceptable quality, and generated lines are too generic. Keep them unchanged during J-23–J-25, but a content-quality follow-up is required. Future replacements must use genuinely high-quality, legitimately reusable/licensed media with source, licence and credit metadata, and verified real quotations with evidence for the exact wording and author. Never fabricate quotations or authors. Counts, synthetic audio checks and screenshots do not establish content quality. Resume the formal order: J-23 → J-24 → J-25 → J-15 → J-18b → remaining jobs; do not repeat completed jobs without verified regressions. No commit, push, merge to main or deployment is authorized.
- Commit, push, PR and deploy only when the owner asks. The checkpoint commit and the push of `handoff/claude-overhaul` were asked for explicitly; that does not extend to `main` or to deploying.
- Dev dependencies named by the audit are approved (ESLint/Prettier, `happy-dom`, Testing Library, `fake-indexeddb` are installed). No new *runtime* dependency without asking.
- Dexie schema work for backups was approved but turned out not to be needed (the data lives in localStorage and a separate IndexedDB store). Any other schema change still needs asking.
- Atlas: places the learner has **not** travelled must not be greyed, fogged or hatched; travel is shown positively (warm wash, edge and ring). This is implemented – do not reintroduce fog.
- Focus is a full-screen study room in the spirit of pomodorotimer.online: very large centred clock, wallpaper, minimal chrome, secondary controls disclosed on demand.
- Wallpapers, sounds, music and the lines under the clock are currently **generated by code or written for Tars** (§4.15). Their counts meet the earlier numeric request, but the owner has rejected their quality (2026-10-03). Replacements are a required later follow-up, with verified sources, reusable/licensed rights, credits and real quotations; retain the existing content during J-23–J-25.
- Audio must keep playing for the whole Focus session: one engine at module level, never owned by a component (§3, `audio/store.ts`).
- Surfaces: Dialog, BottomSheet, SidePanel, Popover, Menu, Tooltip from `src/ui/surface/`; no glass or `backdrop-filter`; no giant modals where a panel or popover fits.
- Quiz (J-18b, not started): one tactile system on `AnswerTile`; grading, saved attempts and explanations must not change.
- Standing rules in `AGENTS.md` §5 are unchanged (legacy `lodestar` identifiers, generated Atlas data, PYQ sourcing, and so on).

**What changed architecturally (where to look)**

| Area | Files |
| --- | --- |
| Shell and start-up | `src/app/App.tsx` (shell-first boot, deferred route, scroll memory, kept Atlas, `ShellSync`), `src/app/screens.tsx`, `src/app/Overlays.tsx`, `src/app/router.ts` (`RouteContext`, `goBack`, `lastHashFor`), `src/app/routeState.ts`, `src/app/screenActive.ts`, `src/app/shellShift.ts`, `src/app/Workspace.tsx` (`HEADER_COLUMN`), `src/app/Shell.tsx`, `src/lib/lazy.ts` |
| Design system | `src/index.css` (tokens v2), `src/ui/ui.css`, `src/ui/Pressable.tsx`, `controls.tsx`, `selection.tsx`, `fields.tsx`, `list.tsx`, `motion.ts`, `src/lib/motion.ts`, `src/ui/surface/*`, `src/ui/Sheet.tsx` (now a wrapper), `src/ui/feedback.tsx`, `src/ui/toast.ts`, `src/ui/patterns/question/AnswerTile.tsx`, gallery at `#/settings?gallery=1` |
| Focus | `src/features/focus/FocusScreen.tsx`, `focus.css`, `ambience.ts`, `Backdrop.tsx`, `WallpaperPicker.tsx`, `wallpaper/scenes.ts`, `quotes.ts`, `SessionComplete.tsx`, `mode.ts`; `src/timer/clock.ts`, `ClockText.tsx`, `useProgressAnimation.ts`. Deleted: `TimerDial.tsx`, `ImmersiveFocus.tsx` |
| Audio | `src/audio/store.ts` (engine), `catalog.ts`, `dsp.ts`, `sounds.ts`, `sounds-more.ts`, `music.ts`; `src/features/audio/SoundSheet.tsx`, `MusicDock.tsx` |
| Atlas | `src/features/atlas/AtlasMap.tsx` (rest detection, frame-anchored labels, overlay layer, soft edges, travel treatment, memoised, sleeps when behind), `labels.ts`, `style.ts`, `AtlasScreen.tsx` (`AtlasPresence`), `Legend.tsx` |
| Data | `src/data/deletion.ts`, `src/data/backup.ts` + `backup-extras.ts` (format v3), `src/current-affairs/archive.ts` (`restoreArticles`) |
| Tooling | `eslint.config.js`, `tools/lint-counts.mjs`, `.github/workflows/ci.yml`, `tools/perf/` new: `gesture-audit`, `app-audit`, `budget`, `budgets/*.json`, `error-recovery`, `dial-check`, `audio-check`, `route-state-check`, `header-check`, `shell-check` |

**Verification at the checkpoint**

All run on 2026-10-02 against the final tree (production build via `npm run preview` on :4173 unless marked dev), system Chrome, Windows laptop.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, 402 warnings |
| `npm test` | 282 of 282 |
| `npm run build` | succeeds; 236 precache entries (7,457 KiB) |
| `smoke.mjs` | 12 of 12 |
| `atlas-check.mjs` | 21 of 21 (three consecutive runs after the timing fixes in §9) |
| `fullscreen-regression.mjs` | pass |
| `shell-check.mjs` | 49 of 49 |
| `header-check.mjs` | 19 of 19 |
| `route-state-check.mjs` | 27 of 27 in the last full run; the 100 ms Atlas-revisit check is load-sensitive (item 3 below) |
| `tars-check.mjs` | 51 of 51 |
| `vnext-learning.mjs` | 104 of 104 (Paper; Night was last run before J-08 and passed) |
| `current-affairs-check.mjs` | 279 of 279 |
| `dial-check.mjs` | 24 of 24 |
| `error-recovery.mjs` | pass |
| `job4-control-contrast.mjs` | 40 of 40 |
| `gesture-audit.mjs --counts --budget` (desktop) | 16 budgets met |
| `app-audit.mjs --budget` (desktop) | 5 budgets met |
| `ui-audit.mjs` (375 and 1366, light and dark) | 81 of 82 in the full run: `1366-dark atlas-fullscreen` failed once and passed when 1366 px was rerun on its own. **Intermittent, cause not established** – most likely measured while the stage was still sliding into full screen (`shellShift.ts`, 320 ms). Look at this first if it recurs. |
| `features-check.mjs` (dev) | 21 of 21 |
| `job4-actions.mjs` (dev) | 23 of 23 |
| `audio-check.mjs` (dev) | 28 of 28 on the second run; 26 of 28 on the first (the music voice had not started when the check looked – the check's wait, not the engine: every later music check in that run passed). **Intermittent.** |
| Not rerun at the checkpoint | `job4-offline.mjs`, `job4-state-matrix.mjs`, `job4-visual.mjs`, `job4-integrity.mjs`, `canonical-pyq-audit.mjs`, `vnext-learning` in Night, `gesture-audit` and `app-audit` on the phone and laptop shapes, `cd tools/atlas-build && npm test` (no pipeline or content files were touched). Run these before merging to `main`. |

**Unresolved issues, risks and TODOs**

1. **Nobody has looked at or listened to the generated content.** The wallpapers were checked only as screenshots at two sizes, and the sounds and music only numerically (not silent, not clipping, no click at the loop point). How pleasant the 36 tracks and 20 new sounds are is unverified; the owner should listen before this ships. Reverb is a simple feedback-delay network and may sound metallic on percussive parts.
2. **Atlas frame stalls remain until J-24.** Counts are within budget, but a base repaint still holds a frame for roughly 0.3–0.7 s on the development laptop (more under load). J-24 (tile cache) is the fix. Timing-sensitive checks were made to wait for the repaint instead of a fixed delay (`atlas-check.mjs`: arrow key, `+` key, two-finger tap) – see §9.
3. **The Atlas keep-alive is new and subtle** (J-08, §5a): covered rather than hidden, map props frozen while behind, everything around the map inert. Window layout only (≥ 768 px, not low-power devices). Returning with a place selected was measured at 85–100 ms on a quiet machine and up to about 210 ms under load; the 100 ms check in `route-state-check.mjs` can therefore fail on a busy machine.
4. `tools/perf/app-audit.mjs` reports "atlas (second)" as about 35 ms. That number is not meaningful any more: its readiness test finds the kept map's names while it is still behind. Use `route-state-check.mjs` for the revisit time, or fix the audit's readiness test.
5. `app-audit` touch targets are still measured by element size, not by hit-testing, so `Pressable`'s 44 px hit area is not credited.
6. Lint: 0 errors, 402 warnings (baseline was 445): mostly `tars/arbitrary-token` and `tars/raw-button` in screens not yet migrated (Plan, Calendar, Current Affairs, Atlas chrome, quiz).
7. Dev-only suites (`features-check`, `job4-actions`, `job4-state-matrix`, `audio-check`) import app modules through Vite. After editing a module they import, **restart the dev server** first, or the page and the test get different module instances and the audio/timer checks fail for no real reason.
8. The header date said the Jobs 1–6 tree was pushed to `origin/main`; the app-shell overhaul and Current Affairs cleanup that followed never were. They exist only in this checkpoint.
9. Shell behaviour changed on purpose and two older checks were updated to match: on phones Settings/Notes/Insights select no tab; reduced motion means a 140 ms fade without travel, not zero duration.
10. Backups: an "unmark" (un-saving an article) has no timestamp, so a merge can bring a save back. Documented in §4.12; fixing it needs per-field timestamps in `personal-state.ts`.

**Recommended next action for Codex**

1. Continue on `handoff/claude-overhaul` from `3e43def`; reproduce the checkpoint before changing completed work. On 2026-10-03, locked dependency restore, typecheck, 282 tests, lint (0 errors / 402 warnings) and build (236 entries / 7,456.56 KiB) matched. Production smoke 12/12, Atlas 21/21 on a quiet rerun, fullscreen, shell 49/49, header 19/19, Tars 51/51, learning 104/104 (Paper), Current Affairs 279/279, dial 24/24, error recovery 7/7, contrast 40/40 and layout 375/1366 Paper/Night passed. Dev actions 23/23 and audio 28/28 passed. Dev features 21/21 passed after the readiness fix below. J-23 acceptance is complete (292 tests, typecheck/build, lint 0/402, Atlas 21/21, smoke 12/12, fullscreen, Tars 51/51, dev features 21/21, layout 375/1366 Paper/Night, all 29 gesture and 10 app budgets, isolated spike and quiet replay); raw logs are in ignored `tools/perf/out/codex-checkpoint/`.
2. The baseline dev feature setup skipped late lazy onboarding because `tools/perf/lib.mjs:prepare` waited only 1.5 s. It now waits for the seeded settings and, on a fresh profile, the actual Welcome surface. No app onboarding or timer behaviour changed. The unchanged production tree initially had a two-finger tap QA failure, then passed 21/21 quietly. Route restoration is 26/27 under load (Atlas shown 243 ms, painted 299 ms, worst subsequent frame 19 ms); the documented 100 ms revisit threshold remains unresolved, not a new regression.
3. Follow the formal execution order: **J-23 → J-24 → J-25 → J-15 → J-18b → remaining jobs** in audit §23. Finish each acceptance gate and update this handoff before proceeding. Keep completed jobs unless verification proves a regression. Preserve the owner correction in §4.15 as a required later content follow-up.
4. For later **J-18b**, preserve its QA names and durability contracts: article `data-question-id` / `data-question-type`, four role `radio` options locked after saving, `Submit answer`, `Accepted answer`, dialogs `Previous question` / `Previous questions`, selects `Question exam` / `Question year` / `Catalogue view`, place section `Previous questions`, FieldReview `fieldset` choice buttons and `Check order` / `Reset`. Feedback requires a durable save; accepted answers come only from the packs.
5. No commit, push, merge to main or deployment is authorized. Physical-device gates and added Atlas data retain their explicit boundaries.

---

## 1. Project summary

Tars (called **Lodestar** until 2026-09-26) is a local-first Atlas and News app for UPSC / UPPCS. Atlas has 2,273 freely accessible India/World places, canonical PYQs and recall mastery. News is a collection of external RSS publisher links, with Read/Saved, search/filters and archives; stored notes remain dormant. It runs as a PWA and Capacitor Android/iOS app; historical Focus/Planning data remains inert and backup-compatible. Presentation work is authorized; J-24/J-25 and the renderer remain protected (see §0a).

## 2. Tech stack

Versions are the ranges in `package.json`; the lockfile pins the exact ones.

| Area | What |
| --- | --- |
| Runtime | Node 22 in CI (`.github/workflows/ci.yml`); works locally on Node 24.19.0 / npm 11.17.0 |
| Language | TypeScript `^7.0.2` (`tsc -b`, project refs `tsconfig.app.json` + `tsconfig.node.json`), ES2022 target |
| UI | React `^19.3.0`, Tailwind CSS `^4.3.3` (`@tailwindcss/vite`), Motion `^13.4.2`, lucide-react `^1.48.0` |
| Fonts | `@fontsource-variable/manrope` + `@fontsource-variable/fraunces` `^5.3.0`, self-hosted via `@font-face` in `src/index.css` |
| State / data | Zustand `^5.0.15` (shared UI stores), Dexie `^4.4.6` (IndexedDB/liveQuery) |
| Build | Vite `^8.3.0` (rolldown; `rolldownOptions.advancedChunks` vendor split), `@vitejs/plugin-react` `^6.1.1`, vite-plugin-pwa `^1.3.0` + workbox-window `^7.4.1` |
| Maps | Bundled TopoJSON and relief sheets with `topojson-client` `^3.1.0`; `AtlasMap.tsx` renders the map and recall. The existing tile and label workers are retained. |
| Native | Capacitor `^8.5.2` (android, ios, core, cli), app `^8.1.1`, haptics, filesystem, share, status-bar |
| Tests | Vitest `^5.0.1` (`src/**/*.test.ts`, node env) + `fake-indexeddb` `^6.2.5`. The data pipeline uses `node --test`. |
| Data pipeline (`tools/atlas-build`, own package) | d3-geo `^3.1.1`, d3-geo-projection `^4.0.0`, mapshaper `^0.7.66`, sharp `^0.35.4`, topojson-server/simplify `^3`, shapefile, pngjs, polylabel |
| Perf / QA (`tools/perf`, own package) | playwright-core `^1.56.0` driving headless Chromium |
| Hosting | Vercel (`vercel.json`), static `dist/` with hash routing |

## 3. Architecture overview

- `app/`: shell-first startup, deferred screens, kept Atlas, rail/phone navigation, `#/atlas` landing, News and auxiliary Settings; retained route state/scroll memory, theme, palette, shortcuts and recovery.
- `atlas/` and `features/atlas/`: source data/index, existing map renderer/workers, entities/search/filters, canonical PYQs, quizzes and recall. `game/` retains recall XP/ranks/map styles and native recall challenges; exploration no longer reads Focus sessions/expedition runs.
- `current-affairs/` and `features/current-affairs/`: existing relevance/gateway, reading state/archive/UI; `features/notes/` is the preserved News note collection/hook.
- `data/`: unchanged Dexie v2 schema/migrations, legacy-compatible types, repo/tombstones/sync and JSON backup v1–v3. Only settings/recalls/claims have shared live-query hooks. Fresh startup seeds shared settings only.
- `services/` and `ui/`: shared install/lifecycle/files/haptics/fullscreen and existing design-system/surface primitives. Timer/audio/reminder/wake-lock services are deleted.
- `public/atlas/v1`, `pyq-atlas/v1`, `atlas-assets/v1`, `current-affairs/v1`: unchanged generated geography, curated PYQs, offline hashes and relevance data. `tools/atlas-build` stays authoritative; no pipeline/content change.
- `tars/`: validated Atlas/PYQ/review/navigation/preferences actions only; deterministic commands and context. Removed actions cannot execute through any client.

Detailed dependency disposition, retained legacy schema and local validation: [TARS-ATLAS-NEWS-REDUCTION.md](docs/TARS-ATLAS-NEWS-REDUCTION.md). Earlier architecture is recoverable in Git history; roadmap checkpoints above are historical.

## 4. Output Quality Specs

Current feature set is §0a. Focus/Planning/expedition/notification/sample-history specs below are archived historical requirements; their runtime surfaces are removed. Atlas factual/PYQ/question and News fidelity rules remain in force. Timer-driven progression/challenges are superseded by recall-only rules in §0a.

Every feature below produces text or assets a user reads. Each entry gives the standard that is in force now, with real examples from the repo. Where a rule is enforced by code, the file is named.

### 4.0 House style for all user-facing text

- **Tone:** calm, factual, second person when addressing the user ("Your home state starts explored on the Atlas."). No exclamation marks anywhere in UI copy (verified: none in `src`). No hype, no emoji. The one exception is `✦` in the native "Focus complete ✦" notification title.
- **Case:** sentence case for titles, buttons, toasts and menu items ("Move base camp", "Backup saved", "Export sessions (CSV)").
- **Typography:** curly apostrophes and quotes (`’ “ ”`: "Couldn’t read that backup", "You’re offline"); a spaced **en dash** ` – ` for asides in UI copy (135 uses vs 2 em dashes); an unspaced en dash for ranges and pairs ("India–Myanmar border", "1990–2026"); ` · ` as a separator; `×` for counts ("Asked 13×"); `≈` for estimates; the single-character ellipsis `…` ("Loading the atlas…"); `°` coordinates as "27.39° N, 88.83° E".
- **Numbers:** durations through `formatDuration` (`src/lib/time.ts`): `2h 30m`, `45m`, `<1m`, `0m`. Chart hours through `formatHoursShort`: `1.5h`, `12h`, `45m`. Times of day through `formatTimeOfDay` (honours the 12/24 h setting). Metres and km with thousands separators ("8,611 m"; code uses `toLocaleString('en-IN')`). Numeric UI uses Manrope `tabular-nums` (`.tabular`, `.timer-digits`), never Fraunces.
- **Toasts:** title of 1–4 words, no period. Optional body: one sentence ending in a period that states the consequence or a reassurance ("Keep it somewhere safe – you can restore it on any device."; "Tars keeps working – everything is saved on this device."). Deletes offer **Undo** in a toast instead of a confirm dialog.

### 4.1 Gazetteer facts, version 1 (hand-authored)

Where: `tools/atlas-build/content/india-*.mjs`, `world.mjs`, the `f:` option of `P(kind, name, lat, lon, {...})` (DSL in `content/dsl.mjs`). 1,181 places (`added` absent). Shown on place cards, in recall explanations and in the `fact` question type.

**What good looks like**
- 1–3 facts per place; the build warns on zero facts (`lib/places.mjs`: `no facts`). Measured over v1 facts: median 70 characters, 90th percentile 137, max 255.
- Exam-oriented and dense: what the place is, plus the linkages examiners ask about (source/mouth, tributary and bank, range, the state or border it sits on, "highest/largest/only", the dam on it, designations, a recent event with its year).
- The subject is usually omitted. The fact opens with a noun phrase or a verb (only 223 of 1,181 first facts start with the place's own name): "Highest peak of Nagaland, on the India–Myanmar border." "Connects Sikkim with the Chumbi valley of Tibet on the old Silk Route."
- Every fact is a sentence ending with a period. Elevations go in parentheses after the name ("Guru Shikhar (1,722 m) on Mount Abu is the highest point."). Current names are used, with the former name in `aka` and the rename year in the fact ("Capital of the Andaman and Nicobar Islands, renamed from Port Blair in 2024.").
- Political framing follows the **Government of India's official position**; the India sheet uses the official GoI depiction. Real examples: K2: "Lies in the Karakoram in Gilgit-Baltistan (Indian territory under Pakistan’s occupation)."; Aksai Chin: "High cold desert in eastern Ladakh claimed by India and occupied by China."; Kishanganga: "Called the Neelum in Pakistan-occupied Kashmir."
- Also set: `lvl` (1 core · 2 standard · 3 advanced), `st` (India state ids, **source → mouth order for rivers**; the order question depends on it) or `co` (ISO3), `el` for high features, `aka` for exam spellings (Anaimudi, Satluj, Palghat…), `rel` links (`tributaryOf`+`bank`, `source`, `flowsInto`, `range`, `onRiver`, `within`, `border`), and `sub` for a 2–7-word descriptor, sentence case, no period ("Salt marsh", "Disputed plain on the LAC", "Tract ceded by Pakistan to China (1963)").

**Examples (real)**
```js
P('peak', 'Anamudi', 10.17, 77.061, { aka: ['Anaimudi'], lvl: 1, el: 2695, st: 'kerala', rel: { range: 'range.anaimalai-hills' }, f: ['Highest peak of India south of the Himalaya, in Eravikulam National Park.'] })
P('river', 'Beas', 31.85, 77.0, { lvl: 1, st: ['himachal-pradesh', 'punjab'], aka: ['Vipasha'], rel: { tributaryOf: 'river.sutlej', bank: 'right', source: 'pass.rohtang' },
  f: ['Rises at Beas Kund near the Rohtang pass and flows through the Kullu valley.', 'Pong dam (Maharana Pratap Sagar) is on the Beas; it joins the Sutlej at Harike.', 'The only Indus tributary that flows wholly within India.'] })
```

**Avoid:** facts that repeat the kind word as the whole content ("A lake in Andhra Pradesh."); census, etymology, transport or tourism trivia; opinions; unsourced numbers; "recently" without a year; editing `public/atlas/v1/places.json` by hand (it is compiled output).

**Edge cases**
- A version 1 place's `level` and fog `unit` are pinned by `content/sources/v1-lock.json`. The compiler keeps the locked values and warns if they differ; removing a v1 place prints `VERSION 1 PLACE MISSING` (user progress would break).
- Points must fall inside the claimed state. The build checks against boundaries and warns `point is not in <state>`. For large features (ranges, plateaus), the authored point is a deliberate label position (see `reports/coords-audit.json`).

### 4.2 Gazetteer facts, version 2 (generated from sources)

Where: `tools/atlas-build/gazetteer/generate.mjs` + `gazetteer/facts.mjs` → `content/generated/{india,world}.json` and `enrich.json`. 1,092 places carry `added: 2`. Candidates say **what** to add (`content/candidates/*.mjs`: `C(kind, 'Wikipedia title', { lvl, why, tags, name, f })`); the generator decides **what to say**, and only from sources.

**What good looks like**
- **Facts are verbatim sentences from the cited Wikipedia article's lead; nothing is paraphrased.** `pickFacts(lead, { max: 3, maxLen: 260 })` works like this:
  - The first (defining) sentence is always kept whole up to 420 characters.
  - The other slots go to the highest-scoring sentences. Scoring: +2 for an informative keyword (largest/highest/confluence/tributary/border/designated/Ramsar/UNESCO/dam/port/strait…), +1 for containing a digit, +3 for matching `prefer` (years 2018–2029 for `strategic` places), −0.15 per position.
  - Weak sentences are skipped: etymology, "named after", census/population, constituency, PIN code, railway station, "is served by", nearest airport, tourism, temples, festivals.
  - A sentence contained in an already-picked one is dropped.
  - Cities and capitals get at most 2 facts; everything else at most 3.
- The only permitted changes to a lead are those in `cleanLead`: citation markers `[n]` and bracketed asides are removed (non-Latin script, IPA, "listen", "pronounced", language glosses, "also known as", "formerly", "meaning"). An over-long sentence is cut at the last `; ` / `, and ` / `, which` / `, where` past half its length and closed with a period. If no such boundary exists, the sentence is dropped.
- **Designation facts** are appended from the official list, in these exact templates:
  - "Designated a Ramsar site on 19 August 2002 (901 km²)."
  - "Part of Project Tiger's network of tiger reserves since 1973."
  - "In UNESCO's World Network of Biosphere Reserves since 2000."
- **Positions:** Wikidata P625, else the article, else OpenStreetMap/Nominatim (only for designated sites with neither, and the hit must contain the distinctive name). If Wikidata and Wikipedia disagree by more than 20 km, the more precise one wins. Candidates with no position are left out and listed in `reports/generate-review.json` → `noCoords`. **Nothing is filled from memory.**
- **Sources** go on every place, in this order: `Wikipedia: <title>`, `Wikidata: Q…`, `OpenStreetMap: <name, region>`, then `<List> (<owner>)`, e.g. "List of Ramsar sites in India (Ramsar Sites Information Service (rsis.ramsar.org))". The card shows them, deduplicated and together with the place's PYQ PDFs, in one collapsed row: Kolleru Lake → "Sources (5) · 16.65° N, 81.20° E" (`features/atlas/PlaceSources.tsx`).
- **Aliases:** at most 4, Latin script, ≤ 40 characters, no bare acronyms, never equal to the name.
- **Ids:** `<in|w>.<kind>.<slug(name)>`; on a collision, `-<ISO3 or state>`, then `-2`, `-3`…
- **Dedupe:** a candidate whose Wikidata item matches an existing place is merged into that place's `enrich` entry, not added. So is one with the same distinctive name within the kind's tolerance, and the hand merges in `MERGE_INTO`. National capitals may exist on both sheets.

**Examples (real, from `places.json`)**
- Mandakini (`in.river.mandakini`, rel `tributaryOf: in.river.alaknanda`): "The Mandakini River is a tributary of the Alaknanda River in the Indian state of Uttarakhand." / "The river runs for approximately 81 kilometres (50 mi) between the Rudraprayag and Sonprayag areas and emerges from the Chorabari Glacier." / …
- Depsang Plains (`strategic`, `sub: 'Disputed plain on the LAC'`): the lead sentence plus "Major standoffs between the two countries occurred in 2013, 2015 and 2020." This second sentence was picked because of the recent-years preference.

**Avoid:** rewording a lead "to read better"; merging two sentences; adding facts from general knowledge; editing `content/generated/*.json` by hand. For a hand override, put `f` on the **candidate**; those facts must still come from the cited sources.

**Edge cases / known imperfections (observed, not yet fixed)**
- 33 places state their Ramsar designation twice: a lead or hand-written fact plus the appended list fact. Examples: Tawa Reservoir ("It was designated as a Ramsar site of national importance in 2024." + "Designated a Ramsar site on 8 January 2024."), Wular Lake, Chilika Lake.
- The designation templates use straight apostrophes ("Project Tiger's", 58 facts; "UNESCO's", 4), unlike the rest of the app.
- Verbatim leads are often tautological ("Tawa Reservoir is a reservoir on the Tawa River…"): 677 of 1,092 v2 first facts start with the place name. This is accepted because the facts are verbatim.
- Verbatim leads use Wikipedia's framing, which can differ from the GoI framing of §4.1 (Depsang: "the disputed Aksai Chin region of Kashmir"). **No rule has been decided**; ask the user before rewriting any v2 fact.
- v2 facts are longer: median 118 characters, 90th percentile 204, max 402.

### 4.3 PYQ ledger entries

Where: `tools/atlas-build/content/pyq/uppsc.mjs` (654 entries) and `upsc-prelims.mjs` (129), via `Q(exam, year, q, places, { topic, source })`. Rules are in `content/pyq/index.mjs`; validation is `validateEntry` in `lib/pyq.mjs`.

**What good looks like**
- **One entry per appearance.** A question tagged with several papers becomes one entry per paper; in `uppsc.mjs` this is `asked([[exam, year], …], q, places, o)`. A question the workbook prints twice is recorded once. The count uses distinct `exam|year|normalised q`.
- **exam** is one of the normalised names in use: `UPSC CSE Prelims`, `UPPCS Prelims`, `UPPCS Mains`, `UP RO/ARO Prelims`, `UP RO/ARO Mains`, `UP UDA/LDA Prelims`, `UP UDA/LDA Mains`, `UP Lower Sub. Prelims`, `UP Lower Sub. Mains`, `UPPSC GIC`, `UPPSC RI`, `UP BEO Prelims`. **year** is the paper's printed tag (range in the data: 1990–2025).
- **q**, UPPSC style: the question verbatim with its options inline, `(a) … (b) …`, cut with ` …` past about 300 characters (89 of 654 are cut; median 153 characters). UPSC Prelims style: the stem condensed, with the place-naming options in parentheses (median 154, max 361).
- **places** lists **every place the question names, options/distractors included**, not only the answer. Use an atlas id when the place exists (`in.lake.kolleru-lake`), else the name as printed. For an ambiguous name use `{ name, kind }` (or `sheet`, `state`).
- **topic** is the plural kind label of each **atlas id** the entry references. This holds for all 783 entries. Mapping: `capital→capitals`, `city→cities`, `range→mountain ranges`, `pass→mountain passes`, `sea|gulf→seas and oceans`, `park→protected areas`, `monument→heritage sites`, otherwise the plural kind (rivers, lakes, dams…). If no named place is in the atlas, use `[]`.
- **source** is `{ title, url }`. The url is `pdf:<file>#p<page>` (1-based PDF page) or an http(s) link. PDF pages are grouped per file in the compiled output.

**Examples (real)**
```js
...asked([['UPPCS Prelims', 1999], ['UPPSC GIC', 2010], ['UP Lower Sub. Prelims', 2002]], 'Which one of the following towns is nearest to the Tropic of Cancer : (a) Agartala (b) Gandhinagar (c) Jabalpur (d) Ujjain', ['in.capital.agartala', 'in.capital.gandhinagar', 'in.city.jabalpur', 'in.city.ujjain'], { topic: ['capitals', 'cities'], source: geo(2) }),
Q('UPSC CSE Prelims', 2022, 'Gandikota canyon of South India was created by which one of the following rivers? (Manjira, Pennar, Cauvery, Tungabhadra)', ['in.valley.gandikota-canyon', 'in.river.manjra', 'in.river.penner', 'in.river.kaveri', 'in.river.tungabhadra'], { topic: ['rivers', 'valleys'], source: wb(152) }),
```

**Avoid:** filling years, exams or appearances from memory; transcribing questions that name no atlas-type place (states/UTs, countries, tribes, crops, minerals/mines, power plants, institutions, culture); citing a compilation without a page; committing the PDFs (`pyq-sources/` is ignored by git and Vercel).

**Adding places for unmatched names:**
- Physical features, protected areas, ports, dams and world capitals are added (as v2 candidates with `why: 'pyq'`).
- Towns are added only if asked in ≥ 2 questions or in UPSC Prelims.
- Anything else goes in `not-mapped.mjs` with a reason (§4.4).

**Acceptance check:** `node build.mjs --places-only`, then `reports/pyq-review.json` must show `unmatched: 0, ambiguous: 0, invalid: 0` (current: 0/0/0, 119 explained). The `tools/atlas-build` test "the committed ledger is valid and fully resolvable" must pass.

### 4.3a Canonical Atlas PYQ subset — vNext Job 1

The authoritative input is external `../canonical-pyq-v2-final.zip` (or `CANONICAL_PYQ_PACKAGE` / `--package=<path>`): release **2.1.0**, schema **canonical-pyq/v2**. Never edit the ZIP or import its scripts. `lib/canonical-package.mjs` pins manifest SHA-256 `282b9bbedba72bf612bd9c79a267e2c541a4970dcc00b5d70a41b2a8b6963a68`, verifies all 324 listed file hashes/lengths, validates supplied JSON schemas with build-only Ajv, then joins all 6,982 active records across 56 paper/answer packs and sidecars. Identity, exam/year/cycle/number, booklet, provenance source and answer line must agree; question, answer and source-record CPYQ hashes must agree. Numbering gaps remain. `source-archive/`, historical/cancelled and visual-excluded records never supply runtime inventory. Legacy `validation.quiz_ready` is ignored.

**Three sequential gates; every rejection has a reason and field path where relevant:**

1. Runtime: `active=true`, `quiz_state=QUIZ_USABLE`, final answer, `answer_scoreable=true`, `immediately_scoreable=true`, `requires_local_correction=false`; no content/answer/visual issues. This is intentionally stricter than the package's 6,815 immediately-scoreable records: 23 unresolved nonblocking source-review records are also excluded, leaving **6,792**.
2. Premium: shared `src/atlas/pyq/quality.mjs` permits complete paragraphs, recursive labelled/ordered/unordered/statement lists, pairs, matching lists/tables, ordinary tables, sequences, answer codes, assertion–reason, context/quotation. It rejects empty required items/cells, duplicate options/labels, malformed boundaries/references, mismatched structures, inconsistent sequence inventories, broken matching domains, images/maps, extraction/OCR/markup artefacts, truncated prompts, orphan quotes, instructions embedded inside list/pair items and excessive nesting/width. Ordinary tables may have a blank ordinal column or all-blank supplied headers; complete rows remain in their supplied order, with no invented header. Unequal matching-list lengths are valid. Never repair meaning, move text into an inferred structure or infer correctness from adjacent matching rows. **6,184** records survive this gate.
3. Relevance: `lib/atlas-relevance.mjs` classifies `direct-spatial`, `place-centric`, `spatial-association`, `incidental`, `none` from explicit demand rules. Only the first three qualify, with at least one resolved primary/supporting/comparison entity. Institutional/political/biographical/statistical demands are excluded even if they mention places. Precision takes priority. **149** questions survive: **CSE 72 / PCS 30 / CDS 47**. Canonical exam codes remain `UPSC-CSE` / `UPPCS` / `CDS`; display families are CSE / PCS / CDS. CDS is secondary/enrichment and never enters the existing priority formula.

**Coverage is separate:** the entire active corpus is scanned even when a question fails quiz gates. `lib/atlas-mentions.mjs` uses exact IDs, names, aliases, explicit normalized descriptor/spelling forms, supplied Wikidata mappings and reviewed overrides (`content/pyq/canonical-mappings.mjs`). No fuzzy match or coordinate guessing. Same-Wikidata features drawn on both sheets retain their existing IDs and an explicit `alsoPlaceIds` cross-reference. Conflicting identities, country/polygon versus named-feature collisions, generic aliases and ambiguous personal/common names go to review. `Indian` and `to` are rejected as geographic alias definitions; `Uruguay` must not silently resolve a country option to the Uruguay River. `Chota Nagpur` must not become Nagpur city. Unknown feature phrases and residual proper names remain explicit queues, not confirmed new identities. Exact text paths and character offsets allow auditing against canonical text.

Relations carry canonical `questionId`, stable `placeId` (null in unresolved coverage reports), exact `mentionText`, location, path/offsets, resolution, semantic role, relevance, `quizIncluded` and advisory `masteryEligible`. Only resolved primary stem mentions in admitted questions may have `masteryEligible=true`. Incorrect options, comparison rows, statement truth and ambiguous/unresolved mentions never imply mastery. No existing mastery computation consumes these advisory flags in Job 1.

**Artifacts and examples:** `public/pyq-atlas/v1/manifest.json` lists 49 curated question/answer pack pairs with counts and SHA-256 hashes; question objects retain the exact canonical representation and IDs, and answer packs retain supplied final accepted keys (multiple keys are alternatives). `place-pyq-index.json` keeps primary and enrichment references separately and family totals; references may include distractors, so Job 2 must inspect relation roles before using them for learning. No full objects enter `places.json`; no publisher filename/page provenance is emitted into place sources. `src/atlas/pyq/loaders.ts` loads only requested packs, validates joins/quality/hashes and caches by identity/paper/content hash. Job 1 originally excluded these files from precache; Jobs 2–3 superseded that policy with precached curated packs (§4.3b), so current unvisited papers work offline after installation.

The developer preview uses the same semantic presentation tree and CSS as `AtlasPyqBody`. Real audit samples include `CDS-2018-I-GK-Q108` (Hambantota location), `UPSC-CSE-2000-GS1-Q014` (oceanic trench matching), `UPSC-CSE-2024-GS1-Q009` (waterfall/region/river table), `UPSC-CSE-2007-GS1-Q075` (Kalinadi assertion/reason), and `UPSC-CSE-2014-GS1-Q052` (south-to-north sequence). See `reports/canonical-pyq-preview.html` and `canonical-pyq-audit-samples.json`. These are developer-reviewed samples, not human-approved golden outputs.

All outputs record canonical release, package/manifest hashes, pipeline version/code hash, Atlas contract/data/source hashes and override hash. No generated timestamp; source order changes do not change output. Exclusions are **190 runtime / 608 premium / 6,035 relevance**, totaling 6,833, with overlapping reason counts in `canonical-pyq-import.json`. Coverage maps **3,091 mentions to 893 existing IDs** and reports **6,829 unresolved mentions**: 5,347 sheet entities, 453 ambiguous identities, 288 case/context issues, 488 polygon/feature collisions, 253 unresolved feature occurrences. The last category groups into **213 unconfirmed candidate names**. Another 43,175 residual proper-name occurrences are an explicit potential-name review queue, not geographic inventory. **Zero places or coordinates were added.** The scan is broad and auditable; the review queues are not proof that all possible geographic referents have been resolved.

Acceptance: regenerate with `npm run atlas:pyq`; run root tests/typecheck/build and Atlas-build tests, `node tools/perf/canonical-pyq-audit.mjs`, and compare consecutive build bytes (runtime packs, reports and preview). All supported structures have fixtures. Package integration tests run fully when the external ZIP is present; on a clean checkout without it they explicitly skip instead of loading an archive fallback. Set `CANONICAL_PYQ_PACKAGE` to run them. Never weaken validators to increase inventory or hand-edit derived packs. Additions require reviewed identities and sourced coordinates through the existing gazetteer candidate/build process.

### 4.3b vNext Job 2 learning contracts

Every place is freely accessible. `discovered` remains historical travel data, not an access permission; no sessions, permanent IDs or allocation rules are rewritten. Focus powers travel; recall powers familiarity/mastery. Place facts, relations, testing and canonical questions are visible before travel. Due review also includes already-tested untravelled places.

Desktop `AtlasScreen` uses an absolute overlay inspector (`data-inspector`), never a map-width sibling. Collapse keeps selection; reopen restores it. Mobile reuses `PlaceDetails` in the existing bottom sheet and yields to quiz/recall. References come only from filtered geographic `p.sources`, never `p.pyq.sources` or PDF pages. Manrope is used for every small geographic label; country/state/water/physical hierarchy and halos remain.

`PlaceQuestions` and `CanonicalQuiz` consume only the verified 149-question Job 1 packs. Native A–D radio controls plus Submit lock after durable save. Feedback is limited to Your answer, Accepted answer(s), Correct/Incorrect and meaningful related places; no invented explanation. Primary/supporting/comparison relations are identified; incidental/distractor-only places are omitted as destinations. CDS is enrichment; the legacy priority model remains separate.

Optional, non-indexed v2 `recalls.pyq` metadata stores canonical question ID, question and supplied answer hashes, selected/accepted keys and eligible primary-stem IDs, with normal history timestamps/date. No full bodies or new counters. `computeMastery` expands only those eligible IDs; PYQ is a distinct recall type and cannot pretend to be locate/order evidence. Existing repository/backup/sync/tombstone paths preserve the optional fields, tested end to end; no Dexie version change is needed.

Measured curated JSON is less than 0.6 MiB; Workbox now precaches it with content revisions and ignores the hash query parameter. Application reads stay paper-lazy. An unvisited paper is verified offline after the service worker finishes installing. Full corpus/archive/reports remain excluded from application delivery. See `docs/TARS-VNEXT-JOB-2-3.md` and `tools/perf/vnext-learning.mjs` for acceptance evidence.

### 4.3c vNext Job 3 action, context and offline contracts

- **Execution:** `src/tars/registry.ts` defines typed inputs, titles, availability and plain-object validation. `runtime.ts` resolves live IDs and delegates to existing repositories and timer operations. Unknown fields, invalid dates/durations, missing IDs and unavailable actions fail before effects; failures never produce success feedback. Asynchronous starts/creation/completion are guarded against duplicate execution. Duration commands select a compatible countdown before mutation, even for a stopwatch task. Unlinked Calendar blocks clear stale task/project/subject context before starting; linked blocks retain their task. UI controls and keyboard/command entry points share these actions; detailed editing forms retain their established repository writes. Future AI/voice may propose `{action,input}` through `executeProposal`, and must not mutate stores/databases.
- **Context:** `context.ts` derives route, timer, task, selected place/PYQ, priority-ordered today/overdue plan, due recall, expedition next/checkpoint and recent persisted focus. `useContext.ts` bridges live queries and transient selection; shared `src/lib/useDay.ts` refreshes Atlas, planning, Focus progress and context at midnight/wake. Imperative execution reads the current hash/timer/selection/day before deriving context, including before a React effect or hashchange dispatch. No second progress ledger or per-frame context counter. `suggestActions` returns at most three factual executable suggestions. Selection is exposed only on Atlas.
- **Commands:** `intents.ts` resolves unique exact/normalized place names and aliases, unique existing subject names, durations, exam/type/year filters and tomorrow. Example: `Start 50 minutes of Polity` uses an existing Polity subject; create one using normal quick capture (`Read Polity today @Polity`) if absent. Ambiguity never guesses a place/subject. Unsupported control requests never silently create a task. Ordinary quick capture remains supported. CSE/PCS/CDS display families never replace canonical exam IDs.
- **Presence:** compact Tars launcher plus one contextual desktop action; palette has up to three next actions. The existing active timer pill carries continuity away from Focus. Idle Focus shows today's actual task/review counts. Session completion shows persisted focus duration, applicable expedition minutes and places reached; it must not claim unearned progress. Example UI composition: `<expedition title> +25m · <actual count> places reached`. No chatbot panel or fabricated advice.
- **Atlas:** existing offline SVG renderer retained; study hotspots count distinct curated questions per meaningful place/family, excluding incidental/distractor relations. They are display evidence, not mastery or priority weights. Current limits, controlled India depiction, relief and overlay geometry remain. Mastery badges and search labels are independent of Travelled state. Failed first recall says Recall started rather than Travelled. Gestures counter-scale HTML names only; SVG symbols scale with the layer until settlement to avoid per-frame SVG repaint.
- **Assets:** `tools/build-atlas-assets.mjs` creates additive `public/atlas-assets/v1/{manifest,pyq-hotspots}.json`, reading Job 1 without rebuilding it. Content-hash IDs, exact bytes, tiers, compatibility, bundled/removable policy and India depiction are explicit. CORE and INDIA are precached, including `atlas/v1/ATTRIBUTION.txt`; REGIONAL has no published packs, ONLINE has zero cache budget. No high-detail planet or uncontrolled map cache. Offline UI checks bytes and SHA-256 for all 111 declared assets, rather than counting old same-path cache entries, and refreshes after SW activation/app resume. Regional download/remove controls must wait for real verified packs.
- **Design:** Manrope operational/body/numerics/map/quiz, Fraunces large headings; explicit `.type-*` roles, quieter shared cards, open Insights charts/statistics, smaller operational headings, Paper/Night and existing 140/220/320ms/reduced-motion conventions. Primary routes and deep links remain; Settings stays secondary. No generic dashboard replaces Focus.
- **Boundary:** the map spike under `tools/map-spike` is development-only. Reproduces existing vectors as a local PMTiles archive; it introduces no new place coordinates. Candidate performance is promising, but deeper content, cold-offline installation, required study layers and target-phone GPU parity are not established. Root runtime dependencies remain unchanged.

### 4.3d Job 4 stabilization contracts

Accessibility keeps theme-aware small mastery text separate from fixed cartographic marker colors. Neutral task checkbox outlines, completed Night glyphs and off-state switches use visible ink; targets are 24/28 px. The compact Atlas Tars launcher sits below the zoom controls and hides with fullscreen/immersive chrome. Viewport-fitted Focus retains its 84 px mobile bottom reservation; scrolling screens use additional launcher clearance. Current regression scripts verify actual text/control contrast as well as layout.

Job 4 stabilization contracts: task completion rereads the task inside a write transaction and creates at most one recurring successor; failure rolls both writes back. Expedition activation is likewise atomic across tabs. Task → Focus and the internal context picker share `planner/focusContext.ts`; a different task clears the old intention and uses only that task/project's subject. Async timer starts reject changed timer/task state after reads. Explicit subject commands clear a previous task context. Quick capture rejects ambiguous subject/project names (including duplicate exact names and competing legacy project tags) before committing any new entities; `Add task Review geography tomorrow` is an explicit capture escape. Field Review reveals feedback only after durable persistence and supports retry without duplicate writes. Canonical accepted-answer arrays are copied into immutable attempt snapshots; no schema/version change. Region mastery counts include learned untravelled places; travel rewards and deterministic allocation remain unchanged. See `docs/TARS-VNEXT-JOB-4-AUDIT.md` for independent evidence and remaining performance limits.

### 4.4 Not-mapped reasons

Where: `content/pyq/not-mapped.mjs`, as `{ Name: reason }`. A reason is one plain sentence **without** a final period that names the rule applied. Shared constants cover the usual cases, e.g. `NO_COORDS = 'No reliable coordinates found on Wikipedia or Wikidata; left out rather than guessed'`, `TOWN = 'Town asked in only one question of the collected papers; the atlas adds towns asked in two or more questions or in UPSC Prelims'`. When a name gets mapped, delete its line.

### 4.5 Study priority (score, band, reasons)

Where: `scorePlaces` in `tools/atlas-build/lib/pyq.mjs` (build time), the Gazetteer "Study priority" order, and `dueForReview(..., priority)` in `src/atlas/mastery.ts`. `PastPapers.tsx` retains only shared band styles used by Gazetteer; its unused old question-list component is removed. The manual ledger remains priority/provenance evidence. Canonical packs alone supply runtime question bodies/answers; curated CDS counts never feed the legacy priority formula.

**What good looks like**
- **Interpretable, with its reasons stored in the data.** `yield = { score 0–100, band, parts, reasons[] }`. `places.json.yieldModel` holds the weights, the note, `refYear` (the latest ledger year, currently 2025) and the half-life.
- **Weights:** frequency 0.30, recurrence 0.15, recency 0.15, importance 0.20, density 0.10, gap 0.10. Each part:
  - frequency = `1 − e^(−n/2)`
  - recurrence = `min(1, (distinctYears − 1)/3)`
  - recency = `0.5^((refYear − lastYear)/6)`
  - importance = level (1: 0.8, 2: 0.5, 3: 0.25) + 0.2 for any key tag (ramsar, tiger-reserve, world-heritage, biosphere, national), capped at 1
  - density = `min(1, (links + 2·askedLinks)/10)`
  - gap = `importance × (1 − frequency)` when asked ≤ 1×, else 0
- **Bands:** core ≥ 65 ("Top priority"), high ≥ 45, medium ≥ 25, low. Current distribution: 140 / 193 / 515 / 1,425. 1,044 places have PYQ history.
- **Reasons** use fixed templates, in this order:
  - "Asked 13× in <exams, comma-separated> (<years>)"
  - "Recurs across 12 years"
  - "Last asked 2023"
  - one of "Core syllabus place" / "Standard syllabus place" / "Advanced place"
  - one line per key tag ("Ramsar site", "Tiger reserve", "World Heritage site", "Biosphere reserve", "National capital")
  - "Linked to 7 places, 5 of them asked"
  - "Important but not yet seen in the collected papers" or "Important but asked only once in the collected papers" (when gap ≥ 0.3)
- **The panel:**
  - Header "PAST PAPERS" with a badge "Top priority · 73".
  - "Asked 13× in <exams>" with a chip for each year.
  - Up to 4 reasons, excluding those starting with Asked / Last asked / Recurs, since the history line already covers them.
  - With no history: "Not in the collected papers yet."
- **Always framed as a study heuristic, not a prediction** (note text in `YIELD_NOTE`). Per the M9 request, the card **does not** show a "Sources: … A study heuristic …" paragraph. Provenance lives in the collapsed Sources row.

**Examples (real)**
- Nathu La: score 73, core. Parts: frequency 1, recurrence 1, recency 0.79, importance 0.8, density 0, gap 0. Reasons: "Asked 13× in UP Lower Sub. Prelims, UP RO/ARO Prelims, UP UDA/LDA Prelims, UPPCS Mains, UPPCS Prelims (1998, 2001, 2004, 2008, 2009, 2010, 2011, 2013, 2014, 2016, 2017, 2023)", "Recurs across 12 years", "Last asked 2023", "Core syllabus place".
- Hooghly: 0 PYQs, but score 34, medium. Reasons: "Core syllabus place", "Linked to 7 places, 5 of them asked", "Important but not yet seen in the collected papers".
- Top of the order: Chenab 86, Arabian Sea 86, Mediterranean Sea 86, Tungabhadra 85, Beas 84.

**Edge cases:** an empty ledger means no `pyq`/`yield` anywhere and the UI hides the panel and the priority order. There are no claims without data (`applyPyq`). A place drawn on both sheets (New Delhi) resolves to both (`also`), not "ambiguous". The PDFs are geography papers, so protected areas are under-represented: Kaziranga, Corbett and Harike show "important but not yet seen".

### 4.6 Recall questions

Where: `src/atlas/questions.ts`. Used by Field review, "Test me", and the two optional questions during breaks. Mastery rules are in `src/atlas/mastery.ts`.

**What good looks like**
- **Generated only from gazetteer structure** (positions, states, relations, elevations, facts). Every question has exactly one correct answer and ≥ 3 distractors; if a generator can't find 3 plausible distractors it returns `null`, and another type is tried.
- **Distractors are plausible:** same kind, nearest first (span 8–12), widening to the kind group only when needed. The groups are peak+volcano, lake+wetland, capital+city, island+cape, strait/gulf/sea/canal, and plateau/plain/desert/valley/region/coast/delta/grassland. State distractors are neighbouring states first; border distractors come from India's neighbours.
- **Deterministic:** seeded with `hashString(`${placeId}:${seed}`)`, so the same question appears on every device for the same seed.
- **Prompt templates (exact):**
  - `Where is {name}?` (map pins labelled A–D)
  - `Which {kind word} is marked on the map?`
  - `{name} is in which state or union territory?` / `… which country?`
  - `Which of these does the {name} flows through|extends into?` (multi-state)
  - `{name} is built on|is on|lies on which river?`
  - `The {name} is a {left|right}-bank tributary of which river?`, `Where does the {name} rise?`, `Where does the {name} end?`, `{name} is in which range?`, `{name} lies within which feature?`, `Which of these is a tributary of the {name}?`
  - `{name} is on India’s border with which country?`
  - `Put these in order along the {name}, from source to mouth.` (states, up to 5)
  - `Order these peaks|passes from highest to lowest.` (elevations > 60 m apart)
  - `Order these from west to east.` (> 0.4° of longitude apart)
  - `Which {kind word} is this?` with a masked fact clue
- **Explanations** always teach: the answer, then the place's first fact, e.g. "Nathu La is marked B. Connects Sikkim with the Chumbi valley of Tibet on the old Silk Route." Order questions list the sequence: "Source to mouth: Himachal Pradesh → Punjab …", or "K2 8,611 m · Kangchenjunga 8,586 m · …".
- **Fact clues** mask the name and every alias with `▢▢▢`. A fact is skipped if it still contains a distinctive word of the name (a word over 3 letters that isn't generic like lake/river/pass), or if it has no mask and is under 30 characters.
- **Type choice** favours types the place hasn't had yet (Strong needs 2 types), locate/identify (+0.6, "the map is the point"), and a spatial type once 2 answers are correct (Mastered needs locate or order).

**Mastery bar:**
- Familiar = 1 correct answer.
- Strong = 3 correct across 2 types on 2 days.
- Mastered = 5 correct, including locate or order, spread over ≥ 7 days, with ≥ 85% accuracy over the last 8.
- Review boxes are 1/3/7/16/35 days; a wrong answer resets to box 0.
- At most 12 new places are introduced per day. New places and equally-overdue ones are ordered by study priority.
- Recall XP is +1 per correct answer, capped at 30 a day.

**Known weak spot:** designation facts ("Designated a Ramsar site on … (901 km²).") pass the clue filter but fit many places equally, so they make weak fact clues. This is not fixed.

### 4.7 Expeditions — removed product mechanic

No timer expeditions, travel conversion or checkpoints run. Static generated expedition metadata remains inert for source preservation. The following is historical:

Where: `tools/atlas-build/content/expeditions.mjs`. There are 7: Himalayan, Indian River Journey, Peninsular India, Northeast India, Coastal India, Indian Islands, World Physical Geography.

- **Title:** 2–4 words. **Subtitle:** one line, no period ("From the Karakoram to the Mishmi hills", "7,500 km from Kutch to the Sundarbans").
- **Chapters:** geographic title ("Ladakh and the Karakoram"). Stops `s(placeId, minutes)`: ids have no sheet prefix, and minutes run 20–60 by distance and difficulty. Order follows a real route (source → sea for rivers).
- **Reward:** `{ title, body, icon }`. The title is a keepsake noun phrase ("Silk Route journal", "River pilot’s log"). The body is one present-tense sentence saying what appears on the map ("The Silk Route over Nathu La appears on your map, and a snow leopard watches from Hemis.").
- **Rules:** a checkpoint at each chapter end needs 60% of its places Familiar; stop ids must resolve on the expedition's sheet (the build warns otherwise).
- **Map representation:** the bundled sheet draws the current chapter’s reached stops and next stop from expedition progress. The route is the existing study overlay, and selecting a place opens its established detail panel. Do not generate additional route geometry. All place facts are freely accessible; focus advances Travelled history and expedition stops, while recall checkpoints retain their established meaning.
- **Presentation:** the relief image and all vector/label overlays share one sheet coordinate system. At rest and at minimum zoom the sheet covers the central viewport; panning never reveals the paper around it. India and World remain separate bundled projections. Zoom clamps before applying a cursor, tap or pinch anchor, so reaching the zoom limit cannot shift the view. Search, full-screen, map styles, layers and recall remain available offline.

### 4.8 Challenges

Current: retain only existing d-review, w-recall and w-pass definitions, ids, targets/rewards and deterministic period seeding. Claims from removed challenge ids remain stored but do not contribute to active XP. The broader challenge set below is historical.

Where: `src/game/challenges.ts`. Each day shows 3 daily challenges (from 11) and 2 weekly ones (from 7). The set is chosen deterministically from the date (`seededRandom('daily:<day>')` / `weekly:<weekStart>`), so all devices match and nothing is stored until a claim.

- **Titles:** imperative, sentence case, digits for numbers, no period: "Complete 3 focus sessions", "Focus for 90 minutes", "Start a session before 10:00", "Finish a 45+ minute session without pausing", "Plan tomorrow: schedule 3 tasks", "Review 8 places in the Atlas", "Make a mountain pass Strong" (singular form when n = 1).
- **Rewards are formulas, not free choice:** e.g. `d-sessions` 10 + 5n, `d-minutes` n/3, `w-hours` 8n, `w-pass` 40 + 20n.
- **Progress is measured from history:** sessions, completed tasks, recall answers, expedition minutes.

### 4.9 Notifications, reminders, toasts

Exact current strings; keep new ones in the same shape.

- **Phase end, native (scheduled, `timer/store.ts` → `notificationText`):**
  - "Focus complete ✦" / "<task> · Take a 5-minute break." (or "long break")
  - "Break is over" / "Back to it – your next focus block is ready."
- **Phase end, web (`announcePhaseEnd`, only when hidden):**
  - "Focus complete" / "Time for a 5-minute break." (plus " · <task>")
  - "Break is over" / "Focus has started." or "Ready when you are."
- **Missed sessions replayed after sleep:** toast "Focus session completed" / "2 focus sessions completed", with body "1h 15m recorded while you were away."
- **Derived reminders (`services/reminders.ts`):**
  - task: title = task title, body "Due <date>[ at <time>]" or "Task reminder"
  - event: title = event title (or "Focus block: <title>"), body "Starts at 3:00pm · <location>" or "Today"
  - habit: title = habit name, body "Keep your habit going today"
- **App:**
  - "You’re offline" / "Tars keeps working – everything is saved on this device."
  - "Back online"
  - "A new version is ready" / "Reload to update – your timer keeps running."
  - "Ready to work offline" / "Tars is installed on this device."
- **Rules:** a reminder is derived from its task, event or habit at delivery time; it is never stored as its own record, so it can't drift. A notification tag or route always points to the screen that acts on it (`#/focus`, `#/tasks?task=<id>`, `#/calendar?date=<day>`).

### 4.10 Derived status text

- **Today's load (`features/tasks/TasksScreen.tsx`):** "4 tasks · 6 sessions left ≈ 2h 30m". Over goal, it adds "That’s more than your remaining goal (1h 10m). Consider moving something to tomorrow."; with no estimates, "Estimate sessions on tasks to see your day’s load."
- **Immersive status line (`ImmersiveFocus.tsx`):** "Until 3:17pm" while running, "Paused", "Open focus", else the phase label. It never repeats the phase name while running.
- **Session complete sheet:** "Session complete" / "Session saved"; "How focused were you?" (1–5); the notes placeholder is "Notes – what did you get done? What’s next?"; then "New discovery" / "3 new discoveries".
- **Onboarding:** four loop items (Plan · Focus · Track & review · Explore), each with a one-sentence body, then "Choose your base camp".

### 4.11 Sample history (`src/data/demo.ts`)

- Deterministic (`seededRandom('tars-demo')`), 120 days. Every id starts with `demo-` so it can be removed cleanly (`removeDemoData`).
- Weekday-heavy rhythm: skip chance is 55% on Saturdays and 40% on Sundays; on weekdays it starts around 12% and falls further over the 120 days. Weekdays get 1–5 sessions, weekends 1–3.
- Session lengths come from [25, 25, 25, 50, 50, 45, 90] minutes; 88% are completed; 15% carry the note "Good momentum – next: practice questions."; 50% are rated 3–5; 30% have one pause.
- Content is **generic university study**, not UPSC: Finals 2026 › Biology › Cell biology, Chemistry, Calculus, History essay, Spanish. Also 6 tasks, 5 calendar items (lecture, 2 focus blocks, a midterm, a deadline) and 2 habits.

### 4.12 Exports

- **Sessions CSV** (`tars-sessions-<stamp>.csv`) columns: `id,date,start,end,duration_minutes,planned_minutes,mode,completed,label,project,task,rating,pauses,note,source`. Times are ISO 8601; minutes have 2 decimals.
- **Tasks CSV** (`tars-tasks-<stamp>.csv`) columns: `id,title,status,project,label,tags,priority,planned_for,due_date,due_time,estimated_pomodoros,completed_at,subtasks,notes`.
- CSV handles quoting, a BOM and formula injection (`src/lib/csv.ts`, tested).
- **JSON backup** (`tars-backup-<stamp>.json`): `{ app: 'tars', version: 3, exportedAt, settings, tables, tombstones, extras? }`. Import merges (newest wins) or replaces, and accepts `app: 'lodestar'` and v1/v2 backups.
  - `extras` (v3, `src/data/backup-extras.ts`) carries what lives outside Dexie: `notes` (the short notes, `tars.current-affairs.notes.v1`) and `currentAffairs: { state, articles }` (read/saved/removed marks per article URL from `tars.current-affairs.state.v1`, plus publisher metadata – title, link, date, never article text – for exactly those URLs from the archive store). No Dexie schema change was needed.
  - Everything read from a file goes back through the live parsers (`parseStickyNotes`, `parsePersonalState`, `archiveRecord`): unknown fields, over-long text, inactive publishers and untracked articles are dropped. An unknown `extras` format is refused with a readable `BackupError`.
  - A backup **without** `extras` (every v1/v2 file) leaves notes and reading state untouched in both modes – it never covered them, so it must not erase them. A v3 backup in replace mode loads them exactly (an empty `extras` clears them).
  - Merge: notes are a union by id and a deletion on either side wins; reading marks keep the later time from either side (an unmark has no timestamp, so it cannot beat a mark); a local article note is kept; article metadata is added where missing or newer. If what is stored on the device cannot be parsed, that part is left alone and the toast says so.
  - "Erase all data" also removes the notes, the reading state and the article archive (`eraseExtras`); preferences in localStorage (theme, motion, ambience) stay.
  - Tests: `src/data/backup-extras.test.ts` (round trip to an empty device, merge both ways, idempotence, v2 and `lodestar` files, unreadable local state, sanitising, newer-version refusal, erase).

### 4.13 Brand assets

- `assets/icon.svg` is the only source. The Tars mark is four slabs (four focus blocks to a cycle) standing together as a T, in golds (`#f2c46d`, `#efbc5c`, `#e6a940`, highlight `#ffe6ae`) on a dark navy tile (`#070913`–`#1e2540`). The PNG canvas background is `#0a0c14`, the same as the Night theme and the manifest colours.
- `node scripts/generate-icons.mjs` renders every PWA, Android and iOS PNG plus `public/og-image.png` (maskable and adaptive versions are padded to the safe zone). Never hand-edit the PNGs; regenerate them.

### 4.14 News external RSS link collection

Current presentation (2026-10-04) supersedes the older UI descriptions below: 180px desktop News collection rail from 1024px, wide editorial rows, Newsreader headlines, bounded RSS excerpts and genuine optional feed thumbnails, visible Read/Saved state and Open Original links. Smaller layouts use four compact state tabs and secondary controls. Search is collapsed by default; filters/Sources use the existing contextual sheet. No active Notes, analytics workspace, internal reader or detail surface. Both dormant note stores and existing feed/classifier/archive/Read/Saved semantics remain unchanged. QA includes direct headline and Open Original popup URLs, reload/cross-tab persistence and byte-preserved dormant dated-note data. Reading state and note backup behavior retain the existing v3 extras mechanism (§4.12).

Online-assisted original publisher links, never generated summaries or article-body storage. Today shows only the rolling past 24 hours; top-corner Archive opens older metadata, descending by publication, with no Today overlap. Exactly To be Read (default), Read and Saved: saved state takes precedence, marking done moves pending to Read, and read saved articles remain Saved. Counts/completion/minutes-left are derived, hidden filters stay resettable. One centered list at all sizes with direct publisher links, inline read/save/remove (Undo), optional RSS thumbnails, bold unread and muted read headlines. No article-context popup, Study mode or article shortcuts. Grouped topics show only recent members in Today while retaining all state keys. Archive has Daily/Weekly/Monthly/Yearly filters; search, subject/exam/publisher/time plans remain compact. RSS excerpts remain bounded metadata, never manufactured summaries. Generic search references remain absent; only debug reveals classifier/priority evidence, normal rows show a Must Read star.

Publisher registry: 39 verified RSS feeds / 9 publishers (Indian Express, The Hindu, Mint, Hindustan Times, Business Standard, BusinessLine, The Tribune, Guardian, Down To Earth). RBI/SEBI/PIB are removed from fetching and filtered from older cached responses using active source IDs. Supported headline concepts plus substantive demand remain the main acceptance path; explainers with matched concepts do not need a policy verb. Runtime coverage-aliases.ts adds common news terms (GDP/UPI/FCRA/glaciers etc.) to existing concepts without rebuilding the CSE index or inventing counts. Verified Indian Express UPSC articles also have a publisher-curated path after noise exclusions; unmatched ones use General studies / general exam and do not claim PYQ evidence or enter exam-specific filters. Reject sports/celebrity/consumer/stock moves, routine crime, quizzes/MCQs/practice and routine court notices. Complete-link clustering requires the same IST day, a shared concept, ≥3 informative title tokens, shorter-title overlap ≥0.6 and Jaccard ≥0.35 (or identical normalized title). Missing dates stay separate. Primary preference uses section depth and capped excerpt vocabulary before source/relevance/URL ties; grouped alternate links stay accessible inline. Read/save tracks the topic through member URLs; no generated explanation.

Index: 106 signals / 41,115 bytes, verified 3,896 canonical CSE Prelims plus 1,130 actual GS I–IV Mains PYQs at repository commit `31cd820df0506fd1ffeb818ff0e2b2357d95c7a0`; 15 local taxonomy ZIPs, optional Sociology excluded. Practice/optional/PCS/CDS data and complete question bodies never ship. `tools/current-affairs/fetch-mains.mjs` retrieves a hash-pinned build-only input; `build-relevance.mjs` derives the checked-in runtime JSON without network. Taxonomy extraction reads only adjacent single-line id/title scalars and JSON required-concept lists; it is not a general YAML parser or an exact mapping audit. Feed and classification coverage are deliberately incomplete.

Must Read uses centralized threshold 7 over existing evidence: classifier strength (1/2), maximum matched CSE document frequency (1/2), taxonomy specificity (1), institutional/convention connection (1), cross-publisher coverage (1), explainer (1), both-exam demand (1). The official-source bonus was removed. This is a study heuristic, not an exact mapping/prediction. Reading estimates: standard 3, UPSC 4, Explained 6, analysis/opinion/editorial 7 minutes; no article fetching. tars.current-affairs.state.v1 stores only version 1 URL-keyed readAt/savedAt/ignoredAt and legacy note (8,000 characters), applies event actions to known member URLs, rereads before writes and listens to storage events. Legacy article notes are preserved; removal hides known topic members without erasing read/save flags. Corrupt/future state and failed writes are surfaced/preserved; storage is outside Dexie backups. Detailed rules, feed sources, state shape and limits: docs/TARS-VNEXT-JOB-6-CURRENT-AFFAIRS-WORKSPACE.md.

Local archive: separate native IndexedDB tars-current-affairs-archive-v1/schema 1/articles URL-keyed store. Accepted allowlisted RSS metadata plus firstSeenAt/lastSeenAt survive feed omission; no bodies, stored classification or counters. Top-corner Archive excludes Today and defaults to All older dates with Daily/Weekly (Monday)/Monthly/Yearly views, including prior-year Saved links. Read/save retains localStorage v1. Transactions preserve previous data on stale/failed writes; errors surface, BroadcastChannel refreshes other tabs. Capture occurs on visits/refresh/reconnect and hourly while this screen is visible/resumed; no historical backfill or closed-app collection. No age expiry, subject to browser quota/eviction/cleared origin. Both archive and CA state are outside Dexie backups. Rendering reveals 50 rows at a time.

Reading analytics (top action, collapsed initially) derives totals/read-save-pending-removed, 7/30-day reads, current streak, 14-day activity and subjects across Today/Archive. Topic members count once; orphan tracked URLs count with unknown time/subject disclosed. Saved read and removed read history remains included; unread/unsave changes current totals. Activity is based on marking dates in IST; minutes are estimates, not dwell. New marks count immediately.

Short notes (top `Short notes` action, small Sheet; the same collection as the Notes workspace and quick capture): user-authored text only, maximum 300 characters, no generated summarization/headers; preserve line breaks and literal escaped text, trim only outer whitespace. tars.current-affairs.notes.v1 stores version 1 UUID entries with id/text/createdAt/system-local createdDate and optional deletedAt tombstone. Save captures the device date; notes sort newest first. Removal/Undo preserves created date, fresh-storage writes/cross-tab events preserve other notes, blank/oversized input is refused and failed writes retain the draft. Browser Print notes outputs only dated personal notes in white/black, suitable for Save as PDF; empty collections cannot print. No article content enters notes automatically. This independent collection and legacy article notes are outside Dexie backups; origin eviction/clearing loses local data.

### 4.15 Focus room content: lines, wallpapers, sounds, music

**Required quality follow-up (owner, 2026-10-03):** the generated wallpapers/audio and generic lines below are the existing implementation, not accepted content quality. Do not replace them during J-23–J-25. Future media must meet the owner's quality bar and have verifiable reusable/licensed rights plus source/credit metadata; future quotations must be real, with verified exact wording, author and source. Never invent an attribution. Preserve the persistent audio and timer contracts when replacing content. The historical generation rubrics below remain implementation checks only.

Everything the Focus room shows or plays is **original to Tars and made by code or written for it** – no third-party artwork, recordings or quotations, so there is nothing to license, attribute or download, and all of it works offline. Do not add downloaded media or real quotations without asking the user (source, licence and size need their go-ahead).

**Lines under the clock** (`src/features/focus/quotes.ts`, 520 lines in six groups: focus, discipline, learning, calm, perseverance, beginning).
- Good: one full sentence (two short ones at most), 96 characters or fewer, sentence case, ends with a full stop or question mark, concrete and second-person or impersonal, calm rather than rousing. Real examples: “One page, fully read, beats ten pages skimmed.” · “Your mind wanders. Walk it back, kindly, and continue.” · “Let the phone be bored for a while.”
- Avoid: attribution of any kind (these are not quotations – never add a name, “Anonymous” or a dash), exclamation marks, straight quotes or apostrophes, em dashes, hustle clichés (“grind”, “no excuses”), anything that shames a missed day, near-duplicates (the test compares letters only).
- Rubric: `quotes.test.ts` – at least 500, unique, ≤ 96 characters, starts with a capital, ends with `.` or `?`, none of `! ' " —`.
- Selection: one line per day by default (`pickOfTheDay`), next/previous by the learner; the choice is in `localStorage['tars.focus.ambience']`.

**Wallpapers** (`src/features/focus/wallpaper/scenes.ts`, 264 scenes from 22 scene families, each in several palettes and seeded variants; 8 categories: Night city 42, Rain 24, Cozy room 34, Study 16, Lo-fi 12, Retro 24, Nature 92, Sky 20).
- Good: a flat-illustration scene of a few dozen SVG shapes at 1600 × 900 (`preserveAspectRatio="xMidYMid slice"`), dark enough in the middle band that white digits read on it (the stage adds a scrim), no text, no people's faces, no brand or recognisable artwork. Names are “Family · Palette” (“City lights · Indigo”, “Library · Indigo”, “River valley · Mint”), with a number for further variants.
- Each wallpaper is `family × palette × seed`; randomness is seeded (`rng(hash(id))`), so an id is the same picture on every device. They are rendered on demand to a data URI; only the one shown (and thumbnails in the picker, lazily) exist at any time.
- Edge cases: an unknown id falls back to the first scene; “No wallpaper” shows the plain stage; reduced motion disables the cross-fade between wallpapers.

**Ambient sounds** (`src/audio/catalog.ts` names; `sounds.ts`, `sounds-more.ts` synthesis; 34 sounds in 10 categories: Weather, Water, Forest, Nature, Night, Fire, Café & study, Urban, Transport, Noise & tones).
- Good: a seamless loop of 8–40 s that can run for hours unnoticed: steady texture with sparse, irregular events (drops, crackles, a far bird), nothing melodic or startling, RMS roughly 0.02–0.18, peak below 1. Names are plain nouns (“Rain on the window”, “Train carriage”).
- How: each `SoundDef.render` builds a small Web Audio graph in an `OfflineAudioContext`. Short events use `dsp.burst` and `dsp.note`, which compute samples directly into one buffer per destination (as nodes, a thousand raindrops took 8 s to render; now 0.25 s). The seam: by default the tail is crossfaded over the head (`crossfade`, 1.5 s); rhythmic sounds use `fold` (the tail is added onto the head, continuous parts use `seamGain`, periodic parts complete whole cycles in the loop).
- Rubric: `tools/perf/audio-check.mjs` renders all of them and fails on silence (RMS < 0.004), a peak above 1, a non-finite sample, or a step across the loop point larger than 1.5× the largest step inside the loop. `src/audio/catalog.test.ts` keeps the catalogue and the renderers in step.

**Study music** (`src/audio/music.ts`, 36 tracks in 6 genres: Lo-fi 8, Piano 6, Ambient 6, Synth 5, Deep focus 5, Rain-backed 6).
- Good: music that can be ignored – slow harmony, soft attacks, no hooks, no vocals; a loop of 8 bars (20–40 s) that plays for about 3.5 minutes before the next track is crossfaded in. Track names are two words, sentence case, about a study scene (“Desk lamp”, “Margin notes”, “Blue hour”).
- How: `pieceFor(id)` derives tempo, key, mode, progression and swing from `seededRandom('music:' + id)`, so a track is the same piece everywhere. Struck and plucked voices are sums of decaying sine partials (`dsp.note`); only pads are oscillator nodes. Reverb is six damped feedback delays (`dsp.reverb`; the feedback filter is a shelf so the loop can never exceed unity gain). Rendered at 32 kHz, 6 s of tail folded onto the head, then normalised to RMS 0.11 with a 0.9 peak ceiling. Desktop render time 0.7–1.4 s per track; the next track is rendered 45 s before it is needed.
- Avoid: convolution reverb (ten times the render cost), a low-pass in a feedback loop (it resonates above unity and runs away), per-note oscillator nodes (cost scales with notes × loop length), adding a track without checking it with `audio-check.mjs`.
- Ready-made mixes: 14 in `catalog.ts` (`MIXES`) plus the six seeded into `audioPresets`; a mix is 2–3 layers at 0.2–0.6.

## 5. Current state (2026-10-03)

**Current product and active work:** the latest Editorial Cartography presentation authorization supersedes the earlier overhaul pause, as recorded in §0a and `docs/TARS-EDITORIAL-REDESIGN.md`. The prior Atlas + News reduction and runtime repairs remain accepted history. J-23 stays accepted; J-24/J-25 remain protected and unaccepted. No renderer roadmap or retired feature job is executable. The table below records earlier checkpoints; removed-feature entries and older validation counts are historical.

### 5a. Historical premium roadmap progress

| Job | State | What changed, and the evidence |
| --- | --- | --- |
| J-24 Tile worker/cache | in progress | Bounded24/48-tile worker/idle renderer, independent progress tiles, cancellation and release/recreate. Renderer5/5 passes after fixing an overview regression: coarse fallback strokes now use the requested ink scale, the preceding overview stays until replacement coverage, and fallback layers remain beneath detail. Expanded pixel checks exposed downsampling differences; investigation continues, tolerance remains provisional and requires owner agreement. Latest shared-commit source309 tests/36 files and typecheck/build pass (238 entries/7503.21KiB); overview build238/7503.67KiB passes. Latest full phone run before the shared-commit/overview fixes failed9/11: zoom116.6/133.4ms p95,4/6 frames>100,whole-pan maxima133.3/83.3/166.6ms,heap20.7MiB. Latest source still requires full timing/browser/offline/learning and lint reruns. Neither job accepted; docs/TARS-PREMIUM-J24.md. |
| J-25 Label layer | in progress under owner exception | HTML point names retain paused positioning animations and individual fades. Shared worker placement/font metrics/curve rasterisation retains exact algorithms and bundled Manrope, main-thread fallback and bounded cache. Real-font placement18/18 and327 curve rasters match exactly (MAE0); five hook tests cover replies, failure, bitmap closure and committing symbol identities with their matching name snapshot. SVG symbols retain checkpoint appearance; one group compensation keeps pending snapshots aligned. Shared-commit source309 tests/build pass. Pinch6/6 cases passes size/position budgets (max1.23% width variation,0.8ms desktop/3.7ms phone), but an earlier full gesture produced67.9ms positioning and failed timing. Phone counts9/9 passed after shared commits; its offscreen tap selector is repaired and requires rerun. Complete style/timing/browser acceptance remains pending. Unshipped alternatives have not passed; docs/TARS-PREMIUM-J25.md. |
| J-23 Renderer extraction and spike | done | `AtlasMap.tsx` reduced to 514 lines; `renderer/{types,palette,glyphs,SvgLayers,useMapCamera,gestures}` split out with the same public exports. Ten gesture sequence tests cover pan, fling/rest, pinch, handover, wheel easing, trackpad, double/two-finger tap, keys and detach. Palette, glyph, SVG and gesture bodies compared text-identical to `3e43def` apart from exports/indentation. Typecheck, 292 tests, lint 0/402, build (236 entries / 7,457.46 KiB), Atlas 21/21, smoke 12/12, fullscreen, Tars 51/51, dev features 21/21 and responsive Paper/Night layout pass; 29 gesture and 10 app budgets pass. Spike selects CSS tile containers and unscaled HTML names (J-25 must still meet its positioning budget). Quiet checkpoint/J-23 pan p95 16.8/16.9 ms; zoom-out is highly variable in both builds, with the same 9 >100 ms frames. No performance improvement claimed. Source bodies and protected paths reviewed, no app regression found. Full evidence: `docs/TARS-PREMIUM-J23.md`. |
| J-01 Error boundaries | done | `src/ui/ErrorBoundary.tsx` (`ErrorBoundary`, `ScreenError`, `AppError`), `src/lib/lazy.ts` (`lazyScreen`: one automatic reload for a stale chunk, guarded by `sessionStorage['tars.chunk-reload']`). `App.tsx` has three boundaries: whole app, the route host (reset on route change), and global overlays (`OverlayBoundary`: closes the overlay, toasts "That couldn’t open", gives up after three failures in 10 s). `Sheet` wraps its body so a throwing dialog closes itself. `src/lib/crashTest.tsx` throws in DEV for `?crash=route|sheet`. `tools/perf/error-recovery.mjs`: 12/12. |
| J-02 Lint and format | done | `eslint.config.js` (ESLint 9 flat; `@babel/eslint-parser` because TypeScript 7 has no JS API for `typescript-eslint`; react-hooks, jsx-a11y; project rules `tars/raw-button` and `tars/arbitrary-token` as warnings). `npm run lint` must report 0 errors; `npm run lint:counts` prints warnings per rule – the baseline was 445 (284 arbitrary-token, 121 raw-button, 15 exhaustive-deps, 25 jsx-a11y) and may only go down. `npm run format` (Prettier, `.prettierrc.json`) is opt-in per file: the tree was never formatted and is not reformatted wholesale. |
| J-27 Budgets in CI | done | `tools/perf/budget.mjs`; `--budget=<json>` on `gesture-audit.mjs` and `app-audit.mjs`; `tools/perf/budgets/{gesture,app}.json`. Budgets are counts (repaints, label commits, rAF callbacks, skeletons, touch targets), not milliseconds, so they hold on slow runners. Tighten a budget in the same change that improves the number. |
| J-11a Atlas settle and repaint policy | done | `AtlasMap.tsx`: rest is detected from the frame loop (`watchForRest`: `SETTLE_FRAMES` still frames and `SETTLE_MS` without movement, nothing pending), not from a timer; `paintInFlight` stops a repaint starting while one is being rasterised. Per zoom gesture: 2–4 repaints and 1–2 label layouts on all three shapes (was 4–9 and 3–8); 15–27 fps (was 8.5–21). Each remaining repaint still holds a frame 400–550 ms (stage B, J-24). |
| J-11b Atlas names while dragging | done | Names and symbols are laid out `o` px beyond the view (`size.o`: 30% of the shorter side, max 260; 20%/120 on low-power devices) and positioned in a **frame** that only changes with the zoom (`Layout.fx/fy`), so after a pan every name still shown has identical coordinates and only names entering or leaving touch the DOM. While a pointer is down a layout is requested at most every 250 ms once the view has used half the overscan (`HOLD_LAYOUT_GAP`, `layoutPending`). `labels.ts`: `overscan`, `prefer` (a point name keeps its side of the symbol). Held drag: 100% of names and symbols on screen, 100% keep their position after release (was 6–42%). The label layer is `contain: layout style` (it must not clip to a box); anything long (routes, pins) is drawn inside a nested `<svg>` the size of the laid-out area, or the layer grows to the size of the sheet and every small change rasterises all of it. |
| J-11c Atlas overlay, tap, edges, resize | done | Highlights are on their own layer (`overlayLayer`); a tap on a place selects at once where the card is not modal (`instantSelect`, desktop) and shows `.is-pressed` on contact; taps are timed by `event.timeStamp`. A held drag or pinch past a bound gives (`softClampT`, `RUBBER`) and springs back (`springBack`); reduced motion stops at the bound. `flyTo`/`reveal` take `MapInsets` with `left`/`right` (the desktop inspector). Painted layers are resized only in `paint()` (`layerGeom`), so the rail collapsing or full screen is one base repaint (was 3–5). Tap → card 17–63 ms on desktop (was 276–330). |
| Atlas travel treatment | done | Nothing marks where the learner has *not* been: no fog, no hatching, no muted names or symbols. Travelled states get a warm wash and edge (`TRAVELLED` in `style.ts`, `tone.travelled`), travelled places a warm ring (`data-travelled`). The Legend says the same. |
| J-10b Clock readouts as leaves | done | `src/timer/clock.ts`: one second ticker for the app (`onSecond`), `useTimerValue(select)` / `useClockText()` / `useTimeValue()` re-render a component only when its derived value changes. `ClockText.tsx` has the leaves. `useNow` is left only in the calendar (minute step). Focus running 10–14 ms/s desktop, 77–104 at 4× (was 185–368 / 900–990); Home with a session 12 ms/s. |
| J-03 Instant navigation, shell-first boot | done | `app/screens.tsx` (`SCREENS`, `preloadRoute`, `preloadRoutesWhenIdle`); the stage renders `useDeferredValue(route.name)`, so the current screen stays until the next can draw. `lazyScreen` components have `preload()` (a failed preload is silent and forgotten). Rail and tab items preload on pointer-down, hover and focus. The frame (rail/tab bar, stage) renders before the database opens. First visits 29–49 ms on desktop with no skeleton (was 330–644 ms with one). |
| J-28 Start-up weight | done | Entry chunk 145 KB raw (was 279). `app/Overlays.tsx` mounts each global overlay from first use and preloads them on idle. `useAtlas(load)` / `useExploration(load)`: callers that only want the gazetteer if present pass `false`; the app requests it once on idle after start-up. Labels, projects, profiles, goals, events and settings are shared live queries; `useLookups` is memoised. `og-image.png` is not precached; Manrope Latin is preloaded; Fraunces italic is gone. |
| J-04 Tokens v2 | done | `index.css`: radius roles (`rounded-cell/key/field/card/panel`), `elev-0…3`, `layer-*`, state-layer and control-size variables, `warning/info/correct/incorrect` with soft fills (≥4.5:1 on all four surfaces), type roles `t-display-m`, `t-body-l`, `t-text`, `t-micro`, variants `fine:` `coarse:` `reduced:`, `<html data-density>`. Dead code removed (unused `.type-*`, `Row`, duplicate `prefersReducedMotion`, the serif flags in `labels.ts`). |
| J-05a–d Primitives | done | `src/ui`: `Pressable` (state layer, press depth, 44 px hit area on coarse pointers, one haptic per activation, `loading`), `Button`/`IconButton`/`Chip` on it (same props; `IconButton` shows a `Tooltip` instead of `title`), `selection.tsx` (`Tabs`, `TabPanel`, `SegmentedControl`, `Switch` with drag, `SwitchRow`, `Checkbox`; `Segmented` and `Toggle` are the old names), `fields.tsx` (`Field`, `TextInput`, `TextArea`, `Select`, `SearchField`, `DateField`, `TimeField`, `Slider`), `list.tsx` (`ListRow`, `Group`, `Progress`, `Badge`, `Skeleton`), `patterns/question/AnswerTile`. Styles in `src/ui/ui.css`. Gallery: `#/settings?gallery=1`. DOM tests: `src/ui/primitives.test.tsx`, `src/ui/surface/surfaces.test.tsx` (happy-dom, Testing Library). |
| J-06 Motion v2 | done | `ui/motion.ts`: `DUR` (instant/fast/base/slow/calm), `SPRING` (snap/glide/surface/settle), roles in `M` (reveal, swap, push, pop, dialog, backdrop, listItem, success…). `lib/motion.ts` is the one source for reduced motion: `motionPreference()`, `<html data-motion>` set before first paint (`index.html`), Settings › Appearance › Motion (Auto/Reduced/Full, localStorage `tars.motion`). The global `*` rule is gone; `ui.css` has per-role rules (movement becomes a fade, loops off, progress still moves, the spinner becomes pulsing dots). `MotionConfig` reads the same value. |
| J-07a–c Surfaces | done | `src/ui/surface/`: `core.ts` (`useSurface`: layer stack, focus in and back, Tab trap, `inert` on what is behind a modal, scroll lock, outside press, Escape, **Back closes the top modal surface** through a pushed history entry; `closeTopSurface()` for the Android button), `Dialog`, `BottomSheet` (detents: fraction, px or `'auto'`; drag from grip, header or scrolled-to-top content; velocity settling; `modal={false}`), `SidePanel` (beside the content from 1024 px, resizable, remembered; a sheet below), `Popover` (flip and shift; `sheet` option on phones), `Menu` (arrows, Home/End, type-ahead), `Tooltip`. `Sheet` is a wrapper choosing Dialog or BottomSheet. The `Toaster` is portalled to `<body>` because `#root` is inert under a modal. |
| Focus redesign (with J-14, J-22) | done | `FocusScreen.tsx` is a full-stage study room: a generated wallpaper (`focus/wallpaper/scenes.ts`, 264 scenes in 22 families and 8 categories; `ambience.ts` store; `Backdrop.tsx`; `WallpaperPicker.tsx`), very large digits, a compositor progress bar, phase tabs (Focus · Short break · Long break), the context button, Start/Pause with Stop and Skip, one line from `focus/quotes.ts` (520 original, unattributed lines). Sounds, wallpaper, "Up next" and immersive are small controls in the top bar that recede in a session. Stop morphs the controls into Save / Discard and reset / Keep going (no dialog). The session-complete card replaces the clock on the Focus screen (a non-modal low sheet on phones) and is a dialog only on other screens. Immersive mode is the same screen with the chrome hidden (`<html data-focus="immersive" data-chrome="hidden">`); `ImmersiveFocus.tsx` and `TimerDial.tsx` are gone. The timer-mode switch moved into the Timer profiles surface (`focus/mode.ts`). |
| Study audio (with J-16) | done | One engine at module level in `audio/store.ts` (never owned by a component). Ambient layers with per-layer volume and mute; one music track that hands over to the next after about 3.5 minutes with a 3 s crossfade, and keeps looping if the hand-over is late. 34 sounds in 10 categories, 36 generated tracks in 6 genres, 14 ready-made mixes (`audio/catalog.ts`). Pause releases the voices and keeps the music's place; stop rewinds. Sounds render in 0.1–1.9 s and tracks in 0.7–1.4 s on the development laptop (bursts and notes are computed into buffers, not built from nodes: a rain loop took 8–10 s as nodes). `tools/perf/audio-check.mjs`: 28 of 28 (nothing restarts across routes, the panel, immersive mode or timer ticks; no silence across a hand-over; pause and stop release every voice). Spec: §4.15. |
| J-16 Settings and Soundscape on primitives | done | The sound panel (`features/audio/SoundSheet.tsx`) is a `SidePanel` beside the content from 1024 px (the timer stays in view) and a bottom sheet below: Ambience (in-the-mix rows with `Slider`, mute, remove; category chips; tiles), Music (now playing, genres, tracks, saved links), Mixes (saved mixes with a delete button that is always there, ready-made mixes, Follow the timer). Settings: every switch is a full-row `SwitchRow`, volume is a `Slider`, action rows are `ListRow`; the labels list and the music dock use `ListRow`/`IconButton`. The Focus stage sizes its clock in container units, so it fits beside the panel. |
| J-18 Delete with Undo | done | `src/data/deletion.ts`: `deleteEvent/Goal/Session/Habit/Label/Project` remove the record and what depends on it in one transaction and return `{ undo }`. Undo restores the records exactly and removes their tombstones; re-pointed dependents (a label's topics, a project's tasks) go back only if they are still where the delete left them. The six confirm dialogs are gone; "Replace everything" and "Erase all data" keep theirs. Tests: `deletion.test.ts`. |
| J-19 Toasts and palette | done | `ui/toast.ts`: countdowns stop while the pointer or focus is on a toast and are cleared on dismiss; at most three; the last action that offered Undo stays undoable for two minutes (`undoLast`). `Toaster`: above the tab bar on phones, top centre from 768 px; swipe sideways to dismiss. Palette: "Undo: <what>" first while something can be undone, and a Recent section (the last four fixed commands, `localStorage['tars.palette.recent']`). Tests: `toast.test.ts`. |
| Backups with notes and reading state | done | Backup format v3 adds `extras` (short notes, Current Affairs marks and the metadata of the marked articles). No Dexie schema change. Older backups restore as before and leave these alone. Details and merge rules: §4.12. Tests: `backup-extras.test.ts`. |
| J-08 Route state, scroll, Atlas keep-alive | done | `app/routeState.ts`: `useRouteState(key, initial)` keeps view state for the session (calendar anchor and view, Insights range, filter and roll-up, Notes view, Plan label filter, Current Affairs tab, filters and archive position, Atlas sheet); each workspace keeps its own scroll position; the Plan view is remembered in the address (`lastHashFor`). Pressing the item of the workspace you are on resets it (`resetRoute`) and scrolls to the top. Each screen is pinned to the route it was shown for (`RouteContext`), so the screen being left no longer re-renders for the next screen's address. **The Atlas is kept alive** in the window layout (not on phones or low-power devices): after its first visit it stays mounted and laid out behind the stage's opaque scroller (`.kept-screen`), told it is not in front through `ScreenActive` (no window listeners, no animation frames, CSS animation paused, deep links ignored, modals closed on leaving), and shown in the same render when you return. Return is painted in 85–100 ms with no stall after (a remount took 320 ms to draw and then held a frame for 0.4–1.8 s). `tools/perf/route-state-check.mjs`: 27 of 27. Two traps, both measured: hiding it with `display: none` (React `<Activity>`) rebuilds and re-rasterises the vector map on return; `inert` on the whole screen restyles the map and costs about 1.2 s each way – so everything *around* the map is made inert and the map takes itself out of the tab order. |
| J-09 Shell alignment | done | Every workspace header and toolbar uses one column (`HEADER_COLUMN` in `app/Workspace.tsx`; Home's and Focus's headers too), so the title is at the same x on every route at 1366 and 1920 px. Collapsing the rail and hiding the chrome lay the stage out once and move it with a transform (`app/shellShift.ts`); padding and width are no longer transitioned. On phones no tab is selected on Notes, Insights or Settings, and Back (`router.goBack`) returns to the previous in-app screen or to Home – never out of the app. Plan's views are the `Tabs` primitive (`kind="nav"`); below 640 px Inbox, Projects, Habits and Done sit behind one "Lists" menu that shows the list you are on. `tools/perf/header-check.mjs`: 19 of 19; `shell-check.mjs`: 49 of 49. |
| J-10 Focus dial on the compositor | superseded | `TimerDial.tsx` `useProgressAnimation`: the arc (two half rings behind clips) and the head are HTML layers, each with one Web Animations transform animation as long as the phase, positioned at the engine's elapsed time; a 1 Hz check corrects drift over 250 ms and lights ticks. 0 rAF callbacks/s while running (was 60–120); main thread 17–32 ms/s desktop (was 185–368), 115–135 ms/s at 4× (was 900–990). `tools/perf/dial-check.mjs`: 22/22. |

**App-shell UI overhaul (local/uncommitted, on top of the staged Job 6 cleanup):** Tars is now one application frame rather than a set of dashboard pages. From 768 px a navigation rail sits on the canvas beside an inset, rounded **stage** that scrolls inside itself; below that the stage is the page and a five-tab bar (Home · Plan · Focus · News · Atlas) sits at the bottom. New `#/home` is the default route and answers "what now": one raised action surface (the running session, else the next planned task, else Start focus), then today's remaining tasks with inline quick add, then "Pick up" rows (Current Affairs, Atlas, Notes, Insights) and one quiet today/streak line – no stat tiles. New `#/notes` is a paper-note board over the existing sticky-note storage, with a read-back of focus-session notes; **quick capture** (C, rail, palette) saves a note or a task from anywhere. The Calendar is a view of Plan (shared `PlanTabs`); Focus lost its stat cards and gained a calmer session state (frame melts, navigation dims); Insights leads with one number and its chart; Atlas chrome is two floating capsules and a titled inspector; Current Affairs keeps the single direct-to-publisher list (no inspector/Study mode, as decided in Job 6) on the shared workspace header. Floating `TarsPresence` and the phone timer pill are gone – the rail/tab bar carry the timer and command access (`Ask Tars`). Design language: sans titles, serif only for display moments, sentence-case labels, flat rows instead of cards, capsule controls. No data, timer, Dexie, Atlas-renderer, gateway or Workbox logic changed; no new dependency. Verification (this session, headless Chromium): typecheck; 206/206 root tests; production build (176 precache entries); smoke 12/12; `ui-audit` no layout problems at 375/768/1366/1920 Paper/Night; Current Affairs 279 checks; `tars-check`, `atlas-check`, `fullscreen-regression`, `features-check` 21/21, `job4-actions`, `job4-state-matrix` 48+48, `job4-control-contrast` 40, `job4-visual`, `vnext-learning` all pass. QA scripts were adjusted only where the navigation itself changed (see §9 item 15). Physical-device validation remains unperformed.

**Current Affairs cleanup (local/uncommitted):** direct newspaper list replaces the split panes, article-context popup and Study mode. Inline read/save, optional RSS thumbnails, collapsed filters and broader syllabus vocabulary. Publisher fetching: 39 feeds / 9 publishers including verified Down To Earth RSS/thumbnails. Earlier 38-feed snapshot: 2,600 unique links; new source separately verified with 10 items/10 thumbnails. Topic grouping prefers richer metadata and exposes alternate links. Exclusive To be Read/Read/Saved queues, rolling Today versus top-corner Archive, removal/Undo, analytics and short dated printable notes are implemented. No official feeds or importance bonus, including cached-response display. Typecheck, 206/206 root tests (22 files), build, production smoke 12/12, 279 focused browser checks and diff whitespace pass; 375/1366 Paper/Night list/archive/analytics/notes screenshots reviewed, zero page errors/overflow. Gateway and classifier corpus pipeline, Workbox and URL personal-state format retained; clustering extended within IST editions, separate native metadata archive added; no dependencies/Dexie changes. Validation and screenshots: docs/TARS-VNEXT-JOB-6-CURRENT-AFFAIRS-WORKSPACE.md / ignored tools/perf/out/current-affairs-direct/.

**vNext Job 6:** daily Current Affairs workspace complete: today/IST editions and progress, read/save/notes localStorage v1, deterministic Must Read, metadata search/filters/time plans, exact-only References and sequential Study mode/desktop shortcuts. Initial acceptance: typecheck, 168/168 root tests (19 files), build (170 precache entries / 7,610.86 KiB), production smoke 12/12, focused browser 209 checks (375/1366 Paper/Night, persistence/cross-tab/completion/publisher return, Workbox 503/offline), zero page errors/overflow, visually reviewed screenshots and diff whitespace pass. Job 5 feed/classifier/index/clustering/cache contracts retained, no new dependencies/schema or publisher discovery. See `docs/TARS-VNEXT-JOB-6-CURRENT-AFFAIRS-WORKSPACE.md`. GitHub publication was authorized after completion; no separate deployment was requested.

**vNext Job 5:** Current Affairs / News route, registry-only same-origin gateway, deterministic CSE relevance, conservative duplicate events, static-provider links, transient filters/debug and HTTP-cache offline fallback complete. Eleven enabled feeds returned usable metadata through the HTTP endpoint; PIB’s listed English feed was empty and is disabled. Root 151/151 in 18 files; typecheck/build, production smoke 12/12, focused Current Affairs 69 checks (375/1366 Paper/Night + actual Workbox 503/offline reload), and diff whitespace pass. See `docs/TARS-VNEXT-JOB-5-CURRENT-AFFAIRS.md`. Zero new root dependencies; no Dexie migration, learner persistence, full corpus or article-body delivery. Jobs 1–4 snapshots and historical reports retained; their broad audits were not repeated. Hosted endpoint/device validation remains unperformed; everything is uncommitted, unpushed and undeployed.

**vNext Job 4:** independent stabilization audit; external complete post-Job-3 snapshot at `../job3-safety-20261001-101042/`. Atomic recurring-task/expedition writes, stale-action/context protection, conservative ambiguity handling, midnight/resume refresh, durable review feedback, immutable PYQ answer snapshots, verified offline hashes/upgrade, and focused accessibility/control clearance/contrast fixes. Root 125/125 in 17 files; pipeline 42/42 with package (36 passed/6 explicitly skipped without it); typecheck/build pass. Detailed final browser, visual, integrity and repeated-performance evidence is in `docs/TARS-VNEXT-JOB-4-AUDIT.md`. Inventory remains 149 (72/30/47), all 2,273 IDs and protected timer/persistence contracts unchanged, Dexie v2. Production SVG retained; zoom-in assessment INCONCLUSIVE, not a claimed optimization. No hosted CI/device/deployment acceptance or commit/push occurred.

**vNext Job 3:** implemented action/context/intent/Tars continuity, shared design refresh, curated hotspots/catalogue and additive offline asset manifests; production SVG retained after the isolated map spike. No new root runtime dependency or schema change. Root 112/112; Atlas-build 42/42; typecheck/build pass; workflow 51/51, learning 104/104 per theme, features 21/21, smoke 12/12, Atlas 21/21 and responsive audit 148 checked states. Static initial JS graph 838,992→798,310 bytes. Corrected final phone-viewport profile improves zoom-out p95 278.8→193.8ms, but zoom-in FPS regressed and notch samples varied (54–200ms p95); no overall gesture win is claimed. New deeper regional content/packs and physical-device acceptance are deferred. See `docs/TARS-VNEXT-JOB-2-3.md` for measured limits, statuses and the consolidated implementation report.

**vNext Job 2:** implemented and acceptance-tested, preserving uncommitted Job 1. Free access, travel terminology, floating desktop inspector, shared mobile details, all 149 canonical questions, A–D answer flow, role-safe durable attempts, clean geographic references and Manrope map labels. No DB version change. Root tests 98/98; pipeline 42/42; typecheck/build pass; smoke 12/12, feature checks 18/18, Atlas desktop/phone checks pass; learning QA 104/104 in each of Paper/Night. Responsive dialog opacity and headless fullscreen audit viewport restoration were repaired. All four requested widths and Paper/Night layout audit sweeps passed after repair; four repeated fullscreen exits restore shell chrome. Base camp is optional rather than a forced repeat-visit dialog. Job 2 hard gate passed before starting Job 3. See the consolidated Job 2/3 report for the hard gate and subsequent map decision.


**vNext Job 1:** complete implementation in the uncommitted working tree on `main` (`fbac02d` base). Canonical package integrity and joins pass; the strict 149-question subset and separate coverage/review reports are generated. Typecheck, root tests (92/92), Atlas-build tests (42/42 with the external package, zero skipped) and production build pass. Production smoke passed all 12 checks, including timer run/pause, Atlas selection/pan/pinch, service worker and offline reload, with no page errors. All 149 developer preview articles have four options and no page overflow at 375/1280 px; stratified screenshots and every supported block fixture are in ignored `tools/perf/out/canonical-pyq/`. Two consecutive builds produced byte-identical packs/reports/preview. The legacy `--places-only` rebuild also succeeded (old ledger report 0/0/0); its live-source overlay refresh was reverted to preserve shipped map data. Existing 2,273 IDs, coordinates, sources and `places.json` are unchanged. Geographic review queues remain unresolved; see §4.3a. No UI integration, DB migration, mastery/timer/expedition changes, commit, push or deploy occurred.

**Historical pre-vNext verification:** `npm run typecheck`, `npm test` (89/89 in 11 files) and `npm run build` passed. `tools/perf/atlas-check.mjs` passed on desktop and phone, including full-viewport coverage and a repeated zoom-past-limit check. `tools/perf/smoke.mjs` passed timer, Atlas touch, place selection, service worker and offline reload. `tools/perf/ui-audit.mjs` found no layout problems at 375/768/1366/1920 px, light and dark, including full-screen. Screenshots in `tools/perf/out/screens/` confirm the bundled map fills the central panel. The older pipeline tests (`cd tools/atlas-build && npm test`) passed 15/15 before this presentation-only change; `features-check.mjs` was not rerun because no other feature changed here.

**Works:** timer (sleep/reload-safe), planner, calendar, habits, Insights, Atlas (2,273 places, 1,044 with PYQ history, overlays, layers, search/fly-to, recall and mastery), sounds that follow the timer, command palette, shortcuts, backup/CSV, PWA offline, Capacitor shells.

**Historical checkout note:** older M9/M10 work and camera fixes are already present in this checkout's `fbac02d` baseline. The old local-branch/uncommitted descriptions do not describe this checkout. Jobs 1–4 changes are uncommitted, as requested; preserve them. The pre-Job-2 working tree has a safety copy at `../job1-safety-20261001/`; Job 4's complete pre-audit snapshot is at `../job3-safety-20261001-101042/`.

**Known broken:** no known failing application tests. Map detail/physical-device limitations and source-content review queues remain open. Functional gaps are listed in §9 and §10.

### 5b. Resumed Atlas + News overhaul checkpoint — 2026-10-03

Historical scope/order (paused again on 2026-10-04): `docs/TARS-ATLAS-NEWS-ROADMAP.md`. Focus/Planning jobs J-10/J-10b/J-12/J-13/J-14/J-17/J-18/J-22 and media follow-ups are retired; mixed jobs keep only retained-product/shared work. The audit §23 execution index and definitions are narrowed; older findings are explicitly historical. J-23 stays accepted. Completed shared UI work is preserved.

J-24 continuation: `renderer/BaseLayer.tsx` preserves equivalent ready tile queues and LRU order, including adjacent-level prefetch coverage, without skipping incomplete coverage retries. Pause/style reset/fallback/release invalidate the reuse key. The renderer correctness suite caught an initial queue-readiness regression during development; the corrected final candidate passes all five modes, cache/ink/coverage and hidden recovery checks. No schema, source data, dependency or label architecture change. The parity harness uses the actual preview URL and captures bounded pairs instead of an oversized page bitmap.

Tile parity passes 120/120 (maximum MAE1.180472/255, high-delta fraction0.421524%, unchanged provisional limits); owner tolerance agreement remains pending. Real-font worker/main placement passes18/18 with327 curve comparisons at MAE0. Held-pinch cases pass6/6 across desktop/HiDPI/phone and both themes: ≤1.23% size variation,0.5ms desktop/3.4ms phone positioning, no page errors.

**Acceptance remains open:** three serial final-code phone CPU4× runs fail8/11,9/11,8/11 timing budgets. Zoom p95 medians53.3ms in /100ms out (ranges33.4–99.8 /83.4–150), with >100ms frames in every run. Heap median18.5MiB (18.3–18.7); full-gesture positioning has a6.3ms outlier. Free RAM was2094/1482/1776MB at run start; memory is not a waiver or a sufficient explanation. Existing hard gates were not changed; no attributable speedup is claimed. Full results and trace pointers: `docs/TARS-PREMIUM-J24.md`, J-25 verification: `docs/TARS-PREMIUM-J25.md`. Next renderer investigation remains the measured layerization/style/commit cost; keep HTML names and no per-frame React/SVG writes. J-15 and later jobs have not been advanced past this gate.

Final source typecheck/build pass (154 precache entries/7015.33KiB),224/224 tests across29 files, lint0 errors/188 existing warnings. Browser product smoke100/100, Atlas interactions21/21, learning104/104 in each theme, News279/279, clean-install offline9/9 and settled map/console health pass with no unexpected runtime errors. UI audit passes at375/768/1366/1920px in both themes; four repeated fullscreen exits and recovery6/6 pass. Expected failed-image/503/offline network errors belong to News fault fixtures. Source/schema/id diffs remain empty and whitespace review is clean. Physical-device and WebKit acceptance are still separate J-30 work. Changes remain local/uncommitted; no push/merge/PR/deployment.

## 6. Recent changes (newest first)

2026-10-05 — Corrected News stale-cache regression coverage to advance beyond the two-hour TTL before remount — keeps retry-throttle semantics intact while testing background refresh.

2026-10-05 — Corrected the MapLibre preview’s semantic-zoom paint expression to the style-spec-supported top-level `step` form — prevents preview style validation failure.

2026-10-05 — Added an opt-in MapLibre/OpenFreeMap Atlas preview (`?atlasRenderer=maplibre`) with clustered semantic study points and a generated controlled-India-border GeoJSON derived from the existing India sheet — production SVG remains the fallback until parity validation.

2026-10-05 — Atlas PYQ hotspots changed from a binary low-zoom exemption to frequency-weighted semantic zoom — overview stays legible while repeated PYQ places surface earlier and all places remain searchable.

2026-10-05 — News navigation became cache-first with a two-hour TTL, background revalidation, explicit force refresh, in-flight deduplication and Cloudflare edge reuse — switching Atlas/News no longer fans out RSS requests.

- **2026-10-05 — Authorized Cloudflare adapter follow-up:** first live deployment exposed Workers rejection of `redirect: error`. Owner explicitly authorized one additional adapter-fix commit and redeployment without rewriting the pushed release checkpoint. The Pages fetch adapter uses `manual`, so the unchanged gateway rejects all 3xx responses through its existing `!response.ok` check. No redirect following, registry/content/parser/timeout/limit/frontend changes. Contract tests cover manual mode, propagated abort signal, redirect rejection, partial/total failures and 405; typecheck passes. Local Workers returned 2,571 items from 38 populated sources with zero failures. Initial checkpoint: `0758615696eed2c53558920f4f17a8ce51181456`.

- **2026-10-05 — Cloudflare release preparation:** added `functions/api/current-affairs.ts` as a Web Request/Response adapter over the unchanged gateway, Pages `wrangler.toml`, API-only `_routes.json`, static MIME/security/cache header rules, and a clean build helper requiring the confirmed `SITE_URL` while preserving optional `BASE`. Pages project `tars-atlas-news` uses production branch `handoff/claude-overhaul`, `npm ci && npm run build`, `dist`, and `SITE_URL=https://tars-atlas-news.pages.dev`. Adapter contract test and Wrangler compilation pass; typecheck/lint (0 errors/175 existing warnings)/229 unit tests pass. No app behavior, schema, IDs, canonical data or gesture budgets changed. Deployment/authentication are separate: this task authorizes deployment, not authentication. Release verification logs are ignored under `tools/perf/out/cloudflare/`.

- **2026-10-04 — Owner release freeze complete:** stopped performance work/J-25; accepted private Cloudflare release with the documented current-host synthetic gesture exception, preserving four failures and all budgets. All eight minimal checks pass: typecheck, lint (0/175), unit (229), build (157 precache entries), smoke (100), News (251), Atlas (21), product health online/offline. All 550 entry non-document hashes match; no experimental application edits remain. Release record: `docs/TARS-PRODUCTION-READINESS.md`; deployment-only API/build/routing/PWA handoff: `docs/TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md`. No authentication configuration, commit, push or deployment. Stop here.

- **2026-10-04 — J-24 measured stop boundary:** preserved the accepted presentation and all 550 entry non-document hashes; profiled tile API work, empty-page controls, Windows scheduler/memory/timer policy and browser/backend/execution differences. Final original 33-budget audit fails 4 limits. Verified tile-free zoom still fails while label-free zoom meets timing, requiring separate protected label/compositor scope; no J-25 rewrite or renderer experiment is retained. All requested core/functional/parity checks pass. Evidence: `docs/TARS-J24-GESTURE-REPAIR.md`. No commit/push/deployment.

- **2026-10-04 — Final production-readiness pass:** preserved the authoritative local redesign/runtime repairs; implemented the requested 56px desktop shell, 52px + 56px mobile navigation, 180px desktop News rail, 400–432px inspector, contrast corrections, visible mobile state cues and static recall symbols. Comprehensive final commands/results and protected-file hashes: `docs/TARS-PRODUCTION-READINESS.md`. The only protected-internal exception is the two-line stale-GPU native fallback repair, verified by 24 parity states; removing those two lines exactly reproduces the entry renderer hash. No data/schema/ID/publication changes; J-24/J-25 remain out of scope.

- **2026-10-04 — Local live News restored:** diagnosed outbound `EACCES` in the restricted preview process; relaunched the same local endpoint with network access and confirmed 27 real current News rows in the existing user tab. No application or personal-state change. Separate offline-cache regression remains recorded.

- **2026-10-04 — Content-first density correction:** retained Phase 1, condensed shell navigation to one 48px bar, collapsed News/Atlas search, moved secondary controls into contextual surfaces, removed the Atlas utility dock and tightened editorial rows. Density and retained workflow validation: `docs/TARS-DENSITY-CORRECTION.md`. Presentation work does not waive existing renderer acceptance gates.

- **2026-10-04 — Bounded runtime repairs / fast wrap-up:** preserve completed feed responses for service-worker cache writes, pace tile uploads at rest with atomic readiness, reuse identical river rasters and compact HTML point labels with legacy fallback. Latest core/News/renderer/anchor suites pass; phone label cost and hard gesture timing remain unaccepted. Full exact commands, counts and unchanged boundaries: `docs/TARS-PRODUCTION-READINESS.md`. Rejected optimization experiments are absent from source. No publication.

- **2026-10-04 — Editorial Cartography presentation:** top product shell, complete semantic dark/light themes with licensed local fonts, external-link editorial News without Notes/reader UI, contextual Atlas inspector/detents, focused single-question recall and auxiliary Settings. Renderer/data/PYQ/Dexie/News state mechanisms and IDs remain unchanged. Responsive, keyboard, reduced-motion, offline and state-preservation evidence is in `docs/TARS-EDITORIAL-REDESIGN.md`; **acceptance remains Partial: final hard Atlas timing fails 21/33 limits and label cost 1/6; latest full News run fails the intermittent 503 cache assertion after 247 passing checks. 29/29 count gates and the 267-check UI matrix pass.** Renderer/J-24/J-25 remain untouched and unaccepted. No commit/push/PR/deployment.
- **2026-10-04 — Atlas labels/markers obscured at rest:** reproduced opaque detail tiles painting above visible label/symbol DOM (`z-index: 2` escaped the base parent). Isolated the base stacking context without changing renderer, density, hit targets or zoom logic. New browser regression fails on the old build and passes 90 checks across India/World, zoom/settlement and selection at three widths/both themes. Unit225, Atlas21, learning104, cold-start6, typecheck/lint/build pass; full evidence in `docs/TARS-ATLAS-RUNTIME-FIX.md`. No data/schema or paused-roadmap changes.

- **2026-10-04 — Atlas runtime regression:** direct development cold start reproduced `InvalidStateError` in `WorkerCurve` while React replayed layout effects. River rasters now use non-consuming 2D copies; layout ownership retains current bitmaps until replacement/unmount. Added StrictMode/resource-lifecycle unit coverage and direct cold-start browser coverage in development and production CI. Schema, historical records and removed features remain unchanged; overhaul paused again. Exact validation is recorded in `docs/TARS-ATLAS-RUNTIME-FIX.md`.

- **2026-10-03 — Atlas + News overhaul resumed:** retired obsolete feature jobs and mixed subtasks; published the scoped queue and resumed J-24 with ready-coverage queue reuse and bounded parity screenshots. Renderer5/5, tile parity120/120, label parity18/18, pinch6/6 and retained functional regressions pass; three final phone timing runs still fail, so J-24/J-25 remain unaccepted. No source-data/schema changes or commit/push/deploy.

- **2026-10-03 — Atlas + News reduction:** removed Focus, Planning and timer expeditions and their exclusive dependencies/surfaces. Preserved shared UI/Atlas/News, all existing data/schema and backup compatibility; replaced obsolete browser harnesses. Typecheck/lint/build and 224 remaining unit/data tests pass; product, Atlas/PYQ/News/offline/recovery/layout browser results are recorded in `docs/TARS-ATLAS-NEWS-REDUCTION.md`. Entire overhaul roadmap paused; no commit/push/deploy.

- 2026-10-03 — Owner approved the J-25 label work needed for J-24; implemented the tile/label candidates and separate acceptance records. Found and repaired new park-visibility and opaque relief-nodata regressions.304 tests, lint0/402, Atlas21/21, learning104/104 each theme and clean offline pass; provisional parity96/96. Phone timing still fails; both jobs remain in progress, later jobs unstarted. Unshipped canvas comparison remains unaccepted. No commit, push, merge or deployment.

- 2026-10-03 — Accepted premium roadmap J-23: split the unchanged Atlas camera, gestures, palette and drawing modules; 514-line map component, ten gesture tests, production acceptance and an isolated compositing/label spike — establish the renderer boundary and measured J-24/J-25 choices without altering timer, data, cartography or media. No commit, push, merge or deployment.

- 2026-10-03 — Started Codex continuation at `3e43def`; recorded the owner's content-quality rejection and formal execution order; repaired cold-start QA readiness after reproducing its onboarding timeout — preserve the checkpoint contracts and avoid mistaking setup timing for an application regression. J-23 is accepted; J-24 is next.
- 2026-10-02 — Handoff checkpoint: the whole working tree (app-shell overhaul, Current Affairs cleanup, premium roadmap through J-09 plus J-16, J-18, J-19, the Focus redesign, the study-audio engine and backups v3) committed to `handoff/claude-overhaul` for Codex to continue from — the owner stopped the overhaul here; state, verification and next action are in §0.

- 2026-10-02 — Premium roadmap J-11b/c, J-10b, J-03, J-28, J-04, J-05a–d, J-06, J-07a–c, J-08, J-09, J-16, J-18, J-19; Focus rebuilt as a full-stage study room with generated wallpapers and original lines; one persistent audio engine with layered ambience and generated study music; backups carry notes and reading state — make the app feel like one fast, tactile product; per-job evidence in §5a.

- 2026-10-02 — Premium roadmap J-01, J-02, J-27, J-11a, J-10: error boundaries and stale-chunk reload; ESLint/Prettier with two project rules; count budgets in CI; Atlas rest detection from the frame loop; Focus dial driven by compositor animations — the guard rails first, then the two largest measured costs (Atlas repaint storm, per-frame dial). Also corrected the audit: the first gesture harness awaited each wheel event and overstated repaints per zoom about threefold (4–9, not "up to 26").

- 2026-10-01 — Added `docs/TARS-PREMIUM-PRODUCT-AUDIT.md` (product quality, UX and engineering audit with a P0–P3 roadmap and implementation jobs J-01…J-30) and two measurement scripts, `tools/perf/gesture-audit.mjs` and `tools/perf/app-audit.mjs`; no application code changed — baseline and plan for making Tars feel like a polished application, with measured evidence (Atlas repaint storm, unlabelled map while dragging, per-frame Focus dial cost, skeleton on first navigation).

- 2026-10-01 — App-shell UI overhaul: rail + inset stage / phone tab bar, Home and Notes workspaces, quick capture, Calendar folded into Plan, shared `Workspace` header, new surface/type tokens, flat rows instead of cards — make Tars feel like one installed application instead of a dashboard, without touching data, timer or Atlas logic.

- 2026-10-01 — Keep three exclusive reading queues; separate rolling 24-hour Today from descending top-corner Archive; add removal/Undo, derived analytics and short system-dated printable notes — keep daily reading clean and track personal progress.

- 2026-10-01 — Group overlapping Current Affairs with metadata-based preferred coverage, improve read/pending/saved tracking and typography, retain metadata in a local daily/weekly/monthly/yearly archive, add verified Down To Earth RSS — preserve original publisher reading and learner storage.

- 2026-10-01 — Remove Current Affairs popup/Study mode; open publishers directly, add inline read/save and RSS thumbnails, broaden syllabus aliases, replace official feeds with 38 verified newspaper feeds — capture more useful reading with less UI.

- 2026-10-01 — Current Affairs cleanup: replace the split panes with one compact list and on-demand detail Sheet, collapse advanced filters and shorten initial evidence — reduce visual clutter while preserving the reading workflow.

- 2026-10-01 — User authorized publishing the completed Jobs 1–6 working tree to `markus-aurelius1/focus-timer`, branch `main`; verified remote base matches local and prepared the accepted sources/runtime assets/reports, excluding local secrets/source PDFs/build caches. Prior no-commit milestones remain historical validation records.

- 2026-10-01 — vNext Job 6: turn Current Affairs into an IST daily original-link reading workspace with split inspector/mobile sheets, read/save/notes, Must Read, estimated reading plans and sequential Study mode; remove all generic reference searches — preserve the Job 5 pipeline and Dexie.

- 2026-10-01 — vNext Job 5: add the read-only Current Affairs link feed, allowlisted RSS/Atom gateway, compact CSE/taxonomy relevance index, conservative clustering, static links and successful-response HTTP caching — deliver one narrow online-assisted screen without learner persistence.

- 2026-10-01 — vNext Job 4: independently reproduce Jobs 1–3, preserve external safety snapshot, fix measured concurrency/context/ambiguity/offline/a11y defects, verify immutable learner history and investigate zoom with repeated comparable cohorts; preserve SVG and characterize remaining jank — leave the complete uncommitted release candidate for human review.

- 2026-10-01 — vNext Job 3: isolated MapLibre/PMTiles evaluation, retained SVG with cheaper zoom symbol updates, versioned offline asset inventory, curated hotspots/catalogue, typed validated actions, derived context, deterministic commands and cross-feature continuity; calmer shared surfaces and browser CI — make Tars aware and actionable without rewriting persistence or timer semantics.
- 2026-10-01 — vNext Job 2: free Atlas access, independent travel/mastery, overlay inspector, premium canonical quiz and role-safe attempts, complete curated offline subset — pass learning acceptance gate before Job 3.

- 2026-10-01 — vNext Job 1: verified canonical 2.1.0 release, independent broad coverage scan, strict three-gate curated PYQ packs, permanent-ID resolution/review, typed lazy loader/shared block renderer, reproducibility and audit tests — prepare Atlas PYQ integration without changing app UI or learner semantics.

- 2026-09-28 — Removed the live MapLibre map at the user's request; made the bundled Atlas cover its panel and corrected zoom-limit camera jumps — restore the usable offline experience.
- 2026-09-27 — Added `AGENTS.md` (project summary, layout, commands, conventions, do-not rules, "done" checklist, handoff protocol) — Codex reads it automatically at session start, so the rules apply to every agent.
- 2026-09-27 — Added `CODEX_HANDOFF.md` (this file) — the user's handoff protocol, so any agent can continue at the same quality bar.
- 2026-09-26 — M10 (uncommitted):
  - What changed: renamed Lodestar → Tars (legacy ids kept, §7); dialogs as a flex column with pinned header/footer; no unwanted scrollbars; collapsible persisted sidebar; Fullscreen-API Atlas; sound follows the timer via store subscription; two-tier quick add with subject/tags/profile; rAF progress ring and completion bloom; command palette, shortcuts, motion tokens.
  - Why: the user asked for a premium, bug-free UI and a rebrand.
- 2026-09-26 — M9 (uncommitted):
  - What changed: gazetteer grew from 1,181 to 2,273 places, sourced from Wikipedia, Wikidata and official lists, with overlays for 777 places; map layers, global search, van Wijk–Nuij camera, eased wheel, zoom gestures; v1 progress locked (`v1-lock.json`, `ATLAS_V2_AT`).
  - Why: the user asked for about 1,000 India + 1,000 World sourced places and map-app-quality interaction.
- 2026-09-25 `fec9da0` — Checked the PYQ UI in the app; documented results and caveats — to verify the scores before relying on them.
- 2026-09-25 `87c5e9f` — PYQ ledger from the UPPSC papers + UPSC workbook (783 entries) and 380 new places — the study priority needs real exam data.
- 2026-09-24 `8d0d4de` — "Past papers" panel, study-priority order, priority-first review — PYQ data made visible and useful.
- 2026-09-24 `34f38e8` — PYQ pipeline: ledger DSL, alias matching, study-priority score — an interpretable heuristic with reasons stored.
- 2026-09-24 `cab6b53` / `d655261` — Calm immersive focus (plain background by default), Manrope tabular digits — the focus screen was distracting.
- 2026-09-24 `85c78ae` — Solid chrome instead of glass; softer shadows — performance, and a calmer look.

## 7. Conventions

- **Code style** (no formatter config; match the surrounding code): no semicolons, single quotes, 2-space indent, long lines (≈160–200 characters) are normal, `const` arrow helpers, early returns. Every module starts with a `/** … */` block saying what it does and why. Comments explain reasons, not mechanics.
- **Files:** React components are `PascalCase.tsx` under `src/features/<screen>/`. Pure logic lives in lower-case `.ts` modules with colocated `*.test.ts`. Import from `@/…` (alias for `src/`).
- **Data:** every record has a UUID `id`, `createdAt` and `updatedAt`. Write through `src/data/repo.ts` only; deletes must leave tombstones for sync/merge. A schema change needs a new Dexie `version()` + migration + backup-import support. Optional fields that aren't indexed (e.g. `Task.tags`, `profileId`) need no schema bump.
- **Derived, not stored:** XP, levels, mastery, exploration, development, streaks, reminders, challenge progress. Never add a counter that can drift.
- **Determinism:** anything random that users see uses `seededRandom(hashString(...))` (questions, challenges, sample data).
- **Place ids** `<in|w>.<kind>.<slug>` are permanent: user progress references them. Gazetteer content changes only in `tools/atlas-build/content/`, then gets rebuilt. Never hand-edit `public/atlas/v1/*`.
- **Keep "lodestar" where it is** (renaming breaks installs or data):
  - IndexedDB name `lodestar` (`data/db.ts`)
  - PWA manifest `id: 'lodestar-study'` (`vite.config.ts`)
  - app id `app.lodestar.study` (Capacitor, Android, iOS)
  - the legacy `lodestar://` scheme (accepted alongside `tars://`)
  - legacy localStorage keys migrated in `lib/storage.ts`
  - backup `app: 'lodestar'` accepted on import
- **UI:**
  - Tailwind v4 with CSS-variable tokens. Surface layers back to front: `bg-canvas` (the frame behind the rail) → `bg-bg` (the stage every workspace sits on) → `bg-surface` (raised: sheets, menus, fields, the one Home action surface) → `bg-surface-2/3` (wells, fills, hover). Text `text-ink` / `text-ink-2` / `text-ink-3`; `text-accent`; hairlines `border-line`. Themes are Paper (light, `:root`) and Night (`.dark`); `--note` / `--note-ink` are the note paper. Every ink/accent token must keep ≥4.5:1 on bg, surface, surface-2 and surface-3 (`tools/perf/job4-visual.mjs` asserts it).
  - **Type roles** (`index.css`, components layer – utilities still override): `t-display` (Fraunces; Home greeting only), `t-title` (workspace/sheet titles, sans 19 px bold, tight), `t-heading` (section headings), `t-label` (sentence-case group/field labels – no all-caps tracked eyebrows), `t-eyebrow` (rare), `t-body`, `t-meta`, `t-num` (tabular numbers). Manrope for UI and all numbers; Fraunces (`font-display`) only for display moments: the wordmark, the Home greeting, Atlas place names and quiz prompts, onboarding and session-complete.
  - **Shell:** `app/App.tsx` renders `Rail` + `.app-frame > .stage > .stage-scroll` + `TabBar`. From 768 px the stage is a fixed, inset, rounded surface that scrolls internally (`data-scroll="page" | "fit" | "none"` – Focus fits, Atlas fills); below 768 px the document scrolls. CSS variables drive everything: `--rail-size`, `--rail-w`, `--tabbar-h`, `--nav-bottom` (use it for any bottom offset instead of hard-coded tab-bar heights), `--stage-gap`, `--page-bg`. `<html data-sidebar|data-chrome|data-session>` are set by `ShellSync`. The rail is icons-only between 768 and 1023 px and when collapsed.
  - **Workspaces** use `app/Workspace.tsx`: a sticky 56 px header (title, optional meta, the screen's own actions, phone-only `Ask Tars` and Back), an optional toolbar row (sticky from 768 px only), and a max-width content column. Don't add page heroes or per-screen Settings buttons. Home and Focus lay themselves out with `workspaceColumn()` / their own header for the same 56 px rhythm.
  - **Surfaces:** prefer rows on the stage (`.row`, `TaskItem`) and whitespace/hairlines over cards; one raised surface per screen at most. Grouped settings and grids (calendar) keep a single hairline container. Controls are capsules; raised floating chrome uses `shadow-[0_0_0_1px_var(--line),var(--shadow-…-value)]` rather than border + shadow.
  - Motion tokens: micro 140 ms / base 220 ms / layout 320 ms / calm 520 ms (`src/index.css` + `src/ui/motion.ts`); screens enter with `screenEnter`, content can stagger with `.settle` + `--i`; theme switches cross-fade via `html.theme-fade`; respect `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` + the global CSS rule).
  - Dialogs use `ui/Sheet.tsx` with actions in `footer` / `<SheetFooter>`.
  - No glass or `backdrop-filter`; no `AnimatePresence mode="wait"` around screens (transitions are enter-only).
  - `TarsContextBridge` (mounted in `App.tsx`) keeps the action context projection current on every route – imperative actions read it; never remove it without another always-mounted `useTarsContext()` caller.
- **Errors:** screens are declared with `lazyScreen` (not `lazy`); anything rendered in a global overlay slot goes inside `OverlayBoundary`. Don't catch render errors locally to hide them.
- **Lint:** 0 errors always. New code adds no `tars/raw-button` or `tars/arbitrary-token` warnings: use a `src/ui` primitive and a token; put geometric one-offs (a 200% width, a computed inset) in `style`.
- **Focus dial:** nothing may write to the dial per frame. Progress is a transform animation created by `useProgressAnimation`; a new progress visual adds a `ProgressPart` whose transform is a straight line in progress over each half of the phase. Turning layers are full-dial boxes about the centre (half-width boxes land on half pixels and the join shows).
- **Atlas renderer:** `AtlasMap.tsx` is the map and recall renderer, with these rules:
  - Rest is judged from the frame loop (`watchForRest`), never from a timer: Chrome delivers wheel and pointer input with the frame, so during a slow repaint a timer sees no input and settles mid-gesture. Never start a repaint while `paintInFlight`.
  - No React state or SVG attribute writes per frame; gestures move a pre-painted layer with CSS transforms and repaint on settle. SVG symbols do not receive per-frame CSS scale writes; compact maps also let HTML labels scale until settlement.
  - Point names are HTML, not SVG `<text>`.
  - Never put a custom property on the label layer, opacity on HTML names, or `animation-fill-mode: both` on symbols (each caused 10×–800 ms regressions).
- **Git:**
  - Branches are `claude/<name>`. Add commits on top; no rebase or force-push of shared branches.
  - Commit subjects: `<Area>: <what changed>`, sentence case, no trailing period (e.g. "Atlas data: PYQ ledger, alias matching and study-priority score").
  - Commit or push only when the user asks.
- **Docs:** `AGENTS.md` holds the working rules every agent loads at session start (keep its do-not list in sync with §9 here); `README.md` is the user-facing feature list; `docs/HANDOFF.md` is the milestone log with measurements; this file is the cross-agent handoff and quality bar. Approved example outputs, once the user approves some, go in `examples/<feature-name>/` and are cited from §4.

## 8. Environment setup

The checkout is `C:\Users\hario\Downloads\T.A.R.S\focus-timer`; quote paths. Windows shells may warn about LF→CRLF; the warning is harmless.

```bash
npm ci                         # root app (Node 22 as in CI; Node 24 also works)
npm run dev                    # http://localhost:5173  (.claude/launch.json "dev")
npm run typecheck              # tsc -b
npm run lint                   # eslint src api vite.config.ts – 0 errors required; npm run lint:counts for warnings per rule
npm run format -- <files>      # prettier, opt-in per file (the tree is not formatted wholesale)
npm test                       # vitest: src/**/*.test.ts
npm run build                  # atlas asset inventory + tsc -b && vite build → dist/ (+ service worker)
npm run preview                # http://localhost:4173  (.claude/launch.json "preview")
node tools/current-affairs/fetch-mains.mjs # optional explicit network refresh of pinned ignored Mains build input
node tools/current-affairs/build-relevance.mjs # local canonical ZIP + ../taxonomies + pinned Mains input → compact news index
node tools/perf/current-affairs-check.mjs # production daily workspace/persistence; 375/1366 Paper/Night + actual news Workbox cache
BASE=/subpath/ npm run build   # sub-path hosting

# Atlas data pipeline (own package)
cd tools/atlas-build && npm install
npm test                       # 42 tests with external canonical ZIP; full package checks skip when absent
node canonical-pyq.mjs          # verified external ZIP → strict Atlas PYQ subset + coverage reports (root: npm run atlas:pyq)
node canonical-pyq.mjs --package="<absolute zip path>"  # or CANONICAL_PYQ_PACKAGE; never mutate that package
node build.mjs --places-only   # recompile content/*.mjs + PYQ ledger → places.json (+ overlays); offline
node build.mjs                 # full build incl. sheets and relief (downloads sources once; cached in .cache/)
node gazetteer/lists.mjs       # refresh official lists            ┐ need network (Wikipedia, Wikidata,
node gazetteer/link-existing.mjs  # link v1 places to Wikipedia  │ Overpass, Nominatim); cached in
node gazetteer/generate.mjs    # candidates → content/generated   ┘ .cache/wiki, rate-limited

# QA tools (own package; against the production preview)
cd tools/perf && npm install && npx playwright-core install chromium # or CHROMIUM_PATH
node smoke.mjs http://localhost:4173/        # Atlas + News, retired links/actions, preserved legacy data, offline
node atlas-check.mjs http://localhost:4173/  # map interaction/search on desktop + phone
node vnext-learning.mjs http://localhost:4173/ # canonical quizzes/recall/persistence/offline; SCHEME=dark repeats Night
node current-affairs-check.mjs              # self-hosted production fixtures; 279 daily workflow/cache checks
node ui-audit.mjs http://localhost:4173/     # retained surfaces, responsive light/dark bounds
node fullscreen-regression.mjs http://localhost:4173/
node job4-offline.mjs http://localhost:4173/ # fresh-install SW cache/hash integrity
node error-recovery.mjs http://localhost:4173/
node product-health.mjs http://localhost:4173/ # settled bitmap tiles and console health
# Active renderer/parity checks and job sequencing: docs/TARS-ATLAS-NEWS-ROADMAP.md.
```

- **Env vars:** none are required. Optional: `BASE`, `SITE_URL` (canonical/OG URL; on Vercel `VERCEL_PROJECT_PRODUCTION_URL` fills `%SITE_URL%`), `CHROMIUM_PATH`, `PLAYWRIGHT_FROM`, `ROUTE`.
- **Atlas:** no map token or environment variable. Both sheets and their relief assets are bundled. On this Windows machine, QA can use `CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`.
- `.env.local` only holds a Vercel CLI token; it is git-ignored and builds don't need it.
- **Deploy:** Vercel runs `npm ci && npm run build` and serves `dist`. `.vercelignore` excludes `pyq-sources`, `tools`, `android`, `ios`, `docs`.

## 9. Known issues / gotchas

1. **Publication scope:** Jobs 1–6 were initially held uncommitted; the user subsequently authorized committing/pushing that completed tree to `origin/main` on 2026-10-01. New commits/pushes/deployments still require user authorization. The canonical ZIP is an external build input and is not shipped; full package integration tests require it (without it: 36 pass / 6 explicitly skip). Coverage dictionaries cannot prove exhaustive entity recognition; unresolved/potential-name queues require review before any new coordinates or places are added.
2. **Precache limit:** `public/atlas/v1/places.json` is 2,548,302 bytes, against workbox `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` in `vite.config.ts`. Above 3 MiB it silently drops out of the precache and the Atlas stops working offline. Raise the limit or split the file if the gazetteer grows.
3. `--places-only` can't add river courses. 21 Indian rivers have no course in Natural Earth or OSM and are drawn as symbols; tracing them needs a full `node build.mjs` with `line: trace(...)`.
4. `ATLAS_V2_AT = Date.UTC(2026, 8, 26)` is retained unchanged as historical provenance. The time-based survey/conversion runtime has been removed. Keep the generated source metadata and stable place ids unchanged.
5. `content/pyq/not-mapped.mjs`: 159 of its 259 names never match an unmatched reference any more (e.g. "Mandakini" is now `in.river.mandakini`). This is harmless, because it only applies to unmatched refs, but it is misleading when read.
6. The fact-quality imperfections in §4.2: 33 places with a duplicated Ramsar fact; straight apostrophes in the designation templates; Wikipedia vs GoI framing (an undecided policy).
7. Historical task-reminder formatting issue is obsolete: reminders and Planning runtime are removed.
8. Historical World travel gap is obsolete: timer expeditions/free survey are removed. All World places and their independent recall/mastery remain accessible.
9. Only headless Chromium has been tested. HTML map-name halos rely on `paint-order`, and iOS Safari has no Fullscreen API, so the Atlas falls back to filling the window. Real iOS Safari and Android WebView checks are pending.
10. Profiling the dev server is meaningless (React dev overhead); use `npm run build && npm run preview`.
11. Three Ramsar sites (Sakhya Sagar, Ankasamudra, Gogabeel) and Glaw Lake have no position in any open source, so they are left out rather than guessed.
12. Web notifications can't be scheduled for a frozen page: on mobile web the alert arrives when the user returns. Native builds schedule exact OS alarms, and Android 12+ may ask for the exact-alarm permission.
13. The Atlas uses bundled sheets and gazetteer search. Its physical relief is a static image under interactive vector and place layers; it does not provide street-level tiles, satellite imagery or global street-address geocoding.

14. Historical Jobs 2–3 phone-viewport profiling was uneven: final zoom-in 12.7fps / 244.5ms p95 versus the corrected baseline 21.7fps / 213.1ms. Job 4 reran three complete samples per cohort and traced settlement/style/layout/paint; it did not numerically reproduce that old relationship and rejected an unproven no-op boundary optimization. The production renderer is unchanged from the pre-audit snapshot. See `docs/TARS-VNEXT-JOB-4-AUDIT.md` for distributions and the INCONCLUSIVE zoom-in assessment; do not claim a uniform performance win or physical phone validation.

15. **Current shell QA contracts (2026-10-04):** desktop `.product-bar` with navigation Workspaces (Atlas/News), mobile navigation Main with two 44px products, one visible Ask Tars command trigger, auxiliary Settings. Retain full-stage map coverage and kept-map state across News/Settings return, full-screen chrome hiding/restoration, selection, focus/Back and offline assertions. Sidebar collapse workloads are deliberately replaced by equivalent News/Settings return workloads with unchanged repaint ceilings. News has no Note action or reader. `editorial-check.mjs` adds all four requested sizes/both themes, direct publisher URLs, dormant-note preservation and real shell paint order. Older Focus/rail/five-tab contracts are retired.

16. **Dev-only suites and module identity:** `features-check`, `job4-actions`, `job4-state-matrix` and `audio-check` run against `npm run dev` and `import('/src/...')` app modules. After a module has been edited, Vite serves importers a `?t=` URL, so the page and the test hold different instances of the same store and audio/timer checks fail spuriously. Restart the dev server before running them.

17. **Checks that wait for a repaint instead of a fixed time** (`atlas-check.mjs`): "arrow key pans" and "+ key zooms in" read the painted SVG transform, which only changes when the map repaints after the move; they now wait for that change (up to 5 s). The two-finger tap is dispatched without awaiting CDP's answer, because a busy frame delayed the answer and the "lift" was then sent too late to be a tap. These check behaviour; frame cost is budgeted by `gesture-audit`.

18. **The kept Atlas** (window layout): do not hide it with `display: none`, `visibility` or React `<Activity>`, and do not put `inert` on the element that contains the map – each restyles or re-rasterises the whole vector map (0.4–1.8 s). It is covered by the opaque `.stage-scroll`, `aria-hidden`, with everything around the map inert, and its map ignores new props while behind (`setAtlasMapAwake`). Screens read the route through `useRoute()`, which returns the route pinned for that screen (`RouteContext`), not the live address.

19. **QA contracts changed by the roadmap:** immersive focus is `<html data-focus="immersive" data-chrome="hidden">` (there is no "Immersive focus" dialog any more); `IconButton` shows a `Tooltip` instead of a `title`; the sound panel's header button is `Play sound` / `Pause sound`; rail items are in `navigation "Workspaces"` and `"Library"`, the phone tab bar is `navigation "Main"`; Plan views on phones are three tabs plus a `Lists` menu; `Segmented` renders tabs (role `tab`, `aria-selected`), `SegmentedControl` radios.

## 10. Historical next steps (superseded by the scoped roadmap)

Do not execute this historical list. The current Atlas + News contract and entire-roadmap pause in §0a supersede it.

0. **Current authorization:** Editorial Cartography presentation/interaction work only; see §0a and docs/TARS-EDITORIAL-REDESIGN.md. Preserve the renderer and all persistence/data contracts. J-24/J-25 are unaccepted and must not resume; the historical premium execution order is not permission to change them.

1. **Physical-device validation and map detail:** test the completed Jobs 2–3 flows on iOS Safari and Android/WebView before release. Optional regional detail needs sourced/licensed content, a bounded installation/removal policy, and renderer parity before any production MapLibre adoption. The isolated spike is not a production map or a phone-GPU acceptance test. Review the 6,829 unresolved geographic occurrences through the gazetteer pipeline independently; do not infer coordinates or inflate the 149-question inventory.
2. **User decision:** the World discovery gap (more World expeditions, or letting the survey reach the World sheet after the v2 release date).
3. **Manual, by the user:** rename the Vercel project (e.g. `tars-study`). Canonical/OG URLs follow `VERCEL_PROJECT_PRODUCTION_URL` automatically.
4. Real-device check of the Atlas and immersive/fullscreen on iOS Safari and Android WebView.
5. Transcribe the four web PYQ sources listed in `content/pyq/index.mjs`. The PMF IAS protected-area pages fix the under-representation of national parks. Follow §4.3 exactly and keep `pyq-review.json` at 0/0/0.
6. Full `node build.mjs` with traced courses for the 21 Indian rivers drawn only as symbols.
7. Data hygiene in the generator (then rerun `generate.mjs` and `--places-only`): skip a list designation fact when the lead already states it; curly apostrophes in the designation templates; prune the stale `not-mapped.mjs` entries.
8. Format task-reminder bodies with `relativeDayLabel` / `formatTimeOfDay` like the other reminders.
9. Not started (optional): Android/iOS home-screen widgets (launcher shortcuts and deep links exist); drag-and-drop ordering for subjects.
