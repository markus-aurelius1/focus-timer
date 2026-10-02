/** Focus-screen link to the Atlas: where the next minutes lead, and break-time recall. */
import { Flag, GraduationCap } from 'lucide-react'
import { lazy, Suspense, useCallback, useState } from 'react'
import { navigate } from '@/app/router'
import { useExploration } from '@/atlas/useExploration'
import { useSettings } from '@/data/hooks'
import { useTimerValue } from '@/timer/clock'
import { elapsedMs, type TimerState } from '@/timer/engine'
import { useTimer } from '@/timer/store'
import { Pressable } from '@/ui/Pressable'
import { expeditionStatus } from '@/features/atlas/AtlasPanel'
import type { ReviewRequest } from '@/features/atlas/FieldReview'
const FieldReviewSheet = lazy(() => import('@/features/atlas/FieldReview').then(m => ({ default:m.FieldReviewSheet })))
import { minutesText } from '@/features/atlas/util'

export function ExpeditionStrip() {
  const ex = useExploration(false)
  const settings = useSettings()
  const timer = useTimer((s) => s.timer)
  const focusing = timer.phase === 'focus' && timer.status === 'running'
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const a = ex?.state.active
  const next = focusing && a?.next && !a.blockedBy ? a.next : null
  // While focusing, count down live toward the next stop. The text changes about once a minute, and that is how often this renders.
  const remaining = next?.remaining
  const nextName = next?.stop.place.name
  const live = useTimerValue(
    useCallback(
      (tm: TimerState, now: number) => {
        if (remaining === undefined || !nextName) return null
        const left = remaining - elapsedMs(tm, now) / 60000
        return left > 0 ? `${minutesText(left)} to ${nextName}` : `Reaching ${nextName}…`
      },
      [remaining, nextName],
    ),
  )
  if (!ex) return <div className="h-9" />
  const status = expeditionStatus(ex)
  const line = live ?? status?.line ?? ''
  const onBreak = timer.phase !== 'focus' && timer.status !== 'idle'
  const breakReview = settings.breakReview && onBreak && ex.due.length > 0
  return (
    <div className="mt-2 flex w-full flex-col items-center gap-2">
      {status && (
        <Pressable onClick={() => navigate('#/atlas')} className="focus-ctl" data-shape="pill">
          <Flag className="size-3.5 shrink-0" />
          <span className="truncate font-medium">
            <b className="font-bold" style={{ color: 'var(--focus-ink)' }}>
              {status.title}
            </b>{' '}
            · {line}
          </span>
        </Pressable>
      )}
      {breakReview && (
        <Pressable onClick={() => setReview({ placeIds: ex.due.slice(0, 2).map((d) => d.id), source: 'break', title: 'Break-time recall' })} className="focus-ctl" data-shape="pill" data-active="">
          <GraduationCap className="size-3.5" /> Two quick questions while you rest
        </Pressable>
      )}
      {review && <Suspense fallback={null}><FieldReviewSheet request={review} onClose={() => setReview(null)} /></Suspense>}
    </div>
  )
}
