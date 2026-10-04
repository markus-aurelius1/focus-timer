**Current owner deployment authorization — 2026-10-05:** prepare one release checkpoint, push only `handoff/claude-overhaul`, and deploy the accepted Atlas/News/Settings application to Cloudflare Pages. Application behavior stays frozen; no performance work or J-25. No authentication configuration. Earlier publication prohibitions below describe prior tasks and are superseded for this deployment only.

**Current owner release freeze (2026-10-04): performance work stopped.** Accepted application source is frozen. Do not investigate J-25, run renderer/compositor experiments or retry the current Windows/headless gesture gate. Owner accepts private Cloudflare deployment with a documented synthetic gesture exception, preserving all four failures and unchanged budgets for future stable/physical-device validation. Only the eight requested minimal sanity checks and release/deployment documentation remain in this task, then stop. No deployment, authentication configuration, commit or push. Current release decision: [production-readiness report](TARS-PRODUCTION-READINESS.md); [deployment handoff](TARS-CLOUDFLARE-DEPLOYMENT-HANDOFF.md).

**Historical timing result: 4/33 failed limits.** [J-24 investigation](TARS-J24-GESTURE-REPAIR.md) retains full evidence. The later owner private-release exception above supersedes the release-blocking decision, not the test outcome. No architectural rewrite, budget change, source change or J-25 investigation is authorized.

**Historical density correction, 2026-10-04:** content takes priority over chrome. Preserve Phase 1 tokens/themes/fonts. Phase 2 uses one 48px top bar with Atlas/News navigation at every width and safe-area clearance; no mobile bottom navigation. Phase 3 uses a compact News header/state tabs, search expanded on demand, filters/Sources in a contextual sheet/dialog and dense editorial rows. Phase 4 uses one small World/India + search + options strip, compact zoom, and no persistent bottom utility dock. Legend, fit, hotspots, fullscreen, review and Atlas tools remain inside Map options. Existing contextual inspectors, data and personal state remain. This supersedes earlier spacious layout instructions. Evidence: `docs/TARS-DENSITY-CORRECTION.md`.

**Final owner contract (2026-10-04) supersedes the density arrangement above and earlier repair authorization:** finish presentation and comprehensive verification on the current local tree. Desktop 56px product bar; mobile 52px top plus 56px Atlas/News bottom navigation. Desktop News has a 180px rail and wide collection. Keep existing runtime repairs intact; renderer/camera/labels/tile/cache and data/persistence are protected. J-24/J-25 remain out of scope. Hard failures must be reported as blockers without weakening limits. No commit, push, deployment or authentication configuration. See `TARS-PRODUCTION-READINESS.md` for the final result; the older job queue is historical context.

# TARS — Atlas + News overhaul roadmap

Presentation pass evidence: [TARS-PRODUCTION-READINESS.md](TARS-PRODUCTION-READINESS.md). Presentation, News/cache, renderer behavior, GPU/native fallback parity and label costs pass. Hard gesture timing remains a deployment blocker. The newer owner authorization at the top opens J-24 only and the benchmark-environment investigation; J-24 is unaccepted and J-25 remains out of scope. Earlier scope statements below are historical.

Updated 2026-10-04. **The latest owner instruction authorizes the Editorial Cartography presentation/interaction redesign of Atlas | News + Settings.** This supersedes the earlier pause for presentation only. `TARS-EDITORIAL-REDESIGN.md` records its baseline and acceptance. J-24/J-25, renderer/camera/label/tile/cache algorithms, canonical packages, migrations and identifiers remain protected; the historical queue below does not authorize resuming them. No removed feature is to be restored.

News is an external RSS link collection: Today, To Read, Read, Saved, Archive, Sources, search and filters. No Notes controls/editor/pane, article detail or internal reader. Headline and Open Original go directly to the canonical publisher URL. Historical article-note and dated-note persistence remain untouched and dormant, with preservation checks. No migration or new article database.

Completed shared, Atlas and News work stays accepted unless a verified regression requires repair. J-23 remains accepted. The old 25/40 percentage describes the superseded product and is not a current completion measure.

## Remaining execution order

| Order | Job | Retained scope | Current state / gate |
| --- | --- | --- | --- |
| 1 | J-24 | Atlas tile worker, bounded cache, fallback, cartographic parity and gesture performance | Authorized for measured repair only; not accepted. Preserve all 33 tiles.json limits, including desktop ≤20 ms / phone 4× ≤34 ms continuous-zoom p95, zero frames >100 ms and ≤50 ms pan gate. Preserve established pixel tolerances. Benchmark-environment investigation is additionally authorized. |
| 2 | J-25 | Atlas HTML point names, curved lettering, fixed screen-size labels and positioning cost | Paused; separate final acceptance remains required. The 2026-10-04 bitmap lifecycle crash repair is not overhaul acceptance. No per-frame React state or SVG writes. |
| 3 | J-15 | Atlas inspector, detented phone sheet, search, keyboard, layers and touch targets | Presentation implemented under the new specification; renderer gates remain separate. No travel/expedition/revision-task UI. |
| 4 | J-18b | Shared Atlas question/review surface | Focused single-question presentation implemented; canonical grading/attempts/history retained. See Editorial acceptance. |
| 5 | J-16b | Editorial News external-link collection | Presentation implemented with To Read / Read / Saved, publisher links, search/filters/archive/Sources. No active Notes or reader UI; both note stores preserved dormant. |
| 6 | J-29 | Atlas/News/Settings accessibility | Retained surfaces verified for keyboard/Escape, focus restoration, contrast, non-colour state and responsive dialogs in this final pass. Separate later audit scope is not inferred. |
| 7 | J-30 | Atlas/News WebKit and physical-device verification | Pending browser availability and recorded manual iPhone/Android checks. Cover map gestures, full screen, offline reload and retained sheets with keyboard open. Desktop emulation does not satisfy the device gate. |
| 8 | J-20 | Tactile details in retained controls and Atlas | Partial: Stepper hold-repeat and Slider detents already implemented. Retain map grab/grabbing cursors and only shared effects with an actual retained consumer. |
| 9 | J-21 | Atlas/News loading and empty states | Existing loading/error/empty behavior retained. No Notes motion/autosave product work, Insights charts or standalone Notes screen. |
| 10 | J-26 | Atlas detail packs, geometry/relief levels | Separately gated: new data, network generation, pack/precache policy and source changes still require explicit owner approval. Resuming the overhaul does not authorize regeneration. |

The presentation pass wires native Back to the existing surface stack (`closeTopSurface()`), after closing global search; physical-device acceptance remains pending. The historical J-06 numeric timing lint/migration is outside this redesign; existing motion architecture is reused.

## Removed from the queue

- J-10, J-10b and J-14: Focus timer/readouts/surfaces.
- J-12 and J-13: Planning editor/lists.
- J-17: Planning Calendar/Habits.
- J-22: Focus immersive mode and removed onboarding.
- J-18: historical deletes of tasks, sessions, events, goals, habits, labels and projects; the existing shared Undo/toast system remains accepted.
- Focus redesign, wallpapers, ambient audio/music and quote quality follow-ups.
- Focus/Planning portions of shell, shortcut, performance, accessibility, tactile and loading jobs. J-16 retains accepted shared Settings work; its Soundscape portion is retired. J-19 retains accepted palette/toast work for Atlas/News.

Historical measurements and retired specifications remain in the original audit and handoff as history. They are not executable jobs, current runtime requirements or permission to reintroduce removed modules.

## Verification and boundaries

One job, one concern; production baseline before and comparable evidence after. Use retained scripts: `gesture-audit.mjs`, `atlas-renderer-check.mjs`, `atlas-pixel.mjs`, `atlas-label-check.mjs`, `atlas-label-parity.mjs`, `smoke.mjs`, `atlas-check.mjs`, `vnext-learning.mjs` in both themes, `ui-audit.mjs`, `fullscreen-regression.mjs`, `error-recovery.mjs`, `job4-offline.mjs`, `current-affairs-check.mjs` and `product-health.mjs`, as relevant. Deleted Focus/Planning harnesses are not required.

Every implemented job requires typecheck, lint, relevant tests, production build, browser checks and a handoff update. No acceptance thresholds may be weakened to make a failing job pass. Preserve generated source packages, stable ids, recall history, News personal state and unchanged Dexie migrations. No commit, push, PR, deployment, new runtime dependency or schema change is authorized by this resumption.
