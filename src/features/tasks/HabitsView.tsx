import { Check, Flame, Plus, Repeat, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/data/db'
import { useHabitLogs, useHabits, useLabels, useSessionsBetween, useSettings } from '@/data/hooks'
import { create, nextOrder, patch, remove } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Habit, HabitKind } from '@/data/types'
import { cn } from '@/lib/cn'
import { addDaysKey, parseDayKey, startOfWeekKey, todayKey, weekdayOrder, weekdayShort, type DayKey } from '@/lib/time'
import { habitEvaluator, habitStreak } from '@/planner/habits'
import { haptics } from '@/services/haptics'
import { Button, Card, Field, Segmented, Stepper, TextInput, Select } from '@/ui/controls'
import { ColorPicker } from '@/ui/ColorPicker'
import { confirmDialog, EmptyState } from '@/ui/feedback'
import { Ring } from '@/ui/Ring'
import { Sheet } from '@/ui/Sheet'
import { flattenLabels } from '@/features/shared/labels'

export function HabitsView() {
  const habits = useHabits()
  const labels = useLabels(true)
  const settings = useSettings()
  const today = todayKey()
  const from = addDaysKey(today, -400)
  const logs = useHabitLogs(from, today)
  const sessions = useSessionsBetween(from, today)
  const weekStart = startOfWeekKey(today, settings.weekStartsOn)
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i))
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)

  const toggle = async (h: Habit, day: DayKey, done: boolean) => {
    if (day > today) return
    haptics.tap()
    const id = `${h.id}:${day}`
    if (done) await remove('habitLogs', id)
    else await db.habitLogs.put({ id, habitId: h.id, date: day, value: 1, createdAt: Date.now(), updatedAt: Date.now() })
  }

  return (
    <div>
      <p className="mb-4 px-1 text-[13px] leading-relaxed text-ink-2">
        Tick-off habits are checked by hand. Focus habits fill themselves in from your timer sessions – “20 minutes of French a day” just happens when you study.
      </p>
      {habits.length === 0 ? (
        <Card>
          <EmptyState icon={<Repeat className="size-6" />} title="Build a steady rhythm" body="Daily review, flashcards, reading – small repeated things compound." action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>New habit</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {habits.map((h) => (
            <HabitCard key={h.id} habit={h} days={days} today={today} status={habitEvaluator(h, logs, sessions, labels)} onToggle={toggle} onEdit={() => setEditing(h)} />
          ))}
          <Button block icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New habit
          </Button>
        </div>
      )}
      <HabitSheet habit={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function HabitCard({ habit, days, today, status, onToggle, onEdit }: { habit: Habit; days: DayKey[]; today: DayKey; status: ReturnType<typeof habitEvaluator>; onToggle: (h: Habit, d: DayKey, done: boolean) => void; onEdit: () => void }) {
  const streak = useMemo(() => habitStreak(status, today), [habit, status, today])
  const todayStatus = status(today)
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-2 truncate text-[15px] font-bold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: habit.color }} />
            <span className="truncate">{habit.name}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium text-ink-2">
            {habit.kind === 'focus' ? (
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3.5" /> {Math.round(todayStatus.minutes ?? 0)}/{habit.targetMinutes} min today
              </span>
            ) : (
              <span>{habit.weekdays.length && habit.weekdays.length < 7 ? habit.weekdays.map(weekdayShort).join(' ') : 'Every day'}</span>
            )}
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 font-bold text-accent">
                <Flame className="size-3.5" /> {streak}
              </span>
            )}
          </p>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const s = status(d)
          const future = d > today
          const isToday = d === today
          return (
            <div key={d} className="flex flex-col items-center gap-1">
              <span className={cn('text-[10px] font-bold uppercase', isToday ? 'text-ink' : 'text-ink-3')}>{weekdayShort(parseDayKey(d).getDay()).slice(0, 2)}</span>
              {habit.kind === 'check' ? (
                <button
                  type="button"
                  disabled={future}
                  aria-pressed={s.done}
                  aria-label={`${habit.name} on ${d}`}
                  onClick={() => onToggle(habit, d, s.done)}
                  className={cn('flex size-9 items-center justify-center rounded-xl border transition-colors disabled:opacity-30', s.done ? 'border-transparent text-white' : s.due ? 'border-line-strong' : 'border-dashed border-line')}
                  style={s.done ? { background: habit.color } : undefined}
                >
                  {s.done && <Check className="size-4" strokeWidth={3} />}
                </button>
              ) : (
                <Ring value={future ? 0 : s.ratio} size={36} stroke={3.5} color={habit.color} label={`${Math.round(s.minutes ?? 0)} minutes`}>
                  {s.done && <Check className="size-3.5" style={{ color: habit.color }} strokeWidth={3} />}
                </Ring>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function HabitSheet({ habit, onClose }: { habit: Habit | 'new' | null; onClose: () => void }) {
  const labels = useLabels()
  const settings = useSettings()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PALETTE[7].value)
  const [kind, setKind] = useState<HabitKind>('check')
  const [target, setTarget] = useState(20)
  const [labelId, setLabelId] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [reminder, setReminder] = useState('')

  useEffect(() => {
    if (!habit) return
    const h = habit === 'new' ? null : habit
    setName(h?.name ?? '')
    setColor(h?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)].value)
    setKind(h?.kind ?? 'check')
    setTarget(h?.targetMinutes ?? 20)
    setLabelId(h?.labelId ?? '')
    setWeekdays(h?.weekdays ?? [])
    setReminder(h?.reminderTime ?? '')
  }, [habit])

  const save = async () => {
    const data = { name: name.trim() || 'New habit', color, kind, targetMinutes: target, labelId: labelId || null, weekdays, reminderTime: reminder || null }
    if (habit === 'new') await create('habits', { ...data, archived: false, order: await nextOrder('habits') })
    else if (habit) await patch('habits', habit.id, data)
    onClose()
  }

  const del = async () => {
    if (!habit || habit === 'new') return
    if (!(await confirmDialog({ title: `Delete “${habit.name}”?`, body: 'Its check-ins are removed too.', confirmLabel: 'Delete', danger: true }))) return
    const logs = await db.habitLogs.where('habitId').equals(habit.id).primaryKeys()
    await remove('habitLogs', logs as string[])
    await remove('habits', habit.id)
    onClose()
  }

  const order = weekdayOrder(settings.weekStartsOn)

  return (
    <Sheet open={!!habit} onClose={onClose} title={habit === 'new' ? 'New habit' : 'Edit habit'}>
      <div className="space-y-5">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anki review, Read 20 pages, French practice" data-autofocus />
        </Field>
        <Field label="Type">
          <Segmented
            className="w-full"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'check', label: 'Tick off' },
              { value: 'focus', label: 'Focus time' },
            ]}
          />
        </Field>
        {kind === 'focus' && (
          <div className="space-y-4 rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Daily target</span>
              <Stepper label="Target minutes" value={target} onChange={setTarget} min={5} max={600} step={5} suffix="m" />
            </div>
            <Field label="Counts sessions on" hint="Leave empty to count all focus.">
              <Select value={labelId} onChange={(e) => setLabelId(e.target.value)}>
                <option value="">Any subject</option>
                {flattenLabels(labels).map(({ label, path }) => (
                  <option key={label.id} value={label.id}>
                    {path}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Days" hint={weekdays.length ? undefined : 'Every day'}>
          <div className="flex gap-1.5">
            {order.map((wd) => {
              const on = weekdays.includes(wd)
              return (
                <button key={wd} type="button" aria-pressed={on} onClick={() => setWeekdays(on ? weekdays.filter((d) => d !== wd) : [...weekdays, wd].sort())} className={cn('h-9 flex-1 rounded-xl text-xs font-bold', on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}>
                  {weekdayShort(wd).slice(0, 2)}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Reminder" hint="A daily nudge if it isn’t done yet.">
          <TextInput type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
        </Field>
        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <div className="flex gap-2">
          {habit && habit !== 'new' && (
            <>
              <Button variant="danger" onClick={() => void del()}>
                Delete
              </Button>
              <Button
                onClick={async () => {
                  await patch('habits', habit.id, { archived: true })
                  onClose()
                }}
              >
                Archive
              </Button>
            </>
          )}
          <Button block variant="primary" onClick={() => void save()}>
            {habit === 'new' ? 'Create habit' : 'Save'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
