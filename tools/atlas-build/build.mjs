/**
 * Builds the offline Atlas into public/atlas/v1:
 *   {india,world}.json          vector layers + labels, pre-projected to sheet pixels
 *   {india,world}-relief.webp   physical plate (hypsometric tints + hillshade)
 *   {india,world}-shade.webp    hillshade for the political plate
 *   places.json                 the gazetteer + expeditions (see content/)
 *
 * Usage: node build.mjs [--no-relief] [--only=india|world]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSheet } from './lib/sheetBuild.mjs'
import { compilePlaces } from './lib/places.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'public/atlas/v1')
const PREVIEW = join(dirname(fileURLToPath(import.meta.url)), '.cache/preview')
mkdirSync(OUT, { recursive: true })
mkdirSync(PREVIEW, { recursive: true })

const args = new Set(process.argv.slice(2))
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1]
const skipRelief = args.has('--no-relief')

const sheets = {}
for (const id of ['india', 'world']) {
  if (only && only !== id) continue
  const built = await buildSheet(id, { skipRelief })
  sheets[id] = built
  const json = JSON.stringify(built.data)
  writeFileSync(join(OUT, `${id}.json`), json)
  console.log(`  ${id}.json ${(json.length / 1024).toFixed(0)} KB`)
  if (built.relief) {
    writeFileSync(join(OUT, `${id}-relief.webp`), built.relief.reliefWebp)
    writeFileSync(join(OUT, `${id}-shade.webp`), built.relief.shadeWebp)
    writeFileSync(join(PREVIEW, `${id}-relief.png`), built.relief.previewPng)
    console.log(`  relief ${(built.relief.reliefWebp.length / 1024).toFixed(0)} KB, shade ${(built.relief.shadeWebp.length / 1024).toFixed(0)} KB`)
  }
}

// ── gazetteer ─────────────────────────────────────────────────────────────
const sheetData = {}
for (const id of ['india', 'world']) sheetData[id] = sheets[id]?.data ?? JSON.parse(readFileSync(join(OUT, `${id}.json`), 'utf8'))
const { data: places, warnings } = compilePlaces(sheetData)
for (const w of warnings) console.warn('  ⚠ ' + w)
const placesJson = JSON.stringify(places)
writeFileSync(join(OUT, 'places.json'), placesJson)
const counts = places.places.reduce((a, p) => ((a[p.sheet] = (a[p.sheet] ?? 0) + 1), a), {})
console.log(`\n▸ places.json ${(placesJson.length / 1024).toFixed(0)} KB — india ${counts.india}, world ${counts.world}, ${places.expeditions.length} expeditions, ${warnings.length} warnings`)

writeFileSync(
  join(OUT, 'ATTRIBUTION.txt'),
  `Lodestar Atlas data (version 1)

Countries, rivers, lakes, glaciers, physical regions and seas:
  Natural Earth (naturalearthdata.com) – public domain. India is drawn from
  Natural Earth's India point-of-view boundaries (ne_10m_admin_0_countries_ind).

States and Union Territories of India:
  DataMeet, "maps" repository (github.com/datameet/maps) – CC BY 4.0.

Relief, hillshade and traced river courses:
  Derived from AWS Terrain Tiles (registry.opendata.aws/terrain-tiles), which
  combine SRTM, GMTED2010, ETOPO1 and other public elevation sources.

Places, facts and expeditions:
  Compiled for Lodestar from public reference sources.

The Atlas is a learning aid and not an authoritative map. External boundaries
of India follow the Government of India's depiction as closely as the source
data allows.
`,
)

export { sheets }
