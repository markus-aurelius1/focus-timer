import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { Archive, ArrowLeft, CalendarCheck2, CheckCheck, ChevronDown, ChevronRight, Inbox, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { navigate, useRoute } from '@/app/router'
import { Workspace } from '@/app/Workspace'
import { useUi } from '@/app/ui-store'
import { useLabels, useLookups, useProfiles, useProjects, useSettings, useTasks } from '@/data/hooks'
import { create, nextOrder, patch, reorder } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Label, Project, Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { useDay } from '@/lib/useDay'
import { addDaysKey, dayKey, diffDays, formatDuration, longDate, relativeDayLabel, todayKey, type DayKey } from '@/lib/time'
import { byPriorityThenOrder, compareTasks, groupUpcoming, isInbox, isOverdue, isToday, tagUsage } from '@/planner/tasks'
import { labelScope } from '@/stats/aggregate'
import { Button, Field, IconButton, Select, TextArea, TextInput } from '@/ui/controls'
import { ColorPicker } from '@/ui/ColorPicker'
import { EmptyState } from '@/ui/feedback'
import { Menu } from '@/ui/Menu'
import { Sheet, SheetActions, SheetFooter } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'
import { useTaskSessions } from '@/features/shared/useTaskSessions'
import { useTodayProgress } from '@/features/shared/useProgress'
import { HabitsView } from './HabitsView'
import { PlanTabs, type PlanView } from './PlanTabs'
import { QuickAdd } from './QuickAdd'
import { TaskItem } from './TaskItem'
import { deleteProject } from '@/data/deletion'
import { toast } from '@/ui/toast'
import { useRouteState } from '@/app/routeState'

type View = Exclude<PlanView, 'calendar'>
const VIEWS: View[] = ['today', 'upcoming', 'inbox', 'projects', 'habits', 'done']

export function TasksScreen() {
  const today = useDay()
  const route = useRoute()
  const view = VIEWS.find((v) => v === route.params.get('view')) ?? 'today'
  const projectId = route.params.get('project')
  const [labelFilter, setLabelFilter] = useRouteState<string>('tasks:label', '')
  const labels = useLabels()
  const allTasks = useTasks()
  const quickAddOpen = useUi((s) => s.quickAddOpen)

  const tags = useMemo(() => tagUsage(allTasks), [allTasks])
  const tasks = useMemo(() => {
    if (!labelFilter) return allTasks
    if (labelFilter.startsWith('tag:')) {
      const tag = labelFilter.slice(4)
      return allTasks.filter((t) => t.tags?.includes(tag))
    }
    const scope = labelScope(labels, labelFilter)
    return allTasks.filter((t) => t.labelId && scope.has(t.labelId))
  }, [allTasks, labelFilter, labels])
  const inboxCount = useMemo(() => allTasks.filter(isInbox).length, [allTasks])

  return (
    <Workspace
      title="Plan"
      meta={longDate(today)}
      actions={
        view !== 'habits' &&
        (labels.length > 0 || tags.length > 0) && (
          <Select compact value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="max-w-32 sm:max-w-44" aria-label="Filter by subject or tag">
            <option value="">All tasks</option>
            {labels.length > 0 && (
              <optgroup label="Subjects">
                {flattenLabels(labels).map(({ label, path }) => (
                  <option key={label.id} value={label.id}>
                    {path}
                  </option>
                ))}
              </optgroup>
            )}
            {tags.length > 0 && (
              <optgroup label="Tags">
                {tags.map((t) => (
                  <option key={t} value={`tag:${t}`}>
                    #{t}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        )
      }
      toolbar={<PlanTabs current={view} inboxCount={inboxCount} />}
    >
      <div className="pt-2">
        {view === 'today' && <TodayView tasks={tasks} autoFocus={quickAddOpen} />}
        {view === 'upcoming' && <UpcomingView tasks={tasks} />}
        {view === 'inbox' && <InboxView tasks={tasks} autoFocus={quickAddOpen} />}
        {view === 'projects' && (projectId ? <ProjectDetail id={projectId} tasks={tasks} /> : <ProjectsView tasks={tasks} />)}
        {view === 'habits' && <HabitsView />}
        {view === 'done' && <DoneView tasks={tasks} />}
      </div>
    </Workspace>
  )
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
    <Reorder.Group axis="y" values={items} onReorder={setItems} className="-mx-2">
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
    <Reorder.Item value={task} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="relative rounded-xl bg-bg" whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-lift)', zIndex: 10 }}>
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
    <div className="-mx-2">
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
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 py-2 t-label" aria-expanded={open}>
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
        <p className="t-meta mt-3 px-1 leading-relaxed">
          <span className="font-bold text-ink-2">
            {todays.length} {todays.length === 1 ? 'task' : 'tasks'} · {remainingSessions} {remainingSessions === 1 ? 'session' : 'sessions'} left, about {formatDuration(plannedSeconds)}.
          </span>{' '}
          {progress.targetSeconds > 0
            ? plannedSeconds > goalLeft + perSession
              ? `That’s more than your remaining goal (${formatDuration(goalLeft)}). Consider moving something to tomorrow.`
              : goalLeft > 0
                ? `${formatDuration(goalLeft)} to reach today’s goal.`
                : 'Daily goal reached – anything more is a bonus.'
            : 'Estimate sessions on tasks to see your day’s load.'}
        </p>
      )}

      <Collapsible
        title="Overdue"
        count={overdue.length}
        defaultOpen
        action={
          <button
            type="button"
            className="press rounded-full px-2 py-1 text-xs font-bold text-accent hover:bg-accent-soft"
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
          <div className="mt-2">
            <EmptyState icon={<CalendarCheck2 className="size-6" />} title={doneToday.length ? 'All done for today' : 'Nothing planned yet'} body={doneToday.length ? 'Nicely done. Plan tomorrow, or enjoy the rest of your day.' : 'Add what you want to get done today, or pull tasks in from your inbox and upcoming list.'} />
          </div>
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
    <div className="space-y-4">
      {week.map((day) => (
        <DayGroup key={day} day={day} tasks={byDay.get(day) ?? []} today={today} />
      ))}
      {later.length > 0 && <h3 className="px-1 pt-2 t-label text-ink-3">Later</h3>}
      {later.map((g) => (
        <DayGroup key={g.day} day={g.day} tasks={g.tasks} today={today} />
      ))}
    </div>
  )
}

function DayGroup({ day, tasks, today }: { day: DayKey; tasks: Task[]; today: DayKey }) {
  return (
    <section>
      <div className="flex min-h-8 items-center justify-between gap-2 px-1">
        <h3 className="t-heading">
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
          <h3 className="t-heading flex min-h-8 items-center justify-between px-1">
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
      <div className="-mx-2">
        {projects.map((p) => {
          const list = tasks.filter((t) => t.projectId === p.id)
          const open = list.filter((t) => !t.done).length
          const done = list.length - open
          const seconds = list.reduce((a, t) => a + counts.seconds(t.id), 0)
          return (
            <button key={p.id} type="button" onClick={() => navigate(`#/tasks?view=projects&project=${p.id}`)} className="row group w-full px-2 py-3 text-left">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <span className="t-meta block">
                  {open} open · {done} done · {formatDuration(seconds)} focused
                </span>
              </span>
              <span className="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-surface-3 sm:block" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%`, background: p.color }} />
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          )
        })}
      </div>
      <Button className="mt-3" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
        New project
      </Button>
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
        <h2 className="t-title min-w-0 flex-1 truncate">{project.name}</h2>
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
      <p className="t-meta mb-4 px-1">
        {open.length} open · {formatDuration(seconds)} focused · {estimate} {estimate === 1 ? 'session' : 'sessions'} left
      </p>
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
    const deleted = await deleteProject(project.id)
    onClose()
    navigate('#/tasks?view=projects')
    if (deleted) toast({ title: `“${project.name}” deleted`, body: 'Its tasks moved to your inbox.', action: { label: 'Undo', run: () => void deleted.undo() } })
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
      </div>
      <SheetFooter>
        <SheetActions
          start={
            project &&
            project !== 'new' && (
              <IconButton label="Delete project" onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            )
          }
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            {project === 'new' ? 'Create project' : 'Save'}
          </Button>
        </SheetActions>
      </SheetFooter>
    </Sheet>
  )
}
