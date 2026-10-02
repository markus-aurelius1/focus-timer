/**
 * Shell alignment (J-09).
 *
 *   - the header's leading edge is at the same x on every non-Atlas route, at 1366 and 1920 px
 *   - collapsing the rail and entering full screen lay the stage out once; the movement is a transform
 *   - on a phone no tab is selected on Notes, Insights or Settings, and their Back stays inside the app
 *   - Plan's views are tabs; on a phone the lists sit behind one "Lists" entry
 *
 *   node header-check.mjs [baseUrl]     (default http://localhost:4173/ – the preview build)
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
const ROUTES = ['home', 'focus', 'tasks', 'calendar', 'current-affairs', 'notes', 'insights', 'settings']

// ── title position ──
for (const width of [1366, 1920]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 1366 ? 768 : 1080 } })
  const page = await ctx.newPage()
  await prepare(page, base, { sample: true, route: '#/home' })
  const xs = {}
  for (const route of ROUTES) {
    await page.evaluate((r) => (location.hash = '#/' + r), route)
    await page.waitForTimeout(700)
    xs[route] = await page.evaluate(() => {
      // The first thing in the header row: the title, or on Home the date line above the greeting.
      const header = document.querySelector('.stage header')
      const first = header?.querySelector('h1, p')
      return first ? Math.round(first.getBoundingClientRect().left) : null
    })
  }
  const values = Object.values(xs)
  check(`[${width}] the header starts at the same x on every route`, values.every((v) => v !== null && Math.abs(v - values[0]) <= 1), JSON.stringify(xs))

  if (width === 1366) {
    // Plan views: all seven as tabs, no overflow entry.
    await page.evaluate(() => (location.hash = '#/tasks'))
    await page.waitForTimeout(600)
    const views = page.getByRole('navigation', { name: 'Plan views' })
    check('[1366] Plan shows all seven views as tabs', (await views.getByRole('button').count()) === 7 && (await views.getByRole('button', { name: 'Today', exact: true }).getAttribute('aria-current')) === 'page')

    // Rail collapse and expand, full screen: one layout of the stage each, the movement on the compositor.
    const watch = (action) =>
      page.evaluate(async (action) => {
        const stage = document.querySelector('.stage')
        const sizes = []
        const ro = new ResizeObserver(() => sizes.push(Math.round(stage.getBoundingClientRect().width)))
        ro.observe(stage)
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        sizes.length = 0
        const before = Math.round(stage.getBoundingClientRect().width)
        document.querySelector(`button[aria-label="${action}"]`).click()
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        const moving = stage.getAnimations().some((a) => a.playState === 'running')
        const padding = getComputedStyle(document.querySelector('.app-frame')).transitionProperty
        const rail = getComputedStyle(document.querySelector('.rail')).transitionProperty
        await new Promise((r) => setTimeout(r, 700))
        ro.disconnect()
        return { before, after: Math.round(stage.getBoundingClientRect().width), changes: sizes.length, moving, padding, rail, transform: getComputedStyle(stage).transform }
      }, action)
    const collapse = await watch('Collapse sidebar')
    check('[1366] collapsing the rail lays the stage out once and slides it', collapse.after > collapse.before && collapse.changes === 1 && collapse.moving && collapse.transform === 'none', JSON.stringify(collapse))
    const expand = await watch('Expand sidebar')
    check('[1366] expanding the rail lays the stage out once and slides it', expand.after < expand.before && expand.changes === 1 && expand.moving && expand.transform === 'none', JSON.stringify(expand))
    check('[1366] padding and width are not transitioned', !/padding/.test(collapse.padding) && !/width/.test(collapse.rail), `frame: ${collapse.padding}; rail: ${collapse.rail}`)
  }
  await ctx.close()
}

// ── phone ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/home' })
  const tabs = page.getByRole('navigation', { name: 'Main' })
  const selected = () => tabs.locator('[aria-current="page"]').count()
  const hash = () => page.evaluate(() => location.hash)

  check('[phone] Home has its tab selected', (await selected()) === 1)
  for (const route of ['notes', 'insights', 'settings']) {
    await page.evaluate((r) => (location.hash = '#/' + r), route)
    await page.waitForTimeout(600)
    check(`[phone] no tab is selected on ${route}`, (await selected()) === 0 && (await page.getByRole('button', { name: 'Back', exact: true }).isVisible()))
  }
  await page.evaluate(() => (location.hash = '#/calendar'))
  await page.waitForTimeout(600)
  check('[phone] the calendar is part of Plan', (await tabs.getByRole('button', { name: 'Plan', exact: true }).getAttribute('aria-current')) === 'page')

  // Back returns to where you came from…
  await page.evaluate(() => (location.hash = '#/tasks'))
  await page.waitForTimeout(500)
  await page.evaluate(() => (location.hash = '#/insights'))
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForTimeout(600)
  check('[phone] Back returns to the screen you came from', (await hash()) === '#/tasks', await hash())

  // …and when the app opened on that screen, to Home – not out of the app.
  const fresh = await ctx.newPage()
  await fresh.goto('about:blank')
  await fresh.goto(base + '#/notes')
  await fresh.waitForTimeout(2500)
  await fresh.getByRole('button', { name: 'Back', exact: true }).click()
  await fresh.waitForTimeout(700)
  const at = await fresh.evaluate(() => location.href)
  check('[phone] Back on the first screen goes Home, never out of the app', at.startsWith(base) && at.endsWith('#/home'), at)
  await fresh.goBack().catch(() => {})
  await fresh.waitForTimeout(500)
  check('[phone] …and Home replaced that entry rather than stacking on it', !(await fresh.evaluate(() => location.hash)).includes('notes'), await fresh.evaluate(() => location.href))
  await fresh.close()

  // Plan: three tabs and Lists.
  await page.evaluate(() => (location.hash = '#/tasks'))
  await page.waitForTimeout(700)
  const views = page.getByRole('navigation', { name: 'Plan views' })
  const names = await views.getByRole('button').allTextContents()
  check('[phone] Plan shows Today, Upcoming, Calendar and Lists', names.length === 4 && /Today/.test(names[0]) && /Upcoming/.test(names[1]) && /Calendar/.test(names[2]) && /Lists/.test(names[3]), names.join(' | '))
  const fits = await views.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
  check('[phone] the row fits without scrolling', fits)
  await views.getByRole('button', { name: 'Lists' }).click()
  await page.waitForTimeout(400)
  const items = await page.getByRole('menuitem').allTextContents()
  check('[phone] Lists holds Inbox, Projects, Habits and Done', items.length === 4 && ['Inbox', 'Projects', 'Habits', 'Done'].every((n, i) => items[i].startsWith(n)), items.join(' | '))
  await page.getByRole('menuitem', { name: /^Habits/ }).click()
  await page.waitForTimeout(700)
  const trigger = views.getByRole('button', { name: /lists/i })
  check('[phone] choosing a list opens it and the entry shows which', (await hash()) === '#/tasks?view=habits' && /Habits/.test(await trigger.textContent()) && (await trigger.getAttribute('aria-current')) === 'page', `${await hash()} · ${await trigger.textContent()}`)
  check('[phone] no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
