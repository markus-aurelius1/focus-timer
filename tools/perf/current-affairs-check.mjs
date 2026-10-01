/** Focused production fixture QA: four requested layouts daily workflow, persistence and the actual news Workbox offline cache. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const dist = resolve(fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/current-affairs-workspace/', import.meta.url)
mkdirSync(out, { recursive: true })
const fetchedAt = new Date().toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const publishedAt = today + 'T06:00:00Z', yesterday = new Date(Date.parse(publishedAt) - 86400000).toISOString()
const stateKey = 'tars.current-affairs.state.v1'
const row = (title, sourceId, publisher, url) => ({ title, sourceId, publisher, url, section: 'Explained', description: '', publishedAt })
const fixture = { version: 1, fetchedAt, sources: [{ sourceId: 'ie-explained', status: 'ok', count: 5 }, { sourceId: 'sebi', status: 'failed', count: 0 }], items: [
  row('RBI revises banking liquidity regulation framework', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-rbi'),
  row('RBI revises banking liquidity regulation framework today', 'rbi-notifications', 'RBI', 'https://www.rbi.org.in/fixture'),
  row('Ramsar protected area conservation expands', 'guardian-environment', 'Guardian', 'https://www.theguardian.com/fixture-environment'),
  row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-space'),
  { ...row('Supreme Court ruling on constitutional fundamental rights', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-rights'), section: 'National', description: 'Feed supplied excerpt about the constitutional ruling.' },
  { ...row('Government scheme expands Ayushman Bharat coverage', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-health'), section: 'National' },
  { ...row('RBI monetary policy holds repo rate', 'mint-economy', 'Mint', 'https://www.livemint.com/fixture-old'), publishedAt: yesterday, section: 'Economy' },
  { ...row('ISRO launches new space mission', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-undated'), publishedAt: null },
  row('Cricket score: India wins', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-cricket'),
] }
let mode = 'ok'
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/api/current-affairs') {
    const state = mode
    if (state === 'slow') await new Promise(r => setTimeout(r, 1000))
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.writeHead(state === 'fail' ? 503 : 200)
    res.end(JSON.stringify(state === 'fail' ? { error: 'Fixture failure' } : state === 'stale' ? { ...fixture, fetchedAt: new Date(Date.now() - 7200000).toISOString() } : fixture)); return
  }
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)))
  if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream')
  res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const checks = [], errors = []
const check = (tag, name, evidence = true) => { assert(evidence, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
try {
  for (const width of process.argv.includes('--workbox-only') ? [] : [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = width + '-' + theme, desktop = width >= 1024
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await ctx.route('https://**/*fixture*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Original publisher fixture</h1>' }))
    const rows = page.locator('[data-news-event]'), reading = page.getByRole('group', { name: 'Reading filter' }), subject = page.getByRole('group', { name: 'Subject filter' })
    const setSubject = async name => { if (desktop) await subject.getByRole('button', { name, exact: true }).click(); else await page.getByLabel('Subject filter', { exact: true }).selectOption(name) }
    const inspect = async title => {
      await rows.filter({ hasText: title }).getByRole('button', { name: /^Inspect / }).click()
      if (!desktop) await page.getByRole('dialog', { name: 'Article context' }).waitFor()
      return desktop ? page.locator('[data-desktop-inspector]') : page.getByRole('dialog', { name: 'Article context' })
    }
    const back = async () => { if (!desktop) { await page.getByRole('button', { name: '← Back', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }) } }
    const overflow = async () => {
      check(tag, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[role=dialog]')].every(e => e.scrollWidth <= e.clientWidth)))
    }
    mode = 'fail'
    await prepare(page, base, { sample: false, route: '#/current-affairs' })
    await page.getByRole('alert').waitFor()
    check(tag, 'first-load failure is visible')
    if (!desktop) {
      const nav = page.getByRole('navigation', { name: 'Main', exact: true })
      check(tag, 'six bottom-navigation targets remain usable', await nav.getByRole('button').count() === 6 && await nav.getByRole('button').evaluateAll(buttons => buttons.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.x >= 0 && r.right <= innerWidth })))
      await nav.getByRole('button', { name: 'Tasks', exact: true }).click()
      await nav.getByRole('button', { name: 'News', exact: true }).click()
    } else {
      await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Tasks', exact: true }).click()
      await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'News', exact: true }).click()
    }
    check(tag, 'News navigation reaches workspace', page.url().endsWith('#/current-affairs'))
    await page.getByRole('alert').waitFor()
    mode = 'slow'; await page.getByRole('button', { name: 'Refresh news' }).click()
    await page.getByText('Loading trusted feeds…', { exact: true }).waitFor()
    check(tag, 'loading status')
    await rows.first().waitFor()
    check(tag, 'today edition has five events, clustering/noise preserved', await rows.count() === 5 && await page.getByLabel('Edition date').inputValue() === today)
    check(tag, 'daily progress and unread time', (await page.locator('[data-edition-progress]').innerText()) === '0 / 5 read' && (await page.locator('[data-edition-summary]').innerText()).includes('min left today'))
    if (desktop) check(tag, '42/58 desktop split and independent pane scrolling', await page.evaluate(() => { const list = document.querySelector('[data-news-list]'), pane = document.querySelector('[data-desktop-inspector]'), a = list.getBoundingClientRect(), b = pane.getBoundingClientRect(); return a.right <= b.left + 2 && Math.abs(a.width / (a.width + b.width) - .42) < .02 && getComputedStyle(list).overflowY === 'auto' && getComputedStyle(pane).overflowY === 'auto' }))
    else check(tag, 'mobile starts with compact list only', await page.locator('[data-desktop-inspector]').count() === 0 && await page.getByRole('dialog').count() === 0)
    for (const value of ['Prelims', 'Mains', 'Both']) { await page.getByLabel('Exam filter').selectOption(value); check(tag, value + ' filter', await rows.count() > 0) }
    await page.getByLabel('Exam filter').selectOption('All')
    await setSubject('Environment')
    check(tag, 'subject filter', await rows.count() === 1)
    await setSubject('All subjects')
    await page.getByLabel('Publisher filter').selectOption('RBI')
    check(tag, 'publisher filter across cluster members', await rows.count() === 1)
    await page.getByLabel('Publisher filter').selectOption('All sources')
    const search = page.getByRole('searchbox')
    await search.fill('Ayushman')
    check(tag, 'client metadata search', await rows.count() === 1)
    await search.fill('')
    await reading.getByRole('button', { name: '★ Must Read', exact: true }).click()
    check(tag, 'Must Read is deterministic and selective', await rows.count() > 0 && await rows.count() < 5 && await rows.getByLabel('Must Read', { exact: true }).count() === await rows.count())
    await reading.getByRole('button', { name: 'All CA', exact: true }).click()
    for (const budget of [15, 30, 60]) {
      const button = page.getByRole('group', { name: 'Reading time budget' }).getByRole('button', { name: budget + ' min', exact: true })
      await button.click()
      check(tag, budget + ' min highest-value unread plan', await rows.count() > 0 && (await page.locator('[data-news-list]').innerText()).includes('min plan'))
      await button.click()
    }
    let pane = await inspect('RBI revises')
    check(tag, 'selection opens correct headline', (await pane.getByRole('heading', { level: 2 }).last().innerText()).startsWith('RBI revises'))
    check(tag, 'normal UI hides scores', await pane.locator('pre').count() === 0)
    await pane.getByRole('tab', { name: 'Related coverage', exact: true }).click()
    check(tag, 'related alternate original coverage', await pane.getByRole('link', { name: /RBI revises/ }).getAttribute('href') === 'https://indianexpress.com/article/fixture-rbi')
    await pane.getByRole('tab', { name: 'References', exact: true }).click()
    check(tag, 'exact reference only', await pane.getByRole('link', { name: /RBI · Official/ }).getAttribute('href') === 'https://www.rbi.org.in/')
    check(tag, 'no generic static search URLs', await page.locator('.ca-workspace a, [role=dialog] a').evaluateAll(links => links.every(a => !/google|[?&](search|q|query)=|\/search/.test(a.href))))
    await pane.getByRole('tab', { name: 'Overview', exact: true }).click()
    const original = pane.getByRole('link', { name: /Open original/ }), headline = await pane.getByRole('heading', { level: 2 }).last().innerText()
    check(tag, 'primary original link retains publisher URL and safe new tab', await original.getAttribute('href') === 'https://www.rbi.org.in/fixture' && await original.getAttribute('target') === '_blank' && (await original.getAttribute('rel')).includes('noopener'))
    const popupPromise = page.waitForEvent('popup'); await original.click(); const popup = await popupPromise; await popup.waitForLoadState(); await popup.close()
    check(tag, 'return from original retains selection', await pane.getByRole('heading', { level: 2 }).last().innerText() === headline)
    await pane.getByRole('button', { name: 'Mark as read', exact: true }).click()
    check(tag, 'mark read keeps current article', await pane.getByRole('heading', { level: 2 }).last().innerText() === headline)
    await pane.getByRole('button', { name: 'Save article', exact: true }).click()
    await pane.getByRole('tab', { name: 'Notes', exact: true }).click()
    await pane.getByLabel('Your notes').fill('Recall the monetary policy framework.')
    check(tag, 'read/save/note stored as personal fields only', await page.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); return s.version === 1 && Object.values(s.entries).some(e => e.readAt && e.savedAt && e.note) && Object.values(s.entries).every(e => Object.keys(e).every(k => ['readAt', 'savedAt', 'note'].includes(k))) }, stateKey))
    const sibling = await ctx.newPage()
    await sibling.goto(base + 'manifest.webmanifest')
    await sibling.evaluate(key => { const state = JSON.parse(localStorage.getItem(key)); for (const entry of Object.values(state.entries)) if (entry.note) entry.note = 'Note from another tab'; localStorage.setItem(key, JSON.stringify(state)) }, stateKey)
    await pane.getByLabel('Your notes').waitFor()
    await page.waitForFunction(() => document.querySelector('#ca-note')?.value === 'Note from another tab')
    check(tag, 'cross-tab personal state refreshes', await pane.getByLabel('Your notes').inputValue() === 'Note from another tab')
    await pane.getByLabel('Your notes').fill('Recall the monetary policy framework.')
    await sibling.close()
    await overflow()
    await back()
    check(tag, 'progress advances without losing selection', await page.locator('[data-edition-progress]').innerText() === '1 / 5 read')
    await page.reload(); await rows.first().waitFor()
    await reading.getByRole('button', { name: 'Saved', exact: true }).click()
    check(tag, 'saved/read survive reload', await rows.count() === 1 && (await rows.first().innerText()).includes('Read'))
    pane = await inspect('RBI revises')
    await pane.getByRole('tab', { name: 'Notes', exact: true }).click()
    check(tag, 'note survives reload', await pane.getByLabel('Your notes').inputValue() === 'Recall the monetary policy framework.')
    await pane.getByRole('button', { name: 'Mark unread', exact: true }).click()
    await pane.getByRole('button', { name: 'Unsave article', exact: true }).click()
    await back()
    check(tag, 'unread/unsave remove saved item', await rows.count() === 0)
    await reading.getByRole('button', { name: 'All CA', exact: true }).click()
    pane = await inspect('Ayushman')
    check(tag, 'empty references section is absent', await pane.getByRole('tab', { name: 'References' }).count() === 0)
    await back()
    pane = await inspect('Supreme Court')
    check(tag, 'feed excerpt is labelled separately', await pane.getByText('From the feed', { exact: true }).isVisible() && await pane.getByText('Feed supplied excerpt about the constitutional ruling.', { exact: true }).isVisible())
    await back()
    if (!desktop) {
      await page.evaluate(() => scrollTo(0, document.querySelector('[data-news-list]').getBoundingClientRect().top + scrollY))
      const before = await page.evaluate(() => scrollY)
      pane = await inspect('Ramsar'); await back()
      check(tag, 'mobile back restores same list scroll position', Math.abs(await page.evaluate(() => scrollY) - before) <= 2)
    }
    await page.getByRole('button', { name: 'Previous day', exact: true }).click()
    check(tag, 'previous edition by publication date', await rows.count() === 1 && (await rows.innerText()).includes('repo rate'))
    pane = await inspect('repo rate'); await pane.getByRole('button', { name: 'Mark as read', exact: true }).click(); await back()
    check(tag, 'daily completion', await page.locator('[data-edition-progress]').innerText() === 'Complete ✓')
    await page.getByRole('button', { name: 'Next day', exact: true }).click()
    check(tag, 'next day returns to today', await rows.count() === 5)
    await page.getByLabel('Edition date').fill('2026-01-01')
    check(tag, 'date picker with explicit empty edition', await page.getByText('No edition available for this date', { exact: true }).isVisible())
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await reading.getByRole('button', { name: 'Unread', exact: true }).click()
    await page.getByRole('button', { name: 'Study mode', exact: true }).click()
    const study = page.getByRole('dialog', { name: 'Study mode', exact: true }), studyTitle = study.getByRole('heading', { level: 2 }).last()
    await study.waitFor()
    const firstTitle = await studyTitle.innerText()
    await page.getByRole('dialog').evaluate(el => el.focus())
    await study.getByRole('button', { name: 'Mark as read', exact: true }).click()
    check(tag, 'study queue stays stable after mark read', await studyTitle.innerText() === firstTitle && (await study.innerText()).includes('1 / 5'))
    await study.getByRole('button', { name: 'Next →', exact: true }).click()
    check(tag, 'study next', await studyTitle.innerText() !== firstTitle)
    await study.getByRole('button', { name: '← Previous', exact: true }).click()
    check(tag, 'study previous', await studyTitle.innerText() === firstTitle)
    if (desktop) {
      await page.keyboard.press('j'); check(tag, 'J shortcut next', await studyTitle.innerText() !== firstTitle)
      await page.keyboard.press('ArrowUp'); check(tag, 'ArrowUp shortcut previous', await studyTitle.innerText() === firstTitle)
      await page.keyboard.press('k'); check(tag, 'K clamps at start', await studyTitle.innerText() === firstTitle)
      await page.keyboard.press('r'); check(tag, 'R toggles unread', await study.getByRole('button', { name: 'Mark as read', exact: true }).isVisible())
      await page.keyboard.press('s'); check(tag, 'S toggles save', await study.getByRole('button', { name: 'Unsave', exact: true }).isVisible())
      const opened = page.waitForEvent('popup'); await page.keyboard.press('o'); const tab = await opened; await tab.close(); check(tag, 'O opens publisher and keeps position', await studyTitle.innerText() === firstTitle)
      await page.keyboard.press('ArrowDown'); check(tag, 'ArrowDown shortcut next', await studyTitle.innerText() !== firstTitle)
    }
    while (await study.getByRole('button', { name: '← Previous', exact: true }).isEnabled()) await study.getByRole('button', { name: '← Previous', exact: true }).click()
    for (let i = 0; i < 5; i++) {
      const mark = study.getByRole('button', { name: 'Mark as read', exact: true })
      if (await mark.isVisible()) await mark.click()
      if (i < 4) await study.getByRole('button', { name: 'Next →', exact: true }).click()
    }
    check(tag, 'finish today through sequential study workflow', await study.getByText('Reading set complete ✓', { exact: true }).isVisible() && await page.locator('[data-edition-progress]').innerText() === 'Complete ✓')
    await overflow()
    await page.waitForTimeout(450); await page.screenshot({ path: fileURLToPath(new URL(tag + '-study.png', out)) })
    await study.getByRole('button', { name: 'Close', exact: true }).click(); await study.waitFor({ state: 'hidden' })
    await reading.getByRole('button', { name: 'All CA', exact: true }).click()
    if (desktop) {
      const before = await page.locator('[data-desktop-inspector] h2').innerText()
      await search.focus(); await page.keyboard.type('jrsko')
      check(tag, 'shortcuts do not intercept typing', await search.inputValue() === 'jrsko')
      await search.fill(''); pane = await inspect('RBI revises'); await pane.getByRole('tab', { name: 'Notes', exact: true }).click()
      const note = pane.getByLabel('Your notes'); await note.fill(''); await note.focus(); await page.keyboard.type('jrsko')
      check(tag, 'note typing does not trigger shortcuts', await note.inputValue() === 'jrsko')
      await pane.getByRole('tab', { name: 'Overview', exact: true }).click()
    }
    mode = 'stale'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText(/Stale feed/).waitFor()
    check(tag, 'stale feed timestamp remains explicit')
    await page.evaluate(async data => { const cache = await caches.open('current-affairs-fixture'); await cache.put('/api/current-affairs', new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })) }, fixture)
    await ctx.setOffline(true); await page.getByText(/Offline – cached feed/).waitFor(); await page.waitForTimeout(400)
    check(tag, 'offline cached metadata renders', await rows.count() === 5)
    await overflow()
    await ctx.setOffline(false); mode = 'ok'; await page.waitForTimeout(1400)
    for (const dismiss of await page.getByRole('button', { name: 'Dismiss', exact: true }).all()) await dismiss.click()
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(450)
    for (const dismiss of await page.getByRole('button', { name: 'Dismiss', exact: true }).all()) await dismiss.click()
    await page.waitForTimeout(450)
    await page.screenshot({ path: fileURLToPath(new URL(tag + '.png', out)), fullPage: true })
    if (!desktop) { await inspect('RBI revises'); await page.waitForTimeout(450); await page.screenshot({ path: fileURLToPath(new URL(tag + '-detail.png', out)) }); await back() }
    await page.goto(base + '#/current-affairs?debug=1'); await rows.first().waitFor()
    await inspect('RBI revises'); await page.locator('pre').first().waitFor()
    check(tag, 'debug preserves raw classifier/priority evidence', (await page.locator('pre').first().innerText()).includes('mustReadScore') && await page.getByText('Debug · 1 rejected links', { exact: true }).count() === 1)
    await ctx.close()
  }
  mode = 'ok'
  const ctx = await browser.newContext(), page = await ctx.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') console.log('Browser:', msg.text()) })
  await prepare(page, base, { sample: false, route: '#/current-affairs' })
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 20000 })
  await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  await page.waitForFunction(async () => !!await (await caches.open('current-affairs-v1')).match('/api/current-affairs'))
  check('Workbox', 'successful API response cached')
  // A 503 cannot replace the last success.
  mode = 'fail'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByRole('alert').waitFor()
  check('Workbox', '503 preserves last successful response', await page.evaluate(async () => (await (await (await caches.open('current-affairs-v1')).match('/api/current-affairs')).json()).fetchedAt) === fixture.fetchedAt)
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.clearBrowserCache'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await ctx.setOffline(true); await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  await page.getByText(/Offline – cached feed|Cached feed – offline/).waitFor()
  check('Workbox', 'offline reload with HTTP cache disabled shows today cached events', await page.locator('[data-news-event]').count() === 5)
  await ctx.close()
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2) + '\n')
  console.log(`${checks.length} Current Affairs checks passed; no page errors`)
} catch (error) { for (const ctx of browser.contexts()) for (const page of ctx.pages()) { await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)), fullPage: true }).catch(() => {}); console.log((await page.locator('body').innerText()).slice(-4000)) } throw error } finally { await browser.close(); await new Promise(r => server.close(r)) }
