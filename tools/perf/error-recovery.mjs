/**
 * Error recovery: a failed screen or dialog must never blank the app.
 *
 *   node error-recovery.mjs [previewUrl] [devUrl]
 *
 * Against the production preview (service worker blocked, so the request really
 * goes to the network): a route chunk that can't be fetched reloads the page
 * once, then shows the recovery panel inside the stage while the navigation
 * keep working.
 *
 * Against `npm run dev` (optional second URL): the development-only crash
 * switches (`?crash=route`, `?crash=sheet`, src/lib/crashTest.tsx) throw inside
 * a screen and inside an open dialog.
 */
import { chromium } from 'playwright-core'

const preview = process.argv[2] ?? 'http://localhost:4173/'
const dev = process.argv[3]
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` – ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

// ── production: a route chunk that cannot be fetched ───────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Screens are fetched ahead of need, in idle time, so the chunk has to be unreachable from the very first load.
  // (A preload that fails is silent; only opening the screen may reload or show the panel.)
  let aborted = 0
  await ctx.route('**/assets/SettingsScreen-*.js', (route) => {
    aborted++
    return route.abort()
  })
  await page.goto(preview + '#/atlas')
  await page.getByRole('application').waitFor()
  await page.waitForTimeout(2000)
  check('a preload that fails is silent', errors.length === 0 && !(await page.getByRole('alert').isVisible().catch(() => false)), errors.join(' | '))
  let loads = 0
  page.on('load', () => loads++)
  await page.goto(preview + '#/settings')
  await page.waitForTimeout(4000)
  const panel = page.getByRole('alert').filter({ hasText: 'This screen couldn’t load' })
  check('chunk failure reloads the page once', loads === 1 && aborted >= 2, `reloads ${loads}, aborted requests ${aborted}`)
  check('recovery panel is shown in the stage', await panel.isVisible().catch(() => false))
  check('navigation is still there', await page.locator('#sidebar').isVisible())
  await ctx.unroute('**/assets/SettingsScreen-*.js')
  await page.getByRole('button', { name: 'Reload Tars' }).click()
  await page.waitForTimeout(2500)
  check('reload recovers the screen', await page.getByRole('heading', { name: 'Settings', level: 1 }).isVisible().catch(() => false))
  await page.goto(preview + '#/atlas')
  await page.getByRole('application').waitFor()
  check('other screens open normally afterwards', await page.getByRole('application').isVisible())
  await ctx.close()
}

// ── development: throws inside a screen and inside a dialog ────────────────
if (dev) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(dev + '#/atlas')
  await page.goto(dev + '#/settings?crash=route')
  await page.waitForTimeout(1500)
  check('a throwing screen shows the recovery panel', await page.getByRole('alert').filter({ hasText: 'This screen ran into a problem' }).isVisible().catch(() => false))
  check('the rail survives a throwing screen', await page.locator('#sidebar').isVisible())
  await page.locator('#sidebar').getByRole('button', { name: 'Atlas' }).click().catch(() => {})
  await page.waitForTimeout(800)
  check('navigating away clears the error', await page.getByRole('application').isVisible().catch(() => false))

  await page.goto(dev + '#/atlas?crash=sheet')
  await page.waitForTimeout(1000)
  await page.keyboard.press('?')
  await page.waitForTimeout(1200)
  check('a throwing dialog closes itself', (await page.locator('[role=dialog][aria-modal=true]').count()) === 0)
  check('a toast says so', await page.getByText('That couldn’t open').isVisible().catch(() => false))
  check('the screen beneath is intact', await page.getByRole('application').isVisible())
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} error-recovery checks passed`)
process.exit(failed ? 1 : 0)
