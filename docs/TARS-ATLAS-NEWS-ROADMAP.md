# TARS — Atlas + News overhaul roadmap

Updated 2026-10-04. **The owner has paused the overhaul again. Only the Atlas runtime regression repair is authorized.** The queue below records retained scope for a future explicitly authorized resume; it is not executable now. Tars remains **Atlas | News**, with auxiliary shared Settings. No removed feature is to be restored.

Completed shared, Atlas and News work stays accepted unless a verified regression requires repair. J-23 remains accepted. The old 25/40 percentage describes the superseded product and is not a current completion measure.

## Remaining execution order

| Order | Job | Retained scope | Current state / gate |
| --- | --- | --- | --- |
| 1 | J-24 | Atlas tile worker, bounded cache, fallback, cartographic parity and gesture performance | Paused; not accepted. Preserve the existing desktop ≤20 ms / phone 4× ≤34 ms continuous-zoom p95, zero frames >100 ms and ≤50 ms end-pan gate. Pixel tolerance still requires owner agreement after concrete comparison evidence. |
| 2 | J-25 | Atlas HTML point names, curved lettering, fixed screen-size labels and positioning cost | Paused; separate final acceptance remains required. The 2026-10-04 bitmap lifecycle crash repair is not overhaul acceptance. No per-frame React state or SVG writes. |
| 3 | J-15 | Atlas inspector, detented phone sheet, anchored search, keyboard preview, layer legend and touch targets | Not started. Remove ExpeditionSheet, travel and revision-task requirements. Keep map interaction and existing entity/PYQ behavior. |
| 4 | J-18b | Shared Atlas question/review surface | Not started. Preserve canonical grading, explanations, saved-attempt durability and accessibility contracts. |
| 5 | J-16b | Existing News list on shared primitives | Not started. Preserve To be Read / Read / Saved, publisher links, archive, dated short notes and existing verification contracts. No new News product features. |
| 6 | J-29 | Atlas/News/Settings accessibility | Not started. Retain in-view place list, selection announcements, headings, non-colour mastery cues and route/dialog scans. |
| 7 | J-30 | Atlas/News WebKit and physical-device verification | Pending browser availability and recorded manual iPhone/Android checks. Cover map gestures, full screen, offline reload and retained sheets with keyboard open. Desktop emulation does not satisfy the device gate. |
| 8 | J-20 | Tactile details in retained controls and Atlas | Partial: Stepper hold-repeat and Slider detents already implemented. Retain map grab/grabbing cursors and only shared effects with an actual retained consumer. |
| 9 | J-21 | Atlas/News loading and empty states; retained News note motion/autosave | Not started. Destination-layout skeletons and stable transitions only. No Insights charts or standalone Notes screen. |
| 10 | J-26 | Atlas detail packs, geometry/relief levels | Separately gated: new data, network generation, pack/precache policy and source changes still require explicit owner approval. Resuming the overhaul does not authorize regeneration. |

Track the unfinished shared J-06 motion-timing lint/migration and J-07c native Back → `closeTopSurface()` integration. Address them as distinct bounded jobs; prior primitive acceptance does not establish those remaining items are done.

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
