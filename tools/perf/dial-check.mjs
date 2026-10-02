/**
 * Focus progress against the timer engine.
 *
 * The progress bar under the clock is animated on the compositor
 * (timer/useProgressAnimation.ts), not written by script each frame, so nothing
 * in the page states its position. This reads it back from the computed
 * transform and compares it with the engine's progress, worked out from the
 * persisted timer state. (The file keeps its name from when the progress was a
 * dial.)
 *
 *   - running, after a pause, after resume, after +5 minutes
 *   - after the wall clock jumps (a laptop that slept): corrected within a tick
 *   - back to zero after Stop
 *   - with reduced motion: the bar still advances
 *   - immersive mode: the same bar, the app's chrome put away
 *   - no requestAnimationFrame loop while a session runs
 *
 *   node dial-check.mjs [baseUrl]
 *
 * Run against a production build. Set CHROMIUM_PATH to use a specific Chrome.
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] || 'http://localhost:4173/'
/** The job's acceptance bound is 0.5% of the phase; a healthy dial is far inside it. */
const TOLERANCE = 0.005
let failed = 0
const check = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

/** Progress shown by the bar and the engine's, read in one go. (`head` and `arc` are the same value: the names date from the dial.) */
const read = (page) =>
  page.evaluate(() => {
    const shown = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.focus-progress > div')).transform).a
    let timer = null
    for (let i = 0; i < localStorage.length; i++) {
      try {
        const v = JSON.parse(localStorage.getItem(localStorage.key(i)))
        if (v && typeof v.phaseId === 'string' && 'accumulatedMs' in v) timer = v
      } catch {}
    }
    const elapsed = timer.accumulatedMs + (timer.status === 'running' ? Math.max(0, Date.now() - timer.segmentStartedAt) : 0)
    const engine = timer.status === 'idle' ? 0 : Math.min(1, elapsed / timer.targetMs)
    return { head: shown, arc: shown, engine, status: timer.status, targetMs: timer.targetMs }
  })

const agree = async (page, name) => {
  const r = await read(page)
  const off = Math.max(Math.abs(r.head - r.engine), Math.abs(r.arc - r.engine))
  check(off <= TOLERANCE, name, `engine ${(r.engine * 100).toFixed(3)}% bar ${(r.head * 100).toFixed(3)}%`)
  return r
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  const tag = reducedMotion === 'reduce' ? 'reduced motion: ' : ''
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1, reducedMotion })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: false, route: '#/focus' })

  // A five-minute phase, so that half a percent is a second and a half.
  const less = page.getByRole('button', { name: '5 minutes less' })
  for (let i = 0; i < 4; i++) await less.click()
  await page.getByRole('button', { name: /^Start focus/i }).first().click()
  await page.waitForTimeout(2500)
  const a = await agree(page, `${tag}running`)
  check(a.targetMs === 300000, `${tag}the phase is five minutes`, `${a.targetMs} ms`)
  await page.waitForTimeout(4000)
  const b = await agree(page, `${tag}still in step four seconds later`)
  check(b.head > a.head + 0.01, `${tag}the bar advances`, `${(a.head * 100).toFixed(2)}% → ${(b.head * 100).toFixed(2)}%`)

  if (reducedMotion === 'no-preference') {
    // Nothing should be running on the main thread between second ticks.
    const raf = await page.evaluate(async () => {
      let n = 0
      const orig = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (cb) => orig((t) => { n++; cb(t) })
      await new Promise((r) => setTimeout(r, 3000))
      window.requestAnimationFrame = orig
      return n / 3
    })
    check(raf <= 2, 'no frame loop while running', `${raf.toFixed(1)} requestAnimationFrame callbacks a second`)

    await page.getByRole('button', { name: 'Pause', exact: true }).first().click()
    await page.waitForTimeout(900)
    const p1 = await agree(page, 'paused')
    await page.waitForTimeout(1500)
    const p2 = await read(page)
    check(p1.head === p2.head && p2.status === 'paused', 'the bar holds still while paused', `${p1.head} → ${p2.head}`)
    await page.getByRole('button', { name: 'Resume', exact: true }).first().click()
    await page.waitForTimeout(1500)
    await agree(page, 'resumed')

    await page.getByRole('button', { name: '+5 min', exact: true }).click({ force: true })
    await page.waitForTimeout(900)
    const more = await agree(page, 'after +5 min')
    check(more.targetMs === 600000 && more.head < p2.head, 'the bar drew back for the longer phase', `${(p2.head * 100).toFixed(2)}% → ${(more.head * 100).toFixed(2)}%`)

    // A laptop that slept: the wall clock is suddenly a minute and a half on, the animation's clock is not.
    await page.evaluate(() => {
      const real = Date.now.bind(Date)
      Date.now = () => real() + 90_000
    })
    await page.waitForTimeout(2200)
    const jumped = await agree(page, 'after the clock jumps 90 s')
    check(jumped.engine > 0.15, 'the engine saw the jump', `${(jumped.engine * 100).toFixed(1)}%`)

    await page.evaluate(() => {
      const now = Date.now.bind(Date)
      Date.now = () => now() + 240_000
    })
    await page.waitForTimeout(2200)
    const late = await agree(page, 'past half-way')
    check(late.engine > 0.5, 'the session is in its second half', `${(late.engine * 100).toFixed(1)}%`)

    // Immersive mode is the same screen with the chrome put away: the bar carries on from where it was.
    await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {})
    await page.keyboard.press('f')
    await page.waitForTimeout(1500)
    check((await page.evaluate(() => document.documentElement.dataset.focus)) === 'immersive', 'immersive mode puts the chrome away')
    await agree(page, 'in immersive mode')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    check((await page.evaluate(() => document.documentElement.dataset.focus)) === undefined, 'Escape leaves immersive mode')

    await page.getByRole('button', { name: 'Stop the timer' }).first().click()
    // A session past the minimum length asks before it is thrown away.
    const discard = page.getByRole('button', { name: 'Discard and reset' })
    if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click()
    await page.waitForTimeout(1500)
    const stopped = await read(page)
    check(stopped.status === 'idle' && stopped.head <= 0.001, 'back to empty after Stop', `${stopped.status}, bar ${(stopped.head * 100).toFixed(3)}%`)
  }

  check(errors.length === 0, `${tag}no page errors`, errors.join(' | '))
  await browser.close()
}

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
