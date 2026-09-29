/**
 * Atlas interaction profile: phone viewport, 4× CPU throttle, scripted pans and
 * wheel zooms. Prints frame-time stats and main-thread work per gesture.
 *
 *   node profile.mjs [label] [baseUrl]     (default http://localhost:4173/, i.e. `npm run preview`)
 *   ROUTE='#/atlas?sheet=world' node profile.mjs world
 *
 * Always profile a production build (`npm run build && npm run preview`):
 * React's dev build adds large per-element overhead that hides real costs.
 */
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch, prepare } from './lib.mjs'

const label = process.argv[2] ?? 'run'
const base = process.argv[3] ?? 'http://localhost:4173/'
const out = fileURLToPath(new URL('./out/', import.meta.url))
mkdirSync(out, { recursive: true })

const { browser, ctx, page } = await launch()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await prepare(page, base, { route: process.env.ROUTE ?? '#/atlas' })
await page.screenshot({ path: `${out}${label}-atlas.png` })

const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))

async function measure(name, gesture) {
  await page.evaluate(() => {
    window.__frames = []
    window.__long = []
    window.__run = true
    const loop = (t) => {
      window.__frames.push(t)
      if (window.__run) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    try {
      window.__po?.disconnect()
      window.__po = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration)))
      window.__po.observe({ type: 'longtask', buffered: false })
    } catch {}
  })
  const m0 = await metrics()
  const t0 = Date.now()
  await gesture()
  const wall = Date.now() - t0
  const m1 = await metrics()
  const r = await page.evaluate(() => {
    window.__run = false
    return { frames: window.__frames, long: window.__long }
  })
  const d = r.frames.slice(1).map((t, i) => t - r.frames[i]).sort((a, b) => a - b)
  const pct = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0
  const res = {
    name,
    wallMs: wall,
    fps: +(d.length / (wall / 1000)).toFixed(1),
    p95: +pct(0.95).toFixed(1),
    max: +(d[d.length - 1] ?? 0).toFixed(1),
    over50: d.filter((x) => x > 50).length,
    longTasks: r.long.length,
    longTaskMs: Math.round(r.long.reduce((a, b) => a + b, 0)),
    scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
    taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
  }
  console.log(JSON.stringify(res))
  return res
}

const box = await page.locator('[role=application]').boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2 - 60
async function drag(dx, dy, ms = 900) {
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  const steps = Math.round(ms / 8)
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps)
    await page.waitForTimeout(8)
  }
  await page.mouse.up()
}

const results = []
results.push(await measure('idle-2s', () => page.waitForTimeout(2000)))
results.push(
  await measure('pan', async () => {
    await drag(-140, -60)
    await drag(160, 90)
    await drag(-60, 120)
    await page.waitForTimeout(400)
  }),
)
results.push(
  await measure('wheel-zoom-in', async () => {
    await page.mouse.move(cx, cy)
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, -40)
      await page.waitForTimeout(12)
    }
    await page.waitForTimeout(400)
  }),
)
results.push(
  await measure('pan-zoomed', async () => {
    await drag(-160, -40)
    await drag(140, 100)
    await page.waitForTimeout(400)
  }),
)
results.push(
  await measure('wheel-zoom-out', async () => {
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 40)
      await page.waitForTimeout(12)
    }
    await page.waitForTimeout(400)
  }),
)
results.push(
  await measure('wheel-notches', async () => {
    // A mouse wheel: whole 100 px notches, about ten a second, in and back out.
    await page.mouse.move(cx, cy)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -100)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(500)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(500)
  }),
)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
writeFileSync(`${out}${label}.json`, JSON.stringify(results, null, 2))
await browser.close()
