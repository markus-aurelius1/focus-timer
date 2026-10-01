# Isolated Atlas renderer experiment

This directory is development tooling. The application imports none of it; root runtime dependencies remain unchanged. Install the pinned lockfile with `npm ci`, build existing Atlas vectors using `npm run prepare:data`, then `npm run serve` (localhost:4176). With the QA package installed, run `CHROMIUM_PATH=<Chromium> npm run check` from this directory. Windows can set the environment variable through PowerShell. Outputs in `data/` and `../perf/out/spike/` are ignored.

`prepare.mjs` inverts the repository's own sheet projection, writes a local PMTiles v3 archive with z0–4 vectors, and emits study points carrying all 2,273 permanent IDs. It adds no geographic content. The archive contains 276 tiles / 482,682 bytes. `server.mjs` supports HTTP Range requests. Rivers are lines, lakes water fills; local HTML study labels avoid remote glyph requests. India and World buttons, drag, wheel, keyboard, double-click and place fly-to exercise the candidate. Existing political geometry is an experiment input; production continues to use the full controlled India depiction.

The integration follows the primary [MapLibre PMTiles example](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles/) and [PMTiles MapLibre documentation](https://docs.protomaps.com/pmtiles/maplibre).

## Decision

**Retain the production SVG renderer.** The candidate demonstrates promising headless WebGL pan/zoom. It has not established a material product win: the archive repackages the existing detail, collision hierarchy is a prototype, required expedition/mastery/protected/strategic-disputed overlays are not equivalent, cold offline archive installation is absent, and no target-phone GPU was tested. HTML label selection is deliberately simplified. These missing acceptance properties are reasons to retain the working renderer; they do not prove MapLibre intrinsically cannot support them.

MapLibre 6.11.2 and PMTiles 4.5.0 distributed browser JavaScript totals 1,145,514 raw bytes / 312,591 gzip bytes, plus 83,310 CSS bytes, before app-specific study integration. Dependencies are isolated `devDependencies`; geojson-vt and vt-pbf only build the archive. No third-party live map provider, remote place data, planetary high-detail precache or production dependency is introduced.

Measurements and limitations are consolidated in `docs/TARS-VNEXT-JOB-2-3.md`. The benchmark uses a 390×844 headless Chromium viewport and 4× CPU throttle. It is not iOS/Android verification. The candidate workload is shorter than the repository profile workload, so compare the reported frame distributions with that qualification. A generation token in both profilers prevents old rAF loops leaking into later samples. The initial uncorrected profiler output is superseded.

A future adoption requires verified deeper content, bounded offline pack installation/removal/version compatibility, controlled India depiction, full study-layer/search/recall parity, gesture anchoring checks and physical-device GPU/accessibility tests. Production regional packs remain unpublished rather than presenting dummy download controls.
