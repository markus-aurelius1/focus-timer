/**
 * Atlas interaction checks (desktop and phone), on a production build:
 *   desktop  wheel notches zoom smoothly around the cursor, double-click zooms in,
 *            Shift+double-click zooms out, keys pan and zoom, hover shows a pointer,
 *            layers hide undiscovered places, search → fly → card (other sheet too)
 *   phone    double tap zooms in, two-finger tap zooms out, search → fly → card
 *
 *   node atlas-check.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
let failed = 0
const ok = (name, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`)
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const scaleOf = (page) => page.evaluate(() => Number(document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1] ?? 0))
const sheetRect = (page) => page.evaluate(() => {
  const map = document.querySelector('[role=application]')?.getBoundingClientRect()
  const sheet = document.querySelector('.atlas-layer svg > g > rect')?.getBoundingClientRect()
  return map && sheet ? { map: map.toJSON(), sheet: sheet.toJSON() } : null
})
const settle = (page, ms = 700) => page.waitForTimeout(ms)

// ── desktop ──────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/atlas' })
  const box = await page.locator('[role=application]').boundingBox()
  const cx = box.x + box.width * 0.45
  const cy = box.y + box.height * 0.55
  const bounds = await sheetRect(page)
  ok('desktop: sheet covers the viewport', bounds && bounds.sheet.left <= bounds.map.left + 2 && bounds.sheet.top <= bounds.map.top + 2 && bounds.sheet.right >= bounds.map.right - 2 && bounds.sheet.bottom >= bounds.map.bottom - 2, JSON.stringify(bounds))

  // Wheel notches: the zoom eases in over several frames rather than jumping.
  const k0 = await scaleOf(page)
  await page.mouse.move(cx, cy)
  const frames = await page.evaluate(() => {
    window.__k = []
    const g = document.querySelector('.atlas-layer')
    const loop = () => {
      window.__k.push(g.style.transform)
      if (window.__k.length < 40) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return true
  })
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(700)
  const steps = await page.evaluate(() => new Set(window.__k).size)
  const k1 = await scaleOf(page)
  ok('wheel notch zooms in', frames && k1 > k0 * 1.1, `${k0} → ${k1}`)
  ok('wheel notch animates over several frames', steps >= 5, `${steps} distinct frames`)

  await page.mouse.dblclick(cx, cy)
  await settle(page)
  const k2 = await scaleOf(page)
  ok('double-click zooms in', k2 > k1 * 1.6, `${k1} → ${k2}`)
  await page.keyboard.down('Shift')
  await page.mouse.dblclick(cx, cy)
  await page.keyboard.up('Shift')
  await settle(page)
  const k3 = await scaleOf(page)
  ok('shift+double-click zooms out', k3 < k2 / 1.6, `${k2} → ${k3}`)

  await page.locator('[role=application]').focus()
  const tf0 = await page.evaluate(() => document.querySelector('.atlas-layer svg > g').getAttribute('transform'))
  await page.keyboard.press('ArrowRight')
  await settle(page, 500)
  ok('arrow key pans', tf0 !== (await page.evaluate(() => document.querySelector('.atlas-layer svg > g').getAttribute('transform'))))
  const k4 = await scaleOf(page)
  await page.keyboard.press('+')
  await settle(page, 600)
  ok('+ key zooms in', (await scaleOf(page)) > k4 * 1.3)

  await page.getByRole('button', { name: 'Fit the map' }).click()
  await settle(page)
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 13; i++) await page.mouse.wheel(0, -120)
  await settle(page, 1000)
  const atLimit = await sheetRect(page)
  const anchor = (r) => ({ x: (cx - r.sheet.x) / r.sheet.width, y: (cy - r.sheet.y) / r.sheet.height })
  const before = anchor(atLimit)
  await page.mouse.wheel(0, -1200)
  await settle(page, 700)
  const after = anchor(await sheetRect(page))
  ok('zooming past the limit stays on the same place', Math.hypot(after.x - before.x, after.y - before.y) < 0.002, `${JSON.stringify(before)} → ${JSON.stringify(after)}`)

  // Hover over a symbol shows a pointer.
  const sym = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.atlas-sym')].map((g) => g.getBoundingClientRect()).find((r) => r.width > 4 && r.top > 120 && r.left > 60)
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  })
  if (sym) {
    await page.mouse.move(sym.x, sym.y)
    await page.waitForTimeout(250)
    ok('hover over a place shows a pointer', (await page.evaluate(() => document.querySelector('[role=application]').style.cursor)) === 'pointer')
  } else ok('found a symbol to hover', false)

  // Layers: hiding undiscovered places leaves fewer symbols.
  const all = await page.locator('.atlas-sym').count()
  await page.getByRole('button', { name: 'Map layers' }).click()
  await page.getByRole('switch', { name: 'Places not yet discovered' }).click()
  await page.keyboard.press('Escape')
  await settle(page, 900)
  const known = await page.locator('.atlas-sym').count()
  ok('hiding undiscovered places removes their symbols', known < all, `${all} → ${known}`)
  await page.getByRole('button', { name: 'Map layers' }).click()
  await page.getByRole('switch', { name: 'Places not yet discovered' }).click()
  await page.keyboard.press('Escape')
  await settle(page)

  // Search → fly → card, on the other sheet.
  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Nagorno')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Nagorno-Karabakh/ }).first().click()
  await page.waitForTimeout(2600)
  ok('search result on the World sheet switches sheet', (await page.locator('[role=application]').getAttribute('aria-label'))?.startsWith('World'))
  ok('its card opens', await page.getByRole('heading', { name: 'Nagorno-Karabakh' }).isVisible())
  const sel = await page.evaluate(() => {
    const g = document.querySelector('.atlas-selected')?.getBoundingClientRect()
    const m = document.querySelector('[role=application]').getBoundingClientRect()
    return g ? { dx: Math.abs(g.x + g.width / 2 - (m.x + m.width / 2)), dy: Math.abs(g.y + g.height / 2 - (m.y + m.height / 2)) } : null
  })
  ok('the camera flew to it (selection ring near the centre)', sel && sel.dx < 80 && sel.dy < 120, JSON.stringify(sel))

  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('ramsar')
  await page.waitForTimeout(400)
  const ramsar = await page.locator('[role=dialog] ul > li').count()
  ok('searching "ramsar" lists Ramsar sites', ramsar >= 60, `${ramsar} results`)
  await page.keyboard.press('Escape')
  ok('no page errors (desktop)' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
  await ctx.close()
}

// ── phone ────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/atlas' })
  const cdp = await ctx.newCDPSession(page)
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
  const tapAt = async (x, y) => {
    await touch('touchStart', [[x, y]])
    await touch('touchEnd', [])
  }
  const k0 = await scaleOf(page)
  const phoneBounds = await sheetRect(page)
  ok('phone: sheet covers the viewport', phoneBounds && phoneBounds.sheet.left <= phoneBounds.map.left + 2 && phoneBounds.sheet.top <= phoneBounds.map.top + 2 && phoneBounds.sheet.right >= phoneBounds.map.right - 2 && phoneBounds.sheet.bottom >= phoneBounds.map.bottom - 2, JSON.stringify(phoneBounds))
  await tapAt(160, 380)
  await page.waitForTimeout(120)
  await tapAt(160, 380)
  await settle(page)
  const k1 = await scaleOf(page)
  ok('double tap zooms in', k1 > k0 * 1.6, `${k0} → ${k1}`)
  // A tap may have opened a card; close it.
  if (await page.locator('[role=dialog]').isVisible().catch(() => false)) await page.keyboard.press('Escape')
  await settle(page, 400)
  await touch('touchStart', [[170, 420], [230, 420]])
  await page.waitForTimeout(60)
  await touch('touchEnd', [])
  await settle(page)
  const k2 = await scaleOf(page)
  ok('two-finger tap zooms out', k2 < k1 / 1.6, `${k1} → ${k2}`)

  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Kaziranga')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Kaziranga National Park/ }).first().click()
  await page.waitForTimeout(2000)
  ok('phone: search opens the card', await page.getByRole('heading', { name: 'Kaziranga National Park' }).isVisible())
  const sel = await page.evaluate(() => document.querySelector('.atlas-selected')?.getBoundingClientRect()?.y ?? null)
  ok('phone: the place sits above the card', sel !== null && sel < 844 * 0.45, `ring at y=${sel}`)
  ok('no page errors (phone)' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
  await ctx.close()
}

await browser.close()
process.exit(failed ? 1 : 0)
