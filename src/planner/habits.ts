import type { Habit, HabitLog, Label, Session } from '@/data/types'
import { addDaysKey, weekdayOf, type DayKey } from '@/lib/time'
import { labelScope } from '@/stats/aggregate'

export const isHabitDue = (h: Habit, day: DayKey) => !h.weekdays.length || h.weekdays.includes(weekdayOf(day))

export interface HabitDayStatus {
  due: boolean
  /** 0..1 – how much of the day's target was met. */
  ratio: number
  done: boolean
  minutes?: number
}

/** Build a status function for a habit given logs and sessions. Focus habits are fulfilled by sessions automatically. */
export function habitEvaluator(h: Habit, logs: HabitLog[], sessions: Session[], labels: Label[]) {
  const logByDay = new Map(logs.filter((l) => l.habitId === h.id).map((l) => [l.date, l.value]))
  const scope = h.labelId ? labelScope(labels, h.labelId) : null
  const minutesByDay = new Map<DayKey, number>()
  if (h.kind === 'focus') {
    for (const s of sessions) {
      if (scope && !(s.labelId && scope.has(s.labelId))) continue
      minutesByDay.set(s.date, (minutesByDay.get(s.date) ?? 0) + s.duration / 60)
    }
  }
  return (day: DayKey): HabitDayStatus => {
    const due = isHabitDue(h, day)
    if (h.kind === 'check') {
      const done = (logByDay.get(day) ?? 0) > 0
      return { due, ratio: done ? 1 : 0, done }
    }
    const minutes = minutesByDay.get(day) ?? 0
    const target = Math.max(1, h.targetMinutes)
    return { due, ratio: Math.min(1, minutes / target), done: minutes >= target, minutes }
  }
}

/** Consecutive due days completed, ending today (or yesterday if today isn't done yet). Non-due days are skipped. */
export function habitStreak(status: (d: DayKey) => HabitDayStatus, today: DayKey, maxDays = 730): number {
  let streak = 0
  let day = today
  if (!status(today).done) day = addDaysKey(today, -1)
  for (let i = 0; i < maxDays; i++) {
    const s = status(day)
    if (s.due) {
      if (!s.done) break
      streak++
    } else if (s.done) streak++
    day = addDaysKey(day, -1)
    if (day < addDaysKey(today, -maxDays)) break
  }
  return streak
}
