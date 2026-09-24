import { uid } from '@/lib/id'
import { todayKey } from '@/lib/time'
import { db } from './db'
import type { AudioPreset, Goal, Label, Settings, Task, TimerProfile } from './types'

/** Curated palette that reads well on both paper (light) and night (dark) themes. */
export const PALETTE = [
  { name: 'Gold', value: '#E0A93B' },
  { name: 'Coral', value: '#E9765B' },
  { name: 'Rose', value: '#E0628A' },
  { name: 'Orchid', value: '#B86BD8' },
  { name: 'Violet', value: '#8B7CF0' },
  { name: 'Indigo', value: '#5D7BEA' },
  { name: 'Sky', value: '#3FA7E0' },
  { name: 'Teal', value: '#2FB3A3' },
  { name: 'Sage', value: '#6DBE7B' },
  { name: 'Lime', value: '#A7C24A' },
  { name: 'Sand', value: '#C9A27A' },
  { name: 'Slate', value: '#8C95A8' },
] as const

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  updatedAt: 0,
  theme: 'system',
  weekStartsOn: 1,
  use24h: false,
  activeProfileId: null,
  notifications: true,
  haptics: true,
  keepAwake: true,
  immersiveOnStart: false,
  endSound: 'bell',
  endVolume: 0.7,
  minSessionSeconds: 60,
  ambientFollowsTimer: true,
  atlasStyle: 'physical',
  baseCamp: null,
  breakReview: true,
  onboarded: false,
}

/** Settings from any version (e.g. an old backup) with legacy keys dropped and new ones defaulted. */
export function normalizeSettings(raw: object): Settings {
  const { skyTheme: _legacy, ...rest } = raw as Record<string, unknown>
  const out = { ...DEFAULT_SETTINGS, ...rest, id: 'settings' } as Settings
  return Object.fromEntries(Object.entries(out).filter(([k]) => k in DEFAULT_SETTINGS)) as unknown as Settings
}

type ProfileSeed = Omit<TimerProfile, 'id' | 'createdAt' | 'updatedAt' | 'order'>

export const BUILT_IN_PROFILES: ProfileSeed[] = [
  {
    name: 'Classic',
    mode: 'pomodoro',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  {
    name: 'Deep work',
    mode: 'pomodoro',
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    longBreakEvery: 3,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  {
    name: 'Ultradian',
    mode: 'pomodoro',
    focusMinutes: 90,
    shortBreakMinutes: 20,
    longBreakMinutes: 30,
    longBreakEvery: 2,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  {
    name: 'Sprint',
    mode: 'pomodoro',
    focusMinutes: 15,
    shortBreakMinutes: 3,
    longBreakMinutes: 10,
    longBreakEvery: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  {
    name: 'Exam block',
    mode: 'countdown',
    focusMinutes: 120,
    shortBreakMinutes: 15,
    longBreakMinutes: 30,
    longBreakEvery: 0,
    autoStartBreaks: false,
    autoStartFocus: false,
  },
  {
    name: 'Open focus',
    mode: 'stopwatch',
    focusMinutes: 0,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 0,
    autoStartBreaks: false,
    autoStartFocus: false,
  },
]

export const BUILT_IN_AUDIO: Array<Pick<AudioPreset, 'name' | 'layers'>> = [
  { name: 'Rainy library', layers: [{ sound: 'rain', volume: 0.65 }, { sound: 'brown', volume: 0.2 }] },
  { name: 'Cabin night', layers: [{ sound: 'fire', volume: 0.6 }, { sound: 'wind', volume: 0.3 }, { sound: 'night', volume: 0.25 }] },
  { name: 'Seaside', layers: [{ sound: 'waves', volume: 0.7 }, { sound: 'wind', volume: 0.15 }] },
  { name: 'Forest morning', layers: [{ sound: 'birds', volume: 0.45 }, { sound: 'stream', volume: 0.45 }] },
  { name: 'Deep work', layers: [{ sound: 'brown', volume: 0.55 }, { sound: 'drone', volume: 0.25 }] },
  { name: 'Corner café', layers: [{ sound: 'cafe', volume: 0.6 }, { sound: 'rain', volume: 0.2 }] },
]

/** Idempotently create first-run defaults. Safe to call on every launch. */
export async function ensureSeed(): Promise<void> {
  await db.transaction(
    'rw',
    [db.settings, db.profiles, db.labels, db.goals, db.audioPresets, db.tasks],
    async () => {
      const existing = await db.settings.get('settings')
      if (existing) {
        // Forward-fill settings added in newer versions.
        const merged = { ...DEFAULT_SETTINGS, ...existing }
        if (Object.keys(merged).length !== Object.keys(existing).length) await db.settings.put(merged)
        return
      }

      const now = Date.now()
      const stamp = { createdAt: now, updatedAt: now }

      const profiles: TimerProfile[] = BUILT_IN_PROFILES.map((p, order) => ({ ...p, ...stamp, id: uid(), order }))
      await db.profiles.bulkPut(profiles)

      const labelSeeds: Array<[string, string]> = [
        ['Mathematics', '#5D7BEA'],
        ['Sciences', '#2FB3A3'],
        ['Languages', '#E0628A'],
        ['Reading', '#E0A93B'],
      ]
      const labels: Label[] = labelSeeds.map(([name, color], order) => ({
        ...stamp,
        id: uid(),
        name,
        color,
        parentId: null,
        kind: 'subject',
        archived: false,
        order,
      }))
      await db.labels.bulkPut(labels)

      const goals: Goal[] = [
        { ...stamp, id: uid(), title: 'Daily focus', period: 'day', targetMinutes: 120, labelId: null, projectId: null, active: true, order: 0 },
        { ...stamp, id: uid(), title: 'Weekly focus', period: 'week', targetMinutes: 600, labelId: null, projectId: null, active: true, order: 1 },
      ]
      await db.goals.bulkPut(goals)

      const presets: AudioPreset[] = BUILT_IN_AUDIO.map((p, order) => ({ ...p, ...stamp, id: uid(), order }))
      await db.audioPresets.bulkPut(presets)

      const today = todayKey()
      const task = (title: string, order: number, extra: Partial<Task> = {}): Task => ({
        ...stamp,
        id: uid(),
        title,
        notes: '',
        projectId: null,
        labelId: null,
        priority: 0,
        plannedFor: today,
        dueDate: null,
        dueTime: null,
        reminderAt: null,
        estimatedPomodoros: 1,
        subtasks: [],
        recurrence: null,
        seriesId: null,
        done: 0,
        completedAt: null,
        order,
        ...extra,
      })
      await db.tasks.bulkPut([
        task('Try a first focus session', 0, {
          notes: 'Press ▶ on this task to start a timer linked to it. Your time is tracked automatically.',
          priority: 2,
        }),
        task('Add this week’s deadlines', 1, {
          estimatedPomodoros: 0,
          subtasks: [
            { id: uid(), title: 'Assignments', done: false },
            { id: uid(), title: 'Exams & tests', done: false },
            { id: uid(), title: 'Reading', done: false },
          ],
        }),
        task('Open the Atlas and pick your first expedition', 2, { estimatedPomodoros: 0, plannedFor: null }),
      ])

      await db.settings.put({ ...DEFAULT_SETTINGS, activeProfileId: profiles[0].id, updatedAt: now })
    },
  )
}
