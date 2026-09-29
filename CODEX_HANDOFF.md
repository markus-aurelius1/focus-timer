# CODEX_HANDOFF.md — Tars (study planner · focus timer · UPSC/UPPCS Atlas)

Last updated: 2026-09-27. HEAD `fec9da0` on local branch `claude/atlas-gazetteer-rebuild`, **plus a large uncommitted working tree** (milestones M9 + M10, see §5).

**Maintenance rule (for every agent; the full protocol and the "done" checklist are in `AGENTS.md`):** update this file as part of any change: features, fixes, refactors, dependencies, config or design decisions. Edit the relevant section; do not rewrite the whole file. If the change touches a feature that produces user-facing content, update that feature's entry in §4 so it states the **current standard**, not only that the feature exists. Add one line to §6. `docs/HANDOFF.md` is the older, longer milestone log (measurements, user requirements per milestone); keep the two consistent. Verify every claim here against the code before relying on it.

---

## 1. Project summary

Tars (called **Lodestar** until 2026-09-26) is a local-first study app for UPSC / UPPCS aspirants: plan → focus → track → review → improve. It combines a timestamp-based Pomodoro/countdown/stopwatch timer, a task planner with calendar and habits, and analytics. Its progression system is **The Atlas**: an offline atlas of India and the World (2,273 places) that focus minutes explore and spaced-recall questions master, with previous-year-question (PYQ) history and a study-priority score on each place. It runs as an installable PWA with no account. All data lives in IndexedDB on the device. Capacitor projects wrap it for Android and iOS.

## 2. Tech stack

Versions are the ranges in `package.json`; the lockfile pins the exact ones.

| Area | What |
| --- | --- |
| Runtime | Node 22 in CI (`.github/workflows/ci.yml`); works locally on Node 24.19.0 / npm 11.17.0 |
| Language | TypeScript `^7.0.2` (`tsc -b`, project refs `tsconfig.app.json` + `tsconfig.node.json`), ES2022 target |
| UI | React `^19.3.0`, Tailwind CSS `^4.3.3` (`@tailwindcss/vite`), Motion `^13.4.2`, lucide-react `^1.48.0` |
| Fonts | `@fontsource-variable/manrope` + `@fontsource-variable/fraunces` `^5.3.0`, self-hosted via `@font-face` in `src/index.css` |
| State / data | Zustand `^5.0.15` (timer, UI, audio stores), Dexie `^4.4.6` + dexie-react-hooks `^4.4.0` (IndexedDB) |
| Build | Vite `^8.3.0` (rolldown; `rolldownOptions.advancedChunks` vendor split), `@vitejs/plugin-react` `^6.1.1`, vite-plugin-pwa `^1.3.0` + workbox-window `^7.4.1` |
| Maps | Bundled TopoJSON and relief sheets with `topojson-client` `^3.1.0`; `AtlasMap.tsx` renders the map and recall. Charts and audio are hand-built. |
| Native | Capacitor `^8.5.2` (android, ios, core, cli), app `^8.1.1`, local-notifications `^8.3.1`, haptics, filesystem, share, status-bar, `@capacitor-community/keep-awake` `^8.0.1` |
| Tests | Vitest `^5.0.1` (`src/**/*.test.ts`, node env) + `fake-indexeddb` `^6.2.5`. The data pipeline uses `node --test`. |
| Data pipeline (`tools/atlas-build`, own package) | d3-geo `^3.1.1`, d3-geo-projection `^4.0.0`, mapshaper `^0.7.66`, sharp `^0.35.4`, topojson-server/simplify `^3`, shapefile, pngjs, polylabel |
| Perf / QA (`tools/perf`, own package) | playwright-core `^1.56.0` driving headless Chromium |
| Hosting | Vercel (`vercel.json`), static `dist/` with hash routing |

## 3. Architecture overview

```
src/
  main.tsx, index.css     entry; design tokens, fonts, motion tokens, map CSS
  app/                    App.tsx (shell sync, screen transitions, SW update/offline toasts, deep links),
                          Shell.tsx (collapsible sidebar / tab bar), router.ts (hash routes: focus, tasks,
                          atlas, calendar, insights, settings), theme.ts, ui-store.ts, CommandPalette.tsx,
                          ShortcutsSheet.tsx, shortcuts.ts
  data/                   types.ts (model), db.ts (Dexie, DB name 'lodestar', schema v2), repo.ts
                          (create/update/remove → tombstones/restore), seed.ts (defaults, normalizeSettings),
                          hooks.ts (live queries), backup.ts, csvio.ts, sync.ts (changesSince/applyChanges),
                          demo.ts (sample history)
  timer/                  engine.ts (pure, timestamp-based state + reconcile), store.ts (Zustand, effects,
                          alert scheduling, notification text), useNow.ts
  planner/                recurrence.ts, quickAdd.ts (natural-language grammar), tasks.ts, habits.ts
  stats/aggregate.ts      every Insights number, derived from sessions
  game/                   progression.ts (XP, levels, ranks, map styles), challenges.ts
  atlas/                  data.ts (gazetteer index), sheet.ts (TopoJSON + overlay decode), explore.ts
                          (expeditions, checkpoints, free survey), mastery.ts (recall levels, Leitner review),
                          questions.ts (recall question generators), living.ts (routes, ships, wildlife),
                          spatial.ts (grid index), types.ts (Place, PyqHistory, StudyPriority)
  audio/                  context.ts, chimes.ts, sounds.ts (procedural soundscapes), store.ts, follow.ts
                          (sound follows the timer via store subscription), youtube.ts
  services/               notifications.ts, reminders.ts (derived), haptics, wakelock, lifecycle, fullscreen,
                          files, install
  ui/                     Sheet.tsx (dialogs), controls.tsx, Popover, Menu, feedback/toast, motion.ts,
                          scrollLock.ts, Ring, Logo
  features/<screen>/      focus, tasks, atlas (AtlasMap.tsx renders the bundled map and recall), calendar, insights,
                          settings, audio, onboarding, shared
tools/atlas-build/        offline data pipeline → public/atlas/v1 (see §8)
  content/*.mjs           hand-authored gazetteer (P(...)), expeditions.mjs, states.mjs
  content/candidates/     what to add for v2 (C/G(...)) + official lists (lists/*.json)
  content/generated/      v2 places generated from Wikipedia/Wikidata (JSON, do not hand-edit)
  content/sources/        links.json (v1 place → Wikipedia/Wikidata), link-overrides.mjs, v1-lock.json
  content/pyq/            PYQ ledger (Q(...)), not-mapped.mjs
  gazetteer/              lists.mjs, link-existing.mjs, generate.mjs, facts.mjs, match.mjs, audit-coords.mjs
  lib/                    places.mjs (compilePlaces), pyq.mjs (attach + score), overlay.mjs, wiki.mjs, sheetBuild…
  reports/                pyq-review.json, generate-review.json, links-review.json, coords-audit.json
tools/perf/               headless-Chromium profile, smoke, screenshots, UI audit, feature checks
scripts/generate-icons.mjs  assets/icon.svg → every PNG + public/og-image.png
android/, ios/            Capacitor projects (app id app.lodestar.study)
docs/HANDOFF.md, docs/screenshots/
pyq-sources/              the user's PYQ PDFs — git- and Vercel-ignored (copyrighted), local only
```

**Data flows**
- **User data:** UI → `data/repo.ts` (sets `id`, `createdAt`, `updatedAt`; deletes write tombstones) → Dexie → `useLiveQuery` hooks → derived views. XP, levels, mastery, exploration, streaks, challenge progress and reminders are **computed from history on read**. None of them is a stored counter.
- **Timer:** `timer/engine.ts` stores timestamps (segment start + banked ms), persisted to `localStorage` on every transition. `reconcile(state, now)` replays phases that ended while the app slept (on tick, visibilitychange, focus, pageshow, online, Capacitor resume, reload, another tab). Effects → `saveSession` (session id = phase id, so replays can't double-count) → `tars:session` window event → atlas/XP recompute. Native alerts are scheduled with the OS (`LocalNotifications`); on the web, a one-shot timeout plus a service-worker notification.
- **Audio:** `audio/follow.ts` subscribes to the timer store: pause pauses, stop stops, breaks fade. `MusicDock` does the same for the YouTube IFrame player.
- **Atlas static data:** `tools/atlas-build` → `public/atlas/v1/{india,world}.json` (pre-projected TopoJSON), `*-relief.webp`, `*-shade.webp`, `*-overlay.json`, `places.json`. The app fetches these at runtime (`atlas/sheet.ts`, `atlas/data.ts`), and workbox precaches them for offline use. User progress refers to places only by stable id (`in.pass.nathu-la`).
- **Atlas:** `features/atlas/AtlasMap.tsx` renders the bundled India and World sheets, exploration overlays, expedition route, places and recall interactions. Camera and gestures are local to the renderer; the map covers its viewport and keeps zoom anchors stable at scale limits. The Gazetteer selects destinations on either sheet. Layers control map styles and study overlays; no live tile provider or API token is involved.

## 4. Output Quality Specs

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

### 4.4 Not-mapped reasons

Where: `content/pyq/not-mapped.mjs`, as `{ Name: reason }`. A reason is one plain sentence **without** a final period that names the rule applied. Shared constants cover the usual cases, e.g. `NO_COORDS = 'No reliable coordinates found on Wikipedia or Wikidata; left out rather than guessed'`, `TOWN = 'Town asked in only one question of the collected papers; the atlas adds towns asked in two or more questions or in UPSC Prelims'`. When a name gets mapped, delete its line.

### 4.5 Study priority (score, band, reasons) and the "Past papers" panel

Where: `scorePlaces` in `tools/atlas-build/lib/pyq.mjs` (build time), `src/features/atlas/PastPapers.tsx`, the Gazetteer "Study priority" order, and `dueForReview(..., priority)` in `src/atlas/mastery.ts`.

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

### 4.7 Expeditions

Where: `tools/atlas-build/content/expeditions.mjs`. There are 7: Himalayan, Indian River Journey, Peninsular India, Northeast India, Coastal India, Indian Islands, World Physical Geography.

- **Title:** 2–4 words. **Subtitle:** one line, no period ("From the Karakoram to the Mishmi hills", "7,500 km from Kutch to the Sundarbans").
- **Chapters:** geographic title ("Ladakh and the Karakoram"). Stops `s(placeId, minutes)`: ids have no sheet prefix, and minutes run 20–60 by distance and difficulty. Order follows a real route (source → sea for rivers).
- **Reward:** `{ title, body, icon }`. The title is a keepsake noun phrase ("Silk Route journal", "River pilot’s log"). The body is one present-tense sentence saying what appears on the map ("The Silk Route over Nathu La appears on your map, and a snow leopard watches from Hemis.").
- **Rules:** a checkpoint at each chapter end needs 60% of its places Familiar; stop ids must resolve on the expedition's sheet (the build warns otherwise).
- **Map representation:** the bundled sheet draws the current chapter’s reached stops and next stop from expedition progress. The route is the existing study overlay, and selecting a place opens its established detail panel. Do not generate additional route geometry or expose undiscovered facts before focus unlocks them.
- **Presentation:** the relief image and all vector/label overlays share one sheet coordinate system. At rest and at minimum zoom the sheet covers the central viewport; panning never reveals the paper around it. India and World remain separate bundled projections. Zoom clamps before applying a cursor, tap or pinch anchor, so reaching the zoom limit cannot shift the view. Search, full-screen, map styles, layers and recall remain available offline.

### 4.8 Challenges

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
- **JSON backup** (`tars-backup-<stamp>.json`): `{ app: 'tars', version: 2, exportedAt, settings, tables, tombstones }`. Import merges (newest wins) or replaces, and accepts `app: 'lodestar'` and v1 backups.

### 4.13 Brand assets

- `assets/icon.svg` is the only source. The Tars mark is four slabs (four focus blocks to a cycle) standing together as a T, in golds (`#f2c46d`, `#efbc5c`, `#e6a940`, highlight `#ffe6ae`) on a dark navy tile (`#070913`–`#1e2540`). The PNG canvas background is `#0a0c14`, the same as the Night theme and the manifest colours.
- `node scripts/generate-icons.mjs` renders every PWA, Android and iOS PNG plus `public/og-image.png` (maskable and adaptive versions are padded to the safe zone). Never hand-edit the PNGs; regenerate them.

## 5. Current state (2026-09-28)

**Verified for the current Atlas:** `npm run typecheck`, `npm test` (89/89 in 11 files) and `npm run build` passed. `tools/perf/atlas-check.mjs` passed on desktop and phone, including full-viewport coverage and a repeated zoom-past-limit check. `tools/perf/smoke.mjs` passed timer, Atlas touch, place selection, service worker and offline reload. `tools/perf/ui-audit.mjs` found no layout problems at 375/768/1366/1920 px, light and dark, including full-screen. Screenshots in `tools/perf/out/screens/` confirm the bundled map fills the central panel. The older pipeline tests (`cd tools/atlas-build && npm test`) passed 15/15 before this presentation-only change; `features-check.mjs` was not rerun because no other feature changed here.

**Works:** timer (sleep/reload-safe), planner, calendar, habits, Insights, Atlas (2,273 places, 1,044 with PYQ history, overlays, layers, search/fly-to, recall and mastery), sounds that follow the timer, command palette, shortcuts, backup/CSV, PWA offline, Capacitor shells.

**Uncommitted, unpushed:** milestones **M9 (Atlas v2 gazetteer)** and **M10 (Lodestar → Tars rebrand + premium UI pass)**, plus the full-frame Atlas and camera fix. The shared worktree contains many pre-existing modifications; preserve them. Branch `claude/atlas-gazetteer-rebuild` exists only locally. `origin/main` has only the initial commit. The app lives on `claude/serene-heisenberg-5ibr5v` → PR markus-aurelius1/study-timer#1 (not merged) and `claude/jolly-clarke-qk4fys`.

**Known broken:** nothing fails in tests. Functional gaps are listed in §9 and §10.

## 6. Recent changes (newest first)

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
  - Tailwind v4 with CSS-variable tokens (`bg-surface`, `bg-surface-2`, `text-ink-2`, `text-accent`, `border-line`). Themes are Paper (light, `:root`) and Night (`.dark`).
  - Manrope for UI and all numbers; Fraunces (`font-display`) for headings only.
  - Motion tokens: micro 140 ms / base 220 ms / layout 320 ms (`src/index.css` + `src/ui/motion.ts`); respect `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
  - Dialogs use `ui/Sheet.tsx` with actions in `footer` / `<SheetFooter>`.
  - No glass or `backdrop-filter`; no `AnimatePresence mode="wait"` around screens (transitions are enter-only).
- **Atlas renderer:** `AtlasMap.tsx` is the map and recall renderer, with these rules:
  - No React state or SVG attribute writes per frame; gestures move a pre-painted layer with CSS transforms and repaint on settle.
  - Point names are HTML, not SVG `<text>`.
  - Never put a custom property on the label layer, opacity on HTML names, or `animation-fill-mode: both` on symbols (each caused 10×–800 ms regressions).
- **Git:**
  - Branches are `claude/<name>`. Add commits on top; no rebase or force-push of shared branches.
  - Commit subjects: `<Area>: <what changed>`, sentence case, no trailing period (e.g. "Atlas data: PYQ ledger, alias matching and study-priority score").
  - Commit or push only when the user asks.
- **Docs:** `AGENTS.md` holds the working rules every agent loads at session start (keep its do-not list in sync with §9 here); `README.md` is the user-facing feature list; `docs/HANDOFF.md` is the milestone log with measurements; this file is the cross-agent handoff and quality bar. Approved example outputs, once the user approves some, go in `examples/<feature-name>/` and are cited from §4.

## 8. Environment setup

The repo path contains a space (`…/Focus Timer`); quote paths. Windows shells may warn about LF→CRLF; the warning is harmless.

```bash
npm ci                         # root app (Node 22 as in CI; Node 24 also works)
npm run dev                    # http://localhost:5173  (.claude/launch.json "dev")
npm run typecheck              # tsc -b
npm test                       # vitest: src/**/*.test.ts
npm run build                  # tsc -b && vite build → dist/ (+ service worker)
npm run preview                # http://localhost:4173  (.claude/launch.json "preview")
BASE=/subpath/ npm run build   # sub-path hosting

# Atlas data pipeline (own package)
cd tools/atlas-build && npm install
npm test                       # node --test test/*.test.mjs (15 tests; CI runs these too)
node build.mjs --places-only   # recompile content/*.mjs + PYQ ledger → places.json (+ overlays); offline
node build.mjs                 # full build incl. sheets and relief (downloads sources once; cached in .cache/)
node gazetteer/lists.mjs       # refresh official lists            ┐ need network (Wikipedia, Wikidata,
node gazetteer/link-existing.mjs  # link v1 places to Wikipedia  │ Overpass, Nominatim); cached in
node gazetteer/generate.mjs    # candidates → content/generated   ┘ .cache/wiki, rate-limited

# QA tools (own package; run against a production build, never the dev server)
cd tools/perf && npm install && npx playwright-core install chromium   # or set CHROMIUM_PATH
node smoke.mjs http://localhost:4173/        # touch smoke test, exits non-zero on failure
node atlas-check.mjs                          # Atlas interactions, desktop + phone
node ui-audit.mjs [url] [filter]              # unwanted scrollbars at 375/768/1366/1920, light+dark → out/audit/
node features-check.mjs                       # against npm run dev: audio-follows-timer, quick add, undo, palette…
node profile.mjs <label> [url]                # frame times at 4× CPU throttle; ROUTE='#/atlas?sheet=world' for World
node screens.mjs | node pyqcheck.mjs | node trace.mjs wheel|pan|pinch

# Icons (after any change to assets/icon.svg)
npm i -D playwright-core && node scripts/generate-icons.mjs   # or PLAYWRIGHT_FROM=tools/perf

# Native
npm run cap:android            # needs Android Studio
npm run cap:ios                # needs macOS + Xcode
```

- **Env vars:** none are required. Optional: `BASE`, `SITE_URL` (canonical/OG URL; on Vercel `VERCEL_PROJECT_PRODUCTION_URL` fills `%SITE_URL%`), `CHROMIUM_PATH`, `PLAYWRIGHT_FROM`, `ROUTE`.
- **Atlas:** no map token or environment variable. Both sheets and their relief assets are bundled. On this Windows machine, QA can use `CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`.
- `.env.local` only holds a Vercel CLI token; it is git-ignored and builds don't need it.
- **Deploy:** Vercel runs `npm ci && npm run build` and serves `dist`. `.vercelignore` excludes `pyq-sources`, `tools`, `android`, `ios`, `docs`.

## 9. Known issues / gotchas

1. **Two milestones are uncommitted, on a branch that exists only locally** (§5). Commit in logical chunks before any large change, and ask the user first.
2. **Precache limit:** `public/atlas/v1/places.json` is 2,548,302 bytes, against workbox `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` in `vite.config.ts`. Above 3 MiB it silently drops out of the precache and the Atlas stops working offline. Raise the limit or split the file if the gazetteer grows.
3. `--places-only` can't add river courses. 21 Indian rivers have no course in Natural Earth or OSM and are drawn as symbols; tracing them needs a full `node build.mjs` with `line: trace(...)`.
4. `ATLAS_V2_AT = Date.UTC(2026, 8, 26)` (`src/atlas/explore.ts`) sets the survey order: finds before it follow the v1 order, so existing histories uncover the same places. Don't change it. Don't drop `added: 2` from v2 places.
5. `content/pyq/not-mapped.mjs`: 159 of its 259 names never match an unmatched reference any more (e.g. "Mandakini" is now `in.river.mandakini`). This is harmless, because it only applies to unmatched refs, but it is misleading when read.
6. The fact-quality imperfections in §4.2: 33 places with a duplicated Ramsar fact; straight apostrophes in the designation templates; Wikipedia vs GoI framing (an undecided policy).
7. A task reminder body shows the raw ISO date and the stored time ("Due 2026-09-30 at 17:30") and ignores the 12/24 h setting, unlike event reminders (`services/reminders.ts:42`).
8. **World discovery gap:** only 45 World places lie on an expedition and free survey is India-only, so most World places can never be discovered. This is an open design question for the user.
9. Only headless Chromium has been tested. HTML map-name halos rely on `paint-order`, and iOS Safari has no Fullscreen API, so the Atlas falls back to filling the window. Real iOS Safari and Android WebView checks are pending.
10. Profiling the dev server is meaningless (React dev overhead); use `npm run build && npm run preview`.
11. Three Ramsar sites (Sakhya Sagar, Ankasamudra, Gogabeel) and Glaw Lake have no position in any open source, so they are left out rather than guessed.
12. Web notifications can't be scheduled for a frozen page: on mobile web the alert arrives when the user returns. Native builds schedule exact OS alarms, and Android 12+ may ask for the exact-alarm permission.
13. The Atlas uses bundled sheets and gazetteer search. Its physical relief is a static image under interactive vector and place layers; it does not provide street-level tiles, satellite imagery or global street-address geocoding.

## 10. Next steps (priority order)

1. **Commit and push M9 + M10** in logical commits on `claude/atlas-gazetteer-rebuild` (ask the user first), then rerun `smoke.mjs`, `atlas-check.mjs`, `ui-audit.mjs` and `features-check.mjs` against a fresh production build.
2. **User decision:** the World discovery gap (more World expeditions, or letting the survey reach the World sheet after the v2 release date).
3. **Manual, by the user:** rename the Vercel project (e.g. `tars-study`). Canonical/OG URLs follow `VERCEL_PROJECT_PRODUCTION_URL` automatically.
4. Real-device check of the Atlas and immersive/fullscreen on iOS Safari and Android WebView.
5. Transcribe the four web PYQ sources listed in `content/pyq/index.mjs`. The PMF IAS protected-area pages fix the under-representation of national parks. Follow §4.3 exactly and keep `pyq-review.json` at 0/0/0.
6. Full `node build.mjs` with traced courses for the 21 Indian rivers drawn only as symbols.
7. Data hygiene in the generator (then rerun `generate.mjs` and `--places-only`): skip a list designation fact when the lead already states it; curly apostrophes in the designation templates; prune the stale `not-mapped.mjs` entries.
8. Format task-reminder bodies with `relativeDayLabel` / `formatTimeOfDay` like the other reminders.
9. Not started (optional): Android/iOS home-screen widgets (launcher shortcuts and deep links exist); drag-and-drop ordering for subjects.
