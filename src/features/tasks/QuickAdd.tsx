import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useUi } from '@/app/ui-store'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { relativeDayLabel, todayKey } from '@/lib/time'
import { parseQuickAdd } from '@/planner/quickAdd'
import { describeRule } from '@/planner/recurrence'
import { addFromQuickAdd } from '@/planner/tasks'
import { haptics } from '@/services/haptics'
import { PRIORITY_NAME } from './TaskItem'

/**
 * Natural-language capture. Type "Essay draft fri !high #History ~3" and the
 * date, priority, project and estimate are pulled out as you type.
 */
export function QuickAdd({ defaults, placeholder, autoFocus }: { defaults?: Partial<Task>; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = todayKey()
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today])

  const submit = async () => {
    if (!parsed.title) return
    haptics.success()
    await addFromQuickAdd(parsed, defaults)
    setText('')
    inputRef.current?.focus()
  }

  const chips: string[] = []
  if (parsed.plannedFor) chips.push(`📅 ${relativeDayLabel(parsed.plannedFor, today)}`)
  if (parsed.dueDate) chips.push(`⚑ Due ${relativeDayLabel(parsed.dueDate, today)}${parsed.dueTime ? ` ${parsed.dueTime}` : ''}`)
  if (parsed.priority) chips.push(`! ${PRIORITY_NAME[parsed.priority]}`)
  if (parsed.projectName) chips.push(`# ${parsed.projectName}`)
  if (parsed.labelName) chips.push(`@ ${parsed.labelName}`)
  if (parsed.estimate !== undefined) chips.push(`◷ ${parsed.estimate} sessions`)
  if (parsed.recurrence) chips.push(`↻ ${describeRule(parsed.recurrence, parsed.plannedFor ?? parsed.dueDate)}`)

  return (
    <div className={cn('rounded-2xl border bg-surface shadow-soft transition-colors', focused ? 'border-accent/50' : 'border-line')}>
      <form
        className="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Plus className="size-5 shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? 'Add a task'}
          aria-label="Add a task"
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        {text.trim() ? (
          <button type="submit" aria-label="Add task" className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-ink">
            <ArrowUp className="size-4.5" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Add with details"
            onClick={() => useUi.getState().newTask({ plannedFor: defaults?.plannedFor ?? null, projectId: defaults?.projectId ?? null, labelId: defaults?.labelId ?? null })}
            className="flex size-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        )}
      </form>
      <AnimatePresence initial={false}>
        {(chips.length > 0 || (focused && !text)) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
              {chips.length ? (
                chips.map((c) => (
                  <span key={c} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-xs text-ink-3">
                  Try <b className="font-semibold text-ink-2">Read ch. 4 tomorrow !high #Biology ~2</b> · <b className="font-semibold text-ink-2">due fri</b> · <b className="font-semibold text-ink-2">every mon</b>
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
