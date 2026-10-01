# TARS vNext Job 5 — Current Affairs, lean v1

2026-10-01. Complete narrow vertical slice on the existing uncommitted Jobs 1–4 tree. No commit, push, PR or deployment. Existing `../job3-safety-20261001-101042/` snapshot retained; no new large snapshot or historical report edits.

## Architecture

`#/current-affairs` is lazy-loaded, titled **Current Affairs**, with **News** in the existing sidebar and six-item bottom navigation; command palette and G → W navigation work through the existing action boundary. `api/current-affairs.ts` supplies the same-origin GET endpoint in Vercel and Vite dev/production preview. Only enabled registry URLs are fetched concurrently, each with a 10s timeout, a 4 MiB response limit and redirects rejected. RSS 2.0/Atom parsing checks balanced XML, rejects DTD/entity declarations, strips description HTML/normal entities, bounds title/teaser length, canonicalizes tracking-free HTTP(S) links and deduplicates exact URLs. Full-content fields are ignored; no article fetch occurs. Partial failures return per-source statuses; all failed feeds return 503/no-store. Successful HTTP caching: `max-age=0, s-maxage=3600, stale-while-revalidate=21600`. No new dependencies, scheduler or server database.

## Sources

Verified live on 2026-10-01, then verified through the actual HTTP handler (200; 842 unique links in that changing sample; POST 405). All **11 enabled feeds** loaded:

| Publisher / section | Enabled feed |
| --- | --- |
| RBI notifications | https://www.rbi.org.in/notifications_rss.xml |
| RBI press releases | https://www.rbi.org.in/pressreleases_rss.xml |
| SEBI regulation | https://www.sebi.gov.in/sebirss.xml |
| Indian Express UPSC Current Affairs | https://indianexpress.com/section/upsc-current-affairs/feed/ |
| Indian Express Explained | https://indianexpress.com/section/explained/feed/ |
| Indian Express Economy | https://indianexpress.com/section/business/economy/feed/ |
| Mint Economy | https://www.livemint.com/rss/economy |
| The Hindu National | https://www.thehindu.com/news/national/feeder/default.rss |
| Guardian World | https://www.theguardian.com/world/rss |
| Guardian Environment | https://www.theguardian.com/uk/environment/rss |
| Guardian Science | https://www.theguardian.com/science/rss |

PIB’s published English endpoint `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1` returned valid XML with zero items twice: disabled in registry, deferred. A regional probe returned Hindi; no alternate English endpoint was invented. Guardian’s generic Environment URL returned a 302, so the registry uses its directly verified target. MEA, separate governance feeds, TOI/ET are deferred to keep v1 small; The Print/NYT are deferred without reverse-engineering. Feed discovery used publisher RSS directories ([PIB](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1), [RBI](https://www.rbi.org.in/Scripts/rss.aspx), [SEBI](https://www.sebi.gov.in/rss.html), [Indian Express](https://indianexpress.com/rss-2/), [Mint](https://www.livemint.com/rss), [Guardian](https://www.theguardian.com/help/feeds)) and the requested Hindu feed directory plus actual endpoint responses.

## Relevance and event identity

`tools/current-affairs/build-relevance.mjs` reuses the existing verified canonical loader on `../canonical-pyq-v2-final.zip` (release 2.1.0); filters **UPSC-CSE only**, 3,896 Prelims records. Mains input comes from [the supplied PYQ Engine](https://github.com/markus-aurelius1/pyq-engine) at commit `31cd820df0506fd1ffeb818ff0e2b2357d95c7a0`, source SHA-256 `735642df186eecfe1b79ec9f3a1c4ef91df5907e4b4bef4b85850e14e52428d6`. Only actual dated, non-`extra` GS I–IV questions contribute: **1,130**. Excludes optional papers, practice questions, topper answers, PCS and CDS.

The **15 local taxonomy ZIPs** under `../taxonomies/` contribute title/ID anchors and JSON required concepts (the two Sociology optional archives are excluded). A purpose-specific extractor reads adjacent single-line YAML id/title scalars, not scopes or cross-exam frequency assertions. The output has **106 supported signals**, **41,115 bytes**: concept/aliases, subject/topic/subtopic, taxonomy IDs, lexical CSE document frequencies and Prelims/Mains demand. No PYQ bodies or question excerpts ship. Editorial alias seeds plus repeated taxonomy-backed concepts are derived automatically; counts are evidence, not claims of exact question-to-topic mapping. Optional-only subjects and Essay are outside this v1 index.

Pure `classify` requires a supported concept in the headline, a substantive syllabus signal in headline/teaser, and no strong negative headline. Source/section alone cannot admit a story. Routine crime, sports, entertainment, consumer products, stock moves, exam-practice posts and ordinary court/extension notices are rejected conservatively. Subjects/topics favor headline matches (two subjects maximum); exam demand uses supported index evidence. The live direct-gateway sample after tightening had **841 unique links → 66 accepted events**, all enabled sources successful; counts vary with publishers. Scores and rejection evidence appear only in `?debug=1`.

`clusterItems` uses complete-link grouping: shared strong concept, ≥3 informative shared title tokens, Jaccard ≥0.6 and ≤36h. Identical normalized titles may merge within 48h; undated items stay separate. All original links survive; official source first, then explainer priority/relevance, then alternate coverage. Tests verify same-event merge and separate RBI/Supreme Court developments. The live sample did not yield a fuzzy multi-source cluster; the fixture verifies that behavior without claiming live clustering coverage.

## Links, cache and UI

Article headlines open original publishers; no summary paragraph or images. Static concept disclosures offer Official, Wikipedia, Britannica and Vikaspedia. Known institutional/major-ministry homepages link directly; other concepts use provider searches, never guessed article paths. No encyclopedia text is fetched. Subscription requirements remain with publishers.

Workbox NetworkFirst caches only successful `/api/current-affairs` responses in `current-affairs-v1`; a cache-read header identifies fallback even when `navigator.onLine` remains true. Client CacheStorage fallback preserves the last success after failed revalidation. `Updated X ago`, loading, empty, publisher failure, stale and offline/cached states are explicit. The relevance asset uses the existing precache glob; no news asset-manifest system. No Dexie/app tables, learner state, bookmarks or read/unread persistence. Workbox may maintain its own cache-expiration metadata; that is separate from learner persistence.

## Verification and limits

`npm run typecheck` pass; `npm test` **151/151, 18 files**; `npm run build` pass (**170 precache entries / 7,589.50 KiB**); production smoke **12/12**; focused Current Affairs **69 checks**, zero page errors/overflow, 375/1366 × Paper/Night, including filters, navigation, expanded alternate/static links, loading/failure/debug/stale/offline. Six mobile nav targets measure ≥44px. Real Workbox QA verifies successful-response caching, 503 preservation and offline reload with browser HTTP cache disabled. Screenshots were visually reviewed. `git diff --check` pass. No full Job 4 matrix, Atlas performance cohorts, offline-upgrade suite or pipeline re-audit was run.

Evidence (ignored): `tools/perf/out/current-affairs/{results,live-gateway,live-endpoint}.json` and four layout screenshots. Targeted tests are `src/current-affairs/current-affairs.test.ts`; browser script is `tools/perf/current-affairs-check.mjs`. Regenerate with `node tools/current-affairs/fetch-mains.mjs` (explicit network, ignored hash-pinned input), then `node tools/current-affairs/build-relevance.mjs` (local; supports `--package=` and `--taxonomies=`). Two derivations yielded identical asset hashes.

Limits: deterministic lexical classification intentionally misses relevant stories; alias/topic labels and thresholds need real-usage tuning. News is bounded to publisher feed metadata (max 200 items/feed, 600-character teaser), dates may be absent, no personalized ranking or comprehensive news coverage. XML support is purpose-limited, not a general XML engine. Publisher endpoints/availability and feed terms may change. A plain static file server cannot supply the gateway; use Vite dev/preview locally or the Vercel function hosting path. Hosted Vercel and physical-device validation were not performed. No release/deployment claim is made.
