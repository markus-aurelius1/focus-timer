/**
 * Micro-probes of the Atlas's rendering costs in a real page (phone viewport,
 * 4× CPU throttle): how long a forced style+layout takes after
 *   - moving the base-map SVG group (what a repaint at rest does),
 *   - touching the river-name <textPath>s,
 *   - touching the HTML point names.
 *
 *   node probe.mjs [baseUrl]
 */
import { launch, prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const { browser, ctx, page } = await launch()
await prepare(page, base, { route: process.env.ROUTE ?? '#/atlas' })
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const r = await page.evaluate(() => {
  const time = (fn) => {
    const out = []
    for (let i = 0; i < 6; i++) {
      document.body.getBoundingClientRect()
      const t0 = performance.now()
      fn(i)
      document.body.getBoundingClientRect()
      getComputedStyle(document.body).color
      out.push(performance.now() - t0)
    }
    out.sort((a, b) => a - b)
    return +out[3].toFixed(1)
  }
  const world = document.querySelector('.atlas-layer svg > g')
  const tf = world.getAttribute('transform')
  const baseMap = time((i) => world.setAttribute('transform', tf.replace(/scale\(([\d.]+)\)/, (_, k) => `scale(${Number(k) * (1 + (i + 1) * 0.01)})`)))
  world.setAttribute('transform', tf)
  const paths = [...document.querySelectorAll('.atlas-labels textPath')]
  const riverNames = time((i) => paths.forEach((p) => p.setAttribute('startOffset', `${50 + (i % 2)}%`)))
  const names = [...document.querySelectorAll('.atlas-name')]
  const pointNames = time((i) => names.forEach((n) => (n.style.left = `${parseFloat(n.style.left) + (i % 2 ? 1 : -1)}px`)))
  const svgPaths = document.querySelectorAll('.atlas-layer svg path').length
  const pathChars = [...document.querySelectorAll('.atlas-layer svg path')].reduce((a, p) => a + (p.getAttribute('d')?.length ?? 0), 0)
  const ns = [...document.querySelectorAll('.atlas-layer svg [vector-effect]')].length
  return { baseMap, riverNames, pointNames, counts: { riverNames: paths.length, pointNames: names.length, baseMapPaths: svgPaths, nonScalingStroke: ns, pathKB: Math.round(pathChars / 1024) } }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
