/** Placement runs off the frame path with the same fonts, priorities, course windows and collision rules. */
import { labelIndexFor, layoutLabels, setLabelMeasureContext, type LayoutInput } from '../labels'
import type { MapLabel } from '@/atlas/types'
import { workerFonts } from './workerFonts'
import { curveGeometry, paintCurve } from './curvePainter'
import type { Tone } from './types'
import { WordSprites } from './wordSprites'
const sprites = new WordSprites(256, () => new OffscreenCanvas(1, 1))
let labels: MapLabel[] = []
let index: LayoutInput['index']
const scope = self as unknown as { postMessage(value: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent) => void) | null }
scope.onmessage = (event: MessageEvent<{ type: string; labels?: MapLabel[]; width: number; height: number; id: number; input: LayoutInput; dpr?: number; tone?: Tone }>) => {
  const message = event.data
  if (message.type === 'init') {
    labels = message.labels!
    index = labelIndexFor(labels, message.width, message.height)
    void workerFonts
      .then(() => {
        const ctx = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('No worker label measurement context')
        setLabelMeasureContext(ctx)
        scope.postMessage({ type: 'ready' })
      })
      .catch((error: unknown) => scope.postMessage({ type: 'error', error: String(error) }))
  } else if (message.type === 'layout') {
    const bitmaps: ImageBitmap[] = []
    try {
      const placed = layoutLabels({ ...message.input, labels, index })
      if (message.dpr)
        for (const label of placed) {
          if (!label.path) continue
          const geometry = curveGeometry(label)
          if (!geometry) continue
          const canvas = new OffscreenCanvas(Math.ceil(geometry.width * message.dpr), Math.ceil(geometry.height * message.dpr))
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) throw new Error('No worker curve context')
          paintCurve(ctx, label, message.tone ?? 'day', message.dpr, sprites)
          label.curveBitmap = canvas.transferToImageBitmap()
          bitmaps.push(label.curveBitmap)
          canvas.width = canvas.height = 0
        }
      scope.postMessage({ type: 'labels', id: message.id, labels: placed }, bitmaps)
    } catch (error) {
      for (const bitmap of bitmaps) bitmap.close()
      scope.postMessage({ type: 'error', error: String(error) })
    }
  }
}
