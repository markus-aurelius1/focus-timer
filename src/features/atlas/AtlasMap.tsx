/**
 * The Atlas map, built to stay smooth on phones.
 *
 * - The base map (relief or political colours, water, boundaries) is painted
 *   once into an oversized layer. While you pan, pinch or zoom that painted
 *   layer is only moved and scaled on the compositor (CSS transform), so no
 *   SVG is repainted per frame. It is repainted crisply when the gesture
 *   settles, or mid-gesture if you travel past the painted margin.
 * - Input is batched: pointer and wheel events only record where the fingers
 *   are, and one requestAnimationFrame applies the result. No React render
 *   happens during a gesture.
 * - Names and symbols are laid out in screen space once the view settles, from
 *   a spatial index (only what is on screen is considered), so they stay
 *   crisp, upright and never overlap.
 * - Decorative motion (pulses, ships, flowing rivers) runs on compositor
 *   layers and pauses while the map moves.
 */
import { forwardRef, memo, startTransition, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { distanceToLines, featureAt, type MapFeature, type Sheet } from '@/atlas/sheet'
import type { LivingWorld } from '@/atlas/living'
import { GridIndex, viewRect } from '@/atlas/spatial'
import type { Place } from '@/atlas/types'
import { cn } from '@/lib/cn'
import { lowPowerDevice, prefersReducedMotion } from '@/lib/device'
import { baselineFromTop, labelIndexFor, labelKeyOf, layoutLabels, resetMeasureCache, STYLE_SPEC, FONT_SANS, FONT_SERIF, type PlacedLabel, type PlacedSymbol, type Transform } from './labels'
import { colourAssignment, FOG_FILL, FOG_HATCH, HIGHLIGHT, INK, INK_SOFT, NEIGHBOUR_FILL, PHYSICAL, POLITICAL, ROUTE, SEA_FLAT, WATER, WATER_LINE, type MasteryLevel } from './style'
import { MasteryBadge, Symbol } from './symbols'
import { Animal, RoutePath, ShipGlyph } from './living'

export type Plate = 'physical' | 'political'
export type Tone = 'day' | 'night' | 'antique'

interface TonePalette {
  /** The page around the map sheet. */
  paper: string
  neatline: string
  sea: string
  neighbour: string
  fog: string
  fogOpacity: number
  hatch: string
  river: string
  lake: string
  lakeStroke: string
  coast: string
  indiaCoast: string
  border: string
  indiaBorder: string
  stateBorder: string
  halo: string
  graticule: string
  political?: string[]
  imageFilter?: string
  text: { state: string; stateMuted: string; country: string; water: string; physical: string; place: string }
}

const DAY: TonePalette = {
  paper: 'var(--bg)',
  neatline: '#5f584c',
  sea: SEA_FLAT,
  neighbour: NEIGHBOUR_FILL,
  fog: FOG_FILL,
  fogOpacity: 0.9,
  hatch: FOG_HATCH,
  river: WATER_LINE,
  lake: '#8ec3ea',
  lakeStroke: WATER,
  coast: '#2c5f8c',
  indiaCoast: '#2a6292',
  border: '#2a2a2a',
  indiaBorder: '#111',
  stateBorder: '#3b3b3b',
  halo: '#fff',
  graticule: '#3f6f96',
  text: { state: INK, stateMuted: '#6b6a66', country: INK_SOFT, water: WATER, physical: PHYSICAL, place: INK },
}

export const TONES: Record<Tone, TonePalette> = {
  day: DAY,
  night: {
    ...DAY,
    paper: '#070d19',
    neatline: '#b8964c',
    sea: '#0c1930',
    neighbour: '#16243b',
    fog: '#0a1528',
    fogOpacity: 0.72,
    hatch: '#b8964c',
    river: '#4f8fd0',
    lake: '#1d3f6a',
    lakeStroke: '#4f8fd0',
    coast: '#b8964c',
    indiaCoast: '#d9b45f',
    border: '#d2ad5a',
    indiaBorder: '#f0cf7a',
    stateBorder: '#a98a4a',
    halo: '#0c1930',
    graticule: '#b8964c',
    political: ['#1f3558', '#253d63', '#1b2f4f', '#2b4468', '#22385b', '#29416b', '#1e3354'],
    text: { state: '#f1d58a', stateMuted: '#8f8a78', country: '#c9c3b3', water: '#8cc2f2', physical: '#e4b98b', place: '#f3ead3' },
  },
  antique: {
    ...DAY,
    paper: '#e8dcc0',
    neatline: '#4d3b27',
    sea: '#d9d0b5',
    neighbour: '#efe4c8',
    fog: '#e6dcc2',
    hatch: '#8a7556',
    river: '#4d6f8a',
    lake: '#b9c4b4',
    lakeStroke: '#4d6f8a',
    coast: '#5e4a33',
    indiaCoast: '#4d3b27',
    border: '#3d2c1a',
    indiaBorder: '#2b1d10',
    stateBorder: '#5a4630',
    halo: '#f4ead3',
    graticule: '#8a7556',
    imageFilter: 'sepia(0.72) saturate(0.7) contrast(1.06) brightness(1.03)',
    text: { state: '#3a2412', stateMuted: '#7a6a55', country: '#5b4430', water: '#2f4f6a', physical: '#6b3a17', place: '#2e1d0e' },
  },
}

export type MapTarget =
  | { type: 'place'; id: string }
  | { type: 'state'; id: string }
  | { type: 'country'; id: string }
  | { type: 'point'; x: number; y: number }
  | { type: 'pin'; id: string }

export interface MapPin {
  id: string
  x: number
  y: number
  label?: string
  tone?: 'accent' | 'correct' | 'wrong' | 'muted'
}

export interface Highlight {
  /** Outline a state/country, or glow a river/region/sea shape. */
  kind: 'state' | 'country' | 'river' | 'region' | 'marine' | 'lake' | 'point'
  id?: string
  x?: number
  y?: number
  tone?: 'accent' | 'correct' | 'wrong'
}

export interface RouteOverlay {
  points: Array<{ x: number; y: number; state: 'reached' | 'next' | 'future'; id: string }>
  color?: string
}

export interface AtlasMapHandle {
  flyTo: (x: number, y: number, zoom?: number) => void
  fitFocus: () => void
  zoomBy: (f: number) => void
}

export interface AtlasMapProps {
  sheet: Sheet
  plate: Plate
  tone?: Tone
  /** Lettered pins (recall questions). Tapping one selects `{ type: 'pin' }`. */
  pins?: MapPin[]
  /** State/country ids that are explored. `null` = everything explored. */
  explored: Set<string> | null
  places: Place[]
  mastery?: (id: string) => MasteryLevel
  newIds?: Set<string>
  selectedId?: string
  highlights?: Highlight[]
  route?: RouteOverlay | null
  /** Sheet labels to render muted (their place isn't discovered yet), keyed like `river:ganges`. */
  mutedLabels?: Set<string>
  /** Discovered places linked to sheet features (`river:ganges` → place id). */
  linkedLabels?: Map<string, string>
  /** Sheet labels to hide entirely. */
  hiddenLabels?: Set<string>
  onSelect?: (target: MapTarget) => void
  /** Show place symbols (off during "locate" questions). */
  showPlaces?: boolean
  className?: string
  children?: ReactNode
  initialFocus?: [number, number, number, number]
  /** Routes, ships, wildlife and flowing rivers earned by exploring. */
  living?: LivingWorld | null
  /** Screen space covered by overlays, kept clear when fitting (px). */
  insets?: { top: number; bottom: number }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Wait this long after the last movement before repainting and re-laying names. */
const SETTLE_MS = 140
/** Repaint mid-gesture at most this often (only when the painted margin runs out). */
const MIN_REPAINT_GAP = 220
/** Momentum decay time constant (ms) and the fastest fling we accept (px/ms). */
const GLIDE_TAU = 280
const MAX_FLING = 3.5

export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(props, ref) {
  const { sheet, onSelect } = props
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const container = useRef<HTMLDivElement>(null)
  const baseLayer = useRef<HTMLDivElement>(null)
  const flowLayer = useRef<HTMLDivElement>(null)
  const labelLayer = useRef<HTMLDivElement>(null)
  const worldG = useRef<SVGGElement>(null)
  const flowG = useRef<SVGGElement>(null)
  const hatchRef = useRef<SVGPatternElement>(null)
  /** The live view (sheet px → screen px). Changes every frame, so it is never React state. */
  const t = useRef<Transform>({ k: 1, x: 0, y: 0 })
  /** The view the base map was last painted at; between paints the layer is moved on the compositor. */
  const painted = useRef<Transform | null>(null)
  const lastPaint = useRef(0)
  /** The view the rendered names and symbols were laid out for. */
  const laidOut = useRef<Transform | null>(null)
  const kFit = useRef(1)
  /** Viewport size and the painted margin around it (px). */
  const size = useRef({ w: 1, h: 1, m: 0 })
  const [layoutT, setLayoutT] = useState<Transform | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const anim = useRef(0)
  const moving = useRef(false)

  const limits = useCallback(() => {
    const { w, h } = size.current
    const contain = Math.min(w / sheet.width, h / sheet.height)
    return { min: contain * 0.9, max: kFit.current * 7 }
  }, [sheet])

  const clampT = useCallback(
    (n: Transform): Transform => {
      const { w, h } = size.current
      const { min, max } = limits()
      const k = clamp(n.k, min, max)
      const sw = sheet.width * k
      const sh = sheet.height * k
      // Keep at least part of the sheet under the centre of the screen.
      const x = sw <= w ? clamp(n.x, -sw * 0.2, w - sw * 0.8) : clamp(n.x, w * 0.5 - sw, w * 0.5)
      const y = sh <= h ? clamp(n.y, -sh * 0.2, h - sh * 0.8) : clamp(n.y, h * 0.5 - sh, h * 0.5)
      return { k, x, y }
    },
    [limits, sheet],
  )

  /** Move the painted layers to match the live view. Compositor only: nothing is repainted. */
  const place = useCallback(() => {
    const cur = t.current
    const { m } = size.current
    const p = painted.current
    if (p) {
      const s = cur.k / p.k
      const tf = `translate3d(${cur.x + m - s * (p.x + m)}px,${cur.y + m - s * (p.y + m)}px,0) scale(${s})`
      if (baseLayer.current) baseLayer.current.style.transform = tf
      if (flowLayer.current) flowLayer.current.style.transform = tf
    }
    const l = laidOut.current
    if (l && labelLayer.current) {
      const s = cur.k / l.k
      labelLayer.current.style.transform = `translate3d(${cur.x - s * l.x}px,${cur.y - s * l.y}px,0) scale(${s})`
    }
  }, [])

  /** Repaint the base map at the live view (one full SVG paint). */
  const paint = useCallback(() => {
    const cur = { ...t.current }
    const { m } = size.current
    painted.current = cur
    lastPaint.current = performance.now()
    const tf = `translate(${cur.x + m},${cur.y + m}) scale(${cur.k})`
    worldG.current?.setAttribute('transform', tf)
    flowG.current?.setAttribute('transform', tf)
    // Fog hatching keeps a constant screen spacing.
    const hatch = hatchRef.current
    if (hatch) {
      const hs = String(Math.max(2, 7 / cur.k))
      hatch.setAttribute('width', hs)
      hatch.setAttribute('height', hs)
      const line = hatch.firstElementChild
      line?.setAttribute('y2', hs)
      line?.setAttribute('stroke-width', String(Math.max(2, 7 / cur.k) / 6))
    }
    place()
  }, [place])

  /** Has the view drifted so far from the painted layer that edges show, or it looks soft? */
  const stale = useCallback(() => {
    const p = painted.current
    if (!p) return true
    const cur = t.current
    const s = cur.k / p.k
    if (s > 2.4 || s < 0.6) return true
    const { w, h, m } = size.current
    const x0 = cur.x - s * (p.x + m)
    const y0 = cur.y - s * (p.y + m)
    return x0 > 1 || y0 > 1 || x0 + (w + 2 * m) * s < w - 1 || y0 + (h + 2 * m) * s < h - 1
  }, [])

  /** Once still: repaint crisply, resume decorative motion and lay the names out again. */
  const settle = useCallback(() => {
    clearTimeout(settleTimer.current)
    const p = painted.current
    const cur = t.current
    if (!p || p.k !== cur.k || p.x !== cur.x || p.y !== cur.y) paint()
    if (moving.current) {
      moving.current = false
      container.current?.classList.remove('atlas-moving')
    }
    const snap = { ...cur }
    startTransition(() => setLayoutT(snap))
  }, [paint])

  const setT = useCallback(
    (n: Transform) => {
      t.current = clampT(n)
      if (!moving.current) {
        moving.current = true
        container.current?.classList.add('atlas-moving')
      }
      if (stale() && performance.now() - lastPaint.current > MIN_REPAINT_GAP) paint()
      else place()
      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(settle, SETTLE_MS)
    },
    [clampT, paint, place, settle, stale],
  )

  // The names now on screen were laid out for `layoutT`: line their layer up with the live view.
  useLayoutEffect(() => {
    if (!layoutT) return
    laidOut.current = layoutT
    place()
  }, [layoutT, place])

  const animateTo = useCallback(
    (target: Transform, ms = 520) => {
      cancelAnimationFrame(anim.current)
      const from = { ...t.current }
      const to = clampT(target)
      if (ms <= 0 || prefersReducedMotion()) {
        setT(to)
        settle()
        return
      }
      const start = performance.now()
      const ease = (p: number) => 1 - Math.pow(1 - p, 3)
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        const e = ease(p)
        // Interpolate zoom geometrically so the motion feels even.
        const k = from.k * Math.pow(to.k / from.k, e)
        setT({ k, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e })
        if (p < 1) anim.current = requestAnimationFrame(step)
        else settle()
      }
      anim.current = requestAnimationFrame(step)
    },
    [clampT, setT, settle],
  )

  const insetsRef = useRef(props.insets)
  insetsRef.current = props.insets
  const fitRect = useCallback((r: [number, number, number, number], pad = 0.08): Transform => {
    const { w, h } = size.current
    const top = insetsRef.current?.top ?? 0
    const avail = Math.max(120, h - top - (insetsRef.current?.bottom ?? 0))
    const bw = r[2] - r[0]
    const bh = r[3] - r[1]
    const k = Math.min(w / (bw * (1 + pad * 2)), avail / (bh * (1 + pad * 2)))
    return { k, x: w / 2 - ((r[0] + r[2]) / 2) * k, y: top + avail / 2 - ((r[1] + r[3]) / 2) * k }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (x, y, zoom = 2.6) => {
        const { w, h } = size.current
        const k = Math.max(t.current.k, kFit.current * zoom)
        animateTo({ k, x: w / 2 - x * k, y: h / 2 - y * k })
      },
      fitFocus: () => animateTo(fitRect(props.initialFocus ?? sheet.focus)),
      zoomBy: (f) => {
        const { w, h } = size.current
        const k = t.current.k * f
        const cx = (w / 2 - t.current.x) / t.current.k
        const cy = (h / 2 - t.current.y) / t.current.k
        animateTo({ k, x: w / 2 - cx * k, y: h / 2 - cy * k }, 280)
      },
    }),
    [animateTo, fitRect, props.initialFocus, sheet],
  )

  // Size, painted margin and the initial fit.
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const measure = (initial: boolean) => {
      const r = el.getBoundingClientRect()
      const prev = size.current
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      if (!initial && w === prev.w && h === prev.h) return
      // A painted margin lets short pans reveal already-drawn map. Smaller on low-power devices.
      const m = Math.round(Math.min(lowPowerDevice() ? 240 : 480, Math.max(w, h) * (lowPowerDevice() ? 0.25 : 0.4)))
      size.current = { w, h, m }
      for (const layer of [baseLayer.current, flowLayer.current]) {
        if (!layer) continue
        layer.style.left = layer.style.top = `${-m}px`
        layer.style.width = `${w + 2 * m}px`
        layer.style.height = `${h + 2 * m}px`
      }
      const fit = fitRect(props.initialFocus ?? sheet.focus, 0.04)
      kFit.current = fit.k
      if (initial) t.current = clampT(fit)
      else {
        // Keep the same centre on resize.
        const cx = (prev.w / 2 - t.current.x) / t.current.k
        const cy = (prev.h / 2 - t.current.y) / t.current.k
        t.current = clampT({ k: t.current.k, x: w / 2 - cx * t.current.k, y: h / 2 - cy * t.current.k })
      }
      paint()
      settle()
    }
    measure(true)
    const ro = new ResizeObserver(() => measure(false))
    ro.observe(el)
    return () => ro.disconnect()
  }, [sheet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure names once web fonts are ready (widths measured before are for the fallback font).
  useEffect(() => {
    let alive = true
    void document.fonts?.ready.then(() => {
      if (!alive) return
      resetMeasureCache()
      const snap = { ...t.current }
      startTransition(() => setLayoutT(snap))
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(
    () => () => {
      cancelAnimationFrame(anim.current)
      clearTimeout(settleTimer.current)
    },
    [],
  )

  // ── gestures ────────────────────────────────────────────────────────────
  // Events only record where the pointers are; one animation frame applies them.
  useEffect(() => {
    const el = container.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let rect = el.getBoundingClientRect()
    /** Pan anchor: where the finger went down and the view at that moment. */
    let pan: { x: number; y: number; tx: number; ty: number } | null = null
    let pinch: { dist: number; k: number; wx: number; wy: number } | null = null
    let tap: { x: number; y: number; time: number } | null = null
    let moved = false
    let samples: Array<{ x: number; y: number; t: number }> = []
    let wheel: { f: number; x: number; y: number } | null = null
    let lastWheel = 0
    let frame = 0
    let lastTap = 0

    const local = (e: PointerEvent | WheelEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top })

    const flush = () => {
      frame = 0
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        const k = pinch.k * (dist / pinch.dist)
        setT({ k, x: cx - pinch.wx * k, y: cy - pinch.wy * k })
      } else if (pan && moved && pointers.size === 1) {
        const p = pointers.values().next().value!
        setT({ k: t.current.k, x: pan.tx + (p.x - pan.x), y: pan.ty + (p.y - pan.y) })
      }
      if (wheel) {
        const { f, x, y } = wheel
        wheel = null
        const cur = t.current
        const k = cur.k * f
        const wx = (x - cur.x) / cur.k
        const wy = (y - cur.y) / cur.k
        setT({ k, x: x - wx * k, y: y - wy * k })
      }
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const startPinch = () => {
      const [a, b] = [...pointers.values()]
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const cur = t.current
      pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: cur.k, wx: (cx - cur.x) / cur.k, wy: (cy - cur.y) / cur.k }
    }

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-map-ui]')) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      cancelAnimationFrame(anim.current)
      el.setPointerCapture(e.pointerId)
      rect = el.getBoundingClientRect()
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        pan = { x: p.x, y: p.y, tx: t.current.x, ty: t.current.y }
        tap = { ...p, time: performance.now() }
        moved = false
        samples = [{ ...p, t: e.timeStamp }]
      } else if (pointers.size === 2) {
        startPinch()
        moved = true
        tap = null
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        if (!moved && tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) moved = true
        samples.push({ ...p, t: e.timeStamp })
        if (samples.length > 12) samples.shift()
      }
      if (moved) request()
    }

    /** Release velocity (px/ms) from the last ~80 ms of movement; zero if the finger rested first. */
    const velocity = (upAt: number) => {
      const last = samples[samples.length - 1]
      if (!last || upAt - last.t > 60) return { x: 0, y: 0 }
      const first = samples.find((s) => last.t - s.t <= 80) ?? samples[0]
      const dt = last.t - first.t
      if (dt < 8) return { x: 0, y: 0 }
      const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
      const speed = Math.hypot(v.x, v.y)
      return speed > MAX_FLING ? { x: (v.x / speed) * MAX_FLING, y: (v.y / speed) * MAX_FLING } : v
    }

    const glide = (v: { x: number; y: number }) => {
      let { x: vx, y: vy } = v
      let prev = performance.now()
      const step = (now: number) => {
        const dt = Math.min(48, Math.max(1, now - prev))
        prev = now
        const before = t.current
        setT({ k: before.k, x: before.x + vx * dt, y: before.y + vy * dt })
        // Stop along an axis that ran into the edge.
        if (t.current.x === before.x) vx = 0
        if (t.current.y === before.y) vy = 0
        const decay = Math.exp(-dt / GLIDE_TAU)
        vx *= decay
        vy *= decay
        if (Math.hypot(vx, vy) > 0.02) anim.current = requestAnimationFrame(step)
        else settle()
      }
      anim.current = requestAnimationFrame(step)
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.delete(e.pointerId)
      if (pinch) {
        if (pointers.size >= 2) startPinch()
        else {
          pinch = null
          // Carry on panning with the finger that stayed down.
          const rest = pointers.values().next().value
          if (rest) {
            pan = { x: rest.x, y: rest.y, tx: t.current.x, ty: t.current.y }
            samples = []
          }
        }
        if (pointers.size === 0) settle()
        return
      }
      if (pointers.size > 0) return
      if (frame) {
        cancelAnimationFrame(frame)
        flush()
      }
      const wasTap = !moved && tap && performance.now() - tap.time < 400
      pan = null
      tap = null
      if (wasTap) {
        const now = performance.now()
        const cur = t.current
        const wx = (p.x - cur.x) / cur.k
        const wy = (p.y - cur.y) / cur.k
        if (now - lastTap < 300) {
          // Double tap → zoom in around the point.
          const k = cur.k * 2
          animateTo({ k, x: p.x - wx * k, y: p.y - wy * k }, 280)
          lastTap = 0
        } else {
          lastTap = now
          tapRef.current(wx, wy)
        }
        return
      }
      const v = velocity(e.timeStamp)
      if (e.type !== 'pointercancel' && Math.hypot(v.x, v.y) > 0.12) glide(v)
      else settle()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimationFrame(anim.current)
      // The container only moves on resize; refresh its position once per wheel burst.
      if (e.timeStamp - lastWheel > 250) rect = el.getBoundingClientRect()
      lastWheel = e.timeStamp
      const p = local(e)
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022))
      wheel = { f: (wheel?.f ?? 1) * f, x: p.x, y: p.y }
      request()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [animateTo, setT, settle])

  // Spatial indexes: built when the data changes, not on every layout.
  const placeIndex = useMemo(() => new GridIndex(props.places, (p) => [p.x, p.y, p.x, p.y], sheet.width, sheet.height), [props.places, sheet])
  const labelIndex = useMemo(() => labelIndexFor(sheet.labels, sheet.width, sheet.height), [sheet])
  const riversById = useMemo(() => new Map(sheet.rivers.map((r) => [`river:${r.id}`, r])), [sheet])

  // Tap → the nearest symbol, else the state/country under the finger.
  const tapRef = useRef<(x: number, y: number) => void>(() => {})
  tapRef.current = (wx: number, wy: number) => {
    const k = t.current.k
    if (props.pins?.length) {
      let best: MapPin | null = null
      let bestD = 26 / k
      for (const p of props.pins) {
        const d = Math.hypot(p.x - wx, p.y - wy)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      if (best) return onSelect?.({ type: 'pin', id: best.id })
    }
    if (props.showPlaces !== false) {
      let best: Place | null = null
      let bestD = 18 / k
      for (const p of placeIndex.query([wx - bestD, wy - bestD, wx + bestD, wy + bestD])) {
        const d = Math.hypot(p.x - wx, p.y - wy)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      if (best) return onSelect?.({ type: 'place', id: best.id })
      // Rivers that are discovered places can be tapped along their course,
      // and named features (ranges, seas, lakes…) by their name.
      const linked = props.linkedLabels ?? new Map<string, string>()
      const near = 34 / k
      for (const l of labelIndex.query([wx - near, wy - near, wx + near, wy + near])) {
        if (l.kind === 'river' || l.x === undefined || l.y === undefined) continue
        const placeId = linked.get(labelKeyOf(l))
        if (placeId && Math.hypot(l.x - wx, l.y - wy) < near) return onSelect?.({ type: 'place', id: placeId })
      }
      for (const [key, placeId] of linked) {
        const r = riversById.get(key)
        if (r && distanceToLines([wx, wy], r.coords) < 7 / k) return onSelect?.({ type: 'place', id: placeId })
      }
    }
    const st = featureAt(sheet.states, [wx, wy])
    if (st) return onSelect?.({ type: 'state', id: st.id })
    const c = featureAt(sheet.countries, [wx, wy])
    if (c) return onSelect?.({ type: 'country', id: c.id })
    onSelect?.({ type: 'point', x: wx, y: wy })
  }

  // ── derived drawing data (recomputed only when the view settles) ────────
  const colours = useMemo(() => {
    const ids = sheet.states.length ? sheet.states.map((s) => s.id) : sheet.countries.map((c) => c.id)
    return colourAssignment(ids, sheet.stateNeighbours.size ? sheet.stateNeighbours : worldNeighbours(sheet))
  }, [sheet])

  /**
   * Which place symbols to draw at this zoom: capitals always, then more detail
   * as you zoom in, thinned so symbols never crowd. Places the base map already
   * names (rivers, ranges, seas…) are shown through that name instead.
   */
  const visible = useMemo<Place[]>(() => {
    if (!layoutT || props.showPlaces === false) return []
    const z = layoutT.k / kFit.current
    const { w, h } = size.current
    const minZ = (p: Place) => (p.kind === 'capital' ? (p.tags?.includes('national') || p.level === 1 ? 0 : 1.4) : p.level === 1 ? 1.3 : p.level === 2 ? 2 : 2.9)
    const prio = (p: Place) => (p.id === props.selectedId ? 1000 : 0) + (props.newIds?.has(p.id) ? 500 : 0) + (p.kind === 'capital' ? 60 : 0) + (4 - p.level) * 20
    const cand = placeIndex
      .query(viewRect(layoutT, w, h, 20))
      .filter((p) => p.id === props.selectedId || props.newIds?.has(p.id) || (!(p.geom && sheet.labels.length) && z >= minZ(p)))
      .map((p) => ({ p, sx: p.x * layoutT.k + layoutT.x, sy: p.y * layoutT.k + layoutT.y }))
      .filter(({ sx, sy }) => sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20)
      .sort((a, b) => prio(b.p) - prio(a.p))
    const taken: Array<[number, number]> = []
    const out: Place[] = []
    for (const c of cand) {
      if (taken.some(([x, y]) => Math.abs(x - c.sx) < 13 && Math.abs(y - c.sy) < 13) && c.p.id !== props.selectedId) continue
      taken.push([c.sx, c.sy])
      out.push(c.p)
    }
    return out
  }, [layoutT, placeIndex, props.showPlaces, props.selectedId, props.newIds, sheet])

  const labels = useMemo<PlacedLabel[]>(() => {
    if (!layoutT) return []
    const symbols: PlacedSymbol[] = visible.map((p) => ({
      place: p,
      x: p.x * layoutT.k + layoutT.x,
      y: p.y * layoutT.k + layoutT.y,
      mastery: props.mastery?.(p.id) ?? 'discovered',
      isNew: props.newIds?.has(p.id) ?? false,
      selected: props.selectedId === p.id,
    }))
    const fogged = new Set(props.explored ? sheet.states.filter((s) => !props.explored!.has(s.id)).map((s) => s.id) : [])
    return layoutLabels({
      labels: sheet.labels,
      index: labelIndex,
      places: symbols,
      t: layoutT,
      kFit: kFit.current,
      width: size.current.w,
      height: size.current.h,
      mutedIds: props.mutedLabels ?? new Set(),
      linked: props.linkedLabels ?? new Map(),
      foggedStates: fogged,
      selectedId: props.selectedId,
      sheetId: sheet.id,
      hidden: props.hiddenLabels,
    })
  }, [layoutT, visible, labelIndex, props.mastery, props.newIds, props.selectedId, props.explored, props.mutedLabels, props.linkedLabels, props.hiddenLabels, sheet])

  const symbols = useMemo(() => {
    if (!layoutT) return []
    return visible.map((p) => ({ p, x: p.x * layoutT.k + layoutT.x, y: p.y * layoutT.k + layoutT.y }))
  }, [layoutT, visible])

  const routeScreen = useMemo(() => {
    if (!layoutT || !props.route) return null
    return props.route.points.map((pt) => ({ ...pt, sx: pt.x * layoutT.k + layoutT.x, sy: pt.y * layoutT.k + layoutT.y }))
  }, [layoutT, props.route])

  const livingScreen = useMemo(() => {
    const lw = props.living
    if (!layoutT || !lw) return null
    const S = (x: number, y: number) => [x * layoutT.k + layoutT.x, y * layoutT.k + layoutT.y] as const
    const { w, h } = size.current
    const onScreen = (x: number, y: number) => x > -30 && x < w + 30 && y > -30 && y < h + 30
    const z = layoutT.k / kFit.current
    return {
      routes: lw.routes.map((r) => ({ r, d: 'M' + r.points.map(([x, y]) => S(x, y).map((v) => v.toFixed(1)).join(',')).join('L') })),
      ships: lw.ships.map((sh) => ({ ...sh, s: S(sh.x, sh.y) })).filter(({ s }) => onScreen(s[0], s[1])),
      wildlife: z >= 1.2 ? lw.wildlife.map((a) => ({ ...a, s: S(a.x, a.y) })).filter(({ s }) => onScreen(s[0], s[1])) : [],
    }
  }, [layoutT, props.living])

  const pinScreen = useMemo(() => {
    if (!layoutT || !props.pins) return []
    return props.pins.map((p) => ({ ...p, sx: p.x * layoutT.k + layoutT.x, sy: p.y * layoutT.k + layoutT.y }))
  }, [layoutT, props.pins])

  const highlightScreen = useMemo(() => {
    if (!layoutT) return []
    return (props.highlights ?? []).filter((h) => h.kind === 'point' && h.x !== undefined).map((h) => ({ ...h, sx: h.x! * layoutT.k + layoutT.x, sy: h.y! * layoutT.k + layoutT.y }))
  }, [layoutT, props.highlights])

  const toneId = props.tone ?? 'day'
  const tone = TONES[toneId]
  const routeColour = props.route?.color ?? ROUTE
  const flowing = props.living?.flowing
  const hasFlow = !!flowing && flowing.size > 0
  const calm = useMemo(() => lowPowerDevice(), [])
  const ids = { hatch: `fog-hatch-${uid}`, clip: `sheet-clip-${uid}`, glow: `city-glow-${uid}` }
  return (
    <div
      ref={container}
      className={cn('relative size-full touch-none overflow-hidden select-none', calm && 'atlas-calm', props.className)}
      style={{ background: tone.paper, contain: 'layout paint' }}
      role="application"
      aria-label={`${sheet.title} map`}
    >
      {/* Base map, painted in sheet coordinates into an oversized layer. */}
      <div ref={baseLayer} className="atlas-layer" aria-hidden="true">
        <svg className="absolute inset-0 size-full">
          <defs>
            <pattern ref={hatchRef} id={ids.hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={8} stroke={tone.hatch} strokeWidth={8 / 6} opacity={0.55} />
            </pattern>
            <clipPath id={ids.clip}>
              <rect width={sheet.width} height={sheet.height} />
            </clipPath>
          </defs>
          <g ref={worldG}>
            <g clipPath={`url(#${ids.clip})`}>
              <BaseMap sheet={sheet} plate={props.plate} tone={toneId} colours={colours} explored={props.explored} hatchId={ids.hatch} />
              <Highlights sheet={sheet} highlights={props.highlights} selectedId={props.selectedId} />
            </g>
            {/* Neatline: the printed border of the map sheet. */}
            <rect width={sheet.width} height={sheet.height} fill="none" stroke={tone.neatline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>

      {/* Flowing rivers get a layer of their own, so their motion never repaints the base map. */}
      <div ref={flowLayer} className="atlas-layer" style={{ display: hasFlow ? undefined : 'none' }} aria-hidden="true">
        <svg className="absolute inset-0 size-full">
          <g ref={flowG}>{hasFlow && <FlowingRivers sheet={sheet} flowing={flowing} />}</g>
        </svg>
      </div>

      {/* Screen-space layer: route, symbols, names – laid out when the view settles. */}
      <div ref={labelLayer} className="atlas-labels" aria-hidden="true">
        <svg className="absolute inset-0 size-full overflow-visible">
          <defs>
            <radialGradient id={ids.glow}>
              <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#ffd98a" stopOpacity={0} />
            </radialGradient>
          </defs>
          {livingScreen && (
            <g>
              {livingScreen.routes.map(({ r, d }) => (
                <RoutePath key={r.id} route={r} d={d} />
              ))}
              {livingScreen.wildlife.map((a) => (
                <g key={a.id} transform={`translate(${a.s[0] + 16},${a.s[1] + 14})`}>
                  <title>{`${a.name}: ${a.species.replace('-', ' ')}`}</title>
                  <Animal species={a.species} />
                </g>
              ))}
            </g>
          )}
          {routeScreen && routeScreen.length > 1 && (
            <g>
              <path d={'M' + routeScreen.map((p) => `${p.sx},${p.sy}`).join('L')} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
              <path d={'M' + routeScreen.map((p) => `${p.sx},${p.sy}`).join('L')} fill="none" stroke={routeColour} strokeWidth={2.2} strokeDasharray="7 4" strokeLinecap="round" strokeLinejoin="round" />
              {routeScreen.map((p) => (
                <circle key={p.id} cx={p.sx} cy={p.sy} r={p.state === 'future' ? 3.2 : 4} fill={p.state === 'future' ? '#fff' : routeColour} stroke={routeColour} strokeWidth={1.6} />
              ))}
            </g>
          )}
          {symbols.map(({ p, x, y }) => (
            <g key={p.id} transform={`translate(${x},${y})`}>
              {toneId === 'night' && props.living?.lights.has(p.id) && <circle r={12} fill={`url(#${ids.glow})`} />}
              {props.selectedId === p.id && <circle r={12} fill="none" stroke={HIGHLIGHT} strokeWidth={2.5} />}
              <Symbol kind={p.kind} tags={p.tags} national={p.tags?.includes('national')} />
              <MasteryBadge level={props.mastery?.(p.id) ?? 'discovered'} />
            </g>
          ))}
          {labels.map((l) => l.path && <RiverName key={l.key} label={l} tone={toneId} idPrefix={uid} />)}
        </svg>
        {/* Point names are HTML: zooming the layer only rescales them, it never re-lays out SVG text. */}
        {labels.map((l) => !l.path && l.text && <PlaceName key={l.key} label={l} tone={toneId} />)}
        <svg className="absolute inset-0 size-full overflow-visible">
          {pinScreen.map((p) => {
            const c = p.tone === 'correct' ? '#2e8b57' : p.tone === 'wrong' ? '#c1121f' : p.tone === 'muted' ? '#8a8a8a' : HIGHLIGHT
            return (
              <g key={p.id} transform={`translate(${p.sx},${p.sy})`}>
                <path d="M0,0 C-3,-7 -11,-11 -11,-20 A11,11 0 1 1 11,-20 C11,-11 3,-7 0,0Z" fill={c} stroke="#fff" strokeWidth={2} />
                {p.label && (
                  <text y={-16} textAnchor="middle" fill="#fff" fontFamily={FONT_SANS} fontWeight={800} fontSize={12}>
                    {p.label}
                  </text>
                )}
              </g>
            )
          })}
          {highlightScreen.map((h, i) => (
            <g key={i} transform={`translate(${h.sx},${h.sy})`}>
              <circle r={14} fill="none" stroke={h.tone === 'wrong' ? '#c1121f' : h.tone === 'correct' ? '#2e8b57' : HIGHLIGHT} strokeWidth={3} />
              <circle r={3} fill={h.tone === 'wrong' ? '#c1121f' : h.tone === 'correct' ? '#2e8b57' : HIGHLIGHT} />
            </g>
          ))}
        </svg>
        {/* Motion as HTML on compositor layers: animating these never repaints the names. */}
        {routeScreen?.map((p) => p.state === 'next' && <span key={p.id} className="atlas-ring" style={{ left: p.sx, top: p.sy, color: routeColour }} />)}
        {symbols.map(({ p, x, y }) => props.newIds?.has(p.id) && <span key={p.id} className="atlas-ring" style={{ left: x, top: y, color: HIGHLIGHT }} />)}
        {livingScreen?.ships.map((sh) => {
          const angle = Math.atan2(sh.dy, sh.dx)
          return (
            <span key={sh.id} className="atlas-ship-at" style={{ left: sh.s[0] + sh.dx * 16, top: sh.s[1] + sh.dy * 16, transform: `rotate(${angle}rad)` }}>
              <span className="atlas-ship">
                <svg width={20} height={20} viewBox="-10 -10 20 20" style={{ transform: `rotate(${-angle}rad)` }}>
                  <ShipGlyph />
                </svg>
              </span>
            </span>
          )
        })}
      </div>
      {props.children}
    </div>
  )
})

function worldNeighbours(sheet: Sheet): Map<string, string[]> {
  // Approximate adjacency for colouring: bounding boxes that touch.
  const m = new Map<string, string[]>()
  for (const a of sheet.countries) {
    m.set(
      a.id,
      sheet.countries.filter((b) => b.id !== a.id && a.bbox[0] <= b.bbox[2] + 2 && a.bbox[2] >= b.bbox[0] - 2 && a.bbox[1] <= b.bbox[3] + 2 && a.bbox[3] >= b.bbox[1] - 2).map((b) => b.id),
    )
  }
  return m
}

function labelPaint(l: PlacedLabel, toneId: Tone) {
  const spec = STYLE_SPEC[l.style]
  const c = TONES[toneId].text
  const fill =
    l.style === 'state'
      ? l.muted
        ? c.stateMuted
        : c.state
      : l.style === 'country'
        ? c.country
        : l.style.startsWith('water') || l.style === 'river' || l.style === 'place-water'
          ? c.water
          : l.style.startsWith('physical') || l.style === 'place-physical'
            ? c.physical
            : c.place
  return {
    fill,
    fontFamily: spec.serif ? FONT_SERIF : FONT_SANS,
    fontStyle: spec.italic ? 'italic' : 'normal',
    fontWeight: spec.weight,
    fontSize: l.size,
    letterSpacing: `${spec.spacing}em`,
    halo: TONES[toneId].halo,
    haloWidth: l.style === 'state' || l.style === 'country' ? 3.2 : 2.8,
    opacity: l.muted ? 0.62 : 1,
  }
}

/** A name that follows a river's course (SVG textPath). */
const RiverName = memo(function RiverName({ label: l, tone: toneId, idPrefix }: { label: PlacedLabel; tone: Tone; idPrefix: string }) {
  const { fill, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, halo, haloWidth, opacity } = labelPaint(l, toneId)
  // Ids are per map instance: the review map can be open over the Atlas.
  const id = `lp-${idPrefix}-${l.key.replace(/[^a-z0-9]/gi, '')}`
  return (
    <g>
      <path id={id} d={l.path} fill="none" stroke="none" />
      <text fill={fill} fontFamily={fontFamily} fontStyle={fontStyle} fontWeight={fontWeight} fontSize={fontSize} letterSpacing={letterSpacing} stroke={halo} strokeWidth={haloWidth} strokeLinejoin="round" paintOrder="stroke" opacity={opacity}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {l.text}
        </textPath>
      </text>
    </g>
  )
})

/** A point name, positioned so its baseline sits where an SVG `<text y>` would put it. */
const PlaceName = memo(function PlaceName({ label: l, tone: toneId }: { label: PlacedLabel; tone: Tone }) {
  const { fill, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, halo, haloWidth, opacity } = labelPaint(l, toneId)
  return (
    <span
      className="atlas-name"
      style={{
        left: l.x,
        top: l.y - baselineFromTop(l.style, l.size),
        color: fill,
        fontFamily,
        fontStyle,
        fontWeight,
        fontSize,
        letterSpacing,
        WebkitTextStroke: `${haloWidth}px ${halo}`,
        opacity,
        transform: l.anchor === 'middle' ? 'translateX(-50%)' : l.anchor === 'end' ? 'translateX(-100%)' : undefined,
      }}
    >
      {l.text}
    </span>
  )
})

const RIVER_WIDTH: Record<number, number> = { 1: 2.2, 2: 1.6, 3: 1.2, 4: 0.85 }
const ns = { vectorEffect: 'non-scaling-stroke' as const }

/** Group features that share a style into one path each: a few dozen nodes to paint instead of hundreds. */
function joinBy<T>(items: readonly T[], key: (item: T) => string | undefined, d: (item: T) => string): Array<[string, string]> {
  const m = new Map<string, string[]>()
  for (const it of items) {
    const k = key(it)
    if (k === undefined) continue
    const list = m.get(k)
    if (list) list.push(d(it))
    else m.set(k, [d(it)])
  }
  return [...m].map(([k, ds]) => [k, ds.join('')])
}

const riverRanks = new WeakMap<Sheet, Array<[string, string]>>()
const lakeGroups = new WeakMap<Sheet, Array<[string, string]>>()

/** Everything drawn in sheet coordinates. Memoised: only re-renders when data changes, and only repaints when the view settles. */
const BaseMap = memo(function BaseMap({ sheet, plate, tone: toneId, colours, explored, hatchId }: { sheet: Sheet; plate: Plate; tone: Tone; colours: Map<string, string>; explored: Set<string> | null; hatchId: string }) {
  const isIndia = sheet.states.length > 0
  const tone = TONES[toneId]
  // The night chart is always drawn in flat colours.
  const physical = plate === 'physical' && !tone.political
  const fill = useCallback(
    (id: string) => {
      const c = colours.get(id)
      if (!c || !tone.political) return c
      return tone.political[POLITICAL.indexOf(c) % tone.political.length] ?? tone.political[0]
    },
    [colours, tone],
  )
  const fills = useMemo(() => {
    if (physical) return null
    return {
      countries: joinBy(sheet.countries, (c) => (isIndia ? tone.neighbour : (fill(c.id) ?? tone.neighbour)), (c) => c.d),
      states: joinBy(sheet.states, (s) => fill(s.id) ?? '#eee', (s) => s.d),
    }
  }, [physical, sheet, isIndia, tone, fill])
  const rivers = useMemo(() => {
    let r = riverRanks.get(sheet)
    if (!r) riverRanks.set(sheet, (r = joinBy(sheet.rivers, (x) => String(RIVER_WIDTH[x.rank] ?? 0.85), (x) => x.d)))
    return r
  }, [sheet])
  const lakes = useMemo(() => {
    let l = lakeGroups.get(sheet)
    // Only lakes big enough to read get an outline; tiny ones stay a quiet fill.
    if (!l) lakeGroups.set(sheet, (l = joinBy(sheet.lakes, (x) => (Math.max(x.bbox[2] - x.bbox[0], x.bbox[3] - x.bbox[1]) > (isIndia ? 10 : 6) ? 'big' : 'small'), (x) => x.d)))
    return l
  }, [sheet, isIndia])
  const fog = useMemo(() => {
    const units: MapFeature[] = isIndia ? sheet.states : sheet.countries
    return explored ? units.filter((u) => !explored.has(u.id)).map((u) => u.d).join('') : ''
  }, [sheet, isIndia, explored])

  return (
    <g>
      {physical ? (
        <image href={sheet.reliefUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={tone.imageFilter ? { filter: tone.imageFilter } : undefined} />
      ) : (
        <>
          <rect width={sheet.width} height={sheet.height} fill={tone.sea} />
          {fills!.countries.map(([c, d]) => (
            <path key={c} d={d} fill={c} />
          ))}
          {fills!.states.map(([c, d]) => (
            <path key={c} d={d} fill={c} />
          ))}
          <image href={sheet.shadeUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={{ mixBlendMode: tone.political ? 'soft-light' : 'multiply' }} opacity={tone.political ? 0.55 : 0.22} />
        </>
      )}

      {/* Rivers and lakes */}
      <g fill="none" stroke={tone.river} strokeLinecap="round" strokeLinejoin="round">
        {rivers.map(([w, d]) => (
          <path key={w} d={d} strokeWidth={Number(w)} {...ns} />
        ))}
      </g>
      {lakes.map(([size, d]) => (
        <path key={size} d={d} fill={tone.lake} stroke={size === 'big' ? tone.lakeStroke : 'none'} strokeWidth={0.7} {...ns} />
      ))}

      {/* Unexplored areas: a muted veil with fine hatching – still readable. */}
      {fog && (
        <g>
          <path d={fog} fill={tone.fog} opacity={physical ? 0.72 : tone.fogOpacity} />
          <path d={fog} fill={`url(#${hatchId})`} />
        </g>
      )}

      <path d={sheet.lines.graticule} fill="none" stroke={tone.graticule} strokeWidth={0.6} opacity={0.45} {...ns} />

      {/* Coasts */}
      <path d={sheet.lines.coasts} fill="none" stroke={tone.coast} strokeWidth={0.9} {...ns} />
      {isIndia && <path d={sheet.lines.indiaCoast} fill="none" stroke={tone.indiaCoast} strokeWidth={1} {...ns} />}

      {/* State boundaries: fine dashed line. */}
      {isIndia && (
        <>
          <path d={sheet.lines.stateBorders} fill="none" stroke={tone.halo} strokeWidth={2.6} opacity={0.55} {...ns} />
          <path d={sheet.lines.stateBorders} fill="none" stroke={tone.stateBorder} strokeWidth={1.15} strokeDasharray="5 2.5" {...ns} />
        </>
      )}

      {/* International boundaries: bold dash-dot, on a light halo. */}
      <path d={sheet.lines.intlBorders} fill="none" stroke={tone.halo} strokeWidth={isIndia ? 3.6 : 2.4} opacity={0.7} {...ns} />
      <path d={sheet.lines.intlBorders} fill="none" stroke={tone.border} strokeWidth={isIndia ? 1.6 : 0.9} strokeDasharray={isIndia ? '8 2.5 2 2.5' : '4 2'} {...ns} />
      {isIndia && (
        <>
          <path d={sheet.lines.indiaBorder} fill="none" stroke={tone.halo} strokeWidth={4.6} opacity={0.75} {...ns} />
          <path d={sheet.lines.indiaBorder} fill="none" stroke={tone.indiaBorder} strokeWidth={2.2} strokeDasharray="9 3 2.5 3" {...ns} />
        </>
      )}
    </g>
  )
})

/** Rivers that flow once the River Journey is done: a moving dash, on its own layer. */
const FlowingRivers = memo(function FlowingRivers({ sheet, flowing }: { sheet: Sheet; flowing: Set<string> }) {
  const groups = useMemo(() => joinBy(sheet.rivers.filter((r) => flowing.has(r.id)), (r) => String((RIVER_WIDTH[r.rank] ?? 0.85) * 0.7), (r) => r.d), [sheet, flowing])
  return (
    <g fill="none" stroke="#e8f4ff" strokeLinecap="round" opacity={0.85}>
      {groups.map(([w, d]) => (
        <path key={w} d={d} strokeWidth={Number(w)} strokeDasharray="2 10" className="atlas-flow" {...ns} />
      ))}
    </g>
  )
})

const Highlights = memo(function Highlights({ sheet, highlights, selectedId }: { sheet: Sheet; highlights?: Highlight[]; selectedId?: string }) {
  if (!highlights?.length && !selectedId) return null
  const colour = (h: Highlight) => (h.tone === 'correct' ? '#2e8b57' : h.tone === 'wrong' ? '#c1121f' : HIGHLIGHT)
  return (
    <g>
      {(highlights ?? []).map((h, i) => {
        const c = colour(h)
        if (h.kind === 'state' || h.kind === 'country') {
          const f = (h.kind === 'state' ? sheet.states : sheet.countries).find((x) => x.id === h.id)
          if (!f) return null
          return (
            <g key={i}>
              <path d={f.d} fill={c} opacity={0.14} />
              <path d={f.d} fill="none" stroke="#fff" strokeWidth={5} {...ns} />
              <path d={f.d} fill="none" stroke={c} strokeWidth={2.6} {...ns} />
            </g>
          )
        }
        if (h.kind === 'river') {
          const r = sheet.rivers.find((x) => x.id === h.id)
          if (!r) return null
          return (
            <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={r.d} stroke="#fff" strokeWidth={7} {...ns} />
              <path d={r.d} stroke={c} strokeWidth={3.4} {...ns} />
            </g>
          )
        }
        if (h.kind === 'region' || h.kind === 'marine' || h.kind === 'lake') {
          const f = (h.kind === 'region' ? sheet.regions : h.kind === 'marine' ? sheet.marine : sheet.lakes).find((x) => x.id === h.id)
          if (!f) return null
          return (
            <g key={i}>
              <path d={f.d} fill={c} opacity={0.18} />
              <path d={f.d} fill="none" stroke={c} strokeWidth={2.2} strokeDasharray="6 3" {...ns} />
            </g>
          )
        }
        return null
      })}
    </g>
  )
})
