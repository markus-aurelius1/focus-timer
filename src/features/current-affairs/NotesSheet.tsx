/** Short notes without leaving the reading list: the same dated collection as the Notes workspace, in a small Sheet. */
import { Printer } from 'lucide-react'
import { Button } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { NoteCard, NoteField, useNoteDraft } from '@/features/notes/NoteParts'
import { NotesPrintRoot, printNotes } from '@/features/notes/NotesPrint'
import { useStickyNotes } from '@/features/notes/useStickyNotes'

export function NotesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notes, error, setError } = useStickyNotes()
  const draft = useNoteDraft()
  const save = () => {
    if (draft.save()) toast({ title: 'Note saved', tone: 'success' })
  }
  const print = () => {
    if (!printNotes()) setError('Print is unavailable on this device.')
  }
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        size="sm"
        title="Short notes"
        subtitle="One idea. Up to 300 characters."
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={print} disabled={!notes.length} icon={<Printer className="size-4" />}>
              Print notes
            </Button>
            <Button variant="primary" onClick={save} disabled={!draft.canSave}>
              Save note
            </Button>
          </div>
        }
      >
        {(error || draft.error) && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error || draft.error}
          </p>
        )}
        <NoteField value={draft.draft} onChange={draft.setDraft} onSubmit={save} autoFocus />
        <h3 className="t-label mt-6">Saved notes · {notes.length}</h3>
        {!notes.length && <p className="t-meta mt-2">Your dated notes will appear here.</p>}
        <div className="mt-3 space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onError={setError} />
          ))}
        </div>
      </Sheet>
      <NotesPrintRoot notes={notes} />
    </>
  )
}
