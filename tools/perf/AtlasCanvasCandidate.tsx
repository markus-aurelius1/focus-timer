/** Unshipped full-app comparison: worker word bitmaps and static symbol sprites on a viewport canvas. */
import { createPortal } from 'react-dom'
import { spriteCanvas } from './spriteCanvas'
import { useState, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import type { Sheet } from '@/atlas/sheet'
import type { Place } from '@/atlas/types'
import { glyphAdvances, labelKeyOf, measureLabel, STYLE_SPEC, baselineFromTop, type PlacedLabel, type Transform } from '@/features/atlas/labels'
import { labelPaint } from '@/features/atlas/renderer/glyphs'
import { curveGlyphs } from '@/features/atlas/renderer/labelMotion'
import type { Layout, Tone } from '@/features/atlas/renderer/types'
export type LabelPort = (view: Transform) => void
interface Props {
  labels: PlacedLabel[]
  layout: Layout | null
  tone: Tone
  sheet: Sheet
  places: Place[]
  port: MutableRefObject<LabelPort | null>
  current: () => Transform
  symbols: Array<{ place: Place; content: ReactNode }>
  symbolHost: MutableRefObject<HTMLDivElement | null>
}
export function LabelLayer(props: Props) {
  const [detached] = useState(() => document.createElement('div'))
  const canvas = useRef<HTMLCanvasElement>(null),
    hidden = useRef<HTMLDivElement>(null),
    engine = useRef<any>(null)
  const sourcePoints = useMemo(() => new Map(props.sheet.labels.map((l) => [labelKeyOf(l), l])), [props.sheet])
  const placePoints = useMemo(() => new Map(props.places.map((p) => [p.id, p])), [props.places])
  useEffect(() => {
    const node = canvas.current!,
      dpr = devicePixelRatio || 1,
      ctx = spriteCanvas(node, dpr),
      worker = new Worker(new URL('./atlasCandidateWorker.ts', import.meta.url), { type: 'module' })
    const textures = new Map<string, ImageBitmap>(),
      pending = new Map<number, string>(),
      requested = new Set<string>(),
      born = new Map<string, number>()
    const data: any = { words: [], symbols: [], view: props.current(), times: [], alive: true, serial: 0 }
    let scheduled = false,
      fade = 0
    const keep = (key: string, bitmap: ImageBitmap) => {
      textures.get(key)?.close()
      textures.delete(key)
      textures.set(key, bitmap)
      ctx.upload(bitmap)
      while (textures.size > 192) {
        const key = textures.keys().next().value!
        textures.get(key)!.close()
        textures.delete(key)
      }
    }
    const schedule = () => {
      if (scheduled || !data.alive) return
      scheduled = true
      requestAnimationFrame(draw)
    }
    const draw = () => {
      scheduled = false
      if (!data.alive) return
      const start = performance.now(),
        now = start,
        v = data.view
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, node.width / dpr, node.height / dpr)
      let fading = false
      for (const item of [...data.symbols, ...data.words]) {
        const image = textures.get(item.texture) || textures.get(item.fallback)
        if (!image) continue
        if (!born.has(item.id)) born.set(item.id, now)
        const alpha = Math.max(0, Math.min(1, (now - born.get(item.id)! - item.delay) / 220))
        ctx.globalAlpha = alpha
        if (alpha < 1) fading = true
        const x = v.x + item.worldX * v.k + item.offsetX,
          y = v.y + item.worldY * v.k + item.offsetY
        if (x + item.x + item.width > 0 && y + item.y + item.height > 0 && x + item.x < node.width / dpr && y + item.y < node.height / dpr) ctx.drawImage(image, x + item.x, y + item.y, item.width, item.height)
      }
      ctx.globalAlpha = 1
      ctx.flush()
      data.times.push(performance.now() - start)
      if (data.times.length > 240) data.times.shift()
      Object.assign(node, {
        atlasPositionTimes: data.times,
        atlasDrawn: data.words.map((w: any) => ({ key: w.id, text: w.text, font: w.font, x: v.x + w.worldX * v.k + w.offsetX, y: v.y + w.worldY * v.k + w.offsetY, width: w.width, height: w.height })),
        atlasTextures: textures.size,
      })
      cancelAnimationFrame(fade)
      if (fading) fade = requestAnimationFrame(schedule)
    }
    worker.onmessage = async (event) => {
      const { bitmap, id } = event.data,
        key = pending.get(id)
      pending.delete(id)
      if (!data.alive || !key) {
        bitmap.close()
        return
      }
      requested.delete(key)
      keep(key, bitmap)
      schedule()
    }
    data.word = (word: any, key: string) => {
      if (textures.has(key) || requested.has(key)) return
      requested.add(key)
      const id = ++data.serial
      pending.set(id, key)
      worker.postMessage({ word, dpr, id })
    }
    const symbolJobs: Array<{ key: string; svg: string }> = []
    let symbolBusy = false
    const pumpSymbols = () => {
      if (symbolBusy || !symbolJobs.length || !data.alive) return
      symbolBusy = true
      const { key, svg } = symbolJobs.shift()!
      const render = async () => {
        const image = new Image()
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        try {
          await image.decode()
          if (!data.alive) return
          const buffer = document.createElement('canvas')
          buffer.width = buffer.height = 48 * dpr
          buffer.getContext('2d')!.drawImage(image, 0, 0, buffer.width, buffer.height)
          const bitmap = await createImageBitmap(buffer)
          buffer.width = buffer.height = 0
          if (!data.alive) bitmap.close()
          else { keep(key, bitmap); schedule() }
        } finally { requested.delete(key); symbolBusy = false; pumpSymbols() }
      }
      if ('requestIdleCallback' in window) window.requestIdleCallback(() => { void render() }, { timeout: 500 })
      else setTimeout(() => { void render() }, 0)
    }
    data.symbol = (key: string, svg: string) => {
      if (textures.has(key) || requested.has(key)) return
      requested.add(key)
      symbolJobs.push({ key, svg })
      pumpSymbols()
    }
    data.schedule = schedule
    engine.current = data
    props.port.current = (view) => {
      data.view = view
      draw()
    }
    schedule()
    return () => {
      data.alive = false
      worker.terminate()
      ctx.close()
      cancelAnimationFrame(fade)
      for (const bitmap of textures.values()) bitmap.close()
      engine.current = null
      props.port.current = null
    }
  }, [props.sheet])
  useLayoutEffect(() => {
    const data = engine.current,
      node = canvas.current,
      layout = props.layout
    if (!data || !node || !layout) return
    const dpr = devicePixelRatio || 1,
      width = Math.round(layout.w * dpr),
      height = Math.round(layout.h * dpr)
    if (node.width !== width || node.height !== height) {
      node.width = width
      node.height = height
    }
    const previous = new Map(data.words.map((w: any) => [w.id, w.texture]))
    data.words = props.labels
      .filter((l) => l.text)
      .map((label) => {
        const spec = STYLE_SPEC[label.style],
          paint = labelPaint(label, props.tone),
          source = label.key.startsWith('place:') ? placePoints.get(label.placeId ?? label.key.slice(6)) : sourcePoints.get(label.key)
        const spacing = spec.spacing * label.size,
          baseline = label.baseline ?? baselineFromTop(label.style, label.size),
          textWidth = label.measuredWidth ?? measureLabel(label.text, label.size, spec.weight, spec.italic, spec.spacing)
        // HTML point names disable synthetic italics; river lettering follows the original SVG convention.
        const word: any = {
          text: label.text,
          font: (label.path && spec.italic ? 'italic ' : '') + spec.weight + ' ' + label.size + 'px ' + paint.fontFamily,
          spacing,
          halo: paint.halo,
          haloWidth: paint.haloWidth,
          color: paint.color,
          curve: !!label.path,
          baseline,
          width: Math.ceil(textWidth + 6),
          height: Math.ceil(label.size * 1.25 + 6),
          x: -(label.anchor === 'middle' ? textWidth / 2 : label.anchor === 'end' ? textWidth : 0) - 3,
          y: -baseline - 3,
        }
        let worldX = source?.x ?? (label.x - layout.fx) / layout.k,
          worldY = source?.y ?? (label.y - layout.fy) / layout.k,
          offsetX = label.x - worldX * layout.k - layout.fx,
          offsetY = label.y - worldY * layout.k - layout.fy
        if (label.path) {
          const advances = label.glyphAdvances ?? glyphAdvances(label.text, label.size, spec.weight, spec.italic, spec.spacing),
            curve = curveGlyphs(label.path, advances)!
          word.glyphs = curve.glyphs
          word.minX = Math.min(...curve.glyphs.map((g) => g.x)) - label.size * 2
          word.minY = Math.min(...curve.glyphs.map((g) => g.y)) - label.size * 2
          word.width = Math.ceil(Math.max(...curve.glyphs.map((g) => g.x)) - word.minX + label.size * 2)
          word.height = Math.ceil(Math.max(...curve.glyphs.map((g) => g.y)) - word.minY + label.size * 2)
          word.x = word.minX
          word.y = word.minY
          worldX = (curve.centre.x - layout.x) / layout.k
          worldY = (curve.centre.y - layout.y) / layout.k
          offsetX = offsetY = 0
        }
        const texture = JSON.stringify(word)
        data.word(word, texture)
        return {
          ...word,
          id: label.key,
          texture,
          fallback: previous.get(label.key),
          worldX,
          worldY,
          offsetX,
          offsetY,
          delay: Math.abs([...label.key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % 130,
        }
      })
    data.symbols = props.symbols
      .map(({ place }) => {
        const svg = hidden.current?.querySelector('[data-marker="' + CSS.escape(place.id) + '"] svg')
        if (!svg) return null
        let source = svg.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/data-place="[^"]*"/g, '')
        const ids = [...source.matchAll(/url\(#([^)]*)\)/g)].map((m) => m[1]),
          defs = ids.map((id) => document.getElementById(id)?.outerHTML ?? '').join('')
        source = source.replace('>', '><defs>' + defs + '</defs>')
        data.symbol(source, source)
        return { id: place.id, texture: source, worldX: place.x, worldY: place.y, offsetX: 0, offsetY: 0, x: -24, y: -24, width: 48, height: 48, delay: 0 }
      })
      .filter(Boolean)
    data.view = props.current()
    data.schedule()
  }, [props.labels, props.layout, props.tone, props.symbols])
  // The hidden DOM is only diagnostic/interaction metadata in this candidate, not a claimed HTML renderer.
  return (
    <>
      {createPortal(<div
        ref={(node) => {
          hidden.current = node
          props.symbolHost.current = node
        }}
        style={{ display: 'none' }}
      >
        {props.symbols.map(({ place, content }) => (
          <span data-marker={place.id} key={place.id}>
            {content}
          </span>
        ))}
      </div>, detached)}
      <canvas ref={canvas} className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ width: '100%', height: '100%' }} data-canvas-candidate="true" />
    </>
  )
}
