/**
 * Sound follows the timer.
 *
 * Subscribes to the timer store itself (not to React renders), so every path
 * that changes the timer – the buttons, keyboard shortcuts, notifications,
 * auto-started phases, a phase ending while the app slept, another tab – moves
 * the soundscape and the music player with it:
 *
 *   focus starts / resumes     → play
 *   pause, or a break begins   → pause (fade out; resumes on the next focus)
 *   stop / reset / phase ends  → stop (the next start begins from the top)
 */
import { useTimer } from '@/timer/store'
import { followAction, type FollowAction } from './followAction'
import { useAudio } from './store'

export { followAction, type FollowAction }

let enabled = true
const listeners = new Set<(action: Exclude<FollowAction, null>) => void>()

/** Settings › Sounds › "Follow the timer". */
export function setSoundFollowsTimer(on: boolean) {
  enabled = on
}

/** Other players (the music dock) join in. Returns an unsubscribe function. */
export function onTimerSound(fn: (action: Exclude<FollowAction, null>) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let installed = false
export function installSoundFollow() {
  if (installed || typeof window === 'undefined') return
  installed = true
  useTimer.subscribe((state, prev) => {
    if (state.timer === prev.timer) return
    const action = followAction(prev.timer, state.timer)
    if (!action || !enabled) return
    const audio = useAudio.getState()
    if (action === 'play') audio.play()
    else if (action === 'pause') audio.pause()
    else audio.stop()
    listeners.forEach((l) => l(action))
  })
}
