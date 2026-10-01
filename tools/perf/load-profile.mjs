/** Warm application-to-Atlas loading, requested JS and heap; no claims about cold install or physical GPUs. */
import { launch, prepare } from './lib.mjs'
import { writeFileSync } from 'node:fs'
const runs = []
for (const [label, base] of [['job1', process.argv[2] ?? 'http://localhost:4177/'], ['vnext', process.argv[3] ?? 'http://localhost:4174/']]) {
  const { browser, ctx, page } = await launch()
  const cdp = await ctx.newCDPSession(page)
  await prepare(page, base, { sample: false, route: '#/focus' })
  const scripts = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.js(?:\?|$)/.test(r.name)).map(r => ({ file: r.name.split('/').at(-1), bytes: r.decodedBodySize })))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.evaluate(() => { window.loadStarted = performance.now(); location.hash = '#/atlas' })
  await page.waitForFunction(() => document.querySelector('[role=application] svg path'))
  const atlasWarmRouteMs = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - window.loadStarted)))))
  await page.waitForTimeout(500)
  const heap = await cdp.send('Runtime.getHeapUsage')
  runs.push({ label, environment: '390x844 headless Chromium; warmed/onboarded application, Atlas entry at 4x CPU', scriptsBeforeAtlas: scripts, requestedJsBeforeAtlasBytes: scripts.reduce((n, s) => n + s.bytes, 0), atlasWarmRouteMs, heap })
  await browser.close()
}
writeFileSync(new URL('./out/vnext-load.json', import.meta.url), JSON.stringify(runs, null, 2) + '\n')
console.log(JSON.stringify(runs, null, 2))
