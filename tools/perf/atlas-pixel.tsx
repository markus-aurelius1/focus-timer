/** Unshipped parity harness: the preserved SVG reference versus the shared tile painter. */
import { createElement } from 'react'
import { compareLabelLayouts } from './atlasLabelParity'
import { renderToStaticMarkup } from 'react-dom/server'
import { decodeSheet } from '../../src/atlas/sheet'
import { BaseMap } from '../../src/features/atlas/renderer/SvgLayers'
import { TilePainter } from '../../src/features/atlas/renderer/tilePainter'
import { colourAssignment } from '../../src/features/atlas/style'
import { TONES } from '../../src/features/atlas/renderer/palette'
const assetBase = new URL(new URLSearchParams(location.search).get('assets') ?? 'http://localhost:4173/').href
const load = (url: string) => fetch(assetBase + url).then((r) => r.json())
const dataUrl = async (url: string): Promise<string> => {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}
async function compare(fallback = false) {
  const results = []
  for (const id of ['india', 'world'] as const) {
    const sheet = decodeSheet(await load('atlas/v1/' + id + '.json'), assetBase, await load('atlas/v1/' + id + '-overlay.json'))
    const painter = await TilePainter.create(sheet)
    const relief = await dataUrl(sheet.reliefUrl),
      shade = await dataUrl(sheet.shadeUrl)
    const colours = colourAssignment(id === 'india' ? sheet.states.map((s) => s.id) : sheet.countries.map((s) => s.id), id === 'india' ? sheet.stateNeighbours : new Map())
    for (const mode of ['physical', 'political', 'night', 'antique'] as const)
      for (const level of fallback ? [Math.floor(Math.log2(512 / Math.max(sheet.width, sheet.height)))] : [-1, 0, 1])
        for (const sample of fallback ? [0, 1, 2] : [0, 1, 2, 3]) {
          const scale = 2 ** level
          const inkK = fallback ? scale * [2, 8, 16][sample] : scale
          const strokeFactor = scale / inkK
          // Source vertices, controlled-region outlines and a travelled polygon are explicit parity samples.
          const border = sheet.lines[id === 'india' ? 'indiaBorder' : 'intlBorders']
          const numbers = border.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
          const points: number[][] = []
          for (let i = 0; i < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]])
          const travelled = id === 'india' ? sheet.states[0] : sheet.countries[0]
          const controlled = sheet.areas.find((a) => a.kind === 'region')
          const feature = sample === 3 ? travelled : sample === 2 ? controlled : undefined
          const target = feature
            ? [(feature.bbox[0] + feature.bbox[2]) / 2, (feature.bbox[1] + feature.bbox[3]) / 2]
            : sample === 1
              ? points.reduce((a, b) => (b[0] > a[0] ? b : a))
              : sample === 2
                ? points.reduce((a, b) => (b[1] < a[1] ? b : a))
                : points.reduce((a, b) => (b[0] < a[0] ? b : a))
          const [cx, cy] = target
          const tile = { level, x: Math.floor((cx * scale) / 512), y: Math.floor((cy * scale) / 512) }
          const style = {
            plate: mode === 'political' ? ('political' as const) : ('physical' as const),
            tone: mode === 'night' ? ('night' as const) : mode === 'antique' ? ('antique' as const) : ('day' as const),
            colours: [...colours],
            explored: [id === 'india' ? sheet.states[0].id : sheet.countries[0].id],
            showAreas: true,
            paper: mode === 'night' ? TONES.night.paper : mode === 'antique' ? TONES.antique.paper : '#f6f2e9',
          }
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 512
          const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false })!
          // The production progress cache replaces a base tile with this complete result. It never blends a second boundary stroke.
          painter.draw(ctx, { tile, style, inkK, dpr: 1, id: 0, generation: 0 })
          const markup = renderToStaticMarkup(
            createElement(BaseMap, { sheet: { ...sheet, reliefUrl: relief, shadeUrl: shade }, plate: style.plate, tone: style.tone, colours, explored: new Set(style.explored), showAreas: true }),
          )
            .replace(/stroke-width="([\d.]+)"/g, (_, width) => 'stroke-width="' + Number(width) * strokeFactor + '"')
            .replace(
              /stroke-dasharray="([\d. ,]+)"/g,
              (_, dash) =>
                'stroke-dasharray="' +
                dash
                  .split(/[ ,]+/)
                  .map((n: string) => Number(n) * strokeFactor)
                  .join(' ') +
                '"',
            )
          const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><clipPath id="clip"><rect width="' +
            sheet.width +
            '" height="' +
            sheet.height +
            '"/></clipPath></defs><g transform="translate(' +
            -tile.x * 512 +
            ',' +
            -tile.y * 512 +
            ') scale(' +
            scale +
            ')"><g clip-path="url(#clip)">' +
            markup +
            '</g><rect width="' +
            sheet.width +
            '" height="' +
            sheet.height +
            '" fill="none" stroke="' +
            TONES[style.tone].neatline +
            '" stroke-width="' +
            1.2 * strokeFactor +
            '" vector-effect="non-scaling-stroke"/></g></svg>'
          const image = new Image()
          image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
          await image.decode()
          const ref = document.createElement('canvas')
          ref.width = ref.height = 512
          const rc = ref.getContext('2d', { willReadFrequently: true })!
          rc.fillStyle = style.paper
          rc.fillRect(0, 0, 512, 512)
          rc.drawImage(image, 0, 0)
          const a = ctx.getImageData(0, 0, 512, 512).data,
            b = rc.getImageData(0, 0, 512, 512).data
          let sum = 0,
            high = 0,
            maximum = 0
          for (let i = 0; i < a.length; i += 4) {
            let difference = 0
            for (let c = 0; c < 4; c++) {
              const delta = Math.abs(a[i + c] - b[i + c])
              sum += delta
              difference = Math.max(difference, delta)
              maximum = Math.max(maximum, delta)
            }
            if (difference > 32) high++
          }
          const row = { id, mode, level, inkK, fallback, sample, featureId: feature?.id, tile, mae: sum / a.length, highPercent: (100 * high) / (512 * 512), maximum }
          results.push(row)
          // Retain representative controlled-region and coarse fallback pairs, rather than
          // 240 full-size canvases and one screenshot taller than Chrome can reliably capture.
          if ((sample === 2 && level === 0) || (fallback && sample === 2)) {
            const pair = document.createElement('section')
            pair.dataset.parityCase = [id, mode, level, sample, fallback ? 'fallback' : 'detail'].join('-')
            const heading = document.createElement('p')
            heading.textContent = 'SVG reference (left) / tile painter (right): ' + JSON.stringify(row)
            pair.append(heading, ref, canvas)
            document.body.append(pair)
          } else {
            ref.width = ref.height = canvas.width = canvas.height = 0
          }
        }
    painter.close()
  }
  return results
}
Object.assign(window, { compareAtlas: compare, compareAtlasFallback: () => compare(true), compareLabelLayouts })
