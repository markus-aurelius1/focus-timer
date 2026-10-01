/**
 * Label placement in screen space. Candidates are ranked, measured with the
 * real font, and placed greedily without overlap – the classic atlas rule of
 * "fewer, legible names" at every zoom level.
 */
import { boundsOf, GridIndex, viewRect } from '@/atlas/spatial'
import type { LabelKind, MapLabel, Place } from '@/atlas/types'
import type { MasteryLevel } from './style'

export interface Transform {
  k: number
  x: number
  y: number
}

export type LabelStyle = 'state' | 'country' | 'water-major' | 'water' | 'physical-major' | 'physical' | 'place' | 'place-physical' | 'place-water' | 'river'

export interface PlacedLabel {
  key: string
  text: string
  style: LabelStyle
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  size: number
  /** Screen-space path for river labels. */
  path?: string
  muted?: boolean
  placeId?: string
}

export interface PlacedSymbol {
  place: Place
  x: number
  y: number
  mastery: MasteryLevel
  isNew: boolean
  selected: boolean
  /** Not yet discovered: named later, after discovered places, in a quieter tone. */
  muted?: boolean
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

let ctx: CanvasRenderingContext2D | null = null
const widthCache = new Map<string, number>()
export const FONT_SANS = 'Manrope, ui-sans-serif, system-ui, sans-serif'
export const FONT_SERIF = 'Manrope, ui-sans-serif, system-ui, sans-serif'

function measure(text: string, size: number, weight: number, italic: boolean, serif: boolean, spacing: number): number {
  const key = `${text}|${size}|${weight}|${italic}|${serif}|${spacing}`
  const hit = widthCache.get(key)
  if (hit !== undefined) return hit
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d')
  let w = text.length * size * 0.58
  if (ctx) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${serif ? FONT_SERIF : FONT_SANS}`
    w = ctx.measureText(text).width
  }
  w += spacing * size * text.length
  widthCache.set(key, w)
  return w
}

export function resetMeasureCache() {
  widthCache.clear()
  metricsCache.clear()
}

const metricsCache = new Map<string, { ascent: number; descent: number }>()

/**
 * Ascent and descent of a label font (per 1 px of font size), as CSS inline
 * layout uses them, so HTML names can sit on exactly the baseline an SVG
 * `<text y>` would.
 */
export function fontMetrics(serif: boolean, weight: number, italic: boolean): { ascent: number; descent: number } {
  const key = `${serif}|${weight}|${italic}`
  const hit = metricsCache.get(key)
  if (hit) return hit
  let out = { ascent: serif ? 0.98 : 1.09, descent: serif ? 0.26 : 0.31 }
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d')
  if (ctx) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} 100px ${serif ? FONT_SERIF : FONT_SANS}`
    const m = ctx.measureText('Hg')
    if (m.fontBoundingBoxAscent) out = { ascent: m.fontBoundingBoxAscent / 100, descent: m.fontBoundingBoxDescent / 100 }
  }
  metricsCache.set(key, out)
  return out
}

/** Line height used for HTML map names (em). */
export const NAME_LINE_HEIGHT = 1.25

/** Distance from the top of an HTML name box to its baseline (px). */
export function baselineFromTop(style: LabelStyle, size: number): number {
  const spec = STYLE_SPEC[style]
  const { ascent, descent } = fontMetrics(spec.serif, spec.weight, spec.italic)
  return ((NAME_LINE_HEIGHT - (ascent + descent)) / 2 + ascent) * size
}

export const STYLE_SPEC: Record<LabelStyle, { weight: number; italic: boolean; serif: boolean; upper: boolean; spacing: number }> = {
  state: { weight: 700, italic: false, serif: false, upper: true, spacing: 0.08 },
  country: { weight: 700, italic: false, serif: false, upper: true, spacing: 0.14 },
  'water-major': { weight: 500, italic: true, serif: false, upper: true, spacing: 0.12 },
  water: { weight: 500, italic: true, serif: false, upper: false, spacing: 0.02 },
  river: { weight: 500, italic: true, serif: false, upper: false, spacing: 0.03 },
  'physical-major': { weight: 600, italic: true, serif: false, upper: true, spacing: 0.10 },
  physical: { weight: 500, italic: true, serif: false, upper: false, spacing: 0.02 },
  place: { weight: 650, italic: false, serif: false, upper: false, spacing: 0 },
  'place-physical': { weight: 600, italic: true, serif: false, upper: false, spacing: 0 },
  'place-water': { weight: 600, italic: true, serif: false, upper: false, spacing: 0 },
}

const WATER_KINDS: LabelKind[] = ['ocean', 'sea', 'bay', 'gulf', 'strait', 'lake']
const PLACE_WATER = new Set(['lake', 'wetland', 'river', 'confluence', 'waterfall', 'strait', 'gulf', 'sea', 'canal', 'glacier'])
const PLACE_PHYSICAL = new Set(['peak', 'pass', 'range', 'plateau', 'desert', 'plain', 'valley', 'coast', 'delta', 'island', 'cape', 'volcano', 'grassland', 'region'])

export interface LayoutInput {
  labels: MapLabel[]
  places: PlacedSymbol[]
  t: Transform
  kFit: number
  width: number
  height: number
  /** Sheet label ids that belong to an undiscovered place (shown muted). */
  mutedIds: Set<string>
  /** Sheet label id → place id (for discovered linked features). */
  linked: Map<string, string>
  /** States hidden by fog get lighter names. */
  foggedStates: Set<string>
  selectedId?: string
  sheetId: 'india' | 'world'
  /** Sheet label keys to leave out (e.g. answers during a question). */
  hidden?: Set<string>
  /** Spatial index over `labels`; when given, only labels near the view are considered. */
  index?: GridIndex<MapLabel>
}

const labelIndexes = new WeakMap<readonly MapLabel[], GridIndex<MapLabel>>()

/** A spatial index over a sheet's labels (river labels by the bounds of their course), built once per sheet. */
export function labelIndexFor(labels: readonly MapLabel[], width: number, height: number): GridIndex<MapLabel> {
  let idx = labelIndexes.get(labels)
  if (!idx) {
    idx = new GridIndex(labels, (l) => (l.path ? boundsOf(l.path) : l.x === undefined || l.y === undefined ? null : [l.x, l.y, l.x, l.y]), width, height)
    labelIndexes.set(labels, idx)
  }
  return idx
}

const WATER_KEY_KINDS = new Set(['ocean', 'sea', 'bay', 'gulf', 'strait'])
/** The key a sheet label is known by (`river:ganga`, `marine:palk-strait`, `region:thar-desert`…). */
export function labelKeyOf(l: MapLabel): string {
  if (l.kind === 'river') return `river:${l.id}`
  if (l.kind === 'lake') return `lake:${l.id}`
  if (WATER_KEY_KINDS.has(l.kind)) return `marine:${l.id}`
  if (l.kind === 'state' || l.kind === 'country') return `${l.kind}:${l.id}`
  return `region:${l.id}`
}

interface Candidate {
  label: PlacedLabel
  box: Box | Box[]
  priority: number
  /** River labels: alternative stretches of the course, best first. */
  windows?: RiverWindow[]
}

interface RiverWindow {
  d: string
  x: number
  y: number
  boxes: Box[]
}

/**
 * Candidate stretches of a river (screen space) long enough for its name,
 * centred at the middle first and then further up and downstream. Stretches
 * that bend sharply or leave the viewport are skipped; each is oriented to
 * read left-to-right.
 */
function riverWindows(pts: Array<[number, number]>, need: number, width: number, height: number): RiverWindow[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = cum[cum.length - 1]
  if (total < need * 1.15) return []
  const at = (t: number): [number, number] => {
    let i = 1
    while (i < cum.length - 1 && cum[i] < t) i++
    const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]
  }
  const out: RiverWindow[] = []
  for (const c of [0.5, 0.36, 0.64, 0.22, 0.78, 0.1, 0.9]) {
    const t0 = total * c - need / 2
    if (t0 < 0 || t0 + need > total) continue
    const steps = Math.max(4, Math.ceil(need / 14))
    let seg: Array<[number, number]> = []
    for (let k = 0; k <= steps; k++) seg.push(at(t0 + (need * k) / steps))
    if (seg.some(([x, y]) => x < 4 || y < 4 || x > width - 4 || y > height - 4)) continue
    // Reject tight bends: chord must be most of the arc length.
    const chord = Math.hypot(seg[seg.length - 1][0] - seg[0][0], seg[seg.length - 1][1] - seg[0][1])
    if (chord < need * 0.8) continue
    if (seg[0][0] > seg[seg.length - 1][0]) seg = seg.reverse()
    const mid = seg[Math.floor(seg.length / 2)]
    out.push({
      d: 'M' + seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L'),
      x: mid[0],
      y: mid[1],
      boxes: seg.map(([x, y]) => ({ x0: x - 7, y0: y - 10, x1: x + 7, y1: y + 5 })),
    })
  }
  return out
}

function textBox(x: number, y: number, w: number, size: number, anchor: 'start' | 'middle' | 'end', pad = 2): Box {
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return { x0: x0 - pad, y0: y - size * 0.8 - pad, x1: x0 + w + pad, y1: y + size * 0.3 + pad }
}

export function layoutLabels(input: LayoutInput): PlacedLabel[] {
  const { t, kFit, width, height } = input
  const z = t.k / kFit
  const toScreen = (x: number, y: number): [number, number] => [x * t.k + t.x, y * t.k + t.y]
  const inView = (sx: number, sy: number, m = 40) => sx > -m && sx < width + m && sy > -m && sy < height + m
  const cands: Candidate[] = []
  // Names are anchored inside the view (+40 px); river names need their course to cross it.
  const labels = input.index ? input.index.query(viewRect(t, width, height, 40)) : input.labels

  const add = (label: PlacedLabel, priority: number) => {
    const spec = STYLE_SPEC[label.style]
    const text = spec.upper ? label.text.toUpperCase() : label.text
    const w = measure(text, label.size, spec.weight, spec.italic, spec.serif, spec.spacing)
    cands.push({ label: { ...label, text }, box: textBox(label.x, label.y, w, label.size, label.anchor), priority })
  }

  // ── sheet labels ────────────────────────────────────────────────────────
  for (const l of labels) {
    if (input.hidden?.size && input.hidden.has(labelKeyOf(l))) continue
    if (l.kind === 'river') {
      if (!l.path || l.path.length < 2) continue
      const rank = l.rank ?? 4
      const linked = input.linked.has(`river:${l.id}`)
      const minZoom = rank === 1 ? 0 : rank === 2 ? 1.25 : rank === 3 ? 2 : 3.2
      if (z < minZoom && !linked) continue
      const size = rank === 1 ? 12.5 : rank === 2 ? 11.5 : 11
      const w = measure(l.name, size, 500, true, true, 0.03)
      const windows = riverWindows(l.path.map(([x, y]) => toScreen(x, y)), w * 1.1, width, height)
      if (!windows.length) continue
      cands.push({
        label: { key: `river:${l.id}`, text: l.name, style: 'river', x: 0, y: 0, anchor: 'middle', size, muted: input.mutedIds.has(`river:${l.id}`), placeId: input.linked.get(`river:${l.id}`) },
        box: windows.map((win) => win.boxes).flat(),
        windows,
        priority: (rank === 1 ? 95 : rank === 2 ? 60 : 38 - rank) + (linked ? 20 : 0),
      })
      continue
    }
    if (l.x === undefined || l.y === undefined) continue
    const [sx, sy] = toScreen(l.x, l.y)
    if (!inView(sx, sy)) continue
    const screenSize = l.size * t.k
    if (l.kind === 'state') {
      const r = (l.radius ?? 20) * t.k
      const size = Math.max(9, Math.min(14.5, 7 + screenSize / 55))
      const w = measure(l.name.toUpperCase(), size, 700, false, false, 0.08)
      // Small states fall back to their standard abbreviation (e.g. "H.P.").
      let text = l.name
      let fs = size
      if (r * 2.2 < w) {
        text = l.abbr ?? l.name
        fs = Math.max(9, size - 1.5)
        const wa = measure(text.toUpperCase(), fs, 700, false, false, 0.08)
        if (r * 2.6 < wa * 0.55 && z < 2.4) continue
      }
      add({ key: `state:${l.id}`, text, style: 'state', x: sx, y: sy + fs * 0.35, anchor: 'middle', size: fs, muted: input.foggedStates.has(l.id), placeId: undefined }, 100 + screenSize / 50)
      continue
    }
    if (l.kind === 'country') {
      const size = input.sheetId === 'world' ? Math.max(9, Math.min(15, 6 + screenSize / 60)) : 12.5
      if (input.sheetId === 'world' && screenSize < 40 && z < 2) continue
      add({ key: `country:${l.id}`, text: l.name, style: 'country', x: sx, y: sy + size * 0.35, anchor: 'middle', size }, 90 + screenSize / 60)
      continue
    }
    if (WATER_KINDS.includes(l.kind)) {
      const major = l.kind === 'ocean' || l.kind === 'sea' || (l.kind === 'bay' && screenSize > 200)
      if (l.kind === 'lake' && screenSize < 22 && z < 2.5) continue
      if ((l.kind === 'strait' || l.kind === 'gulf') && screenSize < 30 && z < 1.8) continue
      const size = major ? Math.max(10, Math.min(16, 6 + screenSize / 70)) : Math.max(10, Math.min(12.5, 9 + screenSize / 150))
      const key = `${l.kind === 'lake' ? 'lake' : 'marine'}:${l.id}`
      add({ key, text: l.name, style: major ? 'water-major' : 'water', x: sx, y: sy, anchor: 'middle', size, muted: input.mutedIds.has(key), placeId: input.linked.get(key) }, (major ? 70 : 35) + screenSize / 100 + (input.linked.has(key) ? 15 : 0))
      continue
    }
    // physical regions
    if (screenSize < 55 && z < 2.2) continue
    const major = screenSize > 160
    const size = major ? Math.max(10, Math.min(14, 7 + screenSize / 90)) : 11
    const key = `region:${l.id}`
    add({ key, text: l.name, style: major ? 'physical-major' : 'physical', x: sx, y: sy, anchor: 'middle', size, muted: input.mutedIds.has(key), placeId: input.linked.get(key) }, 50 + screenSize / 100 + (input.linked.has(key) ? 15 : 0))
  }

  // ── discovered places (symbols + names) ─────────────────────────────────
  for (const s of input.places) {
    const p = s.place
    if (!inView(s.x, s.y, 10)) continue
    const minZoom = s.selected || s.isNew ? 0 : (p.kind === 'capital' ? 0 : p.level === 1 ? 1.5 : p.level === 2 ? 2.2 : 3.1) + (s.muted ? 0.4 : 0)
    // The symbol itself reserves space so names don't cover it.
    cands.push({ label: { key: `sym:${p.id}`, text: '', style: 'place', x: s.x, y: s.y, anchor: 'middle', size: 0 }, box: { x0: s.x - 8, y0: s.y - 8, x1: s.x + 8, y1: s.y + 8 }, priority: 150 + (s.selected ? 100 : 0) })
    if (z < minZoom) continue
    const style: LabelStyle = PLACE_WATER.has(p.kind) ? 'place-water' : PLACE_PHYSICAL.has(p.kind) ? 'place-physical' : 'place'
    const size = p.kind === 'capital' ? 12.5 : 11.5
    const text = p.kind === 'peak' && p.elevation ? `${p.name} ${p.elevation.toLocaleString('en-IN')}` : p.name
    // Try right, left, above, below.
    const spec = STYLE_SPEC[style]
    const w = measure(text, size, spec.weight, spec.italic, spec.serif, spec.spacing)
    const options: Array<[number, number, 'start' | 'middle' | 'end']> = [
      [s.x + 10, s.y + size * 0.35, 'start'],
      [s.x - 10, s.y + size * 0.35, 'end'],
      [s.x, s.y - 11, 'middle'],
      [s.x, s.y + 11 + size * 0.7, 'middle'],
    ]
    const boxes = options.map(([x, y, a]) => textBox(x, y, w, size, a))
    cands.push({
      label: { key: `place:${p.id}`, text, style, x: options[0][0], y: options[0][1], anchor: 'start', size, placeId: p.id, muted: s.muted && !s.selected },
      box: boxes,
      priority: (s.selected ? 400 : s.isNew ? 180 : 0) + (p.level === 1 ? 85 : p.level === 2 ? 55 : 30) + (p.kind === 'capital' ? 20 : 0) - (s.muted && !s.selected ? 45 : 0),
    })
  }

  // ── greedy placement ────────────────────────────────────────────────────
  cands.sort((a, b) => b.priority - a.priority)
  const placed: Box[] = []
  const out: PlacedLabel[] = []
  const grid = new Map<string, Box[]>()
  const cell = 64
  const keysFor = (b: Box) => {
    const ks: string[] = []
    for (let gx = Math.floor(b.x0 / cell); gx <= Math.floor(b.x1 / cell); gx++) for (let gy = Math.floor(b.y0 / cell); gy <= Math.floor(b.y1 / cell); gy++) ks.push(`${gx},${gy}`)
    return ks
  }
  const collides = (b: Box) => keysFor(b).some((k) => grid.get(k)?.some((o) => overlaps(o, b)))
  const insert = (b: Box) => {
    placed.push(b)
    for (const k of keysFor(b)) {
      if (!grid.has(k)) grid.set(k, [])
      grid.get(k)!.push(b)
    }
  }

  for (const c of cands) {
    if (c.label.key.startsWith('place:')) {
      // Four candidate positions for point labels.
      const boxes = c.box as Box[]
      const opts: Array<[number, number, 'start' | 'middle' | 'end']> = [
        [c.label.x, c.label.y, 'start'],
        [c.label.x - 20, c.label.y, 'end'],
        [c.label.x - 10, c.label.y - 11 - c.label.size * 0.35, 'middle'],
        [c.label.x - 10, c.label.y + 11 + c.label.size * 0.35, 'middle'],
      ]
      const i = boxes.findIndex((b) => !collides(b))
      if (i === -1) continue
      insert(boxes[i])
      const [x, y, anchor] = opts[i]
      out.push({ ...c.label, x, y, anchor })
      continue
    }
    if (c.windows) {
      const win = c.windows.find((w) => !w.boxes.some(collides))
      if (!win) continue
      win.boxes.forEach(insert)
      out.push({ ...c.label, x: win.x, y: win.y, path: win.d })
      continue
    }
    const boxes = Array.isArray(c.box) ? c.box : [c.box]
    if (boxes.some(collides)) continue
    boxes.forEach(insert)
    if (c.label.text) out.push(c.label)
  }
  return out
}
