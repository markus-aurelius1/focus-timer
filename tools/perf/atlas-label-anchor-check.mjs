/** Compact and retained HTML words must place every anchor at the live camera coordinates. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
import { inspectLabelSurface } from './label-surface.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
let checks = 0
for (const mode of ['native', 'fallback']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 3 : 1.25, hasTouch: true, isMobile: width === 390, colorScheme: theme })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    if (mode === 'fallback') await page.addInitScript(() => {
      HTMLCanvasElement.prototype.transferControlToOffscreen = undefined
      const get = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return kind === 'webgl' ? null : get.call(this, kind, ...args) }
    })
    await prepare(page, base, { route: '#/atlas' })
    await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 10 && !document.querySelector('.atlas-moving'))
    const box = await page.locator('.atlas').boundingBox(), x = box.x+box.width/2, y = box.y+box.height/2
    const cdp = await context.newCDPSession(page)
    const touch = (type, distance) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: distance === null ? [] : [{ x: x-distance, y, id: 1 }, { x: x+distance, y, id: 2 }] })
    const inspect = async state => {
      const result = await page.evaluate(inspectLabelSurface)
      const visible = result.entries.filter(e => e.tested)
      assert(visible.length > 10, `${mode}/${theme}/${width}/${state}: missing in-view labels`)
      assert(visible.every(e => e.anchorError <= 1 && e.matched / e.tested >= 0.9), `${mode}/${theme}/${width}/${state}: painted anchor drift`)
      assert(mode === 'native' ? ['webgl', 'worker-webgl'].includes(result.mode) : result.mode === 'software')
      checks++; console.log('PASS', mode, theme, width, state, { count: visible.length, maxError: Math.max(...visible.map(e => e.anchorError)) })
    }
    await inspect('idle')
    await touch('touchStart', 40)
    for (const distance of [60, 90, 120]) { await touch('touchMove', distance); await inspect(`held-${distance}`) }
    await touch('touchEnd', null)
    await page.waitForFunction(() => !document.querySelector('.atlas-moving'))
    await inspect('settled')
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
}
console.log(`${checks} label anchor checks passed`)
