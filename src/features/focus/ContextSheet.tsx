import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLabels, useOpenTasks, useProjects } from '@/data/hooks'
import { create } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { useDay } from '@/lib/useDay'
import { focusContextForTask } from '@/planner/focusContext'
import { byPriorityThenOrder, isOverdue, isToday } from '@/planner/tasks'
import { useUi } from '@/app/ui-store'
import { useTimer } from '@/timer/store'
import { Button, Chip, Dot, SectionTitle, TextArea, TextInput } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'

/** Choose what the current session counts towards: a subject/label, a task, and an intention. */
export function ContextSheet() {
  const open = useUi((s) => s.contextOpen)
  const close = () => useUi.getState().set({ contextOpen: false })
  const context = useTimer((s) => s.timer.context)
  const setContext = useTimer((s) => s.setContext)
  const labels = useLabels()
  const projects = useProjects()
  const tasks = useOpenTasks()
  const [query, setQuery] = useState('')
  const [newLabel, setNewLabel] = useState<string | null>(null)
  const today = useDay()

  const tree = useMemo(() => flattenLabels(labels), [labels])
  const projectOf = (id: string | null) => projects.find((p) => p.id === id)

  const { todays, others } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (t: Task) => !q || t.title.toLowerCase().includes(q)
    const todays = tasks.filter((t) => (isToday(t, today) || isOverdue(t, today)) && match(t)).sort(byPriorityThenOrder)
    const others = tasks.filter((t) => !isToday(t, today) && !isOverdue(t, today) && match(t)).sort(byPriorityThenOrder).slice(0, q ? 30 : 12)
    return { todays, others }
  }, [tasks, query, today])

  const pickTask = (t: Task | null) => {
    if (!t) return setContext({ taskId: null, projectId: null })
    const project = projectOf(t.projectId)
    setContext(focusContextForTask(t, project, context))
  }

  const addLabel = async () => {
    const name = newLabel?.trim()
    if (!name) return setNewLabel(null)
    const l = await create('labels', { name, color: PALETTE[labels.length % PALETTE.length].value, parentId: null, kind: 'subject', archived: false, order: labels.length })
    setContext({ labelId: l.id })
    setNewLabel(null)
  }

  const renderTask = (t: Task) => {
    const active = context.taskId === t.id
    const project = projectOf(t.projectId)
    return (
      <button key={t.id} type="button" onClick={() => pickTask(active ? null : t)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', active ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', active ? 'border-transparent bg-accent text-accent-ink' : 'border-line-strong')}>
          {active && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{t.title}</span>
          {project && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
              <Dot color={project.color} className="size-2" />
              {project.name}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <Sheet open={open} onClose={close} title="What are you working on?" footer={<Button block variant="primary" onClick={close}>Done</Button>}>
      <div className="space-y-6">
        <section>
          <SectionTitle>Subject</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Chip active={!context.labelId} onClick={() => setContext({ labelId: null })}>
              None
            </Chip>
            {tree.map(({ label, depth, path }) => (
              <Chip key={label.id} color={label.color} active={context.labelId === label.id} onClick={() => setContext({ labelId: label.id })}>
                {depth > 0 ? path : label.name}
              </Chip>
            ))}
            {newLabel === null ? (
              <Chip onClick={() => setNewLabel('')}>
                <span className="inline-flex items-center gap-1">
                  <Plus className="size-3" /> New
                </span>
              </Chip>
            ) : (
              <form
                className="flex w-full gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void addLabel()
                }}
              >
                <TextInput autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Subject name" className="py-2" />
                <Button type="submit" variant="primary">
                  Add
                </Button>
              </form>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>Task</SectionTitle>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="py-2 pl-9" />
          </div>
          <div className="space-y-0.5">
            {todays.length > 0 && <p className="px-3 pt-1 pb-1 text-xs font-bold text-ink-3">Today</p>}
            {todays.map(renderTask)}
            {others.length > 0 && <p className="px-3 pt-3 pb-1 text-xs font-bold text-ink-3">Other tasks</p>}
            {others.map(renderTask)}
            {!todays.length && !others.length && <p className="px-3 py-4 text-sm text-ink-2">No matching open tasks.</p>}
          </div>
        </section>

        <section>
          <SectionTitle>Intention</SectionTitle>
          <TextArea value={context.note} onChange={(e) => setContext({ note: e.target.value })} placeholder="What will you have done by the end of this session?" rows={2} />
        </section>
      </div>
    </Sheet>
  )
}
