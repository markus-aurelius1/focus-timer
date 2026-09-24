/**
 * Turns a week of sessions into a constellation. Positions are meaningful, not
 * random: x follows the day of the week, y follows the time of day (morning
 * sessions sit high in the sky), and brightness follows duration. A seeded
 * jitter keeps it organic yet stable. Stars are joined by a minimum spanning
 * tree, which is what makes a scatter read as a constellation.
 */
import type { Label, Session } from '@/data/types'
import { diffDays, type DayKey } from '@/lib/time'
import { hashString, pick, seededRandom } from '@/lib/random'

export interface Star {
  id: string
  x: number
  y: number
  r: number
  color: string
  session: Session
}

export interface Constellation {
  week: DayKey
  stars: Star[]
  edges: Array<[number, number]>
  name: string
}

export const SKY_W = 1000
export const SKY_H = 560

function mixWithWhite(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return '#ffffff'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const m = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

export function starRadius(seconds: number): number {
  const minutes = seconds / 60
  return 1.6 + Math.min(4.6, Math.sqrt(minutes / 8))
}

export function layoutWeek(week: DayKey, sessions: Session[], labels: Label[], w = SKY_W, h = SKY_H): Constellation {
  const colorOf = new Map(labels.map((l) => [l.id, l.color]))
  const marginX = w * 0.06
  const marginY = h * 0.1
  const stars: Star[] = sessions
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const rand = seededRandom(s.id)
      const dayIndex = Math.min(6, Math.max(0, diffDays(week, s.date)))
      const d = new Date(s.startedAt)
      // Map 5:00 → top, 24:00 → bottom; late-night sessions wrap to the bottom edge.
      const hour = (d.getHours() + d.getMinutes() / 60 - 5 + 24) % 24
      const x = marginX + ((dayIndex + 0.18 + rand() * 0.64) / 7) * (w - 2 * marginX)
      const y = marginY + Math.min(1, hour / 19 + (rand() - 0.5) * 0.12) * (h - 2 * marginY)
      const base = s.labelId ? colorOf.get(s.labelId) : undefined
      return {
        id: s.id,
        x,
        y: Math.max(marginY * 0.6, Math.min(h - marginY * 0.6, y)),
        r: starRadius(s.duration) * (s.completed ? 1 : 0.7),
        color: base ? mixWithWhite(base, 0.55) : '#fff6e0',
        session: s,
      }
    })

  relax(stars, 26, w, h)
  return { week, stars, edges: minimumSpanningTree(stars), name: constellationName(week) }
}

/** Nudge overlapping stars apart (deterministic, a few iterations). */
function relax(stars: Star[], minDist: number, w: number, h: number) {
  for (let iter = 0; iter < 12; iter++) {
    let moved = false
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i]
        const b = stars[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        if (d < minDist) {
          const push = (minDist - d) / 2
          const ux = dx / d
          const uy = dy / d
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
          moved = true
        }
      }
    }
    for (const s of stars) {
      s.x = Math.max(12, Math.min(w - 12, s.x))
      s.y = Math.max(12, Math.min(h - 12, s.y))
    }
    if (!moved) break
  }
}

/** Prim's algorithm – O(n²), fine for a week of stars. */
export function minimumSpanningTree(points: Array<{ x: number; y: number }>): Array<[number, number]> {
  const n = points.length
  if (n < 2) return []
  const inTree = new Array<boolean>(n).fill(false)
  const best = new Array<number>(n).fill(Infinity)
  const parent = new Array<number>(n).fill(-1)
  best[0] = 0
  const edges: Array<[number, number]> = []
  for (let k = 0; k < n; k++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i
    inTree[u] = true
    if (parent[u] >= 0) edges.push([parent[u], u])
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue
      const d = Math.hypot(points[u].x - points[v].x, points[u].y - points[v].y)
      if (d < best[v]) {
        best[v] = d
        parent[v] = u
      }
    }
  }
  return edges
}

const ADJECTIVES = [
  'Quiet', 'Patient', 'Wandering', 'Silver', 'Northern', 'Gentle', 'Steadfast', 'Luminous', 'Hidden', 'Drifting',
  'Ember', 'Winter', 'Morning', 'Velvet', 'Distant', 'Faithful', 'Lantern', 'Midnight', 'Amber', 'Still',
]
const NOUNS = [
  'Heron', 'Owl', 'Lantern', 'Compass', 'Quill', 'Scholar', 'Fox', 'Whale', 'Crane', 'Kite', 'Harp', 'Anchor',
  'Lighthouse', 'Stag', 'Moth', 'Sparrow', 'Key', 'Hourglass', 'Telescope', 'Violin', 'Orchard', 'Bridge', 'Lynx', 'Sextant',
]

/** Every week earns a stable, unique-feeling name. */
export function constellationName(week: DayKey): string {
  const rand = seededRandom(hashString(`constellation:${week}`))
  return `The ${pick(rand, ADJECTIVES)} ${pick(rand, NOUNS)}`
}

/** Background "dust" – faint stars that make the sky feel deep. Stable per seed. */
export function backgroundStars(seed: string, count: number, w = SKY_W, h = SKY_H) {
  const rand = seededRandom(seed)
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand() * w,
    y: rand() * h,
    r: 0.3 + rand() * 0.9,
    o: 0.15 + rand() * 0.45,
    twinkle: rand() < 0.12,
    delay: rand() * 6,
  }))
}
