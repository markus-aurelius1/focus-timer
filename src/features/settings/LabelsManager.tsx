import { Archive, ArchiveRestore, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/data/db'
import { useLabels } from '@/data/hooks'
import { create, patch } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Label, LabelKind } from '@/data/types'
import { labelScope } from '@/stats/aggregate'
import { Button, Field, IconButton, ListRow, Select, TextInput } from '@/ui/controls'
import { ColorPicker } from '@/ui/ColorPicker'
import { Sheet, SheetActions, SheetFooter } from '@/ui/Sheet'
import { flattenLabels, LABEL_KIND_NAME } from '@/features/shared/labels'
import { deleteLabel } from '@/data/deletion'
import { toast } from '@/ui/toast'

/** Exam → Subject → Topic, or any flat set of labels. Structure is optional. */
export function LabelsManager() {
  const labels = useLabels(true)
  const tree = useMemo(() => flattenLabels(labels), [labels])
  const [editing, setEditing] = useState<Label | { parentId: string | null } | null>(null)
  return (
    <div>
      {tree.length > 0 && (
        <ul className="divide-y divide-line">
          {tree.map(({ label, depth }) => (
            <li key={label.id}>
              <div style={{ paddingLeft: depth * 20 }}>
                <ListRow
                  className="px-4"
                  leading={<span className="size-3 shrink-0 rounded-full" style={{ background: label.color, opacity: label.archived ? 0.4 : 1 }} />}
                  title={<span className={label.archived ? 'text-ink-3 line-through' : undefined}>{label.name}</span>}
                  trailing={
                    <span className="flex items-center gap-2 text-xs font-medium text-ink-3">
                      {LABEL_KIND_NAME[label.kind]}
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  }
                  onClick={() => setEditing(label)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line p-3">
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ parentId: null })}>
          Add subject or label
        </Button>
      </div>
      <LabelSheet target={editing} labels={labels} onClose={() => setEditing(null)} />
    </div>
  )
}

function LabelSheet({ target, labels, onClose }: { target: Label | { parentId: string | null } | null; labels: Label[]; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LabelKind>('subject')
  const [parentId, setParentId] = useState('')
  const [color, setColor] = useState<string>(PALETTE[0].value)

  useEffect(() => {
    if (!target) return
    setName(existing?.name ?? '')
    setKind(existing?.kind ?? 'subject')
    setParentId(existing?.parentId ?? (target.parentId || ''))
    setColor(existing?.color ?? PALETTE[labels.length % PALETTE.length].value)
  }, [target]) // existing derives from target

  // A label can't be moved under itself or one of its own descendants.
  const blocked = existing ? labelScope(labels, existing.id) : new Set<string>()
  const parents = flattenLabels(labels.filter((l) => !l.archived)).filter(({ label }) => !blocked.has(label.id))

  const save = async () => {
    const data = { name: name.trim() || 'Untitled', kind, parentId: parentId || null, color }
    if (existing) await patch('labels', existing.id, data)
    else await create('labels', { ...data, archived: false, order: labels.length })
    onClose()
  }

  const del = async () => {
    if (!existing) return
    const children = labels.filter((l) => l.parentId === existing.id)
    const used = await db.sessions.where('labelId').equals(existing.id).count()
    const deleted = await deleteLabel(existing.id)
    onClose()
    if (!deleted) return
    // What the delete changed, said plainly, with the way back.
    const effects = [used ? `${used} ${used === 1 ? 'session keeps its' : 'sessions keep their'} time but ${used === 1 ? 'loses' : 'lose'} this label.` : '', children.length ? 'Its topics moved up a level.' : ''].filter(Boolean).join(' ')
    toast({ title: `“${existing.name}” deleted`, body: effects || undefined, action: { label: 'Undo', run: () => void deleted.undo() } })
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={existing ? 'Edit label' : 'New label'}>
      <div className="space-y-5">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A-level Biology, Organic chemistry, Reading" data-autofocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as LabelKind)}>
              {(Object.keys(LABEL_KIND_NAME) as LabelKind[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_KIND_NAME[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Inside">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Top level</option>
              {parents.map(({ label, path }) => (
                <option key={label.id} value={label.id}>
                  {path}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
      <SheetFooter>
        <SheetActions
          start={
            existing && (
              <>
                <IconButton label="Delete label" onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
                <IconButton
                  label={existing.archived ? 'Restore label' : 'Archive label'}
                  onClick={async () => {
                    await patch('labels', existing.id, { archived: !existing.archived })
                    onClose()
                  }}
                >
                  {existing.archived ? <ArchiveRestore className="size-4.5" /> : <Archive className="size-4.5" />}
                </IconButton>
              </>
            )
          }
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </SheetActions>
      </SheetFooter>
    </Sheet>
  )
}
