/** Spreadsheet-friendly CSV export/import for sessions and tasks. */
import { parseCsvObjects, toCsv } from '@/lib/csv'
import { uid } from '@/lib/id'
import { dayKey, isDayKey } from '@/lib/time'
import { db } from './db'
import { create } from './repo'
import { PALETTE } from './seed'
import type { Label, Priority, Project, Session, Task } from './types'

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : '')

export async function sessionsCsv(): Promise<string> {
  const [sessions, labels, projects, tasks] = await Promise.all([
    db.sessions.orderBy('startedAt').toArray(),
    db.labels.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
  ])
  const L = new Map(labels.map((l) => [l.id, l.name]))
  const P = new Map(projects.map((p) => [p.id, p.name]))
  const T = new Map(tasks.map((t) => [t.id, t.title]))
  return toCsv(
    ['id', 'date', 'start', 'end', 'duration_minutes', 'planned_minutes', 'mode', 'completed', 'label', 'project', 'task', 'rating', 'pauses', 'note', 'source'],
    sessions.map((s) => ({
      id: s.id,
      date: s.date,
      start: iso(s.startedAt),
      end: iso(s.endedAt),
      duration_minutes: Math.round((s.duration / 60) * 100) / 100,
      planned_minutes: s.plannedDuration === null ? '' : Math.round(s.plannedDuration / 60),
      mode: s.mode,
      completed: s.completed ? 'yes' : 'no',
      label: s.labelId ? (L.get(s.labelId) ?? '') : '',
      project: s.projectId ? (P.get(s.projectId) ?? '') : '',
      task: s.taskId ? (T.get(s.taskId) ?? '') : '',
      rating: s.rating ?? '',
      pauses: s.pauseCount,
      note: s.note,
      source: s.source,
    })),
  )
}

const PRIORITY_NAME = ['none', 'low', 'medium', 'high']

export async function tasksCsv(): Promise<string> {
  const [tasks, labels, projects] = await Promise.all([db.tasks.toArray(), db.labels.toArray(), db.projects.toArray()])
  const L = new Map(labels.map((l) => [l.id, l.name]))
  const P = new Map(projects.map((p) => [p.id, p.name]))
  return toCsv(
    ['id', 'title', 'status', 'project', 'label', 'priority', 'planned_for', 'due_date', 'due_time', 'estimated_pomodoros', 'completed_at', 'subtasks', 'notes'],
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.done ? 'done' : 'open',
      project: t.projectId ? (P.get(t.projectId) ?? '') : '',
      label: t.labelId ? (L.get(t.labelId) ?? '') : '',
      priority: PRIORITY_NAME[t.priority],
      planned_for: t.plannedFor ?? '',
      due_date: t.dueDate ?? '',
      due_time: t.dueTime ?? '',
      estimated_pomodoros: t.estimatedPomodoros,
      completed_at: iso(t.completedAt),
      subtasks: t.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join(' | '),
      notes: t.notes,
    })),
  )
}

// ───────────────────────── import ─────────────────────────

async function resolver<T extends { id: string; name: string }>(
  items: T[],
  make: (name: string, index: number) => Promise<T>,
): Promise<(name: string) => Promise<string | null>> {
  const byName = new Map(items.map((i) => [i.name.trim().toLowerCase(), i.id]))
  let created = 0
  return async (name: string) => {
    const key = name.trim().toLowerCase()
    if (!key) return null
    const found = byName.get(key)
    if (found) return found
    const item = await make(name.trim(), items.length + created++)
    byName.set(key, item.id)
    return item.id
  }
}

const labelMaker = (name: string, i: number) =>
  create('labels', { name, color: PALETTE[i % PALETTE.length].value, parentId: null, kind: 'label', archived: false, order: i }) as Promise<Label>
const projectMaker = (name: string, i: number) =>
  create('projects', { name, color: PALETTE[(i + 5) % PALETTE.length].value, labelId: null, note: '', archived: false, order: i }) as Promise<Project>

function parseTime(v: string | undefined): number | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

export interface CsvImportReport {
  imported: number
  skipped: number
}

/**
 * Import sessions. Accepts Lodestar's own export and most tracker exports:
 * needs a start (or date + time) and either an end or a duration in minutes.
 */
export async function importSessionsCsv(text: string): Promise<CsvImportReport> {
  const rows = parseCsvObjects(text)
  const resolveLabel = await resolver(await db.labels.toArray(), labelMaker)
  const resolveProject = await resolver(await db.projects.toArray(), projectMaker)
  const existing = new Set((await db.sessions.toCollection().primaryKeys()) as string[])
  const out: Session[] = []
  let skipped = 0
  for (const r of rows) {
    let start = parseTime(r.start ?? r.started_at ?? r.start_time)
    if (start === null && isDayKey(r.date)) start = parseTime(`${r.date}T${r.time || '09:00'}`)
    const minutes = Number(r.duration_minutes ?? r.minutes ?? r.duration)
    let end = parseTime(r.end ?? r.ended_at ?? r.end_time)
    if (start === null || (end === null && !(minutes > 0))) {
      skipped++
      continue
    }
    if (end === null) end = start + minutes * 60_000
    const duration = Math.round((minutes > 0 ? minutes : (end - start) / 60_000) * 60)
    if (duration <= 0 || end < start) {
      skipped++
      continue
    }
    const id = r.id && !existing.has(r.id) ? r.id : uid()
    if (r.id && existing.has(r.id)) {
      skipped++
      continue
    }
    const now = Date.now()
    out.push({
      id,
      createdAt: now,
      updatedAt: now,
      mode: r.mode === 'stopwatch' || r.mode === 'countdown' ? r.mode : 'pomodoro',
      startedAt: start,
      endedAt: end,
      duration,
      plannedDuration: Number(r.planned_minutes) > 0 ? Number(r.planned_minutes) * 60 : null,
      completed: !/^(no|false|0)$/i.test(r.completed ?? 'yes'),
      date: dayKey(start),
      labelId: await resolveLabel(r.label ?? r.subject ?? r.tag ?? ''),
      projectId: await resolveProject(r.project ?? ''),
      taskId: null,
      profileId: null,
      note: r.note ?? r.notes ?? '',
      rating: Number(r.rating) >= 1 && Number(r.rating) <= 5 ? Number(r.rating) : null,
      pauseCount: Number(r.pauses) || 0,
      source: 'import',
    })
  }
  await db.sessions.bulkPut(out)
  return { imported: out.length, skipped }
}

export async function importTasksCsv(text: string): Promise<CsvImportReport> {
  const rows = parseCsvObjects(text)
  const resolveLabel = await resolver(await db.labels.toArray(), labelMaker)
  const resolveProject = await resolver(await db.projects.toArray(), projectMaker)
  const existing = new Set((await db.tasks.toCollection().primaryKeys()) as string[])
  const out: Task[] = []
  let skipped = 0
  let order = await db.tasks.count()
  for (const r of rows) {
    const title = r.title ?? r.task ?? r.name
    if (!title || (r.id && existing.has(r.id))) {
      skipped++
      continue
    }
    const now = Date.now()
    const done = /^(done|completed|x|yes|true|1)$/i.test(r.status ?? r.done ?? '')
    const prio = PRIORITY_NAME.indexOf((r.priority ?? '').toLowerCase())
    const due = r.due_date ?? r.due
    const completedAt = parseTime(r.completed_at)
    out.push({
      id: r.id || uid(),
      createdAt: now,
      updatedAt: now,
      title,
      notes: r.notes ?? r.note ?? '',
      projectId: await resolveProject(r.project ?? r.list ?? ''),
      labelId: await resolveLabel(r.label ?? r.subject ?? ''),
      priority: (prio > 0 ? prio : Number(r.priority) >= 1 && Number(r.priority) <= 3 ? Number(r.priority) : 0) as Priority,
      plannedFor: isDayKey(r.planned_for) ? r.planned_for : null,
      dueDate: isDayKey(due) ? due : null,
      dueTime: /^\d{2}:\d{2}$/.test(r.due_time ?? '') ? r.due_time : null,
      reminderAt: null,
      estimatedPomodoros: Math.max(0, Math.round(Number(r.estimated_pomodoros ?? r.estimate) || 0)),
      subtasks: (r.subtasks ?? '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ id: uid(), done: s.startsWith('[x]'), title: s.replace(/^\[[ x]\]\s*/, '') })),
      recurrence: null,
      seriesId: null,
      done: done ? 1 : 0,
      completedAt: done ? (completedAt ?? now) : null,
      order: order++,
    })
  }
  await db.tasks.bulkPut(out)
  return { imported: out.length, skipped }
}

