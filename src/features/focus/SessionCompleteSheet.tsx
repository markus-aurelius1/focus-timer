import { executeAction } from '@/tars/runtime'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { Check, Coffee, MapPin, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '@/data/db'
import { useLookups } from '@/data/hooks'
import { patch } from '@/data/repo'
import { discoveredBetween } from '@/atlas/explore'
import { placeSubtitle } from '@/atlas/data'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import type { Session } from '@/data/types'
import { xpForSession } from '@/game/progression'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/time'
import { expeditionStatus } from '@/features/atlas/AtlasPanel'
import { KIND_NAME } from '@/features/atlas/symbols'
import { PlaceIcon } from '@/features/atlas/util'
import { haptics } from '@/services/haptics'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { Button, TextArea } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { LogoMark } from '@/ui/Logo'

/** "How did it go?" – shown right after a focus session is recorded. */
export function SessionCompleteSheet() {
  const last = useTimer((s) => s.lastSession)
  const dismiss = useTimer((s) => s.dismissLastSession)
  const timer = useTimer((s) => s.timer)
  const ex = useExploration()
  const session = useLiveQuery(() => (last ? db.sessions.get(last.id) : undefined), [last?.id])
  const task = useLiveQuery(() => (session?.taskId ? db.tasks.get(session.taskId) : undefined), [session?.taskId])
  const taskSessions = useLiveQuery(() => (session?.taskId ? db.sessions.where('taskId').equals(session.taskId).count() : 0), [session?.taskId])
  const { label } = useLookups()
  const [note, setNote] = useState('')
  // Let the dial's completion moment play before the card slides up.
  const [shownFor, setShownFor] = useState<string | null>(null)
  useEffect(() => {
    if (!last) return
    const wait = last.fresh && Date.now() - last.at < 3000 ? 1700 : 0
    const t = setTimeout(() => setShownFor(last.id), wait)
    return () => clearTimeout(t)
  }, [last])

  useEffect(() => {
    if (session) setNote(session.note)
  }, [session?.id])

  const open = !!last && !!session && shownFor === last.id
  const close = () => {
    if (session && note !== session.note) void patch('sessions', session.id, { note })
    dismiss()
  }

  if (!session) return <Sheet open={false} onClose={close}>{null}</Sheet>

  const l = label(session.labelId)
  const breakReady = timer.status === 'idle' && timer.phase !== 'focus'
  const breakRunning = timer.status === 'running' && timer.phase !== 'focus'

  const rate = (r: number) => {
    haptics.tap()
    void patch('sessions', session.id, { rating: session.rating === r ? null : r })
  }

  return (
    <Sheet open={open} onClose={close} size="sm" bare label={session.completed ? 'Session complete' : 'Session saved'}>
      <div className="px-6 pt-4 pb-6 text-center sm:pt-8">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
          className="relative mx-auto mb-4 flex size-16 items-center justify-center"
        >
          <span className="absolute inset-0 animate-breathe rounded-full bg-accent/20 blur-md" />
          <LogoMark className="relative size-10 text-accent" />
        </motion.div>
        <h2 className="font-display text-2xl font-medium tracking-tight">{session.completed ? 'Session complete' : 'Session saved'}</h2>
        <p className="mt-1 text-[15px] text-ink-2">
          {formatDuration(session.duration)}
          {l && <> · {l.name}</>}
          {task && <> · {task.title}</>}
        </p>
        <p className="mt-3 text-[13px] font-semibold text-accent">+{xpForSession(session)} XP</p>
        {ex && <Discoveries ex={ex} session={session} onOpen={close} />}

        <div className="mt-6">
          <p className="mb-2 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">How focused were you?</p>
          <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Focus rating">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" role="radio" aria-checked={session.rating === r} aria-label={`${r} of 5`} onClick={() => rate(r)} className="rounded-full p-1.5 transition-transform active:scale-90">
                <Star className={cn('size-7 transition-colors', (session.rating ?? 0) >= r ? 'fill-accent text-accent' : 'text-line-strong')} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>

        <TextArea className="mt-5 text-left" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes – what did you get done? What’s next?" />

        <div className="mt-5 flex flex-col gap-2">
          {task && !task.done && (
            <Button
              block
              icon={<Check className="size-4" />}
              onClick={async () => {
                const result = await executeAction('task.complete', { taskId: task.id })
                if (result.ok) toast({ title: 'Task complete', body: task.title, tone: 'success' })
              }}
            >
              Mark “{task.title}” done{task.estimatedPomodoros > 0 && ` · ${taskSessions}/${task.estimatedPomodoros}`}
            </Button>
          )}
          {breakReady ? (
            <Button
              block
              variant="primary"
              icon={<Coffee className="size-4" />}
              onClick={() => {
                close()
                void executeAction('timer.start',{})
              }}
            >
              Start {PHASE_LABEL[timer.phase].toLowerCase()}
            </Button>
          ) : (
            <Button block variant="primary" onClick={close}>
              {breakRunning ? 'Enjoy your break' : 'Done'}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/** Places this session uncovered, and where the expedition goes next. */
function Discoveries({ ex, session, onOpen }: { ex: Exploration; session: Session; onOpen: () => void }) {
  const ids = discoveredBetween(ex.state, session.startedAt, session.endedAt + 1)
  const status = expeditionStatus(ex)
  const go = (hash: string) => {
    onOpen()
    const place = new URLSearchParams(hash.split('?')[1]).get('place')
    void (place ? executeAction('atlas.openPlace', { placeId:place }) : executeAction('atlas.continueExpedition', {}))
  }
  return (
    <div className="mt-4 text-left">
      {status && ex.state.activeRun && session.endedAt >= ex.state.activeRun.startedAt && <p className="mb-3 text-center text-xs font-semibold text-ink-2">{status.title} +{Math.round(session.duration / 60)}m · {ids.length} places reached</p>}
      {ids.length > 0 && (
        <>
          <p className="mb-2 text-center text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">{ids.length === 1 ? '1 place reached' : `${ids.length} places reached`}</p>
          <ul className="space-y-2">
            {ids.slice(0, 3).map((id, i) => {
              const p = ex.atlas.byId.get(id)
              if (!p) return null
              return (
                <motion.li key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12 }}>
                  <button type="button" onClick={() => go(`#/atlas?place=${encodeURIComponent(id)}`)} className="flex w-full items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 text-left hover:bg-surface-2">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface">
                      <PlaceIcon kind={p.kind} tags={p.tags} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] leading-tight font-semibold">{p.name}</span>
                      <span className="block text-[12px] font-semibold text-ink-3">{placeSubtitle(p, ex.atlas, KIND_NAME[p.kind])}</span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-ink-2">{p.facts[0]}</span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </ul>
          {ids.length > 3 && <p className="mt-1.5 text-center text-[12px] text-ink-3">and {ids.length - 3} more on the map</p>}
        </>
      )}
      {status && (
        <button type="button" onClick={() => go('#/atlas')} className="mt-3 flex w-full items-center justify-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
          <MapPin className="size-3.5" style={{ color: status.color }} />
          <span className="truncate">
            <b className="text-ink">{status.title}</b> · {status.line}
          </span>
        </button>
      )}
    </div>
  )
}
