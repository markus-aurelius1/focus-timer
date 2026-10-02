/**
 * The smallest components that tick. Put one of these where a time is shown and
 * the component around it no longer needs to re-render every second (clock.ts).
 */
import { formatTimeOfDay } from '@/lib/time'
import { clockText, useClockText, useTimeValue, useTimerValue } from './clock'
import { remainingMs, type TimerState } from './engine'

/** The running countdown or count-up as plain text ("24:07"). */
export function ClockText() {
  return <>{useClockText()}</>
}

const describe = (timer: TimerState, now: number) => `${clockText(timer, now)} ${remainingMs(timer, now) === null ? 'elapsed' : 'remaining'}`

/** "24:07 remaining" / "12:40 elapsed", for an accessible name. */
export const useClockDescription = (): string => useTimerValue(describe)

/** The time of day, re-rendered when the minute changes. */
export function TimeOfDay({ use24h }: { use24h: boolean }) {
  const minute = useTimeValue(minuteOf)
  return <>{formatTimeOfDay(minute * 60_000, use24h)}</>
}
const minuteOf = (now: number) => Math.floor(now / 60_000)
