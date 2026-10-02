/**
 * Quick capture, from anywhere (C, the rail, the command palette): one short
 * note onto paper, or a task in a line of natural language. It never asks where
 * things go – notes are dated and kept, tasks are filed by what you typed.
 */
import { useEffect, useState } from 'react'
import { navigate } from '@/app/router'
import { useUi } from '@/app/ui-store'
import { executeAction } from '@/tars/runtime'
import { Button, Segmented, TextInput } from '@/ui/controls'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { NoteField, useNoteDraft } from './NoteParts'

type Kind = 'note' | 'task'

export function QuickCapture() {
  const open = useUi((s) => s.captureOpen)
  const close = () => useUi.getState().set({ captureOpen: false })
  const [kind, setKind] = useState<Kind>('note')
  const note = useNoteDraft()
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)

  // Each capture starts as a note; an unsaved draft is kept if you close by accident.
  useEffect(() => {
    if (open) setKind('note')
  }, [open])

  const saveNote = () => {
    if (!note.save()) return
    close()
    toast({ title: 'Note saved', tone: 'success', action: { label: 'Open', run: () => navigate('#/notes') } })
  }
  const saveTask = async () => {
    const text = task.trim()
    if (!text || busy) return
    setBusy(true)
    const result = await executeAction('task.create', { text })
    setBusy(false)
    if (!result.ok) return
    setTask('')
    close()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      size="sm"
      title="Capture"
      headerAction={
        <Segmented<Kind>
          size="sm"
          layoutId="capture-kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'note', label: 'Note' },
            { value: 'task', label: 'Task' },
          ]}
        />
      }
      footer={
        <SheetActions>
          <Button onClick={close}>Cancel</Button>
          {kind === 'note' ? (
            <Button variant="primary" onClick={saveNote} disabled={!note.canSave}>
              Save note
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void saveTask()} disabled={!task.trim()} loading={busy}>
              Add task
            </Button>
          )}
        </SheetActions>
      }
    >
      {kind === 'note' ? (
        <div className="pt-1">
          {note.error && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {note.error}
            </p>
          )}
          <NoteField value={note.draft} onChange={note.setDraft} onSubmit={saveNote} autoFocus />
          <p className="t-meta mt-3">One idea, dated today. It’s kept in Notes.</p>
        </div>
      ) : (
        <form
          className="pt-1"
          onSubmit={(e) => {
            e.preventDefault()
            void saveTask()
          }}
        >
          <TextInput value={task} onChange={(e) => setTask(e.target.value)} placeholder="Polity revision tomorrow 5pm #exam" aria-label="Task" autoFocus enterKeyHint="done" />
          <p className="t-meta mt-3">
            Dates, <b className="font-semibold text-ink-2">@Subject</b>, <b className="font-semibold text-ink-2">+Project</b>, <b className="font-semibold text-ink-2">#tags</b>, <b className="font-semibold text-ink-2">!high</b> and <b className="font-semibold text-ink-2">~1h</b> are read from the line.
          </p>
        </form>
      )}
    </Sheet>
  )
}
