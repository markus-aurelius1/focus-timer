/** Reactive read hooks – components re-render whenever the underlying IndexedDB data changes. */
import { liveQuery, type Subscription } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useSyncExternalStore } from 'react'
import { db } from './db'
import { DEFAULT_SETTINGS } from './seed'
import type {
  AudioPreset,
  CalendarEvent,
  ChallengeClaim,
  ExpeditionRun,
  Goal,
  Habit,
  HabitLog,
  Label,
  Playlist,
  Project,
  RecallAttempt,
  Session,
  Settings,
  Task,
  TimerProfile,
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

// The small tables are read by a dozen components each (useLookups alone is called on every list row's screen):
// one live query per table, shared, instead of one IndexedDB subscription per consumer.
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order
const useStoredSettings = sharedLiveQuery<Settings | undefined>(() => db.settings.get('settings'), undefined)
const useAllLabels = sharedLiveQuery<Label[]>(async () => (await db.labels.toArray()).sort(byOrder), EMPTY)
const useAllProjects = sharedLiveQuery<Project[]>(async () => (await db.projects.toArray()).sort(byOrder), EMPTY)
const useAllProfiles = sharedLiveQuery<TimerProfile[]>(() => db.profiles.orderBy('order').toArray(), EMPTY)
const useAllGoals = sharedLiveQuery<Goal[]>(() => db.goals.orderBy('order').toArray(), EMPTY)
const useAllEvents = sharedLiveQuery<CalendarEvent[]>(() => db.events.toArray(), EMPTY)

export function useSettings(): Settings {
  return useStoredSettings() ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: Date.now() })
}

export function useLabels(includeArchived = false): Label[] {
  const all = useAllLabels()
  return useMemo(() => (includeArchived ? all : all.filter((l) => !l.archived)), [all, includeArchived])
}

export function useProjects(includeArchived = false): Project[] {
  const all = useAllProjects()
  return useMemo(() => (includeArchived ? all : all.filter((p) => !p.archived)), [all, includeArchived])
}

export function useProfiles(): TimerProfile[] {
  return useAllProfiles()
}

export function useGoals(): Goal[] {
  return useAllGoals()
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
  return useAllEvents()
}

export function useAudioPresets(): AudioPreset[] {
  return useLiveQuery(() => db.audioPresets.orderBy('order').toArray(), []) ?? EMPTY
}

export function usePlaylists(): Playlist[] {
  return useLiveQuery(() => db.playlists.orderBy('order').toArray(), []) ?? EMPTY
}

const useAllClaims = sharedLiveQuery<ChallengeClaim[]>(() => db.claims.toArray(), EMPTY)
const useAllRecalls = sharedLiveQuery<RecallAttempt[]>(() => db.recalls.orderBy('at').toArray(), EMPTY)
const useAllRuns = sharedLiveQuery<ExpeditionRun[]>(() => db.expeditions.orderBy('startedAt').toArray(), EMPTY)

export function useClaims(): ChallengeClaim[] {
  return useAllClaims()
}

/** Every recall answer, oldest first. */
export function useRecalls(): RecallAttempt[] {
  return useAllRecalls()
}

/** Expedition runs, oldest first. */
export function useExpeditionRuns(): ExpeditionRun[] {
  return useAllRuns()
}

/** Lookup maps for labels/projects by id. */
export function useLookups() {
  const labels = useLabels(true)
  const projects = useProjects(true)
  // Stable while the tables don't change, so components that take these as props or dependencies are not re-run for nothing.
  return useMemo(() => {
    const labelById = new Map(labels.map((l) => [l.id, l]))
    const projectById = new Map(projects.map((p) => [p.id, p]))
    return {
      labels,
      projects,
      label: (id: string | null | undefined) => (id ? labelById.get(id) : undefined),
      project: (id: string | null | undefined) => (id ? projectById.get(id) : undefined),
    }
  }, [labels, projects])
}
