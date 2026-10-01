import { useMemo } from 'react'
import { useGoals, useSessions, useSettings } from '@/data/hooks'
import { computeStreaks, studyDays } from '@/stats/aggregate'
import { addDaysKey } from '@/lib/time'
import { useDay } from '@/lib/useDay'

/** Today's focus, the daily goal and the streak – shared by the Focus screen and widgets. */
export function useTodayProgress() {
  const sessions = useSessions()
  const goals = useGoals()
  const settings = useSettings()
  const today = useDay()
  return useMemo(() => {
    const todays = sessions.filter((s) => s.date === today)
    const seconds = todays.reduce((a, s) => a + s.duration, 0)
    const daily = goals.find((g) => g.active && g.period === 'day' && !g.labelId && !g.projectId)
    const target = (daily?.targetMinutes ?? 0) * 60
    const days = studyDays(sessions)
    const streaks = computeStreaks(days, today)
    // The last seven days, oldest first: did any focus happen?
    const week = Array.from({ length: 7 }, (_, i) => days.has(addDaysKey(today, i - 6)))
    return {
      sessions,
      todays,
      seconds,
      count: todays.length,
      targetSeconds: target,
      ratio: target ? seconds / target : 0,
      streak: streaks.current,
      longestStreak: streaks.longest,
      todayDone: streaks.todayDone,
      week,
      weekStartsOn: settings.weekStartsOn,
    }
  }, [sessions, goals, today, settings.weekStartsOn])
}
