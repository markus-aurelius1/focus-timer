/** Today's focus against the daily goal, the last seven days and the streak – one quiet block, no cards. */
import { motion } from 'motion/react'
import { Flame } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/time'
import { EASE_OUT } from '@/ui/motion'
import { useTodayProgress } from './useProgress'

export function TodayLine({ className, style }: { className?: string; style?: CSSProperties }) {
  const p = useTodayProgress()
  const goal = p.targetSeconds > 0
  return (
    <div className={className} style={style} aria-label="Today’s progress">
      <p className="flex items-baseline justify-between gap-3 text-[12.5px] font-semibold text-ink-3">
        <span>Focused today</span>
        <span className="t-num text-[13px] text-ink">
          {formatDuration(p.seconds)}
          {goal && <span className="font-semibold text-ink-3"> of {formatDuration(p.targetSeconds)}</span>}
        </span>
      </p>
      {goal && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Daily focus goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, p.ratio) * 100)}>
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${Math.min(100, p.ratio * 100)}%` }} transition={{ duration: 0.7, ease: EASE_OUT }} />
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex gap-1" role="img" aria-label={`Focused on ${p.week.filter(Boolean).length} of the last 7 days`}>
          {p.week.map((on, i) => (
            <span key={i} className={cn('h-1.5 w-3 rounded-full', on ? 'bg-accent' : i === 6 ? 'bg-line-strong' : 'bg-surface-3')} />
          ))}
        </div>
        <span className={cn('flex items-center gap-1 text-[12px] font-bold whitespace-nowrap', p.todayDone ? 'text-accent' : 'text-ink-3')}>
          <Flame className={cn('size-3.5', p.todayDone && 'fill-current')} />
          {p.streak ? `${p.streak}-day streak` : 'No streak yet'}
        </span>
      </div>
    </div>
  )
}
