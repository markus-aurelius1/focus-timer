/**
 * The application shell, end to end: Home as the landing, rail and tab-bar
 * navigation, keyboard chords, quick capture → Notes (and its persistence),
 * timer continuity across screens and a reload, back behaviour, theme
 * switching, the window/phone scroll models and reduced motion.
 *
 *   node shell-check.mjs [baseUrl]      (default http://localhost:4173/, i.e. `npm run preview`)
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const errors = []
let failed = 0
const ok = (name, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`)
}
const timerState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tars.timer.v1') ?? 'null'))
const route = (page) => page.evaluate(() => location.hash)

// ── window (laptop) ───────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text().slice(0, 200)))
  await prepare(page, base, { sample: true, route: '' })

  ok('window: the app opens on Home', await page.getByRole('heading', { level: 1 }).first().isVisible() && (await page.getByRole('button', { name: 'Home', exact: true }).getAttribute('aria-current')) === 'page')
  await page.goto(base + '#/nowhere')
  await page.waitForTimeout(400)
  ok('window: an unknown route lands on Home', (await page.getByRole('button', { name: 'Home', exact: true }).getAttribute('aria-current')) === 'page')

  const frame = await page.evaluate(() => ({ doc: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight, rail: getComputedStyle(document.querySelector('#sidebar')).display, stage: document.querySelector('.stage').getBoundingClientRect().toJSON(), w: innerWidth, h: innerHeight }))
  ok('window: the document itself never scrolls', frame.doc === 0, JSON.stringify(frame.doc))
  ok('window: the stage is inset beside the rail', frame.rail === 'flex' && frame.stage.left > 200 && frame.stage.top === 8 && Math.round(frame.stage.right) === frame.w - 8 && Math.round(frame.stage.bottom) === frame.h - 8, JSON.stringify(frame.stage))

  // Rail navigation and the workspaces it reaches.
  for (const [label, hash] of [['Focus', '#/focus'], ['Plan', '#/tasks'], ['News', '#/current-affairs'], ['Notes', '#/notes'], ['Insights', '#/insights'], ['Settings', '#/settings'], ['Home', '#/home']]) {
    await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).or(page.locator('#sidebar').getByRole('button', { name: label, exact: true })).first().click()
    await page.waitForTimeout(350)
    ok(`window: rail → ${label}`, (await route(page)) === hash && (await page.locator('#sidebar').getByRole('button', { name: label, exact: true }).getAttribute('aria-current')) === 'page')
  }
  await page.goto(base + '#/calendar')
  await page.waitForTimeout(500)
  ok('window: the calendar is a view of Plan', (await page.locator('#sidebar').getByRole('button', { name: 'Plan', exact: true }).getAttribute('aria-current')) === 'page' && (await page.getByRole('navigation', { name: 'Plan views' }).getByRole('button', { name: 'Calendar', exact: true }).getAttribute('aria-current')) === 'page')

  await page.goto(base + '#/insights')
  await page.waitForTimeout(900)
  const scrolled = await page.evaluate(() => {
    const el = document.querySelector('.stage-scroll')
    el.scrollTo(0, 600)
    return { top: el.scrollTop, page: window.scrollY, header: Math.round(document.querySelector('.stage header').getBoundingClientRect().top) }
  })
  ok('window: workspaces scroll inside the stage under a header that stays', scrolled.top > 0 && scrolled.page === 0 && scrolled.header === 8, JSON.stringify(scrolled))
  await page.getByRole('navigation', { name: 'Workspaces' }).getByRole('button', { name: 'Home', exact: true }).click()
  await page.waitForTimeout(400)
  ok('window: a new screen starts at the top', (await page.evaluate(() => document.querySelector('.stage-scroll').scrollTop)) === 0)

  // Keyboard.
  await page.keyboard.press('g')
  await page.keyboard.press('n')
  await page.waitForTimeout(400)
  ok('keyboard: G then N opens Notes', (await route(page)) === '#/notes')
  await page.keyboard.press('g')
  await page.keyboard.press('h')
  await page.waitForTimeout(400)
  ok('keyboard: G then H opens Home', (await route(page)) === '#/home')
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search and commands', exact: true })
  await palette.waitFor()
  await palette.getByRole('combobox').fill('notes')
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  ok('keyboard: the palette navigates to a new workspace', (await route(page)) === '#/notes')

  // Quick capture → Notes → reload → Undo.
  const text = 'Shell check: Article 21 is read with Articles 14 and 19 (the golden triangle).'
  await page.keyboard.press('c')
  const capture = page.getByRole('dialog', { name: 'Capture' })
  await capture.waitFor()
  ok('capture: C opens quick capture with the pen ready', await capture.getByLabel('Short note').evaluate((el) => el === document.activeElement))
  ok('capture: a blank note cannot be saved', !(await capture.getByRole('button', { name: 'Save note', exact: true }).isEnabled()))
  await capture.getByLabel('Short note').fill(text)
  await capture.getByRole('button', { name: 'Save note', exact: true }).click()
  await capture.waitFor({ state: 'detached' })
  await page.locator('[data-sticky-note]').filter({ hasText: 'golden triangle' }).waitFor()
  ok('capture: the note appears on the Notes board at once', true)
  await page.reload()
  await page.locator('[data-sticky-note]').filter({ hasText: 'golden triangle' }).waitFor()
  ok('persistence: the note survives a reload', (await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('tars.current-affairs.notes.v1')).entries).length)) === 1)
  await page.goto(base + '#/home')
  await page.waitForTimeout(500)
  ok('home: the latest note is offered under Pick up', await page.getByRole('button', { name: /Notes.*golden triangle/ }).isVisible())
  await page.goto(base + '#/notes')
  await page.locator('[data-sticky-note]').first().hover()
  await page.getByRole('button', { name: /^Remove note from/ }).click()
  ok('notes: removal hides the note', (await page.locator('[data-sticky-note]').count()) === 0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.locator('[data-sticky-note]').waitFor()
  ok('notes: Undo restores it', true)
  await page.keyboard.press('c')
  await capture.waitFor()
  await capture.getByRole('tab', { name: 'Task', exact: true }).click()
  await capture.getByLabel('Task', { exact: true }).fill('Shell check task today #shell')
  await capture.getByRole('button', { name: 'Add task', exact: true }).click()
  await capture.waitFor({ state: 'detached' })
  const captured = await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('lodestar')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => { const db = req.result, all = db.transaction('tasks').objectStore('tasks').getAll(); all.onsuccess = () => { db.close(); resolve(all.result.find((t) => t.title === 'Shell check task')) } }
  }))
  ok('capture: a task line is parsed and stored through the action registry', !!captured && captured.tags?.[0] === 'shell' && !!captured.plannedFor)

  // Timer continuity: Home → session → other screens → reload.
  await page.goto(base + '#/home')
  await page.waitForTimeout(500)
  await page.getByRole('region', { name: 'Next action' }).getByRole('button', { name: /^Start focus/ }).click()
  await page.waitForTimeout(900)
  const started = await timerState(page)
  ok('timer: Home starts the next planned task', started?.status === 'running' && !!started.context.taskId && (await route(page)) === '#/focus')
  ok('session: the frame recedes while focus runs', (await page.evaluate(() => document.documentElement.dataset.session)) === 'active')
  await page.locator('#sidebar').getByRole('button', { name: 'Plan', exact: true }).click()
  await page.waitForTimeout(500)
  ok('timer: the rail carries the running timer on other screens', await page.getByRole('button', { name: /Open the timer$/ }).isVisible() && (await page.evaluate(() => document.documentElement.dataset.session)) === undefined)
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click()
  await page.waitForTimeout(300)
  ok('timer: pause from the rail', (await timerState(page)).status === 'paused')
  await page.getByRole('button', { name: 'Resume timer', exact: true }).click()
  await page.waitForTimeout(300)
  ok('timer: resume from the rail', (await timerState(page)).status === 'running')
  await page.goto(base + '#/home')
  await page.reload()
  await page.getByRole('region', { name: 'Current session' }).waitFor()
  const after = await timerState(page)
  ok('timer: the session survives a reload and owns Home', after.status === 'running' && after.context.taskId === started.context.taskId && after.startedAt === started.startedAt)
  await page.getByRole('region', { name: 'Current session' }).getByRole('button', { name: 'Open focus' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /stop the timer/i }).click()
  await page.waitForTimeout(400)
  const discard = page.getByRole('button', { name: /discard and reset/i })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await page.waitForTimeout(400)
  ok('timer: stopping returns the shell to rest', (await timerState(page)).status === 'idle' && (await page.evaluate(() => document.documentElement.dataset.session)) === undefined)

  // Back.
  await page.goto(base + '#/home')
  await page.locator('#sidebar').getByRole('button', { name: 'Notes', exact: true }).click()
  await page.waitForTimeout(300)
  await page.goBack()
  await page.waitForTimeout(400)
  ok('navigation: Back returns to the previous workspace', (await route(page)) === '#/home')

  // Theme.
  await page.keyboard.press('Control+k')
  await palette.waitFor()
  await palette.getByRole('combobox').fill('Theme: Night')
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  const night = await page.evaluate(() => ({ dark: document.documentElement.classList.contains('dark'), fading: document.documentElement.classList.contains('theme-fade'), bg: getComputedStyle(document.querySelector('.stage')).backgroundColor, canvas: getComputedStyle(document.documentElement).backgroundColor, meta: document.querySelector('meta[name="theme-color"]').content }))
  ok('theme: Night applies, with its own stage and canvas', night.dark && !night.fading && night.bg === 'rgb(12, 14, 22)' && night.canvas === 'rgb(7, 9, 15)' && night.meta === '#07090f', JSON.stringify(night))
  await page.reload()
  await page.waitForTimeout(900)
  ok('persistence: the theme survives a reload', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await ctx.close()
}

// ── phone, reduced motion ─────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/home' })
  const tabs = page.getByRole('navigation', { name: 'Main', exact: true })
  ok('phone: five tabs, each a full touch target', await tabs.getByRole('button').evaluateAll((buttons) => buttons.length === 5 && buttons.every((el) => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.x >= 0 && r.right <= innerWidth })))
  ok('phone: the rail is not rendered', (await page.evaluate(() => getComputedStyle(document.querySelector('#sidebar')).display)) === 'none')
  for (const [label, hash] of [['Plan', '#/tasks'], ['Focus', '#/focus'], ['News', '#/current-affairs'], ['Atlas', '#/atlas'], ['Home', '#/home']]) {
    await tabs.getByRole('button', { name: label, exact: true }).tap()
    await page.waitForTimeout(label === 'Atlas' ? 1500 : 350)
    if (label === 'Atlas' && (await page.getByRole('dialog').first().isVisible().catch(() => false))) await page.keyboard.press('Escape')
    ok(`phone: tab → ${label}`, (await route(page)) === hash && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).tap()
  await page.waitForTimeout(400)
  // Settings is not on the tab bar: no tab claims it (J-09); its Back leads home.
  ok('phone: Settings is reached from Home, and no tab is marked as current there', (await route(page)) === '#/settings' && (await tabs.locator('[aria-current="page"]').count()) === 0)
  await page.getByRole('button', { name: 'Back', exact: true }).tap()
  await page.waitForTimeout(400)
  ok('phone: Back returns to Home', (await route(page)) === '#/home')
  await page.getByRole('button', { name: 'Ask Tars', exact: true }).tap()
  await page.getByRole('dialog', { name: 'Search and commands', exact: true }).waitFor()
  ok('phone: Ask Tars opens search and commands', true)
  await page.keyboard.press('Escape')
  const motion = await page.evaluate(() => {
    const el = document.querySelector('.settle')
    const cs = el ? getComputedStyle(el) : null
    return cs ? { duration: parseFloat(cs.animationDuration) * (cs.animationDuration.endsWith('ms') ? 1 : 1000), transform: cs.transform, name: cs.animationName } : null
  })
  // Reduced motion (J-06): movement becomes a quick fade – no travel, nothing longer than the "fast" token.
  ok('reduced motion: arriving content fades in without moving', !!motion && motion.name === 'fade-in' && motion.duration <= 150 && motion.transform === 'none', JSON.stringify(motion))
  await page.goto(base + '#/focus')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^start focus/i }).tap()
  await page.waitForTimeout(1300)
  ok('phone: the Focus tab shows the running time', /\d\d:\d\d/.test(await tabs.getByRole('button', { name: /^Focus, / }).innerText()))
  ok('phone: a running session fits the screen', (await page.evaluate(() => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight)) <= 0)
  await page.getByRole('button', { name: /stop the timer/i }).tap()
  await page.waitForTimeout(400)
  const discard = page.getByRole('button', { name: /discard and reset/i })
  if (await discard.isVisible().catch(() => false)) await discard.tap()
  await ctx.close()
}

ok('no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
await browser.close()
process.exit(failed ? 1 : 0)
