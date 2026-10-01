/** Dev-only, real repository fixtures for travel/learning independence at all widths/themes. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:5173/'
const out = new URL('./out/job4/states/', import.meta.url)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const captures = [], gazetteerChecks = [], errors = []
let currentFixture, currentPage
try {
  const widths = [375, 768, 1366, 1920].filter(width => !process.env.VIEWPORTS || process.env.VIEWPORTS.split(',').includes(String(width)))
  for (const width of widths) for (const theme of (process.env.SCHEMES ?? 'light,dark').split(',')) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 1024 : 900 }, colorScheme: theme })
    const page = await ctx.newPage()
    currentPage = page
    page.on('pageerror', error => errors.push(error.message))
    await prepare(page, base)
    const fixtures = await page.evaluate(async () => {
      const { db } = await import('/src/data/db.ts')
      const { create } = await import('/src/data/repo.ts')
      const { loadAtlas } = await import('/src/atlas/data.ts')
      const { computeExploration } = await import('/src/atlas/useExploration.ts')
      const { todayKey, addDaysKey } = await import('/src/lib/time.ts')
      const { useToasts } = await import('/src/ui/toast.ts')
      useToasts.setState({ toasts: [] })
      const atlas = await loadAtlas(), today = todayKey()
      await db.recalls.clear()
      const sessions = await db.sessions.toArray(), runs = await db.expeditions.toArray(), claims = await db.claims.toArray()
      const camp = (await db.settings.get('settings')).baseCamp
      const state = computeExploration(atlas, sessions, runs, [], claims, camp, today).state
      const pools = [false, true].map(travelled => atlas.places.filter(p => p.sheet === 'india' && state.discovered.has(p.id) === travelled).slice(0, 3))
      const fixtures = []
      for (const [travelled, pool] of pools.entries()) for (const [index, p] of pool.entries()) {
        const level = ['familiar', 'strong', 'mastered'][index], count = [1, 3, 5][index]
        for (let i = 0; i < count; i++) {
          const date = addDaysKey(today, (i - count + 1) * 2)
          await create('recalls', { placeId: p.id, type: i % 2 ? 'locate' : 'fact', correct: 1, at: Date.parse(date + 'T12:00:00'), date, source: 'card' })
        }
        fixtures.push({ id: p.id, name: p.name, travelled: !!travelled, level })
      }
      const ex = computeExploration(atlas, sessions, runs, await db.recalls.toArray(), claims, camp, today)
      return fixtures.map(f => ({ ...f, actual: ex.mastery.get(f.id).level, actualTravel: ex.state.discovered.has(f.id) }))
    })
    assert(fixtures.length === 6)
    for (const f of fixtures) {
      currentFixture = { width, theme, ...f }
      assert(f.level === f.actual && f.travelled === f.actualTravel, JSON.stringify(f))
      await page.goto(`${base}#/atlas?place=${f.id}`)
      await page.getByRole('heading', { name: f.name, exact: true }).waitFor()
      await page.waitForTimeout(300)
      const labelContrast = await page.getByText(f.level[0].toUpperCase() + f.level.slice(1), { exact: true }).last().evaluate(el => {
        const luminance = s => { const c = s.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
        const a = luminance(getComputedStyle(el).color), b = luminance(getComputedStyle(el.parentElement.parentElement).backgroundColor)
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      })
      assert(labelContrast >= 4.5, `${width}-${theme} ${f.level} contrast: ${labelContrast}`)
      const file = `${width}-${theme}-${f.travelled ? 'travelled' : 'untravelled'}-${f.level}.png`
      await page.screenshot({ path: fileURLToPath(new URL(file, out)) })
      captures.push({ file, width, theme, ...f, labelContrast })
      console.log('CAPTURE ' + file)
    }
    await page.goto(`${base}#/atlas?search=${encodeURIComponent(fixtures[0].name)}`)
    const gazetteer = page.getByRole('dialog', { name: 'Gazetteer', exact: true })
    await gazetteer.waitFor()
    for (const f of fixtures) {
      await gazetteer.getByRole('textbox').fill(f.name)
      const row = gazetteer.getByRole('button').filter({ has: page.getByText(f.name, { exact: true }) })
      const label = row.getByText(f.level[0].toUpperCase() + f.level.slice(1), { exact: true })
      await label.waitFor()
      const ratio = await label.evaluate(el => {
        const luminance = s => { const c = s.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
        let parent = el.parentElement, background
        while (parent && (!background || background === 'rgba(0, 0, 0, 0)')) { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement }
        const a = luminance(getComputedStyle(el).color), b = luminance(background)
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      })
      assert(ratio >= 4.5, `${width}-${theme} Gazetteer ${f.level}: ${ratio}`)
      gazetteerChecks.push({ width, theme, ...f, ratio })
    }
    await ctx.close()
  }
  assert(errors.length === 0, errors.join('\n'))
  const resultFile = process.env.VIEWPORTS || process.env.SCHEMES ? `results-${process.env.VIEWPORTS ?? 'all'}-${process.env.SCHEMES ?? 'both'}.json` : 'results.json'
  writeFileSync(new URL(resultFile, out), JSON.stringify({ captures, gazetteerChecks, errors }, null, 2))
  console.log(`${captures.length} travel/mastery captures; ${gazetteerChecks.length} Gazetteer contrast checks; no page errors`)
} catch (error) {
  console.log('FAILED FIXTURE', currentFixture)
  if (currentPage && !currentPage.isClosed()) {
    console.log('RENDERED', await currentPage.locator('body').innerText())
    console.log('RECALLS', await currentPage.evaluate(async id => {
      const { db } = await import('/src/data/db.ts')
      return db.recalls.where('placeId').equals(id).toArray()
    }, currentFixture.id))
    await currentPage.screenshot({ path: fileURLToPath(new URL('failure.png', out)) })
  }
  throw error
} finally { await browser.close() }
