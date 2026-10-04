/** Focused MapLibre promotion gate: bounded study source, official India boundary, search selection and provider fallback. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const preview = base.replace(/\/$/, '') + '/?atlasRenderer=maplibre'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const checks = []
const check = (name, value, extra = '') => {
  assert(value, `${name}${extra ? `: ${extra}` : ''}`)
  checks.push(name)
  console.log(`PASS ${name}${extra ? ` (${extra})` : ''}`)
}

try {
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await prepare(page, preview, { route: '#/atlas' })
    const renderer = page.locator('[data-renderer="maplibre"]')
    await renderer.waitFor({ timeout: 15000 })
    await page.waitForFunction(() => Number(document.querySelector('[data-renderer="maplibre"]')?.dataset.studyCount ?? 0) > 0)

    const diagnostics = await renderer.evaluate(el => ({ count: Number(el.dataset.studyCount), zoom: Number(el.dataset.studyZoom), canvas: !!el.querySelector('.maplibregl-canvas') }))
    check('MapLibre canvas initializes', diagnostics.canvas)
    check('India overview study source is bounded', diagnostics.count > 0 && diagnostics.count <= 160, `${diagnostics.count} features at semantic z${diagnostics.zoom}`)

    const boundary = await page.evaluate(async () => {
      const [meta, geojson] = await Promise.all([
        fetch('/atlas-assets/v1/india-boundary-source.json').then(r => r.json()),
        fetch('/atlas-assets/v1/india-controlled-border.geojson').then(r => r.json()),
      ])
      return {
        authority: meta.authority,
        northWestClaim: meta.geometry?.northWestClaim,
        bytes: JSON.stringify(geojson).length,
        features: geojson.features?.length ?? 0,
        allOfficial: geojson.features?.every(f => f.properties?.authority === 'survey-of-india') ?? false,
      }
    })
    check('India boundary provenance is Survey of India', boundary.authority === 'Survey of India' && boundary.allOfficial)
    check('India boundary preserves north-west claimed sector', boundary.northWestClaim === true)
    check('India boundary stays inside PWA asset budget', boundary.bytes < 2_750_000, `${boundary.bytes} bytes`)

    await page.getByRole('button', { name: 'Search places' }).click()
    await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Nathu La')
    await page.waitForTimeout(350)
    await page.getByRole('button', { name: /Nathu La/ }).first().click()
    await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor({ timeout: 10000 })
    check('MapLibre search selection opens existing place inspector', await page.getByRole('heading', { name: 'Nathu La', exact: true }).isVisible())
    check('MapLibre remains active after selection', await renderer.isVisible())

    await page.getByRole('tab', { name: 'World', exact: true }).click()
    const worldRenderer = page.locator('[data-renderer="maplibre"][data-sheet="world"]')
    await worldRenderer.waitFor({ timeout: 10000 })
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-renderer="maplibre"][data-sheet="world"]')
      return el && Number(el.dataset.studyCount ?? 0) > 0
    })
    const worldCount = Number(await worldRenderer.getAttribute('data-study-count'))
    const worldZoom = await worldRenderer.getAttribute('data-study-zoom')
    check('World overview study source is bounded', worldCount > 0 && worldCount <= 160, `${worldCount} features at semantic z${worldZoom}`)
    check('MapLibre preview has no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await ctx.route('https://tiles.openfreemap.org/**', route => route.abort())
    const page = await ctx.newPage()
    await prepare(page, preview, { route: '#/atlas' })
    await page.locator('.atlas-base').waitFor({ timeout: 12000 })
    check('OpenFreeMap failure falls back to bundled Atlas', await page.locator('.atlas-base').isVisible())
    check('failed MapLibre surface is removed', await page.locator('[data-renderer="maplibre"]').count() === 0)
    await ctx.close()
  }

  console.log(`PASS ${checks.length} MapLibre promotion checks`)
} finally {
  await browser.close()
}
