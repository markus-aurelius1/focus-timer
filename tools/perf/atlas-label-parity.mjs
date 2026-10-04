/** Compare real-font main/worker placement in the unshipped production harness. */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage()
  await page.goto(process.argv[2] ?? 'http://localhost:4175/tools/perf/atlas-pixel.html')
  const rows = await page.evaluate(() => window.compareLabelLayouts())
  for (const row of rows) console.log(row.pass ? 'PASS' : 'FAIL', row)
  writeFileSync(fileURLToPath(new URL('./out/codex-j25/layout-parity.json', import.meta.url)), JSON.stringify(rows, null, 2))
  process.exitCode = rows.every((row) => row.pass) ? 0 : 1
} finally {
  await browser.close()
}
