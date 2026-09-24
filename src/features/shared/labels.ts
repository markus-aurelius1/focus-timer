import type { Label } from '@/data/types'

export interface LabelNode {
  label: Label
  depth: number
  path: string
}

/** Depth-first flattening of the label tree (Exam → Subject → Topic). */
export function flattenLabels(labels: Label[]): LabelNode[] {
  const children = new Map<string | null, Label[]>()
  const ids = new Set(labels.map((l) => l.id))
  for (const l of labels) {
    const parent = l.parentId && ids.has(l.parentId) ? l.parentId : null
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent)!.push(l)
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const out: LabelNode[] = []
  const walk = (parent: string | null, depth: number, prefix: string, seen: Set<string>) => {
    for (const l of children.get(parent) ?? []) {
      if (seen.has(l.id)) continue
      seen.add(l.id)
      const path = prefix ? `${prefix} › ${l.name}` : l.name
      out.push({ label: l, depth, path })
      walk(l.id, depth + 1, path, seen)
    }
  }
  walk(null, 0, '', new Set())
  return out
}

export function labelPath(labels: Label[], id: string | null | undefined): string {
  if (!id) return ''
  const byId = new Map(labels.map((l) => [l.id, l]))
  const parts: string[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' › ')
}

export const LABEL_KIND_NAME: Record<Label['kind'], string> = {
  exam: 'Exam / course',
  subject: 'Subject',
  topic: 'Topic',
  label: 'Label',
}
