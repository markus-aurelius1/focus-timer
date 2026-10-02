/**
 * Notes: a board of short dated notes on paper, with the pen always ready at
 * the top. A second view reads back what you wrote on focus sessions – derived
 * from history, never copied.
 */
import { NotebookPen, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Workspace } from '@/app/Workspace'
import { useLookups, useSessions, useSettings, useTasks } from '@/data/hooks'
import type { Session } from '@/data/types'
import { formatDuration, formatTimeOfDay, relativeDayLabel } from '@/lib/time'
import { Button, IconButton, Segmented } from '@/ui/controls'
import { EmptyState } from '@/ui/feedback'
import { toast } from '@/ui/toast'
import { labelPath } from '@/features/shared/labels'
import { NoteCard, NoteField, useNoteDraft } from './NoteParts'
import { NotesPrintRoot, printNotes } from './NotesPrint'
import { useStickyNotes } from './useStickyNotes'
import { useRouteState } from '@/app/routeState'

type View = 'notes' | 'sessions'

export default function NotesScreen() {
  const { notes, error, setError } = useStickyNotes()
  const sessions = useSessions()
  const sessionNotes = useMemo(() => sessions.filter((s) => s.note.trim()).sort((a, b) => b.startedAt - a.startedAt), [sessions])
  const [view, setView] = useRouteState<View>('notes:view', 'notes')
  const draft = useNoteDraft()

  return (
    <Workspace
      title="Notes"
      back
      width="xl"
      meta={view === 'notes' ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : `${sessionNotes.length} from focus sessions`}
      actions={
        <IconButton
          label="Print notes"
          disabled={!notes.length}
          onClick={() => {
            if (!printNotes()) toast({ title: 'Print is unavailable on this device', tone: 'warning' })
          }}
        >
          <Printer className="size-[18px]" />
        </IconButton>
      }
      toolbar={
        <Segmented<View>
          size="sm"
          layoutId="notes-view"
          value={view}
          onChange={setView}
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'sessions', label: 'From sessions' },
          ]}
        />
      }
    >
      {(error || draft.error) && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error || draft.error}
        </p>
      )}

      {view === 'notes' ? (
        <div className="mt-3 gap-4 pb-6 sm:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <div>
            <NoteField value={draft.draft} onChange={draft.setDraft} onSubmit={() => draft.save()} rows={4} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="t-meta">One idea, dated on save.</p>
              <Button size="sm" variant="primary" disabled={!draft.canSave} onClick={() => draft.save()}>
                Save note
              </Button>
            </div>
          </div>
          {notes.map((note, i) => (
            <NoteCard key={note.id} note={note} onError={setError} className={i < 9 ? 'settle' : undefined} />
          ))}
          {!notes.length && (
            <EmptyState icon={<NotebookPen className="size-6" />} title="Nothing written yet" body="A fact worth keeping, a question to chase, a connection between two topics. Press C anywhere to capture one." className="py-8" />
          )}
        </div>
      ) : (
        <SessionNotes sessions={sessionNotes} />
      )}
      <NotesPrintRoot notes={notes} />
    </Workspace>
  )
}

/** What you wrote when sessions ended, newest first, grouped by day. */
function SessionNotes({ sessions }: { sessions: Session[] }) {
  const settings = useSettings()
  const { label, labels } = useLookups()
  const tasks = useTasks()
  const [limit, setLimit] = useState(40)
  const groups = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of sessions.slice(0, limit)) {
      if (!map.has(s.date)) map.set(s.date, [])
      map.get(s.date)!.push(s)
    }
    return [...map.entries()]
  }, [sessions, limit])

  if (!sessions.length) return <EmptyState icon={<NotebookPen className="size-6" />} title="No session notes yet" body="When a focus session ends you can jot what you covered. Those notes are read back here." className="py-12" />
  return (
    <div className="mt-3 max-w-2xl space-y-7 pb-6">
      {groups.map(([day, list]) => (
        <section key={day}>
          <h2 className="t-label mb-2">{relativeDayLabel(day)}</h2>
          <ul className="space-y-4">
            {list.map((s) => {
              const l = label(s.labelId)
              const task = tasks.find((t) => t.id === s.taskId)
              return (
                <li key={s.id} className="border-l-2 pl-4" style={{ borderColor: l?.color ?? 'var(--line-strong)' }}>
                  <p className="t-body break-words whitespace-pre-wrap">{s.note}</p>
                  <p className="t-meta mt-1">
                    {[l ? labelPath(labels, l.id) : null, task?.title].filter(Boolean).join(' · ') || 'Focus'} · {formatTimeOfDay(s.startedAt, settings.use24h)} · {formatDuration(s.duration)}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {sessions.length > limit && (
        <Button block onClick={() => setLimit((n) => n + 60)}>
          Show more
        </Button>
      )}
    </div>
  )
}
