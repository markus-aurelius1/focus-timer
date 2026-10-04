/** The pieces every notes surface is built from: the draft, the paper you write on, and a saved note. */
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { STICKY_NOTE_LIMIT, type StickyNote } from '@/current-affairs/notes'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { toast } from '@/ui/toast'
import { noteDateLabel, removeNote, restoreNote, saveNote } from './useStickyNotes'

/** A note being written. `save` reports failure instead of losing the draft. */
export function useNoteDraft() {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const canSave = !!draft.trim() && draft.length <= STICKY_NOTE_LIMIT
  const save = (): StickyNote | null => {
    if (!canSave) return null
    try {
      const note = saveNote(draft)
      haptics.success()
      setDraft('')
      setError('')
      return note
    } catch {
      setError('Couldn’t save this note. Your draft and stored notes are preserved.')
      return null
    }
  }
  return { draft, setDraft, canSave, save, error }
}

/** The writing surface: a sheet of note paper with nothing on it but the text and a quiet count. */
export function NoteField({ value, onChange, onSubmit, rows = 4, autoFocus, id, className }: { value: string; onChange: (text: string) => void; onSubmit?: () => void; rows?: number; autoFocus?: boolean; id?: string; className?: string }) {
  const left = STICKY_NOTE_LIMIT - value.length
  return (
    <div className={cn('note-paper px-4 pt-4 pb-2.5', className)}>
      <textarea
        id={id}
        aria-label="Short note"
        data-autofocus={autoFocus || undefined}
        maxLength={STICKY_NOTE_LIMIT}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSubmit?.()
          }
        }}
        placeholder="A fact, a question, a connection…"
        className="block w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-current placeholder:opacity-45"
      />
      <p aria-live="polite" className={cn('tabular text-right text-xs font-medium transition-opacity', left <= 40 ? 'opacity-80' : 'opacity-45')}>
        {value.length} / {STICKY_NOTE_LIMIT}
      </p>
    </div>
  )
}

/** Remove a note, with Undo. Returns an error message when storage refuses. */
export function removeNoteWithUndo(id: string): string | null {
  try {
    removeNote(id)
    toast({
      title: 'Note removed',
      action: {
        label: 'Undo',
        run: () => {
          try {
            restoreNote(id)
          } catch {
            toast({ title: 'Couldn’t restore this note', tone: 'warning' })
          }
        },
      },
    })
    return null
  } catch {
    return 'Couldn’t remove this note. Stored notes are preserved.'
  }
}

export function NoteCard({ note, onError, className }: { note: StickyNote; onError?: (message: string) => void; className?: string }) {
  const date = noteDateLabel(note.createdDate)
  return (
    <article data-sticky-note className={cn('note-paper group px-4 pt-4 pb-1.5', className)}>
      <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{note.text}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <time dateTime={note.createdDate} className="text-xs font-medium opacity-55">
          {date}
        </time>
        <button
          type="button"
          onClick={() => {
            const failed = removeNoteWithUndo(note.id)
            if (failed) onError?.(failed)
          }}
          aria-label={`Remove note from ${date}`}
          className="press -mr-2.5 flex size-11 items-center justify-center rounded-full opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60 sm:group-hover:hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  )
}
