/** Tiny hash router – deep links work in the PWA, in Capacitor and from notification taps. */
import { useSyncExternalStore } from 'react'

export type RouteName = 'focus' | 'tasks' | 'atlas' | 'calendar' | 'insights' | 'settings'
const ROUTES: RouteName[] = ['focus', 'tasks', 'atlas', 'calendar', 'insights', 'settings']

export interface Route {
  name: RouteName
  params: URLSearchParams
  raw: string
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [path, query = ''] = clean.split('?')
  const name = (ROUTES as string[]).includes(path) ? (path as RouteName) : 'focus'
  return { name, params: new URLSearchParams(query), raw: hash }
}

let current = parse(typeof location !== 'undefined' ? location.hash : '')
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse(location.hash)
    listeners.forEach((l) => l())
  })
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`
  if (hash === location.hash) return
  if (opts.replace) {
    history.replaceState(null, '', hash)
    current = parse(hash)
    listeners.forEach((l) => l())
  } else location.hash = hash
}

/** Drop one-shot params (like ?start=1) after handling them. */
export function consumeParams(...keys: string[]) {
  const r = current
  let changed = false
  for (const k of keys) {
    if (r.params.has(k)) {
      r.params.delete(k)
      changed = true
    }
  }
  if (changed) {
    const q = r.params.toString()
    navigate(`#/${r.name}${q ? `?${q}` : ''}`, { replace: true })
  }
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
