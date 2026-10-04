/** The print-only twin of the notes collection: user text and dates, nothing else. */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { StickyNote } from '@/current-affairs/notes'
import { noteDateLabel } from './useStickyNotes'
import './notes.css'

const PRINTING = 'ca-printing-notes'

/** Open the browser's print dialog for the notes alone. Returns false where printing is unavailable. */
export function printNotes(): boolean {
  try {
    document.body.classList.add(PRINTING)
    window.print()
    return true
  } catch {
    document.body.classList.remove(PRINTING)
    return false
  }
}

export function NotesPrintRoot({ notes }: { notes: StickyNote[] }) {
  useEffect(() => {
    const afterPrint = () => document.body.classList.remove(PRINTING)
    window.addEventListener('afterprint', afterPrint)
    return () => {
      window.removeEventListener('afterprint', afterPrint)
      afterPrint()
    }
  }, [])
  return createPortal(
    <section className="ca-print-root" aria-label="Printable notes">
      <h1>Tars · Notes</h1>
      <p>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </p>
      {notes.map((note) => (
        <article key={note.id}>
          <h2>{noteDateLabel(note.createdDate)}</h2>
          <p>{note.text}</p>
        </article>
      ))}
    </section>,
    document.body,
  )
}
