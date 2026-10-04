# Content-first density correction — 2026-10-04

The owner's correction is applied to the existing local Editorial Cartography work. Phase 1 semantic tokens, themes and font assets are retained. The checkout already contained substantial uncommitted presentation and runtime repairs; this pass changes presentation, its browser harnesses and handoff documentation. No project restart or publication.

## Mobile-first reassessment and implemented arrangement

- Phase 2: one 48px product bar, with Atlas/News navigation on phones, tablets and desktop. The separate mobile bottom switcher is removed. Safe-area insets remain additional. Primary links and utility controls retain 44px touch targets.
- Phase 3: a 22–24px News title alongside compact search/filter/refresh/archive actions, followed by one state-tab row and a compact freshness/edition line. Search expands only when requested or when a retained query is active; Escape/Close clears it and returns focus. Filters and Sources use the existing contextual sheet/dialog. The desktop collection rail is removed. Editorial rows use 10–12px vertical padding, 20–23px headlines, one visible RSS excerpt line and smaller real thumbnails; mobile row actions use icons with preserved accessible names. Empty states use short, left-aligned copy.
- Phase 4: one small region/search/options strip, with no permanent utility dock or idle action card. World/India occupies 116px. Search opens the existing Gazetteer. Map options combines layer/style/place controls with Legend, fit, PYQ hotspots, fullscreen, review and Atlas tools. Compact zoom remains directly visible. Fullscreen retains a direct exit action. Inspector, mobile detents, knowledge, relationships, recall and question surfaces remain.

Existing source URLs, classification, archive grouping, Read/Saved precedence, remove/Undo and both dormant note stores are retained. Map algorithms, labels, geometry, canonical question data/grading/history and personal-state mechanisms were not edited in this correction. Atlas control-clearance insets are adjusted to match the slimmer strip. No runtime dependency, migration or source-package changes.

## Measured density

Production preview, RSS metadata fixtures, loaded fonts, both themes. Insets are zero in these headless contexts; physical-device safe areas are not claimed verified.

| Viewport | Map height | Default map controls as area share | First News row, y | Complete fixture articles visible |
| --- | --- | --- | --- | --- |
| 320 × 740 | 692px | 6.40% | 173px | 3 |
| 390 × 844 | 796px | 4.56% | 173px | 4 |
| 768 × 1024 | 976px | 1.89% | 181px | 5 |
| 1440 × 900 | 852px | 1.15% | 181px | 4 |

The former mobile shell reserved 52px + 56px; the new shell reserves 48px. This gives the map 60px more height before safe-area insets. Article counts depend on actual headline, metadata, image and related-coverage lengths; these are measured fixture results, not a guarantee for every feed.

## Verification

- Typecheck and final production build pass; 158 precache entries. Build log: `tools/perf/out/density-build.log`.
- Unit tests: 31 files / 229 pass. Lint: 0 errors, existing repository warnings remain.
- `node tools/perf/density-check.mjs http://127.0.0.1:4174/`: 177 checks pass across four widths and both themes. Includes actual coverage/geometry, primary and map touch targets, options accessibility, focus return, collapsed search, filtering, contextual Sources and no horizontal overflow. Results and screenshots: `tools/perf/out/density/`.
- `node tools/perf/atlas-check.mjs http://127.0.0.1:4174/`: 21 checks pass, including phone gestures, desktop input, region switching, search/selection and camera positioning around the inspector.
- `node tools/perf/fullscreen-regression.mjs http://127.0.0.1:4174/`: four repeated fullscreen exits pass with restored chrome and no page errors.
- `node tools/perf/smoke.mjs http://127.0.0.1:4174/`: 100 product checks pass, including offline Atlas and verbatim historical personal-state preservation.
- `node tools/perf/editorial-check.mjs http://127.0.0.1:4174/`: all 267 checks pass at 390/1024/1280/1440px in both themes, with no page errors. Covers inspectors/detents, related places, Gazetteer/options, recall grading/keyboard/focus, News queues/publisher links/search/filters/Sources/archive and dormant-state preservation, Settings and reduced motion. Its media-emulation setup now waits for the preference listener and React commit before opening a reduced-motion surface; the translation assertion is unchanged. Results/screenshots: `tools/perf/out/editorial/matrix/`.
- Full News fixture suite: 247 checks pass before the existing `Workbox: 503 preserves last successful response` assertion fails. `--workbox-only` reproduces the same failure independently: the successful API cache entry is absent after a failed refresh. Feed/network/cache code was not changed by this density pass. The earlier report already records intermittent failures of this assertion; it remains unresolved and is not waived.
- Whitespace review is clean. Presentation and test-harness changes were manually reviewed; no `/review` capability is available in this session.

Earlier renderer timing/label-cost and physical-device acceptance gaps remain governed by `TARS-PRODUCTION-READINESS.md`. Density acceptance does not establish production readiness, repair the offline-cache failure or waive performance gates. All work remains local and uncommitted.

## Live preview follow-up

The owner reported online News not loading. Live local API inspection returned HTTP 503 / all 39 publisher fetches failed. Direct RSS requests inside the restricted execution environment failed with `EACCES`; identical probes outside it returned HTTP 200. Relaunching the preview with network access and refreshing the existing user tab restored 27 real current News rows. This live environment verification is separate from the RSS fixture tests above. Some individual feeds are unavailable, and the separate 503-cache retention regression remains unresolved. No app code, state reset or cache deletion was needed. Screenshot: `tools/perf/out/density/live-news-restored.png`.
