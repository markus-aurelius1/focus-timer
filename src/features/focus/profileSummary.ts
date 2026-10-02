import type { TimerProfile } from '@/data/types'

/** One line describing a timer profile, e.g. "25m focus · 5m break · 15m long every 4". */
export function profileSummary(p: Pick<TimerProfile, 'mode' | 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery'>): string {
  if (p.mode === 'countdown') return `Single ${p.focusMinutes}-minute block`
  if (p.mode === 'stopwatch') return 'Count up · break scales with your focus'
  const long = p.longBreakEvery > 0 ? ` · ${p.longBreakMinutes}m long every ${p.longBreakEvery}` : ''
  return `${p.focusMinutes}m focus · ${p.shortBreakMinutes}m break${long}`
}
