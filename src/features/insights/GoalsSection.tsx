import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useGoals, useLabels, useProjects, useSessions, useSettings } from '@/data/hooks'
import { create, nextOrder, patch } from '@/data/repo'
import type { Goal, GoalPeriod } from '@/data/types'
import { formatDuration, todayKey } from '@/lib/time'
import { goalProgress } from '@/stats/aggregate'
import { Button, Field, IconButton, Segmented, Select, Stepper, TextInput } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { Ring } from '@/ui/Ring'
import { Sheet, SheetActions, SheetFooter } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'
import { deleteGoal } from '@/data/deletion'
import { toast } from '@/ui/toast'

const PERIOD_NAME: Record<GoalPeriod, string> = { day: 'Today', week: 'This week', month: 'This month' }

export function GoalsSection() {
  const goals = useGoals()
  const sessions = useSessions()
  const labels = useLabels(true)
  const projects = useProjects(true)
  const settings = useSettings()
  const today = todayKey()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const active = goals.filter((g) => g.active)
  const progress = useMemo(() => active.map((g) => goalProgress(g, sessions, labels, today, settings.weekStartsOn)), [active, sessions, labels, today, settings.weekStartsOn])

  return (
    <section className="border-t border-line py-5 sm:py-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="t-heading">Goals</h3>
        <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setEditing('new')}>
          Add goal
        </Button>
      </div>
      {progress.length === 0 ? (
        <EmptyState icon={<Target className="size-6" />} title="Set a target" body="Daily or weekly focus goals – overall or for one subject – keep effort steady." className="py-6" />
      ) : (
        <ul className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
          {progress.map((p) => {
            const label = labels.find((l) => l.id === p.goal.labelId)
            const project = projects.find((x) => x.id === p.goal.projectId)
            const color = label?.color ?? project?.color ?? 'var(--chart)'
            return (
              <li key={p.goal.id} className="flex items-center gap-3.5 py-2">
                <Ring value={p.ratio} size={52} stroke={5} color={p.met ? 'var(--success)' : color} label={`${Math.round(p.ratio * 100)}%`}>
                  <span className="text-[11px] font-bold">{Math.min(999, Math.round(p.ratio * 100))}%</span>
                </Ring>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.goal.title}</p>
                  <p className="text-xs text-ink-2">
                    {PERIOD_NAME[p.goal.period]} · {formatDuration(p.seconds)} of {formatDuration(p.targetSeconds)}
                  </p>
                  {(label || project) && <p className="mt-0.5 truncate text-xs text-ink-3">{label?.name ?? project?.name}</p>}
                </div>
                <button type="button" aria-label={`Edit ${p.goal.title}`} onClick={() => setEditing(p.goal)} className="rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink">
                  <Pencil className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <GoalSheet goal={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function GoalSheet({ goal, onClose }: { goal: Goal | 'new' | null; onClose: () => void }) {
  const labels = useLabels()
  const projects = useProjects()
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<GoalPeriod>('week')
  const [minutes, setMinutes] = useState(300)
  const [labelId, setLabelId] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (!goal) return
    const g = goal === 'new' ? null : goal
    setTitle(g?.title ?? '')
    setPeriod(g?.period ?? 'week')
    setMinutes(g?.targetMinutes ?? 300)
    setLabelId(g?.labelId ?? '')
    setProjectId(g?.projectId ?? '')
  }, [goal])

  const autoTitle = () => {
    const scope = labels.find((l) => l.id === labelId)?.name ?? projects.find((p) => p.id === projectId)?.name ?? 'Focus'
    return `${period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'} ${scope === 'Focus' ? 'focus' : scope}`
  }

  const save = async () => {
    const data = { title: title.trim() || autoTitle(), period, targetMinutes: minutes, labelId: labelId || null, projectId: projectId || null, active: true }
    if (goal === 'new') await create('goals', { ...data, order: await nextOrder('goals') })
    else if (goal) await patch('goals', goal.id, data)
    onClose()
  }

  const del = async () => {
    if (!goal || goal === 'new') return
    const deleted = await deleteGoal(goal.id)
    onClose()
    if (deleted) toast({ title: 'Goal deleted', action: { label: 'Undo', run: () => void deleted.undo() } })
  }

  return (
    <Sheet open={!!goal} onClose={onClose} title={goal === 'new' ? 'New goal' : 'Edit goal'}>
      <div className="space-y-5">
        <Field label="Period">
          <Segmented<GoalPeriod>
            className="w-full"
            value={period}
            onChange={(p) => {
              setPeriod(p)
              setMinutes(p === 'day' ? 120 : p === 'week' ? 600 : 2400)
            }}
            options={[
              { value: 'day', label: 'Daily' },
              { value: 'week', label: 'Weekly' },
              { value: 'month', label: 'Monthly' },
            ]}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Target</span>
          <div className="flex items-center gap-2">
            <Stepper label="Target minutes" value={minutes} onChange={setMinutes} min={5} max={10000} step={period === 'day' ? 15 : 30} suffix="m" />
          </div>
        </div>
        <p className="-mt-3 text-right text-xs text-ink-3">{formatDuration(minutes * 60)}</p>
        <Field label="Subject" hint="Includes its topics.">
          <Select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
            <option value="">All focus</option>
            {flattenLabels(labels).map(({ label, path }) => (
              <option key={label.id} value={label.id}>
                {path}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle()} />
        </Field>
      </div>
      <SheetFooter>
        <SheetActions
          start={
            goal &&
            goal !== 'new' && (
              <IconButton label="Delete goal" onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            )
          }
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            Save goal
          </Button>
        </SheetActions>
      </SheetFooter>
    </Sheet>
  )
}
