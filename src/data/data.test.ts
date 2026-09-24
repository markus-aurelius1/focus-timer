import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { db, LodestarDB } from './db'
import { create, patch, remove } from './repo'
import { ensureSeed } from './seed'
import { changesSince, applyChanges } from './sync'
import { createBackup, parseBackup, restoreBackup } from './backup'
import { importSessionsCsv, sessionsCsv, importTasksCsv, tasksCsv } from './csvio'
import { addTask, completeTask } from '@/planner/tasks'
import { todayKey, addDaysKey } from '@/lib/time'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('data layer', () => {
  it('seeds defaults once', async () => {
    await ensureSeed()
    await ensureSeed()
    expect(await db.settings.count()).toBe(1)
    expect(await db.profiles.count()).toBeGreaterThan(3)
    const settings = await db.settings.get('settings')
    expect(settings?.activeProfileId).toBeTruthy()
  })

  it('records tombstones on delete and reports changes since a cursor', async () => {
    const label = await create('labels', { name: 'Physics', color: '#fff', parentId: null, kind: 'subject', archived: false, order: 0 })
    const cursor = Date.now() - 1
    await patch('labels', label.id, { name: 'Physics II' })
    await remove('labels', label.id)
    const changes = await changesSince(cursor)
    expect(changes.tombstones.map((t) => t.entityId)).toContain(label.id)
  })

  it('merges with last-write-wins', async () => {
    const label = await create('labels', { name: 'Old', color: '#fff', parentId: null, kind: 'subject', archived: false, order: 0 })
    const newer = { ...label, name: 'New', updatedAt: label.updatedAt + 1000 }
    const older = { ...label, name: 'Stale', updatedAt: label.updatedAt - 1000 }
    await applyChanges({ records: { labels: [older] }, tombstones: [] })
    expect((await db.labels.get(label.id))?.name).toBe('Old')
    const r = await applyChanges({ records: { labels: [newer] }, tombstones: [] })
    expect(r.updated).toBe(1)
    expect((await db.labels.get(label.id))?.name).toBe('New')
    // A newer remote tombstone deletes it.
    await applyChanges({ records: {}, tombstones: [{ id: `labels:${label.id}`, table: 'labels', entityId: label.id, deletedAt: newer.updatedAt + 1 }] })
    expect(await db.labels.get(label.id)).toBeUndefined()
  })

  it('backs up and restores exactly', async () => {
    await ensureSeed()
    const backup = parseBackup(JSON.stringify(await createBackup()))
    const taskCount = await db.tasks.count()
    await db.tasks.clear()
    await restoreBackup(backup, 'replace')
    expect(await db.tasks.count()).toBe(taskCount)
    expect(() => parseBackup('{"app":"other"}')).toThrow()
  })

  it('round-trips sessions and tasks through CSV', async () => {
    await importSessionsCsv('date,time,minutes,subject,note\n2026-09-01,09:00,50,Chemistry,"Titration, part 2"\n2026-09-02,,25,Chemistry,\n')
    expect(await db.sessions.count()).toBe(2)
    expect((await db.labels.toArray()).map((l) => l.name)).toContain('Chemistry')
    const csv = await sessionsCsv()
    expect(csv).toContain('Titration, part 2')
    await db.sessions.clear()
    const again = await importSessionsCsv(csv)
    expect(again.imported).toBe(2)

    await importTasksCsv('title,status,priority,due_date,subtasks\nRead ch. 4,open,high,2026-10-01,[x] skim | [ ] notes\n')
    const [task] = await db.tasks.toArray()
    expect(task.priority).toBe(3)
    expect(task.subtasks.map((s) => s.done)).toEqual([true, false])
    expect(await tasksCsv()).toContain('Read ch. 4')
  })

  it('completing a recurring task spawns the next instance', async () => {
    const today = todayKey()
    const task = await addTask({ title: 'Flashcards', plannedFor: today, recurrence: { freq: 'daily', interval: 1 } })
    const next = await completeTask(task)
    expect(next?.plannedFor).toBe(addDaysKey(today, 1))
    expect(next?.seriesId).toBe(task.seriesId)
    expect((await db.tasks.get(task.id))?.done).toBe(1)
  })
})

describe('Atlas migration (v1 → v2)', () => {
  it('drops sky-theme purchases, keeps challenge rewards and moves settings to the Atlas', async () => {
    db.close()
    await Dexie.delete('lodestar-migrate')
    // A database as the Sky version of Lodestar left it.
    const old = new Dexie('lodestar-migrate')
    old.version(1).stores({
      labels: 'id, parentId, order, updatedAt',
      sessions: 'id, date, startedAt, labelId, taskId, projectId, updatedAt',
      unlocks: 'id, item, updatedAt',
      claims: 'id, challengeId, period, updatedAt',
      settings: 'id',
    })
    await old.open()
    await old.table('unlocks').put({ id: 'u1', item: 'theme:aurora', cost: 150, createdAt: 1, updatedAt: 1 })
    await old.table('claims').put({ id: 'c1', challengeId: 'd-goal', period: '2026-09-01', reward: 25, createdAt: 1, updatedAt: 1 })
    await old.table('settings').put({ id: 'settings', updatedAt: 5, theme: 'dark', skyTheme: 'aurora', onboarded: true })
    old.close()

    const upgraded = new LodestarDB('lodestar-migrate')
    await upgraded.open()
    expect(upgraded.tables.map((t) => t.name)).not.toContain('unlocks')
    expect(await upgraded.claims.get('c1')).toMatchObject({ reward: 25 })
    const s = (await upgraded.settings.get('settings')) as unknown as Record<string, unknown>
    expect(s.skyTheme).toBeUndefined()
    expect(s).toMatchObject({ theme: 'dark', atlasStyle: 'physical', baseCamp: null, breakReview: true, onboarded: true })
    expect(await upgraded.recalls.count()).toBe(0)
    upgraded.close()
    await Dexie.delete('lodestar-migrate')
    await db.open()
  })

  it('imports a v1 backup, ignoring its sky-theme unlocks', async () => {
    const v1 = JSON.stringify({
      app: 'lodestar',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { id: 'settings', updatedAt: 10, theme: 'light', skyTheme: 'nebula', onboarded: true },
      tables: {
        claims: [{ id: 'c1', challengeId: 'w-hours', period: '2026-08-31', reward: 64, createdAt: 1, updatedAt: 1 }],
        unlocks: [{ id: 'u1', item: 'theme:nebula', cost: 300, createdAt: 1, updatedAt: 1 }],
      },
      tombstones: [],
    })
    await restoreBackup(parseBackup(v1), 'replace')
    expect(await db.claims.count()).toBe(1)
    const s = (await db.settings.get('settings')) as unknown as Record<string, unknown>
    expect(s.skyTheme).toBeUndefined()
    expect(s.atlasStyle).toBe('physical')
    const b = await createBackup()
    expect(b.version).toBe(2)
    expect(Object.keys(b.tables)).toEqual(expect.arrayContaining(['recalls', 'expeditions']))
  })
})
