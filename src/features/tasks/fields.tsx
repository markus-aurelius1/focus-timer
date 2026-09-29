/**
 * Task fields shared by quick add (expanded) and the task sheet, so a task can
 * get its subject, tags and the rest right when it is created.
 */
import { Check, ChevronDown, Flag, Hash, Plus, Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLabels, useProfiles, useProjects, useSettings, useTasks } from '@/data/hooks'
import { create } from '@/data/repo'
import { PALETTE } from '@/data/seed'
import type { Priority } from '@/data/types'
import { cn } from '@/lib/cn'
import { addDaysKey, relativeDayLabel, startOfWeekKey, type DayKey } from '@/lib/time'
import { normalizeTags, tagUsage } from '@/planner/tasks'
import { haptics } from '@/services/haptics'
import { Chip, Select, Stepper } from '@/ui/controls'
import { Popover } from '@/ui/Popover'
import { flattenLabels } from '@/features/shared/labels'
import { profileSummary } from '@/features/focus/ProfileSheet'
import { PRIORITY_COLOR, PRIORITY_NAME } from './TaskItem'

/** One labelled field row: label beside the control on wider screens, above it on phones. */
export function FieldRow({ icon, label, children, htmlFor }: { icon?: ReactNode; label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center">
      <label htmlFor={htmlFor} className="flex min-h-8 items-center gap-2 text-[13px] font-semibold text-ink-2">
        {icon && <span className="text-ink-3 [&>svg]:size-4">{icon}</span>}
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ───────────────────────── subject ─────────────────────────

/** Searchable subject picker with colour dots; type a new name to create it. */
export function SubjectPicker({ value, onChange, id, hint }: { value: string | null; onChange: (id: string | null) => void; id?: string; hint?: string }) {
  const labels = useLabels()
  const tree = useMemo(() => flattenLabels(labels), [labels])
  const selected = labels.find((l) => l.id === value)
  const selectedPath = tree.find((n) => n.label.id === value)?.path
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const q = query.trim().toLowerCase()
  const matches = tree.filter((n) => !q || n.path.toLowerCase().includes(q))
  const exact = tree.some((n) => n.label.name.toLowerCase() === q)
  type Option = { key: string; label: ReactNode; run: () => void | Promise<void> }
  const options: Option[] = [
    ...(!q ? [{ key: 'none', label: <span className="text-ink-2">No subject</span>, run: () => pick(null) }] : []),
    ...matches.map((n) => ({
      key: n.label.id,
      label: (
        <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: q ? 0 : n.depth * 14 }}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: n.label.color }} />
          <span className="truncate">{q ? n.path : n.label.name}</span>
        </span>
      ),
      run: () => pick(n.label.id),
    })),
    ...(q && !exact
      ? [
          {
            key: 'create',
            label: (
              <span className="flex items-center gap-2 text-accent">
                <Plus className="size-4" /> Create subject “{query.trim()}”
              </span>
            ),
            run: async () => {
              const l = await create('labels', {
                name: query.trim().charAt(0).toUpperCase() + query.trim().slice(1),
                color: PALETTE[labels.length % PALETTE.length].value,
                parentId: null,
                kind: 'subject',
                archived: false,
                order: labels.length,
              })
              pick(l.id)
            },
          },
        ]
      : []),
  ]

  function pick(next: string | null) {
    haptics.tap()
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setActive(0)
          setOpen((o) => !o)
        }}
        className={cn('press flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-[14.5px] hover:border-line-strong', open && 'border-accent/60 ring-2 ring-accent/15')}
      >
        {selected ? (
          <>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: selected.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{selectedPath ?? selected.name}</span>
            {hint && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-bold text-accent">{hint}</span>}
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-3">Choose a subject</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={trigger} label="Subjects">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(options.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                void options[active]?.run()
              }
            }}
            placeholder="Find or create a subject"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          />
        </div>
        <div id={listId} role="listbox" aria-label="Subjects" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {options.map((o, i) => {
            const isSel = o.key === (value ?? 'none')
            return (
              <div
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSel}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => void o.run()}
                className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold', i === active && 'bg-surface-2')}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {isSel && <Check className="size-4 shrink-0 text-accent" />}
              </div>
            )
          })}
          {!options.length && <p className="px-3 py-4 text-sm text-ink-2">No subjects yet – type a name to create one.</p>}
        </div>
      </Popover>
    </>
  )
}

// ───────────────────────── tags ─────────────────────────

/** Multi-select tags: type to filter existing ones, Enter or comma to add (new ones are created). */
export function TagInput({ value, onChange, id }: { value: string[]; onChange: (tags: string[]) => void; id?: string }) {
  const tasks = useTasks()
  const known = useMemo(() => tagUsage(tasks), [tasks])
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const draft = normalizeTags([text])[0] ?? ''
  const suggestions = known.filter((t) => !value.includes(t) && (!draft || t.includes(draft))).slice(0, 8)
  const canCreate = !!draft && !value.includes(draft) && !known.includes(draft)

  const add = (tag: string) => {
    const next = normalizeTags([...value, tag])
    if (next.length !== value.length) haptics.tap()
    onChange(next)
    setText('')
  }

  return (
    <div>
      <div className={cn('flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-surface px-2 py-1.5 transition-colors', focused ? 'border-accent/60 ring-2 ring-accent/15' : 'border-line')}>
        {value.map((t) => (
          <span key={t} className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2 text-[12.5px] font-bold text-accent">
            <span className="truncate">#{t}</span>
            <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-accent/15">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/,/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (draft) add(draft)
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && draft) {
              e.preventDefault()
              add(suggestions.length && !canCreate && e.key === 'Enter' ? suggestions[0] : draft)
            } else if (e.key === 'Enter') e.preventDefault()
            else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
          }}
          placeholder={value.length ? 'Add another' : 'Add tags – exam, revision…'}
          aria-label="Add a tag"
          enterKeyHint="enter"
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-[14.5px] outline-none placeholder:text-ink-3"
        />
      </div>
      {(focused || text) && (suggestions.length > 0 || canCreate) && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tag suggestions">
          {canCreate && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(draft)} className="press inline-flex items-center gap-1 rounded-full border border-dashed border-accent/60 px-2.5 py-1 text-xs font-bold text-accent">
              <Plus className="size-3" /> Create #{draft}
            </button>
          )}
          {suggestions.map((t) => (
            <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)} className="press inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink-2 hover:text-ink">
              <Hash className="size-3" />
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── priority ─────────────────────────

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Priority">
      {([0, 1, 2, 3] as Priority[]).map((p) => {
        const on = value === p
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              haptics.tap()
              onChange(p)
            }}
            className={cn('press inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold', on ? 'border-transparent text-white' : 'border-line text-ink-2 hover:text-ink')}
            style={on ? { background: p ? PRIORITY_COLOR[p] : 'var(--ink-3)' } : undefined}
          >
            {p > 0 && <Flag className="size-3" style={on ? undefined : { color: PRIORITY_COLOR[p] }} />}
            {PRIORITY_NAME[p]}
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────── dates ─────────────────────────

export function DateQuick({ value, onChange, today, id }: { value: DayKey | null; onChange: (v: DayKey | null) => void; today: DayKey; id?: string }) {
  const options: Array<[string, DayKey]> = [
    ['Today', today],
    ['Tomorrow', addDaysKey(today, 1)],
    ['Next week', addDaysKey(startOfWeekKey(today, 1), 7)],
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map(([label, key]) => (
        <Chip key={label} active={value === key} onClick={() => onChange(value === key ? null : key)}>
          {label}
        </Chip>
      ))}
      <input id={id} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="h-8 min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm" aria-label="Date" />
      {value && !options.some(([, k]) => k === value) && <span className="text-xs font-semibold text-ink-2">{relativeDayLabel(value, today)}</span>}
    </div>
  )
}

export function DeadlineField({ date, time, onChange, id }: { date: DayKey | null; time: string | null; onChange: (date: DayKey | null, time: string | null) => void; id?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input id={id} type="date" value={date ?? ''} onChange={(e) => onChange(e.target.value || null, e.target.value ? time : null)} className="h-8 min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm" aria-label="Deadline date" />
      {date && (
        <>
          <input type="time" value={time ?? ''} onChange={(e) => onChange(date, e.target.value || null)} className="h-8 min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm" aria-label="Deadline time" />
          <button type="button" className="text-xs font-bold text-ink-3 hover:text-ink" onClick={() => onChange(null, null)}>
            Clear
          </button>
        </>
      )}
    </div>
  )
}

// ───────────────────────── estimate & profile ─────────────────────────

/** Minutes per session for a task: its own profile, else the active one. */
export function useSessionMinutes(profileId?: string | null): number {
  const profiles = useProfiles()
  const settings = useSettings()
  const p = profiles.find((x) => x.id === profileId) ?? profiles.find((x) => x.id === settings.activeProfileId) ?? profiles[0]
  return p?.focusMinutes || 25
}

export function EstimateField({ value, onChange, profileId }: { value: number; onChange: (v: number) => void; profileId?: string | null }) {
  const per = useSessionMinutes(profileId)
  const total = value * per
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Stepper label="Estimated sessions" value={value} onChange={onChange} min={0} max={40} suffix={value === 1 ? 'session' : 'sessions'} />
      <span className="text-xs font-semibold text-ink-3">{value ? `≈ ${total >= 60 ? `${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ''}` : `${total}m`}` : 'No estimate'}</span>
    </div>
  )
}

export function ProfilePicker({ value, onChange, id }: { value: string | null; onChange: (id: string | null) => void; id?: string }) {
  const profiles = useProfiles()
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="h-10 py-0 text-sm" aria-label="Timer profile">
      <option value="">Whichever is active</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} – {profileSummary(p)}
        </option>
      ))}
    </Select>
  )
}

export function ProjectPicker({ value, onChange, id }: { value: string | null; onChange: (id: string | null) => void; id?: string }) {
  const projects = useProjects()
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="h-10 py-0 text-sm" aria-label="Project">
      <option value="">Inbox (no project)</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  )
}

