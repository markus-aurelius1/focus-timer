import { relativeDayLabel, type DayKey } from '@/lib/time'
import type { QuickAddResult } from '@/planner/quickAdd'
import { describeRule } from '@/planner/recurrence'

export type ChipKind = 'date' | 'due' | 'priority' | 'project' | 'subject' | 'tag' | 'estimate' | 'repeat'

const PRIORITY = ['None', 'Low', 'Medium', 'High'] as const

/** What a quick-add line was understood as, one chip per field. */
export function quickAddChipList(parsed: QuickAddResult, today: DayKey, inferredSubject?: string): Array<{ kind: ChipKind; text: string }> {
  const chips: Array<{ kind: ChipKind; text: string }> = []
  if (parsed.plannedFor) chips.push({ kind: 'date', text: relativeDayLabel(parsed.plannedFor, today) })
  if (parsed.dueDate) chips.push({ kind: 'due', text: `Due ${relativeDayLabel(parsed.dueDate, today)}${parsed.dueTime ? ` ${parsed.dueTime}` : ''}` })
  if (parsed.priority) chips.push({ kind: 'priority', text: `${PRIORITY[parsed.priority]} priority` })
  if (parsed.labelName) chips.push({ kind: 'subject', text: parsed.labelName })
  else if (inferredSubject) chips.push({ kind: 'subject', text: inferredSubject })
  if (parsed.projectName) chips.push({ kind: 'project', text: parsed.projectName })
  for (const t of parsed.tags) chips.push({ kind: 'tag', text: `#${t}` })
  if (parsed.estimate !== undefined) chips.push({ kind: 'estimate', text: parsed.estimateMinutes ? `${parsed.estimateMinutes} min` : `${parsed.estimate} ${parsed.estimate === 1 ? 'session' : 'sessions'}` })
  if (parsed.recurrence) chips.push({ kind: 'repeat', text: describeRule(parsed.recurrence, parsed.plannedFor ?? parsed.dueDate) })
  return chips
}

export function quickAddChips(parsed: QuickAddResult, today: DayKey, inferredSubject?: string): string[] {
  return quickAddChipList(parsed, today, inferredSubject).map((c) => c.text)
}
