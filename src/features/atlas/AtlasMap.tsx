/**
 * The Atlas map. The base map (relief or political colours, water, boundaries)
 * lives in one SVG group that is transformed on the GPU while you pan and
 * zoom; names and symbols are laid out in screen space afterwards so they stay
 * crisp, upright and never overlap.
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { distanceToLines, featureAt, type Sheet } from '@/atlas/sheet'
import type { LivingWorld } from '@/atlas/living'
import type { Place } from '@/atlas/types'
import { cn } from '@/lib/cn'
import { labelKeyOf, layoutLabels, STYLE_SPEC, FONT_SANS, FONT_SERIF, type PlacedLabel, type PlacedSymbol, type Transform } from './labels'
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
  paper: '#efeadf',
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

export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(props, ref) {
  const { sheet, onSelect } = props
  const container = useRef<HTMLDivElement>(null)
  const worldG = useRef<SVGGElement>(null)
  const labelG = useRef<SVGGElement>(null)
  const t = useRef<Transform>({ k: 1, x: 0, y: 0 })
  const kFit = useRef(1)
  const size = useRef({ w: 1, h: 1 })
  const [layoutT, setLayoutT] = useState<Transform | null>(null)
  const layoutRef = useRef<Transform | null>(null)
  const layoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const anim = useRef<number>(0)
  const [hatch, setHatch] = useState(8)

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

  /** Write the transform straight to the DOM – no React render per frame. */
  const apply = useCallback(() => {
    const cur = t.current
    worldG.current?.setAttribute('transform', `translate(${cur.x},${cur.y}) scale(${cur.k})`)
    const l = layoutRef.current
    if (labelG.current && l) {
      const s = cur.k / l.k
      labelG.current.setAttribute('transform', `translate(${cur.x - l.x * s},${cur.y - l.y * s}) scale(${s})`)
    }
  }, [])

  const scheduleLayout = useCallback((delay = 90) => {
    clearTimeout(layoutTimer.current)
    layoutTimer.current = setTimeout(() => {
      const snap = { ...t.current }
      layoutRef.current = snap
      setLayoutT(snap)
      setHatch(Math.max(2, 7 / snap.k))
      if (labelG.current) labelG.current.setAttribute('transform', '')
    }, delay)
  }, [])

  const setTransform = useCallback(
    (n: Transform, layout = true) => {
      t.current = clampT(n)
      apply()
      if (layout) scheduleLayout()
    },
    [apply, clampT, scheduleLayout],
  )

  const animateTo = useCallback(
    (target: Transform, ms = 520) => {
      cancelAnimationFrame(anim.current)
      const from = { ...t.current }
      const to = clampT(target)
      const start = performance.now()
      const ease = (p: number) => 1 - Math.pow(1 - p, 3)
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        const e = ease(p)
        // Interpolate zoom geometrically so the motion feels even.
        const k = from.k * Math.pow(to.k / from.k, e)
        t.current = { k, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
        apply()
        if (p < 1) anim.current = requestAnimationFrame(step)
        else scheduleLayout(0)
      }
      anim.current = requestAnimationFrame(step)
    },
    [apply, clampT, scheduleLayout],
  )

  const insetsRef = useRef(props.insets)
  insetsRef.current = props.insets
  const fitRect = useCallback(
    (r: [number, number, number, number], pad = 0.08): Transform => {
      const { w, h } = size.current
      const top = insetsRef.current?.top ?? 0
      const avail = Math.max(120, h - top - (insetsRef.current?.bottom ?? 0))
      const bw = r[2] - r[0]
      const bh = r[3] - r[1]
      const k = Math.min(w / (bw * (1 + pad * 2)), avail / (bh * (1 + pad * 2)))
      return { k, x: w / 2 - ((r[0] + r[2]) / 2) * k, y: top + avail / 2 - ((r[1] + r[3]) / 2) * k }
    },
    [],
  )

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

  // Size + initial fit.
  useEffect(() => {
    const el = container.current
    if (!el) return
    const measure = (initial: boolean) => {
      const r = el.getBoundingClientRect()
      const prev = size.current
      size.current = { w: Math.max(1, r.width), h: Math.max(1, r.height) }
      const fit = fitRect(props.initialFocus ?? sheet.focus, 0.04)
      kFit.current = fit.k
      if (initial) setTransform(fit)
      else {
        // Keep the same centre on resize.
        const cx = (prev.w / 2 - t.current.x) / t.current.k
        const cy = (prev.h / 2 - t.current.y) / t.current.k
        setTransform({ k: t.current.k, x: size.current.w / 2 - cx * t.current.k, y: size.current.h / 2 - cy * t.current.k })
      }
    }
    measure(true)
    const ro = new ResizeObserver(() => measure(false))
    ro.observe(el)
    return () => ro.disconnect()
  }, [sheet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure labels once web fonts are ready.
  useEffect(() => {
    void document.fonts?.ready.then(() => scheduleLayout(0))
  }, [scheduleLayout])

  // ── gestures ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = container.current
    if (!el) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number; time: number; moved: boolean } | null = null
    let pinch: { dist: number; k: number; cx: number; cy: number; wx: number; wy: number } | null = null
    let last: { x: number; y: number; time: number } | null = null
    let velocity = { x: 0, y: 0 }
    let lastTap = 0

    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-map-ui]')) return
      cancelAnimationFrame(anim.current)
      el.setPointerCapture(e.pointerId)
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        start = { ...p, time: performance.now(), moved: false }
        last = { ...p, time: performance.now() }
        velocity = { x: 0, y: 0 }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: t.current.k, cx, cy, wx: (cx - t.current.x) / t.current.k, wy: (cy - t.current.y) / t.current.k }
        if (start) start.moved = true
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      const prev = pointers.get(e.pointerId)!
      pointers.set(e.pointerId, p)
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        const k = pinch.k * (dist / pinch.dist)
        setTransform({ k, x: cx - pinch.wx * k, y: cy - pinch.wy * k }, false)
        return
      }
      if (pointers.size === 1 && start) {
        if (Math.hypot(p.x - start.x, p.y - start.y) > 6) start.moved = true
        if (!start.moved) return
        setTransform({ k: t.current.k, x: t.current.x + (p.x - prev.x), y: t.current.y + (p.y - prev.y) }, false)
        const now = performance.now()
        if (last) {
          const dt = Math.max(1, now - last.time)
          velocity = { x: ((p.x - last.x) / dt) * 16, y: ((p.y - last.y) / dt) * 16 }
        }
        last = { ...p, time: now }
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.delete(e.pointerId)
      if (pinch && pointers.size < 2) {
        pinch = null
        const remaining = [...pointers.values()][0]
        if (remaining) {
          start = { ...remaining, time: performance.now(), moved: true }
          last = { ...remaining, time: performance.now() }
        }
        scheduleLayout()
        return
      }
      if (pointers.size === 0 && start) {
        const tap = !start.moved && performance.now() - start.time < 400
        if (tap) {
          const now = performance.now()
          if (now - lastTap < 300) {
            // Double tap → zoom in around the point.
            const k = t.current.k * 2
            const wx = (p.x - t.current.x) / t.current.k
            const wy = (p.y - t.current.y) / t.current.k
            animateTo({ k, x: p.x - wx * k, y: p.y - wy * k }, 280)
            lastTap = 0
          } else {
            lastTap = now
            const wx = (p.x - t.current.x) / t.current.k
            const wy = (p.y - t.current.y) / t.current.k
            handleTap(wx, wy)
          }
        } else if (Math.hypot(velocity.x, velocity.y) > 2) {
          // Inertia
          let v = { ...velocity }
          const glide = () => {
            v = { x: v.x * 0.92, y: v.y * 0.92 }
            setTransform({ k: t.current.k, x: t.current.x + v.x, y: t.current.y + v.y }, false)
            if (Math.hypot(v.x, v.y) > 0.4) anim.current = requestAnimationFrame(glide)
            else scheduleLayout(0)
          }
          anim.current = requestAnimationFrame(glide)
        } else scheduleLayout(0)
        start = null
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimationFrame(anim.current)
      const p = local(e)
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022))
      const k = t.current.k * f
      const wx = (p.x - t.current.x) / t.current.k
      const wy = (p.y - t.current.y) / t.current.k
      setTransform({ k, x: p.x - wx * k, y: p.y - wy * k })
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [animateTo, scheduleLayout, setTransform]) // eslint-disable-line react-hooks/exhaustive-deps

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
      for (const p of props.places) {
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
      for (const l of sheet.labels) {
        if (l.kind === 'river' || l.x === undefined || l.y === undefined) continue
        const placeId = linked.get(labelKeyOf(l))
        if (placeId && Math.hypot(l.x - wx, l.y - wy) < 34 / k) return onSelect?.({ type: 'place', id: placeId })
      }
      for (const [key, placeId] of linked) {
        if (!key.startsWith('river:')) continue
        const r = sheet.rivers.find((x) => `river:${x.id}` === key)
        if (r && distanceToLines([wx, wy], r.coords) < 7 / k) return onSelect?.({ type: 'place', id: placeId })
      }
    }
    const st = featureAt(sheet.states, [wx, wy])
    if (st) return onSelect?.({ type: 'state', id: st.id })
    const c = featureAt(sheet.countries, [wx, wy])
    if (c) return onSelect?.({ type: 'country', id: c.id })
    onSelect?.({ type: 'point', x: wx, y: wy })
  }
  function handleTap(wx: number, wy: number) {
    tapRef.current(wx, wy)
  }

  // ── derived drawing data ────────────────────────────────────────────────
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
    const cand = props.places
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
  }, [layoutT, props.places, props.showPlaces, props.selectedId, props.newIds, sheet])

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
  }, [layoutT, visible, props.mastery, props.newIds, props.selectedId, props.explored, props.mutedLabels, props.linkedLabels, props.hiddenLabels, sheet])

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

  const tone = TONES[props.tone ?? 'day']
  return (
    <div ref={container} className={cn('relative size-full touch-none overflow-hidden select-none', props.className)} style={{ background: tone.paper }} role="application" aria-label={`${sheet.title} map`}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern id={`fog-hatch-${sheet.id}`} width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={hatch} stroke={tone.hatch} strokeWidth={hatch / 6} opacity={0.55} />
          </pattern>
        </defs>
        <defs>
          <clipPath id={`sheet-clip-${sheet.id}`}>
            <rect width={sheet.width} height={sheet.height} />
          </clipPath>
        </defs>
        <g ref={worldG}>
          <g clipPath={`url(#sheet-clip-${sheet.id})`}>
            <BaseMap sheet={sheet} plate={props.plate} tone={props.tone ?? 'day'} colours={colours} explored={props.explored} hatchId={`fog-hatch-${sheet.id}`} flowing={props.living?.flowing} />
            <Highlights sheet={sheet} highlights={props.highlights} selectedId={props.selectedId} />
          </g>
          {/* Neatline: the printed border of the map sheet. */}
          <rect width={sheet.width} height={sheet.height} fill="none" stroke={tone.neatline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {/* Screen-space layer: route, symbols, names. */}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <radialGradient id={`city-glow-${sheet.id}`}>
            <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#ffd98a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g ref={labelG}>
          {livingScreen && (
            <g>
              {livingScreen.routes.map(({ r, d }) => (
                <RoutePath key={r.id} route={r} d={d} />
              ))}
              {livingScreen.ships.map((sh) => (
                <g key={sh.id} transform={`translate(${sh.s[0] + sh.dx * 16},${sh.s[1] + sh.dy * 16})`}>
                  <g className="atlas-ship" style={{ '--sx': `${sh.dx * 14}px`, '--sy': `${sh.dy * 14}px` } as React.CSSProperties}>
                    <ShipGlyph />
                  </g>
                </g>
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
              <path d={'M' + routeScreen.map((p) => `${p.sx},${p.sy}`).join('L')} fill="none" stroke={props.route?.color ?? ROUTE} strokeWidth={2.2} strokeDasharray="7 4" strokeLinecap="round" strokeLinejoin="round" />
              {routeScreen.map((p) => (
                <g key={p.id} transform={`translate(${p.sx},${p.sy})`}>
                  {p.state === 'next' && <circle r={11} fill="none" stroke={props.route?.color ?? ROUTE} strokeWidth={2} className="atlas-pulse" />}
                  <circle r={p.state === 'future' ? 3.2 : 4} fill={p.state === 'future' ? '#fff' : (props.route?.color ?? ROUTE)} stroke={props.route?.color ?? ROUTE} strokeWidth={1.6} />
                </g>
              ))}
            </g>
          )}
          {symbols.map(({ p, x, y }) => (
            <g key={p.id} transform={`translate(${x},${y})`}>
              {props.tone === 'night' && props.living?.lights.has(p.id) && <circle r={12} fill={`url(#city-glow-${sheet.id})`} />}
              {props.newIds?.has(p.id) && <circle r={13} fill="none" stroke={HIGHLIGHT} strokeWidth={2} className="atlas-pulse" />}
              {props.selectedId === p.id && <circle r={12} fill="none" stroke={HIGHLIGHT} strokeWidth={2.5} />}
              <Symbol kind={p.kind} tags={p.tags} national={p.tags?.includes('national')} />
              <MasteryBadge level={props.mastery?.(p.id) ?? 'discovered'} />
            </g>
          ))}
          {labels.map((l) => (
            <LabelText key={l.key} label={l} tone={props.tone ?? 'day'} />
          ))}
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
        </g>
      </svg>
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

const LabelText = memo(function LabelText({ label: l, tone: toneId }: { label: PlacedLabel; tone: Tone }) {
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
  const common = {
    fill,
    fontFamily: spec.serif ? FONT_SERIF : FONT_SANS,
    fontStyle: spec.italic ? 'italic' : 'normal',
    fontWeight: spec.weight,
    fontSize: l.size,
    letterSpacing: `${spec.spacing}em`,
    stroke: TONES[toneId].halo,
    strokeWidth: l.style === 'state' || l.style === 'country' ? 3.2 : 2.8,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
    opacity: l.muted ? 0.62 : 1,
  }
  if (l.path) {
    const id = `lp-${l.key.replace(/[^a-z0-9]/gi, '')}`
    return (
      <g>
        <path id={id} d={l.path} fill="none" stroke="none" />
        <text {...common}>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
            {l.text}
          </textPath>
        </text>
      </g>
    )
  }
  return (
    <text x={l.x} y={l.y} textAnchor={l.anchor} {...common}>
      {l.text}
    </text>
  )
})

const RIVER_WIDTH: Record<number, number> = { 1: 2.2, 2: 1.6, 3: 1.2, 4: 0.85 }

/** Everything drawn in sheet coordinates. Memoised: only re-renders when data changes. */
const BaseMap = memo(function BaseMap({ sheet, plate, tone: toneId, colours, explored, hatchId, flowing }: { sheet: Sheet; plate: Plate; tone: Tone; colours: Map<string, string>; explored: Set<string> | null; hatchId: string; flowing?: Set<string> }) {
  const isIndia = sheet.states.length > 0
  const units = isIndia ? sheet.states : sheet.countries
  const fogged = explored ? units.filter((u) => !explored.has(u.id)) : []
  const tone = TONES[toneId]
  // The night chart is always drawn in flat colours.
  const physical = plate === 'physical' && !tone.political
  const fill = (id: string) => {
    const c = colours.get(id)
    if (!c || !tone.political) return c
    return tone.political[POLITICAL.indexOf(c) % tone.political.length] ?? tone.political[0]
  }
  const ns = { vectorEffect: 'non-scaling-stroke' as const }
  return (
    <g>
      {physical ? (
        <image href={sheet.reliefUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={tone.imageFilter ? { filter: tone.imageFilter } : undefined} />
      ) : (
        <>
          <rect width={sheet.width} height={sheet.height} fill={tone.sea} />
          {sheet.countries.map((c) => (
            <path key={c.id} d={c.d} fill={isIndia ? tone.neighbour : (fill(c.id) ?? tone.neighbour)} />
          ))}
          {sheet.states.map((s) => (
            <path key={s.id} d={s.d} fill={fill(s.id) ?? '#eee'} />
          ))}
          <image href={sheet.shadeUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={{ mixBlendMode: tone.political ? 'soft-light' : 'multiply' }} opacity={tone.political ? 0.55 : 0.22} />
        </>
      )}

      {/* Rivers and lakes */}
      <g fill="none" stroke={tone.river} strokeLinecap="round" strokeLinejoin="round">
        {sheet.rivers.map((r) => (
          <path key={r.id} d={r.d} strokeWidth={RIVER_WIDTH[r.rank] ?? 0.85} {...ns} />
        ))}
      </g>
      {flowing && flowing.size > 0 && (
        <g fill="none" stroke="#e8f4ff" strokeLinecap="round" opacity={0.85}>
          {sheet.rivers
            .filter((r) => flowing.has(r.id))
            .map((r) => (
              <path key={r.id} d={r.d} strokeWidth={(RIVER_WIDTH[r.rank] ?? 0.85) * 0.7} strokeDasharray="2 10" className="atlas-flow" {...ns} />
            ))}
        </g>
      )}
      {sheet.lakes.map((l) => {
        // Only lakes big enough to read get an outline; tiny ones stay a quiet fill.
        const big = Math.max(l.bbox[2] - l.bbox[0], l.bbox[3] - l.bbox[1]) > (isIndia ? 10 : 6)
        return <path key={l.id} d={l.d} fill={tone.lake} stroke={big ? tone.lakeStroke : 'none'} strokeWidth={0.7} {...ns} />
      })}

      {/* Unexplored areas: a muted veil with fine hatching – still readable. */}
      {fogged.map((u) => (
        <g key={u.id}>
          <path d={u.d} fill={tone.fog} opacity={physical ? 0.72 : tone.fogOpacity} />
          <path d={u.d} fill={`url(#${hatchId})`} />
        </g>
      ))}

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

const Highlights = memo(function Highlights({ sheet, highlights, selectedId }: { sheet: Sheet; highlights?: Highlight[]; selectedId?: string }) {
  if (!highlights?.length && !selectedId) return null
  const ns = { vectorEffect: 'non-scaling-stroke' as const }
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
