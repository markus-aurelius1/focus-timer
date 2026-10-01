/** Rendered control boundaries/glyphs: text-token contrast does not cover these. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = new URL('./out/job4/controls/', import.meta.url)
mkdirSync(out, { recursive: true })
const checks = [], errors = []
const ratio = (a, b) => {
  const luminance = s => {
    const rgb = s.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const width of [375, 768, 1366, 1920]) for (const theme of ['light', 'dark']) {
    const tag = `${width}-${theme}`
    const ctx = await browser.newContext({ viewport: { width, height: width < 1000 ? 1024 : 1080 }, colorScheme: theme })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    const check = (name, ok, evidence) => { assert(ok, `${tag} ${name}: ${JSON.stringify(evidence)}`); checks.push({ tag, name, evidence }); console.log(`PASS ${tag} ${name}`) }
    await prepare(page, base, { sample: false, route: '#/tasks?view=inbox' })
    const quick = page.getByRole('textbox', { name: /new task/i })
    await quick.fill('Neutral contrast fixture'); await quick.press('Enter')
    const box = page.getByRole('checkbox', { name: 'Complete “Neutral contrast fixture”', exact: true })
    await box.waitFor()
    const boundary = await box.evaluate(el => {
      let parent = el.parentElement, bg
      while (parent && (!bg || bg === 'rgba(0, 0, 0, 0)')) { bg = getComputedStyle(parent).backgroundColor; parent = parent.parentElement }
      const bounds = el.getBoundingClientRect()
      return { border: getComputedStyle(el).borderTopColor, bg, width: bounds.width, height: bounds.height }
    })
    check('neutral checkbox boundary ≥3:1', ratio(boundary.border, boundary.bg) >= 3, boundary)
    check('checkbox target ≥24px', boundary.width >= 24 && boundary.height >= 24, boundary)
    await box.click()
    await page.waitForTimeout(1100)
    await page.goto(base + '#/tasks?view=done')
    const completed = page.getByRole('checkbox', { name: 'Mark “Neutral contrast fixture” as not done', exact: true })
    await completed.waitFor(); await page.waitForTimeout(400)
    const glyph = await completed.evaluate(el => ({ color: getComputedStyle(el.querySelector('svg')).color, bg: getComputedStyle(el).backgroundColor }))
    check('completed checkmark ≥3:1', ratio(glyph.color, glyph.bg) >= 3, glyph)
    await page.screenshot({ path: fileURLToPath(new URL(`${tag}-done.png`, out)) })
    await page.goto(base + '#/settings')
    const toggle = page.getByRole('switch', { name: '24-hour clock', exact: true })
    await toggle.waitFor()
    if (await toggle.getAttribute('aria-checked') === 'true') await toggle.click()
    await page.waitForTimeout(500)
    const off = await toggle.evaluate(el => ({ border: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el).backgroundColor, thumb: getComputedStyle(el.querySelector('span')).backgroundColor }))
    check('off switch outline ≥3:1', ratio(off.border, off.bg) >= 3, off)
    check('off switch thumb ≥3:1', ratio(off.thumb, off.bg) >= 3, off)
    await page.screenshot({ path: fileURLToPath(new URL(`${tag}-settings.png`, out)) })
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2) + '\n')
  console.log(`${checks.length} rendered contrast/target checks passed; no page errors`)
} finally { await browser.close() }
