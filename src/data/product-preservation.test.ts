/** Removing product surfaces must never erase historical tables or settings. */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createBackup, parseBackup, restoreBackup } from './backup'
import { ensureSeed, DEFAULT_SETTINGS } from './seed'
import { SYNC_TABLES, type RecallAttempt } from './types'
import { indexAtlas } from '@/atlas/data'
import type { PlacesFile } from '@/atlas/types'
import { computeExploration } from '@/atlas/useExploration'
import { xpBreakdown } from '@/game/progression'
import { dailyChallenges, weeklyChallenges } from '@/game/challenges'
import { readFileSync } from 'node:fs'

beforeEach(async () => { await db.delete(); await db.open() })

describe('preserved legacy data', () => {
  it('boot keeps every table and every existing settings field without seeding obsolete features', async () => {
    for (const name of SYNC_TABLES) await db.table(name).put({ id: name + '-history', createdAt: 1, updatedAt: 2, note: 'preserve verbatim' })
    const settings = { ...DEFAULT_SETTINGS, activeProfileId: 'old-profile', baseCamp: 'sikkim', onboarded: true, updatedAt: 123 }
    await db.settings.put(settings)
    const before = await createBackup()
    await ensureSeed()
    await ensureSeed()
    const after = await createBackup()
    expect(after.tables).toEqual(before.tables)
    expect(after.settings).toEqual(settings)
    expect(db.verno).toBe(2)
  })

  it('v3 backup and merge round-trip every legacy table alongside Atlas recall', async () => {
    await ensureSeed()
    for (const name of SYNC_TABLES) await db.table(name).put({ id: name + '-history', createdAt: 1, updatedAt: 2, legacy: name })
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) }
    const backup = parseBackup(JSON.stringify(await createBackup({ storage })))
    await db.delete(); await db.open()
    await restoreBackup(backup, 'merge', { storage })
    await ensureSeed()
    expect((await createBackup({ storage })).tables).toEqual(backup.tables)
    expect((await db.settings.get('settings'))?.activeProfileId).toBeNull()
  })
})

describe('independent Atlas progression', () => {
  const atlas = indexAtlas(JSON.parse(readFileSync(new URL('../../public/atlas/v1/places.json', import.meta.url), 'utf8')) as PlacesFile)
  const attempt: RecallAttempt = { id: 'r', createdAt: 1, updatedAt: 1, placeId: 'in.pass.nathu-la', type: 'state', correct: 1, source: 'card', date: '2026-10-03', at: 1 }
  it('uses existing recall for mastery, coverage, due reviews and XP without sessions or expeditions', () => {
    const ex = computeExploration(atlas, [attempt], [], '2026-10-04')
    expect(ex.mastery.get(attempt.placeId)?.level).toBe('familiar')
    expect(ex.state.discovered.get(attempt.placeId)).toEqual({ at: 1, via: 'recall' })
    expect(ex.xp.total).toBe(1)
    expect(ex.due.map(d => d.id)).toContain(attempt.placeId)
    expect(atlas).not.toHaveProperty('expeditions')
    const wrong = computeExploration(atlas, [{ ...attempt, correct: 0 }], [], '2026-10-04')
    expect(wrong.state.discovered.size).toBe(0)
    expect(wrong.due.map(d => d.id)).toContain(attempt.placeId)
  })

  it('retains recall challenges and ignores old Focus/Planning rewards in active XP', () => {
    const claims = ['d-minutes', 'd-plan', 'd-expedition', 'w-discover', 'd-review'].map(challengeId => ({ id: challengeId, challengeId, period: '2026-10-03', reward: 15, createdAt: 1, updatedAt: 1 }))
    expect(xpBreakdown(claims, [attempt])).toEqual({ challenges: 15, recall: 1, total: 16 })
    const context = { atlas: { reviewed: 8, correct: 30, passesStrong: 2 } }
    for (const today of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      expect(dailyChallenges(today, context, []).map(c => c.id)).toEqual(['d-review'])
      for (const c of weeklyChallenges(today, 1, context, [])) expect(['w-recall', 'w-pass']).toContain(c.id)
    }
  })
})
