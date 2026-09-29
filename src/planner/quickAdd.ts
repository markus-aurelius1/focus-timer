/**
 * Natural-language quick add:
 *   "Physics revision tomorrow 5pm !high @Physics #exam ~2 every week"
 *
 *   !1 !2 !3 / !low !med !high   → priority
 *   @subject                     → subject (label), created if new
 *   #tag                         → tag (a project of exactly that name files it there instead)
 *   +project                     → project, created if new
 *   ~3 / 3p / 3 pomos            → estimated sessions
 *   ~45m / ~1h / ~1h30m / ~1.5h  → estimated time (turned into sessions of the current length)
 *   today, tomorrow, mon…sun, next week, in 3 days, sep 30, 30/9 → planned day
 *   due <date>                   → deadline
 *   at 5pm / 17:30               → due time
 *   daily, weekly, every mon, every 2 weeks, monthly…              → repeat
 */
import type { Label, Priority, RecurrenceRule } from '@/data/types'
import { addDaysKey, dayKey, parseDayKey, startOfWeekKey, weekdayOf, type DayKey } from '@/lib/time'

export interface QuickAddResult {
  title: string
  priority?: Priority
  projectName?: string
  labelName?: string
  /** Tags as typed (without '#'); normalised when the task is saved. */
  tags: string[]
  /** Estimated sessions. */
  estimate?: number
  /** Estimated time in minutes, when it was given as a duration. */
  estimateMinutes?: number
  plannedFor?: DayKey
  dueDate?: DayKey
  dueTime?: string
  recurrence?: RecurrenceRule
  /** Recognised fragments, for showing chips while typing. */
  tokens: Array<{ kind: 'priority' | 'project' | 'label' | 'tag' | 'estimate' | 'date' | 'due' | 'time' | 'repeat'; text: string }>
}

export interface QuickAddOptions {
  /** Length of one focus session in minutes, to turn "~1h" into sessions (default 25). */
  sessionMinutes?: number
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

const WD = Object.keys(WEEKDAYS).join('|')
const MO = Object.keys(MONTHS).join('|')

function nextWeekday(today: DayKey, wd: number, forceNextWeek = false): DayKey {
  let delta = (wd - weekdayOf(today) + 7) % 7
  if (delta === 0) delta = 7
  if (forceNextWeek && delta < 7) {
    // "next friday" said on a Monday means the Friday of next week.
    const thisWeekStart = startOfWeekKey(today, 1)
    const candidate = addDaysKey(today, delta)
    if (startOfWeekKey(candidate, 1) === thisWeekStart) delta += 7
  }
  return addDaysKey(today, delta)
}

function monthDay(today: DayKey, month: number, day: number): DayKey | null {
  const t = parseDayKey(today)
  let d = new Date(t.getFullYear(), month, day)
  if (d.getMonth() !== month) return null
  if (dayKey(d) < today) d = new Date(t.getFullYear() + 1, month, day)
  return dayKey(d)
}

/** Parse a date phrase at the start of `s`. Returns the date and the matched length. */
function parseDateAt(s: string, today: DayKey): { date: DayKey; length: number } | null {
  const tests: Array<[RegExp, (m: RegExpMatchArray) => DayKey | null]> = [
    [/^(today|tod|tonight)\b/i, () => today],
    [/^(tomorrow|tmrw|tmr|tom)\b/i, () => addDaysKey(today, 1)],
    [/^(next week)\b/i, () => addDaysKey(startOfWeekKey(today, 1), 7)],
    [/^in (\d{1,3}) (day|days|week|weeks)\b/i, (m) => addDaysKey(today, Number(m[1]) * (m[2].startsWith('week') ? 7 : 1))],
    [new RegExp(`^next (${WD})\\b`, 'i'), (m) => nextWeekday(today, WEEKDAYS[m[1].toLowerCase()], true)],
    [new RegExp(`^(?:on )?(${WD})\\b`, 'i'), (m) => nextWeekday(today, WEEKDAYS[m[1].toLowerCase()])],
    [new RegExp(`^(${MO}) (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'), (m) => monthDay(today, MONTHS[m[1].toLowerCase()], Number(m[2]))],
    [new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)? (${MO})\\b`, 'i'), (m) => monthDay(today, MONTHS[m[2].toLowerCase()], Number(m[1]))],
    [/^(\d{4})-(\d{2})-(\d{2})\b/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
    // d/m – the most common order worldwide; ambiguous inputs like 3/4 read as 3 April.
    [/^(\d{1,2})\/(\d{1,2})\b/, (m) => monthDay(today, Number(m[2]) - 1, Number(m[1]))],
  ]
  for (const [re, fn] of tests) {
    const m = s.match(re)
    if (m) {
      const date = fn(m)
      if (date) return { date, length: m[0].length }
    }
  }
  return null
}

function parseRepeatAt(s: string, today: DayKey): { rule: RecurrenceRule; length: number } | null {
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(daily|every day|everyday)\b/i))) return { rule: { freq: 'daily', interval: 1 }, length: m[0].length }
  if ((m = s.match(/^(every weekday|weekdays)\b/i)))
    return { rule: { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, length: m[0].length }
  if ((m = s.match(/^(weekly|every week)\b/i)))
    return { rule: { freq: 'weekly', interval: 1, weekdays: [weekdayOf(today)] }, length: m[0].length }
  if ((m = s.match(/^(monthly|every month)\b/i))) return { rule: { freq: 'monthly', interval: 1 }, length: m[0].length }
  if ((m = s.match(/^(yearly|annually|every year)\b/i))) return { rule: { freq: 'yearly', interval: 1 }, length: m[0].length }
  if ((m = s.match(/^every (\d{1,2}) (day|days|week|weeks|month|months)\b/i))) {
    const unit = m[2].toLowerCase()
    const freq = unit.startsWith('day') ? 'daily' : unit.startsWith('week') ? 'weekly' : 'monthly'
    return { rule: { freq, interval: Number(m[1]) }, length: m[0].length }
  }
  const wdList = new RegExp(`^every ((?:${WD})(?:\\s*(?:,|and|&)\\s*(?:${WD}))*)\\b`, 'i')
  if ((m = s.match(wdList))) {
    const days = m[1]
      .toLowerCase()
      .split(/\s*(?:,|and|&)\s*/)
      .map((d) => WEEKDAYS[d.trim()])
      .filter((d) => d !== undefined)
    return { rule: { freq: 'weekly', interval: 1, weekdays: [...new Set(days)].sort() }, length: m[0].length }
  }
  return null
}

function parseTimeAt(s: string): { time: string; length: number } | null {
  const m = s.match(/^(?:at |@)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i) ?? s.match(/^(?:at )?(\d{1,2}):(\d{2})\b/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const suffix = m[3]?.toLowerCase()
  if (suffix === 'pm' && h < 12) h += 12
  if (suffix === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, length: m[0].length }
}

const PRIORITY_WORDS: Record<string, Priority> = { '1': 3, '2': 2, '3': 1, high: 3, hi: 3, med: 2, medium: 2, low: 1, '!!': 3, '!': 2 }

/** "45m", "1h", "1h30m", "1.5h", "90min" → minutes (null if not a duration). */
function parseMinutes(s: string): number | null {
  const m = s.match(/^(?:(\d{1,2}(?:\.\d)?)\s?h(?:rs?|ours?)?)?\s?(?:(\d{1,3})\s?m(?:ins?|inutes?)?)?$/i)
  if (!m || (!m[1] && !m[2])) return null
  const total = Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0))
  return total > 0 && total <= 24 * 60 ? total : null
}

export function parseQuickAdd(input: string, today: DayKey, opts: QuickAddOptions = {}): QuickAddResult {
  const sessionMinutes = Math.max(1, opts.sessionMinutes ?? 25)
  const result: QuickAddResult = { title: '', tags: [], tokens: [] }
  const kept: string[] = []
  let i = 0
  const s = input
  const atWordStart = () => i === 0 || /\s/.test(s[i - 1])

  while (i < s.length) {
    const rest = s.slice(i)
    if (/^\s/.test(rest)) {
      kept.push(s[i])
      i += 1
      continue
    }
    if (atWordStart()) {
      let m: RegExpMatchArray | null
      if ((m = rest.match(/^!(1|2|3|high|hi|medium|med|low|!!|!)(?=\s|$)/i))) {
        result.priority = PRIORITY_WORDS[m[1].toLowerCase()]
        result.tokens.push({ kind: 'priority', text: m[0] })
        i += m[0].length
        continue
      }
      if ((m = rest.match(/^#([\p{L}\p{N}_-]+)/u))) {
        if (!result.tags.some((t) => t.toLowerCase() === m![1].toLowerCase())) result.tags.push(m[1])
        result.tokens.push({ kind: 'tag', text: m[0] })
        i += m[0].length
        continue
      }
      if ((m = rest.match(/^\+(\p{L}[\p{L}\p{N}_-]*)/u))) {
        result.projectName = m[1].replace(/[_-]/g, ' ')
        result.tokens.push({ kind: 'project', text: m[0] })
        i += m[0].length
        continue
      }
      if ((m = rest.match(/^@([\p{L}\p{N}_-]+)/u)) && !/^@\d/.test(rest)) {
        result.labelName = m[1].replace(/[_-]/g, ' ')
        result.tokens.push({ kind: 'label', text: m[0] })
        i += m[0].length
        continue
      }
      if ((m = rest.match(/^~(\S+)(?=\s|$)/))) {
        const minutes = /^\d{1,2}$/.test(m[1]) ? null : parseMinutes(m[1])
        if (/^\d{1,2}$/.test(m[1]) || minutes !== null) {
          if (minutes !== null) {
            result.estimateMinutes = minutes
            result.estimate = Math.max(1, Math.round(minutes / sessionMinutes))
          } else result.estimate = Number(m[1])
          result.tokens.push({ kind: 'estimate', text: m[0] })
          i += m[0].length
          continue
        }
      }
      if ((m = rest.match(/^(?:(\d{1,2})p|(\d{1,2})\s?pomos?)(?=\s|$)/i))) {
        result.estimate = Number(m[1] ?? m[2])
        result.tokens.push({ kind: 'estimate', text: m[0] })
        i += m[0].length
        continue
      }
      const repeat = parseRepeatAt(rest, today)
      if (repeat) {
        result.recurrence = repeat.rule
        result.tokens.push({ kind: 'repeat', text: rest.slice(0, repeat.length) })
        i += repeat.length
        continue
      }
      const dueMatch = rest.match(/^(?:due|by|before)\s+/i)
      if (dueMatch) {
        const d = parseDateAt(rest.slice(dueMatch[0].length), today)
        if (d) {
          result.dueDate = d.date
          const len = dueMatch[0].length + d.length
          result.tokens.push({ kind: 'due', text: rest.slice(0, len) })
          i += len
          continue
        }
      }
      const time = parseTimeAt(rest)
      if (time) {
        result.dueTime = time.time
        result.tokens.push({ kind: 'time', text: rest.slice(0, time.length) })
        i += time.length
        continue
      }
      // Only treat bare dates as dates when they aren't the very first word ("Monday reading" stays a title).
      if (kept.join('').trim().length > 0) {
        const d = parseDateAt(rest, today)
        if (d && !result.plannedFor) {
          result.plannedFor = d.date
          result.tokens.push({ kind: 'date', text: rest.slice(0, d.length) })
          i += d.length
          continue
        }
      }
    }
    // Plain character – copy through to the end of the word.
    const word = rest.match(/^\S+/)![0]
    kept.push(word)
    i += word.length
  }

  result.title = kept.join('').replace(/\s+/g, ' ').trim()
  // A time without a date refers to today.
  if (result.dueTime && !result.dueDate) result.dueDate = result.plannedFor ?? today
  // Recurring tasks need an anchor day.
  if (result.recurrence && !result.plannedFor && !result.dueDate) {
    const r = result.recurrence
    result.plannedFor =
      r.freq === 'weekly' && r.weekdays?.length && !r.weekdays.includes(weekdayOf(today))
        ? r.weekdays.map((wd) => nextWeekday(today, wd)).sort()[0]
        : today
  }
  return result
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/**
 * The subject a title names, if exactly one does: "Physics revision" → Physics.
 * Whole words only; the longest name wins when one contains another
 * ("Organic Chemistry" over "Chemistry"); two unrelated matches → none.
 */
export function inferSubject<L extends Pick<Label, 'id' | 'name' | 'archived'>>(title: string, labels: L[]): L | undefined {
  const t = words(title)
  if (!t.length) return undefined
  const text = ` ${t.join(' ')} `
  const hits = labels
    .filter((l) => !l.archived && l.name.trim().length >= 3)
    .map((l) => ({ l, w: words(l.name) }))
    .filter(({ w }) => w.length && text.includes(` ${w.join(' ')} `))
    .sort((a, b) => b.w.join(' ').length - a.w.join(' ').length)
  if (!hits.length) return undefined
  const best = hits[0]
  const bestText = ` ${best.w.join(' ')} `
  // Every other hit must be part of the best one (e.g. "Chemistry" inside "Organic Chemistry").
  if (hits.slice(1).some((h) => !bestText.includes(` ${h.w.join(' ')} `))) return undefined
  return best.l
}
