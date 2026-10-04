/** Production parity harness runner; tolerances bound antialias/filter rounding, never geometry changes. */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const out = fileURLToPath(new URL('./out/codex-j24/', import.meta.url))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage()
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:4175/tools/perf/atlas-pixel.html')
  const rows = await page.evaluate(async () => [...(await window.compareAtlas()), ...(await window.compareAtlasFallback())])
  mkdirSync(out, { recursive: true })
  writeFileSync(out + '/pixel.json', JSON.stringify(rows, null, 2))
  for (const r of rows) {
    const pass = r.mae <= 2 && r.highPercent <= 1
    console.log(
      (pass ? 'PASS' : 'FAIL') + ' ' + r.id + '/' + r.mode + '/' + r.level + '/' + r.sample + (r.fallback ? '/fallback' : '') + ' MAE=' + r.mae.toFixed(3) + ' >32px=' + r.highPercent.toFixed(3) + '%',
    )
  }
  // Each bounded pair remains directly reviewable without allocating an enormous page bitmap.
  for (const pair of await page.locator('[data-parity-case]').all()) {
    const id = await pair.getAttribute('data-parity-case')
    await pair.screenshot({ path: out + '/pixel-' + id + '.png' })
  }
  process.exitCode = rows.every((r) => r.mae <= 2 && r.highPercent <= 1) ? 0 : 1
} finally {
  await browser.close()
}
