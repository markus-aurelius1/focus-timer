/**
 * J-23 isolated compositing/label experiment. Uses the shipped SVG and names
 * at the phone shape, then measures identical paths with pre-rasterised tiles.
 * Nothing here is imported by the app. Results describe this Windows Chrome
 * workload, not a physical phone or the cost of producing/cache-replacing tiles.
 * node tools/perf/atlas-renderer-spike.mjs [previewUrl]
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const out = 'tools/perf/out/atlas-renderer-spike'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await prepare(page, base, { route: '#/atlas' })
await page.waitForFunction(() => !document.querySelector('.atlas-moving'))
await page.evaluate(async () => {
  const atlas = document.querySelector('.atlas')
  const layer = atlas.querySelector('.atlas-layer')
  const svg = layer.querySelector('svg').cloneNode(true)
  const w = layer.offsetWidth, h = layer.offsetHeight
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', w)
  svg.setAttribute('height', h)
  for (const image of svg.querySelectorAll('image')) {
    const blob = await (await fetch(image.getAttribute('href'))).blob()
    const data = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob) })
    image.setAttribute('href', data)
  }
  const image = new Image()
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  image.src = url
  await image.decode()
  const bitmap = await createImageBitmap(image, { resizeWidth: w * 3, resizeHeight: h * 3 })
  URL.revokeObjectURL(url)
  const box = atlas.getBoundingClientRect()
  const names = [...atlas.querySelectorAll('.atlas-name:not([data-beyond])')].map((name) => {
    const r = name.getBoundingClientRect()
    return { node: name.cloneNode(true), x: r.x - box.x, y: r.y - box.y }
  })
  window.__spike = { bitmap, w, h, mapW: box.width, mapH: box.height, left: parseFloat(layer.style.left), top: parseFloat(layer.style.top), names }
  document.getElementById('root').style.display = 'none'
})
const cdp = await context.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const results = []
for (let repeat = 0; repeat < 3; repeat++) {
  for (const mode of ['tiles-css', 'canvas-redraw', 'names-unscaled', 'names-bounded']) {
    const result = await page.evaluate(async ({ mode, repeat }) => {
      const data = window.__spike
      const root = document.createElement('div')
      root.style.cssText = `position:fixed;inset:0 auto auto 0;width:${data.mapW}px;height:${data.mapH}px;overflow:hidden;background:#ddd;contain:strict`
      document.body.append(root)
      const group = document.createElement('div')
      group.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;will-change:transform'
      root.append(group)
      let tileCount = 0
      const canvas = document.createElement('canvas')
      if (mode === 'canvas-redraw') {
        canvas.width = data.mapW * 3; canvas.height = data.mapH * 3
        canvas.style.cssText = 'width:100%;height:100%'
        root.append(canvas)
      } else {
        // Each tile is independent; the base source is identical for both modes.
        for (let y = 0; y < data.h; y += 256) for (let x = 0; x < data.w; x += 256) {
          const tile = document.createElement('canvas')
          const w = Math.min(256, data.w - x), h = Math.min(256, data.h - y)
          tile.width = w * 3; tile.height = h * 3
          tile.getContext('2d').drawImage(data.bitmap, x * 3, y * 3, w * 3, h * 3, 0, 0, w * 3, h * 3)
          tile.style.cssText = `position:absolute;left:${x + data.left}px;top:${y + data.top}px;width:${w}px;height:${h}px`
          group.append(tile); tileCount++
        }
      }
      const names = document.createElement('div')
      names.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;contain:layout style'
      root.append(names)
      const entries = mode.startsWith('names-') ? data.names.map((name) => {
        const node = name.node.cloneNode(true)
        node.style.scale = ''
        node.style.left = `${name.x}px`; node.style.top = `${name.y}px`
        names.append(node)
        return { node, x: name.x, y: name.y }
      }) : []
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const frameTimes = [], submitTimes = []
      let previous, layoutScale = 1, labelWrites = 0, layouts = 0, maxNameScale = 1, minNameScale = 1
      const ctx = canvas.getContext('2d')
      for (let i = 0; i < 180; i++) {
        const stamp = await new Promise((r) => requestAnimationFrame(r))
        if (previous !== undefined) frameTimes.push(stamp - previous)
        previous = stamp
        const start = performance.now()
        const p = i / 179, scale = 1 + p, dx = -120 * p, dy = -180 * p
        if (mode === 'canvas-redraw') {
          ctx.setTransform(3, 0, 0, 3, 0, 0)
          ctx.clearRect(0, 0, data.mapW, data.mapH)
          ctx.translate(dx, dy); ctx.scale(scale, scale)
          ctx.drawImage(data.bitmap, data.left, data.top, data.w, data.h)
        } else group.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${scale})`
        if (mode === 'names-unscaled') {
          for (const n of entries) {
            n.node.style.transform = `translate3d(${n.x * (scale - 1) + dx}px,${n.y * (scale - 1) + dy}px,0)`
            labelWrites++
          }
        } else if (mode === 'names-bounded') {
          if (scale / layoutScale > 1.08) {
            layoutScale = scale; layouts++
            for (const n of entries) {
              n.node.style.left = `${n.x * layoutScale}px`; n.node.style.top = `${n.y * layoutScale}px`
              labelWrites += 2
            }
          }
          const renderedScale = scale / layoutScale
          maxNameScale = Math.max(maxNameScale, renderedScale)
          minNameScale = Math.min(minNameScale, renderedScale)
          names.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${renderedScale})`
        }
        submitTimes.push(performance.now() - start)
      }
      const stats = (samples) => {
        const sorted = [...samples].sort((a, b) => a - b)
        return { p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted.at(-1), over100: samples.filter((v) => v > 100).length }
      }
      const result = { mode, repeat, frames: stats(frameTimes), submitMs: stats(submitTimes), tileCount, names: entries.length, labelWrites, layouts, minNameScale, maxNameScale }
      root.remove()
      return result
    }, { mode, repeat })
    results.push(result)
    console.log(JSON.stringify(result))
  }
}
const metadata = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, throttle: 4, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', source: { width: window.__spike.w, height: window.__spike.h } }
})
await page.evaluate(() => window.__spike.bitmap.close())
writeFileSync(`${out}/phone.json`, JSON.stringify({ metadata, results, errors, limitations: ['pre-rasterised compositing only; no tile generation or eviction measured', 'bounded mode repositions the same label set; no collision-layout work measured', 'desktop Chrome at a phone viewport; not a physical-device measurement'] }, null, 2))
await browser.close()
if (errors.length) process.exitCode = 1
