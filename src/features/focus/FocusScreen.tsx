import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Flame, Headphones, Maximize2, Minus, Pause, Play, Plus, Settings2, SkipForward, Square, Target } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { navigate } from '@/app/router'
import { useUi } from '@/app/ui-store'
import { useAudio } from '@/audio/store'
import { useLookups, useOpenTasks, useProfiles, useSettings, useTask } from '@/data/hooks'
import type { Phase } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatClock, formatDuration, greeting, longDate, MINUTE, todayKey } from '@/lib/time'
import { byPriorityThenOrder, compareTasks, isOverdue, isToday } from '@/planner/tasks'
import { elapsedMs, progress, remainingMs } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { Button, Card, IconButton, Segmented } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { Sheet } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { enterFullscreen } from '@/services/fullscreen'
import { labelPath } from '@/features/shared/labels'
import { useTodayProgress } from '@/features/shared/useProgress'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { TaskItem } from '@/features/tasks/TaskItem'
import { profileSummary } from './ProfileSheet'
import { phaseColor } from './phase'
import { TimeDigits, TimerDial } from './TimerDial'
import { ExpeditionStrip } from './ExpeditionStrip'

export function FocusScreen() {
  const desktop = useIsDesktop()
  useFocusShortcuts()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-safe sm:px-6">
      <FocusHeader />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-4">
        <TimerPanel />
        {desktop ? <TodayPanel /> : <MobileBelowFold />}
      </div>
    </div>
  )
}

/** Space: start/pause · F: immersive · S: sounds (ignored while typing). */
function useFocusShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      const ui = useUi.getState()
      if (ui.immersive) return
      if (e.code === 'Space') {
        e.preventDefault()
        useTimer.getState().toggle()
      } else if (e.key === 'f') {
        ui.set({ immersive: true })
        void enterFullscreen()
      } else if (e.key === 's') ui.set({ soundOpen: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function FocusHeader() {
  const soundPlaying = useAudio((s) => s.playing)
  const status = useTimer((s) => s.timer.status)
  const today = todayKey()
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">{longDate(today)}</p>
        <p className="font-display truncate text-lg font-medium">{status === 'idle' ? greeting() : 'In the zone'}</p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="Sounds" active={soundPlaying} onClick={() => useUi.getState().set({ soundOpen: true })}>
          <Headphones className="size-5" />
          {soundPlaying && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}
        </IconButton>
        <IconButton
          label="Immersive mode"
          onClick={() => {
            useUi.getState().set({ immersive: true })
            void enterFullscreen()
          }}
        >
          <Maximize2 className="size-5" />
        </IconButton>
        <IconButton label="Settings" className="lg:hidden" onClick={() => navigate('#/settings')}>
          <Settings2 className="size-5" />
        </IconButton>
      </div>
    </header>
  )
}

function TimerPanel() {
  const timer = useTimer((s) => s.timer)
  const { start, pause, skip, adjust, selectPhase } = useTimer.getState()
  const running = timer.status === 'running'
  const idle = timer.status === 'idle'
  const now = useNow(!idle)
  const settings = useSettings()
  const profiles = useProfiles()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const { label } = useLookups()
  const task = useTask(timer.context.taskId)
  const labels = useLookups().labels
  const [stopOpen, setStopOpen] = useState(false)

  const rem = remainingMs(timer, now)
  const el = elapsedMs(timer, now)
  const clock = rem === null ? formatClock(el / 1000) : formatClock(Math.ceil(rem / 1000))
  const l = label(timer.context.labelId)
  const cyc = timer.config.mode === 'pomodoro' ? timer.config.longBreakEvery : 0
  const color = phaseColor(timer.phase)

  const onStop = () => {
    const minMs = settings.minSessionSeconds * 1000
    if (timer.phase === 'focus' && el >= minMs) setStopOpen(true)
    else useTimer.getState().stop()
  }

  return (
    <section className="flex flex-col items-center pb-4" aria-label="Timer">
      {/* Profile + phase selection – fades away once you start. */}
      <div className="flex h-[88px] flex-col items-center justify-start gap-3">
        <AnimatePresence initial={false}>
          {idle && (
            <motion.div key="setup" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => useUi.getState().set({ profileOpen: true })}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold shadow-soft hover:border-line-strong"
              >
                <span>{profile?.name ?? 'Timer'}</span>
                <span className="text-ink-3">·</span>
                <span className="text-ink-2">{profile ? profileSummary(profile).split(' · ').slice(0, 2).join(' · ') : ''}</span>
                <ChevronDown className="size-3.5 text-ink-3" />
              </button>
              {timer.config.mode === 'pomodoro' && (
                <Segmented<Phase>
                  size="sm"
                  layoutId="phase-tabs"
                  value={timer.phase}
                  onChange={selectPhase}
                  options={[
                    { value: 'focus', label: 'Focus' },
                    { value: 'shortBreak', label: 'Break' },
                    ...(timer.config.longBreakEvery > 0 ? [{ value: 'longBreak' as Phase, label: 'Long break' }] : []),
                  ]}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-[min(84vw,420px,calc(100dvh-400px))] min-w-[240px] lg:max-w-[min(460px,calc(100dvh-340px))]">
        <TimerDial progress={idle ? 0 : progress(timer, now)} phase={timer.phase} running={running} phaseKey={timer.phaseId} idle={idle}>
          <button type="button" onClick={() => useUi.getState().set({ contextOpen: true })} className="mb-1 flex max-w-[70%] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[13px] font-semibold text-ink-2 hover:text-ink">
            {l ? (
              <>
                <span className="size-2 shrink-0 rounded-full" style={{ background: l.color }} />
                <span className="truncate">{labelPath(labels, l.id)}</span>
              </>
            ) : (
              <span className="text-ink-3">{timer.phase === 'focus' ? 'No subject' : PHASE_LABEL[timer.phase]}</span>
            )}
          </button>
          <span role="timer" aria-live="off" aria-label={`${clock} ${rem === null ? 'elapsed' : 'remaining'}`} className="tabular font-display text-[clamp(56px,17vw,96px)] leading-none font-light tracking-tight">
            <TimeDigits text={clock} />
          </span>
          <div className="mt-3 flex h-5 items-center gap-2 text-[13px] font-semibold" style={{ color }}>
            {timer.status === 'paused' ? <span className="animate-pulse text-ink-2">Paused</span> : <span>{statusText(timer.status, timer.phase, timer.config.mode)}</span>}
            {cyc > 0 && (
              <span className="flex gap-1" aria-label={`${timer.cycleCount} of ${cyc} sessions before a long break`}>
                {Array.from({ length: cyc }, (_, i) => (
                  <span key={i} className="size-1.5 rounded-full" style={{ background: i < timer.cycleCount ? color : 'var(--line-strong)' }} />
                ))}
              </span>
            )}
          </div>
        </TimerDial>
      </div>

      <button
        type="button"
        onClick={() => useUi.getState().set({ contextOpen: true })}
        className="mt-2 flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Target className="size-4 shrink-0 text-ink-3" />
        <span className="truncate">{task ? task.title : timer.context.note ? timer.context.note : 'What are you working on?'}</span>
      </button>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-center gap-5">
        {idle ? (
          <IconButton label="5 minutes less" variant="secondary" size="lg" disabled={timer.targetMs === null} onClick={() => adjust(-5 * MINUTE)}>
            <Minus className="size-5" />
          </IconButton>
        ) : (
          <IconButton label="Stop" variant="secondary" size="lg" onClick={onStop}>
            <Square className="size-[18px] fill-current" />
          </IconButton>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => (running ? pause() : start())}
          aria-label={running ? 'Pause' : idle ? `Start ${PHASE_LABEL[timer.phase].toLowerCase()}` : 'Resume'}
          className="flex size-[76px] items-center justify-center rounded-full text-primary-ink shadow-lift transition-colors"
          style={{ background: timer.phase === 'focus' ? 'var(--primary)' : color }}
        >
          {running ? <Pause className="size-8 fill-current" strokeWidth={0} /> : <Play className="ml-1 size-8 fill-current" strokeWidth={0} />}
        </motion.button>
        {idle ? (
          <IconButton label="5 minutes more" variant="secondary" size="lg" disabled={timer.targetMs === null} onClick={() => adjust(5 * MINUTE)}>
            <Plus className="size-5" />
          </IconButton>
        ) : (
          <IconButton label={timer.phase === 'focus' ? 'Finish early and take a break' : 'Skip break'} variant="secondary" size="lg" onClick={skip}>
            <SkipForward className="size-5 fill-current" />
          </IconButton>
        )}
      </div>
      <div className="mt-3 h-8">
        {!idle && timer.targetMs !== null && (
          <button type="button" onClick={() => adjust(5 * MINUTE)} className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-3 hover:bg-surface-2 hover:text-ink">
            +5 min
          </button>
        )}
      </div>
      <ExpeditionStrip />

      <Sheet open={stopOpen} onClose={() => setStopOpen(false)} title="End this session?" size="sm">
        <p className="text-[15px] text-ink-2">You’ve focused for {formatDuration(el / 1000)}. Save it to your history, or discard it.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            block
            onClick={() => {
              setStopOpen(false)
              useTimer.getState().stop()
            }}
          >
            Save {formatDuration(el / 1000)} and stop
          </Button>
          <Button
            variant="danger"
            block
            onClick={() => {
              setStopOpen(false)
              useTimer.getState().stop({ discard: true })
            }}
          >
            Discard session
          </Button>
          <Button block onClick={() => setStopOpen(false)}>
            Keep going
          </Button>
        </div>
      </Sheet>
    </section>
  )
}

function statusText(status: 'idle' | 'running' | 'paused', phase: Phase, mode: 'pomodoro' | 'countdown' | 'stopwatch'): string {
  if (status === 'idle') return phase === 'focus' ? 'Ready' : `${PHASE_LABEL[phase]} ready`
  if (phase === 'focus') return mode === 'stopwatch' ? 'Open focus' : 'Focusing'
  return phase === 'longBreak' ? 'Long break' : 'On a break'
}

function ProgressStrip() {
  const p = useTodayProgress()
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Today" value={formatDuration(p.seconds)} sub={p.targetSeconds ? `of ${formatDuration(p.targetSeconds)}` : undefined}>
        {p.targetSeconds > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.min(100, p.ratio * 100)}%` }} />
          </div>
        )}
      </Stat>
      <Stat label="Streak" value={`${p.streak} ${p.streak === 1 ? 'day' : 'days'}`} sub={p.todayDone ? 'today counted' : p.streak ? 'study today to keep it' : 'start one today'} icon={<Flame className={cn('size-3.5', p.todayDone ? 'text-accent' : 'text-ink-3')} />} />
      <Stat label="Sessions" value={String(p.count)} sub="today" />
    </div>
  )
}

function Stat({ label, value, sub, icon, children }: { label: string; value: string; sub?: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <Card className="px-3.5 py-3">
      <p className="flex items-center gap-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 font-display text-xl leading-tight font-medium">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] font-medium text-ink-3">{sub}</p>}
      {children}
    </Card>
  )
}

function UpNext({ limit }: { limit: number }) {
  const tasks = useOpenTasks()
  const { project, label } = useLookups()
  const counts = useTaskSessions()
  const activeTaskId = useTimer((s) => s.timer.context.taskId)
  const today = todayKey()
  const list = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdue(t, today)).sort(byPriorityThenOrder)
    const todays = tasks.filter((t) => isToday(t, today)).sort(compareTasks)
    return [...todays, ...overdue].filter((t) => t.id !== activeTaskId)
  }, [tasks, today, activeTaskId])

  return (
    <section>
      <div className="mb-1 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Up next</h2>
        <button type="button" onClick={() => navigate('#/tasks')} className="text-xs font-bold text-accent">
          All tasks
        </button>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="A clear day"
            body="Plan a few tasks for today and start them from here."
            action={
              <Button size="sm" variant="primary" onClick={() => useUi.getState().newTask({ plannedFor: today })}>
                Plan a task
              </Button>
            }
            className="py-7"
          />
        </Card>
      ) : (
        <Card className="p-1">
          {list.slice(0, limit).map((t) => (
            <TaskItem key={t.id} task={t} project={project(t.projectId)} label={label(t.labelId)} sessions={counts.count(t.id)} />
          ))}
          {list.length > limit && (
            <button type="button" onClick={() => navigate('#/tasks')} className="w-full rounded-xl py-2.5 text-center text-[13px] font-bold text-ink-2 hover:bg-surface-2">
              {list.length - limit} more for today
            </button>
          )}
        </Card>
      )}
    </section>
  )
}

function MobileBelowFold() {
  const idle = useTimer((s) => s.timer.status === 'idle')
  return (
    <AnimatePresence initial={false}>
      {idle && (
        <motion.div key="below" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden pb-6">
          <ProgressStrip />
          <UpNext limit={4} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TodayPanel() {
  return (
    <aside className="space-y-6 pt-[88px]">
      <ProgressStrip />
      <UpNext limit={7} />
    </aside>
  )
}
