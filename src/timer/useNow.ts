import { useEffect, useState } from 'react'

/**
 * Re-render once per second, aligned to the wall-clock second boundary so the
 * display never skips or repeats a digit. Pauses while the page is hidden –
 * the timer's truth lives in timestamps, not in these ticks.
 */
export function useNow(active = true, stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    let timeout: ReturnType<typeof setTimeout>
    const schedule = () => {
      const t = Date.now()
      setNow(t)
      timeout = setTimeout(schedule, stepMs - (t % stepMs) + 8)
    }
    const onVisible = () => {
      clearTimeout(timeout)
      if (document.visibilityState === 'visible') schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, stepMs])
  return now
}
