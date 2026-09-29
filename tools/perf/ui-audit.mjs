/**
 * Layout audit: every screen and dialog at phone / tablet / laptop / large desktop,
 * light + dark. Reports unwanted scrollbars (page and dialog overflow, horizontal
 * overflow anywhere, footers that need scrolling) and saves screenshots to
 * tools/perf/out/audit/.
 *
 *   node ui-audit.mjs [baseUrl] [filter]      e.g. node ui-audit.mjs http://localhost:5173/ focus
 *
 * Exits non-zero when a problem is found.
 */
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const filter = process.argv[3] ?? ''
const schemes = (process.env.SCHEMES ?? 'light,dark').split(',')
const out = fileURLToPath(new URL('./out/audit/', import.meta.url))
mkdirSync(out, { recursive: true })

const VIEWPORTS = [
  ['375', { width: 375, height: 812 }, true],
  ['768', { width: 768, height: 1024 }, true],
  ['1366', { width: 1366, height: 768 }, false],
  ['1920', { width: 1920, height: 1080 }, false],
]

const problems = []

/** Measure page + dialog overflow in the page. */
async function measure(page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement
    const res = {
      pageX: doc.scrollWidth - doc.clientWidth,
      pageY: doc.scrollHeight - doc.clientHeight,
      wide: [],
      dialogs: [],
    }
    const vw = document.documentElement.clientWidth
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      // Elements poking out of the viewport sideways (ignoring those clipped by an ancestor).
      if (r.right > vw + 1 || r.left < -1) {
        let clipped = false
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const pcs = getComputedStyle(p)
          if (pcs.overflowX !== 'visible' || pcs.overflow === 'hidden' || pcs.contain.includes('paint') || pcs.contain === 'strict') {
            clipped = true
            break
          }
        }
        if (!clipped && res.wide.length < 6) res.wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}]`)
      }
    }
    for (const d of document.querySelectorAll('[role="dialog"]')) {
      const r = d.getBoundingClientRect()
      const info = { label: d.getAttribute('aria-label') ?? '', x: [], y: [], outside: r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1 }
      for (const el of [d, ...d.querySelectorAll('*')]) {
        const cs = getComputedStyle(el)
        const scrollX = el.scrollWidth - el.clientWidth > 1 && (cs.overflowX === 'auto' || cs.overflowX === 'scroll')
        const scrollY = el.scrollHeight - el.clientHeight > 1 && (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
        // Deliberate horizontal scrollers (chip rows) opt in with .scrollbar-none.
        if (scrollX && !el.classList.contains('scrollbar-none')) info.x.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} +${el.scrollWidth - el.clientWidth}`)
        if (scrollY) info.y.push({ tag: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`, over: el.scrollHeight - el.clientHeight, client: el.clientHeight })
      }
      // Every button in the footer must be fully visible without scrolling.
      const hidden = []
      for (const b of d.querySelectorAll('[data-sheet-footer] button')) {
        const br = b.getBoundingClientRect()
        if (br.right > r.right + 1 || br.left < r.left - 1 || br.bottom > r.bottom + 1) hidden.push(b.textContent.trim() || b.getAttribute('aria-label'))
      }
      info.footerHidden = hidden
      res.dialogs.push(info)
    }
    return res
  })
}

function report(where, m, { allowPageY = false } = {}) {
  const issues = []
  if (m.pageX > 0) issues.push(`page scrolls sideways by ${m.pageX}px`)
  if (!allowPageY && m.pageY > 0) issues.push(`page scrolls vertically by ${m.pageY}px`)
  if (m.wide.length) issues.push(`wide: ${m.wide.join(' | ')}`)
  for (const d of m.dialogs) {
    if (d.outside) issues.push(`dialog "${d.label}" extends past the viewport`)
    if (d.x.length) issues.push(`dialog "${d.label}" scrolls sideways: ${d.x.join(' | ')}`)
    if (d.footerHidden.length) issues.push(`dialog "${d.label}" footer buttons not visible: ${d.footerHidden.join(', ')}`)
    for (const y of d.y) if (y.over > 0 && y.over < 24) issues.push(`dialog "${d.label}" has a near-useless scrollbar (${y.over}px) on ${y.tag}`)
  }
  if (issues.length) {
    problems.push(`${where}: ${issues.join('; ')}`)
    console.log(`✗ ${where}\n    ${issues.join('\n    ')}`)
  } else console.log(`✓ ${where}${m.dialogs.length ? ` (${m.dialogs.map((d) => `${d.label || 'dialog'}${d.y.length ? ` scrolls ${d.y.map((y) => y.over).join('/')}px` : ''}`).join(', ')})` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
for (const [vp, viewport, touch] of VIEWPORTS) {
  for (const scheme of schemes) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme, hasTouch: touch, isMobile: touch && viewport.width < 600 })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => problems.push(`pageerror ${e.message}`))
    await prepare(page, base, { sample: true, route: '#/focus' })
    const tag = `${vp}-${scheme}`
    const check = async (name, opts) => {
      if (filter && !name.includes(filter)) return
      await page.waitForTimeout(750)
      report(`${tag} ${name}`, await measure(page), opts)
      await page.screenshot({ path: `${out}${tag}-${name}.png` })
    }
    const escape = async () => {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(450)
    }

    const D = { allowPageY: true }
    // Focus (home): must fit the viewport while idle on laptop/desktop; phones may scroll to "Up next".
    await check('focus-idle', { allowPageY: viewport.width < 1024 })
    await page.getByRole('button', { name: /^start focus/i }).click()
    await page.waitForTimeout(1500)
    await check('focus-running')
    await page.getByRole('button', { name: /^pause$/i }).click()
    await check('focus-paused')
    await page.getByRole('button', { name: /immersive mode/i }).first().click()
    await page.waitForTimeout(900)
    await check('focus-immersive')
    await page.getByRole('button', { name: /exit immersive/i }).click().catch(() => {})
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: /stop the timer/i }).click()
    await page.waitForTimeout(500)
    const discard = page.getByRole('button', { name: /discard and reset/i })
    if (await discard.isVisible().catch(() => false)) await discard.click()
    await page.waitForTimeout(400)

    // Focus dialogs.
    await page.getByRole('button', { name: /what are you working on/i }).first().click()
    await check('dialog-context', D)
    await escape()
    await page.getByRole('button', { name: /^sounds/i }).first().click()
    await check('dialog-sounds', D)
    await escape()
    await page.getByRole('button', { name: /timer profile/i }).first().click()
    await check('dialog-profile', D)
    await escape()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
    await check('dialog-palette', D)
    await escape()
    await page.keyboard.press('Shift+?')
    await check('dialog-shortcuts', D)
    await escape()

    // Tasks: quick add expanded inline, then the full sheet (new + edit).
    await page.goto(base + '#/tasks')
    await page.waitForTimeout(900)
    await check('tasks', { allowPageY: true })
    await page.getByRole('button', { name: /more options/i }).first().click()
    await page.getByRole('textbox', { name: /new task/i }).first().fill('Physics revision tomorrow 5pm #exam ~1h')
    await check('tasks-quickadd-expanded', { allowPageY: true })
    await page.getByRole('textbox', { name: /new task/i }).first().fill('')
    await page.keyboard.press('Escape')
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {})
    await page.keyboard.press('n')
    await check('dialog-new-task', D)
    await escape()
    await page.locator('[role="button"]').filter({ hasText: /./ }).first().click().catch(() => {})
    await check('dialog-edit-task', D)
    await escape()

    for (const r of ['calendar', 'insights', 'settings']) {
      await page.goto(base + '#/' + r)
      await page.waitForTimeout(900)
      await check(r, { allowPageY: true })
    }
    await page.goto(base + '#/atlas')
    await page.waitForTimeout(2500)
    await check('atlas')
    // The first visit asks for a base camp; close it before using the map controls.
    if (await page.getByRole('dialog').first().isVisible().catch(() => false)) await escape()
    await page.getByRole('button', { name: /full-screen map/i }).first().click().catch(() => {})
    await page.waitForTimeout(700)
    await check('atlas-fullscreen')
    await escape()
    if (viewport.width >= 1024) {
      // Collapsed sidebar: icons only, the content takes the space.
      await page.goto(base + '#/focus')
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: /collapse sidebar/i }).click()
      await check('focus-sidebar-collapsed')
      await page.getByRole('button', { name: /expand sidebar/i }).click()
    }
    await ctx.close()
  }
}
await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nNo layout problems found')
process.exit(problems.length ? 1 : 0)
