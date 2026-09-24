import { db } from '@/data/db'
import { create, nextOrder, patch, remove } from '@/data/repo'
import type { Label, Project, Task } from '@/data/types'
import { uid } from '@/lib/id'
import { addDaysKey, atTime, diffDays, todayKey, type DayKey } from '@/lib/time'
import { PALETTE } from '@/data/seed'
import { nextOccurrence } from './recurrence'
import type { QuickAddResult } from './quickAdd'

// ───────────────────────── selectors (pure) ─────────────────────────

/** The day a task is anchored to for planning purposes: do-date first, then deadline. */
export const taskDay = (t: Task): DayKey | null => t.plannedFor ?? t.dueDate

export function isOverdue(t: Task, today: DayKey): boolean {
  if (t.done) return false
  if (t.dueDate && t.dueDate < today) return true
  return !!t.plannedFor && t.plannedFor < today && !(t.dueDate && t.dueDate >= today)
}

export function isToday(t: Task, today: DayKey): boolean {
  return !t.done && (t.plannedFor === today || t.dueDate === today)
}

export function isInbox(t: Task): boolean {
  return !t.done && !t.projectId && !t.plannedFor && !t.dueDate
}

export function isUpcoming(t: Task, today: DayKey): boolean {
  if (t.done || isOverdue(t, today) || isToday(t, today)) return false
  const d = taskDay(t)
  return !!d && d > today
}

export function compareTasks(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.createdAt - b.createdAt
}

export function byPriorityThenOrder(a: Task, b: Task): number {
  if (a.priority !== b.priority) return b.priority - a.priority
  return compareTasks(a, b)
}

export interface DayGroup {
  day: DayKey
  tasks: Task[]
}

export function groupUpcoming(tasks: Task[], today: DayKey, horizonDays = 60): DayGroup[] {
  const map = new Map<DayKey, Task[]>()
  for (const t of tasks) {
    if (!isUpcoming(t, today)) continue
    const d = taskDay(t)!
    if (diffDays(today, d) > horizonDays) continue
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(t)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, tasks: list.sort(compareTasks) }))
}

export function subtaskProgress(t: Task): { done: number; total: number } {
  return { done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length }
}

// ───────────────────────── commands ─────────────────────────

export function blankTask(partial: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    notes: '',
    projectId: null,
    labelId: null,
    priority: 0,
    plannedFor: null,
    dueDate: null,
    dueTime: null,
    reminderAt: null,
    estimatedPomodoros: 1,
    subtasks: [],
    recurrence: null,
    seriesId: null,
    done: 0,
    completedAt: null,
    order: 0,
    ...partial,
  }
}

export async function addTask(partial: Partial<Task>): Promise<Task> {
  const order = partial.order ?? (await nextOrder('tasks'))
  const seriesId = partial.recurrence ? (partial.seriesId ?? uid()) : null
  return create('tasks', { ...blankTask(partial), order, seriesId })
}

function findByName<T extends { name: string; archived: boolean }>(items: T[], name: string): T | undefined {
  const n = name.trim().toLowerCase()
  return items.find((i) => !i.archived && i.name.toLowerCase() === n) ?? items.find((i) => !i.archived && i.name.toLowerCase().startsWith(n))
}

/** Turn a parsed quick-add into a task, creating a project/label on the fly if needed. */
export async function addFromQuickAdd(parsed: QuickAddResult, defaults: Partial<Task> = {}): Promise<Task | null> {
  if (!parsed.title) return null
  let projectId = defaults.projectId ?? null
  let labelId = defaults.labelId ?? null
  if (parsed.projectName) {
    const projects = await db.projects.toArray()
    const found = findByName<Project>(projects, parsed.projectName)
    projectId = found
      ? found.id
      : (
          await create('projects', {
            name: capitalise(parsed.projectName),
            color: PALETTE[projects.length % PALETTE.length].value,
            labelId: null,
            note: '',
            archived: false,
            order: projects.length,
          })
        ).id
  }
  if (parsed.labelName) {
    const labels = await db.labels.toArray()
    const found = findByName<Label>(labels, parsed.labelName)
    labelId = found
      ? found.id
      : (
          await create('labels', {
            name: capitalise(parsed.labelName),
            color: PALETTE[(labels.length + 3) % PALETTE.length].value,
            parentId: null,
            kind: 'label',
            archived: false,
            order: labels.length,
          })
        ).id
  }
  if (!labelId && projectId) {
    const project = await db.projects.get(projectId)
    labelId = project?.labelId ?? null
  }
  return addTask({
    ...defaults,
    title: parsed.title,
    priority: parsed.priority ?? defaults.priority ?? 0,
    projectId,
    labelId,
    estimatedPomodoros: parsed.estimate ?? defaults.estimatedPomodoros ?? 1,
    plannedFor: parsed.plannedFor ?? defaults.plannedFor ?? null,
    dueDate: parsed.dueDate ?? defaults.dueDate ?? null,
    dueTime: parsed.dueTime ?? null,
    recurrence: parsed.recurrence ?? null,
  })
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Complete a task. A recurring task stays in history as done and spawns the
 * next instance, shifted to the next occurrence of its rule.
 */
export async function completeTask(task: Task, now = Date.now()): Promise<Task | null> {
  await patch('tasks', task.id, { done: 1, completedAt: now })
  if (!task.recurrence) return null
  const today = todayKey()
  const anchor = taskDay(task) ?? today
  const next = nextOccurrence(task.recurrence, anchor, anchor > today ? anchor : today)
  if (!next) return null
  const shift = diffDays(anchor, next)
  const shiftKey = (k: DayKey | null) => (k ? addDaysKey(k, shift) : null)
  return addTask({
    ...task,
    id: undefined,
    plannedFor: shiftKey(task.plannedFor),
    dueDate: shiftKey(task.dueDate) ?? (task.plannedFor ? null : next),
    reminderAt: task.reminderAt ? task.reminderAt + shift * 86_400_000 : null,
    subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
    done: 0,
    completedAt: null,
    order: task.order,
    seriesId: task.seriesId ?? task.id,
  } as Partial<Task>)
}

export async function uncompleteTask(task: Task): Promise<void> {
  await patch('tasks', task.id, { done: 0, completedAt: null })
}

export async function toggleTask(task: Task): Promise<Task | null> {
  if (task.done) {
    await uncompleteTask(task)
    return null
  }
  return completeTask(task)
}

export async function deleteTask(task: Task): Promise<void> {
  await remove('tasks', task.id)
  // Unlink scheduled blocks pointing at this task.
  const blocks = await db.events.where('taskId').equals(task.id).toArray()
  for (const b of blocks) await patch('events', b.id, { taskId: null })
}

export async function planForDay(task: Task, day: DayKey | null): Promise<void> {
  await patch('tasks', task.id, { plannedFor: day })
}

export async function setSubtaskDone(task: Task, subtaskId: string, done: boolean): Promise<void> {
  await patch('tasks', task.id, { subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)) })
}

/** Reminder timestamp helper: a due time on a day, minus an offset. */
export function reminderFor(day: DayKey, time: string, minutesBefore = 0): number {
  return atTime(day, time) - minutesBefore * 60_000
}
