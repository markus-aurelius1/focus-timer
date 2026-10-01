# Tars vNext Job 4 — independent audit and stabilization

Audit date: 2026-10-01. Base: `main`, `fbac02d` (`Initial Commit`). Jobs 1–4 remain uncommitted. No commit, push, PR, deployment, destructive Git operation, geographic expansion, schema migration or renderer replacement was performed.

## A. Baseline reproduced

Read `AGENTS.md`, `CODEX_HANDOFF.md` and both implementation reports completely before editing. Recorded `git status`, `git diff --stat`, `git diff --check` and `git log --oneline -10`. Initial whitespace check passed; Git's LF/CRLF conversion warnings are not whitespace failures.

Confirmed the existing Job 1 safety copy at `../job1-safety-20261001/`. Created an additional external snapshot at `../job3-safety-20261001-101042/`: 502 tracked/non-ignored working files, complete file copies under `tree/`, binary tracked patch, status/file/log/base records, SHA-256 inventory and restoration instructions. Verified every copied hash. Also preserved the initial production build under `build/` for an actual service-worker upgrade test. Restoration instructions reconstruct a separate directory; they never reset this checkout.

All baseline checks ran **before fixes**. Evidence is in ignored `tools/perf/out/job4/baseline-*.log` and JSON files. Production preview was `http://localhost:4173/`; dev-only checks used `http://localhost:5173/`. Both were strict-port servers. The reconstructed Job 1 build ran at `http://localhost:4177/`.

| Command / suite | Pre-fix result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 112/112, 15 files |
| `npm run build` | Pass; `index-uR0F3hxu.js`; 165 precache entries / 7,525.24 KiB |
| `cd tools/atlas-build; npm test` | 42/42, zero skipped, external canonical ZIP present |
| `smoke.mjs` | 12/12 |
| `atlas-check.mjs` | 21/21 |
| `fullscreen-regression.mjs` | Four repeated exits passed |
| `tars-check.mjs` | 51/51 |
| `vnext-learning.mjs` | 104/104 Paper; 104/104 Night |
| `features-check.mjs` on **dev** | 21/21 |
| `ui-audit.mjs` | 148 states; four widths / both themes; zero layout problems |
| `bundle-profile.mjs`, `load-profile.mjs`, `profile.mjs` | Completed; raw outputs retained |

Environment: Windows, Node 24.19.0, installed Chrome 154.0.8037.58 via `CHROMIUM_PATH`. CI targets Node 22 / Ubuntu. Browser checks are headless Chromium, not physical-device validation.

The green baseline did not prove the stronger audit requirements. Independent probes reproduced recurring-task duplicates, inherited Focus context, and mobile Tars interception of Atlas More. The historical timing claims did **not** reproduce numerically: baseline warm Atlas entry here was 12,448.7 ms for reconstructed Job 1 and 5,913.5 ms for Job 3, substantially slower than the implementation report's environment. Repeated profiles below characterize that discrepancy; the report's old timings were not silently replaced or declared false.

## B. Findings and targeted fixes

No P0 finding. Two P1 defects were reproduced and fixed. Remaining P2 performance uncertainty is explicitly characterized in C/H.

| Severity / area | Symptom and root cause | Fix | Verification |
| --- | --- | --- | --- |
| **P1 — recurring completion** | Concurrent callers using the same stale task created two successors. Completion and successor creation were separate writes and reused caller state. | Reread latest task inside a Dexie write transaction; skip completed/deleted tasks; atomically complete and create one successor. Preserve latest edits and roll back on successor failure. | Pre-fix browser probe produced two successors; repository concurrency/latest-edit/deletion/rollback tests and real two-tab audit pass. |
| **P1 — mobile Atlas controls** | Persistent Tars physically intercepted Atlas More; a normal browser click timed out because Tars covered it. | Place the compact Atlas launcher below zoom controls, keep it out of fullscreen/immersive mode, reserve mobile Focus strip space and bottom scroll clearance. Keep contextual suggestion text desktop-only. | Normal mobile More clicks pass in clean offline and visual audits; four widths/two themes inspected. |
| **P2 — expedition concurrency** | Separate read/close/create operations could leave multiple active runs across callers/tabs. | Transactional expedition start/stop and initial base-camp selection; existing repository timestamps retained. | Concurrent starts leave one active run and same-expedition repeats do not duplicate it. No allocation-rule change. |
| **P2 — Focus context leakage** | A task without a subject inherited the previous subject/intention; internal task picker and command path used different merge rules. | Shared pure `planner/focusContext.ts` for both paths. Different task clears intention and derives subject only from its task/project. Unlinked calendar/explicit subject starts clear old task context. | Pure context tests plus real task/calendar → Focus checks; conflicting task+subject proposals reject before effects. |
| **P2 — stale async timer starts** | Reads could resolve after timer/task context changed, overwriting newer state. | Compare captured timer identity after async reads and reread the task's live completion/update state before starting/linking. | Delayed real profile read plus a newer timer context fails safely; mutation boundary/availability tests pass. |
| **P2 — immediate context freshness** | `currentContext` replaced only the timer portion of an effect snapshot; current task, route and selection could briefly remain from the previous interaction. | Derive imperative context from live timer/hash/selection/day and cached query inputs; recalculate due items on a changed day. | Same-turn task and Atlas → Focus route transitions pass before hashchange/effect dispatch. No context database. |
| **P2 — midnight/resume** | Atlas review queues and several dated screens refreshed only on unrelated state writes. | Shared `lib/useDay.ts` uses a midnight timeout and lifecycle wake events for Atlas/context, Today planning, Focus progress/header, calendar, habits, Insights and date-sensitive editors. | No-write midnight review and Today task transitions; resumed local-day context check. No per-second/frame context tick. |
| **P2 — unsupported control capture** | Unrecognized controls could become task captures; generic timer keywords could match the wrong state action. | Conservative control-prefix guard and state-specific timer keywords. Explicit `Add task Review geography tomorrow` remains supported. | Unsupported commands do not offer capture; explicit capture and invalid/archived/duplicate subject tests pass. |
| **P2 — real place ambiguity** | Parser returned null for ambiguous aliases, but the palette default-highlighted the first search hit. `Open Chandrabhaga` matches Chenab and Bhima. | Leave ambiguous exact place requests unselected until keyboard/pointer selection. Preserve search results and ordinary quick search. | Real alias: Enter keeps the palette open and route unchanged; ArrowDown explicitly selects a result. Unique aliases still work. |
| **P2 — subject/project ambiguity** | Prefix resolution/legacy project tags chose the first matching entity; a project could be created before ambiguous subject resolution failed. | Require a unique exact/prefix match; ignore archived names; reject competing legacy project tags; atomically create capture entities/task. Preview no longer selects duplicate exact names. | Ambiguous capture writes no task or partial project; unique full-name capture passes. |
| **P2 — learning/travel presentation** | Region bars and some empty copy ignored mastery earned before travel. | Count learned untravelled places and include later-added learned places in the relevant denominator; expose accessible unit information; correct legend/empty hints and Insights familiarity percentage. | Region test plus travelled/untravelled × Familiar/Strong/Mastered fixtures at all four widths/two themes. Historical travel rewards/gates remain intact. |
| **P2 — Field Review durability** | Success feedback preceded a fire-and-forget write; storage failure was unhandled and duplicate callbacks could write twice. | Await durable save before feedback/haptics; pending/saved guards, disabled answering while saving and retryable error state. | Injected real IndexedDB failure reveals no success; retry writes once despite duplicate callbacks. Canonical quiz retains its existing durable-save guard. |
| **P2 — canonical attempt identity** | Accepted-answer snapshot retained the supplied mutable array by reference. | Copy accepted alternatives into the attempt snapshot. Keep question ID/hashes/eligible IDs/correctness/time immutable history. | Source correction cannot change old attempt; replace/merge backup, sync, deletion/tombstone and legacy-record compatibility tests pass. |
| **P2 — incomplete precache contract** | Asset UI advertised 111 assets but only 110 were saved: `ATTRIBUTION.txt` was excluded by the Workbox extension glob. | Precache Atlas TXT attribution explicitly. | Clean install with HTTP cache disabled verifies all 111 declared hashes/byte lengths offline. |
| **P2 — false cache readiness** | Old/corrupt same-path cache entries could count as current; count refreshed only once. | Verify bytes + SHA-256 against manifest and refresh on SW readiness/controller change/app wake, with cancelled stale reads. | Poisoned hotspot body gives 110/111; restoring it + wake returns 111/111. Rebuilt-version upgrade also passes offline. |
| **P2 — accessibility/contrast** | Bare dialogs lacked names; palette input lacked a label; layer controls used orphan radio-menu semantics; collapsed inspector/popover could lose focus; muted and marker-colored mastery text failed contrast in inspector/review/search. Neutral checkboxes, Night completed glyphs and off switches lacked control contrast. | Dialog/input names, pressed-button group semantics, Escape focus return, inspector focus transfer, 24/28 px checkbox targets; theme-aware text colors separated from map markers; stronger checkbox/switch boundaries/glyphs. | Keyboard/Tab/Escape checks; native A–D radios; inspector focus; 192 token/background and 96 actual inspector/search mastery label ratios ≥4.5:1; 40 rendered control contrast/target checks; visual review. |
| **P2 — failure feedback** | Expedition/Event UI could close or celebrate despite action failure. | Only perform success feedback/close after `result.ok`. | Registry failure tests and connected browser flows; no fabricated success on rejected effects. |
| **P2 — CI lifecycle** | Browser preview startup/readiness/termination and dev-only verification were weakly specified. | Explicit typecheck; direct strict-port Vite processes; bounded readiness check with failure logs; EXIT kill/wait; production offline and separate dev action checks. | Local command-equivalent suites pass. External ZIP absence explicitly skips six integration tests. Hosted CI has not run. |
| **P3 — dead/false authority** | Unused legacy PastPapers UI and a test-only `accessible() => true` helper could imply competing authority/access verification. | Remove unused component/imports and tautological helper; retain band styles and intentional legacy priority data. Inventory test checks identities; browser tests prove actual access. | Reference search confirms retained consumers; no old manual question list in production. |
| **P2 — current documentation** | README still said notes unlock after discovery; handoff retained an old panel consumer and ambiguous World discovery/access wording. | Correct current access/authority/World-travel descriptions and stabilization gotchas. Preserve historical reports verbatim. | Protected historical hashes and current-source documentation review. |
| **P2 — zoom performance, characterized** | Large frame stalls and high run-to-run variance; settlement/SVG style/layout/paint dominates slow samples. | Measure multiple complete cohorts and trace costs; reject an unproven renderer optimization. Preserve crisp text and renderer constraints. | Full repeated samples, ranges and rejected candidate below. No performance-fix claim. |
| **P3 — experimental tool hygiene** | Isolated map check logged an unidentified HTTP 404 without failing; the experiment has no favicon. | Trace responses and document the optional `/favicon.ico` request; keep the spike isolated. | CDP audit found only the favicon 404; required archive/scripts loaded, map ready and zero page errors. No production dependency. |
| **P3 — unreproduced QA observation** | One late desktop state-matrix run timed out waiting for Familiar after fragment consumption. That run lacked rendered/DB diagnostics, so cause is unconfirmed. | Add failure body/recall/screenshot diagnostics and isolated cohort support; preserve the unsuccessful log; retain the original state/contrast assertions. | An identical complete rerun passed all 48 states and 96 inspector/search ratios; an additional isolated 1920 Night run passed six states and 12 label ratios. No persistent learner-data mismatch was reproduced. Monitor if it recurs; do not call this a proven production fix. |

The fixes use existing persistence and action boundaries. Detailed forms and simple internal interactions retain direct established repository paths; future AI/voice can propose typed `{ action, input }` through `executeProposal` and needs no direct store/DB access. Action guards are not a substitute for repository transactions across tabs. The single active timer's existing engine/store and storage/reconciliation semantics are unchanged.

## C. Performance

**Zoom-in status: INCONCLUSIVE.** No measured renderer optimization was retained. The historical 21.7 → 12.7 FPS relationship was not numerically reproduced in this environment; headless stalls are real, but the repeated distributions do not support a causal improvement claim.

Method: same existing production `profile.mjs`, fresh browser/profile/sample history each run, 390×844, DPR 3, non-touch wheel input, 4× CPU throttle. Three reconstructed Job 1 runs and three pre-fix Job 3 runs were alternated; three candidate runs, three post-functional-fix runs and three final gesture-cohort runs used the identical script (15 full runs total). All six workloads are included. No best-run selection. Data lives in `tools/perf/out/job4-{job1,before,candidate,post-fixes,final}-{1,2,3}.json`; available logs/heaps/screens/traces and `profile-summary.json` supplement every cohort's preserved timing JSON.

Workload: idle 2 s; three pans; 40 × −40 wheel zoom-in; two zoomed pans; 40 × +40 zoom-out; eight in/eight out 100 px notches. Each drag has 113 awaited CDP moves / nominal 8 ms pauses. CDP dispatch backpressure makes actual sample wall duration variable: this is equal event count/order/viewport, **not fixed-rate physical input**. Aggregate FPS uses actual wall time. Tables report the median of three per-run values, range in parentheses; p95 is the within-run frame-interval p95, then aggregated, not a pooled percentile. Maximum interval is also aggregated separately.

| Cohort (three runs each) / workload | FPS median (range) | p95 ms median (range) | Max interval ms median (range) | Wall seconds median (range) |
| --- | ---: | ---: | ---: | ---: |
| Reconstructed Job 1 / idle-2s | 60.2 (60.1–60.4) | 16.8 (16.7–16.8) | 20.4 (17.3–34.4) | 2 (2–2) |
| Reconstructed Job 1 / pan | 50.7 (50.6–51) | 33.3 (33.2–33.3) | 350 (316.5–549.9) | 26.2 (25–27.8) |
| Reconstructed Job 1 / wheel-zoom-in | 3.8 (2.6–5.6) | 616.4 (533.2–699.7) | 933 (765.8–1066.3) | 26.1 (18.5–40.3) |
| Reconstructed Job 1 / pan-zoomed | 47.2 (47.2–50.1) | 33.3 (17.1–33.4) | 499.9 (483.1–583.2) | 19.3 (15.9–20.3) |
| Reconstructed Job 1 / wheel-zoom-out | 3.9 (2.5–4) | 633 (549.8–766.4) | 1049.4 (766.4–1083.2) | 29.2 (24.7–39.7) |
| Reconstructed Job 1 / wheel-notches | 5.6 (3.1–9.6) | 466.6 (449.7–666.4) | 549.7 (516.3–983.1) | 10.5 (7.5–15.1) |
| Pre-fix Job 3 / idle-2s | 60.8 (60.6–60.9) | 16.8 (16.8–16.8) | 16.9 (16.8–16.9) | 2 (2–2) |
| Pre-fix Job 3 / pan | 51.2 (51–53.3) | 33.2 (17.1–33.3) | 316.5 (233.2–416.4) | 24.9 (24.2–27.6) |
| Pre-fix Job 3 / wheel-zoom-in | 16.7 (11.6–37.8) | 316.4 (83.3–433.2) | 466.5 (249.8–616.6) | 6.9 (3.4–9.4) |
| Pre-fix Job 3 / pan-zoomed | 42.7 (36.4–50) | 50 (33.3–83.3) | 466.6 (449.6–866.4) | 23.6 (18.1–29.8) |
| Pre-fix Job 3 / wheel-zoom-out | 7.2 (6.5–29.2) | 516.3 (116.6–599.8) | 683.1 (416.5–883) | 12.8 (4.1–18.3) |
| Pre-fix Job 3 / wheel-notches | 7.6 (5.6–23.5) | 616.4 (233.3–683.1) | 716.5 (566.4–1466.1) | 10.7 (4.9–14.3) |
| Rejected candidate / idle-2s | 60.4 (60.1–60.6) | 16.8 (16.8–16.8) | 17 (16.8–17) | 2 (2–2) |
| Rejected candidate / pan | 53.9 (53.6–54) | 16.8 (16.8–16.8) | 399.8 (349.9–599.7) | 21 (20.7–22.1) |
| Rejected candidate / wheel-zoom-in | 16.1 (12.8–16.6) | 366.5 (333.2–449.9) | 733 (599.8–832.9) | 8.3 (7.9–10.1) |
| Rejected candidate / pan-zoomed | 51.5 (51.3–51.8) | 16.8 (16.8–17) | 449.8 (399.8–699.8) | 14.8 (14–15.3) |
| Rejected candidate / wheel-zoom-out | 14.2 (5.3–18.5) | 383.2 (316.5–499.7) | 533.1 (516.5–733) | 9.7 (7.1–25.1) |
| Rejected candidate / wheel-notches | 15.6 (4.2–23.3) | 366.5 (216.6–616.4) | 499.8 (299.8–649.7) | 6.9 (5.3–12.2) |
| Post-functional-fixes / idle-2s | 60.3 (58.9–60.4) | 16.8 (16.8–16.8) | 16.8 (16.8–66.8) | 2 (2–2) |
| Post-functional-fixes / pan | 56.6 (56.6–57) | 16.8 (16.8–16.8) | 216.6 (216.6–233.2) | 15.8 (15.4–16.5) |
| Post-functional-fixes / wheel-zoom-in | 29.2 (21.3–30.8) | 166.6 (166.6–233.2) | 416.5 (349.8–449.8) | 4.8 (4.5–6.4) |
| Post-functional-fixes / pan-zoomed | 53.4 (53.2–53.9) | 16.8 (16.8–16.8) | 333.2 (233.3–366.5) | 11.3 (10.3–12.5) |
| Post-functional-fixes / wheel-zoom-out | 30.4 (27.8–36.7) | 83.2 (66.7–216.6) | 333.2 (333.2–383.5) | 4.1 (3.6–4.6) |
| Post-functional-fixes / wheel-notches | 19.7 (18.2–24.8) | 233.2 (200–283.2) | 399.7 (316.5–433.2) | 5.5 (5–6.4) |
| Final gesture cohort / idle-2s | 60.1 (60.1–60.3) | 16.8 (16.8–16.8) | 18 (16.8–34) | 2 (2–2) |
| Final gesture cohort / pan | 56.7 (55.8–56.8) | 16.8 (16.8–16.8) | 233.3 (216.6–349.7) | 18.4 (17.9–18.5) |
| Final gesture cohort / wheel-zoom-in | 23.9 (17.2–33.5) | 216.6 (116.5–299.9) | 416.6 (366.6–633.1) | 5.9 (4.2–7.8) |
| Final gesture cohort / pan-zoomed | 54.8 (53.2–55.3) | 16.8 (16.8–16.8) | 300 (266.5–399.8) | 12.7 (12–13.4) |
| Final gesture cohort / wheel-zoom-out | 32.2 (29.9–39.4) | 116.6 (49.9–116.6) | 299.9 (250–416.4) | 4.2 (3.6–4.3) |
| Final gesture cohort / wheel-notches | 21.9 (21–27.8) | 249.8 (116.8–249.9) | 349.8 (316.6–516.4) | 5.2 (5.2–5.4) |

Anomalies are retained: pre-fix notch run 1 reached a 1,466.1 ms maximum; pre-fix zoom-in ranged from 11.6 to 37.8 FPS; Job 1 wheel samples took 18.5–40.3 seconds despite identical event counts. The first post-functional-fix cohort improved its zoom-in median to 29.2 FPS / 166.6 ms p95 despite an unchanged renderer, illustrating why a single favorable cohort is insufficient evidence of causality. The final gesture cohort is an additional independent run set, not a replacement for that evidence: 23.9 FPS / 216.6 ms p95 median, with overlapping pre-fix/final distributions and a worst zoom-in interval of 633.1 ms versus pre-fix 616.6 ms. A favorable median does not establish a causal fix or remove the tail problem.

The final gesture/load cohort used `index-C-4lUeaB.js`. The last production edit afterward reused the already verified text palette for a Gazetteer status label; the Gazetteer is closed in the gesture workload. Final delivery measurements below use `index-DqAatB9H.js`. The renderer and gesture event paths did not change; root/build, Atlas/learning and travel/mastery/search contrast checks were rerun after that label-only edit.

Diagnosis: spatial indexes and label hierarchy are cached by data identity; labels relayout at settlement/stale-margin boundaries, not via per-frame React state. Hotspots are off initially, memoized, contain counts/IDs rather than question bodies, and are not in the default profile workload. Catalogue/question chunks remain deferred. Timer/context do not update on every clock frame. The production renderer retains CSS layer transforms, HTML name counter-scaling and settlement-based SVG symbol updates.

Traces (event totals overlap; do not add nested totals): current 24-event zoom-in had RunTask 1,281 ms / UpdateLayoutTree 141 / Layout 46 / Paint 25; reconstructed Job 1 trace had RunTask 12,410 / FunctionCall 4,416 / UpdateLayoutTree 3,004 / Layout 1,100 / Paint 1,132. Current zoom-out had RunTask 8,757 / style 1,534 / layout 631 / paint 575, including a 621 ms style update. Notches had RunTask 18,771 / style 3,304 / layout 1,462 / paint 2,360 and a 937 ms style update, plus 318 ms major GC. This implicates settlement/counter-scale SVG/DOM browser work and occasional GC; it does not prove React or hotspots caused the historical regression.

Candidate: skip no-op transform/settlement at clamped boundaries. Three complete runs gave zoom-in median 16.1 FPS versus pre-fix 16.7; median p95 366.5 versus 316.4 ms; median maximum 733.0 versus 466.5 ms. Rejected and precisely reverted. `AtlasMap.tsx` is text-identical to the pre-audit snapshot. No reduced label density, rasterized text, per-frame React state, per-frame SVG writes, functionality loss or new map engine was introduced to obtain a benchmark win. Keeping crisp vector text and complete study symbols retains settlement style/layout/paint costs; this audit found no measured reduction that met the same correctness/UX constraints. Physical-device tracing remains the next justified step.

### Delivery and loading

| Measurement | Pre-fix Job 3 | Final Job 4 |
| --- | ---: | ---: |
| Entry JS raw / gzip | 256,303 / 77,605 B | 258,153 / 78,196 B |
| Initial **static import graph** raw / gzip | 798,310 / 254,350 B | 801,109 / 255,349 B |
| Atlas route chunk raw / gzip | 63,008 / 19,437 B | 63,767 / 19,755 B |
| Field Review lazy chunk raw / gzip | 52,086 / 18,457 B | 52,670 / 18,676 B |
| Precache | 165 entries / 7,525.24 KiB | 166 entries / 7,531.58 KiB |

The 2,799-byte static-graph increase includes durability, ambiguity and day/context fixes; no byte-only refactor was attempted. The initial graph remains below reconstructed Job 1 (838,992 raw / 265,879 gzip B). Atlas renderer/route and Field Review/quiz remain outside the initial static graph. Shared Atlas domain/index code and gazetteer loading are intentional for Focus expedition/context; this is not a promise that all geographic data waits until Atlas navigation. Service-worker precaching intentionally fetches all small curated packs, while JavaScript/runtime reads remain requested-paper lazy. No full canonical corpus/archive, spike distribution or duplicate old build chunks ships.

Original Atlas assets total 5,218,412 B; curated 100 JSON files total 526,535 B, 49 paper/answer pairs; hotspots 17,987 B for 211 meaningful places, no question bodies; asset manifest 40,324 B. The largest gazetteer stays 2,548,302 B under the 3 MiB per-file precache limit. Shared vendor chunks are not duplicate canonical data. Command search scans the bounded 2,273-place name/alias inventory and active tasks, not a 6,982-question corpus, and loads no question bodies per keystroke.

| Warm loading sample | Requested JS before Atlas | Atlas entry ms | Used / total JS heap B | Embedder / backing storage B |
| --- | ---: | ---: | ---: | ---: |
| Pre-fix / job1 | 879,514 | 12448.7 | 33,164,880 / 50,225,152 | 12,576,768 / 4,309,263 |
| Pre-fix / vnext | 838,965 | 5913.5 | 21,657,944 / 52,264,960 | 5,065,536 / 1,007,117 |
| Final / job1 | 879,514 | 2060.3 | 21,577,604 / 51,478,528 | 4,625,520 / 959,441 |
| Final / vnext | 841,768 | 2023.7 | 34,601,460 / 53,895,168 | 13,846,080 / 4,360,932 |

These are individual warm-loading/heap observations, not repeated statistical claims. Setup visits Settings for onboarding and starts from Focus, so requested JS includes those previously visited chunks and SW registration; it is not the cold initial static graph. Heap snapshots are post-navigation before an enforced GC, so differences cannot establish a leak or a memory improvement. Atlas entry latency varies with host scheduling/cache/GC; no physical loading promise is inferred.

## D. Data integrity and compatibility

`job4-integrity.mjs` verified **194 protected files byte-identical** to the external snapshot: original/curated/additive Atlas artifacts, Atlas-build inputs/reports, root packages, timer engine/store, DB/types/repository/backup/sync, deterministic `explore.ts`, AGENTS and both historical job reports. It also verifies pack file hashes and confirms the renderer candidate is reverted.

- Inventory remains **149**, **CSE 72 / PCS 30 / CDS 47**, 49 pack pairs, all eight admitted structures. No inferred answers/explanations or broken source reconstruction.
- All **2,273 permanent IDs**, coordinates, original source data and the historical `ATLAS_V2_AT` allocation boundary are unchanged.
- `lodestar` DB name, installed PWA ID, native app IDs/scheme, old storage/backup identities remain intact.
- Dexie stays **v2**. Optional non-indexed `recalls.pyq` needs no migration: all repository/JSON backup/sync paths serialize it; old non-PYQ attempts retain their behavior.
- Canonical history includes canonical ID, question hash, supplied answer hash, selected key, copied accepted alternatives, copied eligible primary-stem place IDs, correctness/time/day. Mastery reads recorded correctness/eligible IDs, not the latest canonical answer, so future correction cannot silently reinterpret old attempts.
- Opening/viewing a question creates no attempt. Distractor/incidental/supporting/comparison relations can be navigational evidence where meaningful, but only eligible primary-stem IDs earn PYQ mastery. PYQ remains a separate type and supplies no fictitious spatial/ordering evidence.
- Intentional legacy manual ledger supplies historical priority/provenance. CDS curated counts never alter that model. Canonical bodies/answers have one runtime authority.
- Accessible knowledge is independent of Travelled allocation and Familiar/Strong/Mastered history. Travel gates, living-world rewards and World travel limits are historical progression rules, not information permissions.

## E. Offline

`job4-offline.mjs` passed **18 checks** including a real build upgrade. Each run uses a fresh browser context and local learner data, installs online, waits for SW/controller, clears HTTP cache, disables it via CDP, goes offline and reloads. Response evidence confirms HTML/entry and previously unopened paper/final-answer JSON came from the service worker.

Offline flows: Atlas opens; search opens untravelled Nathu La; never-manually-opened canonical question is answered durably; meaningful place navigation returns; local task capture, timer start/stop and calendar command work. No server/HTTP-cache fallback supplies these results. UI verifies 111/111 asset bytes/hashes; corrupt same-path hotspot test gives 110/111 and wake-after-restore returns 111/111.

Upgrade serves the saved pre-audit build, installs it, switches the **same origin** to final dist, requests/activates the waiting SW, verifies entry version changes, then repeats cache-disabled offline flows. The first upgrade harness missed asynchronously installing workers; it was repaired to observe `updatefound`/state transitions before sending Workbox's `SKIP_WAITING`. The final sweep also exposed a navigation race between a manual test reload and Workbox's possible reload. The harness tolerates only that `net::ERR_ABORTED` overlap, then requires the changed module entry and ready application; all other navigation errors still fail. Waiting for automatic reload alone also timed out, so it is not assumed to happen on every activation path. These are harness timing corrections, not waived offline assertions. No regional/online pack feature was added.

## F. Visual and accessibility audit

Production expanded matrix: **300 captures**, 375/768/1366/1920 × Paper/Night, zero horizontal overflow/page errors, **192** text-token/background contrast checks ≥4.5:1. Independently generated contact sheets and native-size screenshots were reviewed, not just script exit codes. Additional real-repository dev fixtures: **48** travelled/untravelled × Familiar/Strong/Mastered captures across the same widths/themes, verifying actual derived levels/travel state and **96** actual inspector/search label contrast ratios.

Inspected idle/running/completed Focus, persisted session/expedition progress and Tars presence; dense Today planning/task sheet/task→Focus; calendar events/block sheet/calendar→Focus/mobile; India/World/zoom levels/fullscreen/hotspots/catalogue filters/selected place/open and collapsed inspector; empty and mature Insights with source-session sheet. All eight quiz structures (MCQ, statements, pairs, sequence, assertion–reason, matching, table, propositions) were inspected before/after answer. Long content scrolls vertically; option labels/table columns do not overflow horizontally. Related-place chips retain semantic roles without invented explanation.

Targeted polish: contrast colors, named bare dialogs/palette input, layer-group semantics, focus return, checkbox targets, compact tablet Tars, Atlas control separation and mobile bottom clearance. Forty additional checks measure actual rendered checkbox outlines/completed glyphs and off-switch outlines/thumbs (≥3:1), plus ≥24 px checkbox targets; 16 new screenshots cover their final appearance. All 48 travel/mastery fixtures also measure inspector and Gazetteer label contrast ≥4.5:1 (96 ratios). Small mastery text uses theme-aware ink instead of marker colors; map geography/marker colors/label hierarchy/halos and existing Paper/Night design remain. Wide-screen empty space is retained rather than filling it with a new dashboard. No broad redesign.

The first final layout run caught a Job 4 clearance regression: applying scrolling-screen padding to viewport-fitted Focus caused 64 px of extra vertical scroll. Focus now retains its original 84 px reservation; scrolling screens retain the additional launcher clearance. Final layout verification was rerun rather than weakening its assertions.

Keyboard audit covers palette trigger/combobox, trapped Tab, Escape and trigger focus return, no automatic ambiguous-place choice, native A–D radios and inspector collapse/reopen focus. Existing Sheet modal stack traps the innermost layer; MapLayers Escape returns focus to its trigger. Existing reduced-motion MotionConfig/CSS remains. Browser visual harness was corrected after detecting frozen/blank transition frames from global virtual-clock advancement: normal timing now drives screenshots; only Date is advanced for session-completion reconciliation. Invalid earlier captures were not accepted as evidence.

This is not an exhaustive screen-reader or physical touch-device certification; that work is categorized below.

## G. Final verification

| Final check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | **125/125**, 17 files |
| `node --test tools/atlas-build/test/*.test.mjs` | **42/42**, zero skipped with external package (same Atlas-build npm test script) |
| Pipeline without external package | **36 passed / 6 explicitly skipped / zero failures** |
| `npm run build` | Pass; `index-DqAatB9H.js`; **166 entries / 7,531.58 KiB** precache |
| Production smoke / Atlas / fullscreen | **12 / 21 / four repeated exits**, all pass |
| Production Tars / learning | **51 / 104 Paper / 104 Night**, all pass |
| Production responsive audit | **148 states**, 375/768/1366/1920 × Paper/Night; zero layout problems |
| Dev features / independent action audit | **21 / 23**, all pass |
| Clean-install offline + version upgrade | **18 checks**, all pass on final build; repeated upgrade also passed; HTTP cache disabled |
| Expanded visual / contrast | **300 captures / 192 token ratios**; zero overflow/page errors |
| Final travel/mastery matrix | **48 captures / 96 actual inspector/search label ratios** (5.00–11.27:1); zero page errors |
| Final rendered controls | **40 checks / 16 captures**; ≥3:1 graphics and ≥24 px targets; zero page errors |
| Bundle / loading / gesture profiles | Complete; **five cohorts × three runs × six workloads**, including rejected candidate and both post-fix cohorts |
| Integrity | **194 protected files**, **2,273 IDs**, **149 questions (72/30/47)**, **49 pack pairs**, Dexie **v2**, all pass |
| Isolated map spike | Data regeneration and own-package browser check pass; production exclusion verified |
| `git diff --check` | Pass (LF/CRLF conversion notices only) |

Evidence: `tools/perf/out/job4/final-*.log`, `final-browser-results.json`, `actions-results.json`, `visual/results.json`, `states/results.json`, `controls/results.json`, `final-bundle.json`, `final-load.json`, `profile-summary.json`; raw gesture files reside in `tools/perf/out/`. These are ignored review artifacts, not shipped runtime data. The code and permanent regression scripts remain uncommitted.

Final screenshot validation was run sequentially after an overlapping-browser screenshot timeout and a transient sidebar-readiness failure during concurrent build/browser activity. This correlation does not establish a production root cause. The action harness now waits for actual modal detachment/focus return and locates the dynamically named review by its Close review control. These unsuccessful harness runs were investigated; accepted final runs retain the original product assertions.

The full 148-state responsive/command/workflow sweep followed all functional and geometric fixes. After the final Gazetteer color-only reference change, root/typecheck/build/integrity, production Atlas and learning in both themes, and the complete real-fixture inspector/search contrast matrix were rerun. Geometry, control placement and action semantics did not change in that last edit. Offline upgrade also targets the final delivery build.

CI review: commands exist, pipeline runs at correct root paths, Playwright installs pinned Chromium with system dependencies in its own QA package, production and dev lifecycle/readiness are explicit, EXIT cleanup kills/waits direct Vite PIDs, and outputs upload even on failure. Production suites do not require the external canonical ZIP. Without ZIP the pipeline explicitly reports **36 passed / 6 skipped / zero failures**. Local command-equivalent results are reported above; **hosted GitHub Actions has not run**. No root dependency leaked from the spike.

Map spike boundary: root package/lock/src/build/CI contain no MapLibre/PMTiles production import/dependency. `tools/map-spike` remains its own development package/lockfile and ignored data output. `npm run prepare:data` reproduced 276 tiles, 482,682 archive bytes, 2,273 stable study IDs; its server and `npm run check` completed with zero page errors using MapLibre 6.11.2 / PMTiles 4.5.0. A separate CDP response audit traced the single console HTTP 404 to `/favicon.ico`; required map resources succeeded. Its check still does not prove cold-offline installation. The decision against promotion remains: insufficient cold-offline policy, production study-layer/controlled-geometry parity and target-phone GPU proof. Production distribution contains no spike artifacts.

## H. Remaining work

### RELEASE BLOCKER

None known after the targeted fixes and local acceptance checks. This is a locally audited release candidate for human review/logical commits, not a hosted-CI/deployment/device certification.

### POST-RELEASE

- Zoom/settlement jank remains a measured P2 concern with high headless variance; no uniform gesture-performance win is claimed. Follow C's comparable protocol and trace label/style/layout/paint on target hardware before selecting an optimization.
- Existing generated Ramsar duplicate-fact/template/source-framing policy and stale not-mapped notes remain content-hygiene work; do not hand-edit facts or resolve policy implicitly.
- Legacy reminder body date/time formatting remains a bounded pre-existing polish item.
- Revisit command-name indexing only if measured real learner datasets grow enough to make the bounded scan expensive.
- Investigate the unconfirmed state-matrix label timeout if it recurs, using the new failure instrumentation for rendered/recall state. Complete repeated state/contrast checks currently pass; no production cause is claimed.

### FUTURE FEATURE

Unresolved 6,829 geographic occurrences / 213 candidates, additional places/routes, deeper cartography/regional packs, optional downloads, live tiles, renderer replacement, cloud AI/voice, new planning/game mechanics. None is implemented here or classified as a blocker for working current information access.

### PHYSICAL-DEVICE VALIDATION

iOS Safari (including window-fullscreen fallback/HTML halos), Android/WebView/phone GPU gesture distributions, touch inspector/control spacing, real screen-reader traversal, OS notification/permissions and installed-PWA updates across sleep. Headless emulation cannot establish these properties.

Safety snapshots, raw QA outputs/traces/screenshots and final full working tree remain available for review. Historical reports are preserved. No learner data in the user's normal browser was used; QA creates isolated disposable contexts.
