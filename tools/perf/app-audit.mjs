/**
 * App-feel audit outside the Atlas: the costs a person notices but a layout
 * check cannot see. Complements gesture-audit.mjs (the map) and ui-audit.mjs
 * (overflow and scrollbars).
 *
 *   - main-thread work per second on the Focus screen: idle, running, immersive,
 *     and on Home while a session runs elsewhere (a session should cost almost
 *     nothing between second ticks)
 *   - route-change time for every screen, first and second visit, and whether a
 *     loading skeleton was shown on the way
 *   - cold start: first paint, the Home heading, and when the gazetteer is requested
 *   - touch targets under 44 px at phone width, per route
 *
 *   node app-audit.mjs [baseUrl] [desktop|phone] [--budget=budgets/app.json]
 *
 * `--budget` fails the run when a budgeted measurement is exceeded (budget.mjs).
 *
 * Run against a production build (`npm run build && npm run preview`). Results
 * go to out/app-audit/<config>.json. Set CHROMIUM_PATH to use a specific Chrome.
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { budgetArg, checkBudget, positional, reportBudget } from './budget.mjs'
import { prepare } from './lib.mjs'

const [base = 'http://localhost:4173/', only] = positional()
const budget = budgetArg()
const verdicts = []
const outDir = fileURLToPath(new URL('./out/app-audit/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const CONFIGS = [
  { id: 'desktop', width: 1440, height: 900, dpr: 1.25, throttle: 1 },
  { id: 'phone', width: 390, height: 844, dpr: 3, throttle: 4 },
].filter((c) => !only || c.id === only)

const ROUTES = ['home', 'tasks', 'calendar', 'insights', 'current-affairs', 'notes', 'settings', 'atlas']

for (const config of CONFIGS) {
  const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const context = (browser) => browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: config.dpr })
  const result = { config }

  // ── a running session ────────────────────────────────────────────────────
  {
    const browser = await launch()
    const ctx = await context(browser)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('pageerror', e.message))
    // lib.prepare() visits Settings; reload afterwards so every lazy screen is unvisited for the route timings.
    await prepare(page, base, { route: '#/focus' })
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle })
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
    const sample = async (label, ms = 5000) => {
      await page.evaluate(() => {
        window.__raf = 0
        const orig = (window.__origRaf ??= window.requestAnimationFrame.bind(window))
        window.requestAnimationFrame = (cb) => orig((t) => { window.__raf++; cb(t) })
      })
      const m0 = await metrics()
      await page.waitForTimeout(ms)
      const m1 = await metrics()
      const raf = await page.evaluate(() => window.__raf)
      const perSecond = (k) => +(((m1[k] - m0[k]) * 1000) / (ms / 1000)).toFixed(1)
      const r = { label, rafCallbacksPerSec: +(raf / (ms / 1000)).toFixed(1), taskMsPerSec: perSecond('TaskDuration'), scriptMsPerSec: perSecond('ScriptDuration'), styleMsPerSec: perSecond('RecalcStyleDuration'), layoutMsPerSec: perSecond('LayoutDuration') }
      console.log(`[${config.id}] ${JSON.stringify(r)}`)
      return r
    }
    // Screens, dialogs and the gazetteer are fetched in idle time after start-up. These samples are steady-state
    // costs, so wait until that has finished: no new request for three seconds.
    const quiet = async (limit = 90000) => {
      const count = () => page.evaluate(() => performance.getEntriesByType('resource').length)
      const until = Date.now() + limit
      let last = await count()
      let since = Date.now()
      while (Date.now() < until && Date.now() - since < 3000) {
        await page.waitForTimeout(500)
        const now = await count()
        if (now !== last) {
          last = now
          since = Date.now()
        }
      }
    }
    await quiet()
    result.session = []
    result.session.push(await sample('focus idle'))
    // These are steady-state costs: let the start transition, and then the immersive view's fade and its controls hiding (3.5 s), finish first.
    await page.getByRole('button', { name: /^Start focus/i }).first().click()
    await page.waitForTimeout(3000)
    result.session.push(await sample('focus running'))
    await page.keyboard.press('f')
    await page.waitForTimeout(5500)
    result.session.push(await sample('immersive running'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
    await page.goto(base + '#/home')
    await page.waitForTimeout(1200)
    result.session.push(await sample('home, session running'))
    await browser.close()
  }

  // ── route changes, from a fresh load so lazy screens are genuinely first visits ──
  {
    const browser = await launch()
    const ctx = await context(browser)
    const page = await ctx.newPage()
    await prepare(page, base, { route: '#/home' })
    await page.goto(base + '#/focus')
    await page.reload()
    await page.waitForTimeout(2500)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle })
    result.routes = {}
    for (const [route, visit] of [...ROUTES.map((r) => [r, 'first']), ['tasks', 'second'], ['insights', 'second'], ['atlas', 'second']]) {
      const r = await page.evaluate(async (route) => {
        let skeleton = false
        const mo = new MutationObserver(() => { if (document.querySelector('main [aria-busy="true"]')) skeleton = true })
        mo.observe(document.querySelector('main'), { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] })
        const t0 = performance.now()
        location.hash = '#/' + route
        const ready = () => (route === 'atlas' ? !!document.querySelector('.atlas .atlas-name') : !!document.querySelector('main h1') && !document.querySelector('main [aria-busy="true"]'))
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        while (!ready() && performance.now() - t0 < 15000) await new Promise((r) => requestAnimationFrame(r))
        await new Promise((r) => requestAnimationFrame(r))
        mo.disconnect()
        return { ms: Math.round(performance.now() - t0), skeleton }
      }, route)
      result.routes[`${route} (${visit})`] = r
      await page.waitForTimeout(500)
    }
    console.log(`[${config.id}] routes ${JSON.stringify(result.routes)}`)
    await browser.close()
  }

  // ── cold start: nothing cached, no service worker yet ────────────────────
  {
    const browser = await launch()
    const ctx = await context(browser)
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle })
    const t0 = Date.now()
    await page.goto(base + '#/home', { waitUntil: 'commit' })
    // First run shows onboarding over Home; the heading underneath still marks the shell being ready.
    await page.waitForSelector('main h1', { timeout: 30000 })
    const homeHeadingMs = Date.now() - t0
    await page.waitForTimeout(4000)
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]))
      const res = performance.getEntriesByType('resource').map((r) => ({ name: r.name.split('/').slice(-2).join('/'), start: Math.round(r.startTime), kb: Math.round((r.transferSize || r.encodedBodySize) / 1024) }))
      const places = res.find((r) => r.name.includes('places.json'))
      return { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), ...paints, gazetteerRequestedAtMs: places?.start ?? null, requests: res.length, transferredKB: res.reduce((a, r) => a + r.kb, 0), jsKB: res.filter((r) => r.name.endsWith('.js')).reduce((a, r) => a + r.kb, 0) }
    })
    result.coldStart = { homeHeadingMs, ...perf }
    console.log(`[${config.id}] cold start ${JSON.stringify(result.coldStart)}`)
    await browser.close()
  }

  // ── touch targets at phone width ─────────────────────────────────────────
  if (config.id === 'phone') {
    const browser = await launch()
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await prepare(page, base, { route: '#/home' })
    result.touchTargets = {}
    for (const route of ['home', 'focus', ...ROUTES.slice(1)]) {
      await page.goto(base + '#/' + route)
      await page.waitForTimeout(1500)
      result.touchTargets[route] = await page.evaluate(() => {
        const els = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[tabindex="0"]')].filter((e) => {
          const b = e.getBoundingClientRect()
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'
        })
        const small = els.filter((e) => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height) < 44 })
        return { interactive: els.length, under44: small.length, examples: small.slice(0, 6).map((e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)} ${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24)}` }) }
      })
    }
    console.log(`[${config.id}] touch targets ${JSON.stringify(Object.fromEntries(Object.entries(result.touchTargets).map(([k, v]) => [k, v.under44])))}`)
    await browser.close()
  }

  writeFileSync(`${outDir}${config.id}.json`, JSON.stringify(result, null, 2))

  // Budget names: the session labels, `route <name> (<visit>)`, `routes`, `cold start`, `touch targets`.
  const routes = Object.entries(result.routes)
  verdicts.push(
    checkBudget(budget, config.id, {
      ...Object.fromEntries(result.session.map((s) => [s.label, s])),
      ...Object.fromEntries(routes.map(([name, r]) => [`route ${name}`, { ms: r.ms, skeleton: r.skeleton ? 1 : 0 }])),
      routes: { skeletonsShown: routes.filter(([, r]) => r.skeleton).length },
      'cold start': result.coldStart,
      'touch targets': result.touchTargets ? { under44: Object.values(result.touchTargets).reduce((a, r) => a + r.under44, 0) } : {},
    }),
  )
}

process.exit(reportBudget(verdicts))
