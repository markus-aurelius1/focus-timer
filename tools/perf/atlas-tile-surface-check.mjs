/** Packed compositor surfaces must preserve the retained native tile pixels and bounded ownership. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const results = []
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const sheet of ['india', 'world']) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 3 : 1.25, colorScheme: theme })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await prepare(page, base, { route: '#/atlas?sheet=' + sheet })
    const inspect = async state => {
      await page.waitForFunction(() => !document.querySelector('.atlas-moving') && document.querySelector('.atlas-base')?.dataset.tilesReady === 'true')
      const planes = await page.locator('.atlas-base').evaluate(base => {
        const budget = Number(base.dataset.tileCacheBudget), rows = []
        for (const surface of base.querySelectorAll('canvas[data-tile-surface]')) {
          if (surface.parentElement.style.opacity !== '1') continue
          const ids = new Set(surface.dataset.tileSources.split(':'))
          const tiles = [...surface.parentElement.querySelectorAll('canvas:not([data-tile-surface])')].filter(tile => ids.has(tile.dataset.tileRaster))
          const context = surface.getContext('2d'), actual = context.getImageData(0, 0, surface.width, surface.height)
          let delta = 0, changed = 0, samples = 0
          const reference = document.createElement('canvas'); reference.width = reference.height = 512
          const copy = reference.getContext('2d', { willReadFrequently: true })
          for (const tile of tiles) {
            copy.clearRect(0, 0, 512, 512); copy.drawImage(tile, 0, 0)
            const pixels = copy.getImageData(0, 0, 512, 512).data
            const dx = parseFloat(tile.style.left) - parseFloat(surface.style.left), dy = parseFloat(tile.style.top) - parseFloat(surface.style.top)
            for (let y = 0; y < 512; y += 4) for (let x = 0; x < 512; x += 4) {
              const a = ((dy + y) * surface.width + dx + x) * 4, b = (y * 512 + x) * 4
              for (let c = 0; c < 4; c++) { const error = Math.abs(actual.data[a + c] - pixels[b + c]); delta += error; if (error > 32) changed++; samples++ }
            }
          }
          rows.push({ kind: surface.parentElement.dataset.tileKind, tiles: tiles.length, mae: delta / samples, highPercent: changed / samples * 100, pixels: surface.width * surface.height, budgetPixels: budget * 512 * 512 })
          reference.width = reference.height = 0
        }
        const output = base.atlasReadPixels?.()
        const unpacked = [...base.children].filter(layer => layer.dataset.tileKind && layer.style.opacity === '1' && !layer.querySelector('canvas[data-tile-surface]'))
        if (unpacked.length && (output || unpacked.some(layer => layer.style.visibility === 'hidden'))) throw new Error('unpacked native plane was hidden by stale GPU presentation')
        if (output) {
          const expected = document.createElement('canvas'); expected.width = output.width; expected.height = output.height
          const paint = expected.getContext('2d', { willReadFrequently: true }), view = base.atlasView, dpr = devicePixelRatio
          const planes = [...base.querySelectorAll('canvas[data-tile-surface]')].filter(surface => surface.parentElement.style.opacity === '1').sort((a,b) => Number(a.parentElement.style.zIndex) - Number(b.parentElement.style.zIndex))
          for (const surface of planes) {
            const scale = view.k / 2 ** Number(surface.parentElement.dataset.tileLevel)
            paint.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * view.x, dpr * view.y)
            paint.drawImage(surface, parseFloat(surface.style.left), parseFloat(surface.style.top))
          }
          const reference = paint.getImageData(0, 0, expected.width, expected.height).data
          let delta = 0, changed = 0, samples = 0
          for (let y = 0; y < output.height; y += 4) for (let x = 0; x < output.width; x += 4) {
            const a = ((output.bottomUp ? output.height - 1 - y : y) * output.width + x) * 4, b = (y * output.width + x) * 4
            for (let c = 0; c < 4; c++) { const error = Math.abs(output.pixels[a+c] - reference[b+c]); delta += error; if (error > 32) changed++; samples++ }
          }
          rows.push({ kind: 'gpu viewport', tiles: planes.length, mae: delta / samples, highPercent: changed / samples * 100, pixels: 0, budgetPixels: budget * 512 * 512 })
          expected.width = expected.height = 0
        }
        return rows
      })
      assert(planes.length > 0, 'no packed surface available for parity checks')
      for (const plane of planes) {
        assert(plane.tiles > 0)
        assert(plane.mae <= 2 && plane.highPercent <= 1, `presentation changed native tile pixels: ${JSON.stringify({ width, theme, sheet, state, plane })}`)
        assert(plane.pixels <= plane.budgetPixels, 'packed surface exceeded the retained pixel budget')
      }
      assert.deepEqual(errors, [])
      results.push({ width, theme, sheet, state, planes }); console.log('PASS', width, theme, sheet, state, planes)
    }
    await inspect('idle')
    const box = await page.locator('.atlas').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -180)
    await inspect('zoom')
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2 - 60, { steps: 15 }); await page.mouse.up()
    await inspect('pan')
    await context.close()
  }
} finally { await browser.close() }
mkdirSync('tools/perf/out/editorial', { recursive: true })
writeFileSync('tools/perf/out/editorial/tile-surface-parity.json', JSON.stringify(results, null, 2))
console.log(`${results.length} packed-surface states passed`)
