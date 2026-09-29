/**
 * Where does the time go during a gesture? Records a Chrome trace (phone
 * viewport, 4× CPU throttle) while wheel-zooming or panning the Atlas, and
 * prints main-thread time by event type, the slowest single events, and the
 * work done per animation frame.
 *
 *   node trace.mjs [wheel|notch|pan|pinch] [baseUrl]
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch, prepare } from './lib.mjs'

const kind = process.argv[2] ?? 'wheel'
const base = process.argv[3] ?? 'http://localhost:4173/'
const { browser, ctx, page } = await launch({ touch: kind === 'pinch' })
page.on('pageerror', (e) => console.log('pageerror', e.message))
await prepare(page, base, { route: process.env.ROUTE ?? '#/atlas' })
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE ?? 4) })
const box = await page.locator('[role=application]').boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2 - 60

if (kind === 'wheelout') {
  // Start zoomed in (not traced), then trace the zoom out.
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, -40)
    await page.waitForTimeout(12)
  }
  await page.waitForTimeout(1000)
}
const events = []
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' })

if (kind === 'wheelout') {
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 40)
    await page.waitForTimeout(12)
  }
  await page.waitForTimeout(600)
} else if (kind === 'wheel' || kind === 'notch') {
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, kind === 'notch' ? -100 : -40)
    await page.waitForTimeout(kind === 'notch' ? 90 : 12)
  }
  await page.waitForTimeout(600)
} else if (kind === 'pan') {
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 80; i++) {
    await page.mouse.move(cx - i * 2, cy - i)
    await page.waitForTimeout(8)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
} else if (kind === 'pinch') {
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
  for (let i = 1; i <= 40; i++) {
    await touch('touchMove', [[cx - 40 - i * 3, cy], [cx + 40 + i * 3, cy]])
    await page.waitForTimeout(16)
  }
  await touch('touchEnd', [])
  await page.waitForTimeout(600)
}

await cdp.send('Tracing.end')
await done
await browser.close()

const main = events.filter((e) => e.ph === 'X' && e.dur)
// The renderer main thread: the one running the most "FunctionCall"/layout work.
const byThread = new Map()
for (const e of main) if (/^(Layout|UpdateLayoutTree|Paint|FunctionCall|EventDispatch)$/.test(e.name)) byThread.set(`${e.pid}:${e.tid}`, (byThread.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur)
const [mainThread] = [...byThread].sort((a, b) => b[1] - a[1])[0] ?? []
const onMain = main.filter((e) => `${e.pid}:${e.tid}` === mainThread)
const sum = new Map()
for (const e of onMain) sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur / 1000)
console.log(`\n${kind}: main-thread time by event (ms, nested events overlap)`)
for (const [n, ms] of [...sum].sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(`  ${n.padEnd(28)} ${ms.toFixed(0)}`)
console.log('\nslowest events')
for (const e of [...onMain].filter((e) => !/^(RunTask|ThreadControllerImpl::RunTask|RunMicrotasks)$/.test(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 12))
  console.log(`  ${e.name.padEnd(24)} ${(e.dur / 1000).toFixed(1)} ms ${e.args?.data?.functionName ?? e.args?.data?.url?.split('/').pop() ?? ''} ${e.args?.beginData?.dirtyObjects ? `dirty=${e.args.beginData.dirtyObjects}` : ''}`)
writeFileSync(fileURLToPath(new URL(`./out/trace-${kind}.json`, import.meta.url)), JSON.stringify(events))
