/**
 * Quick visual review: one screenshot per route at the chosen sizes and themes,
 * with the sample history loaded. Output: tools/perf/out/shots/.
 *
 *   node shots.mjs [baseUrl] [routes] [sizes] [schemes]
 *   node shots.mjs http://localhost:5173/ home,focus,tasks phone,desktop light,dark
 *
 * Sizes: phone 390×844 · large 430×932 · tablet 820×1180 · laptop 1366×768 · desktop 1680×1000
 */
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const routes = (process.argv[3] ?? 'home,focus,tasks,calendar,current-affairs,atlas,notes,insights,settings').split(',')
const sizes = (process.argv[4] ?? 'phone,laptop').split(',')
const schemes = (process.argv[5] ?? 'light,dark').split(',')
const sample = process.env.SAMPLE !== '0'
const out = fileURLToPath(new URL('./out/shots/', import.meta.url))
mkdirSync(out, { recursive: true })

const SIZES = {
  phone: [{ width: 390, height: 844 }, 2, true],
  large: [{ width: 430, height: 932 }, 2, true],
  tablet: [{ width: 820, height: 1180 }, 1, true],
  laptop: [{ width: 1366, height: 768 }, 1, false],
  desktop: [{ width: 1680, height: 1000 }, 1, false],
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
for (const size of sizes) {
  const [viewport, dpr, touch] = SIZES[size]
  for (const scheme of schemes) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, colorScheme: scheme, hasTouch: touch, isMobile: touch && viewport.width < 600 })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('pageerror', e.message))
    page.on('console', (m) => m.type() === 'error' && console.log('console.error', m.text().slice(0, 300)))
    await prepare(page, base, { sample, route: '#/home' })
    for (const route of routes) {
      const [path, state] = route.split(':')
      const name = path.split('?')[0]
      const file = path.replace(/[?=&.]/g, '-')
      await page.goto(base + '#/' + path)
      await page.waitForTimeout(name === 'atlas' ? 2800 : name === 'current-affairs' ? 3500 : 1100)
      if (name === 'atlas' && !path.includes('?')) {
        const close = page.getByRole('button', { name: /close/i }).first()
        if (await close.isVisible().catch(() => false)) await close.click()
        await page.waitForTimeout(600)
      }
      if (state === 'running') {
        await page.goto(base + '#/focus')
        await page.waitForTimeout(600)
        await page.getByRole('button', { name: /^start focus/i }).click()
        await page.waitForTimeout(1600)
        if (name !== 'focus') {
          await page.goto(base + '#/' + name)
          await page.waitForTimeout(1100)
        }
      }
      if (state === 'palette') {
        await page.keyboard.press('Control+k')
        await page.waitForTimeout(500)
      }
      if (state === 'capture') {
        await page.keyboard.press('c')
        await page.waitForTimeout(600)
      }
      if (state === 'task') {
        await page.keyboard.press('n')
        await page.waitForTimeout(700)
      }
      if (state === 'shortcuts') {
        await page.keyboard.press('Shift+?')
        await page.waitForTimeout(600)
      }
      if (state === 'immersive') {
        await page.getByRole('button', { name: /immersive mode/i }).first().click()
        await page.waitForTimeout(1200)
      }
      // Any other state names a button to press first (e.g. current-affairs:Analytics).
      if (state && !['running', 'palette', 'capture', 'task', 'shortcuts', 'immersive', 'bottom'].includes(state)) {
        await page.getByRole('button', { name: state, exact: true }).first().click()
        await page.waitForTimeout(700)
      }
      if (state === 'bottom') {
        await page.evaluate(() => {
          const el = document.querySelector('.stage-scroll')
          if (el && el.scrollHeight > el.clientHeight) el.scrollTo(0, el.scrollHeight)
          else window.scrollTo(0, document.body.scrollHeight)
        })
        await page.waitForTimeout(500)
      }
      await page.screenshot({ path: `${out}${size}-${scheme}-${file}${state ? '-' + state : ''}.png` })
      console.log(`${size}-${scheme}-${file}${state ? '-' + state : ''}`)
      if (state && state !== 'running' && state !== 'bottom') await page.keyboard.press('Escape')
      if (state === 'running') {
        await page.evaluate(async () => {
          const { useTimer } = await import('/src/timer/store.ts').catch(() => ({}))
          useTimer?.getState().stop({ discard: true })
        })
      }
    }
    await ctx.close()
  }
}
await browser.close()
