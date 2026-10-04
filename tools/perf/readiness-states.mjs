/** Retained product failure-state and World-sheet matrix, with isolated RSS fixtures and real Atlas assets. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const out = new URL('./out/final/states/', import.meta.url)
mkdirSync(out, { recursive: true })
const checks = [], errors = []
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ok = (tag, name, value) => { assert(value, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
try {
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) for (const theme of ['dark', 'light']) {
    const tag = `${width}-${theme}`, ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, hasTouch: width === 390, serviceWorkers: 'block', timezoneId: 'Asia/Kolkata' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`))
    let fail = false
    const fixture = { version: 1, fetchedAt: new Date(Date.now() - 7200000).toISOString(), sources: [{ sourceId: 'ie-explained', status: 'ok', count: 1 }, { sourceId: 'hindu-national', status: 'error', count: 0 }], items: [{ title: 'RBI banking regulation framework expands', url: 'https://indianexpress.com/article/readiness-fixture', publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', publishedAt: new Date().toISOString(), description: 'Publisher metadata only.' }] }
    await ctx.route('**/api/current-affairs*', async route => { await new Promise(r => setTimeout(r, 600)); await route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Unavailable fixture' } : fixture }) })
    const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: fileURLToPath(new URL(`${tag}-${name}.png`, out)) }) }
    const contained = async name => ok(tag, name + ' stays within viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight))
    await prepare(page, base, { route: '#/atlas?sheet=world' })
    await page.getByRole('application').waitFor()
    await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 10)
    await shot('world'); await contained('World map')
    await page.getByRole('button', { name: 'Search places', exact: true }).click()
    await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('zzzz-no-place-zzzz')
    ok(tag, 'empty Gazetteer offers no fabricated place', await page.getByRole('dialog', { name: 'Gazetteer', exact: true }).locator('li').count() === 0)
    await shot('empty-place-search'); await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Gazetteer', exact: true }).waitFor({ state: 'detached' })
    ok(tag, 'empty search dismissal restores trigger', await page.getByRole('button', { name: 'Search places', exact: true }).evaluate(el => el === document.activeElement))
    await page.goto(base + '#/atlas?place=invalid-place-id')
    await page.getByRole('application').waitFor()
    ok(tag, 'missing place leaves usable map without empty inspector', await page.locator('[data-inspector], .atlas-place-sheet').count() === 0)
    await page.goto(base + '#/current-affairs')
    await page.getByText('Loading trusted feeds…', { exact: true }).waitFor(); await shot('news-loading')
    await page.locator('[data-news-event]').waitFor()
    ok(tag, 'partial source failure retains article', await page.getByText('Some sources unavailable', { exact: true }).isVisible())
    ok(tag, 'stale feed is identified', await page.getByText('Stale feed', { exact: true }).isVisible())
    await shot('news-stale-partial'); await contained('News feed')
    await page.getByRole('button', { name: 'Search news', exact: true }).click()
    const query = page.getByRole('searchbox', { name: 'Search articles, topics or sources' })
    await query.fill('zzzz-no-article-zzzz')
    ok(tag, 'empty filter explains result', await page.getByText('No articles match these filters', { exact: true }).isVisible())
    await shot('news-empty-filter'); await query.press('Escape')
    fail = true
    await page.getByRole('button', { name: 'Refresh news', exact: true }).click()
    await page.getByRole('alert').waitFor()
    ok(tag, 'failed refresh retains previous metadata', await page.locator('[data-news-event]').count() === 1)
    await shot('news-refresh-error')
    await ctx.setOffline(true)
    await page.getByText(/Offline – cached feed/).waitFor()
    await shot('news-offline'); await contained('Offline News')
    await ctx.close()
  }
  ok('all', 'no uncaught runtime errors', errors.length === 0)
} finally {
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2))
  await browser.close()
}
