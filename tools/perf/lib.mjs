/**
 * Shared setup for the perf scripts: launch Chromium as a phone, finish
 * onboarding, optionally add the sample history, and open a route.
 *
 *   CHROMIUM_PATH=/path/to/chrome   use a specific Chromium (else playwright-core's own)
 */
import { chromium } from 'playwright-core'

export async function launch({ touch = false, dpr = 3 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  return { browser, ctx, page }
}

/** Fresh profile → onboarding done (no base camp) → optional sample data → route. */
export async function prepare(page, base, { sample = true, route = '#/atlas' } = {}) {
  await page.goto(base + '#/settings')
  await page.waitForTimeout(1500)
  const dialog = page.getByRole('dialog')
  const cont = dialog.getByRole('button', { name: /^continue$/i })
  if (await cont.isVisible().catch(() => false)) {
    await cont.click()
    await page.waitForTimeout(500)
  }
  const skip = dialog.getByRole('button', { name: /skip for now/i })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
    await page.waitForTimeout(500)
  }
  if (sample) {
    const add = page.getByText('Preview with sample data')
    if (await add.isVisible().catch(() => false)) {
      await add.click()
      await page.waitForTimeout(4000)
    }
  }
  await page.goto(base + route)
  await page.waitForTimeout(3000)
  // The Atlas asks for a base camp on first visit.
  const close = page.getByRole('button', { name: /close/i }).first()
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.waitForTimeout(1000)
}
