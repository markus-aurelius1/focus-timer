import type { RecurrenceRule } from '@/data/types'
import {
  addDaysKey,
  diffDays,
  parseDayKey,
  startOfWeekKey,
  weekdayOf,
  weekdayShort,
  type DayKey,
} from '@/lib/time'

const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** Does a rule anchored at `anchor` produce an occurrence on `day`? */
export function occursOn(rule: RecurrenceRule, anchor: DayKey, day: DayKey): boolean {
  if (day < anchor) return false
  if (rule.until && day > rule.until) return false
  const interval = Math.max(1, Math.round(rule.interval || 1))
  switch (rule.freq) {
    case 'daily':
      return diffDays(anchor, day) % interval === 0
    case 'weekly': {
      const days = rule.weekdays?.length ? rule.weekdays : [weekdayOf(anchor)]
      if (!days.includes(weekdayOf(day))) return false
      const weeks = Math.round(diffDays(startOfWeekKey(anchor, 1), startOfWeekKey(day, 1)) / 7)
      return weeks % interval === 0
    }
    case 'monthly': {
      const a = parseDayKey(anchor)
      const d = parseDayKey(day)
      const months = (d.getFullYear() - a.getFullYear()) * 12 + (d.getMonth() - a.getMonth())
      if (months % interval !== 0) return false
      // The 31st recurs on the last day of shorter months.
      const target = Math.min(a.getDate(), lastDayOfMonth(d.getFullYear(), d.getMonth()))
      return d.getDate() === target
    }
    case 'yearly': {
      const a = parseDayKey(anchor)
      const d = parseDayKey(day)
      const years = d.getFullYear() - a.getFullYear()
      if (years % interval !== 0 || d.getMonth() !== a.getMonth()) return false
      return d.getDate() === Math.min(a.getDate(), lastDayOfMonth(d.getFullYear(), d.getMonth()))
    }
  }
}

/** First occurrence strictly after `after`, or null when the rule has ended. */
export function nextOccurrence(rule: RecurrenceRule, anchor: DayKey, after: DayKey): DayKey | null {
  let day = addDaysKey(after < anchor ? addDaysKey(anchor, -1) : after, 1)
  // Four years covers every rule including "every 2 years on Feb 29".
  for (let i = 0; i < 1500; i++) {
    if (rule.until && day > rule.until) return null
    if (occursOn(rule, anchor, day)) return day
    day = addDaysKey(day, 1)
  }
  return null
}

export function occurrencesBetween(rule: RecurrenceRule, anchor: DayKey, start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = []
  let day = start < anchor ? anchor : start
  while (day <= end) {
    if (rule.until && day > rule.until) break
    if (occursOn(rule, anchor, day)) out.push(day)
    day = addDaysKey(day, 1)
  }
  return out
}

const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function describeRule(rule: RecurrenceRule, anchor?: DayKey | null): string {
  const n = Math.max(1, rule.interval || 1)
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`)
  let text: string
  switch (rule.freq) {
    case 'daily':
      text = every('day')
      break
    case 'weekly': {
      const days = rule.weekdays?.length ? [...rule.weekdays].sort() : anchor ? [weekdayOf(anchor)] : []
      if (n === 1 && days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) text = 'Every weekday'
      else if (n === 1 && days.length === 7) text = 'Every day'
      else text = `${every('week')}${days.length ? ` on ${days.map(weekdayShort).join(', ')}` : ''}`
      break
    }
    case 'monthly':
      text = `${every('month')}${anchor ? ` on the ${ORDINAL(parseDayKey(anchor).getDate())}` : ''}`
      break
    case 'yearly':
      text = every('year')
      break
  }
  return rule.until ? `${text}, until ${rule.until}` : text
}

export const RECURRENCE_PRESETS: Array<{ id: string; label: string; rule: RecurrenceRule | null }> = [
  { id: 'none', label: 'Does not repeat', rule: null },
  { id: 'daily', label: 'Every day', rule: { freq: 'daily', interval: 1 } },
  { id: 'weekdays', label: 'Every weekday', rule: { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] } },
  { id: 'weekly', label: 'Every week', rule: { freq: 'weekly', interval: 1 } },
  { id: 'biweekly', label: 'Every 2 weeks', rule: { freq: 'weekly', interval: 2 } },
  { id: 'monthly', label: 'Every month', rule: { freq: 'monthly', interval: 1 } },
  { id: 'yearly', label: 'Every year', rule: { freq: 'yearly', interval: 1 } },
]
