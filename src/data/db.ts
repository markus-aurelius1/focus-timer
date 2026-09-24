import Dexie, { type EntityTable, type Table } from 'dexie'
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
  ReminderLog,
  Session,
  Settings,
  Task,
  TimerProfile,
  Tombstone,
  Unlock,
} from './types'

export class LodestarDB extends Dexie {
  labels!: EntityTable<Label, 'id'>
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  sessions!: EntityTable<Session, 'id'>
  profiles!: EntityTable<TimerProfile, 'id'>
  goals!: EntityTable<Goal, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  audioPresets!: EntityTable<AudioPreset, 'id'>
  playlists!: EntityTable<Playlist, 'id'>
  unlocks!: EntityTable<Unlock, 'id'>
  claims!: EntityTable<ChallengeClaim, 'id'>
  settings!: Table<Settings, 'settings'>
  tombstones!: EntityTable<Tombstone, 'id'>
  reminderLog!: EntityTable<ReminderLog, 'id'>

  constructor(name = 'lodestar') {
    super(name)
    this.version(1).stores({
      labels: 'id, parentId, order, updatedAt',
      projects: 'id, order, updatedAt',
      tasks: 'id, done, projectId, labelId, plannedFor, dueDate, completedAt, seriesId, updatedAt',
      sessions: 'id, date, startedAt, labelId, taskId, projectId, updatedAt',
      profiles: 'id, order, updatedAt',
      goals: 'id, order, updatedAt',
      habits: 'id, order, updatedAt',
      habitLogs: 'id, habitId, date, updatedAt',
      events: 'id, date, kind, taskId, updatedAt',
      audioPresets: 'id, order, updatedAt',
      playlists: 'id, order, updatedAt',
      unlocks: 'id, item, updatedAt',
      claims: 'id, challengeId, period, updatedAt',
      settings: 'id',
      tombstones: 'id, table, deletedAt',
      reminderLog: 'id, firedAt',
    })
  }
}

export const db = new LodestarDB()
