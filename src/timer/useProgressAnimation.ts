/**
 * Timer progress as compositor animations.
 *
 * Anything that shows how far a phase has got (the dial's arc and head, the
 * immersive bar, the bar on Home) is an element with one transform animation as
 * long as the phase. Nothing is written per frame, so a running session costs
 * no script, style or paint between second ticks.
 */
import { useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { HOUR } from '@/lib/time'
import { elapsedMs, progress as progressAt, type TimerState } from './engine'

/** How long a settling ring (reset, phase change, pause) glides to its new value. */
const GLIDE_MS = 520
/** The glide's eased curve is handed to the compositor as this many straight pieces. */
const GLIDE_STEPS = 12
/** The animation's clock is corrected when it has drifted this far from the engine's (a sleeping laptop, a changed system clock). */
const DRIFT_MS = 250

/** One element's part in showing progress: its transform at progress `p` (0..1). It must be a straight line in `p` over each half of the phase. */
export interface ProgressPart {
  el: HTMLElement | null
  at: (p: number) => string
}

/**
 * Show the timer's progress by animating transforms on the compositor.
 *
 * Each part gets one animation as long as the phase, placed at the engine's
 * elapsed time and either playing or paused, so nothing runs on the main thread
 * while the timer does. When progress jumps (pause→reset, a new phase, adding
 * time) a short eased animation glides from what was shown to the new value.
 * Once a second while running, and whenever the tab comes back, the animation's
 * clock is checked against the engine and `onSync` is told the progress.
 */
export function useProgressAnimation(timer: TimerState, parts: () => ProgressPart[], onSync?: (p: number) => void) {
  const syncRef = useRef(onSync)
  syncRef.current = onSync
  /** Progress on screen when the timer last changed, for the glide to start from. */
  const shown = useRef<number | null>(null)

  useLayoutEffect(() => {
    const idle = timer.status === 'idle'
    const running = timer.status === 'running'
    // A stopwatch has no target: its ring goes round once an hour.
    const span = timer.targetMs === null ? HOUR : Math.max(1, timer.targetMs)
    const target = (now: number) => (idle ? 0 : progressAt(timer, now))
    const position = (now: number) => (idle ? 0 : timer.targetMs === null ? elapsedMs(timer, now) % span : Math.min(span, elapsedMs(timer, now)))
    const list = parts().filter((p): p is ProgressPart & { el: HTMLElement } => !!p.el)
    const start = Date.now()
    const to = target(start)
    const from = shown.current ?? to
    const glides = Math.abs(to - from) >= 0.002 && !prefersReducedMotion()
    const glideTo = glides && running ? target(start + GLIDE_MS) : to
    const ease = (k: number) => 1 - Math.pow(1 - k, 3)

    const animations: Animation[] = []
    for (const { el, at } of list) {
      if (typeof el.animate !== 'function') {
        el.style.transform = at(to)
        continue
      }
      const a = el.animate([0, 0.5, 1].map((offset) => ({ offset, transform: at(offset) })), { duration: span, iterations: timer.targetMs === null ? Infinity : 1, fill: 'both' })
      a.pause()
      a.currentTime = position(start)
      if (running) a.play()
      animations.push(a)
      // The glide sits on top of the long animation and gives way to it when it ends.
      if (glides) animations.push(el.animate(Array.from({ length: GLIDE_STEPS + 1 }, (_, i) => ({ offset: i / GLIDE_STEPS, transform: at(from + (glideTo - from) * ease(i / GLIDE_STEPS)) })), { duration: GLIDE_MS }))
    }

    const sync = () => {
      const now = Date.now()
      if (running) {
        const at = position(now)
        for (const a of animations) {
          if (a.effect?.getTiming().duration !== span) continue
          const drift = Math.abs(Number(a.currentTime ?? 0) % span - at)
          if (drift > DRIFT_MS && span - drift > DRIFT_MS) a.currentTime = at
        }
      }
      syncRef.current?.(target(now))
    }
    syncRef.current?.(to)
    const timerId = running ? setInterval(sync, 1000) : undefined
    const onVisible = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      const now = Date.now()
      const k = glides ? Math.min(1, (now - start) / GLIDE_MS) : 1
      shown.current = k < 1 ? from + (glideTo - from) * ease(k) : target(now)
      clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisible)
      for (const a of animations) a.cancel()
    }
    // `parts` reads refs: it is called when the timer changes, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer])
}
