/**
 * Checks the PYQ UI on a phone viewport (not part of the smoke test): prints the
 * gazetteer's Study-priority order (India, World) and the "Past papers" panel of
 * the named places, and saves screenshots to out/. Places must be discovered in
 * the sample history to show their card details.
 *
 *   node pyqcheck.mjs [baseUrl] "Nathu La" "Kolleru" "w:Mediterranean"   (w: = World sheet)
 */
import { launch, prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:4173/'
const { browser, page } = await launch({ touch: false, dpr: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await prepare(page, base, { sample: true, route: '#/atlas' })
await page.waitForTimeout(2500)
const close = page.getByRole('button', { name: /close/i }).first()
if (await close.isVisible().catch(() => false)) await close.click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Search places' }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'out/pyq-debug.png' })
await page.getByText('Study priority', { exact: true }).first().click()
await page.waitForTimeout(600)
const rows = await page.locator('[role=dialog] li').evaluateAll((els) => els.slice(0, 12).map((e) => e.innerText.replace(/\s+/g, ' ')))
console.log('INDIA by priority:\n ' + rows.join('\n '))
await page.screenshot({ path: 'out/pyq-gazetteer-india.png' })
await page.locator('[role=dialog]').getByText('World', { exact: true }).first().click()
await page.waitForTimeout(600)
const wrows = await page.locator('[role=dialog] li').evaluateAll((els) => els.slice(0, 8).map((e) => e.innerText.replace(/\s+/g, ' ')))
console.log('WORLD by priority:\n ' + wrows.join('\n '))
for (const arg of process.argv.slice(3)) {
  const [scope, name] = arg.startsWith('w:') ? ['World', arg.slice(2)] : ['India', arg]
  await page.locator('[role=dialog]').getByText(scope, { exact: true }).first().click()
  await page.waitForTimeout(300)
  const search = page.getByLabel('Search the gazetteer')
  await search.fill(name)
  await page.waitForTimeout(500)
  await page.locator('[role=dialog] li button').first().click()
  await page.waitForTimeout(1200)
  const card = page.locator('section[aria-label="Past papers and study priority"]')
  console.log(`\nCARD ${name}:`, (await card.isVisible().catch(() => false)) ? (await card.innerText()).replace(/\n+/g, ' | ') : 'no Past papers section')
  await page.screenshot({ path: `out/pyq-card-${name.replace(/\W+/g, '-')}.png`, fullPage: false })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Search places' }).click()
  await page.waitForTimeout(700)
}
console.log('\npage errors:', errors.length ? errors : 'none')
await browser.close()
