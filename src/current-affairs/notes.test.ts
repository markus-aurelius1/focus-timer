/** Short note limits, immutable system dates, fresh-storage writes and failure preservation. */
import { describe, expect, it } from 'vitest'
import { CA_NOTES_KEY, STICKY_NOTE_LIMIT, parseStickyNotes, setNoteDeleted, systemDate, visibleNotes, writeStickyNote } from './notes'
import type { StateStorage } from './personal-state'
const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222'
const storage = (): StateStorage => { let raw: string | null = null; return { getItem: () => raw, setItem: (key, value) => { expect(key).toBe(CA_NOTES_KEY); raw = value } } }
describe('Short dated notes', () => {
  it('saves short user text with the current system date and retains earlier notes on later writes', () => {
    const disk = storage(), time = new Date(2026, 9, 1, 23, 59).getTime()
    writeStickyNote(disk, first, '  One useful connection  ', time)
    const state = writeStickyNote(disk, second, 'Next idea', time + 86400000)
    expect(state.entries[first]).toMatchObject({ text: 'One useful connection', createdAt: time, createdDate: '2026-10-01' })
    expect(systemDate(time)).toBe('2026-10-01')
    expect(visibleNotes(state).map(n => n.id)).toEqual([second, first])
  })
  it('enforces a short maximum and refuses blank/duplicate writes without silently clipping a new note', () => {
    const disk = storage()
    for (const text of ['', '  ', 'a'.repeat(STICKY_NOTE_LIMIT + 1)]) expect(() => writeStickyNote(disk, first, text)).toThrow()
    writeStickyNote(disk, first, 'a'.repeat(STICKY_NOTE_LIMIT))
    expect(() => writeStickyNote(disk, first, 'Replace')).toThrow()
    expect(parseStickyNotes(disk.getItem(CA_NOTES_KEY)).entries[first].text).toHaveLength(STICKY_NOTE_LIMIT)
  })
  it('deletes/restores without changing the created date or losing other notes', () => {
    const disk = storage()
    writeStickyNote(disk, first, 'Keep the date', 100)
    writeStickyNote(disk, second, 'Another note', 200)
    expect(visibleNotes(setNoteDeleted(disk, first, 300))).toHaveLength(1)
    expect(visibleNotes(setNoteDeleted(disk, first))).toHaveLength(2)
    expect(parseStickyNotes(disk.getItem(CA_NOTES_KEY)).entries[first].createdAt).toBe(100)
  })
  it('preserves malformed/future notes and propagates storage failures', () => {
    for (const raw of ['broken', '{"version":2,"entries":{}}']) {
      let writes = 0
      expect(() => writeStickyNote({ getItem: () => raw, setItem: () => { writes++ } }, first, 'Note')).toThrow()
      expect(writes).toBe(0)
    }
    expect(() => writeStickyNote({ getItem: () => null, setItem: () => { throw new Error('quota') } }, first, 'Note')).toThrow('quota')
  })
})
