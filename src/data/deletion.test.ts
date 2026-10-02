import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { deleteEvent, deleteGoal, deleteHabit, deleteLabel, deleteProject, deleteSession } from './deletion'
import { create, patch } from './repo'
import { changesSince } from './sync'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const strip = <T extends { updatedAt: number }>(r: T | undefined) => {
  if (!r) return r
  const { updatedAt: _, ...rest } = r
  return rest
}

const label = (name: string, parentId: string | null = null) => create('labels', { name, color: '#fff', parentId, kind: 'subject', archived: false, order: 0 })

describe('delete with undo', () => {
  it('returns null for something already gone', async () => {
    expect(await deleteGoal('missing')).toBeNull()
    expect(await deleteHabit('missing')).toBeNull()
    expect(await deleteLabel('missing')).toBeNull()
    expect(await deleteProject('missing')).toBeNull()
    expect(await db.tombstones.count()).toBe(0)
  })

  it('removes and restores a record with nothing depending on it, tombstone included', async () => {
    const all = await db.goals.toArray()
    const goal = await create('goals', { ...(all[0] ?? {}), period: 'day', targetMinutes: 120, labelId: null } as never)
    const session = await create('sessions', { startedAt: 1000, endedAt: 2000, duration: 1000, phase: 'focus', mode: 'stopwatch', plannedDuration: null, profileId: null, pauseCount: 0, source: 'manual', labelId: null, taskId: null, note: '' } as never)
    const event = await create('events', { title: 'Mock test', kind: 'event', start: 5000, end: 9000, allDay: false, recurrence: null, labelId: null, taskId: null } as never)

    for (const [table, record, del] of [
      ['goals', goal, deleteGoal],
      ['sessions', session, deleteSession],
      ['events', event, deleteEvent],
    ] as const) {
      const deleted = await del(record.id)
      expect(deleted, table).not.toBeNull()
      expect(await db.table(table).get(record.id), table).toBeUndefined()
      expect(await db.tombstones.get(`${table}:${record.id}`), table).toBeTruthy()
      await deleted!.undo()
      expect(strip(await db.table(table).get(record.id)), table).toEqual(strip(record))
      expect(await db.tombstones.get(`${table}:${record.id}`), table).toBeUndefined()
    }
    expect(await db.tombstones.count()).toBe(0)
  })

  it('a restored record is newer than its deletion, so a merge keeps it', async () => {
    const goal = await create('goals', { period: 'day', targetMinutes: 60, labelId: null } as never)
    const cursor = Date.now() - 1
    const deleted = await deleteGoal(goal.id)
    await deleted!.undo()
    const changes = await changesSince(cursor)
    expect(changes.tombstones.map((t) => t.entityId)).not.toContain(goal.id)
    expect((await db.goals.get(goal.id))!.updatedAt).toBeGreaterThanOrEqual(goal.updatedAt)
  })

  it('a habit goes and comes back with every check-in', async () => {
    const habit = await create('habits', { name: 'Newspaper', color: '#fff', kind: 'check', targetMinutes: 0, labelId: null, weekdays: [], reminderTime: null, archived: false, order: 0 } as never)
    const other = await create('habits', { name: 'Answer writing', color: '#fff', kind: 'check', targetMinutes: 0, labelId: null, weekdays: [], reminderTime: null, archived: false, order: 1 } as never)
    const logs = [await create('habitLogs', { habitId: habit.id, date: '2026-10-01', value: 1 } as never), await create('habitLogs', { habitId: habit.id, date: '2026-10-02', value: 1 } as never)]
    const kept = await create('habitLogs', { habitId: other.id, date: '2026-10-02', value: 1 } as never)

    const deleted = await deleteHabit(habit.id)
    expect(await db.habits.get(habit.id)).toBeUndefined()
    expect(await db.habitLogs.where('habitId').equals(habit.id).count()).toBe(0)
    expect(await db.habitLogs.get(kept.id)).toBeTruthy()
    expect(await db.tombstones.count()).toBe(3)

    await deleted!.undo()
    expect(strip(await db.habits.get(habit.id))).toEqual(strip(habit))
    expect(await db.habitLogs.where('habitId').equals(habit.id).sortBy('date')).toEqual(logs)
    expect(await db.tombstones.count()).toBe(0)
  })

  it('a label’s topics move up, and move back on undo unless they were moved meanwhile', async () => {
    const exam = await label('Prelims')
    const subject = await label('Geography', exam.id)
    const a = await label('Rivers', subject.id)
    const b = await label('Soils', subject.id)
    const elsewhere = await label('Polity')

    const deleted = await deleteLabel(subject.id)
    expect((await db.labels.get(a.id))!.parentId).toBe(exam.id)
    expect((await db.labels.get(b.id))!.parentId).toBe(exam.id)

    // The learner moves one topic somewhere else before undoing.
    await patch('labels', b.id, { parentId: elsewhere.id })
    await deleted!.undo()
    expect(strip(await db.labels.get(subject.id))).toEqual(strip(subject))
    expect((await db.labels.get(a.id))!.parentId).toBe(subject.id)
    expect((await db.labels.get(b.id))!.parentId).toBe(elsewhere.id)
    expect(await db.tombstones.count()).toBe(0)
  })

  it('a project’s tasks go to the inbox and return with it', async () => {
    const project = await create('projects', { name: 'Essay', color: '#fff', archived: false, order: 0 } as never)
    const other = await create('projects', { name: 'Maps', color: '#fff', archived: false, order: 1 } as never)
    const task = (title: string, projectId: string | null) => create('tasks', { title, projectId, done: false, subtasks: [], tags: [], order: 0 } as never)
    const one = await task('Outline', project.id)
    const two = await task('Draft', project.id)
    const untouched = await task('Trace rivers', other.id)

    const deleted = await deleteProject(project.id)
    expect((await db.tasks.get(one.id))!.projectId).toBeNull()
    expect((await db.tasks.get(two.id))!.projectId).toBeNull()
    expect((await db.tasks.get(untouched.id))!.projectId).toBe(other.id)
    expect(await db.tasks.count()).toBe(3)

    await patch('tasks', two.id, { projectId: other.id })
    await deleted!.undo()
    expect(strip(await db.projects.get(project.id))).toEqual(strip(project))
    expect((await db.tasks.get(one.id))!.projectId).toBe(project.id)
    expect((await db.tasks.get(two.id))!.projectId).toBe(other.id)
    expect(await db.tombstones.count()).toBe(0)
  })
})
