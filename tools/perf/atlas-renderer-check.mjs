/** Renderer correctness gates; scaled hidden-release timer exercises cleanup without a minute-long wall-clock wait. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = fileURLToPath(new URL('./out/codex-j24/', import.meta.url))
mkdirSync(out, { recursive: true })
const results = []
for (const mode of ['worker', 'low-power', 'fallback', 'delayed-worker', 'worker-error']) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript((mode) => {
      if (mode === 'low-power') Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })
      if (mode === 'fallback') Object.defineProperty(window, 'OffscreenCanvas', { value: undefined })
      if (mode === 'delayed-worker' || mode === 'worker-error') {
        const NativeWorker = window.Worker
        window.Worker = class extends NativeWorker {
          set onmessage(callback) {
            let tiles = 0
            super.onmessage = (event) => {
              if (mode === 'worker-error' && event.data.type === 'tile' && ++tiles === 2) {
                this.onerror?.(new ErrorEvent('error', { message: 'QA worker failure with a pending bitmap' }))
                setTimeout(() => callback(event), 50)
              } else if (mode === 'delayed-worker' && event.data.type === 'tile') setTimeout(() => callback(event), 200)
              else callback(event)
            }
          }
        }
      }
      Object.defineProperty(document, 'hidden', { get: () => !!window.qaHidden })
      const timeout = window.setTimeout.bind(window)
      window.setTimeout = (fn, delay, ...args) => timeout(fn, delay === 60_000 ? 100 : delay, ...args)
    }, mode)
    await prepare(page, base, { route: '#/atlas' })
    await page.waitForFunction(() => document.querySelector('.atlas-base')?.dataset.tilesReady === 'true', null, { timeout: 60000 })
    const cache = () =>
      page.locator('.atlas-base').evaluate((e) => ({
        size: Number(e.dataset.tileCacheSize),
        budget: Number(e.dataset.tileCacheBudget),
        ready: e.dataset.tilesReady,
        error: e.dataset.tileError,
        canvases: e.querySelectorAll('canvas').length,
        layers: e.children.length,
        visibleInks: [...e.querySelectorAll('canvas')].filter((c) => c.parentElement.style.opacity === '1').map((c) => ({ kind: c.parentElement.dataset.tileKind, ink: c.atlasInkK })),
      }))
    const initial = await cache()
    assert.equal(initial.budget, mode === 'low-power' ? 24 : 48)
    assert(initial.size <= initial.budget)
    const checkInk = (snapshot) => {
      const overview = snapshot.visibleInks.filter((r) => r.kind === 'overview'),
        detail = snapshot.visibleInks.filter((r) => r.kind === 'detail')
      assert(overview.length > 0 && detail.length > 0)
      assert(
        snapshot.visibleInks.every((r) => Math.abs(r.ink - detail[0].ink) < 0.0001),
        'fallback stroke scale differs from the detailed view',
      )
    }
    checkInk(initial)
    await page.evaluate(() => {
      window.coverage = []
      window.coverageTimer = setInterval(() => {
        const base = document.querySelector('.atlas-base'),
          box = base.getBoundingClientRect()
        const rects = [...base.querySelectorAll('canvas')]
          .filter((n) => getComputedStyle(n).visibility === 'visible' && parseFloat(getComputedStyle(n.parentElement).opacity) > 0)
          .map((n) => {
            const r = n.getBoundingClientRect(),
              p = n.parentElement.getBoundingClientRect()
            return { left: Math.max(r.left, p.left), right: Math.min(r.right, p.right), top: Math.max(r.top, p.top), bottom: Math.min(r.bottom, p.bottom) }
          })
        let misses = 0
        for (let y = 1; y < 8; y++)
          for (let x = 1; x < 8; x++) {
            const px = box.left + (box.width * x) / 8,
              py = box.top + (box.height * y) / 8
            if (!rects.some((r) => px >= r.left && px < r.right && py >= r.top && py < r.bottom)) misses++
          }
        window.coverage.push({ misses, size: Number(base.dataset.tileCacheSize), budget: Number(base.dataset.tileCacheBudget), ready: base.dataset.tilesReady })
      }, 100)
    })
    const box = await page.locator('.atlas').boundingBox(),
      x = box.x + box.width / 2,
      y = box.y + box.height / 2,
      cdp = await context.newCDPSession(page)
    for (const deltaY of [-60, 60]) {
      for (let i = 0; i < 10; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY })
        await page.waitForTimeout(40)
      }
      await page.waitForFunction(() => !document.querySelector('.atlas-moving'))
      await page.waitForFunction(() => document.querySelector('.atlas-base')?.dataset.tilesReady === 'true', null, { timeout: 60000 })
      checkInk(await cache())
    }
    const coverage = await page.evaluate(() => {
      clearInterval(window.coverageTimer)
      return window.coverage
    })
    assert(coverage.length > 5)
    assert(coverage.every((r) => r.misses === 0 && r.size <= r.budget))
    await page.evaluate(() => {
      window.qaHidden = true
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForFunction(() => document.querySelector('.atlas-base')?.querySelectorAll('canvas').length === 0)
    const released = await cache()
    assert.equal(released.size, 0)
    await page.evaluate(() => {
      window.qaHidden = false
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForFunction(() => document.querySelector('.atlas-base')?.dataset.tilesReady === 'true', null, { timeout: 60000 })
    const restored = await cache()
    assert(restored.canvases > 0 && restored.size <= restored.budget)
    checkInk(restored)
    assert.deepEqual(errors, [])
    const row = {
      mode,
      initial,
      released,
      restored,
      coverage,
      errors,
      limitations: [
        'Coverage uses a 49-point geometry grid of nontransparent-level canvas bounds, not a per-pixel proof.',
        'The 60-second release timeout is mapped to100ms; the production delay is unchanged.',
        'No performance result is derived from this instrumented run.',
      ],
    }
    results.push(row)
    console.log('PASS', mode, { initial, released, restored, samples: coverage.length })
  } finally {
    await browser.close()
  }
}
writeFileSync(out + '/renderer-check.json', JSON.stringify(results, null, 2))
