/**
 * Home answers one question: what should I do right now? One dominant action
 * (the running session, or the next thing planned), then the rest of today and
 * the places to pick up where you left off. Progress is a quiet line here –
 * the analytics live in Insights.
 */
import { ArrowRight, ChartNoAxesColumn, ChevronRight, Map as MapIcon, Newspaper, Pause, Play, Plus, Settings2, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { navigate } from '@/app/router'
import { toggleTimer } from '@/app/shortcuts'
import { useUi } from '@/app/ui-store'
import { CommandButton, HEADER_COLUMN, workspaceColumn } from '@/app/Workspace'
import { CA_STATE_KEY, readPersonalState } from '@/current-affairs/personal-state'
import { useLookups, useOpenTasks, useProfiles, useSettings, useTask } from '@/data/hooks'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { addDaysKey, dayKey, formatDuration, formatTimeOfDay, greeting, longDate, MINUTE } from '@/lib/time'
import { useDay } from '@/lib/useDay'
import { byPriorityThenOrder, compareTasks, isOverdue, isToday } from '@/planner/tasks'
import { executeAction } from '@/tars/runtime'
import { useTarsContext } from '@/tars/useContext'
import { ClockText, useClockDescription } from '@/timer/ClockText'
import { endsAt } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useProgressAnimation } from '@/timer/useProgressAnimation'
import { Button, IconButton } from '@/ui/controls'
import { useExploration } from '@/atlas/useExploration'
import { expeditionStatus } from '@/features/atlas/AtlasPanel'
import { phaseColor } from '@/features/focus/phase'
import { profileSummary } from '@/features/focus/profileSummary'
import { labelPath } from '@/features/shared/labels'
import { TodayLine } from '@/features/shared/TodayLine'
import { useTodayProgress } from '@/features/shared/useProgress'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { useStickyNotes } from '@/features/notes/useStickyNotes'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskItem } from '@/features/tasks/TaskItem'

const step = (i: number) => ({ '--i': i }) as CSSProperties

export function HomeScreen() {
  const today = useDay()
  const context = useTarsContext()
  const progress = useTodayProgress()
  const tasks = useOpenTasks()
  const activeTaskId = useTimer((s) => s.timer.context.taskId)
  const idle = useTimer((s) => s.timer.status === 'idle')

  // Today first, then what slipped – the order the Focus screen and the palette use.
  const plan = useMemo(() => {
    const todays = tasks.filter((t) => isToday(t, today)).sort(compareTasks)
    const overdue = tasks.filter((t) => isOverdue(t, today)).sort(byPriorityThenOrder)
    return [...todays, ...overdue]
  }, [tasks, today])
  const next = idle ? plan.find((t) => t.id !== activeTaskId) : undefined
  const rest = plan.filter((t) => t.id !== next?.id && t.id !== activeTaskId)

  const summary = [
    plan.length ? `${plan.length} ${plan.length === 1 ? 'task' : 'tasks'} planned` : 'Nothing planned yet',
    progress.seconds > 0 ? `${formatDuration(progress.seconds)} focused` : null,
    context.dueReviews.length ? `${context.dueReviews.length} Atlas ${context.dueReviews.length === 1 ? 'review' : 'reviews'} due` : null,
  ].filter(Boolean)

  return (
    <div>
      {/* The header row sits where every workspace's does (app/Workspace.tsx); the page beneath has its own reading width. */}
      <header className="pt-safe">
        <div className={cn(HEADER_COLUMN, 'flex h-14 items-center justify-between gap-3 max-md:max-w-none')}>
          <p className="t-meta truncate">{longDate(today)}</p>
          <div className="flex shrink-0 items-center gap-0.5 md:hidden">
            <IconButton label="Quick capture" onClick={() => useUi.getState().set({ captureOpen: true })}>
              <Plus className="size-5" />
            </IconButton>
            <IconButton label="Settings" onClick={() => navigate('#/settings')}>
              <Settings2 className="size-5" />
            </IconButton>
            <CommandButton className="-mr-2" />
          </div>
        </div>
      </header>

      <div className={cn(workspaceColumn('lg'), 'pb-4')}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pt-3 sm:pt-8">
        <div className="settle min-w-0" style={step(0)}>
          <h1 className="t-display">{greeting()}</h1>
          <p className="t-body mt-2 text-ink-2">{summary.join(' · ')}</p>
        </div>
        <TodayLine className="settle hidden w-60 shrink-0 pb-1 sm:block" style={step(1)} />
      </div>

      <Now next={next} className="settle mt-7 sm:mt-9" style={step(1)} />

      <TodayLine className="settle mt-6 sm:hidden" style={step(2)} />

      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="settle min-w-0" style={step(2)} aria-labelledby="home-today">
          <SectionHead id="home-today" title={next ? 'Then' : 'Today'} meta={rest.length ? `${rest.length} ${next ? 'more' : 'planned'}` : undefined} action="Plan" onAction={() => navigate('#/tasks')} />
          {rest.length > 0 && <TaskRows tasks={rest} />}
          {rest.length === 0 && <p className="t-meta px-1 pb-3">{plan.length ? 'Nothing else is planned for today.' : 'A clear day. Add what you want to get done.'}</p>}
          <QuickAdd defaults={{ plannedFor: today }} placeholder="Add a task for today" />
        </section>

        <section className="settle min-w-0" style={step(3)} aria-labelledby="home-continue">
          <SectionHead id="home-continue" title="Pick up" />
          <Continue due={context.dueReviews.length} />
        </section>
      </div>
      </div>
    </div>
  )
}

function SectionHead({ id, title, meta, action, onAction }: { id: string; title: string; meta?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-1.5 flex min-h-8 items-center justify-between gap-3 px-1">
      <h2 id={id} className="t-label flex items-baseline gap-2">
        {title}
        {meta && <span className="t-meta">{meta}</span>}
      </h2>
      {action && (
        <button type="button" onClick={onAction} className="press -mr-1 flex items-center gap-0.5 rounded-full px-2 py-1 text-[12.5px] font-bold text-ink-3 hover:bg-surface-2 hover:text-ink">
          {action} <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ───────────────────────── now ─────────────────────────

/**
 * The one raised surface on the page. A running or paused session owns it;
 * otherwise it offers the next planned task, or simply a session.
 */
function Now({ next, className, style }: { next: Task | undefined; className?: string; style?: CSSProperties }) {
  const timer = useTimer((s) => s.timer)
  const active = timer.status !== 'idle'
  return (
    <section className={cn('rounded-[22px] bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--line),var(--shadow-soft-value)] sm:px-7 sm:py-6', className)} style={style} aria-label={active ? 'Current session' : 'Next action'}>
      {active ? <NowSession /> : <NowIdle next={next} />}
    </section>
  )
}

function NowSession() {
  const timer = useTimer((s) => s.timer)
  const settings = useSettings()
  const { label, labels } = useLookups()
  const task = useTask(timer.context.taskId)
  const l = label(timer.context.labelId)
  const running = timer.status === 'running'
  const color = phaseColor(timer.phase)
  const total = timer.targetMs
  const end = total === null ? null : endsAt(timer)
  const title = task?.title ?? (l ? labelPath(labels, l.id) : timer.context.note || (timer.phase === 'focus' ? 'Focus session' : PHASE_LABEL[timer.phase]))
  const state = timer.status === 'paused' ? 'Paused' : end !== null ? `Until ${formatTimeOfDay(end, settings.use24h)}` : 'Open focus'
  // The bar is a compositor animation and the digits a leaf: this surface renders when the session changes, not every second.
  const bar = useRef<HTMLDivElement>(null)
  useProgressAnimation(timer, () => [{ el: bar.current, at: (p) => `scaleX(${p})` }])

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color }}>
          <span className={cn('size-2 rounded-full', running && 'animate-pulse')} style={{ background: color }} />
          {PHASE_LABEL[timer.phase]}
          <span className="font-semibold text-ink-3">· {state}</span>
        </p>
        <p className="mt-2 truncate text-[19px] leading-snug font-bold tracking-tight">{title}</p>
        {task && l && <p className="t-meta mt-0.5 truncate">{labelPath(labels, l.id)}</p>}
      </div>
      {/* The clock sits beside the title in the window and between title and controls on a phone. */}
      <div className="sm:row-span-2 sm:justify-self-end">
        <NowClock />
        {total !== null && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            <div ref={bar} className="h-full origin-left rounded-full" style={{ background: color, transform: 'scaleX(0)', opacity: running ? 1 : 0.45 }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" variant="primary" icon={running ? <Pause className="size-4 fill-current" strokeWidth={0} /> : <Play className="size-4 fill-current" strokeWidth={0} />} onClick={toggleTimer}>
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => navigate('#/focus')}>
          Open focus <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function NowClock() {
  return (
    <p className="timer-digits text-[clamp(48px,13vw,64px)] leading-none" aria-label={useClockDescription()}>
      <ClockText />
    </p>
  )
}

function NowIdle({ next }: { next: Task | undefined }) {
  const today = useDay()
  const settings = useSettings()
  const profiles = useProfiles()
  const { project, label, labels } = useLookups()
  const counts = useTaskSessions()
  const timer = useTimer((s) => s.timer)
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const minutes = Math.round(timer.config.focusMs / MINUTE)
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (busy) return
    setBusy(true)
    await executeAction('timer.start', next ? { taskId: next.id } : {})
    setBusy(false)
  }

  if (!next) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="t-label text-ink-3">Ready when you are</p>
          <p className="mt-1.5 text-[19px] leading-snug font-bold tracking-tight">Start a focus session</p>
          {profile && <p className="t-meta mt-0.5">{profileSummary(profile)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" variant="primary" icon={<Play className="size-4 fill-current" strokeWidth={0} />} onClick={() => void start()} loading={busy}>
            Start focus
          </Button>
          <Button size="lg" variant="ghost" onClick={() => useUi.getState().newTask({ plannedFor: today })}>
            Plan a task
          </Button>
        </div>
      </div>
    )
  }

  const l = label(next.labelId)
  const p = project(next.projectId)
  const left = Math.max(0, next.estimatedPomodoros - counts.count(next.id))
  const overdue = isOverdue(next, today)
  const meta = [l ? labelPath(labels, l.id) : p?.name, left > 0 ? `${left} ${left === 1 ? 'session' : 'sessions'} · about ${formatDuration(left * minutes * 60)}` : null].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
      <button type="button" onClick={() => useUi.getState().openTask(next.id)} className="min-w-0 flex-1 basis-64 rounded-xl text-left" aria-label={`Open “${next.title}”`}>
        <p className={cn('t-label', overdue ? 'text-danger' : 'text-ink-3')}>{overdue ? 'Carried over' : 'Next up'}</p>
        <p className="mt-1.5 text-[19px] leading-snug font-bold tracking-tight break-words sm:text-[21px]">{next.title}</p>
        {meta.length > 0 && (
          <p className="t-meta mt-1 flex items-center gap-1.5">
            {l && <span className="size-2 shrink-0 rounded-[3px]" style={{ background: l.color }} />}
            <span className="truncate">{meta.join(' · ')}</span>
          </p>
        )}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" variant="primary" icon={<Play className="size-4 fill-current" strokeWidth={0} />} onClick={() => void start()} loading={busy}>
          Start focus
        </Button>
        <Button size="lg" variant="ghost" onClick={() => navigate('#/focus')}>
          Timer only
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────── today ─────────────────────────

function TaskRows({ tasks, limit = 5 }: { tasks: Task[]; limit?: number }) {
  const { project, label } = useLookups()
  const counts = useTaskSessions()
  return (
    <div className="-mx-2 mb-2">
      {tasks.slice(0, limit).map((t) => (
        <TaskItem key={t.id} task={t} project={project(t.projectId)} label={label(t.labelId)} sessions={counts.count(t.id)} />
      ))}
      {tasks.length > limit && (
        <button type="button" onClick={() => navigate('#/tasks')} className="press mx-2 mt-0.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-ink-3 hover:bg-surface-2 hover:text-ink">
          {tasks.length - limit} more in Plan
        </button>
      )}
    </div>
  )
}

// ───────────────────────── pick up ─────────────────────────

/** Reading progress is personal state in localStorage; counting it never needs the feeds. */
function useReadingToday() {
  const today = useDay()
  const [counts, setCounts] = useState({ read: 0, saved: 0 })
  useEffect(() => {
    const load = () => {
      try {
        const entries = Object.values(readPersonalState(localStorage).entries).filter((e) => !e.ignoredAt)
        setCounts({ read: entries.filter((e) => e.readAt && dayKey(e.readAt) === today).length, saved: entries.filter((e) => e.savedAt).length })
      } catch {
        /* unreadable state is surfaced on the Current Affairs screen itself */
      }
    }
    const changed = (e: StorageEvent) => {
      if (e.key === CA_STATE_KEY || e.key === null) load()
    }
    load()
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [today])
  return counts
}

function Continue({ due }: { due: number }) {
  const today = useDay()
  const ex = useExploration(false)
  const reading = useReadingToday()
  const { notes } = useStickyNotes()
  const p = useTodayProgress()
  const weekSeconds = useMemo(() => {
    const from = addDaysKey(today, -6)
    return p.sessions.filter((s) => s.date >= from).reduce((a, s) => a + s.duration, 0)
  }, [p.sessions, today])

  const status = ex ? expeditionStatus(ex) : null
  const readingLine = [reading.read ? `${reading.read} read today` : 'Today’s reading list', reading.saved ? `${reading.saved} saved` : null].filter(Boolean).join(' · ')
  const atlasLine = due ? `${due} ${due === 1 ? 'place' : 'places'} due for review` : status ? [status.title, status.line].filter(Boolean).join(' · ') : 'Explore India and the world'
  const latest = notes[0]

  return (
    <div className="-mx-2 flex flex-col">
      <PickUp icon={<Newspaper />} title="Current Affairs" line={readingLine} onClick={() => navigate('#/current-affairs')} />
      <PickUp icon={<MapIcon />} title="Atlas" line={atlasLine} accent={due > 0} onClick={() => (due ? void executeAction('review.startDue', {}) : navigate('#/atlas'))} />
      <PickUp icon={<StickyNote />} title="Notes" line={latest ? latest.text : 'Capture a thought worth keeping'} onClick={() => navigate('#/notes')} />
      <PickUp icon={<ChartNoAxesColumn />} title="Insights" line={weekSeconds ? `${formatDuration(weekSeconds)} focused in the last 7 days` : 'Your focus history and patterns'} onClick={() => navigate('#/insights')} />
    </div>
  )
}

function PickUp({ icon, title, line, accent, onClick }: { icon: ReactNode; title: string; line: string; accent?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="row group px-2 py-2.5 text-left">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px] [&>svg]:size-[18px]', accent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] leading-snug font-semibold">{title}</span>
        <span className={cn('block truncate text-[13px] leading-snug', accent ? 'font-semibold text-accent' : 'text-ink-2')}>{line}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  )
}
