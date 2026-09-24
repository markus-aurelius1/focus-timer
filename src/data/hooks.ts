/** Reactive read hooks – components re-render whenever the underlying IndexedDB data changes. */
import { liveQuery, type Subscription } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { db } from './db'
import { DEFAULT_SETTINGS } from './seed'
import type {
  AudioPreset,
  CalendarEvent,
  ChallengeClaim,
  Goal,
  Habit,
  HabitLog,
  Label,
  Playlist,
  Project,
  Session,
  Settings,
  Task,
  TimerProfile,
  Unlock,
} from './types'

const EMPTY: never[] = []

/**
 * One live query shared by every component that needs the same large table,
 * instead of one IndexedDB read per consumer.
 */
function sharedLiveQuery<T>(query: () => Promise<T>, initial: T) {
  let value = initial
  let sub: Subscription | null = null
  const listeners = new Set<() => void>()
  const subscribe = (cb: () => void) => {
    listeners.add(cb)
    if (!sub) {
      sub = liveQuery(query).subscribe({
        next: (v) => {
          value = v
          listeners.forEach((l) => l())
        },
        error: (e) => console.error('[live query]', e),
      })
    }
    return () => {
      listeners.delete(cb)
      if (!listeners.size) {
        sub?.unsubscribe()
        sub = null
      }
    }
  }
  return () => useSyncExternalStore(subscribe, () => value)
}

const useAllSessions = sharedLiveQuery<Session[]>(() => db.sessions.orderBy('startedAt').toArray(), EMPTY)
const useAllTasks = sharedLiveQuery<Task[]>(() => db.tasks.toArray(), EMPTY)

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), [], undefined) ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: Date.now() })
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order

export function useLabels(includeArchived = false): Label[] {
  return (
    useLiveQuery(async () => {
      const all = await db.labels.toArray()
      return all.filter((l) => includeArchived || !l.archived).sort(byOrder)
    }, [includeArchived]) ?? EMPTY
  )
}

export function useProjects(includeArchived = false): Project[] {
  return (
    useLiveQuery(async () => {
      const all = await db.projects.toArray()
      return all.filter((p) => includeArchived || !p.archived).sort(byOrder)
    }, [includeArchived]) ?? EMPTY
  )
}

export function useProfiles(): TimerProfile[] {
  return useLiveQuery(() => db.profiles.orderBy('order').toArray(), []) ?? EMPTY
}

export function useGoals(): Goal[] {
  return useLiveQuery(() => db.goals.orderBy('order').toArray(), []) ?? EMPTY
}

export function useHabits(includeArchived = false): Habit[] {
  return (
    useLiveQuery(async () => (await db.habits.orderBy('order').toArray()).filter((h) => includeArchived || !h.archived), [includeArchived]) ??
    EMPTY
  )
}

export function useHabitLogs(from: string, to: string): HabitLog[] {
  return useLiveQuery(() => db.habitLogs.where('date').between(from, to, true, true).toArray(), [from, to]) ?? EMPTY
}

export function useTasks(): Task[] {
  return useAllTasks()
}

export function useOpenTasks(): Task[] {
  return useLiveQuery(() => db.tasks.where('done').equals(0).toArray(), []) ?? EMPTY
}

export function useTask(id: string | null | undefined): Task | undefined {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
}

/** All sessions, oldest first. Every statistic is derived from these. */
export function useSessions(): Session[] {
  return useAllSessions()
}

export function useSessionsBetween(from: string, to: string): Session[] {
  return useLiveQuery(() => db.sessions.where('date').between(from, to, true, true).sortBy('startedAt'), [from, to]) ?? EMPTY
}

export function useEvents(): CalendarEvent[] {
  return useLiveQuery(() => db.events.toArray(), []) ?? EMPTY
}

export function useAudioPresets(): AudioPreset[] {
  return useLiveQuery(() => db.audioPresets.orderBy('order').toArray(), []) ?? EMPTY
}

export function usePlaylists(): Playlist[] {
  return useLiveQuery(() => db.playlists.orderBy('order').toArray(), []) ?? EMPTY
}

export function useUnlocks(): Unlock[] {
  return useLiveQuery(() => db.unlocks.toArray(), []) ?? EMPTY
}

export function useClaims(): ChallengeClaim[] {
  return useLiveQuery(() => db.claims.toArray(), []) ?? EMPTY
}

/** Lookup maps for labels/projects by id. */
export function useLookups() {
  const labels = useLabels(true)
  const projects = useProjects(true)
  return {
    labels,
    projects,
    label: (id: string | null | undefined) => (id ? labels.find((l) => l.id === id) : undefined),
    project: (id: string | null | undefined) => (id ? projects.find((p) => p.id === id) : undefined),
  }
}
