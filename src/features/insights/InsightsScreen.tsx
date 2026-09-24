import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { navigate } from '@/app/router'
import { useEvents, useGoals, useLabels, useLookups, useProjects, useSessions, useSettings, useTasks } from '@/data/hooks'
import type { Session } from '@/data/types'
import { cn } from '@/lib/cn'
import {
  addDaysKey,
  daysInRange,
  diffDays,
  formatDuration,
  formatHourLabel,
  hourName,
  formatTimeOfDay,
  monthLong,
  monthName,
  parseDayKey,
  relativeDayLabel,
  shortDate,
  todayKey,
  weekdayLong,
  weekdayOrder,
  weekdayShort,
  type DayKey,
} from '@/lib/time'
import {
  breakdown,
  computeStreaks,
  dailySeries,
  estimateAccuracy,
  filterRange,
  labelScope,
  monthlySeries,
  periodRange,
  previousRange,
  rootOf,
  secondsByDay,
  secondsByHour,
  secondsByWeekday,
  shiftRange,
  studyDays,
  summarize,
  taskCompletion,
  weeklyTrend,
  type RangeKind,
} from '@/stats/aggregate'
import { Button, IconButton, Segmented, Select } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { flattenLabels, labelPath } from '@/features/shared/labels'
import { expandEvents, toMinutes } from '@/features/calendar/calendarModel'
import { BarList, ChartCard, ColumnChart, fmtSeconds, Heatmap, StatTile, TrendLine, type BarRow, type Datum } from './charts'
import { GoalsSection } from './GoalsSection'
import { SessionSheet } from './SessionSheet'

const minKey = (a: DayKey, b: DayKey) => (a < b ? a : b)

export default function InsightsScreen() {
  const settings = useSettings()
  const today = todayKey()
  const [kind, setKind] = useState<RangeKind>('week')
  const [anchor, setAnchor] = useState<DayKey>(today)
  const [labelFilter, setLabelFilter] = useState('')
  const [editing, setEditing] = useState<Session | 'new' | null>(null)
  const allSessions = useSessions()
  const labels = useLabels(true)
  const activeLabels = useLabels()
  const projects = useProjects(true)
  const tasks = useTasks()
  const events = useEvents()
  const goals = useGoals()

  const sessions = useMemo(() => {
    if (!labelFilter) return allSessions
    const scope = labelScope(labels, labelFilter)
    return allSessions.filter((s) => s.labelId && scope.has(s.labelId))
  }, [allSessions, labelFilter, labels])

  const range = periodRange(kind, anchor, settings.weekStartsOn)
  const isCurrent = range.start <= today && today <= range.end
  // For a period still in progress, compare against the same elapsed span of the previous one.
  const prevFull = previousRange(kind, anchor, settings.weekStartsOn)
  const prev = isCurrent ? { start: prevFull.start, end: minKey(prevFull.end, addDaysKey(prevFull.start, diffDays(range.start, today))) } : prevFull
  const inRange = useMemo(() => filterRange(sessions, range), [sessions, range.start, range.end])
  const inPrev = useMemo(() => filterRange(sessions, prev), [sessions, prev.start, prev.end])
  const sum = summarize(inRange)
  const sumPrev = summarize(inPrev)
  const streaks = useMemo(() => computeStreaks(studyDays(sessions), today), [sessions, today])
  const dailyGoal = goals.find((g) => g.active && g.period === 'day' && !g.labelId && !g.projectId)
  const delta = (a: number, b: number) => (b > 0 ? (a - b) / b : null)

  const rangeLabel = (() => {
    const s = parseDayKey(range.start)
    if (kind === 'day') return relativeDayLabel(range.start, today)
    if (kind === 'week') return `${shortDate(range.start)} – ${shortDate(range.end)}`
    if (kind === 'month') return `${monthLong(s.getMonth())} ${s.getFullYear()}`
    return String(s.getFullYear())
  })()

  // ── main chart data
  const main: { data: Datum[]; tickEvery: number; highlight?: string; reference?: number; subtitle: string } = useMemo(() => {
    if (kind === 'day') {
      const hours = secondsByHour(inRange)
      return {
        data: hours.map((v, h) => ({ key: String(h), label: hourName(h, settings.use24h), tick: formatHourLabel(h, settings.use24h), value: v })),
        tickEvery: 3,
        subtitle: 'Focus by hour of the day',
      }
    }
    if (kind === 'year') {
      return {
        data: monthlySeries(inRange, range.start.slice(0, 4)).map((m) => ({ key: String(m.month), label: monthName(m.month), tick: monthName(m.month).slice(0, 1), value: m.seconds })),
        tickEvery: 1,
        highlight: range.start.slice(0, 4) === today.slice(0, 4) ? String(Number(today.slice(5, 7)) - 1) : undefined,
        subtitle: 'Focus by month',
      }
    }
    const series = dailySeries(inRange, range)
    return {
      data: series.map((d) => ({ key: d.day, label: `${weekdayShort(parseDayKey(d.day).getDay())} ${shortDate(d.day)}`, tick: kind === 'week' ? weekdayShort(parseDayKey(d.day).getDay()).slice(0, 2) : String(parseDayKey(d.day).getDate()), value: d.seconds })),
      tickEvery: kind === 'week' ? 1 : 5,
      highlight: isCurrent ? today : undefined,
      reference: dailyGoal && !labelFilter ? dailyGoal.targetMinutes * 60 : undefined,
      subtitle: 'Focus per day',
    }
  }, [kind, inRange, range.start, range.end, settings.use24h, isCurrent, today, dailyGoal, labelFilter])

  // ── breakdowns
  const [rollup, setRollup] = useState<'subject' | 'topic'>('subject')
  const subjectRows: BarRow[] = useMemo(() => {
    const root = rootOf(labels)
    return breakdown(inRange, (s) => (rollup === 'subject' ? root(s.labelId) : s.labelId)).map((b) => {
      const l = labels.find((x) => x.id === b.id)
      return { key: b.id ?? 'none', label: l ? (rollup === 'topic' ? labelPath(labels, l.id) : l.name) : 'No subject', value: b.seconds, color: l?.color ?? 'var(--ink-3)', sub: `${b.sessions}×` }
    })
  }, [inRange, labels, rollup])

  const projectRows: BarRow[] = useMemo(
    () =>
      breakdown(inRange, (s) => s.projectId)
        .filter((b) => b.id)
        .map((b) => {
          const p = projects.find((x) => x.id === b.id)
          return { key: b.id!, label: p?.name ?? 'Deleted project', value: b.seconds, color: p?.color, sub: `${b.sessions}×` }
        }),
    [inRange, projects],
  )
  const taskRows: BarRow[] = useMemo(
    () =>
      breakdown(inRange, (s) => s.taskId)
        .filter((b) => b.id)
        .map((b) => {
          const t = tasks.find((x) => x.id === b.id)
          return { key: b.id!, label: t?.title ?? 'Deleted task', value: b.seconds, sub: `${b.sessions}×` }
        }),
    [inRange, tasks],
  )

  // ── planned vs actual
  const estimates = useMemo(() => estimateAccuracy(tasks, sessions, range), [tasks, sessions, range.start, range.end])
  const completion = useMemo(() => taskCompletion(tasks, range), [tasks, range.start, range.end])
  const plannedBlocks = useMemo(
    () =>
      expandEvents(events, range.start, range.end)
        .filter((o) => o.event.kind === 'block' && o.event.start)
        .reduce((a, o) => a + Math.max(0, toMinutes(o.event.end, 0) - toMinutes(o.event.start, 0)) * 60, 0),
    [events, range.start, range.end],
  )

  // ── rhythm (use a wider window for day/week so patterns are meaningful)
  const rhythmRange = kind === 'day' || kind === 'week' ? { start: addDaysKey(today, -89), end: today } : range
  const rhythmSessions = useMemo(() => filterRange(sessions, rhythmRange), [sessions, rhythmRange.start, rhythmRange.end])
  const byWeekday = useMemo(() => secondsByWeekday(rhythmSessions, rhythmRange, true), [rhythmSessions])
  const byHour = useMemo(() => secondsByHour(rhythmSessions), [rhythmSessions])
  const bestDay = byWeekday.indexOf(Math.max(...byWeekday))
  const bestHour = byHour.indexOf(Math.max(...byHour))

  // ── year heatmap + trend
  const heatDays = daysInRange(addDaysKey(today, -364), today)
  const heatValues = useMemo(() => secondsByDay(sessions), [sessions])
  const trend = useMemo(() => weeklyTrend(sessions, 12, today, settings.weekStartsOn), [sessions, today, settings.weekStartsOn])

  const empty = allSessions.length === 0

  return (
    <div className="pt-safe mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="flex items-end justify-between gap-3 pt-5 pb-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">Review</p>
          <h1 className="font-display text-[32px] leading-tight font-medium tracking-tight">Insights</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEditing('new')}>
            Log session
          </Button>
          <IconButton label="Settings" className="lg:hidden" onClick={() => navigate('#/settings')}>
            <Settings2 className="size-5" />
          </IconButton>
        </div>
      </header>

      {/* One filter row scopes everything below it. */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <Segmented<RangeKind>
          size="sm"
          value={kind}
          onChange={(k) => {
            setKind(k)
            setAnchor(today)
          }}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
        <div className="flex items-center">
          <IconButton label="Previous period" size="sm" onClick={() => setAnchor(shiftRange(kind, anchor, -1))}>
            <ChevronLeft className="size-4.5" />
          </IconButton>
          <span className="min-w-28 text-center text-[13px] font-bold">{rangeLabel}</span>
          <IconButton label="Next period" size="sm" disabled={range.end >= today} onClick={() => setAnchor(shiftRange(kind, anchor, 1))}>
            <ChevronRight className="size-4.5" />
          </IconButton>
        </div>
        {activeLabels.length > 0 && (
          <Select compact value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="max-w-44" aria-label="Filter by subject">
            <option value="">All subjects</option>
            {flattenLabels(activeLabels).map(({ label, path }) => (
              <option key={label.id} value={label.id}>
                {path}
              </option>
            ))}
          </Select>
        )}
      </div>

      {empty ? (
        <div className="rounded-card border border-line bg-surface shadow-soft">
          <EmptyState title="Your story starts with one session" body="Every focus session is recorded automatically. Complete one and your charts, streaks and patterns appear here." action={<Button variant="primary" onClick={() => navigate('#/focus')}>Start focusing</Button>} />
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Focus time" value={formatDuration(sum.totalSeconds)} delta={delta(sum.totalSeconds, sumPrev.totalSeconds)} sub={isCurrent ? `vs same point last ${kind}` : `vs previous ${kind}`} />
            <StatTile label="Sessions" value={String(sum.count)} delta={delta(sum.count, sumPrev.count)} sub={sum.count ? `avg ${formatDuration(sum.avgSeconds)}` : undefined} />
            <StatTile label="Completion rate" value={sum.count ? `${Math.round(sum.completionRate * 100)}%` : '–'} sub={sum.count ? `${sum.completed} of ${sum.count} ran to the end` : 'no sessions'} />
            <StatTile label="Streak" value={`${streaks.current} ${streaks.current === 1 ? 'day' : 'days'}`} sub={`longest ${streaks.longest} · ${sum.studyDays} study ${sum.studyDays === 1 ? 'day' : 'days'} here`} />
          </div>

          <ChartCard title={kind === 'day' ? 'Your day' : kind === 'year' ? 'Your year' : kind === 'month' ? 'Your month' : 'Your week'} subtitle={`${main.subtitle}${main.reference ? ' · dashed line is your daily goal' : ''}`} table={main.data.map((d) => [d.label, formatDuration(d.value)])}>
            <ColumnChart data={main.data} highlight={main.highlight} tickEvery={main.tickEvery} reference={main.reference} referenceLabel="goal" ariaLabel={`${main.subtitle} for ${rangeLabel}`} />
          </ChartCard>

          <GoalsSection />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="By subject"
              subtitle={rollup === 'subject' ? 'Topics roll up into their subject' : 'Every label separately'}
              table={subjectRows.map((r) => [r.label, formatDuration(r.value)])}
              action={<Segmented size="sm" value={rollup} onChange={setRollup} options={[{ value: 'subject', label: 'Subjects' }, { value: 'topic', label: 'Topics' }]} />}
            >
              <BarList rows={subjectRows} empty={<p className="text-sm text-ink-3">No sessions in this period.</p>} />
            </ChartCard>
            <ChartCard title="By project & task" subtitle="Where the time actually went" table={[...projectRows, ...taskRows].map((r) => [r.label, formatDuration(r.value)])}>
              {projectRows.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-bold tracking-[0.1em] text-ink-3 uppercase">Projects</p>
                  <BarList rows={projectRows} limit={5} />
                </>
              )}
              <p className={cn('mb-2 text-xs font-bold tracking-[0.1em] text-ink-3 uppercase', projectRows.length > 0 && 'mt-5')}>Tasks</p>
              <BarList rows={taskRows} limit={6} empty={<p className="text-sm text-ink-3">Start sessions from tasks to see time per task.</p>} />
            </ChartCard>
          </div>

          <ChartCard title="Planned vs actual" subtitle="Estimates, time blocks and follow-through for this period">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Blocks planned" value={formatDuration(plannedBlocks)} sub={plannedBlocks ? `${formatDuration(sum.totalSeconds)} focused` : 'schedule in Calendar'} />
              <MiniStat label="Tasks done" value={`${completion.completed}/${completion.planned}`} sub={completion.planned ? `${Math.round((completion.completed / completion.planned) * 100)}% of planned` : 'nothing planned'} />
              <MiniStat
                label="Estimate accuracy"
                value={(() => {
                  const withEst = estimates.filter((e) => e.estimated > 0 && e.task.done)
                  if (!withEst.length) return '–'
                  const est = withEst.reduce((a, e) => a + e.estimated, 0)
                  const act = withEst.reduce((a, e) => a + e.actualSessions, 0)
                  return `${Math.round((act / est) * 100)}%`
                })()}
                sub="actual ÷ estimated sessions"
              />
            </div>
            {estimates.length > 0 && (
              <ul className="mt-4 divide-y divide-line">
                {estimates.slice(0, 6).map((e) => (
                  <li key={e.task.id} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className={cn('min-w-0 flex-1 truncate font-semibold', e.task.done && 'text-ink-2')}>{e.task.title}</span>
                    <EstimateBar estimated={e.estimated} actual={e.actualSessions} />
                    <span className="tabular w-14 shrink-0 text-right font-bold">
                      {e.actualSessions}/{e.estimated || '–'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Best days"
              subtitle={`Average focus per weekday${kind === 'day' || kind === 'week' ? ' · last 90 days' : ''}${byWeekday[bestDay] > 0 ? ` · strongest on ${weekdayLong(bestDay)}s` : ''}`}
              table={weekdayOrder(settings.weekStartsOn).map((wd) => [weekdayLong(wd), formatDuration(byWeekday[wd])])}
            >
              <ColumnChart data={weekdayOrder(settings.weekStartsOn).map((wd) => ({ key: String(wd), label: weekdayLong(wd), tick: weekdayShort(wd).slice(0, 2), value: byWeekday[wd] }))} highlight={byWeekday[bestDay] > 0 ? String(bestDay) : undefined} emphasize height={150} ariaLabel="Average focus by weekday" />
            </ChartCard>
            <ChartCard
              title="Best hours"
              subtitle={`When your focus happens${byHour[bestHour] > 0 ? ` · peak around ${hourName(bestHour, settings.use24h)}` : ''}`}
              table={byHour.map((v, h) => [hourName(h, settings.use24h), formatDuration(v)])}
            >
              <ColumnChart data={byHour.map((v, h) => ({ key: String(h), label: hourName(h, settings.use24h), tick: formatHourLabel(h, settings.use24h), value: v }))} highlight={byHour[bestHour] > 0 ? String(bestHour) : undefined} emphasize tickEvery={3} height={150} ariaLabel="Focus by hour of day" />
            </ChartCard>
          </div>

          <ChartCard title="Last 12 months" subtitle={`${studyDays(sessions).size} study days all time`} table={heatDays.filter((d) => heatValues.get(d)).map((d) => [d, formatDuration(heatValues.get(d) ?? 0)])}>
            <Heatmap days={heatDays} values={heatValues} weekStartsOn={settings.weekStartsOn} ariaLabel="Daily focus over the last year" />
          </ChartCard>

          <ChartCard title="12-week trend" subtitle="Weekly focus time" table={trend.map((w) => [`Week of ${shortDate(w.week)}`, formatDuration(w.seconds)])}>
            <TrendLine data={trend.map((w) => ({ key: w.week, label: `Week of ${shortDate(w.week)}`, tick: shortDate(w.week), value: w.seconds }))} ariaLabel="Weekly focus over the last 12 weeks" />
          </ChartCard>

          <SessionLog sessions={inRange} onEdit={setEditing} />
        </div>
      )}
      <SessionSheet session={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-ink-2">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-ink-3">{sub}</p>
    </div>
  )
}

function EstimateBar({ estimated, actual }: { estimated: number; actual: number }) {
  const max = Math.max(estimated, actual, 1)
  return (
    <span className="relative h-2 w-24 shrink-0 rounded-full bg-surface-2" aria-hidden="true">
      {estimated > 0 && <span className="absolute inset-y-0 left-0 rounded-full border border-line-strong" style={{ width: `${(estimated / max) * 100}%` }} />}
      <span className="absolute inset-y-0.5 left-0 rounded-full" style={{ width: `${(actual / max) * 100}%`, background: actual > estimated && estimated > 0 ? 'var(--danger)' : 'var(--chart)' }} />
    </span>
  )
}

function SessionLog({ sessions, onEdit }: { sessions: Session[]; onEdit: (s: Session) => void }) {
  const settings = useSettings()
  const { label, labels } = useLookups()
  const tasks = useTasks()
  const [limit, setLimit] = useState(20)
  const sorted = useMemo(() => [...sessions].sort((a, b) => b.startedAt - a.startedAt), [sessions])
  const groups = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of sorted.slice(0, limit)) {
      if (!map.has(s.date)) map.set(s.date, [])
      map.get(s.date)!.push(s)
    }
    return [...map.entries()]
  }, [sorted, limit])

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-5">
      <h3 className="mb-3 text-[15px] font-bold">Session history</h3>
      {groups.length === 0 && <p className="text-sm text-ink-3">No sessions in this period.</p>}
      <div className="space-y-4">
        {groups.map(([day, list]) => (
          <div key={day}>
            <p className="mb-1 flex justify-between text-xs font-bold text-ink-2">
              <span>{relativeDayLabel(day)}</span>
              <span className="tabular">{fmtSeconds(list.reduce((a, s) => a + s.duration, 0))}</span>
            </p>
            <ul className="divide-y divide-line">
              {list.map((s) => {
                const l = label(s.labelId)
                const t = tasks.find((x) => x.id === s.taskId)
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => onEdit(s)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface-2/50">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: l?.color ?? 'var(--line-strong)' }} />
                      <span className="tabular w-16 shrink-0 text-[13px] text-ink-2">{formatTimeOfDay(s.startedAt, settings.use24h)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{[l ? labelPath(labels, l.id) : null, t?.title].filter(Boolean).join(' · ') || 'Focus'}</span>
                        {s.note && <span className="block truncate text-xs text-ink-3">{s.note}</span>}
                      </span>
                      {s.rating && <span className="text-xs font-bold text-accent">{'★'.repeat(s.rating)}</span>}
                      {!s.completed && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-3">partial</span>}
                      {s.source === 'manual' && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-3">logged</span>}
                      <span className="tabular shrink-0 text-[13px] font-bold">{formatDuration(s.duration)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      {sorted.length > limit && (
        <Button block className="mt-4" onClick={() => setLimit((l) => l + 40)}>
          Show more
        </Button>
      )}
      <p className="mt-3 text-xs text-ink-3">Tap a session to edit it, add a note, or delete it.</p>
    </section>
  )
}
