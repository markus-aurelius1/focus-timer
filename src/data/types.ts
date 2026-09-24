/**
 * Lodestar data model.
 *
 * Every persisted record carries a globally unique `id` plus `createdAt`/`updatedAt`
 * timestamps. Deletions are recorded as tombstones. Together this gives a
 * last-write-wins merge story for JSON import today and multi-device sync later
 * (see `sync.ts`) without requiring an account.
 */
import type { DayKey, WeekStart } from '@/lib/time'

export interface Entity {
  id: string
  createdAt: number
  updatedAt: number
}

// ───────────────────────── organisation ─────────────────────────

/** Labels are flexible: a label can nest under another (Exam → Subject → Topic). */
export type LabelKind = 'exam' | 'subject' | 'topic' | 'label'

export interface Label extends Entity {
  name: string
  color: string
  parentId: string | null
  kind: LabelKind
  archived: boolean
  order: number
}

export interface Project extends Entity {
  name: string
  color: string
  /** Optional default label – sessions on this project's tasks inherit it. */
  labelId: string | null
  note: string
  archived: boolean
  order: number
}

// ───────────────────────── tasks ─────────────────────────

export type Priority = 0 | 1 | 2 | 3 // none, low, medium, high

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  freq: Frequency
  /** Repeat every N units. */
  interval: number
  /** For weekly rules: which weekdays (0 = Sunday). Empty → same weekday as the anchor. */
  weekdays?: number[]
  /** Last day (inclusive) the rule may produce an occurrence. */
  until?: DayKey | null
}

export interface Task extends Entity {
  title: string
  notes: string
  projectId: string | null
  labelId: string | null
  priority: Priority
  /** The day you intend to work on it ("do date"). */
  plannedFor: DayKey | null
  /** The deadline. */
  dueDate: DayKey | null
  dueTime: string | null
  reminderAt: number | null
  estimatedPomodoros: number
  subtasks: Subtask[]
  recurrence: RecurrenceRule | null
  /** Shared by every instance of a recurring task so history can be grouped. */
  seriesId: string | null
  /** 0/1 rather than boolean because IndexedDB cannot index booleans. */
  done: 0 | 1
  completedAt: number | null
  order: number
}

// ───────────────────────── focus ─────────────────────────

export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export interface TimerProfile extends Entity {
  name: string
  mode: TimerMode
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** Focus sessions before a long break. 0 disables long breaks. */
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  order: number
}

export type SessionSource = 'timer' | 'manual' | 'import'

/** One block of focused work. Every statistic in the app is derived from these. */
export interface Session extends Entity {
  mode: TimerMode
  startedAt: number
  endedAt: number
  /** Focused seconds, excluding pauses. */
  duration: number
  /** Planned seconds, null for open-ended stopwatch sessions. */
  plannedDuration: number | null
  /** Reached its planned length (stopwatch sessions count as complete when stopped deliberately). */
  completed: boolean
  /** Local day the session started on. */
  date: DayKey
  labelId: string | null
  taskId: string | null
  projectId: string | null
  profileId: string | null
  note: string
  /** Self-rated focus quality, 1–5. */
  rating: number | null
  pauseCount: number
  source: SessionSource
}

// ───────────────────────── goals & habits ─────────────────────────

export type GoalPeriod = 'day' | 'week' | 'month'

export interface Goal extends Entity {
  title: string
  period: GoalPeriod
  targetMinutes: number
  /** Scope the goal to a label (includes its children) – null means all focus. */
  labelId: string | null
  projectId: string | null
  active: boolean
  order: number
}

/** `check` habits are ticked by hand; `focus` habits are fulfilled automatically by sessions. */
export type HabitKind = 'check' | 'focus'

export interface Habit extends Entity {
  name: string
  color: string
  kind: HabitKind
  targetMinutes: number
  labelId: string | null
  /** Days the habit is expected (0 = Sunday). Empty = every day. */
  weekdays: number[]
  reminderTime: string | null
  archived: boolean
  order: number
}

export interface HabitLog extends Entity {
  habitId: string
  date: DayKey
  value: number
}

// ───────────────────────── calendar ─────────────────────────

/** `block` = a scheduled focus block (time-blocking) that can launch the timer. */
export type EventKind = 'event' | 'block' | 'exam' | 'deadline'

export interface CalendarEvent extends Entity {
  title: string
  kind: EventKind
  date: DayKey
  /** "HH:mm" – null for all-day items. */
  start: string | null
  end: string | null
  color: string | null
  labelId: string | null
  taskId: string | null
  notes: string
  location: string
  reminderMinutes: number | null
  recurrence: RecurrenceRule | null
}

// ───────────────────────── audio ─────────────────────────

export interface SoundLayer {
  sound: string
  volume: number
}

export interface AudioPreset extends Entity {
  name: string
  layers: SoundLayer[]
  order: number
}

export type PlaylistProvider = 'youtube' | 'youtube-music' | 'spotify' | 'link'

export interface Playlist extends Entity {
  title: string
  url: string
  provider: PlaylistProvider
  order: number
}

// ───────────────────────── progression & atlas ─────────────────────────

export interface ChallengeClaim extends Entity {
  challengeId: string
  /** Day key (daily) or week-start key (weekly). */
  period: string
  /** XP awarded (challenges claimed before the Atlas paid stardust; it now counts as XP). */
  reward: number
}

export type QuestionType = 'locate' | 'identify' | 'state' | 'river' | 'relation' | 'border' | 'order' | 'fact'
export type RecallSource = 'review' | 'card' | 'break' | 'checkpoint'

/** One answered recall question. Mastery is always derived from these. */
export interface RecallAttempt extends Entity {
  placeId: string
  type: QuestionType
  correct: 0 | 1
  at: number
  date: DayKey
  source: RecallSource
}

/**
 * A stretch of time during which an expedition was the active one. Focus
 * minutes from sessions that end inside the window move that expedition on.
 */
export interface ExpeditionRun extends Entity {
  expeditionId: string
  startedAt: number
  endedAt: number | null
}

// ───────────────────────── system ─────────────────────────

export interface Tombstone {
  /** `${table}:${entityId}` */
  id: string
  table: string
  entityId: string
  deletedAt: number
}

export interface ReminderLog {
  id: string
  firedAt: number
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type AtlasStyle = 'physical' | 'political' | 'night' | 'antique'

export interface Settings {
  id: 'settings'
  updatedAt: number
  theme: ThemePreference
  weekStartsOn: WeekStart
  use24h: boolean
  activeProfileId: string | null
  notifications: boolean
  haptics: boolean
  keepAwake: boolean
  immersiveOnStart: boolean
  endSound: string
  endVolume: number
  /** Interrupted sessions shorter than this are discarded. */
  minSessionSeconds: number
  /** Resume the current soundscape when focus starts and fade it during breaks. */
  ambientFollowsTimer: boolean
  /** Atlas map style (styles beyond the first two unlock with rank). */
  atlasStyle: AtlasStyle
  /** Home state chosen at onboarding – explored from the start, and where free survey begins. */
  baseCamp: string | null
  /** Offer two quick recall questions during breaks. */
  breakReview: boolean
  /** Draw the active expedition's chart behind immersive mode (off: a plain, calm background). */
  immersiveChart?: boolean
  onboarded: boolean
}

/** Map of table name → record type, used by backup, CSV and sync code. */
export interface TableMap {
  labels: Label
  projects: Project
  tasks: Task
  sessions: Session
  profiles: TimerProfile
  goals: Goal
  habits: Habit
  habitLogs: HabitLog
  events: CalendarEvent
  audioPresets: AudioPreset
  playlists: Playlist
  claims: ChallengeClaim
  recalls: RecallAttempt
  expeditions: ExpeditionRun
}

export type SyncTable = keyof TableMap

export const SYNC_TABLES: SyncTable[] = [
  'labels',
  'projects',
  'tasks',
  'sessions',
  'profiles',
  'goals',
  'habits',
  'habitLogs',
  'events',
  'audioPresets',
  'playlists',
  'claims',
  'recalls',
  'expeditions',
]
