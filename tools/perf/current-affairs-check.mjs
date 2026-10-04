/** Focused production fixture QA: four requested layouts daily workflow, persistence and the actual news Workbox offline cache. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const dist = resolve(fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/current-affairs-direct/', import.meta.url)
mkdirSync(out, { recursive: true })
const fetchedAt = new Date().toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const publishedAt = new Date(Date.now() - 2 * 3600000).toISOString(), yesterday = new Date(Date.now() - 30 * 3600000).toISOString()
const pastYear = `${Number(today.slice(0, 4)) - 1}-01-15`, pastMonth = `${today.slice(0, 4)}-01-15`
const stateKey = 'tars.current-affairs.state.v1'
const row = (title, sourceId, publisher, url) => ({ title, sourceId, publisher, url, section: 'Explained', description: '', publishedAt })
const fixture = { version: 1, fetchedAt, sources: [{ sourceId: 'ie-explained', status: 'ok', count: 5 }, { sourceId: 'ht-india', status: 'failed', count: 0 }], items: [
  { ...row('RBI revises banking liquidity regulation framework', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-rbi'), thumbnailUrl: 'https://images.example.org/fixture-thumbnail.jpg' },
  row('RBI revises banking liquidity regulation framework today', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-rbi'),
  row('RBI master circular on credit facilities', 'rbi-notifications', 'RBI', 'https://www.rbi.org.in/fixture-old-circular'),
  { ...row('Ramsar protected area conservation expands', 'guardian-environment', 'Guardian', 'https://www.theguardian.com/fixture-environment'), thumbnailUrl: 'https://images.example.org/broken.jpg' },
  row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-space'),
  { ...row('Supreme Court ruling on constitutional fundamental rights', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-rights'), section: 'National', description: 'Feed supplied excerpt about the constitutional ruling.' },
  { ...row('Government scheme expands Ayushman Bharat coverage', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-health'), section: 'National' },
  { ...row('RBI monetary policy holds repo rate', 'mint-economy', 'Mint', 'https://www.livemint.com/fixture-old'), publishedAt: yesterday, section: 'Economy' },
  { ...row('ISRO launches new space mission', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-undated'), publishedAt: null },
  { ...row('New GDP series uses double deflation', 'ie-economy', 'Indian Express', 'https://indianexpress.com/article/fixture-gdp'), section: 'Economy' },
  { ...row('UPSC Key: Poompuhar, NCERT Textbooks and Article 370', 'ie-upsc', 'Indian Express', 'https://indianexpress.com/article/fixture-key'), section: 'UPSC Current Affairs' },
  { ...row('El Niño-driven wildfires threaten orangutan habitat', 'guardian-environment', 'Guardian', 'https://www.theguardian.com/fixture-wildfire'), thumbnailUrl: 'https://images.example.org/fixture-wildfire.jpg' },
  { ...row('WHO public health vaccination framework expands', 'ht-science', 'Hindustan Times', 'https://www.hindustantimes.com/fixture-recent-prior-day'), publishedAt: new Date(Date.now() - 23 * 3600000).toISOString() },
  row('Cricket score: India wins', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-cricket'),
  { ...row('Ramsar wetland conservation framework expands', 'dte-news', 'Down To Earth', 'https://www.downtoearth.org.in/fixture-past-year'), publishedAt: pastYear + 'T06:00:00Z' },
  { ...row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-past-month'), publishedAt: pastMonth + 'T06:00:00Z' },
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
    res.end(JSON.stringify(state === 'fail' ? { error: 'Fixture failure' } : state === 'stale' ? { ...fixture, fetchedAt: new Date(Date.now() - 7200000).toISOString() } : state === 'trimmed' ? { ...fixture, items: fixture.items.filter(i => i.publishedAt === publishedAt) } : fixture)); return
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
    const tag = width + '-' + theme
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await ctx.route('https://**/*fixture*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Original publisher fixture</h1>' }))
    await ctx.route('https://images.example.org/**', route => route.request().url().includes('broken') ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#bac9c9"/><path d="M0 100L65 20L120 100Z" fill="#647b6f"/></svg>' }))
    const rows = page.locator('[data-news-event]'), reading = page.getByRole('group', { name: 'Reading filter' })
    const queue = async name => reading.getByRole('button', { name, exact: true }).click()
    const showFilters = async () => { const b = page.getByRole('button', { name: 'Filters', exact: true }); if (await b.getAttribute('aria-expanded') === 'false') await b.click() }
    const hideFilters = async () => { const b = page.getByRole('button', { name: 'Filters', exact: true }); if (await b.getAttribute('aria-expanded') === 'true') await b.click() }
    const rbi = () => rows.filter({ hasText: 'RBI revises' })
    const read = row => row.getByRole('button', { name: /^Mark (?:as read|unread):/ })
    const save = row => row.getByRole('button', { name: /^(?:Save|Unsave) / })
    const overflow = async () => check(tag, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    mode = 'fail'
    await prepare(page, base, { sample: false, route: '#/current-affairs' }); await page.getByRole('alert').waitFor()
    check(tag, 'first-load failure is visible')
    if (width === 375) check(tag, 'bottom navigation remains usable', await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button').evaluateAll(buttons => buttons.length === 3 && buttons.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.x >= 0 && r.right <= innerWidth })))
    mode = 'slow'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor(); check(tag, 'loading status')
    await rows.first().waitFor(); mode = 'ok'
    check(tag, 'only three views and To be Read is default', await reading.getByRole('button').count() === 3 && await reading.getByRole('button', { name: 'To be Read', exact: true }).getAttribute('aria-pressed') === 'true')
    check(tag, 'nine rolling-24-hour articles including previous calendar day', await rows.count() === 9 && await rows.filter({ hasText: 'vaccination' }).count() === 1 && await rows.filter({ hasText: 'repo rate' }).count() === 0)
    check(tag, 'removed official feed is absent', await page.locator('a[href*="rbi.org.in"]').count() === 0)
    check(tag, 'single list without article popup or Study mode', await page.getByRole('dialog').count() === 0 && await page.getByRole('button', { name: 'Study mode' }).count() === 0)
    check(tag, 'archive is a top-corner header action', await page.locator('.ca-workspace header').getByRole('button', { name: 'Archive', exact: true }).count() === 1)
    check(tag, 'filters and analytics start collapsed', !await page.locator('#ca-filters').isVisible() && await page.locator('[data-reading-analytics]').count() === 0)
    await rbi().locator('[data-related-coverage] summary').click(); check(tag, 'grouped alternate original link', await rbi().locator('[data-related-coverage] a').getAttribute('href') === 'https://www.thehindu.com/fixture-rbi'); await rbi().locator('[data-related-coverage] summary').click()
    await page.waitForFunction(() => { const img = document.querySelector('[data-news-event] img'); return img && img.complete && img.naturalWidth > 0 })
    check(tag, 'RSS thumbnail loads lazily', await rbi().locator('img').getAttribute('loading') === 'lazy')
    await rows.filter({ hasText: 'Ramsar' }).scrollIntoViewIfNeeded(); await rows.filter({ hasText: 'Ramsar' }).locator('img').waitFor({ state: 'detached' }); check(tag, 'broken image disappears')
    await showFilters()
    for (const exam of ['Prelims', 'Mains', 'Both']) { await page.getByLabel('Exam filter').selectOption(exam); check(tag, exam + ' excludes unsupported curated coverage', await rows.count() > 0 && await rows.filter({ hasText: 'UPSC Key' }).count() === 0) }
    await page.getByLabel('Exam filter').selectOption('All'); await page.getByLabel('Subject filter').selectOption('Economy'); check(tag, 'subject filter', await rows.count() >= 1)
    await hideFilters(); check(tag, 'hidden filters stay resettable', await page.getByRole('button', { name: 'Reset filters', exact: true }).isVisible()); await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
    await showFilters(); await page.getByLabel('Publisher filter').selectOption('The Hindu'); check(tag, 'publisher filter includes grouped alternate coverage', await rbi().count() === 1); await page.getByLabel('Publisher filter').selectOption('All sources')
    for (const budget of [15, 30, 60]) { const b = page.getByRole('button', { name: budget + ' min', exact: true }); await b.click(); check(tag, budget + ' minute unread plan', await rows.count() > 0 && (await page.locator('[data-news-list]').innerText()).includes('min plan')); await b.click() }
    await hideFilters()
    const search = page.getByLabel('Search articles, topics or sources'); await search.fill('GDP'); check(tag, 'metadata search', await rows.count() === 1); await search.fill(''); await search.focus(); await page.keyboard.type('jrsko'); check(tag, 'typing is uninterrupted', await search.inputValue() === 'jrsko'); await search.fill('')
    const original = rbi().locator('[data-news-original]'); check(tag, 'direct safe original publisher link', await original.getAttribute('target') === '_blank' && (await original.getAttribute('rel')).includes('noopener'))
    await original.scrollIntoViewIfNeeded(); const position = await page.evaluate(() => scrollY), wait = page.waitForEvent('popup'); await original.click(); const publisher = await wait; await publisher.waitForLoadState(); await publisher.close(); check(tag, 'return preserves list position', Math.abs(await page.evaluate(() => scrollY) - position) <= 2)
    const unreadWeight = await rbi().locator('h3').evaluate(el => getComputedStyle(el).fontWeight)
    await read(rbi()).click(); check(tag, 'marking done moves out of To be Read', await rows.count() === 8 && await rbi().count() === 0)
    await queue('Read'); check(tag, 'read article moves into Read', await rows.count() === 1 && await rbi().count() === 1)
    check(tag, 'read typography is lighter', Number(await rbi().locator('h3').evaluate(el => getComputedStyle(el).fontWeight)) < Number(unreadWeight))
    await save(rbi()).click(); check(tag, 'saving a read article moves it out of Read', await rows.count() === 0)
    await queue('Saved'); check(tag, 'Saved owns a read saved article', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    await page.reload(); await rows.first().waitFor(); check(tag, 'reload defaults to pending with read/save persisted', await rows.count() === 8)
    await queue('Saved'); check(tag, 'read saved state survives reload', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    const other = await ctx.newPage(); await other.goto(base); await other.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); s.entries['https://indianexpress.com/article/fixture-rbi'].note = 'Legacy note preserved'; localStorage.setItem(key, JSON.stringify(s)) }, stateKey); await other.close(); await page.waitForTimeout(100)
    await save(rbi()).click(); await queue('Read'); await read(rbi()).click(); await queue('To be Read'); check(tag, 'unsave and unread restore pending', await rows.count() === 9)
    check(tag, 'legacy notes survive new actions', await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-rbi'].note, stateKey) === 'Legacy note preserved')
    await save(rbi()).click(); await queue('Saved'); await read(rbi()).click(); check(tag, 'marking saved article read keeps it in Saved', await rows.count() === 1)
    await page.getByRole('button', { name: 'Analytics', exact: true }).click()
    check(tag, 'analytics deduplicates related links and includes saved read items', await page.locator('[data-metric="Articles read"]').innerText() === '1' && await page.locator('[data-metric="Articles saved"]').innerText() === '1')
    check(tag, 'new reading actions count immediately in day week month and streak', (await page.locator('[data-reading-analytics]').innerText()).includes('Read today: 1') && await page.locator('[data-metric="Read this week"]').innerText() === '1' && await page.locator('[data-metric="Read this month"]').innerText() === '1' && await page.locator('[data-metric="Reading streak"]').innerText() === '1 day')
    check(tag, 'analytics has activity subject and time evidence', await page.getByRole('img', { name: /read/ }).count() === 1 && await page.getByText('Read by subject', { exact: true }).count() === 1 && (await page.locator('[data-reading-analytics]').innerText()).includes('not measured time'))
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-analytics.png', out)), fullPage: true }); await page.getByRole('button', { name: 'Analytics', exact: true }).click()
    await rbi().getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'removing saved article hides it immediately', await rows.count() === 0)
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); check(tag, 'Undo restores saved article and progress', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    await queue('To be Read'); const gdp = rows.filter({ hasText: 'GDP' }); await gdp.getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'remove pending persists ignoredAt', await rows.count() === 7 && await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-gdp'].ignoredAt > 0, stateKey))
    await page.reload(); await rows.first().waitFor(); check(tag, 'removed article stays absent after reload', await rows.count() === 7 && await rows.filter({ hasText: 'GDP' }).count() === 0)
    await page.getByRole('button', { name: 'Archive', exact: true }).click(); check(tag, 'archive excludes every rolling-Today item', await rows.count() === 4 && await rbi().count() === 0 && await rows.filter({ hasText: 'vaccination' }).count() === 0)
    check(tag, 'archive starts newest first with undated last', (await rows.first().innerText()).includes('repo rate') && (await rows.last().innerText()).includes('Undated'))
    await showFilters()
    for (const grouping of ['Daily', 'Weekly', 'Monthly', 'Yearly']) { await page.getByLabel('Archive grouping').selectOption(grouping); const options = await page.getByLabel('Archive period').locator('option').count(); check(tag, grouping + ' archive filters are available', options > 1) }
    await page.getByLabel('Archive period').selectOption(pastYear.slice(0, 4)); check(tag, 'prior year filtering', await rows.count() === 1 && (await rows.innerText()).includes('Down To Earth')); await page.getByRole('button', { name: 'Reset filters', exact: true }).click(); await hideFilters()
    const old = rows.filter({ hasText: 'repo rate' }); await old.getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'archive removal hides irrelevant older item', await rows.count() === 3)
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click(); check(tag, 'archive Undo restores original ordering', (await rows.first().innerText()).includes('repo rate'))
    await rows.filter({ hasText: 'Down To Earth' }).getByRole('button', { name: /^Save / }).click(); await queue('Saved'); check(tag, 'prior-year saved item is accessible in Archive', await rows.count() === 1)
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-archive.png', out)), fullPage: true })
    mode = 'trimmed'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor({ state: 'hidden' }); await page.reload(); await page.getByRole('button', { name: 'Archive', exact: true }).click(); await queue('Saved'); await rows.first().waitFor(); check(tag, 'old saved metadata survives feed omission and reload', (await rows.innerText()).includes('Down To Earth'))
    await page.getByRole('button', { name: 'Back to Today', exact: true }).click(); check(tag, 'Back restores Today pending queue', await rows.count() === 7)
    await page.getByRole('button', { name: 'Short notes', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Short notes' }), note = dialog.getByLabel('Short note')
    check(tag, 'small notes Sheet has short limit and disabled blank save', await note.getAttribute('maxlength') === '300' && !await dialog.getByRole('button', { name: 'Save note', exact: true }).isEnabled())
    await note.fill('x'.repeat(350)); check(tag, 'notes enforce 300 characters', (await note.inputValue()).length === 300)
    const text = 'A short connection: <script>window.bad=1</script> & constitutional rights.'
    await note.fill(text); await dialog.getByRole('button', { name: 'Save note', exact: true }).click(); await dialog.locator('[data-sticky-note]').waitFor()
    const notesState = await page.evaluate(() => JSON.parse(localStorage.getItem('tars.current-affairs.notes.v1'))), savedNote = Object.values(notesState.entries)[0]
    check(tag, 'saved note has immutable system date and user text only', savedNote.text === text && savedNote.createdDate === today && savedNote.createdAt > 0 && Object.keys(savedNote).length === 4)
    check(tag, 'note content is escaped', await page.evaluate(() => !window.bad) && await dialog.locator('script').count() === 0)
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-notes.png', out)), fullPage: true })
    await page.evaluate(() => { window.print = () => { window.__notesPrintCalled = true } }); await dialog.getByRole('button', { name: 'Print notes', exact: true }).click(); await page.emulateMedia({ media: 'print' })
    check(tag, 'print action contains only dated notes', await page.evaluate(() => window.__notesPrintCalled && getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(document.querySelector('#root')).display === 'none' && getComputedStyle(document.querySelector('.ca-print-root')).display === 'block' && document.querySelector('.ca-print-root').textContent.includes('<script>')))
    if (width === 1366 && theme === 'light') await page.pdf({ path: fileURLToPath(new URL('notes-print.pdf', out)), format: 'A4', printBackground: true })
    await page.evaluate(() => dispatchEvent(new Event('afterprint'))); await page.emulateMedia({ media: 'screen' }); check(tag, 'print cleanup restores the app', await page.evaluate(() => !document.body.classList.contains('ca-printing-notes')))
    await dialog.getByRole('button', { name: /^Remove note from/ }).click(); check(tag, 'note removal hides it', await dialog.locator('[data-sticky-note]').count() === 0)
    // Undo toast is behind the modal. Close it before restoring through the standard toast action.
    await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Undo', exact: true }).last().click(); await page.getByRole('button', { name: 'Short notes', exact: true }).click(); check(tag, 'note Undo preserves creation date', await page.getByRole('dialog').locator('[data-sticky-note] time').getAttribute('datetime') === savedNote.createdDate)
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); await page.reload(); await rows.first().waitFor(); await page.getByRole('button', { name: 'Short notes', exact: true }).click(); check(tag, 'dated notes survive reload', (await page.getByRole('dialog').locator('[data-sticky-note]').innerText()).includes('constitutional rights')); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    mode = 'stale'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText(/Stale feed/).waitFor(); check(tag, 'stale metadata is explicit')
    await ctx.setOffline(true); await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByRole('alert').waitFor(); check(tag, 'offline preserves pending queue and state', await rows.count() === 7); await overflow()
    await ctx.setOffline(false); mode = 'ok'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor({ state: 'hidden' }); await hideFilters(); for (const b of await page.getByRole('button', { name: 'Dismiss', exact: true }).all()) await b.click(); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400); await page.screenshot({ path: fileURLToPath(new URL(tag + '.png', out)), fullPage: true })
    await page.goto(base + '#/current-affairs?debug=1'); await rows.first().waitFor(); await rows.first().getByText('Evidence', { exact: true }).click(); check(tag, 'debug preserves classifier evidence', (await page.locator('pre').first().innerText()).includes('mustReadScore'))
    check(tag, 'no generic search references', await page.locator('a[href*="google.com/search"], a[href*="wikipedia.org/w/index.php"]').count() === 0); await overflow(); await ctx.close()
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
  check('Workbox', 'offline reload with HTTP cache disabled shows today cached events', await page.locator('[data-news-event]').count() === 9)
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  check('Workbox', 'offline archive includes earlier months and years', await page.locator('[data-news-event]').count() === 4)
  await page.evaluate(async () => (await caches.open('current-affairs-v1')).delete('/api/current-affairs'))
  await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  check('Archive', 'offline metadata survives without the latest Workbox API response', await page.locator('[data-news-event]').count() === 9)
  await page.getByText(/Offline – local archive|Refresh unavailable – local archive/).waitFor()
  await ctx.close()
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2) + '\n')
  console.log(`${checks.length} Current Affairs checks passed; no page errors`)
} catch (error) { for (const ctx of browser.contexts()) for (const page of ctx.pages()) { await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)), fullPage: true }).catch(() => {}); console.log((await page.locator('body').innerText()).slice(-4000)) } throw error } finally { await browser.close(); await new Promise(r => server.close(r)) }
