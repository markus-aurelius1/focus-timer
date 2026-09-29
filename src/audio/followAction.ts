import type { TimerState } from '@/timer/engine'

export type FollowAction = 'play' | 'pause' | 'stop' | null

type TimerLike = Pick<TimerState, 'status' | 'phase'>

/** What sound should do when the timer moves from `prev` to `next`. Pure – see follow.test.ts. */
export function followAction(prev: TimerLike, next: TimerLike): FollowAction {
  const was = prev.status === 'running' && prev.phase === 'focus'
  const now = next.status === 'running' && next.phase === 'focus'
  if (now && !was) return 'play'
  if (next.status === 'idle' && prev.status !== 'idle') return 'stop'
  if (was && !now) return 'pause'
  return null
}
