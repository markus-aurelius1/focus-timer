/** Editorial presentation acceptance. Real map/PYQ data; RSS metadata fixtures and isolated personal state. */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const out = new URL('./out/editorial/matrix/', import.meta.url)
mkdirSync(out, { recursive: true })
const root = new URL('../../public/pyq-atlas/v1/', import.meta.url)
const questions = readdirSync(new URL('papers/', root)).flatMap(f => JSON.parse(readFileSync(new URL('papers/' + f, root))).questions)
const q = questions.find(q => q.question.options.length === 4 && q.relations.some(r => r.masteryEligible && r.quizIncluded))
const answer = JSON.parse(readFileSync(new URL('answers/' + q.id.replace(/-Q\d+$/, '') + '.json', root))).answers.find(a => a.questionId === q.id)
const correct = answer.correctOptions[0], incorrect = 'ABCD'.split('').find(k => !answer.correctOptions.includes(k))
const publishedAt = new Date(Date.now() - 3600000).toISOString(), fetchedAt = new Date().toISOString()
const articleURL = 'https://indianexpress.com/article/editorial-rbi'
const item = (title, url, extra = {}) => ({ title, url, sourceId: 'ie-explained', publisher: 'Indian Express', section: 'Explained', publishedAt, description: 'Publisher RSS excerpt. Open the original link for the full article.', ...extra })
const fixture = { version: 1, fetchedAt, sources: [{ sourceId: 'ie-explained', status: 'ok', count: 4 }], items: [
  item('RBI revises banking liquidity regulation framework', articleURL),
  item('ISRO launches important lunar space mission', 'https://indianexpress.com/article/editorial-space'),
  item('Supreme Court ruling on constitutional fundamental rights', 'https://www.thehindu.com/editorial-rights', { sourceId: 'hindu-national', publisher: 'The Hindu', section: 'National' }),
  item('Ramsar wetland conservation framework expands', 'https://www.downtoearth.org.in/editorial-archive', { sourceId: 'dte-news', publisher: 'Down To Earth', publishedAt: new Date(Date.now() - 48 * 3600000).toISOString() }),
] }
const stateKey = 'tars.current-affairs.state.v1', notesKey = 'tars.current-affairs.notes.v1'
const dormant = JSON.stringify({ version: 1, entries: { historical: { id: 'historical', text: 'Preserved dormant dated note', createdDate: '2026-01-01', createdAt: 1 } } })
const checks = [], errors = []
function ok(tag, name, value = true) { assert(value, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) for (const theme of ['dark', 'light']) {
    const tag = `${width}-${theme}`, ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 1280, colorScheme: theme, serviceWorkers: 'block', timezoneId: 'Asia/Kolkata' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(tag + ': ' + e.message))
    await ctx.route('**/api/current-affairs*', route => route.fulfill({ json: fixture }))
    await ctx.route('https://**/*editorial-*', route => route.fulfill({ contentType: 'text/html', body: '<h1>External publisher</h1>' }))
    const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: new URL(`${tag}-${name}.png`, out).pathname.replace(/^\/(\w:)/, '$1') }) }
    const noOverflow = async name => ok(tag, name + ' has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await prepare(page, base)
    await page.getByRole('application').waitFor()
    ok(tag, 'idle map has no empty inspector', await page.locator('[data-inspector], .atlas-place-sheet').count() === 0)
    ok(tag, 'only Atlas and News primary products', (await page.getByRole('navigation', { name: 'Workspaces', exact: true }).getByRole('button').allTextContents()).map(s => s.trim()).join(' ') === 'Atlas News')
    const dims = await page.locator('[data-atlas-surface]').boundingBox()
    ok(tag, 'map fills remaining shell space', Math.abs(dims.width - width) < 2 && Math.abs(dims.height - (height - (width < 600 ? 108 : 56))) < 2)
    await noOverflow('Atlas idle'); await shot('atlas-idle')
    await page.goto(base + '#/atlas?place=in.river.ganga')
    await page.getByRole('heading', { name: 'Ganga', exact: true }).waitFor()
    const details = page.locator('.place-knowledge')
    await shot('atlas-selected')
    const related = details.locator('button').filter({ has: page.locator('svg') }).filter({ hasNotText: /Test me|Show on/ }).first()
    if (await related.count()) {
      const name = (await related.innerText()).trim(); await related.click()
      await page.getByRole('heading', { name, exact: true }).waitFor()
      ok(tag, 'related-place navigation opens the existing place')
      await shot('atlas-related')
    } else throw new Error('Ganga must expose an interactive related place')
    if (width < 1024) {
      const sheet = page.locator('.atlas-place-sheet')
      await page.waitForFunction(() => Math.abs(innerHeight - document.querySelector('.atlas-place-sheet').getBoundingClientRect().top - 420) < 2)
      ok(tag, 'medium contextual sheet leaves map interactive', !await page.locator('#root').evaluate(el => el.inert))
      await page.getByRole('button', { name: 'Expand place details' }).click()
      await page.waitForFunction(() => document.querySelector('.atlas-place-sheet').getBoundingClientRect().top <= 21)
      await shot('atlas-full')
      await page.getByRole('button', { name: 'Peek place details' }).click()
      await page.waitForFunction(() => Math.abs(innerHeight - document.querySelector('.atlas-place-sheet').getBoundingClientRect().top - 144) < 2)
      await shot('atlas-peek'); ok(tag, 'peek is 144px and partial map remains usable', !await page.locator('#root').evaluate(el => el.inert))
      await page.getByRole('button', { name: 'Expand place details' }).click()
      await sheet.waitFor()
    } else {
      const panel = await page.locator('[data-inspector]').boundingBox()
      ok(tag, 'desktop inspector dimensions', panel.width >= 360 && panel.width <= 434 && panel.x + panel.width <= width - 23)
    }
    await page.keyboard.press('Escape')
    await page.locator('[data-inspector], .atlas-place-sheet').waitFor({ state: 'detached' })
    ok(tag, 'Escape dismisses place context')
    await page.getByRole('button', { name: 'Search places', exact: true }).click()
    await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Nathu La')
    await shot('atlas-search')
    await page.getByRole('dialog', { name: 'Gazetteer', exact: true }).getByRole('button').filter({ hasText: 'Nathu La' }).first().click()
    await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
    ok(tag, 'search opens selected place')
    await page.keyboard.press('Escape')
    await page.locator('[data-inspector], .atlas-place-sheet').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Map options', exact: true }).click()
    await page.getByRole('dialog', { name: 'Map options', exact: true }).waitFor(); await shot('atlas-layers'); await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Map options', exact: true }).waitFor({ state: 'detached' })
    for (const [state, key] of [['correct', correct], ['incorrect', incorrect]]) {
      await page.goto(base + '#/atlas?pyq=' + q.id)
      const article = page.locator('[data-question-id]'); await article.getByRole('radio').first().waitFor()
      ok(tag, 'one canonical question at a time', await page.locator('[data-question-id]').count() === 1)
      await shot('recall-neutral-' + state)
      await article.getByRole('radio').first().focus(); await page.keyboard.press(key.toLowerCase())
      ok(tag, 'option keyboard shortcut selects native radio', await article.getByRole('radio').nth('ABCD'.indexOf(key)).isChecked())
      await shot('recall-selected-' + state); await page.keyboard.press('Enter')
      await article.getByText('Saved to your quiz history.', { exact: true }).waitFor()
      ok(tag, state + ' answer has explicit text and accepted answer', await article.getByRole('heading', { name: state === 'correct' ? 'Correct' : 'Incorrect', exact: true }).isVisible() && await article.getByText(/Accepted answer/).isVisible())
      await shot('recall-' + state); await noOverflow('Recall')
      await page.keyboard.press('Tab')
      ok(tag, 'review focus remains in surface', await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)))
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' })
    }
    await page.evaluate(({ stateKey, notesKey, url, dormant }) => {
      localStorage.setItem(stateKey, JSON.stringify({ version: 1, entries: { [url]: { note: 'Historical article note' } } }))
      localStorage.setItem(notesKey, dormant)
    }, { stateKey, notesKey, url: articleURL, dormant })
    await page.goto(base + '#/current-affairs')
    const rows = page.locator('[data-news-event]'), nav = page.getByRole('group', { name: 'Reading filter' })
    const queue = name => nav.getByRole('button', { name, exact: true }).click()
    const rbi = () => rows.filter({ hasText: 'RBI revises' })
    await rows.first().waitFor(); await shot('news-today'); await noOverflow('News')
    ok(tag, 'kept Atlas controls cannot paint above News', await page.evaluate(() => [...document.querySelectorAll('.kept-screen [data-map-ui]')].every(el => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return true
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !hit?.closest('.kept-screen')
    })))
    ok(tag, 'News exposes no Notes, reader or detail surface', await page.getByRole('button', { name: /note/i }).count() === 0 && await page.locator('textarea, iframe, [role=dialog]').count() === 0)
    ok(tag, 'RSS excerpt visible', await rows.first().locator('.ca-excerpt').isVisible())
    await queue('To be Read'); await shot('news-unread')
    for (const link of [rbi().locator('[data-news-original]'), rbi().getByRole('link', { name: 'Open Original ↗', exact: true })]) {
      ok(tag, 'publisher URL and safe new context', await link.getAttribute('href') === articleURL && await link.getAttribute('target') === '_blank' && (await link.getAttribute('rel')).includes('noopener'))
      const popupPromise = page.waitForEvent('popup'); await link.click(); const popup = await popupPromise
      await popup.waitForLoadState(); ok(tag, 'article opens directly at canonical publisher', popup.url() === articleURL); await popup.close()
    }
    await rbi().getByRole('button', { name: /^Mark as read:/ }).click()
    await queue('Read'); await rbi().waitFor(); await shot('news-read')
    await rbi().getByRole('button', { name: /^Save / }).click(); await queue('Saved')
    await rbi().waitFor(); await shot('news-saved'); await page.reload()
    await rows.first().waitFor(); await queue('Saved'); await rbi().waitFor()
    ok(tag, 'Read/Saved and both dormant note mechanisms survive reload', await page.evaluate(({ stateKey, notesKey, url, dormant }) => {
      const entry = JSON.parse(localStorage.getItem(stateKey)).entries[url]
      return !!entry.readAt && !!entry.savedAt && entry.note === 'Historical article note' && localStorage.getItem(notesKey) === dormant
    }, { stateKey, notesKey, url: articleURL, dormant }))
    await page.goto(base + '#/atlas'); await page.getByRole('application').waitFor()
    await page.goto(base + '#/current-affairs'); await rbi().waitFor()
    ok(tag, 'News collection and selection indicator survive product switch', await nav.getByRole('button', { name: 'Saved', exact: true }).getAttribute('aria-pressed') === 'true')
    await queue('Today'); await page.getByRole('button', { name: 'Search news', exact: true }).click(); await page.getByRole('searchbox', { name: 'Search articles, topics or sources' }).fill('ISRO')
    await shot('news-search'); ok(tag, 'search filters collection', await rows.count() === 1)
    await page.getByRole('searchbox', { name: 'Search articles, topics or sources' }).fill('')
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.locator('#ca-filters').waitFor(); await shot('news-filters')
    await page.getByRole('dialog', { name: 'News filters', exact: true }).getByRole('button', { name: 'Sources', exact: true }).click()
    await page.getByRole('region', { name: 'News sources' }).waitFor(); await shot('news-sources')
    await page.getByRole('dialog', { name: 'News filters', exact: true }).getByRole('button', { name: 'Sources', exact: true }).click()
    await page.getByRole('dialog', { name: 'News filters', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('dialog', { name: 'News filters', exact: true }).waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await page.getByRole('heading', { name: 'Archive', exact: true }).waitFor()
    await rows.first().waitFor(); await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Archive grouping' }).selectOption('Monthly')
    await shot('news-archive'); await noOverflow('News archive')
    await page.goto(base + '#/settings'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
    await shot('settings'); await noOverflow('Settings')
    ok(tag, 'Light Dark System controls retained and obsolete settings absent', await page.getByRole('radio', { name: 'Light', exact: true }).count() === 1 && await page.getByRole('radio', { name: 'Dark', exact: true }).count() === 1 && await page.getByRole('radio', { name: 'System', exact: true }).count() === 1 && await page.getByText(/Soundscape|Pomodoro|Focus timer/i).count() === 0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // Media emulation returns before the preference listener and MotionConfig commit.
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'reduced')
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.goto(base + '#/atlas?pyq=' + q.id)
    await page.locator('[data-question-id] input').first().waitFor()
    ok(tag, 'reduced-motion surface opens without translating', await page.getByRole('dialog').evaluate(el => { const t = getComputedStyle(el).transform; return t === 'none' || Math.abs(new DOMMatrix(t).m41) < 1 }))
    await shot('reduced-motion'); await ctx.close()
  }
  ok('all', 'no page errors', errors.length === 0)
} finally {
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2)); await browser.close()
}
