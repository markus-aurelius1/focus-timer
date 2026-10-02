import { Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLabels, useOpenTasks, useProjects, useTasks } from '@/data/hooks'
import { create, patch } from '@/data/repo'
import type { Session } from '@/data/types'
import { cn } from '@/lib/cn'
import { atTime, dayKey, hhmm, todayKey } from '@/lib/time'
import { Button, Field, IconButton, Select, Stepper, TextArea, TextInput, Toggle } from '@/ui/controls'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'
import { deleteSession } from '@/data/deletion'
import { toast } from '@/ui/toast'

/** Edit a recorded session or log one by hand (e.g. study done away from the app). */
export function SessionSheet({ session, onClose }: { session: Session | 'new' | null; onClose: () => void }) {
  const labels = useLabels()
  const projects = useProjects()
  const openTasks = useOpenTasks()
  const allTasks = useTasks()
  const tree = useMemo(() => flattenLabels(labels), [labels])
  const [date, setDate] = useState(todayKey())
  const [start, setStart] = useState('09:00')
  const [minutes, setMinutes] = useState(25)
  const [labelId, setLabelId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [note, setNote] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [completed, setCompleted] = useState(true)

  useEffect(() => {
    if (!session) return
    if (session === 'new') {
      const d = new Date(Date.now() - 25 * 60_000)
      setDate(todayKey())
      setStart(hhmm(d.getTime()))
      setMinutes(25)
      setLabelId('')
      setTaskId('')
      setProjectId('')
      setNote('')
      setRating(null)
      setCompleted(true)
    } else {
      setDate(session.date)
      setStart(hhmm(session.startedAt))
      setMinutes(Math.max(1, Math.round(session.duration / 60)))
      setLabelId(session.labelId ?? '')
      setTaskId(session.taskId ?? '')
      setProjectId(session.projectId ?? '')
      setNote(session.note)
      setRating(session.rating)
      setCompleted(session.completed)
    }
  }, [session])

  const taskChoices = useMemo(() => {
    const current = session && session !== 'new' && session.taskId ? allTasks.find((t) => t.id === session.taskId) : undefined
    return current && !openTasks.some((t) => t.id === current.id) ? [current, ...openTasks] : openTasks
  }, [openTasks, allTasks, session])

  const save = async () => {
    const startedAt = atTime(date, start)
    const existing = session && session !== 'new' ? session : null
    // Keep the original wall-clock span if only metadata changed; otherwise span = duration.
    const span = existing && existing.duration === minutes * 60 && existing.startedAt === startedAt ? existing.endedAt - existing.startedAt : minutes * 60_000
    const task = taskId ? allTasks.find((t) => t.id === taskId) : undefined
    const data = {
      startedAt,
      endedAt: startedAt + span,
      duration: minutes * 60,
      date: dayKey(startedAt),
      labelId: labelId || task?.labelId || null,
      taskId: taskId || null,
      projectId: projectId || task?.projectId || null,
      note,
      rating,
      completed,
    }
    if (existing) await patch('sessions', existing.id, data)
    else await create('sessions', { ...data, mode: 'stopwatch', plannedDuration: null, profileId: null, pauseCount: 0, source: 'manual' })
    onClose()
  }

  const del = async () => {
    if (!session || session === 'new') return
    const deleted = await deleteSession(session.id)
    onClose()
    if (deleted) toast({ title: 'Session deleted', body: 'It no longer counts towards your statistics, XP or Atlas progress.', action: { label: 'Undo', run: () => void deleted.undo() } })
  }

  return (
    <Sheet
      open={!!session}
      onClose={onClose}
      title={session === 'new' ? 'Log a session' : 'Edit session'}
      subtitle={session === 'new' ? 'Record focus time you did away from the timer.' : undefined}
      footer={
        <SheetActions
          start={
            session &&
            session !== 'new' && (
              <IconButton label="Delete session" onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            )
          }
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            {session === 'new' ? 'Log session' : 'Save'}
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label="Started">
            <TextInput type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Focused for</span>
          <Stepper label="Minutes" value={minutes} onChange={setMinutes} min={1} max={600} step={5} suffix="m" />
        </div>
        <Field label="Subject">
          <Select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
            <option value="">None</option>
            {tree.map(({ label, path }) => (
              <option key={label.id} value={label.id}>
                {path}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Task">
            <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">None</option>
              {taskChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 t-label">Focus quality</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" aria-label={`${r} of 5`} aria-pressed={rating === r} onClick={() => setRating(rating === r ? null : r)} className="rounded-full p-1">
                <Star className={cn('size-6', (rating ?? 0) >= r ? 'fill-accent text-accent' : 'text-line-strong')} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>
            <span className="block text-sm font-semibold">Completed as planned</span>
            <span className="block text-xs text-ink-2">Counts towards your completion rate.</span>
          </span>
          <Toggle label="Completed" checked={completed} onChange={setCompleted} />
        </div>
        <Field label="Notes">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </div>
    </Sheet>
  )
}
