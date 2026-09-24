/**
 * Analytics are *derived*: every number here is computed from Session records
 * (and tasks/goals), never from counters that could drift out of sync.
 */
import type { Goal, GoalPeriod, Label, Session, Task } from '@/data/types'
import {
  addDaysKey,
  addMonthsKey,
  dayKey,
  daysInRange,
  diffDays,
  endOfMonthKey,
  HOUR,
  startOfMonthKey,
  startOfWeekKey,
  startOfYearKey,
  type DayKey,
  type WeekStart,
} from '@/lib/time'

export interface Range {
  start: DayKey
  /** Inclusive. */
  end: DayKey
}

export type RangeKind = 'day' | 'week' | 'month' | 'year'

export function periodRange(kind: RangeKind, anchor: DayKey, weekStartsOn: WeekStart): Range {
  switch (kind) {
    case 'day':
      return { start: anchor, end: anchor }
    case 'week': {
      const start = startOfWeekKey(anchor, weekStartsOn)
      return { start, end: addDaysKey(start, 6) }
    }
    case 'month':
      return { start: startOfMonthKey(anchor), end: endOfMonthKey(anchor) }
    case 'year':
      return { start: startOfYearKey(anchor), end: `${anchor.slice(0, 4)}-12-31` }
  }
}

export function shiftRange(kind: RangeKind, anchor: DayKey, step: number): DayKey {
  switch (kind) {
    case 'day':
      return addDaysKey(anchor, step)
    case 'week':
      return addDaysKey(anchor, step * 7)
    case 'month':
      return addMonthsKey(anchor, step)
    case 'year':
      return addMonthsKey(anchor, step * 12)
  }
}

/** The equivalent previous range, for "vs last week" comparisons. */
export function previousRange(kind: RangeKind, anchor: DayKey, weekStartsOn: WeekStart): Range {
  return periodRange(kind, shiftRange(kind, anchor, -1), weekStartsOn)
}

export const inRange = (s: { date: DayKey }, r: Range) => s.date >= r.start && s.date <= r.end
export const filterRange = <T extends { date: DayKey }>(items: T[], r: Range) => items.filter((s) => inRange(s, r))

export function sumSeconds(sessions: Session[]): number {
  let t = 0
  for (const s of sessions) t += s.duration
  return t
}

export interface Summary {
  totalSeconds: number
  count: number
  avgSeconds: number
  longestSeconds: number
  completed: number
  completionRate: number
  studyDays: number
  avgRating: number | null
}

export function summarize(sessions: Session[]): Summary {
  const days = new Set<DayKey>()
  let total = 0
  let longest = 0
  let completed = 0
  let ratingSum = 0
  let ratingCount = 0
  for (const s of sessions) {
    total += s.duration
    if (s.duration > longest) longest = s.duration
    if (s.completed) completed++
    if (s.rating) {
      ratingSum += s.rating
      ratingCount++
    }
    days.add(s.date)
  }
  return {
    totalSeconds: total,
    count: sessions.length,
    avgSeconds: sessions.length ? total / sessions.length : 0,
    longestSeconds: longest,
    completed,
    completionRate: sessions.length ? completed / sessions.length : 0,
    studyDays: days.size,
    avgRating: ratingCount ? ratingSum / ratingCount : null,
  }
}

export function secondsByDay(sessions: Session[]): Map<DayKey, number> {
  const map = new Map<DayKey, number>()
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.duration)
  return map
}

/** Series of per-day totals across a range (zero-filled). */
export function dailySeries(sessions: Session[], r: Range): Array<{ day: DayKey; seconds: number }> {
  const map = secondsByDay(sessions)
  return daysInRange(r.start, r.end).map((day) => ({ day, seconds: map.get(day) ?? 0 }))
}

/** Per-month totals of a year. */
export function monthlySeries(sessions: Session[], year: string): Array<{ month: number; seconds: number }> {
  const out = Array.from({ length: 12 }, (_, month) => ({ month, seconds: 0 }))
  for (const s of sessions) if (s.date.startsWith(year)) out[Number(s.date.slice(5, 7)) - 1].seconds += s.duration
  return out
}

/**
 * Focus by hour of day. A session's focused seconds are spread across the
 * wall-clock hours it spanned, so a 9:40–10:30 session counts in both 9h and 10h.
 */
export function secondsByHour(sessions: Session[]): number[] {
  const hours = new Array<number>(24).fill(0)
  for (const s of sessions) {
    const span = Math.max(1, s.endedAt - s.startedAt)
    const scale = (s.duration * 1000) / span
    let t = s.startedAt
    while (t < s.endedAt) {
      const d = new Date(t)
      const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
      const segEnd = Math.min(nextHour, s.endedAt)
      hours[d.getHours()] += ((segEnd - t) * scale) / 1000
      t = segEnd
    }
  }
  return hours
}

/** Focus by weekday, index 0 = Sunday. `average` divides by the number of such weekdays in the range. */
export function secondsByWeekday(sessions: Session[], r?: Range, average = false): number[] {
  const out = new Array<number>(7).fill(0)
  for (const s of sessions) out[new Date(s.startedAt).getDay()] += s.duration
  if (average && r) {
    const counts = new Array<number>(7).fill(0)
    for (const d of daysInRange(r.start, r.end)) counts[new Date(d + 'T12:00').getDay()]++
    return out.map((v, i) => (counts[i] ? v / counts[i] : 0))
  }
  return out
}

export interface Breakdown {
  id: string | null
  seconds: number
  sessions: number
}

export function breakdown(sessions: Session[], key: (s: Session) => string | null): Breakdown[] {
  const map = new Map<string | null, Breakdown>()
  for (const s of sessions) {
    const id = key(s)
    const b = map.get(id) ?? { id, seconds: 0, sessions: 0 }
    b.seconds += s.duration
    b.sessions += 1
    map.set(id, b)
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds)
}

/** Map every label to its top-level ancestor (Exam → Subject → Topic rolls up to Exam). */
export function rootOf(labels: Label[]): (id: string | null) => string | null {
  const byId = new Map(labels.map((l) => [l.id, l]))
  return (id) => {
    let cur = id ? byId.get(id) : undefined
    const seen = new Set<string>()
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.parentId)
    }
    return cur?.id ?? id
  }
}

/** A label plus all of its descendants. */
export function labelScope(labels: Label[], labelId: string): Set<string> {
  const scope = new Set([labelId])
  let grew = true
  while (grew) {
    grew = false
    for (const l of labels) {
      if (l.parentId && scope.has(l.parentId) && !scope.has(l.id)) {
        scope.add(l.id)
        grew = true
      }
    }
  }
  return scope
}

// ───────────────────────── streaks ─────────────────────────

export interface Streaks {
  current: number
  longest: number
  /** Whether today already counts toward the current streak. */
  todayDone: boolean
}

/** Consecutive-day streaks. A streak stays alive until the end of the day after the last study day. */
export function computeStreaks(days: Iterable<DayKey>, today: DayKey): Streaks {
  const sorted = [...new Set(days)].sort()
  let longest = 0
  let run = 0
  let prev: DayKey | null = null
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }
  const set = new Set(sorted)
  const todayDone = set.has(today)
  let current = 0
  let cursor = todayDone ? today : addDaysKey(today, -1)
  while (set.has(cursor)) {
    current++
    cursor = addDaysKey(cursor, -1)
  }
  return { current, longest, todayDone }
}

/** Days on which at least `minSeconds` of focus happened. */
export function studyDays(sessions: Session[], minSeconds = 60): Set<DayKey> {
  const map = secondsByDay(sessions)
  return new Set([...map.entries()].filter(([, v]) => v >= minSeconds).map(([d]) => d))
}

// ───────────────────────── trends ─────────────────────────

export function weeklyTrend(sessions: Session[], weeks: number, today: DayKey, weekStartsOn: WeekStart) {
  const thisWeek = startOfWeekKey(today, weekStartsOn)
  const starts = Array.from({ length: weeks }, (_, i) => addDaysKey(thisWeek, -7 * (weeks - 1 - i)))
  const map = new Map(starts.map((w) => [w, 0]))
  for (const s of sessions) {
    const w = startOfWeekKey(s.date, weekStartsOn)
    if (map.has(w)) map.set(w, map.get(w)! + s.duration)
  }
  return starts.map((week) => ({ week, seconds: map.get(week)! }))
}

// ───────────────────────── goals ─────────────────────────

const PERIOD_KIND: Record<GoalPeriod, RangeKind> = { day: 'day', week: 'week', month: 'month' }

export interface GoalProgress {
  goal: Goal
  range: Range
  seconds: number
  targetSeconds: number
  ratio: number
  met: boolean
}

export function goalProgress(goal: Goal, sessions: Session[], labels: Label[], today: DayKey, weekStartsOn: WeekStart): GoalProgress {
  const range = periodRange(PERIOD_KIND[goal.period], today, weekStartsOn)
  const scope = goal.labelId ? labelScope(labels, goal.labelId) : null
  let seconds = 0
  for (const s of sessions) {
    if (!inRange(s, range)) continue
    if (scope && !(s.labelId && scope.has(s.labelId))) continue
    if (goal.projectId && s.projectId !== goal.projectId) continue
    seconds += s.duration
  }
  const targetSeconds = goal.targetMinutes * 60
  return { goal, range, seconds, targetSeconds, ratio: targetSeconds ? seconds / targetSeconds : 0, met: seconds >= targetSeconds }
}

/** Days in a range on which a daily target was met – the "goal streak". */
export function goalDays(sessions: Session[], targetMinutes: number): Set<DayKey> {
  return studyDays(sessions, targetMinutes * 60)
}

// ───────────────────────── planned vs actual ─────────────────────────

export interface TaskEstimate {
  task: Task
  estimated: number
  actualSessions: number
  actualSeconds: number
}

/**
 * Estimated sessions vs sessions actually spent (over the task's whole life),
 * for tasks worked on or completed within the range.
 */
export function estimateAccuracy(tasks: Task[], sessions: Session[], r: Range): TaskEstimate[] {
  const workedInRange = new Set(sessions.filter((s) => s.taskId && inRange(s, r)).map((s) => s.taskId!))
  const byTask = new Map<string, { n: number; secs: number }>()
  for (const s of sessions) {
    if (!s.taskId) continue
    const cur = byTask.get(s.taskId) ?? { n: 0, secs: 0 }
    cur.n += 1
    cur.secs += s.duration
    byTask.set(s.taskId, cur)
  }
  const out: TaskEstimate[] = []
  for (const t of tasks) {
    const completedInRange = t.completedAt && inRange({ date: dayKey(t.completedAt) }, r)
    const worked = byTask.get(t.id)
    if (!completedInRange && !workedInRange.has(t.id)) continue
    if (t.estimatedPomodoros <= 0 && !worked) continue
    out.push({ task: t, estimated: t.estimatedPomodoros, actualSessions: worked?.n ?? 0, actualSeconds: worked?.secs ?? 0 })
  }
  return out.sort((a, b) => b.actualSeconds - a.actualSeconds)
}

export function taskCompletion(tasks: Task[], r: Range): { planned: number; completed: number } {
  let planned = 0
  let completed = 0
  for (const t of tasks) {
    const day = t.plannedFor ?? t.dueDate
    const plannedInRange = !!day && day >= r.start && day <= r.end
    const doneInRange = !!t.completedAt && inRange({ date: dayKey(t.completedAt) }, r)
    if (plannedInRange || doneInRange) planned++
    if (doneInRange) completed++
  }
  return { planned, completed }
}

export const hoursOf = (seconds: number) => seconds / (HOUR / 1000)
