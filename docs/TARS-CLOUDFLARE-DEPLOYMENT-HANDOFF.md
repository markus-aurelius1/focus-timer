**2026-10-05 authorized deployment follow-up:** initial checkpoint `0758615696eed2c53558920f4f17a8ce51181456` is pushed only to the handoff branch. The owner explicitly authorized one adapter-fix commit after live Workers rejected `redirect: error`. Pages translates it to `manual`; the existing gateway rejects 3xx without following redirects, preserving the original security and ingestion contract. Gateway/application source and budgets are unchanged. Contract/typecheck/local Workers checks pass. Live redeployment results are recorded in the task response and ignored release logs.

# Current Cloudflare release configuration — 2026-10-05

- Production origin: `https://tars-atlas-news.pages.dev`.
- Project: `tars-atlas-news`; production branch: `handoff/claude-overhaul`; no main merge.
- One checkpoint includes the accepted source, licensed font assets, retained checks/docs and deployment wiring. Obtain its SHA with `git rev-parse HEAD`; the historical HEAD below is the parent checkpoint.
- Cloudflare project settings: build `npm ci && npm run build`, output `dist`, root repository directory. `SITE_URL=https://tars-atlas-news.pages.dev` is configured for production and preview builds; optional `BASE` remains external and unchanged.
- For a clean local deployment build: set `SITE_URL` then run `node tools/cloudflare/build.mjs`. This runs `npm ci` and `npm run build`. Deploy from the repository root with `npx wrangler pages deploy dist --project-name tars-atlas-news --branch handoff/claude-overhaul`.
- Same-origin `/api/current-affairs` is implemented by `functions/api/current-affairs.ts`, directly reusing `collectFeeds`. It preserves the original JSON, publisher registry, bounded requests, partial failure, 200/503/cache and 405/Allow contracts. No ingestion rewrite or arbitrary URL proxy.
- `public/_routes.json` invokes Functions only for the API; hash navigation stays client-side and Pages retains SPA fallback. `public/_headers` mirrors the existing static cache/security rules; MIME types are served by Pages. PWA assets and stable IDs remain unchanged.
- Wrangler credentials are external to source; `.wrangler/`, `.env*`, raw profiling and release logs are excluded from Git. No runtime secrets, app OAuth or Access policy are added.
- Adapter contract test, Wrangler compilation, typecheck, lint and all 229 unit tests pass. Production clean build and deployment are performed from this checkpoint; live results are recorded in the deployment response and ignored release logs rather than changing the checkpoint after publication.
- Known limitation: the owner-accepted current-host synthetic gesture exception remains 29/33 with four failures. No timing rerun or budget change.

---

## Historical pre-deployment handoff

# TARS private Cloudflare deployment handoff — 2026-10-04

## Release decision

Application accepted for private Cloudflare deployment with a documented synthetic gesture-benchmark exception on the current host. Existing gesture budgets remain unchanged for future validation on a stable/physical device.

Performance work is stopped. Application source is frozen; J-25 and further renderer/compositor experiments are prohibited. No deployment, authentication configuration, commit or push occurred in this task.

## Checkout and build

- Repository/work directory: `C:\Users\hario\Downloads\T.A.R.S\focus-timer`.
- Branch: `handoff/claude-overhaul`.
- HEAD: `43560abe415292e7c548f4180bab0c463265a6fd`.
- Accepted source includes the uncommitted working tree and untracked application assets; HEAD/remote branch alone does not contain the accepted release.
- Working tree after this handoff: 46 modified tracked paths and 18 untracked entries. All 550 non-document entry hashes remain unchanged; no experimental application edits require removal.
- Build command: `npm run build`. Dependency installation in a fresh deployment workspace: `npm ci`. Output directory: `dist/`.
- All eight requested minimal sanity checks pass: typecheck, lint (0 errors/175 existing warnings), unit (229), build (157 precache entries), smoke (100), News (251), Atlas (21) and online/offline product health. The build emits the manifest, service worker, fonts, Atlas, canonical PYQ and News relevance assets. Exact commands/results: [production-readiness report](TARS-PRODUCTION-READINESS.md).

## Backend route and environment names

Required dynamic route: **GET `/api/current-affairs`**, same origin as the app. Preserve the existing version-1 JSON contract (`fetchedAt`, `items`, `sources`), registry-only publisher requests, sanitisation, time/size bounds, partial-source reporting and canonical links. Preserve 200 for available results, 503/no-store for total publisher failure and 405/Allow for unsupported methods. No article scraping or arbitrary URL proxy.

`api/current-affairs.ts` is a Node IncomingMessage/ServerResponse wrapper around `src/current-affairs/gateway.ts`. Vite dev/preview supplies this route locally; **static `dist/` does not include a deployed API**. The separate deployment task must provide a Cloudflare Function/Worker adapter or a same-origin proxy to a compatible backend. This is deployment wiring; no adapter or frontend change was added now. Pages Functions execute on the Workers runtime with configurable Node API compatibility. [Cloudflare Functions documentation](https://developers.cloudflare.com/pages/functions/).

Environment variable names only:

- Required application/backend runtime variables: none.
- Build/deployment metadata: `SITE_URL`.
- Optional build path: `BASE`.
- Existing optional Vercel metadata fallback: `VERCEL_PROJECT_PRODUCTION_URL`.

Select the Cloudflare origin for build metadata in the deployment task; the existing fallback metadata points to the prior Vercel origin. No application Google OAuth variables or client secrets are required. Deployment credentials and Access/Google allowlist configuration belong to the separate task.

## Routes, PWA and Cloudflare compatibility

- Retain hash routes `#/atlas`, `#/current-affairs`, `#/settings` and existing place/deep-link compatibility. URL fragments are resolved in the client. Serve `index.html` for app navigation where needed; serve API, JavaScript, JSON, images and fonts as their actual resources, never as HTML fallback.
- Static Vite output is suitable for Cloudflare static hosting. The project's build/output match Cloudflare's documented `npm run build`/`dist` convention. `vercel.json` is existing platform configuration; translate its required headers into Cloudflare deployment configuration rather than expecting it to run there. [Cloudflare Vite guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/).
- If using Workers Static Assets SPA mode, route `/api/*` to the Worker before static fallback. [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).
- Keep `sw.js`, `manifest.webmanifest`, `index.html` and same-path Atlas data revalidatable; hashed `/assets/*` can retain immutable caching. Preserve actual MIME types and the existing nosniff/referrer headers.
- Keep stable identifiers: IndexedDB `lodestar`, manifest `lodestar-study`, native `app.lodestar.study`, deep links `lodestar://`. Do not clear IndexedDB/News local state during release.
- Preserve prompt-based PWA updates, `index.html` navigation fallback, precached Atlas/PYQs and successful-response News offline caching. The deployment task must test Access session-expiry/login redirects with the service worker so authentication HTML is not treated as feed JSON. Existing offline data remains local after caching; Access does not erase it.
- The deployment task must verify real publisher fetches, the backend adapter and private Access protection for app/assets/API. Local fixture success does not validate live Cloudflare execution or authentication. No new frontend dependency or application OAuth was introduced.

## Exact known limitation

The last complete unmodified synthetic audit passes **29/33**, not 33/33. Remaining phone failures: zoom-in has **2 frames >100ms** (limit 0); zoom-out p95 is **116.6ms** (limit 34ms) with **5 frames >100ms** (limit 0); back-pan maximum is **50.1ms** (limit 50ms). All performance budgets remain unchanged. No gesture audit was rerun for this release freeze.

Independent `about:blank` controls reproduced >400ms pauses with no TARS/Atlas code. The owner accepts a synthetic benchmark exception for this private release; the exact external pause cause remains unresolved and this decision does not establish physical-device performance. Profiling reports and raw evidence remain preserved in [J-24 report](TARS-J24-GESTURE-REPAIR.md) and ignored `tools/perf/out/j24-repair/` artifacts. Do not resume performance investigation or J-25 from this handoff.
