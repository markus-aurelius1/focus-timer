/**
 * One second ticker for the whole app, and hooks that turn it into text.
 *
 * Every running clock on screen (the dial digits, the rail, the tab bar, the
 * window title) used to keep its own timer and re-render its whole parent each
 * second. Here there is a single timeout aligned to the wall-clock second, and
 * a component subscribes to a *value derived from it*: React re-renders it only
 * when that value changes. A screen that shows minutes re-renders once a
 * minute; a parent that shows nothing ticking never does.
 *
 * The timer's truth still lives in timestamps (engine.ts). The ticker only says
 * "look again"; it stops while nothing is subscribed or the page is hidden.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { formatClock } from '@/lib/time'
import { elapsedMs, remainingMs, type TimerState } from './engine'
import { useTimer } from './store'

const listeners = new Set<() => void>()
let timeout: ReturnType<typeof setTimeout> | undefined
let watching = false

const tick = () => {
  for (const l of [...listeners]) l()
  schedule()
}
function schedule() {
  clearTimeout(timeout)
  timeout = undefined
  if (!listeners.size || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return
  // Just after the next second boundary, so a display never skips or repeats a digit.
  timeout = setTimeout(tick, 1000 - (Date.now() % 1000) + 8)
}
const onVisible = () => {
  if (document.visibilityState === 'visible') tick()
  else schedule()
}

/** Call `listener` once a second (aligned to the second) while the page is visible. Returns the unsubscribe function. */
export function onSecond(listener: () => void): () => void {
  listeners.add(listener)
  if (!watching && typeof document !== 'undefined') {
    watching = true
    document.addEventListener('visibilitychange', onVisible)
  }
  if (!timeout) schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) schedule()
  }
}

/** The countdown (or, for a stopwatch, the count up) as the dial shows it. */
export function clockText(timer: TimerState, now: number): string {
  const rem = remainingMs(timer, now)
  return rem === null ? formatClock(elapsedMs(timer, now) / 1000) : formatClock(Math.ceil(rem / 1000))
}

const subscribeTimer = (cb: () => void) => {
  const offTick = onSecond(cb)
  const offStore = useTimer.subscribe(cb)
  return () => {
    offTick()
    offStore()
  }
}

/**
 * A value derived from the timer and the time, re-read every second and on
 * every timer change. The component re-renders only when the value changes, so
 * `select` must return a primitive (a string, a number, a boolean).
 */
export function useTimerValue<T extends string | number | boolean | null>(select: (timer: TimerState, now: number) => T): T {
  const read = useCallback(() => select(useTimer.getState().timer, Date.now()), [select])
  return useSyncExternalStore(subscribeTimer, read, read)
}

/** The running clock text, e.g. "24:07". */
export const useClockText = (): string => useTimerValue(clockText)

const subscribeSecond = (cb: () => void) => onSecond(cb)

/** A value derived from the time alone (a time of day, "3 minutes ago"), re-read every second. */
export function useTimeValue<T extends string | number | boolean | null>(select: (now: number) => T): T {
  const read = useCallback(() => select(Date.now()), [select])
  return useSyncExternalStore(subscribeSecond, read, read)
}
