/**
 * Screenshots of every screen for UI review: phone + desktop, light + dark,
 * with the sample history loaded. Output: tools/perf/out/screens/.
 *
 *   node screens.mjs [baseUrl] [filter]     e.g. node screens.mjs http://localhost:4173/ focus
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const filter = process.argv[3] ?? ''
const out = new URL('./out/screens/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const viewports = [
  ['phone', { width: 390, height: 844 }, 2],
  ['desktop', { width: 1280, height: 800 }, 1],
]
for (const [vp, viewport, dpr] of viewports) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, colorScheme: scheme, hasTouch: vp === 'phone', isMobile: vp === 'phone' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('pageerror', e.message))
    await prepare(page, base, { sample: true, route: '#/focus' })
    const shot = async (name) => {
      if (filter && !name.includes(filter)) return
      await page.screenshot({ path: `${out}${vp}-${scheme}-${name}.png` })
      console.log(`${vp}-${scheme}-${name}`)
    }
    await shot('focus-idle')
    await page.getByRole('button', { name: /^start focus/i }).click()
    await page.waitForTimeout(1500)
    await shot('focus-running')
    await page.getByRole('button', { name: /immersive mode/i }).first().click()
    await page.waitForTimeout(1200)
    await shot('focus-immersive')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: /^stop$/i }).click()
    await page.waitForTimeout(500)
    const discard = page.getByRole('button', { name: /discard session/i })
    if (await discard.isVisible().catch(() => false)) await discard.click()
    for (const r of ['tasks', 'calendar', 'insights', 'atlas', 'settings']) {
      await page.goto(base + '#/' + r)
      await page.waitForTimeout(r === 'atlas' ? 2500 : 900)
      const close = page.getByRole('button', { name: /close/i }).first()
      if (r === 'atlas' && (await close.isVisible().catch(() => false))) {
        await close.click()
        await page.waitForTimeout(800)
      }
      await shot(r)
    }
    await ctx.close()
  }
}
await browser.close()
