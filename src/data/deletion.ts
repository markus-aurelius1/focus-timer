/**
 * Deleting things that can be brought back.
 *
 * The product's rule is "Undo, not Are you sure?": a delete happens at once and
 * a toast offers Undo. Each function here removes one record together with what
 * depends on it, in a single transaction, and returns what is needed to put
 * everything back exactly: the records as they were, and the tombstones gone.
 *
 * Dependents that were only re-pointed (a deleted label's topics move up a
 * level, a deleted project's tasks go to the inbox) are pointed back on undo –
 * but only those still where the delete left them, so anything the learner
 * changed in between is kept.
 */
import { db } from './db'
import type { SyncTable, TableMap } from './types'

export interface Deleted {
  /** Put back everything this delete removed or re-pointed. Safe to call once. */
  undo: () => Promise<void>
}

const tomb = (table: SyncTable, id: string, now: number) => ({ id: `${table}:${id}`, table, entityId: id, deletedAt: now })

async function removeOne<K extends SyncTable>(name: K, id: string): Promise<TableMap[K] | undefined> {
  const table = db.table<TableMap[K], string>(name)
  const record = await table.get(id)
  if (!record) return undefined
  await table.delete(id)
  await db.tombstones.put(tomb(name, id, Date.now()))
  return record
}

async function putBack<K extends SyncTable>(name: K, record: TableMap[K]): Promise<void> {
  await db.table<TableMap[K], string>(name).put({ ...record, updatedAt: Date.now() })
  await db.tombstones.delete(`${name}:${record.id}`)
}

/** A record with no dependents. */
async function simple<K extends SyncTable>(name: K, id: string): Promise<Deleted | null> {
  const record = await db.transaction('rw', [db.table(name), db.tombstones], () => removeOne(name, id))
  if (!record) return null
  return { undo: () => db.transaction('rw', [db.table(name), db.tombstones], () => putBack(name, record)) }
}

/** A calendar item (for a repeating one, the whole series – it is one record). */
export const deleteEvent = (id: string): Promise<Deleted | null> => simple('events', id)
export const deleteGoal = (id: string): Promise<Deleted | null> => simple('goals', id)
/** A focus session. Statistics, XP and Atlas progress are derived from sessions, so they follow it out and back. */
export const deleteSession = (id: string): Promise<Deleted | null> => simple('sessions', id)

/** A habit and its check-ins. */
export async function deleteHabit(id: string): Promise<Deleted | null> {
  const removed = await db.transaction('rw', [db.habits, db.habitLogs, db.tombstones], async () => {
    const habit = await removeOne('habits', id)
    if (!habit) return null
    const logs = await db.habitLogs.where('habitId').equals(id).toArray()
    const now = Date.now()
    await db.habitLogs.bulkDelete(logs.map((l) => l.id))
    await db.tombstones.bulkPut(logs.map((l) => tomb('habitLogs', l.id, now)))
    return { habit, logs }
  })
  if (!removed) return null
  return {
    undo: () =>
      db.transaction('rw', [db.habits, db.habitLogs, db.tombstones], async () => {
        await putBack('habits', removed.habit)
        // Check-ins come back untouched: they are history, not something the undo edits.
        await db.habitLogs.bulkPut(removed.logs)
        await db.tombstones.bulkDelete(removed.logs.map((l) => `habitLogs:${l.id}`))
      }),
  }
}

/** A label. Its topics move up a level; sessions and tasks keep their time and simply show no label until it returns. */
export async function deleteLabel(id: string): Promise<Deleted | null> {
  const removed = await db.transaction('rw', [db.labels, db.tombstones], async () => {
    const label = await removeOne('labels', id)
    if (!label) return null
    const children = await db.labels.where('parentId').equals(id).toArray()
    const now = Date.now()
    for (const c of children) await db.labels.update(c.id, { parentId: label.parentId, updatedAt: now })
    return { label, childIds: children.map((c) => c.id) }
  })
  if (!removed) return null
  return {
    undo: () =>
      db.transaction('rw', [db.labels, db.tombstones], async () => {
        await putBack('labels', removed.label)
        const now = Date.now()
        for (const childId of removed.childIds) {
          const child = await db.labels.get(childId)
          if (child && child.parentId === removed.label.parentId) await db.labels.update(childId, { parentId: removed.label.id, updatedAt: now })
        }
      }),
  }
}

/** A project. Its tasks move to the inbox; focus history is untouched. */
export async function deleteProject(id: string): Promise<Deleted | null> {
  const removed = await db.transaction('rw', [db.projects, db.tasks, db.tombstones], async () => {
    const project = await removeOne('projects', id)
    if (!project) return null
    const tasks = await db.tasks.where('projectId').equals(id).toArray()
    const now = Date.now()
    for (const t of tasks) await db.tasks.update(t.id, { projectId: null, updatedAt: now })
    return { project, taskIds: tasks.map((t) => t.id) }
  })
  if (!removed) return null
  return {
    undo: () =>
      db.transaction('rw', [db.projects, db.tasks, db.tombstones], async () => {
        await putBack('projects', removed.project)
        const now = Date.now()
        for (const taskId of removed.taskIds) {
          const task = await db.tasks.get(taskId)
          if (task && task.projectId === null) await db.tasks.update(taskId, { projectId: removed.project.id, updatedAt: now })
        }
      }),
  }
}
