/** Inspect settled Atlas and News for browser errors, including the cached map renderer workers. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const errors = [], network = [], checks = []
mkdirSync('tools/perf/out/product', { recursive: true })
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') (m.text().startsWith('Failed to load resource:') ? network : errors).push(m.text()) })
  await ctx.route('**/api/current-affairs*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, fetchedAt: new Date().toISOString(), sources: [], items: [] }) }))
  const map = async label => {
    await page.getByRole('application').waitFor()
    await page.waitForFunction(() => document.querySelectorAll('.atlas-name').length > 5)
    await page.waitForTimeout(5000)
    // Tiles use bitmaprenderer; read a copy so inspection does not request an incompatible context.
    const state = await page.evaluate(() => [...document.querySelectorAll('canvas')].map(c => {
      const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height
      const context = copy.getContext('2d'); context.drawImage(c, 0, 0)
      return { width: c.width, height: c.height, alpha: context.getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 4 === 3 && v > 0).length }
    }))
    assert(state.some(c => c.alpha > 1000), `${label}: map canvas has no painted tiles`)
    checks.push({ label, state })
    await page.screenshot({ path: `tools/perf/out/product/settled-${label}.png` })
  }
  await page.goto(base + '#/atlas'); await map('online')
  await page.goto(base + '#/current-affairs'); await page.getByRole('group', { name: 'Reading filter' }).waitFor()
  await page.goto(base + '#/settings'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
  await page.goto(base + '#/atlas'); await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await ctx.setOffline(true); await page.reload(); await map('offline')
  assert.deepEqual(errors, [])
  console.log('PASS settled online/offline map tiles, News and Settings; no console/runtime errors', JSON.stringify(checks))
} finally { await browser.close(); writeFileSync('tools/perf/out/product/health.json', JSON.stringify({ checks, errors, network }, null, 2)) }
