/** Expanded production screenshot/contact-sheet inputs at all requested widths and themes. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const out = new URL('./out/job4/visual/', import.meta.url)
mkdirSync(out, { recursive: true })
const root = new URL('../../public/pyq-atlas/v1/', import.meta.url)
const questions = readdirSync(new URL('papers/', root)).flatMap(f => JSON.parse(readFileSync(new URL('papers/' + f, root))).questions)
const samples = [...new Map(questions.map(q => [q.question.type, q])).values()]
const captures = [], checks = [], errors = []
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const contrast = (a, b) => {
  const luminance = h => { const v = h.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722 }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
try {
  for (const width of [375, 768, 1366, 1920]) for (const theme of ['light', 'dark']) {
    const height = width === 375 ? 812 : width === 768 ? 1024 : width === 1366 ? 768 : 1080
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: 1, hasTouch: width < 1024, isMobile: width === 375 })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    const tag = `${width}-${theme}`
    const shot = async state => {
      const dismiss = page.getByRole('button', { name: 'Dismiss', exact: true })
      for (let n = await dismiss.count(); n > 0; n--) {
        await dismiss.first().click()
        await page.waitForTimeout(500)
      }
      await page.waitForTimeout(700)
      const file = `${tag}-${state}.png`
      await page.screenshot({ path: fileURLToPath(new URL(file, out)) })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      assert(overflow <= 1, file + ': horizontal overflow')
      captures.push({ file, width, height, theme, state })
      console.log('CAPTURE ' + file)
    }
    const go = async route => { await page.goto(base + route); await page.waitForTimeout(500) }
    const escape = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300) }
    const command = async text => {
      await page.keyboard.press('Control+k')
      const input = page.getByRole('combobox', { name: 'Search and commands' })
      await input.fill(text); await page.waitForTimeout(150); await input.press('Enter'); await page.waitForTimeout(400)
    }
    await prepare(page, base, { sample: false, route: '#/insights' })
    await shot('insights-empty')
    await go('#/atlas?place=in.pass.nathu-la')
    await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
    await shot('place-untravelled')
    await escape()
    await go('#/settings')
    await page.getByText('Preview with sample data', { exact: true }).click()
    await page.waitForTimeout(1200)
    await go('#/focus')
    await shot('focus-idle-presence')
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return Object.fromEntries(['--ink', '--ink-2', '--ink-3', '--accent', '--danger', '--success', '--surface', '--surface-2', '--surface-3', '--bg'].map(k => [k, style.getPropertyValue(k).trim()]))
    })
    for (const ink of ['--ink', '--ink-2', '--ink-3', '--accent', '--danger', '--success']) for (const background of ['--bg', '--surface', '--surface-2', '--surface-3']) {
      const ratio = contrast(tokens[ink], tokens[background])
      checks.push({ name: `${tag} ${ink}/${background}`, ratio: +ratio.toFixed(2), ok: ratio >= 4.5 })
      assert(ratio >= 4.5, `${tag} ${ink}/${background}: ${ratio}`)
    }
    await go('#/tasks')
    const quick = page.getByRole('textbox', { name: /new task/i }).first()
    for (let i = 0; i < 12; i++) { await quick.fill(`Dense planning ${i} today !high`); await quick.press('Enter'); await page.waitForTimeout(80) }
    await shot('tasks-dense-today')
    await page.getByText('Dense planning 0', { exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Task title', exact: true }).waitFor()
    await shot('task-sheet')
    await page.getByRole('button', { name: 'Focus', exact: true }).last().click()
    await page.waitForTimeout(400)
    await shot('task-focus-running')
    // Jump wall time for completion without faking rAF/performance or freezing
    // Motion transitions. The timestamp-based timer reconciles on app resume.
    await page.evaluate(() => {
      window.__nativeDate = Date
      const NativeDate = Date, offset = 25 * 60000 + 2500
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])) }
        static now() { return NativeDate.now() + offset }
      }
      dispatchEvent(new Event('focus'))
    })
    await page.getByRole('dialog', { name: 'Session complete', exact: true }).waitFor()
    await shot('session-complete-expedition')
    await escape()
    await page.evaluate(() => { window.Date = window.__nativeDate })
    await command('Stop timer')
    await go('#/calendar')
    await shot('calendar-events')
    await page.getByRole('button', { name: 'New calendar item', exact: true }).click()
    await page.getByPlaceholder('What will you focus on?').fill('Visual study block')
    await page.getByLabel(/^Linked task/).selectOption({ label: 'Dense planning 0' })
    await shot('calendar-block-sheet')
    await page.getByRole('button', { name: 'Add to calendar', exact: true }).click()
    await page.getByText('Visual study block', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Start now', exact: true }).click()
    await shot('calendar-focus-running')
    await command('Stop timer')
    await go('#/atlas')
    await page.getByRole('application').waitFor()
    if (await page.getByRole('dialog').count()) await escape()
    await shot('atlas-india')
    await page.getByRole('tab', { name: 'World', exact: true }).click()
    await page.waitForTimeout(600)
    await shot('atlas-world')
    await page.getByRole('tab', { name: 'India', exact: true }).click()
    for (const zoom of [2, 4]) {
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.waitForTimeout(500)
      await shot('atlas-zoom-' + zoom)
    }
    await page.getByRole('button', { name: 'PYQ hotspots', exact: true }).click()
    await shot('atlas-hotspots')
    if (width < 1024) {
      await page.getByRole('button', { name: 'More', exact: true }).click()
      await page.getByRole('dialog', { name: 'Atlas', exact: true }).waitFor()
      await shot('atlas-more-accessible')
      await escape()
    }
    await page.getByRole('button', { name: /Full-screen map/ }).click()
    await page.waitForTimeout(400)
    await shot('atlas-fullscreen')
    await escape()
    await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen() })
    await page.setViewportSize({ width, height })
    await go('#/atlas?place=in.river.ganga')
    await page.getByRole('heading', { name: 'Ganga', exact: true }).waitFor()
    await shot('atlas-place-inspector')
    if (width >= 1024) {
      await page.getByRole('button', { name: 'Collapse Atlas inspector', exact: true }).click()
      await shot('atlas-inspector-collapsed')
      assert(await page.getByRole('button', { name: 'Open Atlas inspector', exact: true }).evaluate(el => el === document.activeElement), 'collapse focus')
      await page.getByRole('button', { name: 'Open Atlas inspector', exact: true }).click()
      assert(await page.getByRole('button', { name: 'Collapse Atlas inspector', exact: true }).evaluate(el => el === document.activeElement), 'reopen focus')
    } else { await escape(); await shot('atlas-inspector-collapsed') }
    await go('#/atlas?questions=1&family=CDS&year=2024&mode=places')
    await page.getByRole('dialog', { name: 'Previous questions', exact: true }).waitFor()
    await page.waitForTimeout(400)
    await shot('catalogue-filters')
    await escape()
    for (const q of samples) {
      await go('#/atlas?pyq=' + q.id)
      const article = page.locator('[data-question-id]')
      await article.getByRole('radio').first().waitFor()
      assert(await article.getByRole('radio').count() === 4, 'A-D semantics')
      await shot('quiz-' + q.question.type + '-before')
      await article.getByRole('radio').first().check()
      await article.getByRole('button', { name: 'Submit answer', exact: true }).click()
      await article.getByText(/Accepted answer/).waitFor()
      await article.evaluate(el => { const body = el.closest('[data-sheet-body]'); body.scrollTop = body.scrollHeight })
      await shot('quiz-' + q.question.type + '-after')
      await escape()
    }
    await go('#/insights')
    await shot('insights-mature')
    // Session-source navigation is checked by the permanent Insights QA; capture its sheet too.
    const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Session history', exact: true }) })
    await history.locator('li button').first().click()
    await page.getByRole('dialog').waitFor()
    await shot('insights-source-session')
    await ctx.close()
  }
  assert(errors.length === 0, errors.join('\n'))
  writeFileSync(new URL('results.json', out), JSON.stringify({ captures, checks, errors }, null, 2))
  console.log(`${captures.length} captures; ${checks.length} contrast checks; no page errors`)
} finally { await browser.close() }
