/**
 * Workspaces are as you left them (J-08).
 *
 *   - leaving and returning restores the scroll position, the Plan view, the
 *     calendar view, the Insights range
 *   - pressing the tab of the screen you are on goes back to its front page
 *   - the Atlas is kept alive: the second visit is immediate, with the same
 *     sheet, camera and selection; while hidden it runs no animation frames and
 *     holds no listeners on the window
 *
 *   node route-state-check.mjs [baseUrl]     (default http://localhost:4173/ – the preview build)
 * Exits non-zero when a check fails.
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

for (const shape of [
  { id: 'desktop', viewport: { width: 1366, height: 768 } },
  { id: 'phone', viewport: { width: 390, height: 844 }, touch: true },
]) {
  const ctx = await browser.newContext({ viewport: shape.viewport, hasTouch: !!shape.touch, isMobile: !!shape.touch, deviceScaleFactor: shape.touch ? 2 : 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Count window-level listeners and animation frames, to see what a hidden Atlas still holds.
  await page.addInitScript(() => {
    const counts = (window.__listeners = { pointer: 0, key: 0, wheel: 0 })
    const kind = (t) => (/^pointer|^mouse|^touch/.test(t) ? 'pointer' : /^key/.test(t) ? 'key' : t === 'wheel' ? 'wheel' : null)
    for (const target of [window, document]) {
      const add = target.addEventListener.bind(target)
      const remove = target.removeEventListener.bind(target)
      const seen = new Map()
      target.addEventListener = (type, fn, opts) => {
        const k = kind(type)
        if (k && fn) {
          const key = type + (typeof opts === 'object' ? !!opts?.capture : !!opts)
          const set = seen.get(key) ?? seen.set(key, new Set()).get(key)
          if (!set.has(fn)) {
            set.add(fn)
            counts[k]++
          }
        }
        return add(type, fn, opts)
      }
      target.removeEventListener = (type, fn, opts) => {
        const k = kind(type)
        const key = type + (typeof opts === 'object' ? !!opts?.capture : !!opts)
        if (k && seen.get(key)?.delete(fn)) counts[k]--
        return remove(type, fn, opts)
      }
    }
    window.__raf = 0
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => {
      window.__raf++
      return raf(cb)
    }
  })
  await prepare(page, base, { sample: true, route: '#/home' })
  const tag = `[${shape.id}] `
  const wait = (ms) => page.waitForTimeout(ms)
  // The rail on wide screens (its workspaces list), the tab bar on phones.
  const nav = page.getByRole('navigation', { name: shape.touch ? 'Main' : 'Workspaces' })
  const press = async (name) => {
    await nav.getByRole('button', { name, exact: true }).first().click()
    await wait(700)
  }
  const scrollTop = () => page.evaluate(() => Math.max(document.querySelector('.stage-scroll')?.scrollTop ?? 0, window.scrollY))
  const scrollTo = (y) =>
    page.evaluate((y) => {
      document.querySelector('.stage-scroll')?.scrollTo(0, y)
      window.scrollTo(0, y)
    }, y)
  const hash = () => page.evaluate(() => location.hash)

  // ── scroll position ──
  await page.evaluate(() => (location.hash = '#/settings'))
  await wait(900)
  await scrollTo(520)
  await wait(300)
  const before = await scrollTop()
  await page.evaluate(() => (location.hash = '#/insights'))
  await wait(900)
  check(tag + 'a screen not visited before starts at the top', (await scrollTop()) === 0, `${await scrollTop()} px`)
  await scrollTo(260)
  await wait(300)
  await page.evaluate(() => (location.hash = '#/settings'))
  await wait(900)
  check(tag + 'returning restores the scroll position', before > 300 && Math.abs((await scrollTop()) - before) <= 2, `${before} px → ${await scrollTop()} px`)
  await page.evaluate(() => (location.hash = '#/insights'))
  await wait(900)
  check(tag + 'each workspace keeps its own position', Math.abs((await scrollTop()) - 260) <= 2, `${await scrollTop()} px`)

  // ── Insights range ──
  await scrollTo(0)
  await page.getByRole('tab', { name: 'Month', exact: true }).click()
  await wait(300)
  await page.evaluate(() => (location.hash = '#/home'))
  await wait(700)
  await page.evaluate(() => (location.hash = '#/insights'))
  await wait(900)
  check(tag + 'Insights keeps its range', (await page.getByRole('tab', { name: 'Month', exact: true }).getAttribute('aria-selected')) === 'true')

  // ── Calendar view ──
  await page.evaluate(() => (location.hash = '#/calendar'))
  await wait(900)
  await page.getByRole('tab', { name: 'Month', exact: true }).click()
  await wait(300)
  await page.evaluate(() => (location.hash = '#/home'))
  await wait(700)
  await page.evaluate(() => (location.hash = '#/calendar'))
  await wait(900)
  check(tag + 'the calendar keeps its view', (await page.getByRole('tab', { name: 'Month', exact: true }).getAttribute('aria-selected')) === 'true')

  // ── Plan view, and pressing the tab you are on ──
  await page.evaluate(() => (location.hash = '#/tasks?view=upcoming'))
  await wait(900)
  await press('Home')
  await press('Plan')
  check(tag + 'Plan returns to the view it was left on', (await hash()) === '#/tasks?view=upcoming', await hash())
  await scrollTo(200)
  await wait(200)
  await press('Plan')
  check(tag + 'pressing Plan again goes to its front page, at the top', (await hash()) === '#/tasks' && (await scrollTop()) === 0, `${await hash()} · ${await scrollTop()} px`)
  await press('Home')
  await press('Plan')
  check(tag + '…and that is where it now returns', (await hash()) === '#/tasks', await hash())

  // ── Atlas kept alive ──
  if (!shape.touch) {
    await press('Atlas')
    await page.waitForSelector('.atlas .atlas-name', { timeout: 30000, state: 'attached' })
    await page.screenshot({ path: 'tools/perf/out/route-state-atlas.png' })
    await wait(2500)
    // Move the camera and select a place.
    const box = await page.locator('.atlas').boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -240)
      await wait(200)
    }
    await wait(1500)
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 140, cy - 60, { steps: 8 })
    await page.mouse.up()
    await wait(1500)
    // Select a place symbol clear of the toolbar and the inspector's side.
    const at = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.atlas-sym')].map((g) => g.getBoundingClientRect()).find((r) => r.width > 4 && r.top > 160 && r.left > 320 && r.right < innerWidth - 480 && r.bottom < innerHeight - 80)
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    })
    if (at) await page.mouse.click(at.x, at.y)
    await wait(1500)
    const camera = () =>
      page.evaluate(() => {
        const names = [...document.querySelectorAll('.atlas .atlas-name')].slice(0, 6).map((n) => `${n.textContent}@${Math.round(n.getBoundingClientRect().x)},${Math.round(n.getBoundingClientRect().y)}`)
        return { names, selected: document.querySelector('.atlas [data-selected], .atlas .is-selected')?.textContent ?? null, heading: document.querySelector('[data-inspector] h2, [data-inspector] h3, [data-inspector] [role=heading]')?.textContent ?? null, ring: !!document.querySelector('.atlas-selected') }
      })
    const left = await camera()
    const baseline = await page.evaluate(() => ({ ...window.__listeners }))

    await press('Plan')
    await wait(1500)
    const hidden = await page.evaluate(async () => {
      const kept = document.querySelector('[data-kept="atlas"]')
      const raf0 = window.__raf
      await new Promise((r) => setTimeout(r, 2000))
      const mid = document.querySelector('.stage').getBoundingClientRect()
      const top = document.elementFromPoint(mid.left + mid.width / 2, mid.top + mid.height / 2)
      return {
        kept: !!kept,
        // Behind the open workspace: laid out (so its painting is kept), covered, inert.
        covered: !!kept && !kept.hasAttribute('data-active') && kept.getAttribute('aria-hidden') === 'true' && !kept.contains(top) && kept.getBoundingClientRect().width > 0,
        // Nothing in it can take keyboard focus: the map is not a tab stop and everything around it is inert.
        tabStops: kept ? [...kept.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.closest('[inert]') && !el.disabled).length : -1,
        frames: window.__raf - raf0,
        animations: kept ? kept.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : -1,
        listeners: { ...window.__listeners },
      }
    })
    check(tag + 'the Atlas stays mounted behind the open workspace, covered and inert', hidden.kept && hidden.covered && hidden.tabStops === 0, JSON.stringify({ kept: hidden.kept, covered: hidden.covered, tabStops: hidden.tabStops }))
    check(tag + 'a hidden Atlas runs no animations', hidden.animations === 0 && hidden.frames <= 4, `${hidden.animations} running, ${hidden.frames} animation frames in 2 s`)
    check(tag + 'a hidden Atlas holds no window listeners', hidden.listeners.pointer <= baseline.pointer - 0 && hidden.listeners.wheel <= baseline.wheel && hidden.listeners.key < baseline.key, `on the Atlas ${JSON.stringify(baseline)} → hidden ${JSON.stringify(hidden.listeners)}`)

    // Timed to the frame *after* the one that shows the map: a stall rasterising it would land in that interval.
    const visit = await page.evaluate(async () => {
      const t0 = performance.now()
      location.hash = '#/atlas'
      const front = () => document.querySelector('[data-kept="atlas"]')?.hasAttribute('data-active')
      while (!front() && performance.now() - t0 < 15000) await new Promise((r) => requestAnimationFrame(r))
      const shown = Math.round(performance.now() - t0)
      await new Promise((r) => requestAnimationFrame(r))
      await new Promise((r) => requestAnimationFrame(r))
      const painted = Math.round(performance.now() - t0)
      // And the frames that follow must be ordinary ones.
      let worst = 0
      let last = performance.now()
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(r))
        const now = performance.now()
        worst = Math.max(worst, now - last)
        last = now
      }
      return { shown, painted, worstFrameAfter: Math.round(worst) }
    })
    check(tag + 'the second visit to the Atlas is immediate (painted within 100 ms, no stall after)', visit.painted <= 100 && visit.worstFrameAfter <= 100, JSON.stringify(visit))
    await wait(1200)
    const back = await camera()
    check(tag + 'the camera is where it was left', JSON.stringify(back.names) === JSON.stringify(left.names), `${left.names.slice(0, 2).join(' | ')} → ${back.names.slice(0, 2).join(' | ')}`)
    check(tag + 'the selection is still open', !!left.heading && left.ring && back.heading === left.heading && back.ring, `${left.heading} → ${back.heading}`)
    const again = await page.evaluate(() => ({ ...window.__listeners }))
    check(tag + 'listeners return with it, without piling up', again.pointer === baseline.pointer && again.key === baseline.key && again.wheel === baseline.wheel, `${JSON.stringify(baseline)} → ${JSON.stringify(again)}`)

    // Twice more, to be sure nothing accumulates.
    for (let i = 0; i < 2; i++) {
      await press('Home')
      await press('Atlas')
    }
    await wait(800)
    const later = await page.evaluate(() => ({ ...window.__listeners }))
    check(tag + 'three round trips leave the same listeners', JSON.stringify(later) === JSON.stringify(baseline), JSON.stringify(later))

    await press('Atlas')
    await wait(1800)
    const reset = await camera()
    check(tag + 'pressing Atlas again returns to the overview', JSON.stringify(reset.names) !== JSON.stringify(left.names) && !reset.ring, reset.names.slice(0, 2).join(' | '))
  }

  check(tag + 'no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
