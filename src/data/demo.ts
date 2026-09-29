/**
 * Optional sample history so a new user can preview Insights and the Atlas
 * before they have data of their own. Every record id starts with `demo-`, so
 * the sample can be removed cleanly without touching real data.
 */
import { seededRandom } from '@/lib/random'
import { addDaysKey, atTime, dayKey, todayKey } from '@/lib/time'
import { db } from './db'
import type { CalendarEvent, Habit, HabitLog, Label, Project, Session, Task } from './types'

const PREFIX = 'demo-'

export async function hasDemoData(): Promise<boolean> {
  return (await db.sessions.where('id').startsWith(PREFIX).count()) > 0
}

export async function removeDemoData(): Promise<void> {
  const tables = [db.sessions, db.tasks, db.labels, db.projects, db.events, db.habits, db.habitLogs] as const
  await db.transaction('rw', [...tables], async () => {
    for (const t of tables) await t.where('id').startsWith(PREFIX).delete()
  })
}

export async function generateDemoData(days = 120): Promise<void> {
  const rand = seededRandom('tars-demo')
  const now = Date.now()
  const stamp = { createdAt: now, updatedAt: now }
  const today = todayKey()

  const label = (id: string, name: string, color: string, parentId: string | null = null, kind: Label['kind'] = 'subject'): Label => ({ ...stamp, id: PREFIX + id, name, color, parentId: parentId ? PREFIX + parentId : null, kind, archived: false, order: 10 })
  const labels: Label[] = [
    label('exam', 'Finals 2026', '#8B7CF0', null, 'exam'),
    label('bio', 'Biology', '#2FB3A3', 'exam'),
    label('cells', 'Cell biology', '#6DBE7B', 'bio', 'topic'),
    label('chem', 'Chemistry', '#E9765B', 'exam'),
    label('calc', 'Calculus', '#5D7BEA'),
    label('hist', 'History essay', '#E0A93B'),
    label('span', 'Spanish', '#E0628A'),
  ]
  const projects: Project[] = [
    { ...stamp, id: PREFIX + 'p-thesis', name: 'Lab report', color: '#2FB3A3', labelId: PREFIX + 'bio', note: '', archived: false, order: 10 },
    { ...stamp, id: PREFIX + 'p-essay', name: 'Revolution essay', color: '#E0A93B', labelId: PREFIX + 'hist', note: 'Due at the end of the month.', archived: false, order: 11 },
  ]
  const task = (id: string, title: string, extra: Partial<Task>): Task => ({
    ...stamp,
    id: PREFIX + id,
    title,
    notes: '',
    projectId: null,
    labelId: null,
    priority: 0,
    plannedFor: null,
    dueDate: null,
    dueTime: null,
    reminderAt: null,
    estimatedPomodoros: 2,
    subtasks: [],
    recurrence: null,
    seriesId: null,
    done: 0,
    completedAt: null,
    order: 20,
    ...extra,
  })
  const tasks: Task[] = [
    task('t1', 'Write methods section', { projectId: PREFIX + 'p-thesis', labelId: PREFIX + 'bio', plannedFor: today, estimatedPomodoros: 3, priority: 3 }),
    task('t2', 'Integration by parts – problem set 6', { labelId: PREFIX + 'calc', plannedFor: today, estimatedPomodoros: 2, priority: 2 }),
    task('t3', 'Outline paragraphs 3–5', { projectId: PREFIX + 'p-essay', labelId: PREFIX + 'hist', dueDate: addDaysKey(today, 4), estimatedPomodoros: 4 }),
    task('t4', 'Organic mechanisms flashcards', { labelId: PREFIX + 'chem', plannedFor: addDaysKey(today, 1), estimatedPomodoros: 1, recurrence: { freq: 'daily', interval: 1 }, seriesId: PREFIX + 's1' }),
    task('t5', 'Read chapter 9: Mitosis', { labelId: PREFIX + 'cells', done: 1, completedAt: now - 86_400_000, estimatedPomodoros: 2 }),
    task('t6', 'Past paper 2024', { labelId: PREFIX + 'chem', done: 1, completedAt: now - 2 * 86_400_000, estimatedPomodoros: 3 }),
  ]

  const leafLabels = [PREFIX + 'cells', PREFIX + 'chem', PREFIX + 'calc', PREFIX + 'hist', PREFIX + 'span', PREFIX + 'bio']
  const taskFor: Record<string, string | undefined> = { [PREFIX + 'cells']: PREFIX + 't5', [PREFIX + 'bio']: PREFIX + 't1', [PREFIX + 'calc']: PREFIX + 't2', [PREFIX + 'hist']: PREFIX + 't3', [PREFIX + 'chem']: PREFIX + 't6' }
  const sessions: Session[] = []
  let n = 0
  for (let i = days; i >= 0; i--) {
    const day = addDaysKey(today, -i)
    const wd = new Date(day + 'T12:00').getDay()
    // Build a plausible rhythm: weekdays heavier, occasional rest days, growing consistency.
    const restChance = wd === 6 ? 0.55 : wd === 0 ? 0.4 : 0.12 - (days - i) / days / 12
    if (rand() < restChance) continue
    const count = i === 0 ? 2 : 1 + Math.floor(rand() * (wd === 0 || wd === 6 ? 3 : 5))
    let clock = atTime(day, rand() < 0.5 ? '08:30' : rand() < 0.6 ? '10:00' : '14:00') + Math.floor(rand() * 40) * 60_000
    for (let k = 0; k < count; k++) {
      const len = [25, 25, 25, 50, 50, 45, 90][Math.floor(rand() * 7)]
      const completed = rand() > 0.12
      const duration = completed ? len * 60 : Math.round(len * (0.3 + rand() * 0.5)) * 60
      const labelId = leafLabels[Math.floor(rand() * leafLabels.length)]
      const startedAt = clock
      const endedAt = startedAt + duration * 1000 + (rand() < 0.2 ? 120_000 : 0)
      if (i === 0 && endedAt > now) break
      sessions.push({
        ...stamp,
        id: `${PREFIX}s${n++}`,
        mode: 'pomodoro',
        startedAt,
        endedAt,
        duration,
        plannedDuration: len * 60,
        completed,
        date: dayKey(startedAt),
        labelId,
        // Only recent sessions belong to today's tasks.
        taskId: i < 6 && rand() < 0.5 ? (taskFor[labelId] ?? null) : null,
        projectId: labelId === PREFIX + 'bio' ? PREFIX + 'p-thesis' : labelId === PREFIX + 'hist' ? PREFIX + 'p-essay' : null,
        profileId: null,
        note: rand() < 0.15 ? 'Good momentum – next: practice questions.' : '',
        rating: rand() < 0.5 ? 3 + Math.floor(rand() * 3) : null,
        pauseCount: rand() < 0.3 ? 1 : 0,
        source: 'timer',
      })
      clock = endedAt + (len >= 50 ? 12 : 6) * 60_000 + Math.floor(rand() * 30) * 60_000
      if (rand() < 0.2) clock += 3 * 3_600_000
    }
  }

  const ev = (id: string, e: Partial<CalendarEvent>): CalendarEvent => ({ ...stamp, id: PREFIX + id, title: '', kind: 'event', date: today, start: null, end: null, color: null, labelId: null, taskId: null, notes: '', location: '', reminderMinutes: null, recurrence: null, ...e })
  const events: CalendarEvent[] = [
    ev('e1', { title: 'Biology lecture', date: addDaysKey(today, -21), start: '11:00', end: '12:30', labelId: PREFIX + 'bio', location: 'Hall B', recurrence: { freq: 'weekly', interval: 1, weekdays: [1, 3] } }),
    ev('e2', { title: 'Methods section', kind: 'block', date: today, start: '15:00', end: '16:30', taskId: PREFIX + 't1', labelId: PREFIX + 'bio', reminderMinutes: 5 }),
    ev('e3', { title: 'Calculus drills', kind: 'block', date: addDaysKey(today, 1), start: '09:00', end: '10:00', taskId: PREFIX + 't2', labelId: PREFIX + 'calc' }),
    ev('e4', { title: 'Chemistry midterm', kind: 'exam', date: addDaysKey(today, 9), start: '09:30', end: '11:30', labelId: PREFIX + 'chem', location: 'Sports hall' }),
    ev('e5', { title: 'Essay due', kind: 'deadline', date: addDaysKey(today, 12), labelId: PREFIX + 'hist' }),
  ]

  const habits: Habit[] = [
    { ...stamp, id: PREFIX + 'h1', name: 'Spanish practice', color: '#E0628A', kind: 'focus', targetMinutes: 20, labelId: PREFIX + 'span', weekdays: [], reminderTime: null, archived: false, order: 10 },
    { ...stamp, id: PREFIX + 'h2', name: 'Review flashcards', color: '#2FB3A3', kind: 'check', targetMinutes: 0, labelId: null, weekdays: [1, 2, 3, 4, 5], reminderTime: null, archived: false, order: 11 },
  ]
  const logs: HabitLog[] = []
  for (let i = 1; i < 30; i++) {
    const d = addDaysKey(today, -i)
    if (rand() < 0.75) logs.push({ ...stamp, id: `${PREFIX}h2:${d}`, habitId: PREFIX + 'h2', date: d, value: 1 })
  }

  await db.transaction('rw', [db.labels, db.projects, db.tasks, db.sessions, db.events, db.habits, db.habitLogs], async () => {
    await db.labels.bulkPut(labels)
    await db.projects.bulkPut(projects)
    await db.tasks.bulkPut(tasks)
    await db.sessions.bulkPut(sessions)
    await db.events.bulkPut(events)
    await db.habits.bulkPut(habits)
    await db.habitLogs.bulkPut(logs)
  })
}
