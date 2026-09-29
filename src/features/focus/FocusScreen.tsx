import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Flame, Headphones, Maximize2, Minus, Pause, Play, Plus, Settings2, SkipForward, Square, Target } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { navigate } from '@/app/router'
import { chordPending, isTyping } from '@/app/shortcuts'
import { useUi } from '@/app/ui-store'
import { useAudio } from '@/audio/store'
import { updateSettings, useLookups, useOpenTasks, useProfiles, useSettings, useTask } from '@/data/hooks'
import { create, nextOrder } from '@/data/repo'
import { BUILT_IN_PROFILES } from '@/data/seed'
import type { Phase, TimerMode, TimerProfile } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatClock, formatDuration, formatTimeOfDay, greeting, longDate, MINUTE, todayKey } from '@/lib/time'
import { byPriorityThenOrder, compareTasks, isOverdue, isToday } from '@/planner/tasks'
import { elapsedMs, remainingMs, type TimerState } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { Button, Card, IconButton, Segmented } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { EASE_OUT, T } from '@/ui/motion'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { enterFullscreen } from '@/services/fullscreen'
import { haptics } from '@/services/haptics'
import { labelPath } from '@/features/shared/labels'
import { useTodayProgress } from '@/features/shared/useProgress'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { TaskItem } from '@/features/tasks/TaskItem'
import { phaseColor } from './phase'
import { TimeDigits, TimerDial } from './TimerDial'
import { ExpeditionStrip } from './ExpeditionStrip'

/**
 * The timer screen. It fits the viewport like an app: on laptops and desktops
 * the timer and today's panel sit side by side at full height (the panel
 * scrolls inside itself); on phones the timer fills the first screen and
 * today's stats follow below it while the timer is idle.
 */
export function FocusScreen() {
  const desktop = useIsDesktop()
  useFocusShortcuts()
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-safe sm:px-6 lg:h-dvh">
      <div className="flex min-h-[calc(100svh-84px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] flex-col lg:min-h-0 lg:flex-1">
        <FocusHeader />
        <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-10">
          <TimerPanel />
          {desktop && <TodayPanel />}
        </div>
      </div>
      {!desktop && <MobileBelowFold />}
    </div>
  )
}

/** Space: start/pause · F: immersive · S: sounds (ignored while typing or in a dialog). */
function useFocusShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target) || el?.closest('[role="dialog"]') || chordPending()) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
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
    <header className="flex shrink-0 items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">{longDate(today)}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={status === 'idle' ? 'idle' : 'zone'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: T.base }} exit={{ opacity: 0, y: -4, transition: T.exit }} className="font-display truncate text-lg font-medium">
            {status === 'idle' ? greeting() : status === 'paused' ? 'Taking a pause' : 'In the zone'}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="chrome-dim flex items-center gap-1">
        <IconButton label="Sounds (S)" active={soundPlaying} onClick={() => useUi.getState().set({ soundOpen: true })}>
          <Headphones className="size-5" />
          {soundPlaying && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}
        </IconButton>
        <IconButton
          label="Immersive mode (F)"
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

// ───────────────────────── mode & profile ─────────────────────────

const MODES: Array<{ value: TimerMode; label: string }> = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'countdown', label: 'Timer' },
  { value: 'stopwatch', label: 'Stopwatch' },
]
const MODE_MEMORY = 'tars.modeProfiles'

function rememberProfile(p: TimerProfile) {
  try {
    const map = JSON.parse(localStorage.getItem(MODE_MEMORY) ?? '{}') as Record<string, string>
    if (map[p.mode] === p.id) return
    localStorage.setItem(MODE_MEMORY, JSON.stringify({ ...map, [p.mode]: p.id }))
  } catch {
    /* storage unavailable */
  }
}

/** Switch timer mode: the profile last used in that mode, else the first one, else a built-in. */
async function switchMode(mode: TimerMode, profiles: TimerProfile[]) {
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
  // Apply straight away (no waiting for the settings write) so the dial changes with the tap.
  useTimer.getState().applyProfile(target)
  await updateSettings({ activeProfileId: target.id })
}

function ModeBar({ timer, profile, profiles }: { timer: TimerState; profile: TimerProfile | undefined; profiles: TimerProfile[] }) {
  const mode = timer.config.mode
  useEffect(() => {
    if (profile) rememberProfile(profile)
  }, [profile])
  return (
    <motion.div key="setup" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: T.base }} exit={{ opacity: 0, y: -6, transition: T.exit }} className="flex flex-col items-center gap-2.5">
      <div className="flex max-w-full items-center gap-2">
        <Segmented<TimerMode> size="sm" layoutId="mode-tabs" value={mode} onChange={(m) => void switchMode(m, profiles)} options={MODES} className="border border-line bg-surface-2" />
        <button
          type="button"
          onClick={() => useUi.getState().set({ profileOpen: true })}
          title={profile ? `${profile.name} – choose or edit timer profiles` : 'Timer profiles'}
          aria-label={`Timer profile: ${profile?.name ?? 'none'}. Change`}
          className="press inline-flex h-8 max-w-[8.5rem] min-w-0 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-bold text-ink-2 shadow-soft hover:border-line-strong hover:text-ink"
        >
          <span className="truncate">{profile?.name ?? 'Timer'}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
        </button>
      </div>
      <div className="flex h-8 items-center">
        {mode === 'pomodoro' ? (
          <Segmented<Phase>
            size="sm"
            layoutId="phase-tabs"
            value={timer.phase}
            onChange={(p) => useTimer.getState().selectPhase(p)}
            options={[
              { value: 'focus', label: `Focus ${Math.round(timer.config.focusMs / MINUTE)}m` },
              { value: 'shortBreak', label: `Break ${Math.round(timer.config.shortBreakMs / MINUTE)}m` },
              ...(timer.config.longBreakEvery > 0 ? [{ value: 'longBreak' as Phase, label: `Long ${Math.round(timer.config.longBreakMs / MINUTE)}m` }] : []),
            ]}
          />
        ) : (
          <p className="text-xs font-semibold text-ink-3">{mode === 'stopwatch' ? 'Counts up · a break sized to your focus follows' : `A single ${Math.round(timer.config.focusMs / MINUTE)}-minute block`}</p>
        )}
      </div>
    </motion.div>
  )
}

// ───────────────────────── timer ─────────────────────────

function TimerPanel() {
  const timer = useTimer((s) => s.timer)
  const { adjust } = useTimer.getState()
  const running = timer.status === 'running'
  const idle = timer.status === 'idle'
  const now = useNow(!idle)
  const settings = useSettings()
  const profiles = useProfiles()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const { label, labels } = useLookups()
  const task = useTask(timer.context.taskId)
  const [stopOpen, setStopOpen] = useState(false)

  const rem = remainingMs(timer, now)
  const el = elapsedMs(timer, now)
  const clock = rem === null ? formatClock(el / 1000) : formatClock(Math.ceil(rem / 1000))
  const l = label(timer.context.labelId)
  const color = phaseColor(timer.phase)
  const mode = timer.config.mode
  const every = mode === 'pomodoro' ? timer.config.longBreakEvery : 0

  const phaseLabel = mode === 'stopwatch' && timer.phase === 'focus' ? 'Stopwatch' : mode === 'countdown' && timer.phase === 'focus' ? 'Timer' : PHASE_LABEL[timer.phase]
  const round = every > 0 && timer.phase === 'focus' ? ` · ${(timer.cycleCount % every) + 1} of ${every}` : ''
  const status =
    timer.status === 'paused'
      ? 'Paused'
      : running
        ? rem !== null
          ? `Until ${formatTimeOfDay(now + rem, settings.use24h)}`
          : 'Open focus'
        : timer.phase === 'focus'
          ? 'Ready'
          : 'Break ready'

  const onStop = () => {
    const minMs = settings.minSessionSeconds * 1000
    if (timer.phase === 'focus' && el >= minMs) setStopOpen(true)
    else useTimer.getState().stop()
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col items-center justify-center pb-4 lg:min-h-0 lg:pb-6" aria-label="Timer">
      {/* Mode, profile and phase – fade away once you start. */}
      <div className="chrome-dim flex h-[76px] shrink-0 flex-col items-center justify-start">
        <AnimatePresence initial={false}>{idle && <ModeBar timer={timer} profile={profile} profiles={profiles} />}</AnimatePresence>
      </div>

      <div className="@container w-[clamp(220px,min(84vw,calc(100svh-440px)),440px)] shrink-0 lg:w-[clamp(240px,calc(100dvh-420px),480px)]">
        <TimerDial timer={timer}>
          <p className="mb-[1.5cqw] flex items-center gap-1.5 text-[clamp(10.5px,3cqw,13px)] font-bold tracking-[0.16em] uppercase" style={{ color }}>
            {phaseLabel}
            <span className="text-ink-3">{round}</span>
          </p>
          <span
            role="timer"
            aria-live="off"
            aria-label={`${clock} ${rem === null ? 'elapsed' : 'remaining'}`}
            className={cn('dial-digits timer-digits leading-none', clock.length > 5 ? 'text-[16.5cqw]' : 'text-[22cqw]')}
          >
            <TimeDigits text={clock} />
          </span>
          <div className="mt-[3cqw] flex h-5 items-center gap-2.5 text-[clamp(12px,3.3cqw,14px)] font-semibold">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status.startsWith('Until') ? 'until' : status}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0, transition: T.micro }}
                exit={{ opacity: 0, y: -3, transition: T.exit }}
                className={cn('tabular', timer.status === 'paused' ? 'rounded-full bg-surface-2 px-2 py-0.5 text-ink-2' : running ? 'text-ink-2' : '')}
                style={!running && timer.status !== 'paused' ? { color } : undefined}
              >
                {status}
              </motion.span>
            </AnimatePresence>
            {every > 0 && <CycleSlabs done={timer.cycleCount % every} total={every} color={color} />}
          </div>
        </TimerDial>
      </div>

      <button
        type="button"
        onClick={() => useUi.getState().set({ contextOpen: true })}
        className="press mt-3 flex h-10 max-w-full min-w-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        {l ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} /> : <Target className="size-4 shrink-0 text-ink-3" />}
        <span className="truncate">
          {l && <span className="text-ink">{labelPath(labels, l.id)}</span>}
          {l && (task || timer.context.note) && <span className="text-ink-3"> · </span>}
          {task ? task.title : timer.context.note ? timer.context.note : !l && 'What are you working on?'}
        </span>
      </button>

      <Controls timer={timer} onStop={onStop} />

      <div className="mt-2 flex h-8 shrink-0 items-center">
        {!idle && timer.targetMs !== null && (
          <button type="button" onClick={() => adjust(5 * MINUTE)} className="press rounded-full px-3 py-1.5 text-xs font-bold text-ink-3 hover:bg-surface-2 hover:text-ink">
            +5 min
          </button>
        )}
      </div>
      <div className="chrome-dim w-full">
        <ExpeditionStrip />
      </div>

      <Sheet
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="End this session?"
        size="sm"
        footer={
          <SheetActions stack>
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
              Discard and reset
            </Button>
            <Button block onClick={() => setStopOpen(false)}>
              Keep going
            </Button>
          </SheetActions>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-2">You’ve focused for {formatDuration(el / 1000)}. Save it to your history, or discard it and reset the timer.</p>
      </Sheet>
    </section>
  )
}

/** Four slabs to a cycle – the Tars mark, counting focus sessions before a long break. */
function CycleSlabs({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <span className="flex items-end gap-[3px]" aria-label={`${done} of ${total} sessions before a long break`} role="img">
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className="w-[5px] rounded-[2px]"
          initial={false}
          animate={{ height: i < done ? 12 : 8, backgroundColor: i < done ? color : 'var(--line-strong)' }}
          transition={T.item}
        />
      ))}
    </span>
  )
}

function Controls({ timer, onStop }: { timer: TimerState; onStop: () => void }) {
  const { start, pause, skip, adjust } = useTimer.getState()
  const idle = timer.status === 'idle'
  const running = timer.status === 'running'
  const adjustable = timer.targetMs !== null
  return (
    <div className="mt-4 flex shrink-0 items-start justify-center gap-5 sm:gap-7">
      {idle ? (
        <SideControl label="−5 min" hint="5 minutes less" disabled={!adjustable} onClick={() => adjust(-5 * MINUTE)}>
          <Minus className="size-5" />
        </SideControl>
      ) : (
        <SideControl label="Stop" hint="Stop the timer" onClick={onStop}>
          <Square className="size-[17px] fill-current" />
        </SideControl>
      )}
      <MainButton timer={timer} onClick={() => (running ? pause() : start())} />
      {idle ? (
        <SideControl label="+5 min" hint="5 minutes more" disabled={!adjustable} onClick={() => adjust(5 * MINUTE)}>
          <Plus className="size-5" />
        </SideControl>
      ) : (
        <SideControl label="Skip" hint={timer.phase === 'focus' ? 'Finish early and take a break' : 'Skip the break'} onClick={skip}>
          <SkipForward className="size-5 fill-current" />
        </SideControl>
      )}
    </div>
  )
}

function SideControl({ label, hint, onClick, disabled, children }: { label: string; hint: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex w-16 flex-col items-center gap-1.5 transition-opacity', disabled && 'pointer-events-none opacity-30')}>
      <motion.button
        type="button"
        aria-label={hint}
        title={hint}
        disabled={disabled}
        whileTap={{ scale: 0.9 }}
        whileHover={{ y: -1 }}
        transition={T.micro}
        onClick={() => {
          haptics.tap()
          onClick()
        }}
        className="flex size-14 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-soft transition-colors hover:border-line-strong hover:bg-surface-2"
      >
        {children}
      </motion.button>
      <span className="text-[11px] font-bold text-ink-3" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

/** Start / pause / resume: the one big control, with a ripple and a morphing icon. */
function MainButton({ timer, onClick }: { timer: TimerState; onClick: () => void }) {
  const running = timer.status === 'running'
  const idle = timer.status === 'idle'
  const color = phaseColor(timer.phase)
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const nextId = useRef(0)
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const id = nextId.current++
    setRipples((rs) => [...rs.slice(-2), { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== id)), 600)
  }
  const label = running ? 'Pause' : idle ? 'Start' : 'Resume'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        type="button"
        onPointerDown={onDown}
        onClick={onClick}
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.03 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        aria-label={running ? 'Pause' : idle ? `Start ${PHASE_LABEL[timer.phase].toLowerCase()}` : 'Resume'}
        aria-keyshortcuts="Space"
        data-state={timer.status}
        className="timer-main relative flex size-20 items-center justify-center rounded-full text-primary-ink shadow-lift transition-[background-color] duration-300"
        style={{ background: timer.phase === 'focus' ? 'var(--primary)' : color, '--timer-ring': color } as CSSProperties}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full">
          {ripples.map((r) => (
            <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
          ))}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={running ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.5, rotate: running ? -90 : 90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
            className="relative flex"
          >
            {running ? <Pause className="size-8 fill-current" strokeWidth={0} /> : <Play className="ml-1 size-8 fill-current" strokeWidth={0} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <span className="text-[11px] font-bold text-ink-2" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

// ───────────────────────── today ─────────────────────────

function ProgressStrip() {
  const p = useTodayProgress()
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Today" value={formatDuration(p.seconds)} sub={p.targetSeconds ? `of ${formatDuration(p.targetSeconds)}` : undefined}>
        {p.targetSeconds > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${Math.min(100, p.ratio * 100)}%` }} transition={{ duration: 0.7, ease: EASE_OUT }} />
          </div>
        )}
      </Stat>
      <Stat label="Streak" value={`${p.streak} ${p.streak === 1 ? 'day' : 'days'}`} sub={p.todayDone ? 'today counted' : p.streak ? 'study today to keep it' : 'start one today'} icon={<Flame className={cn('size-3.5', p.todayDone ? 'fill-current text-accent' : 'text-ink-3')} />}>
        <WeekDots />
      </Stat>
      <Stat label="Sessions" value={String(p.count)} sub="today" />
    </div>
  )
}

/** The last seven days at a glance: filled where you focused. */
function WeekDots() {
  const p = useTodayProgress()
  if (!p.week) return null
  return (
    <div className="mt-2 flex gap-1" role="img" aria-label={`Focused on ${p.week.filter(Boolean).length} of the last 7 days`}>
      {p.week.map((on, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', on ? 'bg-accent' : 'bg-surface-3', i === 6 && !on && 'bg-line-strong')} />
      ))}
    </div>
  )
}

function Stat({ label, value, sub, icon, children }: { label: string; value: string; sub?: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <Card className="min-w-0 px-3.5 py-3">
      <p className="flex items-center gap-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 truncate text-xl leading-tight font-semibold tracking-tight">{value}</p>
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
          <AnimatePresence initial={false}>
            {list.slice(0, limit).map((t) => (
              <motion.div key={t.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: T.base }} exit={{ opacity: 0, height: 0, transition: T.exit }}>
                <TaskItem task={t} project={project(t.projectId)} label={label(t.labelId)} sessions={counts.count(t.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
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
        <motion.div key="below" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', transition: T.layout }} exit={{ opacity: 0, height: 0, transition: T.exit }} className="space-y-6 overflow-hidden pt-2 pb-6">
          <ProgressStrip />
          <UpNext limit={4} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TodayPanel() {
  return (
    <aside className="chrome-dim scrollbar-thin -mr-2 space-y-6 overflow-y-auto overscroll-contain pt-[76px] pr-2 pb-6" aria-label="Today">
      <ProgressStrip />
      <UpNext limit={7} />
    </aside>
  )
}
