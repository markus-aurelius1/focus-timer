/**
 * One collection of short dated notes, used by the Current Affairs sheet. Storage and its rules live in
 * current-affairs/notes.ts (localStorage, 300 characters, dated on save); this
 * keeps every open view in step, in this tab and across tabs.
 */
import { useEffect, useState } from 'react'
import { CA_NOTES_KEY, parseStickyNotes, setNoteDeleted, visibleNotes, writeStickyNote, type StickyNote, type StickyNotes } from '@/current-affairs/notes'

/** `storage` events only reach other tabs; this one tells the views in this tab. */
const CHANGED = 'tars:notes-changed'
const announce = () => window.dispatchEvent(new Event(CHANGED))

/** Save a new note. Throws when the text is blank, too long or storage refuses the write. */
export function saveNote(text: string): StickyNote {
  const id = crypto.randomUUID()
  const state = writeStickyNote(localStorage, id, text)
  announce()
  return state.entries[id]
}

/** Remove a note (it keeps its date, so Undo restores it exactly). */
export function removeNote(id: string) {
  setNoteDeleted(localStorage, id, Date.now())
  announce()
}

export function restoreNote(id: string) {
  setNoteDeleted(localStorage, id)
  announce()
}

export function useStickyNotes() {
  const [state, setState] = useState<StickyNotes>({ version: 1, entries: {} })
  const [error, setError] = useState('')
  useEffect(() => {
    const load = () => {
      try {
        setState(parseStickyNotes(localStorage.getItem(CA_NOTES_KEY)))
        setError('')
      } catch {
        setError('Notes couldn’t be loaded. Stored notes have been preserved.')
      }
    }
    const changed = (event: StorageEvent) => {
      if (event.key === CA_NOTES_KEY || event.key === null) load()
    }
    load()
    window.addEventListener('storage', changed)
    window.addEventListener(CHANGED, load)
    return () => {
      window.removeEventListener('storage', changed)
      window.removeEventListener(CHANGED, load)
    }
  }, [])
  return { notes: visibleNotes(state), error, setError }
}

export const noteDateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
