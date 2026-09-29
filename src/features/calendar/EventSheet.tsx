import { Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLabels, useOpenTasks } from '@/data/hooks'
import { create, patch, remove } from '@/data/repo'
import type { CalendarEvent, EventKind, RecurrenceRule } from '@/data/types'
import { weekdayOf } from '@/lib/time'
import { RECURRENCE_PRESETS } from '@/planner/recurrence'
import { useTimer } from '@/timer/store'
import { navigate } from '@/app/router'
import { Button, Field, IconButton, Segmented, Select, TextArea, TextInput, Toggle } from '@/ui/controls'
import { ColorPicker } from '@/ui/ColorPicker'
import { confirmDialog } from '@/ui/feedback'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'
import { REMINDER_OPTIONS } from './calendarModel'

export type EventDraft = Partial<CalendarEvent> & { date: string }

const KINDS: Array<{ value: EventKind; label: string }> = [
  { value: 'block', label: 'Focus block' },
  { value: 'event', label: 'Event' },
  { value: 'exam', label: 'Exam' },
  { value: 'deadline', label: 'Deadline' },
]

export function EventSheet({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
  const labels = useLabels()
  const tasks = useOpenTasks()
  const tree = useMemo(() => flattenLabels(labels), [labels])
  const [ev, setEv] = useState<EventDraft | null>(null)

  useEffect(() => {
    if (!draft) return
    setEv({
      title: '',
      kind: 'block',
      start: '09:00',
      end: '10:00',
      color: null,
      labelId: null,
      taskId: null,
      notes: '',
      location: '',
      reminderMinutes: 10,
      recurrence: null,
      ...draft,
    })
  }, [draft])

  if (!ev) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const set = (p: Partial<CalendarEvent>) => setEv((e) => (e ? { ...e, ...p } : e))
  const isNew = !ev.id
  const allDay = ev.start === null

  const save = async () => {
    const task = ev.taskId ? tasks.find((t) => t.id === ev.taskId) : undefined
    const data = {
      title: ev.title?.trim() || task?.title || (ev.kind === 'block' ? 'Focus block' : 'Untitled'),
      kind: ev.kind ?? 'event',
      date: ev.date,
      start: ev.start ?? null,
      end: ev.start ? (ev.end && ev.end > ev.start ? ev.end : ev.start) : null,
      color: ev.color ?? null,
      labelId: ev.labelId ?? task?.labelId ?? null,
      taskId: ev.taskId ?? null,
      notes: ev.notes ?? '',
      location: ev.location ?? '',
      reminderMinutes: ev.reminderMinutes ?? null,
      recurrence: ev.recurrence ?? null,
    }
    if (isNew) await create('events', data)
    else await patch('events', ev.id!, data)
    onClose()
  }

  const del = async () => {
    if (!ev.id) return
    if (!(await confirmDialog({ title: 'Delete this item?', body: ev.recurrence ? 'This removes every occurrence in the series.' : undefined, confirmLabel: 'Delete', danger: true }))) return
    await remove('events', ev.id)
    onClose()
  }

  const startNow = () => {
    const t = useTimer.getState()
    t.setContext({ taskId: ev.taskId ?? null, labelId: ev.labelId ?? null })
    if (t.timer.status === 'idle') t.start()
    onClose()
    navigate('#/focus')
  }

  const recurrenceId = RECURRENCE_PRESETS.find((p) => JSON.stringify(p.rule) === JSON.stringify(ev.recurrence))?.id ?? (ev.recurrence ? 'weekly' : 'none')

  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      title={isNew ? 'New calendar item' : 'Edit calendar item'}
      footer={
        <SheetActions
          start={
            !isNew && (
              <IconButton label="Delete" onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            )
          }
        >
          {!isNew && ev.kind === 'block' && (
            <Button onClick={startNow} icon={<Play className="size-4 fill-current" />}>
              Start now
            </Button>
          )}
          <Button variant="primary" onClick={() => void save()}>
            {isNew ? 'Add to calendar' : 'Save'}
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-5">
        <Segmented<EventKind> className="w-full" size="sm" value={ev.kind ?? 'event'} onChange={(kind) => set({ kind, start: kind === 'deadline' ? null : (ev.start ?? '09:00'), end: kind === 'deadline' ? null : (ev.end ?? '10:00') })} options={KINDS} />
        <Field label="Title">
          <TextInput value={ev.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={ev.kind === 'block' ? 'What will you focus on?' : ev.kind === 'exam' ? 'e.g. Biology final' : 'Title'} data-autofocus={isNew ? true : undefined} />
        </Field>
        {ev.kind === 'block' && (
          <Field label="Linked task" hint="Starting the block starts a timer for this task.">
            <Select value={ev.taskId ?? ''} onChange={(e) => set({ taskId: e.target.value || null })}>
              <option value="">None</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" className="col-span-2 sm:col-span-1">
            <TextInput type="date" value={ev.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </Field>
          <div className="col-span-2 flex items-end justify-between gap-3 pb-2 sm:col-span-1">
            <span className="text-sm font-semibold">All day</span>
            <Toggle label="All day" checked={allDay} onChange={(v) => set(v ? { start: null, end: null } : { start: '09:00', end: '10:00' })} />
          </div>
          {!allDay && (
            <>
              <Field label="Starts">
                <TextInput type="time" value={ev.start ?? ''} onChange={(e) => set({ start: e.target.value || '09:00' })} />
              </Field>
              <Field label="Ends">
                <TextInput type="time" value={ev.end ?? ''} onChange={(e) => set({ end: e.target.value || null })} />
              </Field>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Repeat">
            <Select
              value={recurrenceId}
              onChange={(e) => {
                const preset = RECURRENCE_PRESETS.find((p) => p.id === e.target.value)
                const rule: RecurrenceRule | null = preset?.rule ? (preset.rule.freq === 'weekly' && !preset.rule.weekdays ? { ...preset.rule, weekdays: [weekdayOf(ev.date)] } : preset.rule) : null
                set({ recurrence: rule })
              }}
            >
              {RECURRENCE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reminder">
            <Select value={ev.reminderMinutes === null || ev.reminderMinutes === undefined ? '' : String(ev.reminderMinutes)} onChange={(e) => set({ reminderMinutes: e.target.value === '' ? null : Number(e.target.value) })}>
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Subject">
          <Select value={ev.labelId ?? ''} onChange={(e) => set({ labelId: e.target.value || null })}>
            <option value="">None</option>
            {tree.map(({ label, path }) => (
              <option key={label.id} value={label.id}>
                {path}
              </option>
            ))}
          </Select>
        </Field>
        {ev.kind !== 'block' && (
          <Field label="Location">
            <TextInput value={ev.location ?? ''} onChange={(e) => set({ location: e.target.value })} placeholder="Room, building or link" />
          </Field>
        )}
        <Field label="Notes">
          <TextArea value={ev.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </Field>
        <Field label="Colour" hint="Defaults to the subject’s colour.">
          <ColorPicker value={ev.color ?? ''} onChange={(c) => set({ color: c === ev.color ? null : c })} />
        </Field>
      </div>
    </Sheet>
  )
}
