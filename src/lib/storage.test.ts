import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, migrateLegacyKeys, resetLegacyMigration } from './storage'

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('storage keys after the rename to Tars', () => {
  beforeEach(() => resetLegacyMigration())

  it('moves values saved under the Lodestar keys', () => {
    const s = memoryStorage({ 'lodestar.timer.v1': '{"v":1}', 'lodestar.audio.v1': '{"master":0.5}', 'lodestar.theme': 'dark', 'lodestar:atlas:lastVisit': '123' })
    migrateLegacyKeys(s)
    expect(s.getItem(KEYS.timer)).toBe('{"v":1}')
    expect(s.getItem(KEYS.audio)).toBe('{"master":0.5}')
    expect(s.getItem(KEYS.theme)).toBe('dark')
    expect(s.getItem(KEYS.atlasVisit)).toBe('123')
    expect([...s.data.keys()].some((k) => k.startsWith('lodestar'))).toBe(false)
  })

  it('never overwrites a value already saved under the new key', () => {
    const s = memoryStorage({ 'lodestar.theme': 'dark', [KEYS.theme]: 'light' })
    migrateLegacyKeys(s)
    expect(s.getItem(KEYS.theme)).toBe('light')
    expect(s.getItem('lodestar.theme')).toBeNull()
  })

  it('does nothing when there is nothing to move', () => {
    const s = memoryStorage({ [KEYS.timer]: 'x' })
    migrateLegacyKeys(s)
    expect([...s.data.entries()]).toEqual([[KEYS.timer, 'x']])
  })
})
