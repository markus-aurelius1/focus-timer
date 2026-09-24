/** Writes for the Atlas: expedition runs, base camp and recall answers. */
import { db } from '@/data/db'
import { updateSettings } from '@/data/hooks'
import { create, patch } from '@/data/repo'
import type { QuestionType, RecallSource } from '@/data/types'
import { dayKey } from '@/lib/time'
import type { AtlasData } from './data'
import { suggestExpedition } from './explore'

async function currentRun() {
  const runs = await db.expeditions.toArray()
  return runs.filter((r) => r.endedAt === null).sort((a, b) => b.startedAt - a.startedAt)[0]
}

/** Make `expeditionId` the active expedition from now on. */
export async function startExpedition(expeditionId: string, at = Date.now()): Promise<void> {
  const cur = await currentRun()
  if (cur?.expeditionId === expeditionId) return
  if (cur) await patch('expeditions', cur.id, { endedAt: at })
  await create('expeditions', { expeditionId, startedAt: at, endedAt: null })
}

/** Pause expeditions: minutes go to the free survey until another is chosen. */
export async function stopExpedition(at = Date.now()): Promise<void> {
  const cur = await currentRun()
  if (cur) await patch('expeditions', cur.id, { endedAt: at })
}

/**
 * Set the base camp. The first time, the suggested expedition starts – from the
 * first recorded session, so an existing user's past focus is replayed through
 * it and part of the map is already explored.
 */
export async function chooseBaseCamp(atlas: AtlasData, stateId: string): Promise<void> {
  await updateSettings({ baseCamp: stateId })
  if ((await db.expeditions.count()) > 0) return
  const first = await db.sessions.orderBy('startedAt').first()
  const e = suggestExpedition(atlas, stateId)
  await create('expeditions', { expeditionId: e.id, startedAt: first ? first.startedAt - 1000 : Date.now(), endedAt: null })
}

export async function recordRecall(placeId: string, type: QuestionType, correct: boolean, source: RecallSource): Promise<void> {
  const at = Date.now()
  await create('recalls', { placeId, type, correct: correct ? 1 : 0, at, date: dayKey(at), source })
}
