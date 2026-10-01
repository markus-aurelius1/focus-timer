/** Developer preview QA: every included question at phone/desktop width, plus stratified screenshots using the shared block tree. */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fixtures } from '../atlas-build/test/fixtures/canonical-structures.mjs'
import { blockNodes, nodesHtml } from '../../src/atlas/pyq/render.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const reportPath = join(root, 'tools/atlas-build/reports')
const out = join(root, 'tools/perf/out/canonical-pyq')
mkdirSync(out, { recursive: true })
const samples = JSON.parse(readFileSync(join(reportPath, 'canonical-pyq-audit-samples.json')))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const results = []
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(pathToFileURL(join(reportPath, 'canonical-pyq-preview.html')).href)
    const audit = await page.evaluate(() => ({
      questions: document.querySelectorAll('article').length,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      brokenOptions: [...document.querySelectorAll('article')].filter((a) => a.querySelectorAll('.option').length !== 4).map((a) => a.id),
      escapedTableOverflow: [...document.querySelectorAll('.pyq-table-scroll')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).length,
    }))
    results.push({ width, ...audit })
    for (const s of samples.samples) await page.locator(`#${s.questionId}`).screenshot({ path: join(out, `${width}-${s.questionId}.png`) })
    await page.close()
  }
  const css = readFileSync(join(root, 'src/atlas/pyq/blocks.css'), 'utf8')
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } })
  await page.setContent(`<style>${css}body{font:16px system-ui;padding:16px}.fixture{margin-bottom:32px}</style>${Object.entries(fixtures).map(([name, q]) => `<section id="${name}" class="fixture pyq-body"><h2>${name}</h2>${nodesHtml(blockNodes(q.content))}${q.options.map((o) => `<div>${o.key}${nodesHtml(blockNodes(o.content))}</div>`).join('')}</section>`).join('')}`)
  for (const name of Object.keys(fixtures)) await page.locator(`[id="${name}"]`).screenshot({ path: join(out, `fixture-${name}.png`) })
  await page.close()
} finally { await browser.close() }
writeFileSync(join(out, 'layout-audit.json'), JSON.stringify({ samples, layouts: results }, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
if (results.some((r) => r.pageOverflow || r.brokenOptions.length || r.escapedTableOverflow)) process.exitCode = 1
