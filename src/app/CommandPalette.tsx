/**
 * Command palette (Ctrl/⌘ K): jump anywhere, run common actions, find a task,
 * or capture a new one in natural language ("Physics revision tomorrow 5pm #exam").
 */
import { AnimatePresence, motion } from 'motion/react'
import {
  CalendarDays,
  ChartNoAxesColumn,
  CheckCircle2,
  CornerDownLeft,
  Expand,
  Headphones,
  Keyboard,
  ListTodo,
  Map as MapIcon,
  Moon,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Sun,
  SunMoon,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { updateSettings, useLabels, useOpenTasks, useProjects, useSettings } from '@/data/hooks'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { relativeDayLabel, todayKey } from '@/lib/time'
import { inferSubject, parseQuickAdd } from '@/planner/quickAdd'
import { addFromQuickAdd } from '@/planner/tasks'
import { enterFullscreen } from '@/services/fullscreen'
import { haptics } from '@/services/haptics'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { DUR, EASE_IN, T } from '@/ui/motion'
import { lockScroll } from '@/ui/scrollLock'
import { isTopLayer, pushLayer, trapTab } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { useIsWide } from '@/ui/useMedia'
import { quickAddChips } from '@/features/tasks/quickAddChips'
import { navigate, useRoute } from './router'
import { modKey } from './shortcuts'
import { useUi } from './ui-store'

interface Command {
  id: string
  section: string
  label: string
  hint?: string
  keywords?: string
  icon: LucideIcon
  /** Key hint shown on the right. */
  keys?: string
  run: () => void | Promise<void>
}

const close = () => useUi.getState().set({ paletteOpen: false })

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  return createPortal(<AnimatePresence>{open && <Palette key="palette" />}</AnimatePresence>, document.body)
}

function Palette() {
  const wide = useIsWide()
  const id = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const commands = useCommands(query)

  useEffect(() => {
    const unlock = lockScroll()
    const pop = pushLayer(id)
    const prevFocus = document.activeElement as HTMLElement | null
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(id)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') trapTab(e, panel.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      pop()
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [id])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = async (c: Command | undefined) => {
    if (!c) return
    haptics.tap()
    close()
    await c.run()
  }

  let lastSection = ''
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pt-[12vh]" role="presentation">
      <motion.div
        className="absolute inset-0 bg-black/40 dark:bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: T.base }}
        exit={{ opacity: 0, transition: { duration: DUR.micro, ease: EASE_IN } }}
        onClick={close}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="relative flex max-h-[min(72dvh,560px)] w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-dialog"
        initial={{ opacity: 0, scale: 0.97, y: wide ? -8 : -16 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: T.base }}
        exit={{ opacity: 0, scale: 0.98, y: -6, transition: T.exit }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] shrink-0 text-ink-3" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(commands.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                void run(commands[active])
              }
            }}
            placeholder="Search, go to, or type a new task…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={commands[active] ? `${id}-${active}` : undefined}
            aria-autocomplete="list"
            enterKeyHint="go"
          />
          <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
        </div>
        <div ref={list} id={`${id}-list`} role="listbox" aria-label="Commands" className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2">
          {commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-2">Nothing matches “{query}”.</p>}
          {commands.map((c, i) => {
            const header = c.section !== lastSection
            lastSection = c.section
            const Icon = c.icon
            return (
              <div key={c.id}>
                {header && <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase first:pt-1">{c.section}</p>}
                <div
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => void run(c)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-100', i === active ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                >
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', i === active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{c.label}</span>
                    {c.hint && <span className="block truncate text-[12.5px] text-ink-2">{c.hint}</span>}
                  </span>
                  {c.keys && <kbd className="kbd shrink-0">{c.keys}</kbd>}
                  {i === active && !c.keys && <CornerDownLeft className="size-4 shrink-0 text-ink-3" />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[12px] font-semibold text-ink-3 sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> to move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd> to run
          </span>
          <span className="ml-auto">
            Tip: <b className="text-ink-2">Essay draft fri 5pm @History #exam</b>
          </span>
        </div>
      </motion.div>
    </div>
  )
}

function score(text: string, q: string): number {
  const t = text.toLowerCase()
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  let s = 0
  for (const w of words) {
    const i = t.indexOf(w)
    if (i < 0) return 0
    s += i === 0 ? 3 : /\s/.test(t[i - 1] ?? '') ? 2 : 1
  }
  return s
}

function useCommands(query: string): Command[] {
  const route = useRoute()
  const timer = useTimer((s) => s.timer)
  const settings = useSettings()
  const tasks = useOpenTasks()
  const labels = useLabels()
  const projects = useProjects()
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const today = todayKey()

  return useMemo(() => {
    const q = query.trim()
    const ui = useUi.getState()
    const t = useTimer.getState()
    const running = timer.status === 'running'
    const idle = timer.status === 'idle'

    const base: Command[] = [
      running
        ? { id: 'pause', section: 'Timer', label: 'Pause timer', icon: Pause, keywords: 'stop break timer', keys: 'Space', run: () => t.pause() }
        : { id: 'start', section: 'Timer', label: idle ? `Start ${PHASE_LABEL[timer.phase].toLowerCase()}` : 'Resume timer', icon: Play, keywords: 'start focus timer pomodoro begin', keys: 'Space', run: () => t.start() },
      ...(!idle ? [{ id: 'stop', section: 'Timer', label: 'Stop timer', icon: Square, keywords: 'end finish', run: () => t.stop() }] : []),
      { id: 'immersive', section: 'Timer', label: 'Immersive focus', hint: 'Full-screen, distraction-free clock', icon: Expand, keywords: 'fullscreen zen', run: () => { navigate('#/focus'); ui.set({ immersive: true }); void enterFullscreen() } },
      { id: 'context', section: 'Timer', label: 'What are you working on?', hint: 'Pick a subject, task and intention', icon: Target, keywords: 'subject task intention', run: () => ui.set({ contextOpen: true }) },
      { id: 'sounds', section: 'Timer', label: 'Sounds', hint: 'Soundscapes and music', icon: Headphones, keywords: 'ambient rain noise music', keys: 'S', run: () => ui.set({ soundOpen: true }) },
      { id: 'profiles', section: 'Timer', label: 'Timer profiles', hint: 'Pomodoro, countdown, stopwatch', icon: SlidersHorizontal, keywords: 'mode stopwatch countdown pomodoro length', run: () => ui.set({ profileOpen: true }) },
      { id: 'new-task', section: 'Tasks', label: 'New task…', hint: 'With subject, tags, dates and more', icon: Plus, keywords: 'add create todo', keys: 'N', run: () => ui.newTask({ plannedFor: today }) },
      { id: 'go-focus', section: 'Go to', label: 'Focus', icon: Timer, keys: 'G F', run: () => navigate('#/focus') },
      { id: 'go-today', section: 'Go to', label: 'Tasks · Today', icon: ListTodo, keys: 'G T', keywords: 'plan', run: () => navigate('#/tasks?view=today') },
      { id: 'go-upcoming', section: 'Go to', label: 'Tasks · Upcoming', icon: ListTodo, run: () => navigate('#/tasks?view=upcoming') },
      { id: 'go-inbox', section: 'Go to', label: 'Tasks · Inbox', icon: ListTodo, run: () => navigate('#/tasks?view=inbox') },
      { id: 'go-projects', section: 'Go to', label: 'Tasks · Projects', icon: ListTodo, run: () => navigate('#/tasks?view=projects') },
      { id: 'go-habits', section: 'Go to', label: 'Tasks · Habits', icon: ListTodo, run: () => navigate('#/tasks?view=habits') },
      { id: 'go-atlas', section: 'Go to', label: 'Atlas', icon: MapIcon, keys: 'G A', keywords: 'map geography', run: () => navigate('#/atlas') },
      { id: 'go-calendar', section: 'Go to', label: 'Calendar', icon: CalendarDays, keys: 'G C', keywords: 'schedule events', run: () => navigate('#/calendar') },
      { id: 'go-insights', section: 'Go to', label: 'Insights', icon: ChartNoAxesColumn, keys: 'G I', keywords: 'stats analytics progress', run: () => navigate('#/insights') },
      { id: 'go-settings', section: 'Go to', label: 'Settings', icon: Settings2, keys: 'G S', keywords: 'preferences', run: () => navigate('#/settings') },
      ...(route.name === 'atlas'
        ? [{ id: 'atlas-full', section: 'Atlas', label: ui.atlasFullscreen ? 'Exit full-screen map' : 'Full-screen map', icon: Expand, keys: '⇧F', run: () => window.dispatchEvent(new CustomEvent('tars:atlas-fullscreen')) }]
        : []),
      { id: 'theme-light', section: 'Appearance', label: 'Theme: Paper (light)', icon: Sun, keywords: 'light mode theme', run: () => void updateSettings({ theme: 'light' }) },
      { id: 'theme-dark', section: 'Appearance', label: 'Theme: Night (dark)', icon: Moon, keywords: 'dark mode theme', run: () => void updateSettings({ theme: 'dark' }) },
      { id: 'theme-auto', section: 'Appearance', label: 'Theme: Auto', hint: settings.theme === 'system' ? 'Current' : 'Follow the system', icon: SunMoon, keywords: 'system theme', run: () => void updateSettings({ theme: 'system' }) },
      { id: 'sidebar', section: 'Appearance', label: collapsed ? 'Expand sidebar' : 'Collapse sidebar', icon: PanelLeft, keys: `${modKey}\\`, run: () => ui.toggleSidebar() },
      { id: 'shortcuts', section: 'Help', label: 'Keyboard shortcuts', icon: Keyboard, keys: '?', run: () => ui.set({ shortcutsOpen: true }) },
    ]

    if (!q) return base.filter((c) => c.section !== 'Appearance' || c.id.startsWith('sidebar') || c.id === 'theme-' + (settings.theme === 'dark' ? 'light' : 'dark'))

    const matches = base
      .map((c) => ({ c, s: score(`${c.label} ${c.keywords ?? ''} ${c.section}`, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c)

    const taskHits: Command[] = tasks
      .map((task) => ({ task, s: score(task.title, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(({ task }) => taskCommand(task, today, projects.find((p) => p.id === task.projectId)?.name))

    // Capture: always offer to add what was typed as a task, parsed like quick add.
    const parsed = parseQuickAdd(q, today)
    const subject = parsed.labelName ? undefined : inferSubject(parsed.title, labels)
    const chips = quickAddChips(parsed, today, subject?.name)
    const add: Command[] = parsed.title
      ? [
          {
            id: 'add',
            section: 'Create',
            label: `Add task “${parsed.title}”`,
            hint: chips.length ? chips.join(' · ') : 'Press Enter to add it to your inbox',
            icon: Plus,
            run: async () => {
              const task = await addFromQuickAdd(parsed, { labelId: subject?.id ?? null })
              if (task) toast({ title: 'Task added', body: task.title, tone: 'success', action: { label: 'Open', run: () => useUi.getState().openTask(task.id) } })
            },
          },
        ]
      : []

    // A strong command match goes first; otherwise creating the task is the likely intent.
    const strong = matches.length && score(matches[0].label, q) >= 3
    return strong ? [...matches, ...taskHits, ...add] : [...add, ...taskHits, ...matches]
  }, [query, timer, settings.theme, tasks, labels, projects, collapsed, route.name, today])
}

function taskCommand(task: Task, today: string, project?: string): Command {
  const day = task.dueDate ?? task.plannedFor
  return {
    id: `task-${task.id}`,
    section: 'Tasks',
    label: task.title,
    hint: [project, day ? `${task.dueDate ? 'Due ' : ''}${relativeDayLabel(day, today)}` : null].filter(Boolean).join(' · ') || 'Open task',
    icon: CheckCircle2,
    run: () => useUi.getState().openTask(task.id),
  }
}
