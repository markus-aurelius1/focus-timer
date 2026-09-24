import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { Archive, ArrowLeft, CalendarCheck2, CheckCheck, ChevronDown, FolderPlus, Inbox, MoreHorizontal, Pencil, Plus, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { navigate, useRoute } from '@/app/router'
import { useUi } from '@/app/ui-store'
import { db } from '@/data/db'
import { useLabels, useLookups, useProfiles, useProjects, useSettings, useTasks } from '@/data/hooks'
import { create, nextOrder, patch, remove, reorder } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Label, Project, Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { addDaysKey, dayKey, diffDays, formatDuration, longDate, relativeDayLabel, todayKey, type DayKey } from '@/lib/time'
import { byPriorityThenOrder, compareTasks, groupUpcoming, isInbox, isOverdue, isToday } from '@/planner/tasks'
import { labelScope } from '@/stats/aggregate'
import { Button, Card, Field, IconButton, Select, TextArea, TextInput } from '@/ui/controls'
import { ColorPicker } from '@/ui/ColorPicker'
import { confirmDialog, EmptyState } from '@/ui/feedback'
import { Menu } from '@/ui/Menu'
import { Sheet } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { useTodayProgress } from '@/features/shared/useProgress'
import { HabitsView } from './HabitsView'
import { QuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'

type View = 'today' | 'upcoming' | 'inbox' | 'projects' | 'habits' | 'done'
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'projects', label: 'Projects' },
  { id: 'habits', label: 'Habits' },
  { id: 'done', label: 'Done' },
]

export function TasksScreen() {
  const route = useRoute()
  const view = (VIEWS.find((v) => v.id === route.params.get('view'))?.id ?? 'today') as View
  const projectId = route.params.get('project')
  const [labelFilter, setLabelFilter] = useState<string>('')
  const labels = useLabels()
  const allTasks = useTasks()
  const quickAddOpen = useUi((s) => s.quickAddOpen)

  const tasks = useMemo(() => {
    if (!labelFilter) return allTasks
    const scope = labelScope(labels, labelFilter)
    return allTasks.filter((t) => t.labelId && scope.has(t.labelId))
  }, [allTasks, labelFilter, labels])

  const setView = (v: View) => navigate(`#/tasks?view=${v}`)

  return (
    <div className="pt-safe mx-auto w-full max-w-3xl px-4 sm:px-6">
      <header className="flex items-end justify-between gap-3 pt-5 pb-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">{longDate(todayKey())}</p>
          <h1 className="font-display text-[32px] leading-tight font-medium tracking-tight">Plan</h1>
        </div>
        <div className="flex items-center gap-1">
          {view !== 'habits' && labels.length > 0 && (
            <Select compact value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="max-w-40" aria-label="Filter by subject">
              <option value="">All subjects</option>
              {flattenLabels(labels).map(({ label, path }) => (
                <option key={label.id} value={label.id}>
                  {path}
                </option>
              ))}
            </Select>
          )}
          <IconButton label="Settings" className="lg:hidden" onClick={() => navigate('#/settings')}>
            <Settings2 className="size-5" />
          </IconButton>
        </div>
      </header>

      <nav className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Task views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-current={view === v.id ? 'page' : undefined}
            className={cn('relative shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors', view === v.id ? 'text-primary-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}
          >
            {view === v.id && <motion.span layoutId="task-view" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{v.label}</span>
            {v.id === 'inbox' && <InboxCount tasks={allTasks} active={view === v.id} />}
          </button>
        ))}
      </nav>

      {view === 'today' && <TodayView tasks={tasks} autoFocus={quickAddOpen} />}
      {view === 'upcoming' && <UpcomingView tasks={tasks} />}
      {view === 'inbox' && <InboxView tasks={tasks} autoFocus={quickAddOpen} />}
      {view === 'projects' && (projectId ? <ProjectDetail id={projectId} tasks={tasks} /> : <ProjectsView tasks={tasks} />)}
      {view === 'habits' && <HabitsView />}
      {view === 'done' && <DoneView tasks={tasks} />}
    </div>
  )
}

function InboxCount({ tasks, active }: { tasks: Task[]; active: boolean }) {
  const n = tasks.filter(isInbox).length
  if (!n) return null
  return <span className={cn('relative ml-1.5 text-[11px] font-bold', active ? 'text-primary-ink/70' : 'text-ink-3')}>{n}</span>
}

// ───────────────────────── shared list ─────────────────────────

function useTaskRow() {
  const { project, label } = useLookups()
  const counts = useTaskSessions()
  return { project, label, counts }
}

/** A drag-to-reorder task list. Order is persisted when the drag ends. */
function ReorderableTasks({ tasks, showDate = true }: { tasks: Task[]; showDate?: boolean }) {
  const [items, setItems] = useState(tasks)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!dragging) setItems(tasks)
  }, [tasks, dragging])
  const row = useTaskRow()
  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-0.5">
      {items.map((t) => (
        <ReorderRow
          key={t.id}
          task={t}
          showDate={showDate}
          row={row}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => {
            setDragging(false)
            void reorder('tasks', items.map((x) => x.id))
          }}
        />
      ))}
    </Reorder.Group>
  )
}

function ReorderRow({ task, showDate, row, onDragStart, onDragEnd }: { task: Task; showDate: boolean; row: ReturnType<typeof useTaskRow>; onDragStart: () => void; onDragEnd: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={task} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="relative rounded-2xl bg-surface" whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-lift)', zIndex: 10 }}>
      <TaskItem
        task={task}
        project={row.project(task.projectId)}
        label={row.label(task.labelId)}
        sessions={row.counts.count(task.id)}
        showDate={showDate}
        onDragStart={(e) => {
          onDragStart()
          controls.start(e)
        }}
      />
    </Reorder.Item>
  )
}

function PlainTasks({ tasks, showDate = true }: { tasks: Task[]; showDate?: boolean }) {
  const row = useTaskRow()
  return (
    <div className="space-y-0.5">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <motion.div key={t.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
            <TaskItem task={t} project={row.project(t.projectId)} label={row.label(t.labelId)} sessions={row.counts.count(t.id)} showDate={showDate} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Collapsible({ title, count, children, defaultOpen = false, action }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean; action?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!count) return null
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 py-2 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase" aria-expanded={open}>
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
          {title} <span className="text-ink-3">{count}</span>
        </button>
        {action}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ───────────────────────── views ─────────────────────────

function TodayView({ tasks, autoFocus }: { tasks: Task[]; autoFocus: boolean }) {
  const today = todayKey()
  const profiles = useProfiles()
  const settings = useSettings()
  const progress = useTodayProgress()
  const counts = useTaskSessions()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const perSession = (profile?.focusMinutes || 25) * 60

  const { todays, overdue, doneToday } = useMemo(() => {
    return {
      todays: tasks.filter((t) => isToday(t, today)).sort(compareTasks),
      overdue: tasks.filter((t) => isOverdue(t, today)).sort(byPriorityThenOrder),
      doneToday: tasks.filter((t) => t.done && t.completedAt && dayKey(t.completedAt) === today).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    }
  }, [tasks, today])

  const remainingSessions = todays.reduce((a, t) => a + Math.max(0, t.estimatedPomodoros - counts.count(t.id)), 0)
  const plannedSeconds = remainingSessions * perSession
  const goalLeft = Math.max(0, progress.targetSeconds - progress.seconds)

  useEffect(() => {
    if (autoFocus) useUi.getState().set({ quickAddOpen: false })
  }, [autoFocus])

  return (
    <div>
      <QuickAdd defaults={{ plannedFor: today }} placeholder="Add a task for today" autoFocus={autoFocus} />

      {(todays.length > 0 || progress.targetSeconds > 0) && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-surface-2/70 px-4 py-3 text-[13px]">
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {todays.length} {todays.length === 1 ? 'task' : 'tasks'} · {remainingSessions} {remainingSessions === 1 ? 'session' : 'sessions'} left ≈ {formatDuration(plannedSeconds)}
            </p>
            <p className="mt-0.5 text-ink-2">
              {progress.targetSeconds > 0
                ? plannedSeconds > goalLeft + perSession
                  ? `That’s more than your remaining goal (${formatDuration(goalLeft)}). Consider moving something to tomorrow.`
                  : goalLeft > 0
                    ? `${formatDuration(goalLeft)} to reach today’s goal.`
                    : 'Daily goal reached – anything more is a bonus.'
                : 'Estimate sessions on tasks to see your day’s load.'}
            </p>
          </div>
          <CalendarCheck2 className="size-6 shrink-0 text-ink-3" />
        </div>
      )}

      <Collapsible
        title="Overdue"
        count={overdue.length}
        defaultOpen
        action={
          <button
            type="button"
            className="text-xs font-bold text-accent"
            onClick={async () => {
              for (const t of overdue) await patch('tasks', t.id, { plannedFor: today })
            }}
          >
            Move all to today
          </button>
        }
      >
        <PlainTasks tasks={overdue} />
      </Collapsible>

      <section className="mt-4">
        {todays.length ? (
          <ReorderableTasks tasks={todays} showDate={false} />
        ) : (
          <Card className="mt-2">
            <EmptyState icon={<CalendarCheck2 className="size-6" />} title={doneToday.length ? 'All done for today' : 'Nothing planned yet'} body={doneToday.length ? 'Nicely done. Plan tomorrow, or enjoy the rest of your day.' : 'Add what you want to get done today, or pull tasks in from your inbox and upcoming list.'} />
          </Card>
        )}
      </section>

      <Collapsible title="Completed today" count={doneToday.length}>
        <PlainTasks tasks={doneToday} showDate={false} />
      </Collapsible>
    </div>
  )
}

function UpcomingView({ tasks }: { tasks: Task[] }) {
  const today = todayKey()
  const groups = useMemo(() => groupUpcoming(tasks, today, 90), [tasks, today])
  const week = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i + 1))
  const byDay = new Map(groups.map((g) => [g.day, g.tasks]))
  const later = groups.filter((g) => diffDays(today, g.day) > 7)
  return (
    <div className="space-y-5">
      {week.map((day) => (
        <DayGroup key={day} day={day} tasks={byDay.get(day) ?? []} today={today} />
      ))}
      {later.length > 0 && <h3 className="px-1 pt-2 text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">Later</h3>}
      {later.map((g) => (
        <DayGroup key={g.day} day={g.day} tasks={g.tasks} today={today} />
      ))}
    </div>
  )
}

function DayGroup({ day, tasks, today }: { day: DayKey; tasks: Task[]; today: DayKey }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-1 pb-1.5">
        <h3 className="font-display text-lg font-medium">
          {relativeDayLabel(day, today)}
          {diffDays(today, day) < 7 && diffDays(today, day) > 1 && <span className="ml-2 font-sans text-xs font-semibold text-ink-3">{longDate(day).split(', ')[1]}</span>}
        </h3>
        <button type="button" onClick={() => useUi.getState().newTask({ plannedFor: day })} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Add task for ${relativeDayLabel(day, today)}`}>
          <Plus className="size-3.5" /> Add
        </button>
      </div>
      {tasks.length ? <PlainTasks tasks={tasks} showDate={false} /> : <p className="px-1 py-2.5 text-[13px] text-ink-3">Nothing planned</p>}
    </section>
  )
}

function InboxView({ tasks, autoFocus }: { tasks: Task[]; autoFocus: boolean }) {
  const inbox = useMemo(() => tasks.filter(isInbox).sort(compareTasks), [tasks])
  useEffect(() => {
    if (autoFocus) useUi.getState().set({ quickAddOpen: false })
  }, [autoFocus])
  return (
    <div>
      <QuickAdd placeholder="Capture anything – sort it later" autoFocus={autoFocus} />
      <p className="mt-3 px-1 text-[13px] text-ink-2">Tasks without a date or project land here. Give them a day to plan them, or a project to file them.</p>
      <div className="mt-3">{inbox.length ? <ReorderableTasks tasks={inbox} /> : <EmptyState icon={<Inbox className="size-6" />} title="Inbox zero" body="Everything is planned or filed." />}</div>
    </div>
  )
}

function DoneView({ tasks }: { tasks: Task[] }) {
  const [limit, setLimit] = useState(60)
  const groups = useMemo(() => {
    const done = tasks.filter((t) => t.done && t.completedAt).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    const map = new Map<DayKey, Task[]>()
    for (const t of done.slice(0, limit)) {
      const d = dayKey(t.completedAt!)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(t)
    }
    return { entries: [...map.entries()], total: done.length }
  }, [tasks, limit])
  if (!groups.total) return <EmptyState icon={<CheckCheck className="size-6" />} title="No completed tasks yet" body="Everything you finish is kept here as a record of your work." />
  return (
    <div className="space-y-5">
      {groups.entries.map(([day, list]) => (
        <section key={day}>
          <h3 className="flex items-baseline justify-between border-b border-line px-1 pb-1.5 font-display text-lg font-medium">
            {relativeDayLabel(day)}
            <span className="font-sans text-xs font-bold text-ink-3">{list.length} done</span>
          </h3>
          <PlainTasks tasks={list} />
        </section>
      ))}
      {groups.total > limit && (
        <Button block onClick={() => setLimit((l) => l + 100)}>
          Show more
        </Button>
      )}
    </div>
  )
}

// ───────────────────────── projects ─────────────────────────

function ProjectsView({ tasks }: { tasks: Task[] }) {
  const projects = useProjects()
  const archived = useProjects(true).filter((p) => p.archived)
  const counts = useTaskSessions()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => {
          const list = tasks.filter((t) => t.projectId === p.id)
          const open = list.filter((t) => !t.done).length
          const done = list.length - open
          const seconds = list.reduce((a, t) => a + counts.seconds(t.id), 0)
          return (
            <button key={p.id} type="button" onClick={() => navigate(`#/tasks?view=projects&project=${p.id}`)} className="rounded-card border border-line bg-surface p-4 text-left shadow-soft transition-transform active:scale-[0.99]">
              <div className="flex items-center gap-2.5">
                <span className="size-3 rounded-full" style={{ background: p.color }} />
                <span className="truncate font-display text-lg font-medium">{p.name}</span>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                {open} open · {done} done · {formatDuration(seconds)} focused
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%`, background: p.color }} />
              </div>
            </button>
          )
        })}
        <button type="button" onClick={() => setEditing('new')} className="flex min-h-28 items-center justify-center gap-2 rounded-card border border-dashed border-line-strong p-4 text-sm font-bold text-ink-2 hover:bg-surface-2">
          <FolderPlus className="size-5" /> New project
        </button>
      </div>
      {archived.length > 0 && (
        <Collapsible title="Archived" count={archived.length}>
          <div className="space-y-1">
            {archived.map((p) => (
              <button key={p.id} type="button" onClick={() => navigate(`#/tasks?view=projects&project=${p.id}`)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-2 hover:bg-surface-2">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </Collapsible>
      )}
      <ProjectSheet project={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ProjectDetail({ id, tasks }: { id: string; tasks: Task[] }) {
  const projects = useProjects(true)
  const project = projects.find((p) => p.id === id)
  const counts = useTaskSessions()
  const [editing, setEditing] = useState<Project | null>(null)
  const list = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id])
  const open = useMemo(() => list.filter((t) => !t.done).sort(compareTasks), [list])
  const done = useMemo(() => list.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), [list])
  if (!project) return <EmptyState title="Project not found" action={<Button onClick={() => navigate('#/tasks?view=projects')}>Back to projects</Button>} />
  const seconds = list.reduce((a, t) => a + counts.seconds(t.id), 0)
  const estimate = open.reduce((a, t) => a + Math.max(0, t.estimatedPomodoros - counts.count(t.id)), 0)

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="All projects" onClick={() => navigate('#/tasks?view=projects')}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="size-3 shrink-0 rounded-full" style={{ background: project.color }} />
        <h2 className="min-w-0 flex-1 truncate font-display text-2xl font-medium">{project.name}</h2>
        <Menu
          trigger={(p) => (
            <IconButton label="Project options" {...p}>
              <MoreHorizontal className="size-5" />
            </IconButton>
          )}
          items={[
            { label: 'Edit project', icon: <Pencil />, onSelect: () => setEditing(project) },
            { label: project.archived ? 'Unarchive' : 'Archive', icon: <Archive />, onSelect: () => void patch('projects', project.id, { archived: !project.archived }) },
          ]}
        />
      </div>
      {project.note && <p className="mb-3 px-1 text-[15px] leading-relaxed text-ink-2">{project.note}</p>}
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Open', String(open.length)],
          ['Focused', formatDuration(seconds)],
          ['Left', `${estimate} sessions`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-2/70 px-2 py-2.5">
            <p className="text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">{k}</p>
            <p className="tabular mt-0.5 font-display text-lg font-medium">{v}</p>
          </div>
        ))}
      </div>
      <QuickAdd defaults={{ projectId: project.id, labelId: project.labelId }} placeholder={`Add to ${project.name}`} />
      <div className="mt-3">{open.length ? <ReorderableTasks tasks={open} /> : <EmptyState title="No open tasks" body="Add the next step above." className="py-8" />}</div>
      <Collapsible title="Completed" count={done.length}>
        <PlainTasks tasks={done} />
      </Collapsible>
      <ProjectSheet project={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export function ProjectSheet({ project, onClose }: { project: Project | 'new' | null; onClose: () => void }) {
  const labels = useLabels()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PALETTE[5].value)
  const [labelId, setLabelId] = useState<string>('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!project) return
    if (project === 'new') {
      setName('')
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)].value)
      setLabelId('')
      setNote('')
    } else {
      setName(project.name)
      setColor(project.color)
      setLabelId(project.labelId ?? '')
      setNote(project.note)
    }
  }, [project])

  const save = async () => {
    const data = { name: name.trim() || 'Untitled project', color, labelId: labelId || null, note }
    if (project === 'new') {
      const p = await create('projects', { ...data, archived: false, order: await nextOrder('projects') })
      onClose()
      navigate(`#/tasks?view=projects&project=${p.id}`)
    } else if (project) {
      await patch('projects', project.id, data)
      onClose()
    }
  }

  const del = async () => {
    if (!project || project === 'new') return
    const ok = await confirmDialog({ title: `Delete “${project.name}”?`, body: 'Its tasks move to your inbox. Focus history is kept.', confirmLabel: 'Delete project', danger: true })
    if (!ok) return
    const tasks = await db.tasks.where('projectId').equals(project.id).toArray()
    for (const t of tasks) await patch('tasks', t.id, { projectId: null })
    await remove('projects', project.id)
    onClose()
    navigate('#/tasks?view=projects')
  }

  return (
    <Sheet open={!!project} onClose={onClose} title={project === 'new' ? 'New project' : 'Edit project'}>
      <div className="space-y-5">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Organic Chemistry, Thesis, History essay" data-autofocus />
        </Field>
        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label="Default subject" hint="Sessions on this project’s tasks are tracked against this subject.">
          <Select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
            <option value="">None</option>
            {flattenLabels(labels).map(({ label, path }: { label: Label; path: string }) => (
              <option key={label.id} value={label.id}>
                {path}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Outcome, deadline, links…" />
        </Field>
        <div className="flex gap-2">
          {project && project !== 'new' && (
            <Button variant="danger" onClick={() => void del()}>
              Delete
            </Button>
          )}
          <Button block variant="primary" onClick={() => void save()}>
            {project === 'new' ? 'Create project' : 'Save'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
