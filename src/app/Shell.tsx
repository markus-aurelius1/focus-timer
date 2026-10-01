import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChartNoAxesColumn, CloudOff, Flame, ListTodo, Map as MapIcon, Newspaper, PanelLeftClose, PanelLeftOpen, Search, Settings2, Timer } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/time'
import { useOnline } from '@/lib/useOnline'
import { haptics } from '@/services/haptics'
import { elapsedMs, remainingMs } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { LogoMark, Wordmark } from '@/ui/Logo'
import { T } from '@/ui/motion'
import { useTodayProgress } from '@/features/shared/useProgress'
import { executeAction } from '@/tars/runtime'
import type { RouteName } from './router'
import { modKey } from './shortcuts'
import { useUi } from './ui-store'

const TABS: Array<{ name: RouteName; label: string; icon: typeof Timer; key: string }> = [
  { name: 'focus', label: 'Focus', icon: Timer, key: 'F' },
  { name: 'tasks', label: 'Tasks', icon: ListTodo, key: 'T' },
  { name: 'atlas', label: 'Atlas', icon: MapIcon, key: 'A' },
  { name: 'calendar', label: 'Calendar', icon: CalendarDays, key: 'C' },
  { name: 'insights', label: 'Insights', icon: ChartNoAxesColumn, key: 'I' },
  { name: 'current-affairs', label: 'News', icon: Newspaper, key: 'W' },
]

function go(name: RouteName) {
  haptics.tap()
  void executeAction('navigation.open', { route:name })
}

export function BottomNav({ route }: { route: RouteName }) {
  return (
    <nav className="chrome-dim chrome-bottom pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden" aria-label="Main">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ name, label, icon: Icon }) => {
          const active = route === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => go(name)}
              aria-current={active ? 'page' : undefined}
              className={cn('press relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors duration-150', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              <Icon className={cn('size-[22px] transition-colors duration-150', active && 'text-accent')} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {active && <motion.span layoutId="nav-dot" className="absolute top-1.5 h-1 w-6 rounded-full bg-accent" transition={T.indicator} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Desktop sidebar: full (icons + labels) or collapsed to icons, remembered across sessions. */
export function SideNav({ route }: { route: RouteName }) {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  const [tip, setTip] = useState<{ label: string; hint?: string; y: number } | null>(null)
  const showTip = (label: string, hint?: string) => (e: { currentTarget: HTMLElement }) => {
    if (!collapsed) return
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ label, hint, y: r.top + r.height / 2 })
  }
  const hideTip = () => setTip(null)
  const tipProps = (label: string, hint?: string) => ({ onMouseEnter: showTip(label, hint), onFocus: showTip(label, hint), onMouseLeave: hideTip, onBlur: hideTip })

  return (
    <aside id="sidebar" className="sidebar chrome-dim fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/70 py-5 lg:flex" aria-label="Main" data-collapsed={collapsed || undefined}>
      <div className={cn('mb-5 flex items-center gap-2', collapsed ? 'flex-col px-3' : 'justify-between pr-3 pl-6')}>
        <button type="button" onClick={() => go('focus')} className="press flex h-10 items-center rounded-xl" aria-label="Tars – go to Focus" {...tipProps('Tars')}>
          {collapsed ? <LogoMark className="size-[26px] text-accent" /> : <Wordmark />}
        </button>
        <button
          type="button"
          onClick={() => {
            hideTip()
            toggle()
          }}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="press flex size-9 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          {...tipProps('Expand sidebar', `${modKey}\\`)}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        </button>
      </div>

      <div className={cn(collapsed ? 'px-3' : 'px-4')}>
        <button
          type="button"
          onClick={() => useUi.getState().set({ paletteOpen: true })}
          className={cn('press mb-4 flex h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-surface text-[13px] font-semibold text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2', collapsed ? 'justify-center' : 'px-3')}
          aria-label="Search and commands"
          aria-keyshortcuts="Control+K Meta+K"
          {...tipProps('Search & commands', `${modKey}K`)}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="kbd">{modKey}K</kbd>
            </>
          )}
        </button>
        <nav className="flex flex-col gap-1" aria-label="Screens">
          {TABS.map(({ name, label, icon: Icon, key }) => (
            <NavItem key={name} active={route === name} collapsed={collapsed} onClick={() => go(name)} icon={<Icon className="size-[19px]" />} label={label} {...tipProps(label, `G ${key}`)}>
              {label}
            </NavItem>
          ))}
        </nav>
      </div>

      <div className={cn('mt-auto flex flex-col gap-2', collapsed ? 'px-3' : 'px-4')}>
        <SideTimer collapsed={collapsed} />
        <SideStatus collapsed={collapsed} tipProps={tipProps} />
        <NavItem active={route === 'settings'} collapsed={collapsed} onClick={() => go('settings')} icon={<Settings2 className="size-[19px]" />} label="Settings" {...tipProps('Settings', 'G S')}>
          Settings
        </NavItem>
      </div>

      <AnimatePresence>
        {tip && collapsed && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0, transition: T.micro }}
            exit={{ opacity: 0, transition: T.exit }}
            className="pointer-events-none fixed z-50 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-ink shadow-lift"
            style={{ top: tip.y, left: 'calc(var(--sidebar-size) + 8px)' }}
          >
            {tip.label}
            {tip.hint && <span className="text-[11px] font-bold opacity-60">{tip.hint}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

function NavItem({
  active,
  collapsed,
  onClick,
  icon,
  label,
  children,
  ...rest
}: {
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  children: ReactNode
  onMouseEnter?: (e: { currentTarget: HTMLElement }) => void
  onFocus?: (e: { currentTarget: HTMLElement }) => void
  onMouseLeave?: () => void
  onBlur?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'press relative flex h-11 items-center gap-3 rounded-xl text-[15px] font-semibold transition-colors duration-150',
        collapsed ? 'justify-center px-0' : 'px-3',
        active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
      {...rest}
    >
      {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-surface-2" transition={T.indicator} />}
      <span className={cn('relative', active && 'text-accent')}>{icon}</span>
      {!collapsed && <span className="sidebar-label relative truncate">{children}</span>}
    </button>
  )
}

function useTimerReadout() {
  const timer = useTimer((s) => s.timer)
  const active = timer.status !== 'idle'
  const now = useNow(active)
  const rem = remainingMs(timer, now)
  const text = rem === null ? formatClock(elapsedMs(timer, now) / 1000) : formatClock(Math.ceil(rem / 1000))
  return { timer, active, text }
}

const phaseDot = (phase: string) => (phase === 'focus' ? 'bg-focus' : phase === 'longBreak' ? 'bg-long' : 'bg-break')

function SideTimer({ collapsed }: { collapsed: boolean }) {
  const { timer, active, text } = useTimerReadout()
  return (
    <AnimatePresence initial={false}>
      {active && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: T.base }}
          exit={{ opacity: 0, y: 8, transition: T.exit }}
          onClick={() => go('focus')}
          aria-label={`${PHASE_LABEL[timer.phase]}${timer.status === 'paused' ? ', paused' : ''}: ${text}. Open the timer`}
          className={cn('press rounded-2xl border border-line bg-surface text-left shadow-soft', collapsed ? 'px-1 py-2.5 text-center' : 'px-3 py-3')}
        >
          <span className={cn('flex items-center gap-2 text-xs font-bold text-ink-2', collapsed && 'justify-center')}>
            <span className={cn('size-2 rounded-full', phaseDot(timer.phase), timer.status === 'running' && 'animate-pulse')} />
            {!collapsed && (
              <>
                {PHASE_LABEL[timer.phase]}
                {timer.status === 'paused' && ' · paused'}
              </>
            )}
          </span>
          <span className={cn('timer-digits mt-1 block', collapsed ? 'text-[13px]' : 'text-3xl')}>{text}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/** Streak and connection – quiet, one line. */
function SideStatus({ collapsed, tipProps }: { collapsed: boolean; tipProps: (label: string, hint?: string) => object }) {
  const online = useOnline()
  const p = useTodayProgress()
  const streakText = p.streak ? `${p.streak}-day streak` : 'No streak yet'
  const streakHint = p.todayDone ? 'Today counted' : p.streak ? 'Focus today to keep it' : 'Focus today to start one'
  return (
    <div className={cn('flex gap-1.5 px-1 pb-1', collapsed ? 'flex-col items-center' : 'items-center justify-between')}>
      <span className={cn('flex items-center gap-1.5 rounded-lg py-1 text-xs font-bold', p.todayDone ? 'text-accent' : 'text-ink-3', collapsed && 'justify-center px-2')} tabIndex={collapsed ? 0 : -1} aria-label={`${streakText}. ${streakHint}`} {...tipProps(streakText, streakHint)}>
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

/** Floating reminder of a running timer while you plan on other screens. */
export function TimerPill({ route }: { route: RouteName }) {
  const { timer, active, text } = useTimerReadout()
  const hidden = useUi((s) => s.atlasFullscreen)
  return (
    <AnimatePresence>
      {active && route !== 'focus' && !hidden && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: T.item }}
          exit={{ opacity: 0, y: 12, transition: T.exit }}
          onClick={() => go('focus')}
          className="press fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 rounded-full border border-line bg-surface py-2 pr-4 pl-3 shadow-lift lg:hidden"
          aria-label="Return to timer"
        >
          <span className={cn('size-2.5 rounded-full', phaseDot(timer.phase), timer.status === 'running' && 'animate-pulse')} />
          <span className="timer-digits text-[15px]">{text}</span>
          <span className="text-xs font-semibold text-ink-2">{timer.status === 'paused' ? 'Paused' : PHASE_LABEL[timer.phase]}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
