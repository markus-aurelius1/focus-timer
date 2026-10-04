/** Real-font placement parity for the shared main/worker implementation, including hidden, linked and retained labels. */
import { fontSources } from '../../src/features/atlas/renderer/fontSources'
import { decodeSheet } from '../../src/atlas/sheet'
import type { Place } from '../../src/atlas/types'
import { labelIndexFor, labelKeyOf, layoutLabels, STYLE_SPEC, type LayoutInput, type PlacedLabel } from '../../src/features/atlas/labels'
import { WordSprites } from '../../src/features/atlas/renderer/wordSprites'
import { curveGeometry } from '../../src/features/atlas/renderer/curvePainter'
import { labelPaint } from '../../src/features/atlas/renderer/labelPaint'
export async function compareLabelLayouts() {
  await Promise.all(
    fontSources.map(async ([source, unicodeRange]) => {
      const font = new FontFace('Manrope', source, { weight: '200 800', unicodeRange })
      await font.load()
      document.fonts.add(font)
    }),
  )
  await document.fonts.load('500 100px Manrope')
  await document.fonts.load('700 100px Manrope')
  await document.fonts.ready
  const assetBase = new URL(new URLSearchParams(location.search).get('assets') ?? 'http://localhost:4173/').href
  const load = (path: string) => fetch(assetBase + path).then((r) => r.json())
  const places = (await load('atlas/v1/places.json')).places as Place[]
  const rows = []
  for (const id of ['india', 'world'] as const) {
    const sheet = decodeSheet(await load('atlas/v1/' + id + '.json'), assetBase, await load('atlas/v1/' + id + '-overlay.json'))
    const worker = new Worker(new URL('../../src/features/atlas/renderer/labelWorker.ts', import.meta.url), { type: 'module' })
    let serial = 0
    try {
      const ready = new Promise<void>((resolve, reject) => {
        worker.onmessage = (event) => (event.data.type === 'ready' ? resolve() : reject(new Error(event.data.error)))
        worker.onerror = reject
      })
      worker.postMessage({ type: 'init', labels: sheet.labels, width: sheet.width, height: sheet.height })
      await ready
      for (const [width, height] of [
        [390, 844],
        [1440, 900],
        [1920, 1080],
      ]) {
        let prefer = new Map<string, number>()
        const fit = Math.max(width / sheet.width, height / sheet.height)
        for (const zoom of [1, 2, 4]) {
          const k = fit * zoom,
            t = { k, x: width / 2 - ((sheet.focus[0] + sheet.focus[2]) / 2) * k, y: height / 2 - ((sheet.focus[1] + sheet.focus[3]) / 2) * k }
          const source = places
            .filter((p) => p.sheet === id)
            .map((place) => ({ place, x: place.x * k + t.x, y: place.y * k + t.y, mastery: 'discovered' as const, selected: false, isNew: false }))
            .filter((p) => p.x >= -200 && p.y >= -200 && p.x <= width + 200 && p.y <= height + 200)
          const river = sheet.labels.find((l) => l.kind === 'river')
          const input: LayoutInput = {
            labels: sheet.labels,
            index: labelIndexFor(sheet.labels, sheet.width, sheet.height),
            places: source,
            t,
            kFit: fit,
            width,
            height,
            sheetId: id,
            mutedIds: new Set(river ? [labelKeyOf(river)] : []),
            linked: new Map(river && source[0] ? [[labelKeyOf(river), source[0].place.id]] : []),
            foggedStates: new Set(),
            hidden: new Set(sheet.labels[0] ? [labelKeyOf(sheet.labels[0])] : []),
            overscan: 200,
            prefer,
          }
          const expected = layoutLabels(input)
          const response = new Promise<PlacedLabel[]>((resolve, reject) => {
            worker.onmessage = (event) => (event.data.type === 'labels' ? resolve(event.data.labels) : reject(new Error(event.data.error)))
          })
          const { labels: _labels, index: _index, ...transport } = input
          worker.postMessage({ type: 'layout', id: ++serial, input: transport, tone: 'day', dpr: 3 })
          const actual = await response
          let pixelMaxMae = 0,
            curves = 0
          const sprites = new WordSprites()
          for (const label of actual) {
            const bitmap = label.curveBitmap
            if (!bitmap) continue
            curves++
            const geometry = curveGeometry(label)!,
              spec = STYLE_SPEC[label.style],
              paint = labelPaint(label, 'day')
            const reference = document.createElement('canvas'),
              raster = document.createElement('canvas')
            reference.width = raster.width = bitmap.width
            reference.height = raster.height = bitmap.height
            const ctx = reference.getContext('2d', { willReadFrequently: true })!,
              compared = raster.getContext('2d', { willReadFrequently: true })!
            ctx.scale(3, 3)
            const style = {
              font: (spec.italic ? 'italic ' : '') + spec.weight + ' ' + label.size + 'px ' + paint.fontFamily,
              size: label.size,
              spacing: spec.spacing * label.size,
              halo: paint.halo,
              haloWidth: paint.haloWidth,
              color: paint.color,
            }
            const glyphs = [...label.text].map((c) => sprites.get(c, style, 3))
            for (const stroke of [true, false])
              for (const [i, g] of geometry.curve.glyphs.entries()) {
                const sprite = glyphs[i]
                ctx.save()
                ctx.translate(g.x - geometry.minX, g.y - geometry.minY)
                ctx.rotate(g.angle)
                ctx.drawImage(stroke ? sprite.stroke : sprite.fill, sprite.x, sprite.y, sprite.width, sprite.height)
                ctx.restore()
              }
            compared.drawImage(bitmap, 0, 0)
            bitmap.close()
            const a = ctx.getImageData(0, 0, reference.width, reference.height).data,
              b = compared.getImageData(0, 0, raster.width, raster.height).data
            let delta = 0
            for (let i = 0; i < a.length; i++) delta += Math.abs(a[i] - b[i])
            pixelMaxMae = Math.max(pixelMaxMae, delta / a.length)
            reference.width = reference.height = raster.width = raster.height = 0
          }
          sprites.close()
          const same =
            pixelMaxMae < 2 &&
            actual.length === expected.length &&
            actual.every((a, i) => {
              const b = expected[i]
              return (
                a.key === b.key &&
                a.text === b.text &&
                a.anchor === b.anchor &&
                a.style === b.style &&
                a.opt === b.opt &&
                a.path === b.path &&
                Math.abs(a.x - b.x) < 0.01 &&
                Math.abs(a.y - b.y) < 0.01 &&
                Math.abs(a.size - b.size) < 0.01 &&
                Math.abs(a.measuredWidth! - b.measuredWidth!) < 0.1 &&
                Math.abs(a.baseline! - b.baseline!) < 0.1 &&
                (a.glyphAdvances ?? []).every((n, j) => Math.abs(n - b.glyphAdvances![j]) < 0.1)
              )
            })
          const differences = actual
            .flatMap((a, i) => {
              const b = expected[i]
              return !b || JSON.stringify(a) === JSON.stringify(b) ? [] : [{ actual: a, expected: b }]
            })
            .slice(0, 3)
          rows.push({ id, width, height, zoom, pixelMaxMae, curves, labels: expected.length, actualLabels: actual.length, pass: same, differences: same ? [] : differences })
          prefer = new Map(expected.filter((l) => l.opt !== undefined).map((l) => [l.key, l.opt!]))
        }
      }
    } finally {
      worker.terminate()
    }
  }
  return rows
}
