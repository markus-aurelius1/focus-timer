# TARS vNext Job 6 — Current Affairs daily reading workspace

2026-10-01. Initial Job 6 was accepted and subsequently published with Jobs 1–6 at the user’s request. Later UI/feed changes described here remain local and uncommitted; no deployment.

## Current UI

One centered compact list at phone and desktop sizes. Headlines open the original newspaper in a safe new tab. Read/unread, save/unsave and remove controls sit in each row; returning from the publisher keeps the list position. Article-context popups, References/Notes tabs, Study mode and its shortcuts were removed at the user’s request. Existing notes and personal state are preserved. No generated summaries or article-body scraping/storage.

Today defaults to **To be Read** and contains only publication timestamps in the rolling past 24 hours (including yesterday's calendar date). Exactly three exclusive queues: **To be Read / Read / Saved**. Saving takes precedence over read status; marking a saved article done keeps it in Saved, while unsaving restores Read or To be Read. Counts and completion/minutes-left status are derived. Unread headlines are bold/full ink; read headlines have normal weight/muted ink. Filters reveals subject, exam, publisher and 15/30/60-minute unread plans; hidden active filters stay resettable.

The top-corner Archive action opens older retained articles, newest first, with no overlap with Today. Daily/Weekly/Monthly/Yearly period controls stay inside Filters. Undated and future-dated metadata belong to Archive; undated sorts last. A grouped topic belongs to Today while any known member is within 24 hours, but only recent headlines/alternate links are displayed there; all member keys remain available for state. Removed items hide across all queues/scopes, retain prior read/save state and support Undo. Lists reveal 50 topics at a time with Show more. Paper/Night and Tars typography/tokens remain.

## Publisher sources

`src/current-affairs/sources.ts` contains **39 verified RSS feeds from 9 publishers**, including the requested specialist publication Down To Earth. RBI, SEBI and PIB were removed, including the official-source ranking bonus. Active source IDs filter older offline responses and archived metadata, so removed circulars cannot remain visible. Newspaper reporting about RBI/policy still qualifies normally.

| Newspaper / RSS directory | Feeds | Sections |
| --- | ---: | --- |
| [Indian Express](https://indianexpress.com/rss-2/) | 7 | UPSC, Explained, Economy, India, World, Governance, Editorials |
| [The Hindu](https://www.thehindu.com/rssfeeds/) | 6 | National, World, Economy, Science, Environment, Editorials |
| [Mint](https://www.livemint.com/rss) | 4 | Economy, Politics, Science, Opinion |
| [Hindustan Times](https://www.hindustantimes.com/rss) | 6 | India, World, Explained, Science, Business, Editorials |
| [Business Standard](https://www.business-standard.com/rss-feeds/listing) | 3 | Economy, India, World |
| [BusinessLine](https://www.thehindubusinessline.com/rssfeeds/) | 5 | Economy, Agriculture, National, Science, Editorials |
| [The Tribune](https://www.tribuneindia.com/rss-feeds) | 4 | India, World, Business, Editorials |
| [Guardian](https://www.theguardian.com/help/feeds) | 3 | World, Environment, Science |
| [Down To Earth](https://www.downtoearth.org.in/stories.rss) | 1 | Environment, health and development |

Earlier 38-feed live verification on 2026-10-01 returned **2,600 unique links → 369 accepted items → 366 events; 43 today in IST**, with 346 primary thumbnails. Down To Earth’s canonical stories.rss was separately verified through the unchanged gateway: **10 metadata items / 10 thumbnails, 5 accepted** with current rules. Its /feed URL redirects and is not used by the redirect-denying gateway. Counts vary. Exact URLs are in the registry. Unusable probes (Financial Express, Deccan Herald, New Indian Express, Telegraph, ThePrint, Statesman, HT Environment) remain excluded. TOI/ET remain excluded because their RSS directories limit aggregation/redistribution ([TOI](https://timesofindia.indiatimes.com/rss.cms), [ET](https://economictimes.indiatimes.com/rss.cms)). Coverage remains incomplete.

## Broader deterministic relevance

Existing CSE/taxonomy signals remain authoritative; the corpus parser and generated index were not rebuilt. `coverage-aliases.ts` connects common newsroom terms such as GDP, UPI, JPC/FCRA, glaciers, El Niño, renewable energy and food safety to existing concepts. These are editorial concept connections, not exact PYQ mappings; inherited concept frequencies remain unchanged. Supported explainers no longer need a policy verb. The verified Indian Express UPSC feed can also admit publisher-curated reading after noise checks; unmatched items show General studies and have `exam: general`, with explicit debug provenance and no invented PYQ concept/count. General items are excluded from Prelims/Mains/Both filters.

Specialist vocabulary now includes leachate/solid waste, carbon neutrality, floods and public health. Crime, sports/celebrity, consumer products/stock moves, routine court notices, quizzes/MCQs and answer-practice exclusions remain. Debug exposes score/signals/rejections/member URLs inline; normal UI shows a Must Read star, never numerical precision.

Complete-link clustering requires the same IST publication day and a shared concept; ≥3 informative title tokens, shorter-title overlap ≥0.6 and Jaccard ≥0.35 identify differently worded coverage. Identical normalized titles also merge within the edition; undated items remain separate. Primary preference uses section depth (explainer/analysis, then opinion/UPSC), capped distinct excerpt vocabulary, then source priority/relevance/URL ties. This estimates information potential from metadata, not fetched article bodies. Alternate original links sit in a compact “more articles on this topic” disclosure. Progress tracks the topic through member URLs. Candidate comparisons are partitioned by day to avoid comparing old years against each other.

## Must Read and time

`MUST_READ_THRESHOLD = 7`, centralized/unit-tested. Points: classifier strength ≥12/≥7 (2/1); maximum matched CSE document frequency ≥20/≥5 (2/1); taxonomy specificity (1); institutional/convention connection (1); cross-publisher recurrence (1); explainer coverage (1); supported both-exam demand (1). No official-source bonus or LLM. Unmatched publisher-curated reading does not become Must Read merely from its source.

Metadata estimates: standard report 3 min, UPSC feed 4 min, Explained 6 min, analysis/opinion/editorial 7 min. Unread edition estimates sum to minutes left. Budget plans include highest-value unread articles that fit the approximate remaining budget, skipping oversized articles. No article fetch is used for estimates.

## RSS thumbnails

`feed.ts` extracts optional `thumbnailUrl` from item media:thumbnail/media:content (including groups), image enclosures, item images or feed description/Atom summary images. Channel logos, audio and full-content fields are ignored. HTTPS image URLs preserve signed query parameters; unsafe schemes/credentials/local-IP URLs are rejected. The browser loads thumbnails lazily with fixed dimensions, empty decorative alt text and no-referrer; missing/broken images collapse to text-only rows. Images are not scraped from article pages, proxied or rehosted. Offline metadata still works; publisher images may be unavailable offline.

## Personal state

Key `tars.current-affairs.state.v1`, version 1 with additive optional removal state:

```json
{"version":1,"entries":{"https://publisher.example/article":{"readAt":1790852400000,"savedAt":1790852400000,"ignoredAt":1790852400000,"note":"Existing personal note"}}}
```

Only canonical URL keys and optional millisecond readAt/savedAt/ignoredAt and legacy user-authored note (8,000 characters maximum) persist. Event actions apply to known member URLs and recognize old member state if primary/cluster identity changes. Inline writes preserve legacy article notes. Removal only sets ignoredAt; it does not delete retained metadata or reading history. No article metadata, bodies, images or stored counters enter personal state. Writes reread storage, cross-tab events refresh the UI, corrupt/future versions are preserved and write failures surface. No Dexie migration; state remains outside existing Dexie backups. localStorage is not an atomic cross-tab transaction.

## Reading analytics and short notes

The top Analytics action reveals derived totals across Today and Archive: articles read/saved, pending, saved for later, removed, reads in the last 7/30 calendar days, current streak, 14-day activity and read-by-subject. Known grouped coverage counts once. Previously tracked URLs without retained metadata still contribute to totals but not estimated minutes; their missing metadata is disclosed. Totals reflect current flags, so unread/unsave changes them. Marking dates use IST; estimates are explicitly not measured dwell time. Read saved/removed items remain in historical totals. New actions count immediately, independently of the feed's minute clock.

The top Notes action opens a small gold-accent sticky-note Sheet. New notes contain only user text (maximum **300 characters**), UUID, createdAt timestamp and the current **system-local createdDate** captured on save. Saved notes appear newest first and support removal/Undo without changing their creation date. No generated prose or transformation beyond trimming surrounding whitespace. Blank/oversized notes cannot be saved; failed writes preserve the draft and previous storage. HTML is displayed as literal text. Print notes opens browser printing for only the dated personal collection, with a white/black paginated layout (also suitable for browser Save as PDF).

Separate localStorage key **tars.current-affairs.notes.v1**:

```json
{"version":1,"entries":{"<uuid>":{"id":"<uuid>","text":"A short personal connection","createdAt":1790852400000,"createdDate":"2026-10-01"}}}
```

Optional deletedAt is a removal tombstone. Writes reread current storage and storage events update other tabs. Corrupt/future formats are preserved and errors surface. Notes are independent of legacy article notes and outside Dexie backups; browser origin storage can be cleared or evicted.

## Local archive

Separate native IndexedDB database `tars-current-affairs-archive-v1`, schema 1, store `articles` keyed by canonical URL. Records contain only accepted active-source RSS metadata (title ≤400, description ≤600, publisher/section ≤100, source/URL/date/optional thumbnail URL) plus firstSeenAt/lastSeenAt. No article bodies, classification, personal state or stored counters. No Dexie schema/dependency change. Existing Workbox metadata seeds the archive on the first visit after upgrade.

Refresh upserts without deleting omitted older URLs. Transactions prevent stale responses and failed writes from replacing retained metadata; quota/future-schema/busy errors surface. BroadcastChannel shares additions between tabs. Retained metadata is reclassified against the existing index; newer metadata wins. Read/save keeps the unchanged URL localStorage contract. Date views derive from IST publication dates; weeks start Monday, including across month/year boundaries. Daily/weekly/monthly/yearly views do not duplicate records.

Capture occurs on visits, refresh, reconnect and hourly while this screen is visible/resumed. It cannot collect days while Tars is closed or before first use, and does not backfill historical publisher archives. No automatic age expiry; browser quota/eviction or clearing this origin limits retention. Offline metadata excludes article bodies and image binaries. Archive, personal state and short notes remain outside existing Dexie backup/export.

## Validation

Typecheck and **206/206 root tests (22 files)** pass; build passes with 172 precache entries / 7,625.72 KiB. **279 focused browser checks** cover 375/1366 Paper/Night, three exclusive queues/default and persistence, rolling 24-hour separation/descending archives, removal/Undo, analytics and immediate activity totals, 300-character dated notes/reload/escaped text/notes-only print, direct publisher links, grouped coverage, RSS images, filters and typography. Actual Workbox checks cover success/503/offline reload plus archive-only rendering after the latest API response is removed. Production smoke **12/12** and diff whitespace pass; zero page errors/overflow. List, archive, analytics and notes screenshots reviewed; notes-print.pdf generated by Chromium, extracted and rendered to confirm only dated personal notes. Fixtures include a removed RBI circular. Evidence: ignored tools/perf/out/current-affairs-direct/.

Initial Job 6: 168 tests, 209 browser checks, smoke 12/12. First single-column cleanup: 237 browser checks, smoke 12/12. These are historical acceptance snapshots, superseded by the direct newspaper UI.

## Preserved boundaries and limits

Gateway limits, failure isolation and Workbox strategy remain unchanged; no gateway rewrite, pipeline regeneration, dependencies or Dexie changes. No Atlas profiling, Job 4 matrix, full offline-upgrade audit or new milestone. Metadata, lexical relevance, clustering and information-value preference remain incomplete heuristics. Large retained sets are loaded/reclassified locally with paged rows; long-term multi-year scale is unprofiled. No historical backfill/closed-app collection. Hosted/physical-device validation remains unperformed. The /review command is unavailable in this environment; focused source/diff regression review was performed instead.
