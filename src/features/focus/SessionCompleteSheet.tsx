import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { Check, Coffee, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '@/data/db'
import { useLookups, useSettings } from '@/data/hooks'
import { patch } from '@/data/repo'
import { constellationName } from '@/game/sky'
import { stardustForSession } from '@/game/progression'
import { cn } from '@/lib/cn'
import { formatDuration, startOfWeekKey } from '@/lib/time'
import { completeTask } from '@/planner/tasks'
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
  const start = useTimer((s) => s.start)
  const settings = useSettings()
  const session = useLiveQuery(() => (last ? db.sessions.get(last.id) : undefined), [last?.id])
  const task = useLiveQuery(() => (session?.taskId ? db.tasks.get(session.taskId) : undefined), [session?.taskId])
  const taskSessions = useLiveQuery(() => (session?.taskId ? db.sessions.where('taskId').equals(session.taskId).count() : 0), [session?.taskId])
  const { label } = useLookups()
  const [note, setNote] = useState('')

  useEffect(() => {
    if (session) setNote(session.note)
  }, [session?.id])

  const open = !!last && !!session
  const close = () => {
    if (session && note !== session.note) void patch('sessions', session.id, { note })
    dismiss()
  }

  if (!session) return <Sheet open={false} onClose={close}>{null}</Sheet>

  const l = label(session.labelId)
  const week = startOfWeekKey(session.date, settings.weekStartsOn)
  const breakReady = timer.status === 'idle' && timer.phase !== 'focus'
  const breakRunning = timer.status === 'running' && timer.phase !== 'focus'

  const rate = (r: number) => {
    haptics.tap()
    void patch('sessions', session.id, { rating: session.rating === r ? null : r })
  }

  return (
    <Sheet open={open} onClose={close} size="sm" bare>
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
        <p className="mt-3 text-[13px] text-ink-3">
          A new star joins <span className="font-display text-ink-2 italic">{constellationName(week)}</span> · +{stardustForSession(session)} stardust
        </p>

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
                await completeTask(task)
                toast({ title: 'Task complete', body: task.title, tone: 'success' })
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
                start()
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
