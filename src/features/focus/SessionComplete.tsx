/**
 * "How did it go?" – what a focus session leaves behind: its length and XP,
 * the places it reached, a rating, a note, and the next step (finish the task,
 * start the break). The card is content only; where it appears is decided by
 * its hosts:
 *
 *   on the Focus screen   in place of the clock (a low sheet on a phone) – no
 *                         modal interrupts the flow from session to break
 *   anywhere else         a dialog, because the session ended off-screen
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { Check, Coffee, MapPin, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { discoveredBetween } from '@/atlas/explore'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { db } from '@/data/db'
import { useLookups } from '@/data/hooks'
import { patch } from '@/data/repo'
import type { Session, Task } from '@/data/types'
import { expeditionStatus } from '@/features/atlas/AtlasPanel'
import { KIND_NAME } from '@/features/atlas/symbols'
import { PlaceIcon } from '@/features/atlas/util'
import { xpForSession } from '@/game/progression'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/time'
import { executeAction } from '@/tars/runtime'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { Button, TextArea } from '@/ui/controls'
import { LogoMark } from '@/ui/Logo'
import { M, SPRING, STAGGER } from '@/ui/motion'
import { Pressable } from '@/ui/Pressable'
import { toast } from '@/ui/toast'

export interface LastSessionView {
  session: Session
  task: Task | undefined
  taskSessions: number
  note: string
  setNote: (note: string) => void
  /** Save the note and put the card away. */
  close: () => void
}

/**
 * The session the timer has just recorded, once its completion moment has had
 * time to play. Null when there is nothing to show.
 */
export function useLastSession(): LastSessionView | null {
  const last = useTimer((s) => s.lastSession)
  const dismiss = useTimer((s) => s.dismissLastSession)
  const session = useLiveQuery(() => (last ? db.sessions.get(last.id) : undefined), [last?.id])
  const task = useLiveQuery(() => (session?.taskId ? db.tasks.get(session.taskId) : undefined), [session?.taskId])
  const taskSessions = useLiveQuery(() => (session?.taskId ? db.sessions.where('taskId').equals(session.taskId).count() : 0), [session?.taskId])
  const [note, setNote] = useState('')
  // Let the clock's completion moment play before the card arrives.
  const [shownFor, setShownFor] = useState<string | null>(null)
  useEffect(() => {
    if (!last) return
    const wait = last.fresh && Date.now() - last.at < 3000 ? 1700 : 0
    const t = setTimeout(() => setShownFor(last.id), wait)
    return () => clearTimeout(t)
  }, [last])
  useEffect(() => {
    if (session) setNote(session.note)
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- the stored note seeds the field once per session

  if (!last || !session || shownFor !== last.id) return null
  return {
    session,
    task,
    taskSessions: taskSessions ?? 0,
    note,
    setNote,
    close: () => {
      if (note !== session.note) void patch('sessions', session.id, { note })
      dismiss()
    },
  }
}

export function SessionCompleteCard({ view, compact }: { view: LastSessionView; compact?: boolean }) {
  const { session, task, taskSessions, note, setNote, close } = view
  const timer = useTimer((s) => s.timer)
  const ex = useExploration(false)
  const { label } = useLookups()
  const l = label(session.labelId)
  const breakReady = timer.status === 'idle' && timer.phase !== 'focus'
  const breakRunning = timer.status === 'running' && timer.phase !== 'focus'
  const rate = (r: number) => void patch('sessions', session.id, { rating: session.rating === r ? null : r })

  return (
    <div className={cn('px-6 pb-6 text-center', compact ? 'pt-2' : 'pt-4 sm:pt-8')}>
      {!compact && (
        <motion.div {...M.success} className="relative mx-auto mb-4 flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-breathe rounded-full bg-accent/20 blur-md" />
          <LogoMark className="relative size-10 text-accent" />
        </motion.div>
      )}
      <h2 className="t-display-m">{session.completed ? 'Session complete' : 'Session saved'}</h2>
      <p className="mt-1 text-[15px] text-ink-2">
        {formatDuration(session.duration)}
        {l && <> · {l.name}</>}
        {task && <> · {task.title}</>}
      </p>
      <p className="mt-3 text-[13px] font-semibold text-accent">+{xpForSession(session)} XP</p>
      {ex && <Discoveries ex={ex} session={session} onOpen={close} />}

      <div className="mt-6">
        <p className="mb-2 t-label">How focused were you?</p>
        <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Focus rating">
          {[1, 2, 3, 4, 5].map((r) => (
            <Pressable key={r} role="radio" aria-checked={session.rating === r} aria-label={`${r} of 5`} plain onClick={() => rate(r)} className="rounded-full p-1.5">
              <Star className={cn('size-7 transition-colors', (session.rating ?? 0) >= r ? 'fill-accent text-accent' : 'text-line-strong')} strokeWidth={1.5} />
            </Pressable>
          ))}
        </div>
      </div>

      <TextArea className="mt-5 text-left" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes – what did you get done? What’s next?" aria-label="Session notes" />

      <div className="mt-5 flex flex-col gap-2">
        {task && !task.done && (
          <Button
            block
            icon={<Check className="size-4" />}
            haptic="success"
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
              void executeAction('timer.start', {})
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
  )
}

/** Places this session uncovered, and where the expedition goes next. */
function Discoveries({ ex, session, onOpen }: { ex: Exploration; session: Session; onOpen: () => void }) {
  const ids = discoveredBetween(ex.state, session.startedAt, session.endedAt + 1)
  const status = expeditionStatus(ex)
  const go = (placeId?: string) => {
    onOpen()
    void (placeId ? executeAction('atlas.openPlace', { placeId }) : executeAction('atlas.continueExpedition', {}))
  }
  return (
    <div className="mt-4 text-left">
      {status && ex.state.activeRun && session.endedAt >= ex.state.activeRun.startedAt && (
        <p className="mb-3 text-center text-xs font-semibold text-ink-2">
          {status.title} +{Math.round(session.duration / 60)}m · {ids.length} places reached
        </p>
      )}
      {ids.length > 0 && (
        <>
          <p className="mb-2 text-center t-label">{ids.length === 1 ? '1 place reached' : `${ids.length} places reached`}</p>
          <ul className="space-y-2">
            {ids.slice(0, 3).map((id, i) => {
              const p = ex.atlas.byId.get(id)
              if (!p) return null
              return (
                <motion.li key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.settle, delay: 0.15 + Math.min(i, STAGGER.max) * STAGGER.each * 4 }}>
                  <Pressable press="surface" onClick={() => go(id)} className="flex w-full items-start gap-3 rounded-card bg-surface-2/60 p-3 text-left shadow-[inset_0_0_0_1px_var(--line)]">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-field bg-surface">
                      <PlaceIcon kind={p.kind} tags={p.tags} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] leading-tight font-semibold">{p.name}</span>
                      <span className="block text-[12px] font-semibold text-ink-3">{placeSubtitle(p, ex.atlas, KIND_NAME[p.kind])}</span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-ink-2">{p.facts[0]}</span>
                    </span>
                  </Pressable>
                </motion.li>
              )
            })}
          </ul>
          {ids.length > 3 && <p className="mt-1.5 text-center text-[12px] text-ink-3">and {ids.length - 3} more on the map</p>}
        </>
      )}
      {status && (
        <Pressable plain onClick={() => go()} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-1 text-[13px] text-ink-2 hover:text-ink">
          <MapPin className="size-3.5" style={{ color: status.color }} />
          <span className="truncate">
            <b className="text-ink">{status.title}</b> · {status.line}
          </span>
        </Pressable>
      )}
    </div>
  )
}
