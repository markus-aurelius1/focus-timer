/**
 * Switching between Pomodoro, a single timer and a stopwatch. Each mode
 * remembers the profile last used in it, so going back to a mode goes back to
 * the timer you had there.
 */
import { updateSettings } from '@/data/hooks'
import { create, nextOrder } from '@/data/repo'
import { BUILT_IN_PROFILES } from '@/data/seed'
import type { TimerMode, TimerProfile } from '@/data/types'
import { useTimer } from '@/timer/store'

export const MODES: Array<{ value: TimerMode; label: string }> = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'countdown', label: 'Timer' },
  { value: 'stopwatch', label: 'Stopwatch' },
]
const MODE_MEMORY = 'tars.modeProfiles'

export function rememberProfile(p: TimerProfile) {
  try {
    const map = JSON.parse(localStorage.getItem(MODE_MEMORY) ?? '{}') as Record<string, string>
    if (map[p.mode] === p.id) return
    localStorage.setItem(MODE_MEMORY, JSON.stringify({ ...map, [p.mode]: p.id }))
  } catch {
    /* storage unavailable */
  }
}

/** Switch timer mode: the profile last used in that mode, else the first one, else a built-in. */
export async function switchMode(mode: TimerMode, profiles: TimerProfile[]) {
  let remembered: string | undefined
  try {
    remembered = (JSON.parse(localStorage.getItem(MODE_MEMORY) ?? '{}') as Record<string, string>)[mode]
  } catch {
    /* ignore */
  }
  let target = profiles.find((p) => p.id === remembered && p.mode === mode) ?? profiles.find((p) => p.mode === mode)
  if (!target) {
    const seed = BUILT_IN_PROFILES.find((p) => p.mode === mode)!
    target = await create('profiles', { ...seed, order: await nextOrder('profiles') })
  }
  // Apply straight away (no waiting for the settings write) so the clock changes with the press.
  useTimer.getState().applyProfile(target)
  await updateSettings({ activeProfileId: target.id })
}
