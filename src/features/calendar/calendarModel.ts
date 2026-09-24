import type { CalendarEvent, Label, Session } from '@/data/types'
import { minutesOfDay, type DayKey } from '@/lib/time'
import { occurrencesBetween } from '@/planner/recurrence'

export interface Occurrence {
  event: CalendarEvent
  date: DayKey
  key: string
}

export function expandEvents(events: CalendarEvent[], start: DayKey, end: DayKey): Occurrence[] {
  const out: Occurrence[] = []
  for (const e of events) {
    if (e.recurrence) {
      for (const d of occurrencesBetween(e.recurrence, e.date, start, end)) out.push({ event: e, date: d, key: `${e.id}@${d}` })
    } else if (e.date >= start && e.date <= end) out.push({ event: e, date: e.date, key: e.id })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.event.start ?? '').localeCompare(b.event.start ?? ''))
}

export const toMinutes = (hhmm: string | null, fallback: number) => {
  if (!hhmm) return fallback
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function eventColor(e: CalendarEvent, labels: Label[]): string {
  if (e.color) return e.color
  const l = e.labelId ? labels.find((x) => x.id === e.labelId) : undefined
  if (l) return l.color
  if (e.kind === 'exam') return 'var(--danger)'
  if (e.kind === 'block') return 'var(--accent)'
  return 'var(--phase-long)'
}

export interface Placed {
  id: string
  start: number
  end: number
  col: number
  cols: number
}

/** Lay out overlapping intervals side by side (classic calendar column packing). */
export function packColumns(items: Array<{ id: string; start: number; end: number }>): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1))
    for (const p of cluster) p.cols = cols
    out.push(...cluster)
    cluster = []
  }
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush()
    const colEnds: number[] = []
    for (const p of cluster) colEnds[p.col] = Math.max(colEnds[p.col] ?? -1, p.end)
    let col = colEnds.findIndex((end) => end <= it.start)
    if (col === -1) col = colEnds.length
    cluster.push({ ...it, end: Math.max(it.end, it.start + 15), col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()
  return out
}

export interface SessionSpan {
  session: Session
  start: number
  end: number
}

/** Session spans clipped to one day, in minutes from midnight. */
export function sessionSpans(sessions: Session[], day: DayKey): SessionSpan[] {
  return sessions
    .filter((s) => s.date === day)
    .map((s) => {
      const start = minutesOfDay(s.startedAt)
      const len = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))
      return { session: s, start, end: Math.min(24 * 60, start + len) }
    })
}

export const REMINDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At start' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]
