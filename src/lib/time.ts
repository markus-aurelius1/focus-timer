/**
 * Date helpers built around local calendar "day keys" (YYYY-MM-DD).
 * Day keys are timezone-free strings, which makes them ideal index values
 * for IndexedDB and stable across exports/imports.
 */

export type DayKey = string // YYYY-MM-DD
export type WeekStart = 0 | 1 // 0 = Sunday, 1 = Monday

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(input: Date | number = Date.now()): DayKey {
  const d = typeof input === 'number' ? new Date(input) : input
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function todayKey(): DayKey {
  return dayKey(new Date())
}

export function addDaysKey(key: DayKey, days: number): DayKey {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

export function addMonthsKey(key: DayKey, months: number): DayKey {
  const d = parseDayKey(key)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return dayKey(d)
}

/** Whole days between two keys (b - a). DST-safe because it rounds. */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / DAY)
}

export function weekdayOf(key: DayKey): number {
  return parseDayKey(key).getDay()
}

export function startOfWeekKey(key: DayKey, weekStartsOn: WeekStart): DayKey {
  const wd = weekdayOf(key)
  const offset = (wd - weekStartsOn + 7) % 7
  return addDaysKey(key, -offset)
}

export function startOfMonthKey(key: DayKey): DayKey {
  return key.slice(0, 8) + '01'
}

export function endOfMonthKey(key: DayKey): DayKey {
  const d = parseDayKey(key)
  return dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function startOfYearKey(key: DayKey): DayKey {
  return key.slice(0, 4) + '-01-01'
}

export function daysInRange(start: DayKey, endInclusive: DayKey): DayKey[] {
  const out: DayKey[] = []
  const n = diffDays(start, endInclusive)
  for (let i = 0; i <= n; i++) out.push(addDaysKey(start, i))
  return out
}

/** Local midnight timestamp of a day key. */
export function dayStartMs(key: DayKey): number {
  return parseDayKey(key).getTime()
}

export function dayEndMs(key: DayKey): number {
  return dayStartMs(addDaysKey(key, 1))
}

export function monthKey(key: DayKey): string {
  return key.slice(0, 7)
}

export function minutesOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/** Combine a day key and "HH:mm" into a local timestamp. */
export function atTime(key: DayKey, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseDayKey(key)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ───────────────────────── formatting ─────────────────────────

/** 25:00, 1:05:00 – used by the timer display. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** "1h 25m", "45m", "30s" */
export function formatDuration(totalSeconds: number, opts: { seconds?: boolean } = {}): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return opts.seconds ? `${s}s` : s > 0 ? '<1m' : '0m'
}

/** Compact hours for charts: 1.5h, 45m */
export function formatHoursShort(totalSeconds: number): string {
  if (totalSeconds >= 3600) {
    const h = totalSeconds / 3600
    return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`
  }
  return `${Math.round(totalSeconds / 60)}m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const monthName = (m: number) => MONTHS[m]
export const monthLong = (m: number) => MONTHS_LONG[m]
export const weekdayShort = (wd: number) => WEEKDAYS[wd]
export const weekdayLong = (wd: number) => WEEKDAYS_LONG[wd]

export function weekdayOrder(weekStartsOn: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
}

/** Friendly relative label: Today, Tomorrow, Yesterday, Mon 14, Mar 3, Mar 3 2025 */
export function relativeDayLabel(key: DayKey, today: DayKey = todayKey()): string {
  const diff = diffDays(today, key)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const d = parseDayKey(key)
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[d.getDay()]
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

export function longDate(key: DayKey): string {
  const d = parseDayKey(key)
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function shortDate(key: DayKey): string {
  const d = parseDayKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function formatTimeOfDay(ms: number, use24h: boolean): string {
  const d = new Date(ms)
  if (use24h) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const h = d.getHours() % 12 || 12
  return `${h}:${pad(d.getMinutes())}${d.getHours() < 12 ? 'am' : 'pm'}`
}

export function formatHourLabel(hour: number, use24h: boolean): string {
  if (use24h) return `${pad(hour)}`
  const h = hour % 12 || 12
  return `${h}${hour < 12 ? 'a' : 'p'}`
}

/** "9am" / "09:00" */
export function hourName(hour: number, use24h: boolean): string {
  if (use24h) return `${pad(hour)}:00`
  return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Late night focus'
}
