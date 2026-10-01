/** Repeated headless fullscreen exits must restore Atlas chrome and the requested emulated viewport. */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4174/'
const errors = []
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push(e.message))
await prepare(page, base, { sample: true })
for (let i = 0; i < 4; i++) {
  await page.goto(base + '#/atlas'); await page.waitForTimeout(1000)
  await page.getByRole('button', { name: /full-screen map/i }).first().click()
  await page.waitForTimeout(700); await page.keyboard.press('Escape'); await page.waitForTimeout(450)
  await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen() })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(base + '#/focus'); await page.waitForTimeout(1500)
  const state = await page.evaluate(() => ({ hash: location.hash, width: innerWidth, height: innerHeight, chrome: document.documentElement.dataset.chrome, fs: !!document.fullscreenElement, collapsed: document.querySelector('#sidebar')?.dataset.collapsed, sidebar: document.querySelector('#sidebar') && getComputedStyle(document.querySelector('#sidebar')).display, buttons: [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((b) => /sidebar/i.test(b)) }))
  console.log(state)
  if (state.fs || state.chrome !== undefined || state.width !== 1920 || state.height !== 1080 || state.sidebar !== 'flex') throw new Error('Fullscreen exit did not restore Focus chrome and viewport')
  await page.screenshot({ path: `tools/perf/out/fullscreen-${i}.png` })
}
await browser.close()
if (errors.length) throw new Error(errors.join(' | '))
console.log('PASS 4 repeated fullscreen exits and no page errors')
