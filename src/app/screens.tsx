/**
 * The screens, and when their code arrives.
 *
 * Home is in the entry chunk (it is where the app opens). Every other screen is
 * a separate chunk that is asked for ahead of need: all of them in idle time
 * after start-up, and one at once when its navigation item is pressed or
 * focused. Navigation is a deferred render (App.tsx), so the screen you are on
 * stays until the next one can draw: there is no loading skeleton between
 * screens, only on a cold start straight into a deep link.
 */
import type { ComponentType } from 'react'
import { HomeScreen } from '@/features/home/HomeScreen'
import { lazyScreen, whenIdle, type Preloadable } from '@/lib/lazy'
import type { RouteName } from './router'

const LAZY: Partial<Record<RouteName, Preloadable<ComponentType<object>>>> = {
  focus: lazyScreen(() => import('@/features/focus/FocusScreen').then((m) => ({ default: m.FocusScreen }))),
  tasks: lazyScreen(() => import('@/features/tasks/TasksScreen').then((m) => ({ default: m.TasksScreen }))),
  calendar: lazyScreen(() => import('@/features/calendar/CalendarScreen')),
  insights: lazyScreen(() => import('@/features/insights/InsightsScreen')),
  atlas: lazyScreen(() => import('@/features/atlas/AtlasScreen')),
  settings: lazyScreen(() => import('@/features/settings/SettingsScreen')),
  'current-affairs': lazyScreen(() => import('@/features/current-affairs/CurrentAffairsScreen')),
  notes: lazyScreen(() => import('@/features/notes/NotesScreen')),
}

export const SCREENS: Record<RouteName, ComponentType<object>> = { home: HomeScreen, ...LAZY } as Record<RouteName, ComponentType<object>>

/** Ask for a screen's code now (a navigation item was pressed, focused or hovered). Safe to call repeatedly. */
export function preloadRoute(name: RouteName) {
  LAZY[name]?.preload()
}

/** The order people reach screens in: the day's work first, the Atlas (the largest) last. */
const IDLE_ORDER: RouteName[] = ['focus', 'tasks', 'calendar', 'notes', 'current-affairs', 'insights', 'settings', 'atlas']

/** After start-up, fetch every screen one at a time while the browser is idle. Returns a cancel function. */
export function preloadRoutesWhenIdle(): () => void {
  let cancel = () => {}
  let stopped = false
  const next = (i: number) => {
    if (stopped || i >= IDLE_ORDER.length) return
    cancel = whenIdle(() => {
      preloadRoute(IDLE_ORDER[i])
      next(i + 1)
    }, 1500)
  }
  next(0)
  return () => {
    stopped = true
    cancel()
  }
}
