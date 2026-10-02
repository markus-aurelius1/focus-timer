/**
 * Focus: a study room, not a dashboard.
 *
 * A picture fills the stage, a very large clock sits in the middle of it, and
 * around the clock there is only what a session needs: the phase, what you are
 * working on, start / pause / stop, and one line to think about. Everything
 * else – sounds, the wallpaper, timer profiles, today's queue – is one press
 * away behind a small control, and recedes while a session runs.
 *
 * Immersive mode (F) is this same screen with the app's chrome put away and the
 * browser in full screen: nothing is swapped, so entering and leaving it is one
 * continuous move. The timer itself is untouched: this file only presents the
 * engine's state (timer/engine.ts) and sends it actions.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Headphones, Image as ImageIcon, ListTodo, Maximize2, Minimize2, Minus, Pause, Play, Plus, Quote, SkipForward, Square, Target } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { navigate } from '@/app/router'
import { chordPending, isTyping } from '@/app/shortcuts'
import { useUi } from '@/app/ui-store'
import { CommandButton } from '@/app/Workspace'
import { useAudio } from '@/audio/store'
import { useLookups, useOpenTasks, useProfiles, useSettings, useTask } from '@/data/hooks'
import type { Phase } from '@/data/types'
import { labelPath } from '@/features/shared/labels'
import { TodayLine } from '@/features/shared/TodayLine'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { TaskItem } from '@/features/tasks/TaskItem'
import { formatDuration, formatTimeOfDay, longDate, MINUTE, todayKey } from '@/lib/time'
import { useDay } from '@/lib/useDay'
import { byPriorityThenOrder, compareTasks, isOverdue, isToday } from '@/planner/tasks'
import { enterFullscreen, exitFullscreen, onFullscreenExit } from '@/services/fullscreen'
import { executeAction } from '@/tars/runtime'
import { useClockText } from '@/timer/clock'
import { useClockDescription } from '@/timer/ClockText'
import { elapsedMs, endsAt, type TimerState } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useProgressAnimation } from '@/timer/useProgressAnimation'
import { Button, Segmented } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { M, T } from '@/ui/motion'
import { Pressable, type PressableProps } from '@/ui/Pressable'
import { BottomSheet } from '@/ui/surface/BottomSheet'
import { anyModalOpen } from '@/ui/surface/core'
import { Popover } from '@/ui/surface/Popover'
import { Tooltip } from '@/ui/surface/Tooltip'
import { useIsWide } from '@/ui/useMedia'
import { useAmbience } from './ambience'
import { Backdrop, useQuote, useWallpaperId } from './Backdrop'
import { ExpeditionStrip } from './ExpeditionStrip'
import './focus.css'
import { phaseColor } from './phase'
import { SessionCompleteCard, useLastSession } from './SessionComplete'
import { TimeDigits } from './TimeDigits'
import { WallpaperPicker } from './WallpaperPicker'

const toggleTimer = () => {
  const status = useTimer.getState().timer.status
  void executeAction(status === 'running' ? 'timer.pause' : status === 'paused' ? 'timer.resume' : 'timer.start', {})
}
const setImmersive = (on: boolean) => {
  useUi.getState().set({ immersive: on })
  void (on ? enterFullscreen() : exitFullscreen())
}

export function FocusScreen() {
  const timer = useTimer((s) => s.timer)
  const immersive = useUi((s) => s.immersive)
  const wallpaper = useWallpaperId()
  const wide = useIsWide()
  const view = useLastSession()
  const moment = useCompletionMoment(timer.phase)
  const hidden = useImmersive(immersive)
  useFocusShortcuts()

  const running = timer.status === 'running'
  const quiet = running && timer.phase === 'focus'
  // The "how did it go?" card takes the clock's place in the window; on a phone it is a low sheet over the stage.
  const card = view && wide

  return (
    <div className="focus-stage" data-wallpaper={wallpaper ? '' : undefined} data-state={timer.status} data-quiet={quiet ? '' : undefined} data-hidden={hidden ? '' : undefined} data-immersive={immersive ? '' : undefined} style={{ '--phase': phaseColor(timer.phase) } as React.CSSProperties}>
      <Backdrop id={wallpaper} />
      <TopBar timer={timer} immersive={immersive} hidden={hidden} wallpaper={wallpaper} />

      <main className="focus-center" aria-label="Timer">
        <AnimatePresence initial={false} mode="popLayout">
          {card ? (
            <motion.div key="card" role="dialog" aria-label={view.session.completed ? 'Session complete' : 'Session saved'} className="focus-card scrollbar-thin max-h-full overflow-y-auto" {...M.dialog}>
              <SessionCompleteCard view={view} compact />
            </motion.div>
          ) : (
            <motion.div key="clock" className="flex w-full flex-col items-center" {...M.swap}>
              <PhasePicker timer={timer} hidden={hidden} />
              {moment ? <Moment phase={moment.phase} /> : <Clock timer={timer} />}
              <ContextButton timer={timer} hidden={hidden} />
              <Controls timer={timer} />
              <div className="focus-recede w-full" inert={hidden}>
                <ExpeditionStrip />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomBar hidden={hidden} />

      {/* On a phone the card is a sheet that leaves the clock and the tab bar in reach. */}
      {!wide && (
        <BottomSheet open={!!view} onClose={() => view?.close()} modal={false} dismissible detents={[0.46, 'auto']} bare label={view?.session.completed === false ? 'Session saved' : 'Session complete'}>
          {view && <SessionCompleteCard view={view} compact />}
        </BottomSheet>
      )}
    </div>
  )
}

// ───────────────────────── chrome ─────────────────────────

type StageButtonProps = { label: string; shortcut?: string; shape?: 'icon' | 'pill'; active?: boolean; tip?: 'top' | 'bottom'; children: ReactNode } & Omit<Extract<PressableProps, { href?: undefined }>, 'children'>

/** A control that sits on the picture: quiet until wanted, named by a tooltip. */
const StageButton = forwardRef<HTMLButtonElement, StageButtonProps>(function StageButton({ label, shortcut, shape = 'icon', active, children, tip = 'bottom', ...rest }, ref) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tip}>
      <Pressable ref={ref as never} aria-label={shortcut ? `${label} (${shortcut})` : label} className="focus-ctl" data-shape={shape} data-active={active ? '' : undefined} {...rest}>
        {children}
      </Pressable>
    </Tooltip>
  )
})

function TopBar({ timer, immersive, hidden, wallpaper }: { timer: TimerState; immersive: boolean; hidden: boolean; wallpaper: string | null }) {
  const soundPlaying = useAudio((s) => s.playing)
  const today = useDay()
  const [picker, setPicker] = useState(false)
  const [queue, setQueue] = useState(false)
  const pickerAnchor = useRef<HTMLButtonElement>(null)
  const queueAnchor = useRef<HTMLButtonElement>(null)
  const status = timer.status
  return (
    <header className="focus-bar focus-recede pt-safe" inert={hidden}>
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="t-title">Focus</h1>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p key={status} {...M.swap} className="truncate text-[12.5px] font-medium" style={{ color: 'var(--focus-ink-3)' }}>
            {status === 'idle' ? longDate(today) : status === 'paused' ? 'Taking a pause' : 'In session'}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <StageButton label="Sounds" shortcut="S" active={soundPlaying} onClick={() => useUi.getState().set({ soundOpen: true })}>
          <Headphones className="size-[19px]" />
          {soundPlaying && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}
        </StageButton>
        <StageButton ref={pickerAnchor} label="Wallpaper" active={picker} aria-expanded={picker} onClick={() => setPicker((o) => !o)}>
          <ImageIcon className="size-[19px]" />
        </StageButton>
        <StageButton ref={queueAnchor} label="Up next" active={queue} aria-expanded={queue} onClick={() => setQueue((o) => !o)}>
          <ListTodo className="size-[19px]" />
        </StageButton>
        <StageButton label={immersive ? 'Exit immersive mode' : 'Immersive mode'} shortcut={immersive ? 'Esc' : 'F'} onClick={() => setImmersive(!immersive)}>
          {immersive ? <Minimize2 className="size-[19px]" /> : <Maximize2 className="size-[19px]" />}
        </StageButton>
        {!immersive && <CommandButton className="focus-ctl -mr-2" />}
      </div>
      <WallpaperPicker open={picker} onClose={() => setPicker(false)} anchor={pickerAnchor} current={wallpaper} />
      <UpNextPopover open={queue} onClose={() => setQueue(false)} anchor={queueAnchor} />
    </header>
  )
}

function BottomBar({ hidden }: { hidden: boolean }) {
  const quote = useQuote()
  const a = useAmbience()
  return (
    <footer className="focus-bar focus-recede pb-3" inert={hidden}>
      <div className="flex w-10 shrink-0 justify-start">
        {!a.plain && (
          <StageButton label="Previous wallpaper" tip="top" onClick={() => void a.previous()}>
            <ChevronLeft className="size-[18px]" />
          </StageButton>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {quote && (
            <motion.p key={quote} className="focus-quote" {...M.swap}>
              {quote}
            </motion.p>
          )}
        </AnimatePresence>
        {quote && (
          <StageButton label="Another line" tip="top" onClick={a.nextQuote} className="focus-ctl max-sm:hidden">
            <Quote className="size-4" />
          </StageButton>
        )}
      </div>
      <div className="flex w-10 shrink-0 justify-end">
        {!a.plain && (
          <StageButton label="Next wallpaper" tip="top" onClick={() => void a.next()}>
            <ChevronRight className="size-[18px]" />
          </StageButton>
        )}
      </div>
    </footer>
  )
}

// ───────────────────────── the clock ─────────────────────────

/** Focus · Short break · Long break, while a Pomodoro timer is idle; otherwise a line saying what the timer is. */
function PhasePicker({ timer, hidden }: { timer: TimerState; hidden: boolean }) {
  const idle = timer.status === 'idle'
  const mode = timer.config.mode
  const every = mode === 'pomodoro' ? timer.config.longBreakEvery : 0
  const phaseLabel = mode === 'stopwatch' && timer.phase === 'focus' ? 'Stopwatch' : mode === 'countdown' && timer.phase === 'focus' ? 'Timer' : PHASE_LABEL[timer.phase]
  const round = every > 0 && timer.phase === 'focus' ? `${(timer.cycleCount % every) + 1} of ${every}` : ''
  if (idle && mode === 'pomodoro')
    return (
      <div className="focus-recede" inert={hidden}>
        <Segmented<Phase>
          layoutId="phase-tabs"
          label="Phase"
          value={timer.phase}
          onChange={(p) => useTimer.getState().selectPhase(p)}
          options={[
            { value: 'focus', label: 'Focus' },
            { value: 'shortBreak', label: 'Short break' },
            ...(timer.config.longBreakEvery > 0 ? [{ value: 'longBreak' as Phase, label: 'Long break' }] : []),
          ]}
        />
      </div>
    )
  return (
    <p className="focus-phase flex h-9 items-center">
      {phaseLabel}
      {round && <span>· {round}</span>}
    </p>
  )
}

function Clock({ timer }: { timer: TimerState }) {
  const settings = useSettings()
  const bar = useRef<HTMLDivElement>(null)
  useProgressAnimation(timer, () => [{ el: bar.current, at: (p) => `scaleX(${p})` }])
  const running = timer.status === 'running'
  const every = timer.config.mode === 'pomodoro' ? timer.config.longBreakEvery : 0
  const end = timer.targetMs === null ? null : endsAt(timer)
  const status = timer.status === 'paused' ? 'Paused' : running ? (end !== null ? `Until ${formatTimeOfDay(end, settings.use24h)}` : 'Open focus') : timer.phase === 'focus' ? 'Ready' : 'Break ready'
  return (
    <>
      <Digits />
      <div className="focus-progress" aria-hidden="true">
        <div ref={bar} />
      </div>
      <div className="focus-status">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={status.startsWith('Until') ? 'until' : status} className="tabular" {...M.swap}>
            {status}
          </motion.span>
        </AnimatePresence>
        {every > 0 && <CycleSlabs done={timer.cycleCount % every} total={every} />}
      </div>
    </>
  )
}

/** The digits: the one part of the screen that renders every second. */
function Digits() {
  const clock = useClockText()
  const description = useClockDescription()
  return (
    <span role="timer" aria-live="off" aria-label={description} className="focus-digits timer-digits" data-long={clock.length > 5 ? '' : undefined}>
      <TimeDigits text={clock} />
    </span>
  )
}

/** Four slabs to a cycle – the Tars mark, counting focus sessions before a long break. */
function CycleSlabs({ done, total }: { done: number; total: number }) {
  return (
    <span className="focus-slabs" aria-label={`${done} of ${total} sessions before a long break`} role="img">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-on={i < done ? '' : undefined} />
      ))}
    </span>
  )
}

/** The completion moment: a phase has just run its course. */
function Moment({ phase }: { phase: Phase }) {
  return (
    <motion.div className="flex min-h-44 flex-col items-center justify-center" role="status" {...M.success}>
      <span className="flex size-16 items-center justify-center rounded-full" style={{ background: 'var(--focus-main)', color: 'var(--focus-main-ink)' }}>
        <Check className="size-8" strokeWidth={3} />
      </span>
      <span className="t-display-m mt-4">{phase === 'focus' ? 'Focus complete' : 'Break’s over'}</span>
      <span className="t-label mt-1" style={{ color: 'var(--focus-ink-2)' }}>
        {phase === 'focus' ? 'Nicely done.' : 'Ready when you are.'}
      </span>
    </motion.div>
  )
}

/** Shown for a few seconds after a phase completes on its own. */
function useCompletionMoment(phase: Phase) {
  const ended = useTimer((s) => s.phaseEnded)
  const [moment, setMoment] = useState<{ phase: Phase; at: number } | null>(null)
  useEffect(() => {
    if (!ended || !ended.completed || Date.now() - ended.at > 4000) return
    setMoment({ phase: ended.phase, at: ended.at })
    const t = setTimeout(() => setMoment(null), 2600)
    return () => clearTimeout(t)
  }, [ended])
  // Starting the next phase ends the moment early.
  useEffect(() => {
    if (moment && phase !== moment.phase && useTimer.getState().timer.status === 'running') {
      const t = setTimeout(() => setMoment(null), 1200)
      return () => clearTimeout(t)
    }
  }, [phase, moment])
  return moment
}

// ───────────────────────── what, and the controls ─────────────────────────

function ContextButton({ timer, hidden }: { timer: TimerState; hidden: boolean }) {
  const { label, labels } = useLookups()
  const task = useTask(timer.context.taskId)
  const l = label(timer.context.labelId)
  return (
    <div className="focus-recede mt-3 max-w-full" inert={hidden}>
      <Pressable onClick={() => useUi.getState().set({ contextOpen: true })} className="focus-ctl" data-shape="pill">
        {l ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} /> : <Target className="size-4 shrink-0" />}
        <span className="t-text truncate">
          {l && <span style={{ color: 'var(--focus-ink)' }}>{labelPath(labels, l.id)}</span>}
          {l && (task || timer.context.note) && ' · '}
          {task ? task.title : timer.context.note ? timer.context.note : !l && 'What are you working on?'}
        </span>
      </Pressable>
    </div>
  )
}

function Controls({ timer }: { timer: TimerState }) {
  const settings = useSettings()
  const profiles = useProfiles()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const { skip, adjust } = useTimer.getState()
  const idle = timer.status === 'idle'
  const running = timer.status === 'running'
  const adjustable = timer.targetMs !== null
  /** Stop was pressed on a session long enough to keep: the controls become the choice (no dialog). Holds the focused time, ms. */
  const [stopping, setStopping] = useState<number | null>(null)
  useEffect(() => {
    if (idle) setStopping(null)
  }, [idle])

  const onStop = () => {
    const el = elapsedMs(timer, Date.now())
    if (timer.phase === 'focus' && el >= settings.minSessionSeconds * 1000) setStopping(el)
    else void executeAction('timer.stop', {})
  }

  if (stopping !== null)
    return (
      <motion.div className="mt-6 flex w-full max-w-sm flex-col items-center gap-2" role="group" aria-label="End this session?" {...M.reveal}>
        <p className="t-text mb-1" style={{ color: 'var(--focus-ink-2)' }}>
          You’ve focused for {formatDuration(stopping / 1000)}.
        </p>
        <Pressable className="focus-main w-full" data-autofocus onClick={() => void executeAction('timer.stop', {})}>
          Save {formatDuration(stopping / 1000)} and stop
        </Pressable>
        <div className="flex w-full gap-2">
          <Pressable className="focus-ctl flex-1" data-shape="pill" onClick={() => void executeAction('timer.stop', { discard: true })}>
            Discard and reset
          </Pressable>
          <Pressable className="focus-ctl flex-1" data-shape="pill" onClick={() => setStopping(null)}>
            Keep going
          </Pressable>
        </div>
      </motion.div>
    )

  return (
    <>
      <div className="focus-controls">
        {idle ? (
          <SideControl label="5 minutes less" disabled={!adjustable} onClick={() => adjust(-5 * MINUTE)}>
            <Minus className="size-5" />
          </SideControl>
        ) : (
          <SideControl label="Stop the timer" onClick={onStop}>
            <Square className="size-4 fill-current" />
          </SideControl>
        )}
        <Tooltip label={running ? 'Pause' : idle ? 'Start' : 'Resume'} shortcut="Space" side="top">
          <Pressable
            className="focus-main"
            haptic="press"
            aria-label={running ? 'Pause' : idle ? `Start ${PHASE_LABEL[timer.phase].toLowerCase()}` : 'Resume'}
            aria-keyshortcuts="Space"
            data-phase={timer.phase === 'focus' ? 'focus' : 'break'}
            onClick={toggleTimer}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={running ? 'pause' : 'play'} className="flex" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, transition: T.base }} exit={{ opacity: 0, scale: 0.6, transition: T.exit }}>
                {running ? <Pause className="size-5 fill-current" strokeWidth={0} /> : <Play className="size-5 fill-current" strokeWidth={0} />}
              </motion.span>
            </AnimatePresence>
            {running ? 'Pause' : idle ? 'Start' : 'Resume'}
          </Pressable>
        </Tooltip>
        {idle ? (
          <SideControl label="5 minutes more" disabled={!adjustable} onClick={() => adjust(5 * MINUTE)}>
            <Plus className="size-5" />
          </SideControl>
        ) : (
          <SideControl label={timer.phase === 'focus' ? 'Finish early and take a break' : 'Skip the break'} onClick={skip}>
            <SkipForward className="size-5 fill-current" />
          </SideControl>
        )}
      </div>
      <div className="focus-recede mt-3 flex h-9 items-center justify-center gap-2">
        {idle ? (
          <Pressable className="focus-ctl" data-shape="pill" aria-label={`Timer profile: ${profile?.name ?? 'none'}. Change`} onClick={() => useUi.getState().set({ profileOpen: true })}>
            <span className="truncate">{profile?.name ?? 'Timer'}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </Pressable>
        ) : (
          adjustable && (
            <Pressable className="focus-ctl" data-shape="pill" onClick={() => adjust(5 * MINUTE)}>
              +5 min
            </Pressable>
          )
        )}
      </div>
    </>
  )
}

function SideControl({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip label={label} side="top">
      <Pressable aria-label={label} disabled={disabled} className="focus-side" onClick={onClick}>
        {children}
      </Pressable>
    </Tooltip>
  )
}

// ───────────────────────── today's queue ─────────────────────────

function UpNextPopover({ open, onClose, anchor }: { open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null> }) {
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} label="Up next" align="end" width={380} sheet={{ title: 'Up next' }} className="p-4">
      <div className="space-y-6">
        <TodayLine />
        <UpNext limit={6} onNavigate={onClose} />
      </div>
    </Popover>
  )
}

/** What's planned for today, startable from here: rows, no cards. */
function UpNext({ limit, onNavigate }: { limit: number; onNavigate: () => void }) {
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
  const openPlan = () => {
    onNavigate()
    navigate('#/tasks')
  }

  return (
    <section>
      <div className="mb-1 flex min-h-8 items-center justify-between px-1">
        <h2 className="t-label">Up next</h2>
        <Button size="sm" variant="ghost" onClick={openPlan}>
          Plan <ChevronRight className="size-3.5" />
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState
          title="A clear day"
          body="Plan a few tasks for today and start them from here."
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onNavigate()
                useUi.getState().newTask({ plannedFor: today })
              }}
            >
              Plan a task
            </Button>
          }
          className="py-7"
        />
      ) : (
        <div className="-mx-2">
          {list.slice(0, limit).map((t) => (
            <TaskItem key={t.id} task={t} project={project(t.projectId)} label={label(t.labelId)} sessions={counts.count(t.id)} />
          ))}
          {list.length > limit && (
            <Button size="sm" variant="ghost" className="mx-2 mt-0.5" onClick={openPlan}>
              {list.length - limit} more for today
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

// ───────────────────────── keys and immersive mode ─────────────────────────

/** Space: start/pause · F: immersive · S: sounds (ignored while typing or with a dialog open). */
function useFocusShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target) || el?.closest('[role="dialog"]') || chordPending() || anyModalOpen()) return
      const ui = useUi.getState()
      if (e.code === 'Space') {
        // A focused control handles Space itself.
        if (el?.closest('button, a, [role="tab"], [role="radio"]')) return
        e.preventDefault()
        toggleTimer()
      } else if (e.key === 'f') setImmersive(!ui.immersive)
      else if (e.key === 's') ui.set({ soundOpen: true })
      else if (e.key === 'Escape' && ui.immersive) setImmersive(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * Immersive mode: follows the browser's own full screen (leaving it leaves
 * immersive too), ends when the screen is left, and after a few still seconds
 * puts the controls away. Returns whether they are away.
 */
function useImmersive(immersive: boolean): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!immersive) {
      setHidden(false)
      return
    }
    const off = onFullscreenExit(() => useUi.getState().set({ immersive: false }))
    let timer: ReturnType<typeof setTimeout>
    const poke = () => {
      setHidden(false)
      clearTimeout(timer)
      timer = setTimeout(() => setHidden(true), 3500)
    }
    poke()
    window.addEventListener('pointermove', poke)
    window.addEventListener('pointerdown', poke)
    window.addEventListener('keydown', poke)
    return () => {
      off()
      clearTimeout(timer)
      window.removeEventListener('pointermove', poke)
      window.removeEventListener('pointerdown', poke)
      window.removeEventListener('keydown', poke)
    }
  }, [immersive])
  // Leaving the Focus screen always brings the app's chrome back.
  useEffect(
    () => () => {
      if (useUi.getState().immersive) setImmersive(false)
    },
    [],
  )
  return hidden
}
