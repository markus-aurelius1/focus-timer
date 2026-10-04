/** J-25 rendered-size evidence at held pinch steps, plus real Manrope metric validation. */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prepare } from './lib.mjs'
import { inspectLabelSurface } from './label-surface.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = fileURLToPath(new URL('./out/codex-j25/', import.meta.url))
mkdirSync(out, { recursive: true })
const results = []
for (const config of [
  { id: 'desktop', width: 1440, height: 900, dpr: 1.25, rate: 1 },
  { id: 'laptop-hidpi', width: 1440, height: 900, dpr: 2, rate: 1 },
  { id: 'phone', width: 390, height: 844, dpr: 3, rate: 4 },
])
  for (const theme of ['light', 'dark']) {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
    try {
      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        deviceScaleFactor: config.dpr,
        hasTouch: true,
        isMobile: config.id === 'phone',
        colorScheme: theme,
      })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await prepare(page, base, { route: '#/atlas' })
      await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.filter(e => !e.label.path).length > 10)
      await page.waitForFunction(() => !document.querySelector('.atlas-moving'))
      await page.evaluate(() => document.fonts.ready)
      const initial = await page.evaluate(inspectLabelSurface)
      const metrics = { loaded: initial.loaded, maxError: Math.max(...initial.entries.filter(e => !e.path).map(e => e.fontError)), rows: initial.entries }
      if (!initial.entries.every(e => e.sourcePainted && (!e.tested || e.matched / e.tested >= 0.9))) throw new Error('Label sprite/viewport ink mismatch')
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.rate })
      const box = await page.locator('.atlas').boundingBox(),
        cx = box.x + box.width / 2,
        cy = box.y + box.height / 2
      const touch = (type, d) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints:
            d === null
              ? []
              : [
                  { id: 0, x: cx - d, y: cy },
                  { id: 1, x: cx + d, y: cy },
                ],
        })
      await page.evaluate(() => {
        const e = document.querySelector('.atlas-names')
        e.atlasPositionTimes.length = 0
      })
      const samples = []
      await touch('touchStart', 55)
      for (let i = 0; i < 5; i++) {
        const d = 55 + i * 16
        await touch('touchMove', d)
        await page.waitForTimeout(100)
        const painted = await page.evaluate(inspectLabelSurface)
        if (!painted.entries.every(e => e.sourcePainted && (!e.tested || e.matched / e.tested >= 0.9))) throw new Error('Held label sprite/viewport ink mismatch')
        samples.push(painted.entries)
        await page.screenshot({ path: out + '/' + config.id + '-' + theme + '-pinch-' + i + '.png' })
      }
      const position = await page.locator('.atlas-names').evaluate((e) => Math.max(0, ...e.atlasPositionTimes))
      await touch('touchEnd', null)
      await page.waitForFunction(() => !document.querySelector('.atlas-moving'))
      const byName = new Map()
      for (const sample of samples)
        for (const n of sample) {
          const key = n.key + '|' + n.text
          const prior = byName.get(key) || []
          prior.push(n)
          byName.set(key, prior)
        }
      const retained = [...byName]
        .filter(([, a]) => a.length > 1)
        .map(([key, a]) => ({
          key,
          samples: a.length,
          widthRatio: Math.max(...a.map((n) => n.width)) / Math.min(...a.map((n) => n.width)),
          heightRatio: Math.max(...a.map((n) => n.height)) / Math.min(...a.map((n) => n.height)),
        }))
      const pass =
        metrics.loaded &&
        metrics.maxError <= 1 &&
        retained.length > 10 &&
        retained.every((r) => r.widthRatio <= 1.1 && r.heightRatio <= 1.1) &&
        position <= (config.rate === 4 ? 6 : 2) &&
        errors.length === 0
      const row = { config, theme, pass, metrics, positionMaxMs: position, retained, samples, errors }
      results.push(row)
      console.log(config.id, theme, {
        pass,
        fontError: metrics.maxError,
        positionMaxMs: position,
        maxWidthRatio: Math.max(...retained.map((r) => r.widthRatio)),
        maxHeightRatio: Math.max(...retained.map((r) => r.heightRatio)),
        retained: retained.length,
        errors,
      })
    } finally {
      await browser.close()
    }
  }
writeFileSync(out + '/pinch.json', JSON.stringify(results, null, 2))
process.exitCode = results.every((r) => r.pass) ? 0 : 1
