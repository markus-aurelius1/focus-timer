import { motion } from 'motion/react'
import { CalendarDays, ChartNoAxesColumn, ListTodo, Map as MapIcon, Settings2, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/time'
import { haptics } from '@/services/haptics'
import { elapsedMs, remainingMs } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { Wordmark } from '@/ui/Logo'
import { navigate, type RouteName } from './router'

const TABS: Array<{ name: RouteName; label: string; icon: typeof Timer }> = [
  { name: 'focus', label: 'Focus', icon: Timer },
  { name: 'tasks', label: 'Tasks', icon: ListTodo },
  { name: 'atlas', label: 'Atlas', icon: MapIcon },
  { name: 'calendar', label: 'Calendar', icon: CalendarDays },
  { name: 'insights', label: 'Insights', icon: ChartNoAxesColumn },
]

function go(name: RouteName) {
  haptics.tap()
  navigate(`#/${name}`)
}

export function BottomNav({ route }: { route: RouteName }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden" aria-label="Main">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ name, label, icon: Icon }) => {
          const active = route === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => go(name)}
              aria-current={active ? 'page' : undefined}
              className={cn('relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              <Icon className={cn('size-[22px] transition-colors', active && 'text-accent')} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {active && <motion.span layoutId="nav-dot" className="absolute top-1.5 h-1 w-6 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function SideNav({ route }: { route: RouteName }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex" aria-label="Main">
      <button type="button" onClick={() => go('focus')} className="mb-8 px-3 text-left">
        <Wordmark />
      </button>
      <nav className="flex flex-col gap-1">
        {TABS.map(({ name, label, icon: Icon }) => (
          <NavItem key={name} active={route === name} onClick={() => go(name)} icon={<Icon className="size-[19px]" />}>
            {label}
          </NavItem>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        <SideTimer />
        <NavItem active={route === 'settings'} onClick={() => go('settings')} icon={<Settings2 className="size-[19px]" />}>
          Settings
        </NavItem>
      </div>
    </aside>
  )
}

function NavItem({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors', active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}
    >
      {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <span className={cn('relative', active && 'text-accent')}>{icon}</span>
      <span className="relative">{children}</span>
    </button>
  )
}

function useTimerReadout() {
  const timer = useTimer((s) => s.timer)
  const active = timer.status !== 'idle'
  const now = useNow(active)
  const rem = remainingMs(timer, now)
  const text = formatClock((rem ?? elapsedMs(timer, now)) / 1000)
  return { timer, active, text }
}

function SideTimer() {
  const { timer, active, text } = useTimerReadout()
  if (!active) return null
  return (
    <button type="button" onClick={() => go('focus')} className="rounded-2xl border border-line bg-surface px-3 py-3 text-left shadow-soft">
      <span className="flex items-center gap-2 text-xs font-bold text-ink-2">
        <span className={cn('size-2 rounded-full', timer.phase === 'focus' ? 'bg-focus' : timer.phase === 'longBreak' ? 'bg-long' : 'bg-break', timer.status === 'running' && 'animate-pulse')} />
        {PHASE_LABEL[timer.phase]}
        {timer.status === 'paused' && ' · paused'}
      </span>
      <span className="tabular mt-1 block font-display text-3xl font-light">{text}</span>
    </button>
  )
}

/** Floating reminder of a running timer while you plan on other screens. */
export function TimerPill({ route }: { route: RouteName }) {
  const { timer, active, text } = useTimerReadout()
  if (!active || route === 'focus') return null
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => go('focus')}
      className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 rounded-full border border-line bg-surface py-2 pr-4 pl-3 shadow-soft lg:hidden"
      aria-label="Return to timer"
    >
      <span className={cn('size-2.5 rounded-full', timer.phase === 'focus' ? 'bg-focus' : timer.phase === 'longBreak' ? 'bg-long' : 'bg-break', timer.status === 'running' && 'animate-pulse')} />
      <span className="tabular text-[15px] font-bold">{text}</span>
      <span className="text-xs font-semibold text-ink-2">{timer.status === 'paused' ? 'Paused' : PHASE_LABEL[timer.phase]}</span>
    </motion.button>
  )
}
