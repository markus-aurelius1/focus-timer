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
import { distanceToLines, featureAt, pointInGeometry, type AreaFeature, type MapFeature, type Sheet } from '@/atlas/sheet'
import type { LivingWorld } from '@/atlas/living'
import { GridIndex, viewRect } from '@/atlas/spatial'
import type { Place, PlaceKind } from '@/atlas/types'
import { cn } from '@/lib/cn'
import { lowPowerDevice } from '@/lib/device'
import { prefersReducedMotion } from '@/lib/motion'
import { baselineFromTop, labelIndexFor, labelKeyOf, layoutLabels, resetMeasureCache, STYLE_SPEC, FONT_SANS, type PlacedLabel, type PlacedSymbol, type Transform } from './labels'
import { colourAssignment, HIGHLIGHT, INK, INK_SOFT, NEIGHBOUR_FILL, PHYSICAL, POLITICAL, ROUTE, SEA_FLAT, TRAVELLED, WATER, WATER_LINE, type MasteryLevel } from './style'
import { MasteryBadge, Symbol } from './symbols'
import { Animal, RoutePath, ShipGlyph } from './living'
import { easeInOut, easeOut, flight, isWheelNotch, type View } from './camera'
import { useScreenActive } from '@/app/screenActive'

export type Plate = 'physical' | 'political'
export type Tone = 'day' | 'night' | 'antique'

interface TonePalette {
  /** The page around the map sheet. */
  paper: string
  neatline: string
  sea: string
  neighbour: string
  /** Travelled states and countries: a warm edge and the faintest wash. Places not yet travelled are drawn exactly like the rest of the map. */
  travelled: string
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
  /** Protected areas: tint and edge. */
  park: string
  parkLine: string
  /** Disputed and conflict regions: edge. */
  dispute: string
  political?: string[]
  imageFilter?: string
  text: { state: string; stateMuted: string; country: string; water: string; physical: string; place: string }
}

const DAY: TonePalette = {
  paper: 'var(--bg)',
  neatline: '#5f584c',
  sea: SEA_FLAT,
  neighbour: NEIGHBOUR_FILL,
  travelled: TRAVELLED,
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
  park: '#3f8f46',
  parkLine: '#2e6b33',
  dispute: '#8b1e3f',
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
    travelled: '#f0cf7a',
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
    park: '#4f9a5a',
    parkLine: '#7cc187',
    dispute: '#e0708f',
    political: ['#1f3558', '#253d63', '#1b2f4f', '#2b4468', '#22385b', '#29416b', '#1e3354'],
    text: { state: '#f1d58a', stateMuted: '#8f8a78', country: '#c9c3b3', water: '#8cc2f2', physical: '#e4b98b', place: '#f3ead3' },
  },
  antique: {
    ...DAY,
    paper: '#e8dcc0',
    neatline: '#4d3b27',
    sea: '#d9d0b5',
    neighbour: '#efe4c8',
    travelled: '#9a5b14',
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
    park: '#6b7d3a',
    parkLine: '#55632c',
    dispute: '#7a2233',
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
  kind: 'state' | 'country' | 'river' | 'region' | 'marine' | 'lake' | 'area' | 'point'
  id?: string
  x?: number
  y?: number
  tone?: 'accent' | 'correct' | 'wrong'
}

export interface RouteOverlay {
  points: Array<{ x: number; y: number; state: 'reached' | 'next' | 'future'; id: string }>
  color?: string
}

/** Screen space covered by overlays (px from each edge of the map). */
export interface MapInsets {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export interface AtlasMapHandle {
  /** Fly to a point (sheet px) at `zoom` × the fitted scale, centred in the part of the map not covered by `insets`. */
  flyTo: (x: number, y: number, zoom?: number, insets?: MapInsets) => void
  /** Pan just far enough that a point (sheet px) is clear of `insets`; does nothing when it already is. The zoom is kept. */
  reveal: (x: number, y: number, insets?: MapInsets) => void
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
  pyqPlaceIds?: ReadonlySet<string> | null
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
  insets?: MapInsets
  /** Places that are discovered; the rest are drawn muted. Omit to draw every place as discovered. */
  discovered?: ReadonlySet<string> | ReadonlyMap<string, unknown>
  /** Draw places not yet discovered (muted). */
  showUndiscovered?: boolean
  /** Only these kinds of place (null or omitted: all). */
  kinds?: ReadonlySet<PlaceKind> | null
  /**
   * A tap on a place selects it at once. Leave it off where selecting opens something modal over the map:
   * there a tap waits a moment, so that a double tap on a place can still zoom.
   */
  instantSelect?: boolean
  /** Draw overlay outlines (protected areas, disputed regions). Lakes and wetlands are always drawn. */
  showAreas?: boolean
  /** Sheet feature key (`river:…`, `area:…`, `region:…`) → place id, for every place: tapping a name, course or outline opens it. */
  featurePlaces?: Map<string, string>
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const NO_STATES: Set<string> = new Set()
/** Positions written to the DOM are rounded, so a name that hasn't moved produces the very same value and nothing is rewritten. */
const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * One layout of names and symbols: the view it was made for, the viewport then,
 * and the frame its coordinates are written in. The frame only changes with the
 * zoom, so after a pan every name that is still shown has exactly the
 * coordinates it had before and only names entering or leaving touch the DOM.
 */
interface Layout extends Transform {
  w: number
  h: number
  /** Names are laid out this far beyond the view on every side. */
  o: number
  /** Frame origin: a sheet point p is drawn at p·k + (fx, fy). */
  fx: number
  fy: number
}

/** Past a bound the view follows the finger with growing resistance, by at most this many px. */
const RUBBER = 96
const rubber = (over: number) => Math.sign(over) * RUBBER * (1 - 1 / ((Math.abs(over) / RUBBER) * 0.6 + 1))
const SPRING_BACK_MS = 320

/** The view is at rest once nothing has moved it for this long and for a few frames running: then it is repainted crisply and the names are laid out. */
const SETTLE_MS = 140
const SETTLE_FRAMES = 3
/** Repaint mid-gesture at most this often (only when the painted layer no longer covers the view, or has been scaled too far). */
const MIN_REPAINT_GAP = 220
/** Momentum decay time constant (ms) and the fastest fling we accept (px/ms). */
const GLIDE_TAU = 300
const MAX_FLING = 3.5
/** Mouse-wheel notches ease towards their target zoom with this time constant (ms). */
const WHEEL_TAU = 65
/** Zoom per pixel of wheel delta (a 100 px notch ≈ ×1.25). */
const WHEEL_RATE = 0.0022
/** Double-tap zoom and its animation. */
const TAP_ZOOM = 2
const TAP_ZOOM_MS = 300
/** While a finger or the mouse button is down, names are laid out again at most this often, and only once the view has travelled half the overscan. */
const HOLD_LAYOUT_GAP = 250
/** Zoom level (× the fitted scale) at which protected-area outlines appear. */
const AREAS_FROM_ZOOM = 1.7

/**
 * Stands the map down while its screen is behind another, and wakes it on
 * return. A component of its own so that reading the screen's state re-renders
 * this, not the map.
 */
function Sleep({ onChange }: { onChange: (active: boolean) => void }) {
  const active = useScreenActive()
  useEffect(() => onChange(active), [active, onChange])
  return null
}

/**
 * While the Atlas is kept behind another screen its map is not re-rendered at
 * all: a change of theme, or new progress when a session ends, would otherwise
 * repaint the whole vector map out of sight (about a second of main-thread
 * work, felt on whatever screen is in front). The screen sets this as it
 * leaves and returns (AtlasScreen.tsx), and re-renders on return so that
 * whatever changed meanwhile is taken up then.
 */
let awake = true
export function setAtlasMapAwake(value: boolean) {
  awake = value
}
const sameProps = (a: AtlasMapProps, b: AtlasMapProps) => {
  if (!awake) return true
  const keys = Object.keys(b) as Array<keyof AtlasMapProps>
  if (keys.length !== Object.keys(a).length) return false
  for (const key of keys) if (!Object.is(a[key], b[key])) return false
  return true
}

/** Memoised: the screen around it re-renders on every route change and selection; the map only when what it draws changes. */
export const AtlasMap = memo(forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(props, ref) {
  const { sheet, onSelect } = props
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const container = useRef<HTMLDivElement>(null)
  const baseLayer = useRef<HTMLDivElement>(null)
  const flowLayer = useRef<HTMLDivElement>(null)
  const labelLayer = useRef<HTMLDivElement>(null)
  /** Selection and question highlights, on a layer of their own: changing them never repaints the base map. */
  const overlayLayer = useRef<HTMLDivElement>(null)
  const overlayG = useRef<SVGGElement>(null)
  const worldG = useRef<SVGGElement>(null)
  const flowG = useRef<SVGGElement>(null)
  /** The previous map style, fading out over the new one after a style change. */
  const fadeLayer = useRef<HTMLDivElement>(null)
  const fadeG = useRef<SVGGElement>(null)
  /** The live view (sheet px → screen px). Changes every frame, so it is never React state. */
  const t = useRef<Transform>({ k: 1, x: 0, y: 0 })
  /** The view the base map was last painted at; between paints the layer is moved on the compositor. */
  const painted = useRef<Transform | null>(null)
  const lastPaint = useRef(0)
  /** The frame the rendered names and symbols are positioned in, and the view they were laid out for. */
  const laidOut = useRef<Transform | null>(null)
  const laidOutView = useRef<Transform | null>(null)
  const frame = useRef<Transform | null>(null)
  const kFit = useRef(1)
  /** Viewport size, the painted margin around it, and how far beyond the view names are laid out (px). */
  const size = useRef({ w: 1, h: 1, m: 0, o: 0 })
  /** The size the painted layers were given at the last repaint. They are only resized when repainted, so a resizing window moves them on the compositor like any other gesture. */
  const layerGeom = useRef({ w: 0, h: 0, m: 0 })
  const [layoutT, setLayoutT] = useState<Layout | null>(null)
  /** When names were last laid out, and the positions the point names took (kept on the next layout where they still fit). */
  const lastLayout = useRef(0)
  /** A layout has been asked for and not committed yet: asking again would only restart it. */
  const layoutPending = useRef(false)
  const namePositions = useRef<Map<string, number>>(new Map())
  /** The frame loop that watches for the view coming to rest (0 when it isn't running), and the frames it has seen without movement. */
  const settleWatch = useRef(0)
  const stillFrames = useRef(0)
  const anim = useRef(0)
  const moving = useRef(false)
  const invRef = useRef(1)
  /** Names and symbols that keep their size while zooming (collected after each layout). */
  const anchors = useRef<Array<HTMLElement>>([])
  const calmRef = useRef(lowPowerDevice())
  /** Fingers or a mouse button are down: names wait for the release instead of re-laying out mid-gesture. */
  const holding = useRef(false)
  /** A camera animation (fly-to, glide, wheel easing) has its next frame scheduled. */
  const animPending = useRef(false)
  /** Pointer or wheel input is batched and waiting for its frame. */
  const inputPending = useRef(false)
  /** When the view was last asked to move – by input that may not have reached a frame yet, or by a frame. */
  const lastInput = useRef(0)
  /** A repaint has been issued and the frame that shows it has not been produced yet. */
  const paintInFlight = useRef(false)

  /** Schedule an animation step; animPending says one is on its way even when frames are slow. */
  const nextFrame = useCallback((step: (now: number) => void) => {
    animPending.current = true
    anim.current = requestAnimationFrame((now) => {
      animPending.current = false
      step(now)
    })
  }, [])
  const cancelAnim = useCallback(() => {
    cancelAnimationFrame(anim.current)
    animPending.current = false
  }, [])

  const limits = useCallback(() => {
    const { w, h } = size.current
    // Cover the viewport at every zoom so the paper around the sheet never appears.
    const cover = Math.max(w / sheet.width, h / sheet.height)
    return { min: cover, max: Math.max(cover, kFit.current * 7) }
  }, [sheet])

  const clampT = useCallback(
    (n: Transform): Transform => {
      const { w, h } = size.current
      const { min, max } = limits()
      const k = clamp(n.k, min, max)
      // If a caller overshoots a zoom limit, keep its requested centre instead of
      // applying an offset calculated for a different scale (which jumps the map).
      const xAtScale = k === n.k ? n.x : w / 2 - ((w / 2 - n.x) / n.k) * k
      const yAtScale = k === n.k ? n.y : h / 2 - ((h / 2 - n.y) / n.k) * k
      const sw = sheet.width * k
      const sh = sheet.height * k
      const x = clamp(xAtScale, w - sw, 0)
      const y = clamp(yAtScale, h - sh, 0)
      return { k, x, y }
    },
    [limits, sheet],
  )

  /** The scale a pinch may reach while it is held: past a limit it gives, a little. */
  const softK = useCallback(
    (k: number) => {
      const { min, max } = limits()
      if (prefersReducedMotion()) return clamp(k, min, max)
      return k < min ? min * Math.pow(k / min, 0.3) : k > max ? max * Math.pow(k / max, 0.3) : k
    },
    [limits],
  )

  /**
   * The view while a finger holds it: past an edge of the sheet (or a zoom
   * limit) it follows with resistance instead of stopping dead, and springs
   * back on release. Under reduced motion it simply stops at the bound.
   */
  const softClampT = useCallback(
    (n: Transform): Transform => {
      if (prefersReducedMotion()) return clampT(n)
      const { w, h } = size.current
      const k = softK(n.k)
      const x0 = k === n.k ? n.x : w / 2 - ((w / 2 - n.x) / n.k) * k
      const y0 = k === n.k ? n.y : h / 2 - ((h / 2 - n.y) / n.k) * k
      const axis = (v: number, view: number, sheetPx: number) => {
        // Smaller than the view (only while a pinch is past its limit): centred.
        const lo = sheetPx >= view ? view - sheetPx : (view - sheetPx) / 2
        const hi = sheetPx >= view ? 0 : (view - sheetPx) / 2
        const inside = clamp(v, lo, hi)
        return inside + rubber(v - inside)
      }
      return { k, x: axis(x0, w, sheet.width * k), y: axis(y0, h, sheet.height * k) }
    },
    [clampT, sheet, softK],
  )

  /** Move the painted layers to match the live view. Compositor only: nothing is repainted. */
  const place = useCallback(() => {
    const cur = t.current
    const { m } = layerGeom.current
    const p = painted.current
    if (p) {
      const s = cur.k / p.k
      const tf = `translate3d(${cur.x + m - s * (p.x + m)}px,${cur.y + m - s * (p.y + m)}px,0) scale(${s})`
      if (baseLayer.current) baseLayer.current.style.transform = tf
      if (overlayLayer.current) overlayLayer.current.style.transform = tf
      if (flowLayer.current) flowLayer.current.style.transform = tf
      if (fadeLayer.current) fadeLayer.current.style.transform = tf
    }
    const l = laidOut.current
    const layer = labelLayer.current
    if (l && layer) {
      const s = cur.k / l.k
      layer.style.transform = `translate3d(${cur.x - s * l.x}px,${cur.y - s * l.y}px,0) scale(${s})`
      // HTML names keep their size during zoom. SVG symbols scale with the layer
      // until settlement, avoiding a costly SVG repaint on every animation frame.
      // Compact viewports and low-power devices also let HTML names scale;
      // dense phone labels must not trigger per-frame text rasterization.
      // Written on the anchors themselves: a custom property on the layer would restyle every SVG node beneath it.
      const inv = calmRef.current || size.current.w < 768 ? 1 : Math.round((1 / s) * 1000) / 1000
      if (inv !== invRef.current) {
        invRef.current = inv
        const v = inv === 1 ? '' : String(inv)
        for (const el of anchors.current) el.style.scale = v
      }
    }
  }, [])

  /** Repaint the base map at the live view (one full SVG paint). */
  const paint = useCallback(() => {
    const cur = { ...t.current }
    const { w, h, m } = size.current
    const g = layerGeom.current
    if (g.w !== w || g.h !== h || g.m !== m) {
      layerGeom.current = { w, h, m }
      for (const layer of [baseLayer.current, overlayLayer.current, flowLayer.current, fadeLayer.current]) {
        if (!layer) continue
        layer.style.left = layer.style.top = `${-m}px`
        layer.style.width = `${w + 2 * m}px`
        layer.style.height = `${h + 2 * m}px`
      }
    }
    painted.current = cur
    lastPaint.current = performance.now()
    // Rasterising the map can take several frames' worth of time. Until the frame after the
    // one that carries this paint has started, a second repaint would only queue behind it.
    paintInFlight.current = true
    requestAnimationFrame(() => requestAnimationFrame(() => (paintInFlight.current = false)))
    const tf = `translate(${cur.x + m},${cur.y + m}) scale(${cur.k})`
    worldG.current?.setAttribute('transform', tf)
    overlayG.current?.setAttribute('transform', tf)
    flowG.current?.setAttribute('transform', tf)
    fadeG.current?.setAttribute('transform', tf)
    place()
  }, [place])

  /** Has the view drifted so far from the painted layer that edges show, or it looks soft? */
  const stale = useCallback(() => {
    const p = painted.current
    if (!p) return true
    const cur = t.current
    const s = cur.k / p.k
    if (s > 2.4 || s < 0.6) return true
    const { w, h } = size.current
    const g = layerGeom.current
    const x0 = cur.x - s * (p.x + g.m)
    const y0 = cur.y - s * (p.y + g.m)
    return x0 > 1 || y0 > 1 || x0 + (g.w + 2 * g.m) * s < w - 1 || y0 + (g.h + 2 * g.m) * s < h - 1
  }, [])

  /** The live view as a layout request, in the current frame (a new frame when the zoom has changed). */
  const snapshot = useCallback((): Layout => {
    const cur = t.current
    const { w, h, o } = size.current
    let f = frame.current
    // Keep coordinates small: after a very long pan at one zoom the frame is moved up to the view.
    if (!f || f.k !== cur.k || Math.abs(cur.x - f.x) > 6000 || Math.abs(cur.y - f.y) > 6000) f = frame.current = { ...cur }
    return { k: cur.k, x: cur.x, y: cur.y, w, h, o, fx: f.x, fy: f.y }
  }, [])

  /** Lay the names and symbols out for the live view (a low-priority render; the gesture keeps its frames). */
  const requestLayout = useCallback(() => {
    layoutPending.current = true
    const snap = snapshot()
    startTransition(() => setLayoutT(snap))
  }, [snapshot])

  /** Once still: repaint crisply, resume decorative motion and lay the names out again. */
  const settle = useCallback(() => {
    cancelAnimationFrame(settleWatch.current)
    settleWatch.current = 0
    const p = painted.current
    const cur = t.current
    const g = layerGeom.current
    if (!p || p.k !== cur.k || p.x !== cur.x || p.y !== cur.y || g.w !== size.current.w || g.h !== size.current.h) paint()
    if (moving.current) {
      moving.current = false
      container.current?.classList.remove('atlas-moving')
    }
    // Zoom-dependent layers switch only at rest, never mid-gesture.
    container.current?.classList.toggle('atlas-near', cur.k / kFit.current >= AREAS_FROM_ZOOM)
    requestLayout()
  }, [paint, requestLayout])

  /**
   * Watch for the view coming to rest, from the frame loop rather than a timer.
   * A repaint can hold the next frame back for far longer than SETTLE_MS, and
   * the browser delivers wheel and pointer input with the frame, so during such
   * a stall a timer sees neither movement nor input and would settle in the
   * middle of a gesture – repainting and laying the names out again, which
   * delays the following frame even more. Frames don't run during a stall, so
   * counting them can't be fooled: the view is at rest after SETTLE_FRAMES
   * frames and SETTLE_MS without movement, with no animation or batched input
   * pending and no repaint still in flight.
   */
  const watchForRest = useCallback(() => {
    stillFrames.current = 0
    if (settleWatch.current) return
    const check = () => {
      settleWatch.current = 0
      if (holding.current) return
      stillFrames.current++
      const busy = animPending.current || inputPending.current || paintInFlight.current
      if (busy || stillFrames.current < SETTLE_FRAMES || performance.now() - lastInput.current < SETTLE_MS) {
        if (busy) stillFrames.current = 0
        settleWatch.current = requestAnimationFrame(check)
        return
      }
      settle()
    }
    settleWatch.current = requestAnimationFrame(check)
  }, [settle])

  /**
   * Show the view `n`. `hold` says how strictly it is kept on the sheet:
   * 'hard' (default) stops at the bounds, 'soft' lets a held gesture pull past
   * them with resistance, 'free' applies it as given (the spring back).
   */
  const setT = useCallback(
    (n: Transform, hold: 'hard' | 'soft' | 'free' = 'hard') => {
      t.current = hold === 'free' ? n : hold === 'soft' ? softClampT(n) : clampT(n)
      lastInput.current = performance.now()
      if (!moving.current) {
        moving.current = true
        container.current?.classList.add('atlas-moving')
      }
      // Never start a repaint while one is still being rasterised: the view keeps moving on the compositor meanwhile.
      if (stale() && !paintInFlight.current && performance.now() - lastPaint.current > MIN_REPAINT_GAP) paint()
      else place()
      if (!holding.current) {
        watchForRest()
        return
      }
      // Held: the names were laid out beyond the view, so a drag reveals named map. Once half of that
      // reserve is used up (or the scale has changed a lot), lay them out again around the new view.
      const l = laidOutView.current
      const now = performance.now()
      if (!l || layoutPending.current || now - lastLayout.current < HOLD_LAYOUT_GAP) return
      const cur = t.current
      const s = cur.k / l.k
      const reserve = size.current.o / 2
      if (Math.abs(cur.x - s * l.x) >= reserve || Math.abs(cur.y - s * l.y) >= reserve || s > 1.5 || s < 0.67) {
        lastLayout.current = now
        requestLayout()
      }
    },
    [clampT, paint, place, requestLayout, softClampT, stale, watchForRest],
  )

  // The names now on screen were laid out for `layoutT`: line their layer up with the live view.
  useLayoutEffect(() => {
    if (!layoutT) return
    laidOut.current = { k: layoutT.k, x: layoutT.fx, y: layoutT.fy }
    laidOutView.current = layoutT
    lastLayout.current = performance.now()
    layoutPending.current = false
    // Only names inside the view are kept at their size during a zoom; the ones waiting beyond it scale with the layer.
    anchors.current = labelLayer.current ? [...labelLayer.current.querySelectorAll<HTMLElement>('.atlas-name:not([data-beyond]), .atlas-ring')] : []
    invRef.current = NaN
    place()
  }, [layoutT, place])

  /**
   * Move the camera to `target` along one continuous zoom-and-pan path
   * (camera.ts). `focus` is the screen point that stays the centre of the
   * motion (a tapped point for zooms). Under reduced motion it jumps.
   */
  const animateTo = useCallback(
    (target: Transform, opts: { ms?: number; ease?: (p: number) => number; focus?: [number, number] } = {}) => {
      cancelAnim()
      const from: View = { ...t.current }
      const to = clampT(target)
      if (opts.ms === 0 || prefersReducedMotion()) {
        setT(to)
        settle()
        return
      }
      const { w, h } = size.current
      const path = flight(from, to, w, h, opts.focus)
      const ms = opts.ms ?? path.duration
      const ease = opts.ease ?? easeInOut
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        setT(path.at(ease(p)))
        if (p < 1) nextFrame(step)
        else settle()
      }
      nextFrame(step)
    },
    [cancelAnim, clampT, nextFrame, setT, settle],
  )

  const insetsRef = useRef(props.insets)
  insetsRef.current = props.insets
  const fitRect = useCallback((r: [number, number, number, number], pad = 0.08): Transform => {
    const { w, h } = size.current
    const bw = r[2] - r[0]
    const bh = r[3] - r[1]
    const focusFit = Math.min(w / (bw * (1 + pad * 2)), h / (bh * (1 + pad * 2)))
    const k = Math.max(w / sheet.width, h / sheet.height, focusFit)
    return { k, x: w / 2 - ((r[0] + r[2]) / 2) * k, y: h / 2 - ((r[1] + r[3]) / 2) * k }
  }, [sheet])

  /** The part of the map not covered by overlays (screen px). An inset that would leave too little is ignored. */
  const clearRect = useCallback((insets?: MapInsets) => {
    const { w, h } = size.current
    const side = (k: keyof MapInsets) => insets?.[k] ?? insetsRef.current?.[k] ?? 0
    let [left, right, top, bottom] = [side('left'), side('right'), side('top'), side('bottom')]
    if (w - left - right < 200) left = right = 0
    if (h - top - bottom < 160) bottom = Math.max(0, h - top - 160)
    return { x0: left, x1: w - right, y0: top, y1: h - bottom }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (x, y, zoom = 2.6, insets) => {
        const c = clearRect(insets)
        const cx = (c.x0 + c.x1) / 2
        const cy = (c.y0 + c.y1) / 2
        const { max } = limits()
        const k = Math.min(max, Math.max(t.current.k, kFit.current * zoom))
        animateTo({ k, x: cx - x * k, y: cy - y * k }, { focus: [cx, cy] })
      },
      reveal: (x, y, insets) => {
        const c = clearRect(insets)
        const cur = t.current
        const pad = 48
        const sx = x * cur.k + cur.x
        const sy = y * cur.k + cur.y
        // A river or a range is selected by touching it anywhere; its own point may be far away. Only a point on screen is moved clear.
        if (sx < 0 || sy < 0 || sx > size.current.w || sy > size.current.h) return
        const dx = sx < c.x0 + pad ? c.x0 + pad - sx : sx > c.x1 - pad ? c.x1 - pad - sx : 0
        const dy = sy < c.y0 + pad ? c.y0 + pad - sy : sy > c.y1 - pad ? c.y1 - pad - sy : 0
        if (dx || dy) animateTo({ k: cur.k, x: cur.x + dx, y: cur.y + dy }, { ms: 260, ease: easeOut })
      },
      fitFocus: () => animateTo(fitRect(props.initialFocus ?? sheet.focus)),
      zoomBy: (f) => {
        const { w, h } = size.current
        const { min, max } = limits()
        const k = clamp(t.current.k * f, min, max)
        const cx = (w / 2 - t.current.x) / t.current.k
        const cy = (h / 2 - t.current.y) / t.current.k
        animateTo({ k, x: w / 2 - cx * k, y: h / 2 - cy * k }, { ms: 280, ease: easeOut, focus: [w / 2, h / 2] })
      },
    }),
    [animateTo, clearRect, fitRect, limits, props.initialFocus, sheet],
  )

  /** The sheet the camera has been fitted to. */
  const fitted = useRef<string | null>(null)
  /**
   * The Atlas screen is kept mounted behind the others. While it is not the one
   * in front, nothing here moves: camera animations and the rest watcher are
   * cancelled, decorative animation is paused (.atlas-asleep), and a resize is
   * taken up only on return.
   */
  const activeRef = useRef(true)
  const remeasure = useRef<() => void>(() => {})
  // Size, painted margin and the initial fit.
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const measure = (initial: boolean) => {
      const r = el.getBoundingClientRect()
      const prev = size.current
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      // Hidden (display: none) measures as nothing: keep what is known until it is shown again.
      if (!initial && (r.width === 0 || r.height === 0)) return
      if (!initial && w === prev.w && h === prev.h) return
      // A painted margin lets short pans reveal already-drawn map. Smaller on low-power devices.
      const m = Math.round(Math.min(lowPowerDevice() ? 240 : 480, Math.max(w, h) * (lowPowerDevice() ? 0.25 : 0.4)))
      // Names are laid out this far beyond the view, so dragging reveals map that is already named.
      const o = Math.round(Math.min(lowPowerDevice() ? 120 : 260, Math.min(w, h) * (lowPowerDevice() ? 0.2 : 0.3)))
      size.current = { w, h, m, o }
      const fit = fitRect(props.initialFocus ?? sheet.focus, 0)
      kFit.current = fit.k
      if (initial) {
        t.current = clampT(fit)
        paint()
        settle()
        return
      }
      // A resize (the rail collapsing, full screen, a rotated phone) is treated like a gesture: keep the
      // same centre, move the painted layers on the compositor, and repaint once when it has stopped.
      const cx = (prev.w / 2 - t.current.x) / t.current.k
      const cy = (prev.h / 2 - t.current.y) / t.current.k
      setT({ k: t.current.k, x: w / 2 - cx * t.current.k, y: h / 2 - cy * t.current.k })
    }
    const first = fitted.current !== sheet.id
    fitted.current = sheet.id
    measure(first)
    remeasure.current = () => measure(false)
    // Behind another screen (the Atlas is kept alive there) a change of size waits until the map is in front again.
    const ro = new ResizeObserver(() => {
      if (!activeRef.current) return
      measure(false)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [sheet]) // eslint-disable-line react-hooks/exhaustive-deps

  const onActive = useCallback(
    (active: boolean) => {
      if (activeRef.current === active) return
      activeRef.current = active
      container.current?.classList.toggle('atlas-asleep', !active)
      // Behind another screen the map is not a tab stop (the screen is not made inert as a whole: see App.tsx).
      if (container.current) container.current.tabIndex = active ? 0 : -1
      if (active) {
        remeasure.current()
        return
      }
      cancelAnim()
      cancelAnimationFrame(settleWatch.current)
      settleWatch.current = 0
    },
    [cancelAnim],
  )

  // Re-measure names once web fonts are ready (widths measured before are for the fallback font).
  useEffect(() => {
    let alive = true
    void document.fonts?.ready.then(() => {
      if (!alive) return
      resetMeasureCache()
      requestLayout()
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(
    () => () => {
      cancelAnim()
      cancelAnimationFrame(settleWatch.current)
    },
    [cancelAnim],
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
    let pinch: { dist: number; k: number; wx: number; wy: number; cx: number; cy: number } | null = null
    let tap: { x: number; y: number; time: number } | null = null
    /** Two fingers down together and lifted without moving: zoom out (as in other map apps). */
    let twoTap: { time: number; moved: boolean; cx: number; cy: number } | null = null
    let moved = false
    let samples: Array<{ x: number; y: number; t: number }> = []
    let zoomSamples: Array<{ k: number; t: number; cx: number; cy: number }> = []
    let wheel: { f: number; x: number; y: number } | null = null
    /** A mouse-wheel zoom easing towards `target` around the cursor. */
    let wheelTo: { target: number; fx: number; fy: number; last: number } | null = null
    let lastWheel = 0
    let frame = 0
    let lastTap = 0
    let hoverFrame = 0
    let pendingTap: ReturnType<typeof setTimeout> | undefined
    let hoverAt: { x: number; y: number } | null = null
    /** The symbol under the finger, shown pressed from the moment of contact. */
    let pressed: Element | null = null
    const press = (id: string | null) => {
      pressed?.classList.remove('is-pressed')
      pressed = id ? (labelLayer.current?.querySelector(`[data-place="${CSS.escape(id)}"]`) ?? null) : null
      pressed?.classList.add('is-pressed')
    }

    const local = (e: PointerEvent | WheelEvent | MouseEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    const stopMotion = () => {
      cancelAnim()
      wheelTo = null
    }

    const flush = () => {
      frame = 0
      inputPending.current = false
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        if (twoTap && (Math.abs(dist - pinch.dist) > 12 || Math.hypot(cx - pinch.cx, cy - pinch.cy) > 12)) twoTap.moved = true
        const k = softK(pinch.k * (dist / pinch.dist))
        setT({ k, x: cx - pinch.wx * k, y: cy - pinch.wy * k }, 'soft')
        zoomSamples.push({ k: t.current.k, t: performance.now(), cx, cy })
        if (zoomSamples.length > 10) zoomSamples.shift()
      } else if (pan && moved && pointers.size === 1) {
        const p = pointers.values().next().value!
        setT({ k: t.current.k, x: pan.tx + (p.x - pan.x), y: pan.ty + (p.y - pan.y) }, 'soft')
      }
      if (wheel) {
        const { f, x, y } = wheel
        wheel = null
        const cur = t.current
        const { min, max } = limits()
        const k = clamp(cur.k * f, min, max)
        const wx = (x - cur.x) / cur.k
        const wy = (y - cur.y) / cur.k
        setT({ k, x: x - wx * k, y: y - wy * k })
      }
    }
    const request = () => {
      inputPending.current = true
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const startPinch = () => {
      const [a, b] = [...pointers.values()]
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const cur = t.current
      pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: cur.k, wx: (cx - cur.x) / cur.k, wy: (cy - cur.y) / cur.k, cx, cy }
      zoomSamples = []
    }

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-map-ui]')) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      stopMotion()
      el.setPointerCapture(e.pointerId)
      rect = el.getBoundingClientRect()
      const p = local(e)
      pointers.set(e.pointerId, p)
      holding.current = true
      if (pointers.size === 1) {
        pan = { x: p.x, y: p.y, tx: t.current.x, ty: t.current.y }
        // Taps are timed by when the input happened (the event's own timestamp), not by when the page got round to
        // handling it: a busy frame between two taps must not turn a double tap into two single ones.
        tap = { ...p, time: e.timeStamp }
        moved = false
        samples = [{ ...p, t: e.timeStamp }]
        twoTap = null
        press(symbolRef.current((p.x - t.current.x) / t.current.k, (p.y - t.current.y) / t.current.k))
      } else if (pointers.size === 2) {
        press(null)
        startPinch()
        twoTap = tap && pinch && e.timeStamp - tap.time < 250 ? { time: e.timeStamp, moved: false, cx: pinch.cx, cy: pinch.cy } : null
        moved = true
        tap = null
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        // Hover (mouse, no buttons): show what a click would open.
        if (e.pointerType === 'mouse' && !e.buttons) {
          hoverAt = local(e)
          if (!hoverFrame)
            hoverFrame = requestAnimationFrame(() => {
              hoverFrame = 0
              if (hoverAt && !moving.current) hoverRef.current(hoverAt.x, hoverAt.y)
            })
        }
        return
      }
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        if (!moved && tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) {
          moved = true
          press(null)
        }
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
        if (Math.hypot(vx, vy) > 0.02) nextFrame(step)
        else settle()
      }
      nextFrame(step)
    }

    /** Zoom momentum after a quick pinch: the scale keeps changing briefly around the fingers' last centre. */
    const zoomGlide = () => {
      const last = zoomSamples[zoomSamples.length - 1]
      const first = last && zoomSamples.find((s) => last.t - s.t <= 90)
      if (!last || !first || last.t - first.t < 12 || performance.now() - last.t > 60 || prefersReducedMotion()) return false
      let v = Math.log(last.k / first.k) / (last.t - first.t) // ln(scale) per ms
      if (Math.abs(v) < 0.0012) return false
      v = Math.max(-0.006, Math.min(0.006, v))
      let prev = performance.now()
      const step = (now: number) => {
        const dt = Math.min(48, Math.max(1, now - prev))
        prev = now
        const cur = t.current
        const { min, max } = limits()
        const k = clamp(cur.k * Math.exp(v * dt), min, max)
        const wx = (last.cx - cur.x) / cur.k
        const wy = (last.cy - cur.y) / cur.k
        setT({ k, x: last.cx - wx * k, y: last.cy - wy * k })
        v *= Math.exp(-dt / 140)
        if (Math.abs(v) > 0.00015 && t.current.k !== cur.k) nextFrame(step)
        else settle()
      }
      nextFrame(step)
      return true
    }

    const zoomAround = (x: number, y: number, f: number) => {
      const cur = t.current
      const wx = (x - cur.x) / cur.k
      const wy = (y - cur.y) / cur.k
      const { min, max } = limits()
      const k = clamp(cur.k * f, min, max)
      animateTo({ k, x: x - wx * k, y: y - wy * k }, { ms: TAP_ZOOM_MS, ease: easeOut, focus: [x, y] })
    }

    /** Was the view pulled past a bound? Then let it spring back (or, under reduced motion, it never left). */
    const springBack = () => {
      const from = { ...t.current }
      const to = clampT(from)
      if (Math.abs(to.x - from.x) < 0.5 && Math.abs(to.y - from.y) < 0.5 && Math.abs(to.k / from.k - 1) < 0.001) return false
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / SPRING_BACK_MS)
        const e = easeOut(p)
        const k = from.k * Math.pow(to.k / from.k, e)
        setT({ k, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, 'free')
        if (p < 1) nextFrame(step)
        else settle()
      }
      nextFrame(step)
      return true
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.delete(e.pointerId)
      holding.current = pointers.size > 0
      press(null)
      // Two fingers down together and both lifted without moving: zoom out around them.
      if (pointers.size === 0 && twoTap && !twoTap.moved && e.timeStamp - twoTap.time < 350) {
        const { cx, cy } = twoTap
        twoTap = null
        pinch = null
        pan = null
        tap = null
        zoomAround(cx, cy, 1 / TAP_ZOOM)
        return
      }
      if (pinch) {
        if (pointers.size >= 2) startPinch()
        else if (pointers.size === 1) {
          // Carry on panning with the finger that stayed down.
          pinch = null
          const rest = pointers.values().next().value!
          pan = { x: rest.x, y: rest.y, tx: t.current.x, ty: t.current.y }
          samples = []
        } else pinch = null
        if (pointers.size === 0 && !springBack() && (e.type === 'pointercancel' || !zoomGlide())) settle()
        return
      }
      if (pointers.size > 0) return
      if (frame) {
        cancelAnimationFrame(frame)
        flush()
      }
      const wasTap = !moved && tap && e.timeStamp - tap.time < 400
      pan = null
      tap = null
      if (wasTap) {
        const now = e.timeStamp
        const cur = t.current
        if (now - lastTap < 300) {
          // Double tap / double click → zoom in around the point (Shift: out). The first tap's pending selection is dropped.
          clearTimeout(pendingTap)
          zoomAround(p.x, p.y, e.shiftKey ? 1 / TAP_ZOOM : TAP_ZOOM)
          lastTap = 0
        } else {
          lastTap = now
          const target = tapRef.current((p.x - cur.x) / cur.k, (p.y - cur.y) / cur.k)
          // A tap on a place or a question pin acts at once. A tap on open map (a state, a country, nothing)
          // waits a moment in case it is the first of a double tap, which zooms instead.
          if (target.type === 'pin' || (target.type === 'place' && instantRef.current)) selectRef.current?.(target)
          else pendingTap = setTimeout(() => selectRef.current?.(target), 250)
        }
        return
      }
      if (springBack()) return
      const v = velocity(e.timeStamp)
      if (e.type !== 'pointercancel' && Math.hypot(v.x, v.y) > 0.12 && !prefersReducedMotion()) glide(v)
      else settle()
    }

    const wheelStep = (now: number) => {
      if (!wheelTo) return
      const dt = Math.min(48, Math.max(1, now - wheelTo.last))
      wheelTo.last = now
      const cur = t.current
      const a = 1 - Math.exp(-dt / WHEEL_TAU)
      let k = cur.k * Math.pow(wheelTo.target / cur.k, a)
      const done = Math.abs(Math.log(wheelTo.target / k)) < 0.003
      if (done) k = wheelTo.target
      const wx = (wheelTo.fx - cur.x) / cur.k
      const wy = (wheelTo.fy - cur.y) / cur.k
      setT({ k, x: wheelTo.fx - wx * k, y: wheelTo.fy - wy * k })
      if (done || Math.abs(t.current.k - k) > 1e-9) {
        wheelTo = null
        settle()
        return
      }
      nextFrame(wheelStep)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      lastInput.current = performance.now()
      // The container only moves on resize; refresh its position once per wheel burst.
      if (e.timeStamp - lastWheel > 250) rect = el.getBoundingClientRect()
      lastWheel = e.timeStamp
      const p = local(e)
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      if (isWheelNotch(e) && !prefersReducedMotion()) {
        // A mouse wheel moves in steps: ease each step in, accumulating, around the cursor.
        const { min, max } = limits()
        const base = wheelTo && performance.now() - wheelTo.last < 150 ? wheelTo.target : t.current.k
        const target = clamp(base * Math.exp(-dy * WHEEL_RATE), min, max)
        const running = !!wheelTo
        wheelTo = { target, fx: p.x, fy: p.y, last: wheelTo?.last ?? performance.now() }
        if (!running) {
          cancelAnim()
          nextFrame(wheelStep)
        }
        return
      }
      // Trackpads send a stream of small deltas (pinch arrives with ctrlKey): apply them directly.
      stopMotion()
      const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : WHEEL_RATE))
      wheel = { f: (wheel?.f ?? 1) * f, x: p.x, y: p.y }
      request()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el) return
      const { w, h } = size.current
      const cur = t.current
      const step = 90
      const nudge = (dx: number, dy: number) => animateTo({ ...cur, x: cur.x + dx, y: cur.y + dy }, { ms: 180, ease: easeOut })
      switch (e.key) {
        case 'ArrowLeft':
          nudge(step, 0)
          break
        case 'ArrowRight':
          nudge(-step, 0)
          break
        case 'ArrowUp':
          nudge(0, step)
          break
        case 'ArrowDown':
          nudge(0, -step)
          break
        case '+':
        case '=':
          zoomAround(w / 2, h / 2, 1.6)
          break
        case '-':
        case '_':
          zoomAround(w / 2, h / 2, 1 / 1.6)
          break
        default:
          return
      }
      e.preventDefault()
    }

    const onLeave = () => {
      hoverAt = null
      hoverRef.current(NaN, NaN)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      inputPending.current = false
      cancelAnimationFrame(hoverFrame)
      clearTimeout(pendingTap)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('keydown', onKey)
    }
  }, [animateTo, cancelAnim, clampT, limits, nextFrame, setT, settle, softK])

  // Spatial indexes: built when the data changes, not on every layout.
  const placeIndex = useMemo(() => new GridIndex(props.places, (p) => [p.x, p.y, p.x, p.y], sheet.width, sheet.height), [props.places, sheet])
  const labelIndex = useMemo(() => labelIndexFor(sheet.labels, sheet.width, sheet.height), [sheet])
  const riversById = useMemo(() => new Map(sheet.rivers.map((r) => [`river:${r.id}`, r])), [sheet])
  /** Outlines smallest first, so a tap inside nested areas opens the innermost. */
  const areasBySize = useMemo(() => [...sheet.areas].sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])), [sheet])
  /** Sheet features whose own name already labels a place, so the place needs no symbol. */
  const labelled = useMemo(() => new Set(sheet.labels.map(labelKeyOf)), [sheet])
  const discovered = props.discovered
  const known = useCallback((id: string) => !discovered || discovered.has(id), [discovered])
  /** The symbols drawn at the last layout: taps and hovers only find what is on screen. */
  const drawn = useRef<Place[]>([])

  /** The drawn symbol nearest (wx, wy) sheet px, within a finger's reach. */
  const symbolAt = (wx: number, wy: number): string | null => {
    const k = t.current.k
    let best: Place | null = null
    let bestD = 18 / k
    for (const p of drawn.current) {
      const d = Math.hypot(p.x - wx, p.y - wy)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best?.id ?? null
  }
  const symbolRef = useRef(symbolAt)
  symbolRef.current = (wx, wy) => (props.showPlaces === false ? null : symbolAt(wx, wy))

  /** The place a tap or hover at (wx, wy) sheet px points at: a symbol, a name, a course or an outline. */
  const placeAt = (wx: number, wy: number): string | null => {
    const k = t.current.k
    const sym = symbolAt(wx, wy)
    if (sym) return sym
    const features = props.featurePlaces ?? props.linkedLabels ?? new Map<string, string>()
    // Named features (ranges, seas, lakes…) by their name.
    const near = 34 / k
    for (const l of labelIndex.query([wx - near, wy - near, wx + near, wy + near])) {
      if (l.kind === 'river' || l.x === undefined || l.y === undefined) continue
      const placeId = features.get(labelKeyOf(l))
      if (placeId && Math.hypot(l.x - wx, l.y - wy) < near) return placeId
    }
    // Rivers along their course.
    for (const [key, placeId] of features) {
      if (!key.startsWith('river:')) continue
      const r = riversById.get(key)
      if (r && distanceToLines([wx, wy], r.coords) < 7 / k) return placeId
    }
    // Inside a drawn outline (a park, a wetland, a disputed region).
    const near2 = container.current?.classList.contains('atlas-near')
    for (const a of areasBySize) {
      if (a.kind === 'land' || (a.kind === 'park' && !(props.showAreas && near2)) || (a.kind === 'region' && !props.showAreas)) continue
      if (wx < a.bbox[0] || wx > a.bbox[2] || wy < a.bbox[1] || wy > a.bbox[3]) continue
      const placeId = features.get(`area:${a.id}`)
      if (placeId && pointInGeometry([wx, wy], a.geometry)) return placeId
    }
    return null
  }

  // Tap → a pin, else a place, else the state/country under the finger.
  const tapRef = useRef<(x: number, y: number) => MapTarget>(() => ({ type: 'point', x: 0, y: 0 }))
  tapRef.current = (wx: number, wy: number): MapTarget => {
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
      if (best) return { type: 'pin', id: best.id }
    }
    if (props.showPlaces !== false) {
      const id = placeAt(wx, wy)
      if (id) return { type: 'place', id }
    }
    const st = featureAt(sheet.states, [wx, wy])
    if (st) return { type: 'state', id: st.id }
    const c = featureAt(sheet.countries, [wx, wy])
    if (c) return { type: 'country', id: c.id }
    return { type: 'point', x: wx, y: wy }
  }
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const instantRef = useRef(props.instantSelect)
  instantRef.current = props.instantSelect

  // Hover (mouse): a pointer cursor and a lifted symbol over anything a click would open.
  const hovered = useRef<string | null>(null)
  const hoverRef = useRef<(sx: number, sy: number) => void>(() => {})
  hoverRef.current = (sx: number, sy: number) => {
    const el = container.current
    if (!el || props.showPlaces === false) return
    const cur = t.current
    const id = Number.isNaN(sx) ? null : placeAt((sx - cur.x) / cur.k, (sy - cur.y) / cur.k)
    if (id === hovered.current) return
    const layer = labelLayer.current
    if (hovered.current) layer?.querySelector(`[data-place="${CSS.escape(hovered.current)}"]`)?.classList.remove('is-hover')
    hovered.current = id
    if (id) layer?.querySelector(`[data-place="${CSS.escape(id)}"]`)?.classList.add('is-hover')
    el.style.cursor = id ? 'pointer' : ''
  }

  // ── derived drawing data (recomputed only when the view settles) ────────
  const colours = useMemo(() => {
    const ids = sheet.states.length ? sheet.states.map((s) => s.id) : sheet.countries.map((c) => c.id)
    return colourAssignment(ids, sheet.stateNeighbours.size ? sheet.stateNeighbours : worldNeighbours(sheet))
  }, [sheet])

  /**
   * Which place symbols to draw at this zoom: capitals always, then more detail
   * as you zoom in, thinned so symbols never crowd. Discovered places come
   * first; places not yet discovered are drawn muted and a little later.
   * Places the base map already names (rivers, ranges, seas…) show through
   * that name instead.
   */
  const visible = useMemo<Place[]>(() => {
    if (!layoutT || props.showPlaces === false) return []
    const z = layoutT.k / kFit.current
    const { w, h, o } = layoutT
    const kinds = props.kinds
    const minZ = (p: Place) => (p.kind === 'capital' ? (p.tags?.includes('national') || p.level === 1 ? 0 : 1.4) : p.level === 1 ? 1.3 : p.level === 2 ? 2 : 2.9)
    const prio = (p: Place) =>
      (p.id === props.selectedId ? 1000 : 0) + (props.pyqPlaceIds?.has(p.id) ? 80 : 0) + (props.newIds?.has(p.id) ? 500 : 0) + (known(p.id) ? 200 : 0) + (p.kind === 'capital' ? 60 : 0) + (4 - p.level) * 20 + (p.yield?.score ?? 0) / 5
    const cand = placeIndex
      .query(viewRect(layoutT, w, h, 20 + o))
      .filter((p) => {
        if (p.id === props.selectedId || props.newIds?.has(p.id)) return true
        if (kinds && !kinds.has(p.kind)) return false
        const isKnown = known(p.id)
        if (!isKnown && !props.showUndiscovered) return false
        if (p.geom && labelled.has(p.geom) && !props.pyqPlaceIds?.has(p.id)) return false
        return z >= (props.pyqPlaceIds?.has(p.id) ? 0.9 : minZ(p) + (isKnown ? 0 : 0.35))
      })
      .map((p) => ({ p, sx: p.x * layoutT.k + layoutT.x, sy: p.y * layoutT.k + layoutT.y }))
      .filter(({ sx, sy }) => sx > -20 - o && sx < w + 20 + o && sy > -20 - o && sy < h + 20 + o)
      .sort((a, b) => prio(b.p) - prio(a.p))
    const taken: Array<[number, number]> = []
    const out: Place[] = []
    for (const c of cand) {
      if (taken.some(([x, y]) => Math.abs(x - c.sx) < 13 && Math.abs(y - c.sy) < 13) && c.p.id !== props.selectedId) continue
      taken.push([c.sx, c.sy])
      out.push(c.p)
    }
    return out
  }, [layoutT, placeIndex, props.showPlaces, props.selectedId, props.newIds, props.kinds, props.showUndiscovered, props.pyqPlaceIds, known, labelled])
  drawn.current = visible

  const labels = useMemo<PlacedLabel[]>(() => {
    if (!layoutT) return []
    const symbols: PlacedSymbol[] = visible.map((p) => ({
      place: p,
      x: p.x * layoutT.k + layoutT.x,
      y: p.y * layoutT.k + layoutT.y,
      mastery: props.mastery?.(p.id) ?? 'discovered',
      isNew: props.newIds?.has(p.id) ?? false,
      selected: props.selectedId === p.id,
      muted: !known(p.id),
    }))
    const placed = layoutLabels({
      labels: sheet.labels,
      index: labelIndex,
      places: symbols,
      t: layoutT,
      kFit: kFit.current,
      width: layoutT.w,
      height: layoutT.h,
      mutedIds: props.mutedLabels ?? new Set(),
      linked: props.linkedLabels ?? new Map(),
      foggedStates: NO_STATES,
      selectedId: props.selectedId,
      sheetId: sheet.id,
      hidden: props.hiddenLabels,
      overscan: layoutT.o,
      prefer: namePositions.current,
    })
    namePositions.current = new Map(placed.filter((l) => l.opt !== undefined).map((l) => [l.key, l.opt!]))
    // Laid out in screen space for this view; written in the frame's coordinates, which don't change while the zoom doesn't.
    const dx = layoutT.fx - layoutT.x
    const dy = layoutT.fy - layoutT.y
    const beyond = (l: PlacedLabel) => l.x < -40 || l.y < -20 || l.x > layoutT.w + 40 || l.y > layoutT.h + 20
    return placed.map((l) => (l.path ? l : { ...l, x: r2(l.x + dx), y: r2(l.y + dy), beyond: beyond(l) }))
  }, [layoutT, visible, labelIndex, props.mastery, props.newIds, props.selectedId, props.mutedLabels, props.linkedLabels, props.hiddenLabels, sheet, known])

  const symbols = useMemo(() => {
    if (!layoutT) return []
    return visible.map((p) => ({ p, x: r2(p.x * layoutT.k + layoutT.fx), y: r2(p.y * layoutT.k + layoutT.fy), muted: !known(p.id) }))
  }, [layoutT, visible, known])

  const routeScreen = useMemo(() => {
    if (!layoutT || !props.route) return null
    return props.route.points.map((pt) => ({ ...pt, sx: r2(pt.x * layoutT.k + layoutT.fx), sy: r2(pt.y * layoutT.k + layoutT.fy) }))
  }, [layoutT, props.route])

  const livingScreen = useMemo(() => {
    const lw = props.living
    if (!layoutT || !lw) return null
    const S = (x: number, y: number) => [r2(x * layoutT.k + layoutT.fx), r2(y * layoutT.k + layoutT.fy)] as const
    const { w, h, o } = layoutT
    // Frame coordinates differ from the view's by the pan since the frame was set.
    const dx = layoutT.fx - layoutT.x
    const dy = layoutT.fy - layoutT.y
    const onScreen = (x: number, y: number) => x - dx > -30 - o && x - dx < w + 30 + o && y - dy > -30 - o && y - dy < h + 30 + o
    const z = layoutT.k / kFit.current
    return {
      routes: lw.routes.map((r) => ({ r, d: 'M' + r.points.map(([x, y]) => S(x, y).map((v) => v.toFixed(1)).join(',')).join('L') })),
      ships: lw.ships.map((sh) => ({ ...sh, s: S(sh.x, sh.y) })).filter(({ s }) => onScreen(s[0], s[1])),
      wildlife: z >= 1.2 ? lw.wildlife.map((a) => ({ ...a, s: S(a.x, a.y) })).filter(({ s }) => onScreen(s[0], s[1])) : [],
    }
  }, [layoutT, props.living])

  const pinScreen = useMemo(() => {
    if (!layoutT || !props.pins) return []
    return props.pins.map((p) => ({ ...p, sx: r2(p.x * layoutT.k + layoutT.fx), sy: r2(p.y * layoutT.k + layoutT.fy) }))
  }, [layoutT, props.pins])

  const highlightScreen = useMemo(() => {
    if (!layoutT) return []
    return (props.highlights ?? []).filter((h) => h.kind === 'point' && h.x !== undefined).map((h) => ({ ...h, sx: r2(h.x! * layoutT.k + layoutT.fx), sy: r2(h.y! * layoutT.k + layoutT.fy) }))
  }, [layoutT, props.highlights])

  /**
   * The laid-out area in the frame's coordinates. The names layer has no box of
   * its own to clip to (its coordinates stay put while the map is panned), so
   * anything that can reach far beyond the view – a route across the whole
   * sheet, a pin elsewhere – is drawn inside a nested <svg> of this size.
   * Unclipped, one long line makes the layer as large as the sheet, and every
   * small change to it rasterises all of that.
   */
  const area = useMemo(() => {
    if (!layoutT) return null
    const pad = layoutT.o + 60
    const x = Math.round(layoutT.fx - layoutT.x - pad)
    const y = Math.round(layoutT.fy - layoutT.y - pad)
    const width = Math.round(layoutT.w + 2 * pad)
    const height = Math.round(layoutT.h + 2 * pad)
    return { x, y, width, height, viewBox: `${x} ${y} ${width} ${height}`, overflow: 'hidden' as const, has: (px: number, py: number) => px >= x && py >= y && px <= x + width && py <= y + height }
  }, [layoutT])
  const clip = area ? { x: area.x, y: area.y, width: area.width, height: area.height, viewBox: area.viewBox, overflow: area.overflow } : null

  const toneId = props.tone ?? 'day'
  // A style change cross-fades: the old style stays on its own compositor layer and fades out.
  const [fadeFrom, setFadeFrom] = useState<{ plate: Plate; tone: Tone } | null>(null)
  const lastStyle = useRef({ plate: props.plate, tone: toneId })
  useEffect(() => {
    const prev = lastStyle.current
    lastStyle.current = { plate: props.plate, tone: toneId }
    if ((prev.plate === props.plate && prev.tone === toneId) || prefersReducedMotion()) return
    setFadeFrom(prev)
    const id = setTimeout(() => setFadeFrom(null), 360)
    return () => clearTimeout(id)
  }, [props.plate, toneId])
  const tone = TONES[toneId]
  const routeColour = props.route?.color ?? ROUTE
  const flowing = props.living?.flowing
  const hasFlow = !!flowing && flowing.size > 0
  const calm = useMemo(() => lowPowerDevice(), [])
  const ids = { clip: `sheet-clip-${uid}`, glow: `city-glow-${uid}` }
  return (
    <div
      ref={container}
      className={cn('atlas relative size-full touch-none overflow-hidden outline-none select-none', calm && 'atlas-calm', props.className)}
      style={{ background: tone.paper, contain: 'layout paint' }}
      role="application"
      aria-label={`${sheet.title} map. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.`}
      tabIndex={0}
    >
      <Sleep onChange={onActive} />
      {/* Base map, painted in sheet coordinates into an oversized layer. */}
      <div ref={baseLayer} className="atlas-layer" aria-hidden="true">
        <svg className="absolute inset-0 size-full">
          <defs>
            <clipPath id={ids.clip}>
              <rect width={sheet.width} height={sheet.height} />
            </clipPath>
          </defs>
          <g ref={worldG}>
            <g clipPath={`url(#${ids.clip})`}>
              <BaseMap sheet={sheet} plate={props.plate} tone={toneId} colours={colours} explored={props.explored} showAreas={props.showAreas ?? false} />
            </g>
            {/* Neatline: the printed border of the map sheet. */}
            <rect width={sheet.width} height={sheet.height} fill="none" stroke={tone.neatline} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>

      {fadeFrom && (
        <div
          ref={fadeLayer}
          className="atlas-layer atlas-fade-out"
          aria-hidden="true"
          style={{ left: -layerGeom.current.m, top: -layerGeom.current.m, width: layerGeom.current.w + 2 * layerGeom.current.m, height: layerGeom.current.h + 2 * layerGeom.current.m, transform: baseLayer.current?.style.transform }}
        >
          <svg className="absolute inset-0 size-full">
            <g ref={fadeG} transform={worldG.current?.getAttribute('transform') ?? undefined}>
              <g clipPath={`url(#${ids.clip})`}>
                <BaseMap sheet={sheet} plate={fadeFrom.plate} tone={fadeFrom.tone} colours={colours} explored={props.explored} showAreas={props.showAreas ?? false} />
              </g>
            </g>
          </svg>
        </div>
      )}

      {/* What is selected or asked about: a layer of its own, a handful of paths, so choosing a place costs the base map nothing. */}
      <div ref={overlayLayer} className="atlas-layer" aria-hidden="true">
        <svg className="absolute inset-0 size-full">
          <g ref={overlayG}>
            <g clipPath={`url(#${ids.clip})`}>
              <Highlights sheet={sheet} highlights={props.highlights} />
            </g>
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
          {livingScreen && clip && (
            <svg {...clip}>
              {livingScreen.routes.map(({ r, d }) => (
                <RoutePath key={r.id} route={r} d={d} />
              ))}
            </svg>
          )}
          {livingScreen && (
            <g>
              {livingScreen.wildlife.map((a) => (
                <g key={a.id} transform={`translate(${a.s[0] + 16},${a.s[1] + 14})`}>
                  <title>{`${a.name}: ${a.species.replace('-', ' ')}`}</title>
                  <Animal species={a.species} />
                </g>
              ))}
            </g>
          )}
          {routeScreen && routeScreen.length > 1 && clip && (
            <svg {...clip}>
              <path d={'M' + routeScreen.map((p) => `${p.sx},${p.sy}`).join('L')} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
              <path d={'M' + routeScreen.map((p) => `${p.sx},${p.sy}`).join('L')} fill="none" stroke={routeColour} strokeWidth={2.2} strokeDasharray="7 4" strokeLinecap="round" strokeLinejoin="round" />
              {routeScreen.map((p) => (
                <circle key={p.id} cx={p.sx} cy={p.sy} r={p.state === 'future' ? 3.2 : 4} fill={p.state === 'future' ? '#fff' : routeColour} stroke={routeColour} strokeWidth={1.6} />
              ))}
            </svg>
          )}
          {symbols.map(({ p, x, y, muted }) => (
            <g key={p.id} transform={`translate(${x},${y})`}>
              <PlaceSymbol
                place={p}
                travelled={!!discovered && !muted}
                pyq={props.pyqPlaceIds?.has(p.id)}
                selected={props.selectedId === p.id}
                mastery={props.mastery?.(p.id) ?? 'discovered'}
                glowId={toneId === 'night' && props.living?.lights.has(p.id) ? ids.glow : undefined}
              />
            </g>
          ))}
          {/* River names are laid out in the view's own coordinates: moved into the frame as a group. */}
          <g transform={layoutT ? `translate(${r2(layoutT.fx - layoutT.x)},${r2(layoutT.fy - layoutT.y)})` : undefined}>{labels.map((l) => l.path && <RiverName key={l.key} label={l} tone={toneId} idPrefix={uid} />)}</g>
        </svg>
        {/* Point names are HTML: zooming the layer only rescales them, it never re-lays out SVG text. */}
        {labels.map((l) => !l.path && l.text && <PlaceName key={l.key} label={l} tone={toneId} />)}
        <svg className="absolute inset-0 size-full overflow-visible">
          <svg {...(clip ?? {})}>
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
        </svg>
        {/* Motion as HTML on compositor layers: animating these never repaints the names. */}
        {routeScreen?.map((p) => p.state === 'next' && area?.has(p.sx, p.sy) && <span key={p.id} className="atlas-ring" style={{ left: p.sx, top: p.sy, color: routeColour }} />)}
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
}), sameProps)

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
      ? c.state
      : l.style === 'country'
        ? c.country
        : l.style.startsWith('water') || l.style === 'river' || l.style === 'place-water'
          ? c.water
          : l.style.startsWith('physical') || l.style === 'place-physical'
            ? c.physical
            : c.place
  return {
    fill,
    fontFamily: FONT_SANS,
    fontStyle: spec.italic ? 'italic' : 'normal',
    fontWeight: spec.weight,
    fontSize: l.size,
    letterSpacing: `${spec.spacing}em`,
    halo: TONES[toneId].halo,
    haloWidth: l.style === 'state' || l.style === 'country' ? 3.2 : 2.8,
    // Names are never greyed for places or states not yet travelled: travel is shown by what it adds, not by dimming the rest.
    opacity: 1,
    color: fill,
  }
}

/**
 * A place's symbol. Memoised: when the view settles only its outer translate
 * changes, so React leaves the symbol itself alone.
 */
const PlaceSymbol = memo(function PlaceSymbol({ place: p, travelled, selected, mastery, glowId, pyq }: { place: Place; travelled: boolean; selected: boolean; mastery: MasteryLevel; glowId?: string; pyq?: boolean }) {
  // Inner group: hover lift and fade-in, in CSS. Every place is drawn at full strength; a travelled one gains a warm ring.
  return (
    <g data-place={p.id} className="atlas-sym" data-travelled={travelled || undefined}>
      {glowId && <circle r={12} fill={`url(#${glowId})`} />}
      {travelled && <circle r={10.5} fill={TRAVELLED} fillOpacity={0.14} stroke={TRAVELLED} strokeWidth={1.3} strokeOpacity={0.85} />}
      {pyq && <circle r={15} fill="none" stroke="#b8781b" strokeWidth={1.6} strokeDasharray="2 3" />}
      {selected && <circle r={12} fill="none" stroke={HIGHLIGHT} strokeWidth={2.5} className="atlas-selected" />}
      <Symbol kind={p.kind} tags={p.tags} national={p.tags?.includes('national')} />
      <MasteryBadge level={mastery} />
    </g>
  )
})

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
  const { color, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, halo, haloWidth } = labelPaint(l, toneId)
  return (
    // The outer span is the anchor point, so a counter-scale keeps it in place; the inner one holds the text.
    <span className="atlas-name" data-beyond={l.beyond || undefined} style={{ left: l.x, top: l.y }}>
      <span
        className="atlas-name-text"
        style={{
          color,
          fontFamily,
          fontStyle,
          fontWeight,
          fontSize,
          letterSpacing,
          WebkitTextStroke: `${haloWidth}px ${halo}`,
          transform: `translate(${l.anchor === 'middle' ? '-50%' : l.anchor === 'end' ? '-100%' : '0'},${-baselineFromTop(l.style, l.size)}px)`,
        }}
      >
        {l.text}
      </span>
    </span>
  )
}, sameName)

/** A layout makes new label objects every time; a name only needs rendering again if what it shows has changed. */
function sameName(a: { label: PlacedLabel; tone: Tone }, b: { label: PlacedLabel; tone: Tone }) {
  const p = a.label
  const n = b.label
  return a.tone === b.tone && p.x === n.x && p.y === n.y && p.text === n.text && p.size === n.size && p.anchor === n.anchor && p.style === n.style && !p.beyond === !n.beyond
}

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
const areaGroups = new WeakMap<Sheet, Record<AreaFeature['kind'], string>>()

/** Everything drawn in sheet coordinates. Memoised: only re-renders when data changes, and only repaints when the view settles. */
const BaseMap = memo(function BaseMap({ sheet, plate, tone: toneId, colours, explored, showAreas }: { sheet: Sheet; plate: Plate; tone: Tone; colours: Map<string, string>; explored: Set<string> | null; showAreas: boolean }) {
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
  const areas = useMemo(() => {
    let a = areaGroups.get(sheet)
    if (!a) {
      a = { park: '', water: '', region: '', land: '' }
      for (const f of sheet.areas) a[f.kind] += f.d
      areaGroups.set(sheet, a)
    }
    return a
  }, [sheet])
  /** States (India) or countries (World) the learner has travelled. With no travel record (`null`) nothing is marked. */
  const travelled = useMemo(() => {
    const units: MapFeature[] = isIndia ? sheet.states : sheet.countries
    return explored ? units.filter((u) => explored.has(u.id)).map((u) => u.d).join('') : ''
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
      {/* Overlay outlines: lakes and wetlands always; protected areas close up; disputed regions. */}
      {areas.water && <path d={areas.water} fill={tone.lake} stroke={tone.lakeStroke} strokeWidth={0.6} {...ns} />}
      {showAreas && areas.park && (
        <g className="atlas-parks">
          <path d={areas.park} fill={tone.park} fillOpacity={0.16} stroke={tone.parkLine} strokeWidth={0.9} strokeDasharray="3 2" strokeOpacity={0.85} {...ns} />
        </g>
      )}

      {/* Travelled areas: a faint warm wash. The rest of the map is never veiled, greyed or hatched. */}
      {travelled && <path d={travelled} fill={tone.travelled} fillOpacity={physical ? 0.07 : 0.1} />}

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

      {/* …and a warm edge over the state boundaries. */}
      {travelled && <path d={travelled} fill="none" stroke={tone.travelled} strokeWidth={1.7} strokeOpacity={0.8} strokeLinejoin="round" {...ns} />}

      {showAreas && areas.region && <path d={areas.region} fill={tone.dispute} fillOpacity={0.07} stroke={tone.dispute} strokeWidth={1.1} strokeDasharray="5 3" {...ns} />}

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

const Highlights = memo(function Highlights({ sheet, highlights }: { sheet: Sheet; highlights?: Highlight[] }) {
  if (!highlights?.length) return null
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
        if (h.kind === 'region' || h.kind === 'marine' || h.kind === 'lake' || h.kind === 'area') {
          const f = (h.kind === 'region' ? sheet.regions : h.kind === 'marine' ? sheet.marine : h.kind === 'area' ? sheet.areas : sheet.lakes).find((x) => x.id === h.id)
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
