import { useLiveQuery } from 'dexie-react-hooks'
import { Reorder, useDragControls } from 'motion/react'
import { AlarmClock, CalendarClock, CalendarPlus, Check, Clock3, Copy, Flag, FolderOpen, GripVertical, Hash, Play, Plus, Repeat2, Tag, Timer, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useUi } from '@/app/ui-store'
import { navigate } from '@/app/router'
import { db } from '@/data/db'
import { useProfiles, useSettings } from '@/data/hooks'
import { create, patch } from '@/data/repo'
import type { RecurrenceRule, Subtask, Task } from '@/data/types'
import { uid } from '@/lib/id'
import { cn } from '@/lib/cn'
import { addDaysKey, atTime, dayKey, formatDuration, formatTimeOfDay, hhmm, relativeDayLabel, todayKey, weekdayOf, weekdayShort, type DayKey } from '@/lib/time'
import { describeRule, RECURRENCE_PRESETS } from '@/planner/recurrence'
import { addTask, blankTask, completeTask, deleteTask, restoreTask, uncompleteTask } from '@/planner/tasks'
import { Button, Chip, IconButton, Select, Stepper, TextArea, TextInput } from '@/ui/controls'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { focusOnTask } from '@/features/shared/focusOnTask'
import { DateQuick, DeadlineField, EstimateField, FieldRow, PriorityPicker, ProfilePicker, ProjectPicker, SubjectPicker, TagInput } from './fields'
import { TaskCheck } from './TaskItem'

type Draft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

const EDITABLE = ['title', 'notes', 'projectId', 'labelId', 'tags', 'profileId', 'priority', 'plannedFor', 'dueDate', 'dueTime', 'reminderAt', 'estimatedPomodoros', 'subtasks', 'recurrence'] as const
type Editable = Pick<Task, (typeof EDITABLE)[number]>
const pickEditable = (t: Draft | Task): Editable => Object.fromEntries(EDITABLE.map((k) => [k, t[k] ?? (k === 'tags' ? [] : k === 'profileId' ? null : t[k])])) as Editable

/** Create or edit a task. Existing tasks save automatically when the sheet closes. */
export function TaskSheet() {
  const state = useUi((s) => s.taskSheet)
  const close = useUi((s) => s.closeTask)
  const existing = useLiveQuery(() => (state?.id ? db.tasks.get(state.id) : undefined), [state?.id])
  const [draft, setDraft] = useState<Draft | null>(null)
  const loadedFor = useRef<string | null>(null)

  // Load the draft when the sheet opens (or the task first arrives from the DB).
  useEffect(() => {
    if (!state) {
      setDraft(null)
      loadedFor.current = null
      return
    }
    const key = state.id ?? 'new'
    if (loadedFor.current === key) return
    if (state.id) {
      if (!existing) return
      setDraft({ ...existing, tags: existing.tags ?? [], profileId: existing.profileId ?? null })
    } else {
      setDraft({
        ...blankTask({
          title: state.draft?.title ?? '',
          plannedFor: state.draft?.plannedFor ?? null,
          projectId: state.draft?.projectId ?? null,
          labelId: state.draft?.labelId ?? null,
        }),
      })
    }
    loadedFor.current = key
  }, [state, existing])

  const isNew = !state?.id
  const edits = draft ? pickEditable(draft) : null
  const dirty = !!edits && !!existing && JSON.stringify(edits) !== JSON.stringify(pickEditable(existing))

  const save = async () => {
    if (!draft || !edits) return
    if (isNew) {
      if (!draft.title.trim()) return
      await addTask({ ...draft, title: draft.title.trim() })
    } else if (existing && dirty) {
      // Only user-editable fields – completion state is owned by the checkbox/actions.
      await patch('tasks', existing.id, { ...edits, title: edits.title.trim() || existing.title })
    }
  }

  const onClose = () => {
    if (!isNew) void save()
    close()
  }
  const onAdd = async () => {
    if (!draft?.title.trim()) return
    await save()
    close()
    toast({ title: 'Task added', body: draft.title.trim(), tone: 'success' })
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  return (
    <Sheet
      open={!!state && !!draft}
      onClose={onClose}
      size="lg"
      label={isNew ? 'New task' : 'Edit task'}
      header={draft && <TitleRow draft={draft} existing={isNew ? undefined : existing} onTitle={(v) => set('title', v)} onEnter={isNew ? () => void onAdd() : undefined} onClose={onClose} />}
      footer={
        draft &&
        (isNew ? (
          <SheetActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => void onAdd()} disabled={!draft.title.trim()} icon={<Plus className="size-4" />}>
              Add task
            </Button>
          </SheetActions>
        ) : (
          existing && <ExistingActions task={{ ...existing, ...pickEditable(draft) }} onClose={onClose} />
        ))
      }
    >
      {draft && <TaskFields draft={draft} set={set} setDraft={setDraft} existing={isNew ? undefined : existing} />}
    </Sheet>
  )
}

function TitleRow({ draft, existing, onTitle, onEnter, onClose }: { draft: Draft; existing?: Task; onTitle: (v: string) => void; onEnter?: () => void; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-2 pb-2 sm:px-6 sm:pt-5">
      {existing && (
        <div className="pt-2.5">
          <TaskCheck task={existing} />
        </div>
      )}
      <TextArea
        data-autofocus={existing ? undefined : true}
        value={draft.title}
        onChange={(e) => onTitle(e.target.value.replace(/\n/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
        }}
        aria-label="Task title"
        placeholder="What needs doing?"
        rows={1}
        // Inline, so the shared field styles (border, min height, resize) can't win over this borderless title.
        style={{ resize: 'none', minHeight: 0, borderColor: 'transparent', boxShadow: 'none' }}
        className="max-h-40 min-h-0 flex-1 resize-none border-transparent bg-transparent px-1 py-1.5 font-display text-[22px] leading-snug font-medium [field-sizing:content] focus:border-transparent focus:ring-0 focus-visible:outline-none"
      />
      <IconButton label="Close" size="sm" onClick={onClose} className="mt-1.5">
        <X className="size-4.5" />
      </IconButton>
    </div>
  )
}

function TaskFields({
  draft,
  set,
  setDraft,
  existing,
}: {
  draft: Draft
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void
  setDraft: (fn: (d: Draft | null) => Draft | null) => void
  existing: Task | undefined
}) {
  const today = todayKey()
  const id = useId()
  return (
    <div className="space-y-5">
      <TextArea value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes, links, what “done” looks like…" rows={2} className="text-[15px]" aria-label="Notes" />

      <div className="divide-y divide-line rounded-2xl border border-line">
        <FieldRow icon={<Tag />} label="Subject" htmlFor={`${id}-subject`}>
          <SubjectPicker id={`${id}-subject`} value={draft.labelId} onChange={(v) => set('labelId', v)} />
        </FieldRow>
        <FieldRow icon={<Hash />} label="Tags" htmlFor={`${id}-tags`}>
          <TagInput id={`${id}-tags`} value={draft.tags ?? []} onChange={(v) => set('tags', v)} />
        </FieldRow>
        <FieldRow icon={<Flag />} label="Priority">
          <PriorityPicker value={draft.priority} onChange={(p) => set('priority', p)} />
        </FieldRow>
        <FieldRow icon={<CalendarClock />} label="Plan for" htmlFor={`${id}-plan`}>
          <DateQuick id={`${id}-plan`} value={draft.plannedFor} onChange={(v) => set('plannedFor', v)} today={today} />
        </FieldRow>
        <FieldRow icon={<Flag />} label="Deadline" htmlFor={`${id}-due`}>
          <DeadlineField id={`${id}-due`} date={draft.dueDate} time={draft.dueTime} onChange={(date, time) => setDraft((d) => (d ? { ...d, dueDate: date, dueTime: time } : d))} />
        </FieldRow>
        <FieldRow icon={<AlarmClock />} label="Reminder">
          <ReminderPicker draft={draft} onChange={(v) => set('reminderAt', v)} />
        </FieldRow>
        <FieldRow icon={<Repeat2 />} label="Repeat">
          <RepeatPicker rule={draft.recurrence} anchor={draft.plannedFor ?? draft.dueDate ?? today} onChange={(r) => setDraft((d) => (d ? { ...d, recurrence: r, plannedFor: r && !d.plannedFor && !d.dueDate ? today : d.plannedFor } : d))} />
        </FieldRow>
        <FieldRow icon={<Clock3 />} label="Estimate">
          <EstimateField value={draft.estimatedPomodoros} onChange={(v) => set('estimatedPomodoros', v)} profileId={draft.profileId} />
        </FieldRow>
        <FieldRow icon={<Timer />} label="Timer" htmlFor={`${id}-profile`}>
          <ProfilePicker id={`${id}-profile`} value={draft.profileId ?? null} onChange={(v) => set('profileId', v)} />
        </FieldRow>
        <FieldRow icon={<FolderOpen />} label="Project" htmlFor={`${id}-project`}>
          <ProjectPicker id={`${id}-project`} value={draft.projectId} onChange={(v) => set('projectId', v)} />
        </FieldRow>
      </div>

      <Subtasks items={draft.subtasks} onChange={(s) => set('subtasks', s)} />

      {existing && <TaskActivity task={existing} />}
    </div>
  )
}

function ReminderPicker({ draft, onChange }: { draft: Draft; onChange: (v: number | null) => void }) {
  const settings = useSettings()
  const day = draft.dueDate ?? draft.plannedFor ?? todayKey()
  const presets: Array<[string, number]> = []
  if (draft.dueDate && draft.dueTime) {
    const due = atTime(draft.dueDate, draft.dueTime)
    presets.push(['At deadline', due], ['1 hour before', due - 3_600_000], ['1 day before', due - 86_400_000])
  }
  presets.push(['Morning of', atTime(day, '09:00')], ['Evening before', atTime(addDaysKey(day, -1), '19:00')])
  const future = presets.filter(([, t]) => t > Date.now())
  const localValue = draft.reminderAt ? `${dayKey(draft.reminderAt)}T${hhmm(draft.reminderAt)}` : ''
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {draft.reminderAt ? (
        <>
          <Chip active>{`${relativeDayLabel(dayKey(draft.reminderAt))} ${formatTimeOfDay(draft.reminderAt, settings.use24h)}`}</Chip>
          <button type="button" className="text-xs font-bold text-ink-3 hover:text-ink" onClick={() => onChange(null)}>
            Remove
          </button>
        </>
      ) : (
        future.slice(0, 3).map(([label, t]) => (
          <Chip key={label} onClick={() => onChange(t)}>
            {label}
          </Chip>
        ))
      )}
      <input
        type="datetime-local"
        value={localValue}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).getTime() : null)}
        className="h-8 max-w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm"
        aria-label="Reminder time"
      />
    </div>
  )
}

function RepeatPicker({ rule, anchor, onChange }: { rule: RecurrenceRule | null; anchor: DayKey; onChange: (r: RecurrenceRule | null) => void }) {
  const current = RECURRENCE_PRESETS.find((p) => JSON.stringify(p.rule) === JSON.stringify(rule))?.id ?? (rule ? 'custom' : 'none')
  return (
    <div className="space-y-2">
      <Select
        value={current}
        onChange={(e) => {
          const preset = RECURRENCE_PRESETS.find((p) => p.id === e.target.value)
          if (preset) onChange(preset.rule && preset.rule.freq === 'weekly' && !preset.rule.weekdays ? { ...preset.rule, weekdays: [weekdayOf(anchor)] } : preset.rule)
        }}
        className="py-1.5 text-sm"
        aria-label="Repeat"
      >
        {RECURRENCE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        {current === 'custom' && rule && <option value="custom">{describeRule(rule, anchor)}</option>}
      </Select>
      {rule?.freq === 'weekly' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const on = (rule.weekdays?.length ? rule.weekdays : [weekdayOf(anchor)]).includes(wd)
            return (
              <button
                key={wd}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const base = rule.weekdays?.length ? rule.weekdays : [weekdayOf(anchor)]
                  const next = on ? base.filter((d) => d !== wd) : [...base, wd]
                  if (next.length) onChange({ ...rule, weekdays: next.sort() })
                }}
                className={cn('size-8 rounded-full text-[11px] font-bold', on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}
              >
                {weekdayShort(wd).slice(0, 2)}
              </button>
            )
          })}
        </div>
      )}
      {rule && <p className="text-xs text-ink-3">{describeRule(rule, anchor)} · the next one appears when you complete this.</p>}
    </div>
  )
}

function Subtasks({ items, onChange }: { items: Subtask[]; onChange: (s: Subtask[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    const title = text.trim()
    if (!title) return
    onChange([...items, { id: uid(), title, done: false }])
    setText('')
  }
  const done = items.filter((s) => s.done).length
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Checklist</span>
        {items.length > 0 && (
          <span className="tabular text-xs font-bold text-ink-3">
            {done}/{items.length}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <Reorder.Group axis="y" values={items} onReorder={onChange} className="mb-1 space-y-0.5">
          {items.map((s) => (
            <SubtaskRow key={s.id} item={s} onChange={(v) => onChange(items.map((x) => (x.id === s.id ? v : x)))} onDelete={() => onChange(items.filter((x) => x.id !== s.id))} />
          ))}
        </Reorder.Group>
      )}
      <form
        className="flex items-center gap-2 rounded-xl px-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Plus className="size-4 shrink-0 text-ink-3" />
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={add} placeholder="Add a step" className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
      </form>
    </div>
  )
}

function SubtaskRow({ item, onChange, onDelete }: { item: Subtask; onChange: (s: Subtask) => void; onDelete: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} className="group flex items-center gap-2 rounded-xl bg-surface px-1 py-1">
      <span className="flex h-8 w-5 cursor-grab touch-none items-center justify-center text-ink-3" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder">
        <GripVertical className="size-3.5" />
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.title}
        onClick={() => onChange({ ...item, done: !item.done })}
        className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2', item.done ? 'border-success bg-success' : 'border-line-strong')}
      >
        {item.done && <Check className="size-3 text-white" strokeWidth={3.5} />}
      </button>
      <input value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} className={cn('min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none', item.done && 'text-ink-3 line-through')} />
      <button type="button" aria-label="Remove step" onClick={onDelete} className="rounded-full p-1.5 text-ink-3 opacity-60 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100">
        <X className="size-3.5" />
      </button>
    </Reorder.Item>
  )
}

function TaskActivity({ task }: { task: Task }) {
  const settings = useSettings()
  const sessions = useLiveQuery(() => db.sessions.where('taskId').equals(task.id).reverse().sortBy('startedAt'), [task.id]) ?? []
  const series = useLiveQuery(() => (task.seriesId ? db.tasks.where('seriesId').equals(task.seriesId).filter((t) => !!t.done).count() : 0), [task.seriesId])
  const total = sessions.reduce((a, s) => a + s.duration, 0)
  return (
    <div className="rounded-2xl bg-surface-2/60 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Time tracked</span>
        <span className="tabular text-sm font-bold">
          {formatDuration(total)} · {sessions.length}
          {task.estimatedPomodoros > 0 && `/${task.estimatedPomodoros}`} sessions
        </span>
      </div>
      {task.estimatedPomodoros > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (sessions.length / task.estimatedPomodoros) * 100)}%` }} />
        </div>
      )}
      {sessions.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
          {sessions.slice(0, 5).map((s) => (
            <li key={s.id} className="flex justify-between gap-2">
              <span>
                {relativeDayLabel(s.date)} · {formatTimeOfDay(s.startedAt, settings.use24h)}
              </span>
              <span className="tabular font-semibold">{formatDuration(s.duration)}</span>
            </li>
          ))}
        </ul>
      )}
      {!!series && series > 0 && <p className="mt-2 text-[13px] text-ink-2">Completed {series}× in this series.</p>}
    </div>
  )
}

function ExistingActions({ task, onClose }: { task: Task; onClose: () => void }) {
  const [scheduling, setScheduling] = useState(false)
  const del = async () => {
    useUi.getState().closeTask()
    const deleted = await deleteTask(task)
    toast({ title: 'Task deleted', body: task.title, action: { label: 'Undo', run: () => void restoreTask(deleted) } })
  }
  const duplicate = async () => {
    const copy = await addTask({ ...task, id: undefined, done: 0, completedAt: null, subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })), title: `${task.title} (copy)` } as Partial<Task>)
    useUi.getState().openTask(copy.id)
  }
  return (
    <>
      <SheetActions
        start={
          <>
            <IconButton label="Delete task" onClick={() => void del()} className="hover:bg-danger/10 hover:text-danger">
              <Trash2 className="size-4.5" />
            </IconButton>
            <IconButton label="Duplicate" onClick={() => void duplicate()}>
              <Copy className="size-4.5" />
            </IconButton>
            <IconButton label="Schedule a focus block" onClick={() => setScheduling(true)}>
              <CalendarPlus className="size-4.5" />
            </IconButton>
          </>
        }
      >
        {task.done ? (
          <Button onClick={() => void uncompleteTask(task)}>Reopen</Button>
        ) : (
          <>
            <Button
              icon={<Check className="size-4" />}
              onClick={async () => {
                onClose()
                await completeTask(task)
                toast({ title: 'Completed', body: task.title, tone: 'success' })
              }}
            >
              Done
            </Button>
            <Button
              variant="primary"
              icon={<Play className="size-4 fill-current" />}
              onClick={() => {
                onClose()
                void focusOnTask(task)
              }}
            >
              Focus
            </Button>
          </>
        )}
      </SheetActions>
      <ScheduleBlockSheet task={task} open={scheduling} onClose={() => setScheduling(false)} />
    </>
  )
}

/** Time-block a task: create a focus block on the calendar that can launch the timer. */
export function ScheduleBlockSheet({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const profiles = useProfiles()
  const settings = useSettings()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const per = profile?.focusMinutes || 25
  const suggested = Math.max(per, Math.min(240, (task.estimatedPomodoros || 1) * per))
  const nextHalfHour = () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
    return d
  }
  const [date, setDate] = useState(task.plannedFor ?? todayKey())
  const [start, setStart] = useState(hhmm(nextHalfHour().getTime()))
  const [minutes, setMinutes] = useState(suggested)

  const endOf = (s: string, mins: number) => {
    const t = atTime(date, s) + mins * 60_000
    return dayKey(t) === date ? hhmm(t) : '23:59'
  }

  const save = async () => {
    await create('events', {
      title: task.title,
      kind: 'block',
      date,
      start,
      end: endOf(start, minutes),
      color: null,
      labelId: task.labelId,
      taskId: task.id,
      notes: '',
      location: '',
      reminderMinutes: 5,
      recurrence: null,
    })
    if (!task.plannedFor) await patch('tasks', task.id, { plannedFor: date })
    onClose()
    toast({ title: 'Focus block scheduled', body: `${relativeDayLabel(date)} at ${start}`, action: { label: 'View', run: () => navigate(`#/calendar?date=${date}`) } })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Schedule a focus block"
      subtitle={task.title}
      size="sm"
      footer={
        <SheetActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            Add to calendar
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-ink-2 uppercase">Day</span>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-ink-2 uppercase">Start</span>
            <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Length</span>
          <Stepper label="Block minutes" value={minutes} onChange={setMinutes} min={5} max={480} step={5} suffix="m" />
        </div>
        <p className="text-[13px] text-ink-2">
          Ends at {endOf(start, minutes)} · about {Math.max(1, Math.round(minutes / per))} session{Math.round(minutes / per) === 1 ? '' : 's'}. You’ll get a reminder 5 minutes before, and can start the timer straight from the block.
        </p>
      </div>
    </Sheet>
  )
}
