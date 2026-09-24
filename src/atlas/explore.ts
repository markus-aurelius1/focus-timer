/**
 * Exploration, derived entirely from history (sessions, expedition runs, recall):
 *
 * - Every focused minute belongs to the expedition that was active when its
 *   session ended, or to the free survey when none was.
 * - An expedition's minutes carry it from stop to stop. At the end of each
 *   chapter a recall gate holds it until 60% of that chapter's places are
 *   Familiar; minutes past the gate are banked, not lost.
 * - Minutes beyond a finished expedition, and minutes with no expedition, go to
 *   the free survey, which uncovers places outward from your base camp.
 *
 * Because nothing is stored but the inputs, the same history always yields the
 * same map – on every device, after an import, or after a session is edited.
 */
import type { ExpeditionRun, Session } from '@/data/types'
import type { AtlasData } from './data'
import type { Expedition, Place } from './types'

export const GATE_SHARE = 0.6
export const SURVEY_MINUTES = 25
const DEFAULT_CAMP = 'delhi'

export type DiscoveryVia = 'expedition' | 'survey'

export interface Discovery {
  at: number
  via: DiscoveryVia
  expeditionId?: string
}

export interface StopState {
  place: Place
  chapter: number
  /** Cumulative minutes needed to reach this stop. */
  threshold: number
  reached: boolean
  at: number | null
}

export interface Gate {
  chapter: number
  title: string
  need: number
  have: number
  places: string[]
  open: boolean
  openAt: number | null
}

export interface ExpeditionProgress {
  expedition: Expedition
  /** Focus minutes allocated to this expedition (including banked minutes). */
  minutes: number
  stops: StopState[]
  gates: Gate[]
  reached: number
  total: number
  /** The next stop and the minutes still needed to reach it. */
  next: { stop: StopState; remaining: number } | null
  /** A closed gate holding the expedition, if any. */
  blockedBy: Gate | null
  /** Minutes waiting behind a closed gate. */
  banked: number
  complete: boolean
  completedAt: number | null
  totalMinutes: number
}

export interface ExploreState {
  discovered: Map<string, Discovery>
  /** States and countries whose fog has lifted. */
  explored: Set<string>
  expeditions: Map<string, ExpeditionProgress>
  active: ExpeditionProgress | null
  activeRun: ExpeditionRun | null
  survey: { minutes: number; found: number; next: Place | null; remaining: number }
  baseCamp: string
}

interface Chunk {
  at: number
  minutes: number
}

export interface ExploreInput {
  atlas: AtlasData
  sessions: Session[]
  runs: ExpeditionRun[]
  baseCamp: string | null
  /** First time each place became Familiar (from mastery). */
  familiarAt: Map<string, number>
}

/** Stops of an expedition with cumulative thresholds. */
function layoutStops(e: Expedition, atlas: AtlasData) {
  const stops: Array<{ place: Place; chapter: number; threshold: number }> = []
  let acc = 0
  e.chapters.forEach((c, ci) => {
    for (const s of c.stops) {
      const place = atlas.byId.get(s.place)
      if (!place) continue
      acc += s.minutes
      stops.push({ place, chapter: ci, threshold: acc })
    }
  })
  return { stops, total: acc }
}

/** The run active at `t` (latest start ≤ t whose end is after t). */
function runAt(runs: ExpeditionRun[], t: number): ExpeditionRun | null {
  let best: ExpeditionRun | null = null
  for (const r of runs) if (r.startedAt <= t && (r.endedAt === null || r.endedAt > t) && (!best || r.startedAt > best.startedAt)) best = r
  return best
}

/** Time at which `threshold` cumulative minutes were reached, given chunks in order. */
function crossing(chunks: Chunk[], threshold: number): number | null {
  let acc = 0
  for (const c of chunks) {
    acc += c.minutes
    if (acc >= threshold - 1e-9) return c.at
  }
  return null
}

export function explore({ atlas, sessions, runs, baseCamp, familiarAt }: ExploreInput): ExploreState {
  const camp = baseCamp && atlas.state(baseCamp) ? baseCamp : DEFAULT_CAMP
  const sortedRuns = [...runs].sort((a, b) => a.startedAt - b.startedAt)
  const sorted = [...sessions].sort((a, b) => a.endedAt - b.endedAt)

  // 1. Allocate minutes to expeditions (in session order), spilling to the survey.
  const byExp = new Map<string, Chunk[]>()
  const surveyChunks: Chunk[] = []
  const layouts = new Map<string, ReturnType<typeof layoutStops>>()
  const layoutOf = (id: string) => {
    if (!layouts.has(id)) {
      const e = atlas.expedition(id)
      layouts.set(id, e ? layoutStops(e, atlas) : { stops: [], total: 0 })
    }
    return layouts.get(id)!
  }
  const allocated = new Map<string, number>()
  for (const s of sorted) {
    const minutes = s.duration / 60
    if (minutes <= 0) continue
    const run = runAt(sortedRuns, s.endedAt)
    const e = run ? atlas.expedition(run.expeditionId) : undefined
    if (!e) {
      surveyChunks.push({ at: s.endedAt, minutes })
      continue
    }
    const cap = layoutOf(e.id).total
    const have = allocated.get(e.id) ?? 0
    const take = Math.max(0, Math.min(minutes, cap - have))
    if (take > 0) {
      allocated.set(e.id, have + take)
      if (!byExp.has(e.id)) byExp.set(e.id, [])
      byExp.get(e.id)!.push({ at: s.endedAt, minutes: take })
    }
    if (minutes - take > 0) surveyChunks.push({ at: s.endedAt, minutes: minutes - take })
  }

  // 2. Walk each expedition's stops, honouring recall gates.
  const discovered = new Map<string, Discovery>()
  const expeditions = new Map<string, ExpeditionProgress>()
  const touched = new Set([...byExp.keys(), ...sortedRuns.map((r) => r.expeditionId)])
  for (const id of touched) {
    const e = atlas.expedition(id)
    if (!e) continue
    const { stops: laid, total } = layoutOf(id)
    const chunks = byExp.get(id) ?? []
    const minutes = allocated.get(id) ?? 0
    const gates: Gate[] = e.chapters.map((c, ci) => {
      const places = laid.filter((s) => s.chapter === ci).map((s) => s.place.id)
      const need = Math.ceil(places.length * GATE_SHARE)
      const times = places.map((p) => familiarAt.get(p)).filter((t): t is number => t !== undefined).sort((a, b) => a - b)
      return { chapter: ci, title: c.title, need, have: times.length, places, open: times.length >= need, openAt: need === 0 ? 0 : (times[need - 1] ?? null) }
    })
    const stops: StopState[] = []
    let blockedBy: Gate | null = null
    let gateTime = 0
    let prev: StopState | null = null
    for (const s of laid) {
      // Arriving at the end of a chapter: the next one needs its gate open.
      if (prev && prev.reached && s.chapter !== prev.chapter && !blockedBy) {
        const g: Gate = gates[prev.chapter]
        if (!g.open) blockedBy = g
        else gateTime = Math.max(gateTime, g.openAt ?? 0)
      }
      const t: number | null = !blockedBy && minutes >= s.threshold - 1e-9 ? crossing(chunks, s.threshold) : null
      const at: number | null = t === null ? null : Math.max(t, gateTime)
      const st: StopState = { ...s, reached: at !== null, at }
      stops.push(st)
      prev = st
      if (at !== null && !discovered.has(s.place.id)) discovered.set(s.place.id, { at, via: 'expedition', expeditionId: id })
    }
    const reached = stops.filter((s) => s.reached).length
    const lastGate = gates[gates.length - 1]
    const allStops = reached === stops.length && stops.length > 0
    // The final chapter's gate completes the expedition.
    if (allStops && lastGate && !lastGate.open && !blockedBy) blockedBy = lastGate
    const complete = allStops && !!lastGate?.open
    const nextStop = stops.find((s) => !s.reached) ?? null
    const lastReachedThreshold = [...stops].reverse().find((s) => s.reached)?.threshold ?? 0
    expeditions.set(id, {
      expedition: e,
      minutes,
      stops,
      gates,
      reached,
      total: stops.length,
      next: nextStop ? { stop: nextStop, remaining: Math.max(0, nextStop.threshold - minutes) } : null,
      blockedBy,
      banked: blockedBy ? Math.max(0, minutes - lastReachedThreshold) : 0,
      complete,
      completedAt: complete ? Math.max(stops[stops.length - 1].at ?? 0, lastGate.openAt ?? 0) : null,
      totalMinutes: total,
    })
  }

  // 3. Free survey: outward from base camp, state by state.
  const order = surveyOrder(atlas, camp)
  const surveyMinutes = surveyChunks.reduce((a, c) => a + c.minutes, 0)
  const found = Math.floor(surveyMinutes / SURVEY_MINUTES + 1e-9)
  let k = 0
  let nextSurvey: Place | null = null
  for (const p of order) {
    if (discovered.has(p.id)) continue
    if (k >= found) {
      nextSurvey = p
      break
    }
    k++
    discovered.set(p.id, { at: crossing(surveyChunks, k * SURVEY_MINUTES) ?? Date.now(), via: 'survey' })
  }

  // 4. Fog: base camp, India on the world sheet, and every unit with a discovery.
  const explored = new Set<string>([camp, 'IND'])
  for (const id of discovered.keys()) {
    const u = atlas.byId.get(id)?.unit
    if (u) explored.add(u)
  }

  const now = Date.now()
  const activeRun = runAt(sortedRuns, now)
  const active = activeRun ? (expeditions.get(activeRun.expeditionId) ?? null) : null
  return {
    discovered,
    explored,
    expeditions,
    active,
    activeRun,
    survey: { minutes: surveyMinutes, found: k, next: nextSurvey, remaining: nextSurvey ? (k + 1) * SURVEY_MINUTES - surveyMinutes : 0 },
    baseCamp: camp,
  }
}

/** India places ordered by distance (in state hops) from base camp, core places first. */
export function surveyOrder(atlas: AtlasData, camp: string): Place[] {
  const seen = new Set([camp])
  const rings: string[][] = [[camp]]
  while (true) {
    const next: string[] = []
    for (const s of rings[rings.length - 1])
      for (const n of atlas.state(s)?.neighbours ?? [])
        if (!seen.has(n)) {
          seen.add(n)
          next.push(n)
        }
    if (!next.length) break
    rings.push(next.sort())
  }
  // Island UTs have no land neighbours – survey them last.
  const rest = atlas.states.map((s) => s.id).filter((s) => !seen.has(s)).sort()
  if (rest.length) rings.push(rest)
  const out: Place[] = []
  for (const ring of rings) {
    const places = ring.flatMap((s) => atlas.inUnit.get(s) ?? []).filter((p) => p.sheet === 'india')
    places.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    out.push(...places)
  }
  return out
}

/** Places discovered within [from, to). */
export function discoveredBetween(state: ExploreState, from: number, to: number): string[] {
  const out: Array<[string, number]> = []
  for (const [id, d] of state.discovered) if (d.at >= from && d.at < to) out.push([id, d.at])
  return out.sort((a, b) => a[1] - b[1]).map(([id]) => id)
}

/** Focus minutes of `sessions` that went to an expedition. */
export function expeditionMinutesIn(sessions: Session[], runs: ExpeditionRun[]): number {
  let m = 0
  for (const s of sessions) if (runAt(runs, s.endedAt)) m += s.duration / 60
  return m
}

/**
 * The expedition to replay an existing user's history through: the one with the
 * most stops in their base camp, falling back to the Himalayan Expedition.
 */
export function suggestExpedition(atlas: AtlasData, camp: string | null): Expedition {
  let best = atlas.expedition('himalayan') ?? atlas.expeditions[0]
  let bestScore = 0
  for (const e of atlas.expeditions) {
    if (e.sheet !== 'india') continue
    const score = e.chapters.flatMap((c) => c.stops).filter((s) => atlas.byId.get(s.place)?.unit === camp).length
    if (score > bestScore) {
      best = e
      bestScore = score
    }
  }
  return best
}
