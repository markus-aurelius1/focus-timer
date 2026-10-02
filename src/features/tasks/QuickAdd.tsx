import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, CalendarDays, Clock3, Flag, FolderOpen, Hash, NotebookPen, Plus, Repeat2, SlidersHorizontal, Tag, Timer, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useUi } from '@/app/ui-store'
import { useLabels, useProjects } from '@/data/hooks'
import type { Priority, Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { relativeDayLabel, todayKey, type DayKey } from '@/lib/time'
import { inferSubject, parseQuickAdd } from '@/planner/quickAdd'
import { addFromQuickAdd, AmbiguousNameError, normalizeTags } from '@/planner/tasks'
import { haptics } from '@/services/haptics'
import { Button, TextArea } from '@/ui/controls'
import { T } from '@/ui/motion'
import { toast } from '@/ui/toast'
import { DateQuick, DeadlineField, EstimateField, FieldRow, PriorityPicker, ProfilePicker, ProjectPicker, SubjectPicker, TagInput, useSessionMinutes } from './fields'
import { quickAddChipList, type ChipKind } from './quickAddChips'
import { PRIORITY_COLOR } from './TaskItem'

/** Explicit choices made in the expanded panel; they win over what the text says. */
interface Overrides {
  labelId?: string | null
  projectId?: string | null
  priority?: Priority
  plannedFor?: DayKey | null
  due?: { date: DayKey | null; time: string | null }
  estimate?: number
  profileId?: string | null
  notes?: string
  addedTags?: string[]
  removedTags?: string[]
}

const CHIP_ICON: Record<ChipKind, typeof Tag> = {
  date: CalendarDays,
  due: Flag,
  priority: Flag,
  subject: Tag,
  project: FolderOpen,
  tag: Hash,
  estimate: Timer,
  repeat: Repeat2,
}

/**
 * Task capture in two tiers. Type a line and press Enter – "Physics revision
 * tomorrow 5pm #exam ~1h" fills in the date, time, tag and estimate as you
 * type, and the subject is picked up from the title. Or open "More options"
 * to set every field (subject, tags, priority, dates, estimate, timer profile,
 * project, notes) before the task is created.
 */
export function QuickAdd({ defaults, placeholder, autoFocus }: { defaults?: Partial<Task>; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [o, setO] = useState<Overrides>({})
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const labels = useLabels()
  const projects = useProjects()
  const today = todayKey()
  const sessionMinutes = useSessionMinutes(o.profileId)
  const parsed = useMemo(() => parseQuickAdd(text, today, { sessionMinutes }), [text, today, sessionMinutes])

  // What the task will be created with: explicit choices › the text › this list's defaults.
  const namedLabels = parsed.labelName ? labels.filter((l) => l.name.toLowerCase() === parsed.labelName!.toLowerCase()) : []
  const namedLabel = namedLabels.length === 1 ? namedLabels[0] : undefined
  const inferred = !parsed.labelName && o.labelId === undefined && !defaults?.labelId ? inferSubject(parsed.title, labels) : undefined
  const labelId = o.labelId !== undefined ? o.labelId : (namedLabel?.id ?? inferred?.id ?? defaults?.labelId ?? null)
  const namedProjects = parsed.projectName ? projects.filter((p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase()) : []
  const namedProject = namedProjects.length === 1 ? namedProjects[0] : undefined
  const projectId = o.projectId !== undefined ? o.projectId : (namedProject?.id ?? defaults?.projectId ?? null)
  const tags = normalizeTags([...parsed.tags, ...(o.addedTags ?? [])]).filter((t) => !o.removedTags?.includes(t))
  const priority = o.priority ?? parsed.priority ?? defaults?.priority ?? 0
  const plannedFor = o.plannedFor !== undefined ? o.plannedFor : (parsed.plannedFor ?? defaults?.plannedFor ?? null)
  const dueDate = o.due ? o.due.date : (parsed.dueDate ?? defaults?.dueDate ?? null)
  const dueTime = o.due ? o.due.time : (parsed.dueTime ?? null)
  const estimate = o.estimate ?? parsed.estimate ?? defaults?.estimatedPomodoros ?? 1

  const chips = quickAddChipList(parsed, today, inferred?.name)

  const submit = async () => {
    if (!parsed.title || busy) return
    setBusy(true)
    haptics.success()
    try {
      const task = await addFromQuickAdd(
        {
          ...parsed,
          // Explicit picks replace names typed in the text.
          labelName: o.labelId !== undefined ? undefined : namedLabel ? undefined : parsed.labelName,
          projectName: o.projectId !== undefined ? undefined : namedProject ? undefined : parsed.projectName,
          tags,
          priority,
          plannedFor: plannedFor ?? undefined,
          dueDate: dueDate ?? undefined,
          dueTime: dueTime ?? undefined,
          estimate,
        },
        {
          ...defaults,
          labelId,
          projectId,
          plannedFor,
          profileId: o.profileId ?? null,
          notes: o.notes ?? '',
        },
      )
      if (task) {
        const day = task.plannedFor ?? task.dueDate
        // Say where it went when it won't appear in the list in front of you.
        const here = defaults?.projectId
          ? task.projectId === defaults.projectId
          : defaults?.plannedFor
            ? task.plannedFor === defaults.plannedFor || task.dueDate === defaults.plannedFor
            : !task.plannedFor && !task.dueDate && !task.projectId
        if (!here) toast({ title: 'Task added', body: `${task.title}${day ? ` · ${relativeDayLabel(day, today)}` : ''}`, tone: 'success', action: { label: 'Open', run: () => useUi.getState().openTask(task.id) } })
      }
      setText('')
      setO({})
      inputRef.current?.focus()
    } catch (error) {
      toast({ title: error instanceof AmbiguousNameError ? error.message : 'The task couldn’t be saved. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Overrides) => setO((cur) => ({ ...cur, ...patch }))
  const setTags = (next: string[]) => {
    const added = next.filter((t) => !tags.includes(t))
    const removed = tags.filter((t) => !next.includes(t))
    setO((cur) => ({
      ...cur,
      addedTags: normalizeTags([...(cur.addedTags ?? []).filter((t) => !removed.includes(t)), ...added]),
      removedTags: normalizeTags([...(cur.removedTags ?? []).filter((t) => !added.includes(t)), ...removed]),
    }))
  }

  return (
    <div
      className={cn('rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-200', focused || expanded ? 'border-accent/50 shadow-soft' : 'border-line')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void submit()
        } else if (e.key === 'Escape' && expanded) {
          e.stopPropagation()
          setExpanded(false)
          inputRef.current?.focus()
        }
      }}
    >
      <form
        className="flex items-center gap-1.5 py-1.5 pr-1.5 pl-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Plus className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? 'Add a task'}
          aria-label="New task"
          aria-describedby={`${panelId}-chips`}
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          aria-label={expanded ? 'Fewer options' : 'More options'}
          title={expanded ? 'Fewer options' : 'More options – subject, tags, dates…'}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => {
            haptics.tap()
            setExpanded((x) => !x)
          }}
          className={cn('press flex size-9 shrink-0 items-center justify-center rounded-full', expanded ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}
        >
          <SlidersHorizontal className="size-4" />
        </button>
        <button
          type="submit"
          aria-label="Add task"
          disabled={!parsed.title || busy}
          className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink transition-opacity disabled:opacity-25"
        >
          <ArrowUp className="size-4.5" strokeWidth={2.5} />
        </button>
      </form>

      <div id={`${panelId}-chips`} aria-live="polite">
        <AnimatePresence initial={false}>
          {(chips.length > 0 || (focused && !text && !expanded)) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: T.base }} exit={{ height: 0, opacity: 0, transition: T.exit }} className="overflow-hidden">
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                {chips.length ? (
                  chips.map((c) => {
                    const Icon = CHIP_ICON[c.kind]
                    const auto = c.kind === 'subject' && !!inferred && c.text === inferred.name
                    return (
                      <span key={`${c.kind}-${c.text}`} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                        <Icon className="size-3" style={c.kind === 'priority' ? { color: PRIORITY_COLOR[parsed.priority ?? 0] } : undefined} />
                        {c.kind === 'tag' ? c.text.replace(/^#/, '') : c.text}
                        {auto && (
                          <button type="button" aria-label={`Don't file under ${c.text}`} title="Picked up from the title – tap to remove" onClick={() => set({ labelId: null })} className="-mr-1 rounded-full p-0.5 hover:bg-accent/15">
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    )
                  })
                ) : (
                  <span className="text-xs leading-relaxed text-ink-3">
                    Try <b className="font-semibold text-ink-2">Physics revision tomorrow 5pm #exam ~1h</b> · <b className="font-semibold text-ink-2">@Subject</b> · <b className="font-semibold text-ink-2">+Project</b> · <b className="font-semibold text-ink-2">!high</b> · <b className="font-semibold text-ink-2">every mon</b>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: T.layout }}
            exit={{ height: 0, opacity: 0, transition: T.exit }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-line border-t border-line">
              <FieldRow icon={<Tag />} label="Subject" htmlFor={`${panelId}-subject`}>
                <SubjectPicker id={`${panelId}-subject`} value={labelId} onChange={(v) => set({ labelId: v })} hint={inferred && labelId === inferred.id ? 'From title' : undefined} />
              </FieldRow>
              <FieldRow icon={<Hash />} label="Tags" htmlFor={`${panelId}-tags`}>
                <TagInput id={`${panelId}-tags`} value={tags} onChange={setTags} />
              </FieldRow>
              <FieldRow icon={<Flag />} label="Priority">
                <PriorityPicker value={priority} onChange={(p) => set({ priority: p })} />
              </FieldRow>
              <FieldRow icon={<CalendarDays />} label="Plan for" htmlFor={`${panelId}-plan`}>
                <DateQuick id={`${panelId}-plan`} value={plannedFor} onChange={(v) => set({ plannedFor: v })} today={today} />
              </FieldRow>
              <FieldRow icon={<Flag />} label="Deadline" htmlFor={`${panelId}-due`}>
                <DeadlineField id={`${panelId}-due`} date={dueDate} time={dueTime} onChange={(date, time) => set({ due: { date, time } })} />
              </FieldRow>
              <FieldRow icon={<Clock3 />} label="Estimate">
                <EstimateField value={estimate} onChange={(v) => set({ estimate: v })} profileId={o.profileId} />
              </FieldRow>
              <FieldRow icon={<Timer />} label="Timer" htmlFor={`${panelId}-profile`}>
                <ProfilePicker id={`${panelId}-profile`} value={o.profileId ?? null} onChange={(v) => set({ profileId: v })} />
              </FieldRow>
              <FieldRow icon={<FolderOpen />} label="Project" htmlFor={`${panelId}-project`}>
                <ProjectPicker id={`${panelId}-project`} value={projectId} onChange={(v) => set({ projectId: v })} />
              </FieldRow>
              <FieldRow icon={<NotebookPen />} label="Notes" htmlFor={`${panelId}-notes`}>
                <TextArea id={`${panelId}-notes`} value={o.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Links, pages, what “done” looks like…" className="min-h-16 text-[14.5px]" />
              </FieldRow>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
              <p className="text-xs text-ink-3">
                <kbd className="kbd">↵</kbd> in the title adds · <kbd className="kbd">Esc</kbd> closes
              </p>
              <div className="flex gap-2">
                {Object.keys(o).length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setO({})}>
                    Reset
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={() => void submit()} disabled={!parsed.title || busy} icon={<Plus className="size-3.5" />}>
                  Add task
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
