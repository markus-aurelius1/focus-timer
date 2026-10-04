/** Product regression: Atlas + News, retired links/actions, historical data and offline Atlas. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const checks = [], errors = []
mkdirSync('tools/perf/out/product', { recursive: true })
const check = (tag, name, value) => { assert(value, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
try {
  for (const width of [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = `${width}-${theme}`
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width < 600 })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await ctx.route('**/api/current-affairs*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, fetchedAt: new Date().toISOString(), sources: [], items: [] }) }))
    await prepare(page, base)
    await page.goto(base)
    await page.getByRole('application').waitFor()
    check(tag, 'landing is Atlas', page.url().endsWith('#/atlas'))
    const nav = page.getByRole('navigation', { name: 'Workspaces', exact: true })
    check(tag, 'primary destinations are Atlas and News', await nav.getByRole('button', { name: 'Atlas', exact: true }).isVisible() && await nav.getByRole('button', { name: 'News', exact: true }).isVisible() && !/Focus|Plan|Home|Insights|Notes/.test(await nav.innerText()))
    await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 5)
    check(tag, 'map has places', await page.evaluate(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 5))
    await page.evaluate(async () => {
      localStorage.setItem('tars.timer.v1', JSON.stringify({ status: 'running', phase: 'focus', startedAt: 1, marker: 'keep-verbatim' }))
      localStorage.setItem('lodestar.timer.v1', 'legacy-keep-verbatim')
      const database = await new Promise((resolve, reject) => { const req = indexedDB.open('lodestar'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
      const transaction = database.transaction(['sessions', 'tasks', 'expeditions'], 'readwrite')
      for (const name of ['sessions', 'tasks', 'expeditions']) transaction.objectStore(name).put({ id: 'historical-' + name, createdAt: 1, updatedAt: 2, marker: 'keep-verbatim' })
      await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error) })
      database.close()
    })
    const snapshot = () => page.evaluate(async () => {
      const database = await new Promise(resolve => { const req = indexedDB.open('lodestar'); req.onsuccess = () => resolve(req.result) })
      const values = await Promise.all(['sessions', 'tasks', 'expeditions'].map(name => new Promise(resolve => { const req = database.transaction(name).objectStore(name).getAll(); req.onsuccess = () => resolve(req.result) })))
      database.close()
      return { values, timer: localStorage.getItem('tars.timer.v1'), legacy: localStorage.getItem('lodestar.timer.v1') }
    })
    const before = await snapshot()
    await page.reload()
    await page.getByRole('application').waitFor()
    for (const route of ['focus', 'tasks', 'calendar', 'planning', 'home', 'notes', 'insights', 'audio', 'unknown']) {
      await page.goto(base + `#/${route}?start=1&task=old&minutes=25`)
      await page.getByRole('application').waitFor()
      check(tag, `${route} link safely returns to Atlas`, page.url().endsWith('#/atlas'))
    }
    check(tag, 'retired timer never mounts', await page.getByRole('timer').count() === 0)
    await page.getByRole('button', { name: 'Ask Tars', exact: true }).locator('visible=true').click()
    const input = page.getByRole('combobox', { name: 'Search and commands' })
    await input.waitFor()
    check(tag, 'palette copy describes retained commands', await input.getAttribute('placeholder') === 'Search places or run a command…')
    check(tag, 'default commands have no retired surfaces', !/Start focus|Pomodoro|Plan tomorrow|Quick capture|Expedition|Soundscape|Timer profile/.test(await page.getByRole('dialog').innerText()))
    for (const query of ['Start 25 minutes', 'Plan tomorrow', 'Start expedition', 'Quick capture']) {
      await input.fill(query)
      await page.waitForTimeout(180)
      check(tag, `${query} has no executable command`, await page.getByRole('option').count() === 0)
    }
    await input.fill('Settings')
    await input.press('Enter')
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
    check(tag, 'settings expose shared preferences only', !/Timer|Pomodoro|Notifications|Base camp|Wallpaper|Sounds|Profiles|Keep awake/.test(await page.locator('main').innerText()))
    await nav.getByRole('button', { name: 'News', exact: true }).click()
    await (page.getByRole('group', { name: 'Reading filter' })).waitFor()
    check(tag, 'News state filters load independently', /To Read/.test(await page.locator('main').innerText()) && await page.getByRole('button', { name: /note/i }).count() === 0)
    await nav.getByRole('button', { name: 'Atlas', exact: true }).click()
    await page.getByRole('application').waitFor()
    await page.goto(base + '#/atlas?search=Nathu%20La')
    const gazetteer = page.getByRole('dialog', { name: 'Gazetteer', exact: true })
    await gazetteer.waitFor()
    await gazetteer.getByRole('button').filter({ hasText: 'Nathu La' }).first().click()
    await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
    check(tag, 'place opens without focus time', await page.getByRole('button', { name: 'Test me', exact: true }).isVisible())
    check(tag, 'place has no timer expedition actions', !/minutes to|expedition|base camp|Revision task/i.test(await page.locator('main').innerText()))
    await page.goto(base + '#/atlas')
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await ctx.setOffline(true)
    await page.reload()
    await page.getByRole('application').waitFor()
    await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 5)
    check(tag, 'Atlas reloads offline', await page.evaluate(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 5))
    assert.deepEqual(await snapshot(), before, `${tag}: retired history changed or timer resumed`)
    check(tag, 'stored sessions, tasks, expeditions and timer state remain verbatim', true)
    await page.screenshot({ path: `tools/perf/out/product/${tag}.png` })
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  console.log(`PASS ${checks.length} product checks; no page errors`)
} finally { await browser.close(); writeFileSync('tools/perf/out/product/results.json', JSON.stringify({ checks, errors }, null, 2)) }
