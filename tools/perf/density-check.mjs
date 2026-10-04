/** Content-first presentation acceptance: real map, RSS metadata fixtures, both themes and narrow touch layouts. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:4174/'
const out = new URL('./out/density/', import.meta.url)
mkdirSync(out, { recursive: true })
const now = new Date().toISOString()
const titles = ['RBI revises banking liquidity regulation framework', 'ISRO launches important lunar space mission', 'Supreme Court ruling on constitutional fundamental rights', 'Ramsar wetland conservation framework expands', 'Government scheme expands Ayushman Bharat coverage', 'New GDP series uses double deflation']
const fixture = { version: 1, fetchedAt: now, sources: [{ sourceId: 'ie-explained', status: 'ok', count: titles.length }], items: titles.map((title, i) => ({ title, url: `https://indianexpress.com/article/density-${i}`, sourceId: 'ie-explained', publisher: 'Indian Express', section: 'Explained', publishedAt: now, description: 'Publisher RSS excerpt with context and a link to the full article.' })) }
const checks = [], metrics = [], errors = []
const ok = (tag, name, value) => { assert(value, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 900]]) for (const theme of ['light', 'dark']) {
    const tag = `${width}-${theme}`, ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1024, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`))
    await ctx.route('**/api/current-affairs*', route => route.fulfill({ json: fixture }))
    const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: fileURLToPath(new URL(`${tag}-${name}.png`, out)) }) }
    const noOverflow = async () => ok(tag, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await prepare(page, base)
    const contrast = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement)
      const luminance = value => {
        const rgb = value.trim().replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
      }
      return ['ink', 'ink-2', 'ink-3', 'accent', 'knowledge', 'success', 'danger'].flatMap(role => ['bg', 'surface', 'surface-2', 'surface-3'].map(surface => {
        const a = luminance(css.getPropertyValue(`--${role}`)), b = luminance(css.getPropertyValue(`--${surface}`))
        return { role, surface, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      }))
    })
    for (const { role, surface, ratio } of contrast) ok(tag, `${role} text contrast on ${surface} >= 4.5 (${ratio.toFixed(2)})`, ratio >= 4.5)
    await page.getByRole('application').waitFor()
    const map = await page.locator('[data-atlas-surface]').boundingBox(), top = await page.locator('.atlas-top-controls').boundingBox(), zoom = await page.locator('.atlas-toolbar').boundingBox()
    const shellHeight = width < 600 ? 108 : 56
    ok(tag, 'compact shell reserves only required navigation space', Math.abs(map.height - (height - shellHeight)) < 2)
    const navigation = await page.locator('.product-nav').boundingBox()
    ok(tag, 'primary navigation recomposes for mobile', width < 600 ? Math.abs(navigation.height - 56) < 2 && Math.abs(navigation.y + navigation.height - height) < 2 : navigation.y < 56)
    ok(tag, 'primary navigation retains 44px touch targets', await page.locator('.product-nav button').evaluateAll(buttons => buttons.length === 2 && buttons.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })))
    ok(tag, 'one compact map control row and no utility dock', top.height <= 48 && top.width <= 224 && await page.locator('.atlas-utilities, .atlas-idle-actions').count() === 0)
    const coverage = (top.width * top.height + zoom.width * zoom.height) / (map.width * map.height)
    ok(tag, 'default controls cover less than 8% of map', coverage < .08)
    ok(tag, 'map controls retain 44px touch targets', await page.locator('[data-map-ui] button').evaluateAll(buttons => buttons.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })))
    await shot('atlas'); await noOverflow()
    const options = page.getByRole('button', { name: 'Map options', exact: true })
    await options.click()
    const menu = page.getByRole('dialog', { name: 'Map options', exact: true }), menuBox = await menu.boundingBox()
    ok(tag, 'map options remain inside viewport', menuBox.x >= 0 && menuBox.x + menuBox.width <= width)
    for (const name of ['Legend', 'Fit the map', 'PYQ hotspots', 'Atlas tools', 'Full-screen map (Shift+F)']) ok(tag, `${name} retained in options`, await menu.getByRole('button', { name, exact: true }).isVisible())
    await shot('map-options'); await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' })
    ok(tag, 'map menu restores trigger focus', await options.evaluate(el => el === document.activeElement))
    await page.getByRole('navigation', { name: 'Workspaces', exact: true }).getByRole('button', { name: 'News', exact: true }).click()
    const rows = page.locator('[data-news-event]'); await rows.first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(400)
    const news = await rows.evaluateAll(rows => ({ firstY: rows[0].getBoundingClientRect().y, fullyVisible: rows.filter(el => el.getBoundingClientRect().bottom <= document.querySelector('.stage').getBoundingClientRect().bottom).length, heights: rows.map(el => el.getBoundingClientRect().height) }))
    console.log(tag, JSON.stringify(news))
    await shot('news')
    ok(tag, 'articles start within first 190px', news.firstY <= 190)
    ok(tag, 'at least three complete articles immediately visible', news.fullyVisible >= 3)
    ok(tag, 'search is collapsed and Sources stays secondary', await page.getByRole('searchbox').count() === 0 && (width < 1024 ? !await page.getByRole('button', { name: 'Sources', exact: true }).isVisible() : await page.locator('.ca-mobile-tabs').evaluate(el => el.getBoundingClientRect().width >= 170 && el.getBoundingClientRect().width <= 190)))
    if (width >= 1024) ok(tag, 'article collection uses remaining desktop width', await page.locator('.ca-main').evaluate(el => el.getBoundingClientRect().width >= document.querySelector('.ca-workspace').getBoundingClientRect().width - 254))
    await shot('news'); await noOverflow()
    await page.getByRole('button', { name: 'Search news', exact: true }).click()
    const search = page.getByRole('searchbox', { name: 'Search articles, topics or sources' })
    ok(tag, 'expanded search receives focus', await search.evaluate(el => el === document.activeElement))
    await search.fill('ISRO'); ok(tag, 'expanded search filters articles', await rows.count() === 1)
    await search.press('Escape'); await search.waitFor({ state: 'detached' })
    ok(tag, 'Escape collapses search and restores full list and focus', await rows.count() === titles.length && await page.getByRole('button', { name: 'Search news', exact: true }).evaluate(el => el === document.activeElement))
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const filters = page.getByRole('dialog', { name: 'News filters', exact: true })
    await filters.waitFor(); await filters.getByRole('button', { name: 'Sources', exact: true }).click()
    ok(tag, 'sources are contextual inside filters', await filters.getByRole('region', { name: 'News sources' }).isVisible())
    await shot('news-filters'); await page.keyboard.press('Escape'); await filters.waitFor({ state: 'detached' })
    ok(tag, 'filter dismissal restores trigger focus', await page.getByRole('button', { name: 'Filters', exact: true }).evaluate(el => el === document.activeElement))
    metrics.push({ tag, shellHeight, mapHeight: map.height, mapControlCoverage: coverage, firstArticleY: news.firstY, completeArticles: news.fullyVisible, articleHeights: news.heights })
    await ctx.close()
  }
  ok('all', 'no page errors', errors.length === 0)
} finally {
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, metrics, errors }, null, 2))
  await browser.close()
}
