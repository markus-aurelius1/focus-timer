/** Short dated personal notes, isolated from feed metadata and legacy article notes. */
import type { StateStorage } from './personal-state'
export const CA_NOTES_KEY = 'tars.current-affairs.notes.v1'
export const STICKY_NOTE_LIMIT = 300
export interface StickyNote { id: string; text: string; createdAt: number; createdDate: string; deletedAt?: number }
export interface StickyNotes { version: 1; entries: Record<string, StickyNote> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function systemDate(time: number): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function parseStickyNotes(raw: string | null): StickyNotes {
  if (raw === null) return { version: 1, entries: {} }
  const value = JSON.parse(raw)
  if (value?.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw new Error('Unrecognized notes format')
  const entries: Record<string, StickyNote> = {}
  for (const [id, row] of Object.entries(value.entries) as [string, StickyNote][]) {
    if (!uuid.test(id) || !row || typeof row.text !== 'string' || !Number.isFinite(row.createdAt) || row.createdAt <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.createdDate) || !Number.isFinite(Date.parse(row.createdDate))) continue
    entries[id] = { id, text: row.text.slice(0, STICKY_NOTE_LIMIT), createdAt: row.createdAt, createdDate: row.createdDate, ...(typeof row.deletedAt === 'number' && Number.isFinite(row.deletedAt) && row.deletedAt > 0 ? { deletedAt: row.deletedAt } : {}) }
  }
  return { version: 1, entries }
}
export function visibleNotes(state: StickyNotes): StickyNote[] {
  return Object.values(state.entries).filter(n => !n.deletedAt).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}
export function writeStickyNote(storage: StateStorage, id: string, text: string, now = Date.now()): StickyNotes {
  if (!uuid.test(id) || !text.trim() || text.length > STICKY_NOTE_LIMIT || !Number.isFinite(now) || now <= 0) throw new Error('Write a short note before saving')
  const state = parseStickyNotes(storage.getItem(CA_NOTES_KEY))
  if (state.entries[id]) throw new Error('This note already exists')
  state.entries[id] = { id, text: text.trim(), createdAt: now, createdDate: systemDate(now) }
  storage.setItem(CA_NOTES_KEY, JSON.stringify(state))
  return state
}
export function setNoteDeleted(storage: StateStorage, id: string, deletedAt?: number): StickyNotes {
  const state = parseStickyNotes(storage.getItem(CA_NOTES_KEY)), row = state.entries[id]
  if (!row) throw new Error('This note is unavailable')
  state.entries[id] = { ...row, deletedAt }
  storage.setItem(CA_NOTES_KEY, JSON.stringify(state))
  return state
}
