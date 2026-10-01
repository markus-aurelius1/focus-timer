# TARS vNext Job 6 — Current Affairs daily reading workspace

2026-10-01. Focused upgrade to Job 5 on the existing uncommitted Jobs 1–5 tree. Implementation/acceptance finished without a commit, push, PR or deployment. The user subsequently authorized committing/pushing completed Jobs 1–6 to `origin/main` on 2026-10-01; no separate deployment was requested.

## Implemented

`#/current-affairs` defaults to today’s IST edition, grouped by the primary coverage item’s publication date. Previous/Today/Next, native date picker and recent-edition read/unread statuses are available. Undated items have a separate edition; they never inflate today’s count. Daily completion and minutes left derive from personal state across the entire edition, independently of list filters.

Desktop ≥1024px uses 42/58 independently scrolling list/inspector panes. Compact rows retain tier, headline, publisher/time, syllabus/exam metadata, reading estimate, read status and bookmark. Mobile uses the list, compact subject selector and existing `Sheet` detail with pinned original/read/save actions; closing restores list scroll. Paper/Night, Fraunces major titles and Manrope UI reuse Tars tokens without new dependencies.

All CA / Must Read / Unread / Saved, date, exam, subject, publisher, multi-term metadata search and 15/30/60-minute plans compose locally. Publisher/search filters include alternate coverage. Inspector offers classifier evidence, separately labelled **From the feed** excerpts, clustered alternate publisher links, exact References and personal Notes. Empty References and single-source related coverage tabs are hidden. `Open original` opens the preserved primary publisher URL in a safe new tab; selection stays put on return and on marking read. No generated summary, article scraping/body storage or image scraping.

Study mode snapshots today’s filtered queue in memory; marking read does not remove or reorder its articles. Previous/read/next, save and original-link actions lead to a completed reading set. Desktop J/↓, K/↑, R, S and O work in both the workspace and Study mode, yielding to text inputs, modifiers, navigation chords and other dialogs. Job 5 debug still exposes raw classifier/rejection/member evidence, plus the Must Read heuristic score.

## Personal state

`src/current-affairs/personal-state.ts`, key **`tars.current-affairs.state.v1`**:

```json
{"version":1,"entries":{"https://publisher.example/article":{"readAt":1790852400000,"savedAt":1790852400000,"note":"Personal study connection"}}}
```

Only canonical publisher URL keys and optional millisecond `readAt`, `savedAt`, user-authored `note` (8,000 characters maximum) persist. Event actions apply to all known member URLs; any member’s existing state carries into a changed primary/cluster ID. Clearing read/save removes only that field. No metadata, bodies, stored counters, Dexie change, dwell tracking or ignored-state feature. Every write rereads storage; cross-tab storage events refresh the UI. Unknown versions/corrupt JSON are preserved, failed writes report failure, and a failed note save keeps the draft visible. This separate origin-local state is outside the existing Dexie backup/sync system; localStorage is not an atomic cross-tab transaction.

## Deterministic Must Read rule

`src/current-affairs/workspace.ts`: accepted events become **★ Must Read** at **`MUST_READ_THRESHOLD = 7`**, otherwise **Relevant**. Rank by tier, heuristic, publication time, then stable URL. No LLM or numerical ranking in normal UI.

| Existing evidence | Points |
| --- | --- |
| Classifier score ≥12 / ≥7 | 2 / 1 |
| Maximum matched concept’s CSE Prelims + Mains document count ≥20 / ≥5 | 2 / 1 |
| Matched concept has taxonomy IDs and a specific subtopic | 1 |
| Concept is in the existing institutional/convention official-URL allowlist | 1 |
| Primary source is official in the registry | 2 |
| More than one distinct publisher in cluster | 1 |
| Explained/explainer coverage in cluster | 1 |
| Supported Prelims + Mains demand | 1 |

Document frequencies are lexical evidence, not exact topic mappings, distinct-year counts or exam predictions. Threshold and boundaries are unit-tested.

## Approximate reading time

Metadata-only precedence: analysis/opinion/editorial **7 min**, official primary **4 min**, Explained/explainer **6 min**, UPSC feed **4 min**, other standard reports **3 min**. Tooltips/copy identify estimates. Unread edition estimates sum to minutes left. Budget plans walk the highest-value unread order and include items that fit remaining estimated minutes, skipping oversized items; selecting the active budget again clears it. Study mode freezes the resulting queue.

References use only the existing exact official-homepage allowlist in `static-links.ts`; every generic Google/provider search was removed. Unsupported concepts return an empty array. No new reference URLs or feed discovery were introduced.

## Validation

Typecheck, root **168/168 tests in 19 files**, build, production smoke **12/12** and **209 focused browser checks** pass. The final production build has 170 precache entries / 7,610.86 KiB. All four 375/1366 Paper/Night layouts have zero horizontal overflow and zero page errors; settled list, detail and Study screenshots were visually reviewed. Cross-tab updates, complete-today Study flow and reload read/save/note persistence are verified. `git diff --check` passes; new Job 6 files also have no trailing spaces. A focused source review corrected a misleading high-score reason without changing classifier acceptance. Focused tests cover personal persistence/errors/cluster identity, threshold/evidence, estimates, budgets, IST dates, progress and composed search/filters. `tools/perf/current-affairs-check.mjs` runs the four production layouts and actual Workbox successful-cache / 503 preservation / offline reload with HTTP cache disabled. Evidence and screenshots: ignored `tools/perf/out/current-affairs-workspace/`.

## Preserved scope and limits

Job 5’s gateway, 11 enabled feeds, source-failure isolation, canonical relevance asset/pipeline/classifier, clustering, original links and Workbox strategy remain unchanged. No publisher expansion, pipeline regeneration, Atlas profiling, Job 4 matrix or full offline-upgrade audit. Dates only cover the latest successful cached feed response, not a permanent news archive. Metadata heuristics remain conservative and approximate; saved articles whose metadata ages out are retained as URL state but cannot be displayed without feed metadata. Browser evidence uses deterministic feed fixtures; live feeds were not rediscovered. Hosted/physical-device validation remains unperformed.
