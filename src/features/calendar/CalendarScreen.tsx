import { executeAction } from '@/tars/runtime'
import { ChevronLeft, ChevronRight, GraduationCap, Play, Plus, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate, useRoute } from '@/app/router'
import { useUi } from '@/app/ui-store'
import { useEvents, useLabels, useLookups, useSessionsBetween, useSettings, useTasks } from '@/data/hooks'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { useDay } from '@/lib/useDay'
import {
  addDaysKey,
  addMonthsKey,
  dayKey,
  daysInRange,
  endOfMonthKey,
  formatDuration,
  formatHourLabel,
  isDayKey,
  minutesOfDay,
  monthLong,
  parseDayKey,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
  weekdayOrder,
  weekdayShort,
  type DayKey,
} from '@/lib/time'
import { compareTasks } from '@/planner/tasks'
import { useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { Button, IconButton, Segmented } from '@/ui/controls'
import { useIsDesktop } from '@/ui/useMedia'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { TaskItem } from '@/features/tasks/TaskItem'
import { eventColor, expandEvents, packColumns, sessionSpans, toMinutes, type Occurrence } from './calendarModel'
import { EventSheet, type EventDraft } from './EventSheet'

type View = 'day' | 'week' | 'month'
const HOUR_PX = 52

export default function CalendarScreen() {
  const route = useRoute()
  const desktop = useIsDesktop()
  const settings = useSettings()
  const today = useDay()
  const param = route.params.get('date')
  const [anchor, setAnchor] = useState<DayKey>(isDayKey(param) ? param : today)
  const [view, setView] = useState<View>(desktop ? 'week' : 'day')
  const [draft, setDraft] = useState<EventDraft | null>(null)

  useEffect(() => {
    if (isDayKey(param)) {
      setAnchor(param)
      setView('day')
    }
  }, [param])

  const weekStart = startOfWeekKey(anchor, settings.weekStartsOn)
  const range = useMemo(() => {
    if (view === 'month') {
      const first = startOfWeekKey(startOfMonthKey(anchor), settings.weekStartsOn)
      return { start: first, end: addDaysKey(first, 41) }
    }
    return { start: weekStart, end: addDaysKey(weekStart, 6) }
  }, [view, anchor, weekStart, settings.weekStartsOn])

  const events = useEvents()
  const occurrences = useMemo(() => expandEvents(events, range.start, range.end), [events, range])
  const sessions = useSessionsBetween(range.start, range.end)
  const tasks = useTasks()

  const step = (dir: number) => {
    if (view === 'day') setAnchor(addDaysKey(anchor, dir))
    else if (view === 'week') setAnchor(addDaysKey(anchor, dir * 7))
    else setAnchor(addMonthsKey(anchor, dir))
  }

  const d = parseDayKey(anchor)
  const title = `${monthLong(d.getMonth())} ${d.getFullYear()}`

  return (
    <div className="pt-safe mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-3">
        <div className="flex items-center gap-1">
          <h1 className="mr-2 font-display text-[28px] leading-tight font-medium tracking-tight sm:text-[32px]">{title}</h1>
          <IconButton label="Previous" size="sm" onClick={() => step(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton label="Next" size="sm" onClick={() => step(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          {anchor !== today && (
            <Button size="sm" onClick={() => setAnchor(today)}>
              Today
            </Button>
          )}
          <Segmented<View>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          <IconButton label="New calendar item" variant="primary" size="sm" onClick={() => setDraft({ date: anchor })}>
            <Plus className="size-4.5" />
          </IconButton>
          <IconButton label="Settings" size="sm" className="lg:hidden" onClick={() => navigate('#/settings')}>
            <Settings2 className="size-4.5" />
          </IconButton>
        </div>
      </header>

      {view === 'month' && (
        <MonthGrid
          anchor={anchor}
          start={range.start}
          occurrences={occurrences}
          tasks={tasks}
          sessions={sessions}
          onPick={(day) => {
            setAnchor(day)
            setView('day')
          }}
        />
      )}
      {view === 'week' && (
        <>
          <PlannedActual days={daysInRange(range.start, range.end)} occurrences={occurrences} sessions={sessions} label="This week" />
          <TimeGrid days={daysInRange(range.start, range.end)} occurrences={occurrences} sessions={sessions} tasks={tasks} onSlot={(day, start) => setDraft({ date: day, start, end: addMinutes(start, 60) })} onEvent={(o) => setDraft({ ...o.event })} onDayClick={(day) => { setAnchor(day); setView('day') }} />
        </>
      )}
      {view === 'day' && (
        <>
          <WeekStrip weekStart={weekStart} selected={anchor} onSelect={setAnchor} occurrences={occurrences} tasks={tasks} sessions={sessions} />
          <PlannedActual days={[anchor]} occurrences={occurrences} sessions={sessions} label={anchor === today ? 'Today' : 'This day'} />
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
            <TimeGrid days={[anchor]} occurrences={occurrences} sessions={sessions} tasks={tasks} onSlot={(day, start) => setDraft({ date: day, start, end: addMinutes(start, 60) })} onEvent={(o) => setDraft({ ...o.event })} />
            <DayTasks day={anchor} tasks={tasks} />
          </div>
        </>
      )}
      <EventSheet draft={draft} onClose={() => setDraft(null)} />
    </div>
  )
}

function addMinutes(hhmm: string, mins: number): string {
  const total = Math.min(23 * 60 + 59, toMinutes(hhmm, 0) + mins)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ───────────────────────── month ─────────────────────────

function MonthGrid({ anchor, start, occurrences, tasks, sessions, onPick }: { anchor: DayKey; start: DayKey; occurrences: Occurrence[]; tasks: Task[]; sessions: ReturnType<typeof useSessionsBetween>; onPick: (d: DayKey) => void }) {
  const settings = useSettings()
  const labels = useLabels()
  const today = todayKey()
  const month = anchor.slice(0, 7)
  const days = Array.from({ length: 42 }, (_, i) => addDaysKey(start, i))
  const focusByDay = useMemo(() => {
    const m = new Map<DayKey, number>()
    for (const s of sessions) m.set(s.date, (m.get(s.date) ?? 0) + s.duration)
    return m
  }, [sessions])
  const max = Math.max(3600, ...focusByDay.values())
  const tasksByDay = useMemo(() => {
    const m = new Map<DayKey, number>()
    for (const t of tasks) {
      if (t.done) continue
      const d = t.dueDate ?? t.plannedFor
      if (d) m.set(d, (m.get(d) ?? 0) + 1)
    }
    return m
  }, [tasks])
  const lastRowNeeded = days[35] <= endOfMonthKey(anchor)

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      <div className="grid grid-cols-7 border-b border-line">
        {weekdayOrder(settings.weekStartsOn).map((wd) => (
          <div key={wd} className="py-2 text-center text-[11px] font-bold tracking-wider text-ink-3 uppercase">
            {weekdayShort(wd)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.slice(0, lastRowNeeded ? 42 : 35).map((day) => {
          const inMonth = day.startsWith(month)
          const occ = occurrences.filter((o) => o.date === day)
          const focus = focusByDay.get(day) ?? 0
          const taskCount = tasksByDay.get(day) ?? 0
          return (
            <button key={day} type="button" onClick={() => onPick(day)} className={cn('relative flex min-h-[74px] flex-col items-stretch gap-0.5 border-r border-b border-line p-1 text-left transition-colors hover:bg-surface-2/60 sm:min-h-[104px] sm:p-1.5', !inMonth && 'bg-surface-2/40')}>
              <span className={cn('flex size-6 items-center justify-center self-start rounded-full text-xs font-bold', day === today ? 'bg-accent text-accent-ink' : inMonth ? 'text-ink' : 'text-ink-3')}>{parseDayKey(day).getDate()}</span>
              {occ.slice(0, 3).map((o) => (
                <span key={o.key} className="truncate rounded px-1 text-[10px] leading-4 font-semibold sm:text-[11px]" style={{ background: `color-mix(in oklab, ${eventColor(o.event, labels)} 18%, transparent)`, color: 'var(--ink)' }}>
                  {o.event.kind === 'exam' && '🎓 '}
                  {o.event.title}
                </span>
              ))}
              {occ.length > 3 && <span className="px-1 text-[10px] font-bold text-ink-3">+{occ.length - 3}</span>}
              <span className="mt-auto flex items-center gap-1 px-0.5">
                {taskCount > 0 && <span className="text-[10px] font-bold text-ink-3">{taskCount}✓</span>}
              </span>
              {focus > 0 && <span className="absolute inset-x-1.5 bottom-1 h-[3px] rounded-full bg-accent" style={{ opacity: 0.25 + 0.75 * Math.min(1, focus / max) }} title={`${formatDuration(focus)} focused`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── week strip ─────────────────────────

function WeekStrip({ weekStart, selected, onSelect, occurrences, tasks, sessions }: { weekStart: DayKey; selected: DayKey; onSelect: (d: DayKey) => void; occurrences: Occurrence[]; tasks: Task[]; sessions: ReturnType<typeof useSessionsBetween> }) {
  const today = todayKey()
  return (
    <div className="mb-3 grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i)).map((day) => {
        const has = occurrences.some((o) => o.date === day) || tasks.some((t) => !t.done && (t.plannedFor === day || t.dueDate === day))
        const focused = sessions.some((s) => s.date === day)
        const sel = day === selected
        return (
          <button key={day} type="button" onClick={() => onSelect(day)} className={cn('flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors', sel ? 'bg-primary text-primary-ink' : 'hover:bg-surface-2')}>
            <span className={cn('text-[11px] font-bold uppercase', sel ? 'text-primary-ink/70' : 'text-ink-3')}>{weekdayShort(parseDayKey(day).getDay()).slice(0, 2)}</span>
            <span className={cn('text-base font-bold', !sel && day === today && 'text-accent')}>{parseDayKey(day).getDate()}</span>
            <span className="flex h-1.5 gap-0.5">
              {has && <span className={cn('size-1.5 rounded-full', sel ? 'bg-primary-ink/70' : 'bg-ink-3')} />}
              {focused && <span className="size-1.5 rounded-full bg-accent" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────── planned vs actual ─────────────────────────

function PlannedActual({ days, occurrences, sessions, label }: { days: DayKey[]; occurrences: Occurrence[]; sessions: ReturnType<typeof useSessionsBetween>; label: string }) {
  const set = new Set(days)
  const planned = occurrences.filter((o) => set.has(o.date) && o.event.kind === 'block' && o.event.start).reduce((a, o) => a + Math.max(0, toMinutes(o.event.end, 0) - toMinutes(o.event.start, 0)) * 60, 0)
  const actual = sessions.filter((s) => set.has(s.date)).reduce((a, s) => a + s.duration, 0)
  if (!planned && !actual) return null
  const ratio = planned ? actual / planned : 0
  return (
    <div className="mb-3 flex items-center gap-4 rounded-2xl bg-surface-2/70 px-4 py-2.5 text-[13px]">
      <span className="font-bold">{label}</span>
      <span className="text-ink-2">
        Planned <b className="text-ink">{formatDuration(planned)}</b>
      </span>
      <span className="text-ink-2">
        Focused <b className="text-ink">{formatDuration(actual)}</b>
      </span>
      {planned > 0 && <span className={cn('ml-auto font-bold', ratio >= 0.9 ? 'text-success' : 'text-ink-2')}>{Math.round(ratio * 100)}%</span>}
    </div>
  )
}

// ───────────────────────── time grid ─────────────────────────

function TimeGrid({
  days,
  occurrences,
  sessions,
  tasks,
  onSlot,
  onEvent,
  onDayClick,
}: {
  days: DayKey[]
  occurrences: Occurrence[]
  sessions: ReturnType<typeof useSessionsBetween>
  tasks: Task[]
  onSlot: (day: DayKey, start: string) => void
  onEvent: (o: Occurrence) => void
  onDayClick?: (day: DayKey) => void
}) {
  const settings = useSettings()
  const labels = useLabels()
  const scroller = useRef<HTMLDivElement>(null)
  const now = useNow(true, 60_000)
  const today = todayKey()
  const multi = days.length > 1

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const minutes = days.includes(today) ? Math.max(0, minutesOfDay(Date.now()) - 90) : 7 * 60
    el.scrollTop = (minutes / 60) * HOUR_PX
  }, [days.join(), today]) // scroll once per range

  const allDay = (day: DayKey) => occurrences.filter((o) => o.date === day && !o.event.start)
  const dueTasks = (day: DayKey) => tasks.filter((t) => !t.done && t.dueDate === day)
  const hasAllDay = days.some((d) => allDay(d).length || (multi && dueTasks(d).length))

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
      {multi && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div />
          {days.map((day) => (
            <button key={day} type="button" onClick={() => onDayClick?.(day)} className="flex flex-col items-center py-2 hover:bg-surface-2/60">
              <span className="text-[10px] font-bold text-ink-3 uppercase">{weekdayShort(parseDayKey(day).getDay())}</span>
              <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-bold', day === today && 'bg-accent text-accent-ink')}>{parseDayKey(day).getDate()}</span>
            </button>
          ))}
        </div>
      )}
      {hasAllDay && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="py-1.5 pr-1 text-right text-[10px] font-bold text-ink-3">all‑day</div>
          {days.map((day) => (
            <div key={day} className="space-y-0.5 border-l border-line p-1">
              {allDay(day).map((o) => (
                <button key={o.key} type="button" onClick={() => onEvent(o)} className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-bold" style={{ background: `color-mix(in oklab, ${eventColor(o.event, labels)} 20%, transparent)` }}>
                  {o.event.kind === 'exam' && <GraduationCap className="size-3 shrink-0" />}
                  <span className="truncate">{o.event.title}</span>
                </button>
              ))}
              {multi && dueTasks(day).length > 0 && <p className="truncate px-1 text-[10px] font-bold text-ink-3">{dueTasks(day).length} due</p>}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} className="scrollbar-thin relative h-[58dvh] overflow-y-auto lg:h-[64dvh]">
        <div className="relative grid" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))`, height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] font-semibold text-ink-3" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : formatHourLabel(h, settings.use24h)}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn key={day} day={day} occurrences={occurrences.filter((o) => o.date === day && o.event.start)} sessions={sessions} labels={labels} onSlot={onSlot} onEvent={onEvent} nowMinutes={day === today ? minutesOfDay(now) : null} narrow={multi} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({ day, occurrences, sessions, labels, onSlot, onEvent, nowMinutes, narrow }: { day: DayKey; occurrences: Occurrence[]; sessions: ReturnType<typeof useSessionsBetween>; labels: ReturnType<typeof useLabels>; onSlot: (d: DayKey, s: string) => void; onEvent: (o: Occurrence) => void; nowMinutes: number | null; narrow: boolean }) {
  const timerIdle = useTimer((s) => s.timer.status === 'idle')
  const { label } = useLookups()
  const placed = packColumns(occurrences.map((o) => ({ id: o.key, start: toMinutes(o.event.start, 0), end: toMinutes(o.event.end, toMinutes(o.event.start, 0) + 60) })))
  const byKey = new Map(occurrences.map((o) => [o.key, o]))
  const spans = sessionSpans(sessions, day)
  const lane = narrow ? 'right-0.5 w-1.5' : 'right-1 w-[22%]'

  return (
    <div
      className="relative border-l border-line"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const rect = e.currentTarget.getBoundingClientRect()
        const minutes = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
        onSlot(day, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
      }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: h * HOUR_PX }} />
      ))}
      {/* Actual focus sessions – the "actual" lane next to what you planned. */}
      {spans.map(({ session, start, end }) => {
        const l = label(session.labelId)
        return (
          <div
            key={session.id}
            className={cn('pointer-events-none absolute rounded-md', lane)}
            style={{ top: (start / 60) * HOUR_PX, height: Math.max(4, ((end - start) / 60) * HOUR_PX), background: `color-mix(in oklab, ${l?.color ?? 'var(--accent)'} ${narrow ? 80 : 35}%, transparent)` }}
            title={`${formatDuration(session.duration)} focused`}
          >
            {!narrow && end - start >= 25 && <span className="block truncate px-1.5 pt-1 text-[10px] font-bold">{formatDuration(session.duration)}</span>}
          </div>
        )
      })}
      {placed.map((p) => {
        const o = byKey.get(p.id)!
        const color = eventColor(o.event, labels)
        const top = (p.start / 60) * HOUR_PX
        const height = Math.max(20, ((p.end - p.start) / 60) * HOUR_PX - 2)
        const block = o.event.kind === 'block'
        const startMs = parseDayKey(day).getTime() + p.start * 60_000
        const canStart = block && timerIdle && Math.abs(Date.now() - startMs) < 3 * 3_600_000
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onEvent(o)}
            className={cn('absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left', block && 'border-dashed')}
            style={{
              top,
              height,
              left: `calc(${(p.col / p.cols) * 100}% * ${narrow ? 1 : 0.75} + 2px)`,
              width: `calc(${(1 / p.cols) * 100}% * ${narrow ? 1 : 0.75} - ${narrow ? 12 : 6}px)`,
              borderColor: color,
              background: `color-mix(in oklab, ${color} ${block ? 12 : 20}%, var(--surface))`,
            }}
          >
            <span className="block truncate text-[12px] leading-tight font-bold">{o.event.title}</span>
            {height > 34 && !narrow && (
              <span className="block truncate text-[11px] text-ink-2">
                {o.event.start}–{o.event.end}
                {o.event.location && ` · ${o.event.location}`}
              </span>
            )}
            {canStart && !narrow && height > 40 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  void executeAction('calendar.startBlock', { eventId:o.event.id })
                }}
                className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-full bg-accent text-accent-ink"
                onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void executeAction('calendar.startBlock', { eventId:o.event.id }) } }}
                aria-label="Start this focus block"
              >
                <Play className="size-3.5 fill-current" />
              </span>
            )}
          </button>
        )
      })}
      {nowMinutes !== null && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMinutes / 60) * HOUR_PX }}>
          <span className="-ml-1 size-2 rounded-full bg-danger" />
          <span className="h-px flex-1 bg-danger" />
        </div>
      )}
      {!narrow && placed.length === 0 && spans.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 text-center text-xs text-ink-3" style={{ top: 9 * HOUR_PX }}>
          Tap a time to schedule a focus block
        </p>
      )}
    </div>
  )
}

function DayTasks({ day, tasks }: { day: DayKey; tasks: Task[] }) {
  const { project, label } = useLookups()
  const counts = useTaskSessions()
  const list = tasks.filter((t) => (t.plannedFor === day || t.dueDate === day) && (!t.done || (t.completedAt && dayKey(t.completedAt) === day))).sort(compareTasks)
  return (
    <section className="mt-5 lg:mt-0">
      <div className="mb-1 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Tasks</h2>
        <button type="button" className="text-xs font-bold text-accent" onClick={() => useUi.getState().newTask({ plannedFor: day })}>
          Add
        </button>
      </div>
      {list.length ? (
        <div className="rounded-card border border-line bg-surface p-1 shadow-soft">
          {list.map((t) => (
            <TaskItem key={t.id} task={t} project={project(t.projectId)} label={label(t.labelId)} sessions={counts.count(t.id)} showDate={false} />
          ))}
        </div>
      ) : (
        <p className="px-1 py-3 text-[13px] text-ink-3">No tasks planned for this day.</p>
      )}
    </section>
  )
}
