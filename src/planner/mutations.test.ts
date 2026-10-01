/** Repository-level concurrency and rollback regressions for all task/expedition callers. */
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { create, patch, remove } from '@/data/repo'
import { addFromQuickAdd, addTask, completeTask } from './tasks'
import { parseQuickAdd } from './quickAdd'
import { startExpedition, stopExpedition } from '@/atlas/actions'

beforeEach(async () => { await db.delete(); await db.open() })
afterEach(async () => { await db.delete() })

describe('atomic completion', () => {
  it('ambiguous subject prefixes do not create a task or a partial project', async () => {
    for (const name of ['Geography', 'Geology']) await create('labels', { name, kind: 'subject', parentId: null, color: '#fff', archived: false, order: 0 })
    await expect(addFromQuickAdd(parseQuickAdd('Read +NewProject @Geo', '2026-10-01'))).rejects.toThrow('Several names match')
    expect(await db.tasks.count()).toBe(0)
    expect(await db.projects.count()).toBe(0)
    expect(await db.labels.count()).toBe(2)
    await addFromQuickAdd(parseQuickAdd('Read @Geography', '2026-10-01'))
    expect((await db.tasks.toArray())[0].labelId).toBe((await db.labels.toArray()).find(l => l.name === 'Geography')?.id)
  })
  it('ambiguous legacy project tags do not choose the first project', async () => {
    for (const name of ['Geo', 'History']) await create('projects', { name, color: '#fff', labelId: null, archived: false, order: 0, note: '' })
    await expect(addFromQuickAdd(parseQuickAdd('Read #Geo #History', '2026-10-01'))).rejects.toThrow('Several projects match')
    expect(await db.tasks.count()).toBe(0)
  })
  it('concurrent completions create one successor and preserve the current task', async () => {
    const task = await addTask({ title: 'Read', recurrence: { freq: 'daily', interval: 1 } })
    await patch('tasks', task.id, { title: 'Read edited notes', priority: 3 })
    const results = await Promise.all([completeTask(task), completeTask(task), completeTask(task)])
    expect(results.filter(Boolean)).toHaveLength(1)
    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(2)
    expect(tasks.find(t => t.id === task.id)?.done).toBe(1)
    expect(tasks.find(t => t.id !== task.id)).toMatchObject({ title: 'Read edited notes', priority: 3, done: 0, seriesId: task.seriesId })
  })
  it('failure to create the successor rolls completion back', async () => {
    const task = await addTask({ title: 'Read', recurrence: { freq: 'daily', interval: 1 } })
    const fail = () => { throw new Error('Storage unavailable') }
    db.tasks.hook('creating', fail)
    try { await expect(completeTask(task)).rejects.toThrow('Storage unavailable') }
    finally { db.tasks.hook('creating').unsubscribe(fail) }
    expect((await db.tasks.get(task.id))?.done).toBe(0)
    expect(await db.tasks.count()).toBe(1)
    await completeTask(task)
    expect(await db.tasks.count()).toBe(2)
  })
  it('a stale deleted or completed task cannot create another occurrence', async () => {
    const task = await addTask({ title: 'Read', recurrence: { freq: 'daily', interval: 1 } })
    await remove('tasks', task.id)
    expect(await completeTask(task)).toBeNull()
    expect(await db.tasks.count()).toBe(0)
  })
})

describe('atomic expedition activation', () => {
  it('concurrent starts leave exactly one active run, including repeat requests', async () => {
    await Promise.all([startExpedition('a', 10), startExpedition('b', 20), startExpedition('b', 20)])
    const runs = await db.expeditions.toArray()
    expect(runs).toHaveLength(2)
    expect(runs.filter(r => r.endedAt === null)).toHaveLength(1)
    expect(runs.find(r => r.expeditionId === 'a')?.endedAt).toBe(20)
    await stopExpedition(30)
    expect((await db.expeditions.toArray()).filter(r => r.endedAt === null)).toHaveLength(0)
  })
})
