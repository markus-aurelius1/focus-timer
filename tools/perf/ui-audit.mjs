/**
 * Layout audit: every screen and dialog at phone / tablet / laptop / large desktop,
 * light + dark. Reports unwanted scrollbars (page and dialog overflow, horizontal
 * overflow anywhere, footers that need scrolling) and saves screenshots to
 * tools/perf/out/audit/.
 *
 *   node ui-audit.mjs [baseUrl] [filter]      e.g. node ui-audit.mjs http://localhost:5173/ atlas
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
  ['1440', { width: 1440, height: 900 }, false],
  ['1280', { width: 1280, height: 800 }, false],
  ['1024', { width: 1024, height: 768 }, true],
  ['390', { width: 390, height: 844 }, true],
  ['375', { width: 375, height: 812 }, true],
  ['768', { width: 768, height: 1024 }, true],
  ['1366', { width: 1366, height: 768 }, false],
  ['1920', { width: 1920, height: 1080 }, false],
].filter(([name]) => !process.env.VIEWPORTS || process.env.VIEWPORTS.split(',').includes(name))

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
    await prepare(page, base, { sample: true, route: '#/atlas' })
    const tag = `${vp}-${scheme}`
    const check = async (name, opts) => {
      if (filter && !name.includes(filter)) return
      await page.waitForTimeout(750)
      // Lazy surfaces must be mounted and their entrance animation complete before measuring bounds.
      if (name.startsWith('dialog-')) {
        await page.getByRole('dialog').first().waitFor()
        await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(d => !d.getAnimations({ subtree: true }).some(a => a.playState === 'running')))
      }
      // A surface opened for the first time may still be arriving (its module and data load on first use): measure it at rest.
      await page
        .waitForFunction(
          () => {
            const now = [...document.querySelectorAll('[role="dialog"]')].map((d) => Math.round(d.getBoundingClientRect().top)).join(',')
            const same = window.__dialogTops === now
            window.__dialogTops = now
            return same
          },
          null,
          { timeout: 2500, polling: 120 },
        )
        .catch(() => {})
      report(`${tag} ${name}`, await measure(page), opts)
      await page.screenshot({ path: `${out}${tag}-${name}.png` })
    }
    const escape = async () => {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(450)
    }

    const D = { allowPageY: true }
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
    await check('dialog-palette', D)
    await escape()
    await page.keyboard.press('Shift+?')
    await check('dialog-shortcuts', D)
    await escape()

    for (const r of ['current-affairs', 'settings']) {
      await page.goto(base + '#/' + r)
      await page.waitForTimeout(900)
      await check(r, { allowPageY: true })
    }
    await page.goto(base + '#/atlas')
    await page.waitForTimeout(2500)
    await check('atlas')
    await page.getByRole('button', { name: 'Map options', exact: true }).click()
  await page.getByRole('button', { name: /full-screen map/i }).first().click().catch(() => {})
    await page.waitForTimeout(700)
    // Measure the settled shell: the rail intentionally travels off-screen
    // before its delayed visibility transition finishes (320 ms plus paint).
    await page.waitForFunction(() => {
      const rail = document.querySelector('.product-bar')
      const stage = document.querySelector('.stage')
      return document.documentElement.dataset.chrome === 'hidden'
        && (!rail || getComputedStyle(rail).visibility === 'hidden')
        && ![rail, stage].filter(Boolean).some((el) => el.getAnimations().some((animation) => animation.playState === 'running'))
    })
    await check('atlas-fullscreen')
    await escape()
    // Headless browser fullscreen may restore its native window size instead of the emulated viewport.
    await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen() })
    await page.setViewportSize(viewport)
    const shell = await page.evaluate(() => ({ width: document.querySelector('.stage').getBoundingClientRect().width, sidebar: !!document.querySelector('#sidebar'), destinations: [...document.querySelectorAll('.product-nav button')].map(b => b.textContent) }))
    if (shell.sidebar || Math.abs(shell.width - viewport.width) > 1 || shell.destinations.join('|') !== 'Atlas|News') problems.push(tag + ': product shell does not expose exactly Atlas/News above a full-width map')
    await check('atlas-product-shell')
    await ctx.close()
  }
}
await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nNo layout problems found')
process.exit(problems.length ? 1 : 0)
