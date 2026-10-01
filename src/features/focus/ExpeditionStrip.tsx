/** Focus-screen link to the Atlas: where the next minutes lead, and break-time recall. */
import { Flag, GraduationCap } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { navigate } from '@/app/router'
import { useExploration } from '@/atlas/useExploration'
import { useSettings } from '@/data/hooks'
import { elapsedMs } from '@/timer/engine'
import { useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { cn } from '@/lib/cn'
import { expeditionStatus } from '@/features/atlas/AtlasPanel'
import type { ReviewRequest } from '@/features/atlas/FieldReview'
const FieldReviewSheet = lazy(() => import('@/features/atlas/FieldReview').then(m => ({ default:m.FieldReviewSheet })))
import { minutesText } from '@/features/atlas/util'

export function ExpeditionStrip() {
  const ex = useExploration()
  const settings = useSettings()
  const timer = useTimer((s) => s.timer)
  const focusing = timer.phase === 'focus' && timer.status === 'running'
  const now = useNow(focusing)
  const [review, setReview] = useState<ReviewRequest | null>(null)
  if (!ex) return <div className="h-9" />
  const status = expeditionStatus(ex)
  const a = ex.state.active
  // While focusing, count down live toward the next stop.
  let line = status?.line ?? ''
  if (focusing && a?.next && !a.blockedBy) {
    const left = a.next.remaining - elapsedMs(timer, now) / 60000
    line = left > 0 ? `${minutesText(left)} to ${a.next.stop.place.name}` : `Reaching ${a.next.stop.place.name}…`
  }
  const onBreak = timer.phase !== 'focus' && timer.status !== 'idle'
  const breakReview = settings.breakReview && onBreak && ex.due.length > 0
  return (
    <div className="flex w-full flex-col items-center gap-2">
      {status && (
        <button
          type="button"
          onClick={() => navigate('#/atlas')}
          className="flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] shadow-soft hover:border-line-strong"
        >
          <Flag className="size-3.5 shrink-0" style={{ color: status.color }} />
          <span className="truncate">
            <b>{status.title}</b> <span className={cn(status.blocked ? 'font-semibold text-accent' : 'text-ink-2')}>· {line}</span>
          </span>
        </button>
      )}
      {breakReview && (
        <button
          type="button"
          onClick={() => setReview({ placeIds: ex.due.slice(0, 2).map((d) => d.id), source: 'break', title: 'Break-time recall' })}
          className="flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold text-accent"
        >
          <GraduationCap className="size-3.5" /> Two quick questions while you rest
        </button>
      )}
      {review && <Suspense fallback={null}><FieldReviewSheet request={review} onClose={() => setReview(null)} /></Suspense>}
    </div>
  )
}
