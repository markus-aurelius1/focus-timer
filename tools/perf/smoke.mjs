/**
 * Touch smoke test on a phone viewport: onboarding, timer, sheets, the other
 * screens, Atlas pan / pinch / fling / tap-to-card, and offline reload.
 *
 *   node smoke.mjs [baseUrl]      (default http://localhost:4173/, i.e. `npm run preview`)
 */
import { launch, prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const { browser, ctx, page } = await launch({ touch: true, dpr: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
let failed = 0
const ok = (name, cond) => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`)
}

await prepare(page, base, { sample: true, route: '#/focus' })

// Timer
await page.getByRole('button', { name: /^start focus/i }).click()
await page.waitForTimeout(2300)
const t1 = await page.getByRole('timer').getAttribute('aria-label')
ok(`timer runs (${t1})`, /remaining|elapsed/.test(t1 ?? '') && !/^25:00/.test(t1 ?? ''))
await page.getByRole('button', { name: /^pause$/i }).click()
await page.waitForTimeout(1200)
const t2 = await page.getByRole('timer').getAttribute('aria-label')
await page.waitForTimeout(1200)
ok('timer pauses', t2 === (await page.getByRole('timer').getAttribute('aria-label')))
await page.getByRole('button', { name: /stop the timer/i }).click()
await page.waitForTimeout(600)
if (await page.getByRole('button', { name: /discard and reset/i }).isVisible().catch(() => false)) await page.getByRole('button', { name: /discard and reset/i }).click()

// Sheets close from the backdrop
await page.getByRole('button', { name: /timer profile/i }).first().click()
await page.waitForTimeout(600)
ok('profile sheet opens', await page.locator('[role=dialog]').isVisible())
await page.touchscreen.tap(195, 30)
await page.waitForTimeout(700)
ok('backdrop tap closes sheet', !(await page.locator('[role=dialog]').isVisible().catch(() => false)))

for (const r of ['#/tasks', '#/calendar', '#/insights', '#/settings']) {
  await page.goto(base + r)
  await page.waitForTimeout(700)
}

// Atlas
await page.goto(base + '#/atlas')
await page.waitForTimeout(2500)
// First visit asks for a base camp.
const closeCamp = page.getByRole('button', { name: /close/i }).first()
if (await closeCamp.isVisible().catch(() => false)) await closeCamp.click()
await page.waitForTimeout(800)
const cdp = await ctx.newCDPSession(page)
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
const worldT = () => page.evaluate(() => document.querySelector('.atlas-layer svg > g')?.getAttribute('transform'))
ok(`atlas names rendered (${await page.locator('.atlas-name').count()})`, (await page.locator('.atlas-name').count()) > 5)

// Tap a place symbol → its card stays open → backdrop closes it.
const sym = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.atlas-labels svg g[transform^=translate]')].map((g) => g.getBoundingClientRect()).find((r) => r.width > 5 && r.width < 30 && r.top > 120)
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null
})
if (sym) {
  await page.touchscreen.tap(sym.x, sym.y)
  await page.waitForTimeout(900)
  ok('tap on a place opens its card', await page.locator('[role=dialog]').isVisible().catch(() => false))
  await page.touchscreen.tap(195, 30)
  await page.waitForTimeout(700)
} else ok('found a place symbol to tap', false)

const before = await worldT()
await touch('touchStart', [[200, 400]])
for (let i = 1; i <= 20; i++) {
  await touch('touchMove', [[200 - i * 5, 400 - i * 2]])
  await page.waitForTimeout(16)
}
await page.waitForTimeout(80)
await touch('touchEnd', [])
await page.waitForTimeout(600)
ok('one-finger pan moves the map', before !== (await worldT()))

const k0 = await page.evaluate(() => document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1])
await touch('touchStart', [[170, 420], [230, 420]])
for (let i = 1; i <= 20; i++) {
  await touch('touchMove', [[170 - i * 4, 420], [230 + i * 4, 420]])
  await page.waitForTimeout(16)
}
await touch('touchEnd', [])
await page.waitForTimeout(700)
const k1 = await page.evaluate(() => document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1])
ok(`pinch zooms in (${k0} → ${k1})`, Number(k1) > Number(k0) * 1.5)
ok('moving state clears after settle', !(await page.evaluate(() => document.querySelector('[role=application]')?.classList.contains('atlas-moving'))))

// Offline
ok('service worker registered', await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())))
// Wait until the worker is active (its precache complete) before going offline.
await page.evaluate(async () => {
  await navigator.serviceWorker.ready
})
await page.waitForTimeout(1500)
await ctx.setOffline(true)
await page.reload()
await page.waitForTimeout(2500)
ok('app loads offline', (await page.locator('[role=application]').count()) > 0)
await ctx.setOffline(false)

ok('no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
await browser.close()
process.exit(failed ? 1 : 0)
