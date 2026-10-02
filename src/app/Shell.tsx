/**
 * The app's chrome. From 768px up it is a navigation rail beside the stage
 * (labels from 1024px, icons only when collapsed or on a tablet); on a phone it
 * is a five-tab bar. Both carry the running timer, so a session is never out
 * of sight, and both step aside while focus runs or the Atlas goes full screen
 * (see the App shell section of index.css).
 */
import { AnimatePresence, motion } from 'motion/react'
import { ChartNoAxesColumn, CloudOff, Flame, House, ListTodo, Map as MapIcon, Newspaper, PanelLeftClose, PanelLeftOpen, Pause, Play, Plus, Search, Settings2, StickyNote, Timer } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/useOnline'
import { haptics } from '@/services/haptics'
import { ClockText } from '@/timer/ClockText'
import { useClockText } from '@/timer/clock'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { LogoMark, Wordmark } from '@/ui/Logo'
import { T } from '@/ui/motion'
import { useMediaQuery } from '@/ui/useMedia'
import { useTodayProgress } from '@/features/shared/useProgress'
import { executeAction } from '@/tars/runtime'
import type { RouteName } from './router'
import { preloadRoute } from './screens'
import { modKey, toggleTimer } from './shortcuts'
import { useUi } from './ui-store'
import { currentRoute, forgetLastHash, lastHashFor, navigate } from './router'
import { resetRoute } from '@/app/routeState'

interface Destination {
  name: RouteName
  label: string
  icon: typeof Timer
  /** Second key of the "G then …" chord. */
  key: string
}

/** Where you work, in the order of a study day. */
const PRIMARY: Destination[] = [
  { name: 'home', label: 'Home', icon: House, key: 'H' },
  { name: 'focus', label: 'Focus', icon: Timer, key: 'F' },
  { name: 'tasks', label: 'Plan', icon: ListTodo, key: 'T' },
  { name: 'current-affairs', label: 'News', icon: Newspaper, key: 'W' },
  { name: 'atlas', label: 'Atlas', icon: MapIcon, key: 'A' },
]
/** What you look back on. */
const SECONDARY: Destination[] = [
  { name: 'notes', label: 'Notes', icon: StickyNote, key: 'N' },
  { name: 'insights', label: 'Insights', icon: ChartNoAxesColumn, key: 'I' },
]
/** The phone tab bar, with the timer in the middle where the thumb rests. */
const TABS: Destination[] = [PRIMARY[0], PRIMARY[2], PRIMARY[1], PRIMARY[3], PRIMARY[4]]

/** The calendar is a view of the plan; everything not on the tab bar is reached from Home. */
const railItem = (route: RouteName): RouteName => (route === 'calendar' ? 'tasks' : route)
/** Notes, Insights and Settings are not on the tab bar: while on them no tab is selected (they show a Back instead). */
const tabItem = (route: RouteName): RouteName | null => (route === 'calendar' ? 'tasks' : route === 'notes' || route === 'insights' || route === 'settings' ? null : route)

/**
 * A navigation item. Going to a workspace returns to the view it was left on;
 * pressing the item of the workspace you are already on takes it back to its
 * front page: top of the list, filters cleared (app/routeState.ts).
 */
function go(name: RouteName) {
  haptics.tap()
  const here = currentRoute()
  if (here.name === name) {
    forgetLastHash(name)
    resetRoute(name)
    if (here.raw !== `#/${name}`) navigate(`#/${name}`)
    return
  }
  const kept = lastHashFor(name)
  if (kept) navigate(kept)
  else void executeAction('navigation.open', { route:name })
}

const openPalette = () => useUi.getState().set({ paletteOpen: true })
const openCapture = () => useUi.getState().set({ captureOpen: true })


const phaseDot = (phase: string) => (phase === 'focus' ? 'bg-focus' : phase === 'longBreak' ? 'bg-long' : 'bg-break')

// ───────────────────────── phone ─────────────────────────

export function TabBar({ route }: { route: RouteName }) {
  const current = tabItem(route)
  // Only the phase and status are read here: the ticking text is a leaf (LiveTabText), so the bar itself renders on a change of state, not every second.
  const phase = useTimer((s) => s.timer.phase)
  const status = useTimer((s) => s.timer.status)
  const active = status !== 'idle'
  return (
    <nav className="tabbar chrome-dim chrome-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden" aria-label="Main">
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch px-1.5">
        {TABS.map(({ name, label, icon: Icon }) => {
          const on = current === name
          const live = name === 'focus' && active
          return (
            <button
              key={name}
              type="button"
              onClick={() => go(name)}
              onPointerDown={() => preloadRoute(name)}
              onFocus={() => preloadRoute(name)}
              aria-current={on ? 'page' : undefined}
              aria-label={live ? undefined : label}
              className={cn('press relative flex min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-colors duration-150', on ? 'text-ink' : 'text-ink-3')}
            >
              {on && <motion.span layoutId="tab-active" className="absolute top-0 h-[3px] w-7 rounded-b-full bg-accent" transition={T.indicator} />}
              <span className="relative">
                <Icon className={cn('size-[22px] transition-colors duration-150', on && 'text-accent')} strokeWidth={on ? 2.2 : 1.8} />
                {live && <span className={cn('absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-surface', phaseDot(phase), status === 'running' && 'animate-pulse')} />}
              </span>
              {live ? <LiveTabText label={label} lead={`${PHASE_LABEL[phase].toLowerCase()} ${status === 'paused' ? 'paused at' : 'running,'}`} /> : <span>{label}</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** The Focus tab while a timer is active: the time in place of the word, and the whole thing as its accessible name. */
function LiveTabText({ label, lead }: { label: string; lead: string }) {
  const text = useClockText()
  return (
    <>
      <span className="sr-only">{`${label}, ${lead} ${text}`}</span>
      <span className="timer-digits text-[11.5px] text-ink" aria-hidden="true">
        {text}
      </span>
    </>
  )
}

// ───────────────────────── window ─────────────────────────

type TipProps = (label: string, hint?: string) => { onMouseEnter: (e: { currentTarget: HTMLElement }) => void; onFocus: (e: { currentTarget: HTMLElement }) => void; onMouseLeave: () => void; onBlur: () => void }

/** The navigation rail: full (icons + labels) or collapsed to icons, remembered across sessions. */
export function Rail({ route }: { route: RouteName }) {
  const stored = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  // Tablets have room for the icons only.
  const roomy = useMediaQuery('(min-width: 1024px)')
  const collapsed = stored || !roomy
  const current = railItem(route)
  const [tip, setTip] = useState<{ label: string; hint?: string; y: number } | null>(null)
  const showTip = (label: string, hint?: string) => (e: { currentTarget: HTMLElement }) => {
    if (!collapsed) return
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ label, hint, y: r.top + r.height / 2 })
  }
  const hideTip = () => setTip(null)
  const tipProps: TipProps = (label, hint) => ({ onMouseEnter: showTip(label, hint), onFocus: showTip(label, hint), onMouseLeave: hideTip, onBlur: hideTip })
  const pad = 'px-3'

  return (
    <aside id="sidebar" className="rail chrome-dim fixed inset-y-0 left-0 z-30 hidden flex-col pb-3 md:flex" aria-label="Main" data-collapsed={collapsed || undefined}>
      <div className={cn('flex shrink-0 items-center', collapsed ? 'flex-col gap-1 px-3 pb-1' : 'h-14 justify-between pr-2 pl-4')}>
        <button type="button" onClick={() => go('home')} className={cn('press flex items-center rounded-xl', collapsed ? 'size-10 justify-center' : 'h-10 px-1')} aria-label="Tars – go to Home" {...tipProps('Tars', 'Home')}>
          {collapsed ? <LogoMark className="size-6 text-accent" /> : <Wordmark />}
        </button>
        {roomy && (
          <button
            type="button"
            onClick={() => {
              hideTip()
              toggle()
            }}
            aria-expanded={!collapsed}
            aria-controls="sidebar"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="press flex size-9 items-center justify-center rounded-[10px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            {...tipProps('Expand sidebar', `${modKey}\\`)}
          >
            {collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}
          </button>
        )}
      </div>

      <div className={cn('shrink-0', pad)}>
        <button
          type="button"
          onClick={openPalette}
          className={cn(
            'press mb-3 flex h-9 w-full items-center gap-2.5 rounded-[10px] text-[13px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2',
            collapsed ? 'justify-center' : 'bg-surface-2/70 px-2.5',
          )}
          aria-label="Ask Tars"
          aria-keyshortcuts="Control+K Meta+K"
          {...tipProps('Search and commands', `${modKey}K`)}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="rail-label flex-1 text-left">Search</span>
              <kbd className="kbd rail-label">{modKey}K</kbd>
            </>
          )}
        </button>
      </div>

      <div className={cn('scrollbar-none min-h-0 flex-1 overflow-y-auto', pad)}>
        <nav className="flex flex-col gap-0.5" aria-label="Workspaces">
          {PRIMARY.map(({ name, label, icon: Icon, key }) => (
            <RailItem key={name} route={name} active={current === name} collapsed={collapsed} onClick={() => go(name)} icon={<Icon className="size-[18px]" />} label={label} {...tipProps(label, `G ${key}`)} />
          ))}
        </nav>
        <nav className="mt-4 flex flex-col gap-0.5 border-t border-line pt-3" aria-label="Library">
          {SECONDARY.map(({ name, label, icon: Icon, key }) => (
            <RailItem key={name} route={name} active={current === name} collapsed={collapsed} onClick={() => go(name)} icon={<Icon className="size-[18px]" />} label={label} {...tipProps(label, `G ${key}`)} />
          ))}
        </nav>
      </div>

      <div className={cn('flex shrink-0 flex-col gap-1 pt-2', pad)}>
        <RailTimer collapsed={collapsed} />
        <RailItem active={false} collapsed={collapsed} onClick={openCapture} icon={<Plus className="size-[18px]" />} label="Capture" hint="C" ariaLabel="Quick capture" {...tipProps('Quick capture', 'C')} />
        <RailItem route="settings" active={current === 'settings'} collapsed={collapsed} onClick={() => go('settings')} icon={<Settings2 className="size-[18px]" />} label="Settings" {...tipProps('Settings', 'G S')} />
        <RailStatus collapsed={collapsed} tipProps={tipProps} />
      </div>

      <AnimatePresence>
        {tip && collapsed && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0, transition: T.micro }}
            exit={{ opacity: 0, transition: T.exit }}
            className="pointer-events-none fixed z-50 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-ink shadow-lift"
            style={{ top: tip.y, left: 'calc(var(--rail-size) + 6px)' }}
          >
            {tip.label}
            {tip.hint && <span className="text-[11px] font-bold opacity-60">{tip.hint}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

function RailItem({
  active,
  collapsed,
  onClick,
  icon,
  label,
  hint,
  ariaLabel,
  route,
  onMouseEnter,
  onFocus,
  ...rest
}: {
  /** The screen this item opens: its code is fetched as soon as the pointer or the keyboard reaches the item. */
  route?: RouteName
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  /** Key hint shown at the end of an expanded row. */
  hint?: string
  ariaLabel?: string
} & Partial<ReturnType<TipProps>>) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={route ? () => preloadRoute(route) : undefined}
      onMouseEnter={(e) => {
        if (route) preloadRoute(route)
        onMouseEnter?.(e)
      }}
      onFocus={(e) => {
        if (route) preloadRoute(route)
        onFocus?.(e)
      }}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel ?? (collapsed ? label : undefined)}
      className={cn(
        'press relative flex h-9 items-center gap-2.5 rounded-[10px] text-[14px] font-semibold transition-colors duration-150',
        collapsed ? 'h-10 justify-center px-0' : 'px-2.5',
        active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink',
      )}
      {...rest}
    >
      {/* The active item is cut from the stage's own surface, so the rail reads as its edge. */}
      {active && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-[10px] bg-bg shadow-[0_0_0_1px_var(--line),var(--shadow-soft-value)]" transition={T.indicator} />}
      <span className={cn('relative shrink-0 transition-colors duration-150', active && 'text-accent')}>{icon}</span>
      {!collapsed && <span className="rail-label relative min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && hint && <kbd className="kbd rail-label relative">{hint}</kbd>}
    </button>
  )
}

/** The running timer, always within reach: open it, or pause and resume without leaving your work. */
function RailTimer({ collapsed }: { collapsed: boolean }) {
  const phase = useTimer((s) => s.timer.phase)
  const status = useTimer((s) => s.timer.status)
  const active = status !== 'idle'
  const running = status === 'running'
  return (
    <AnimatePresence initial={false}>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: T.base }}
          exit={{ opacity: 0, y: 8, transition: T.exit }}
          className={cn('mb-1 flex items-center rounded-xl bg-bg shadow-[0_0_0_1px_var(--line),var(--shadow-soft-value)]', collapsed ? 'flex-col py-1' : 'gap-1 py-1 pr-1 pl-2.5')}
        >
          <button
            type="button"
            onClick={() => go('focus')}
            className={cn('press min-w-0 rounded-lg text-left', collapsed ? 'flex w-full flex-col items-center gap-1 py-1.5' : 'flex-1 py-1')}
          >
            {/* Read as one sentence: "Focus, paused: 12:40. Open the timer". */}
            <span className="sr-only">{`${PHASE_LABEL[phase]}${status === 'paused' ? ', paused' : ''}: `}</span>
            <span className={cn('flex items-center gap-1.5 text-[11.5px] font-bold text-ink-2', collapsed && 'justify-center')} aria-hidden="true">
              <span className={cn('size-1.5 shrink-0 rounded-full', phaseDot(phase), running && 'animate-pulse')} />
              {!collapsed && (
                <span className="truncate">
                  {PHASE_LABEL[phase]}
                  {status === 'paused' && ' · paused'}
                </span>
              )}
            </span>
            <span className={cn('timer-digits block leading-tight', collapsed ? 'text-[12px]' : 'text-[21px]')}>
              <ClockText />
            </span>
            <span className="sr-only">. Open the timer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap()
              toggleTimer()
            }}
            aria-label={running ? 'Pause timer' : 'Resume timer'}
            title={running ? 'Pause timer' : 'Resume timer'}
            className="press flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {running ? <Pause className="size-3.5 fill-current" strokeWidth={0} /> : <Play className="ml-px size-3.5 fill-current" strokeWidth={0} />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Streak and connection – quiet, one line. */
function RailStatus({ collapsed, tipProps }: { collapsed: boolean; tipProps: TipProps }) {
  const online = useOnline()
  const p = useTodayProgress()
  const streakText = p.streak ? `${p.streak}-day streak` : 'No streak yet'
  const streakHint = p.todayDone ? 'Today counted' : p.streak ? 'Focus today to keep it' : 'Focus today to start one'
  return (
    <div className={cn('mt-1 flex gap-1.5 border-t border-line pt-2.5', collapsed ? 'flex-col items-center' : 'items-center justify-between px-2.5')}>
      <span className={cn('flex items-center gap-1.5 rounded-lg text-[12px] font-bold', p.todayDone ? 'text-accent' : 'text-ink-3', collapsed && 'justify-center px-2 py-1')} tabIndex={collapsed ? 0 : -1} aria-label={`${streakText}. ${streakHint}`} {...tipProps(streakText, streakHint)}>
        <Flame className={cn('size-3.5', p.todayDone && 'fill-current')} />
        <span className="tabular">{collapsed ? p.streak : streakText}</span>
      </span>
      {!online && (
        <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold text-ink-2" tabIndex={collapsed ? 0 : -1} aria-label="Offline. Everything is saved on this device." {...tipProps('Offline', 'Everything is saved on this device')}>
          <CloudOff className="size-3.5" />
          {!collapsed && 'Offline'}
        </span>
      )}
    </div>
  )
}
