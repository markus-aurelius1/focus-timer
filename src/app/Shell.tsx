/** Shared Atlas and News navigation, with settings and commands. */
import { AnimatePresence, motion } from 'motion/react'
import { CloudOff, Map as MapIcon, Newspaper, PanelLeftClose, PanelLeftOpen, Search, Settings2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/useOnline'
import { haptics } from '@/services/haptics'
import { LogoMark, Wordmark } from '@/ui/Logo'
import { T } from '@/ui/motion'
import { useMediaQuery } from '@/ui/useMedia'
import { executeAction } from '@/tars/runtime'
import type { RouteName } from './router'
import { preloadRoute } from './screens'
import { modKey } from './shortcuts'
import { useUi } from './ui-store'
import { currentRoute, navigate } from './router'
import { resetRoute } from '@/app/routeState'

interface Destination {
  name: RouteName
  label: string
  icon: typeof MapIcon
  /** Second key of the "G then …" chord. */
  key: string
}

const PRIMARY: Destination[] = [
  { name: 'atlas', label: 'Atlas', icon: MapIcon, key: 'A' },
  { name: 'current-affairs', label: 'News', icon: Newspaper, key: 'W' },
]
const TABS = PRIMARY
const railItem = (route: RouteName) => route
const tabItem = (route: RouteName) => route === 'settings' ? null : route

/**
 * A navigation item. Going to a workspace returns to the view it was left on;
 * pressing the item of the workspace you are already on takes it back to its
 * front page: top of the list, filters cleared (app/routeState.ts).
 */
function go(name: RouteName) {
  haptics.tap()
  const here = currentRoute()
  if (here.name === name) {
    resetRoute(name)
    if (here.raw !== `#/${name}`) navigate(`#/${name}`)
    return
  }
  void executeAction('navigation.open', { route:name })
}

const openPalette = () => useUi.getState().set({ paletteOpen: true })




// ───────────────────────── phone ─────────────────────────

export function TabBar({ route }: { route: RouteName }) {
  const current = tabItem(route)
  return (
    <nav className="tabbar chrome-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden" aria-label="Main">
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch px-1.5">
        {TABS.map(({ name, label, icon: Icon }) => {
          const on = current === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => go(name)}
              onPointerDown={() => preloadRoute(name)}
              onFocus={() => preloadRoute(name)}
              aria-current={on ? 'page' : undefined}
              aria-label={label}
              className={cn('press relative flex min-w-11 flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-colors duration-150', on ? 'text-ink' : 'text-ink-3')}
            >
              {on && <motion.span layoutId="tab-active" className="absolute top-0 h-[3px] w-7 rounded-b-full bg-accent" transition={T.indicator} />}
              <span className="relative">
                <Icon className={cn('size-[22px] transition-colors duration-150', on && 'text-accent')} strokeWidth={on ? 2.2 : 1.8} />
              </span>
              <span>{label}</span>
            </button>
          )
        })}
        <button type="button" onClick={openPalette} aria-label="Ask Tars" className="press flex min-w-11 items-center justify-center text-ink-3">
          <Search className="size-5" />
        </button>
      </div>
    </nav>
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
    <aside id="sidebar" className="rail fixed inset-y-0 left-0 z-30 hidden flex-col pb-3 md:flex" aria-label="Main" data-collapsed={collapsed || undefined}>
      <div className={cn('flex shrink-0 items-center', collapsed ? 'flex-col gap-1 px-3 pb-1' : 'h-14 justify-between pr-2 pl-4')}>
        <button type="button" onClick={() => go('atlas')} className={cn('press flex items-center rounded-xl', collapsed ? 'size-10 justify-center' : 'h-10 px-1')} aria-label="Tars – go to Atlas" {...tipProps('Tars', 'Atlas')}>
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
      </div>

      <div className={cn('flex shrink-0 flex-col gap-1 pt-2', pad)}>
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

/** Connection status. */
function RailStatus({ collapsed, tipProps }: { collapsed: boolean; tipProps: TipProps }) {
  const online = useOnline()
  return (
    <div className={cn('mt-1 flex gap-1.5 border-t border-line pt-2.5', collapsed ? 'flex-col items-center' : 'items-center justify-between px-2.5')}>
      {!online && (
        <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold text-ink-2" tabIndex={collapsed ? 0 : -1} aria-label="Offline. Everything is saved on this device." {...tipProps('Offline', 'Everything is saved on this device')}>
          <CloudOff className="size-3.5" />
          {!collapsed && 'Offline'}
        </span>
      )}
    </div>
  )
}
