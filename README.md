# Tars — Atlas + News

A local-first study app for UPSC / UPPCS, delivered as an installable PWA and Capacitor Android/iOS app.

- **Atlas:** offline India and World maps, 2,273 places, search and filters, place facts, 149 curated canonical PYQs, saved question attempts, spaced recall, mastery and existing recall challenges. Every place is accessible without Focus time.
- **News / Current Affairs:** source-linked publisher feeds, To be Read / Read / Saved queues, archive, reading analytics and short dated notes. Read articles on their original publisher websites.

Focus, Planning and timer-based expeditions have been removed. The [scoped overhaul roadmap](docs/TARS-ATLAS-NEWS-ROADMAP.md) is paused again as of 2026-10-04; the current work is the Atlas runtime regression fix only. Shared settings, themes, motion, haptics, command palette and backup tools remain. This reduction introduces no new gamification or News redesign.

## Run and verify

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

The default route is `#/atlas`; News is `#/current-affairs`, and shared preferences/backup are at `#/settings`. Unknown and retired links return to Atlas. Ctrl/⌘ K opens search and commands; G A / G W / G S open Atlas / News / Settings; ? shows shortcuts; Shift F opens the map full screen.

Browser regressions use `tools/perf` with its own dependencies. Set `CHROMIUM_PATH` to an installed Chromium/Chrome, or install the Playwright Chromium runtime. Against a production preview:

```bash
npm ci --prefix tools/perf
node tools/perf/smoke.mjs http://localhost:4173/
node tools/perf/atlas-check.mjs http://localhost:4173/
node tools/perf/vnext-learning.mjs http://localhost:4173/
node tools/perf/current-affairs-check.mjs
node tools/perf/job4-offline.mjs http://localhost:4173/
```

The News check serves its own fixture-backed production server and verifies the real Workbox offline cache. Results and screenshots are local under `tools/perf/out/`.

## Architecture and data safety

React + TypeScript + Vite + Tailwind + Dexie + Zustand + Motion + Capacitor. Atlas uses bundled projected sheets and TopoJSON; no online map provider is needed. News uses its existing publisher gateway and provenance/relevance pipeline.

`src/app` is the shell and router; `src/atlas` and `src/features/atlas` hold Atlas; `src/current-affairs` and `src/features/current-affairs` hold News; `src/game` holds recall progression; `src/data`, `src/services` and `src/ui` are shared infrastructure. The News notes hook remains in `src/features/notes`.

The IndexedDB database remains **lodestar, schema v2**, with unchanged v1/v2 migrations and old backup support. Historical Focus/Planning tables and settings remain inert and exportable. Startup does not erase old sessions, tasks, expedition runs or local timer/audio state, and never resumes them. JSON backups v1–v3, merge/replace, tombstones and sync preserve compatibility. News notes/reading state/archive and canonical quiz attempts keep their existing persistence. Export a backup before switching browsers or origins.

Generated geography under `public/atlas/v1/`, canonical PYQs under `public/pyq-atlas/v1/`, and content hashes under `public/atlas-assets/v1/` are unchanged. Legacy expedition metadata remains in the generated geography package for source compatibility, with no runtime consumer. Do not hand-edit generated content or change place ids. The authoritative pipeline is `tools/atlas-build/`; see its documentation and `AGENTS.md` before regenerating.

## Packaging

Host `dist/` as a static PWA; `BASE=/subpath/ npm run build` supports subpaths. News additionally needs the existing `/api/current-affairs` gateway. `vercel.json` preserves its current deployment configuration. No deployment is part of this change.

Android requires Android Studio (`npm run cap:android`); iOS requires macOS/Xcode (`npm run cap:ios`). Launcher shortcuts expose Atlas and News. The legacy manifest id `lodestar-study`, native app id `app.lodestar.study` and both `tars://` / `lodestar://` schemes remain unchanged for installed-app and data compatibility.

Brand artwork originates in `assets/icon.svg`; `scripts/generate-icons.mjs` regenerates platform icons and the Atlas + News social preview. Use `PLAYWRIGHT_FROM=tools/perf` to reuse the QA browser package.

Geography sources and licences are in `public/atlas/v1/ATTRIBUTION.txt`: Natural Earth, DataMeet, OpenStreetMap, terrain sources, Wikipedia/Wikidata and official designation sources. Place facts, PYQ links and ids preserve their original provenance.

Current scope, retained legacy schema, dependency audit and acceptance evidence: [product reduction](docs/TARS-ATLAS-NEWS-REDUCTION.md). Read [CODEX_HANDOFF.md](CODEX_HANDOFF.md), [AGENTS.md](AGENTS.md) and the [active roadmap](docs/TARS-ATLAS-NEWS-ROADMAP.md) before further work. Older full-product sequencing and retired feature specifications are historical.
