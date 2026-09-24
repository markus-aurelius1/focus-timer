/**
 * The Lodestar progression layer. Each completed focus session becomes a star
 * in your sky; accumulated time unlocks celestial objects and ranks; stardust
 * (earned from focus and challenges) buys sky themes.
 *
 * Everything is derived from sessions, claims and unlocks – nothing to drift.
 */
import type { ChallengeClaim, Session, Unlock } from '@/data/types'

// ───────────────────────── levels & ranks ─────────────────────────

export interface Rank {
  title: string
  minHours: number
}

export const RANKS: Rank[] = [
  { title: 'Stargazer', minHours: 0 },
  { title: 'Wayfinder', minHours: 5 },
  { title: 'Navigator', minHours: 15 },
  { title: 'Cartographer', minHours: 40 },
  { title: 'Astronomer', minHours: 100 },
  { title: 'Celestial Scholar', minHours: 250 },
  { title: 'Keeper of the Lodestar', minHours: 500 },
  { title: 'Luminary', minHours: 1000 },
]

/** Level curve: level L starts at (L-1)²/2 hours – quick early wins, slower later. */
export const hoursForLevel = (level: number) => ((level - 1) ** 2) / 2

export function levelInfo(totalSeconds: number) {
  const hours = totalSeconds / 3600
  const level = Math.floor(Math.sqrt(hours * 2)) + 1
  const from = hoursForLevel(level)
  const to = hoursForLevel(level + 1)
  let rankIndex = 0
  for (let i = 0; i < RANKS.length; i++) if (hours >= RANKS[i].minHours) rankIndex = i
  const nextRank = RANKS[rankIndex + 1] ?? null
  return {
    level,
    hours,
    progress: Math.min(1, (hours - from) / (to - from)),
    hoursToNext: Math.max(0, to - hours),
    rank: RANKS[rankIndex],
    nextRank,
  }
}

// ───────────────────────── stardust ─────────────────────────

/** 1 stardust per 5 focused minutes, +3 for finishing a planned session. */
export function stardustForSession(s: Pick<Session, 'duration' | 'completed'>): number {
  return Math.floor(s.duration / 300) + (s.completed ? 3 : 0)
}

export function stardustBalance(sessions: Session[], claims: ChallengeClaim[], unlocks: Unlock[]) {
  let earned = 0
  for (const s of sessions) earned += stardustForSession(s)
  for (const c of claims) earned += c.reward
  let spent = 0
  for (const u of unlocks) spent += u.cost
  return { earned, spent, balance: earned - spent }
}

// ───────────────────────── milestones ─────────────────────────

export type CelestialId =
  | 'first-light'
  | 'crescent'
  | 'binary'
  | 'shooting-stars'
  | 'aurora'
  | 'pole-star'
  | 'comet'
  | 'full-moon'
  | 'ringed-planet'
  | 'meteor-shower'
  | 'nebula'
  | 'milky-way'
  | 'eclipse'
  | 'galaxy'
  | 'supernova'

export interface Milestone {
  id: CelestialId
  name: string
  description: string
  metric: 'hours' | 'sessions' | 'streak' | 'days'
  threshold: number
}

export const MILESTONES: Milestone[] = [
  { id: 'first-light', name: 'First Light', description: 'Complete your first focus session', metric: 'sessions', threshold: 1 },
  { id: 'binary', name: 'Binary Star', description: 'Study 3 days in a row', metric: 'streak', threshold: 3 },
  { id: 'crescent', name: 'Crescent Moon', description: '5 hours of focus', metric: 'hours', threshold: 5 },
  { id: 'shooting-stars', name: 'Shooting Stars', description: '10 hours of focus', metric: 'hours', threshold: 10 },
  { id: 'pole-star', name: 'Pole Star', description: 'A 7-day streak', metric: 'streak', threshold: 7 },
  { id: 'aurora', name: 'Aurora', description: '25 hours of focus', metric: 'hours', threshold: 25 },
  { id: 'comet', name: 'Comet', description: '50 hours of focus', metric: 'hours', threshold: 50 },
  { id: 'meteor-shower', name: 'Meteor Shower', description: 'A 14-day streak', metric: 'streak', threshold: 14 },
  { id: 'full-moon', name: 'Full Moon', description: '100 completed sessions', metric: 'sessions', threshold: 100 },
  { id: 'ringed-planet', name: 'Ringed Planet', description: '100 hours of focus', metric: 'hours', threshold: 100 },
  { id: 'milky-way', name: 'Milky Way', description: 'Study on 100 different days', metric: 'days', threshold: 100 },
  { id: 'nebula', name: 'Nebula', description: '200 hours of focus', metric: 'hours', threshold: 200 },
  { id: 'eclipse', name: 'Eclipse', description: 'A 30-day streak', metric: 'streak', threshold: 30 },
  { id: 'galaxy', name: 'Spiral Galaxy', description: '365 hours of focus', metric: 'hours', threshold: 365 },
  { id: 'supernova', name: 'Supernova', description: '1,000 hours of focus', metric: 'hours', threshold: 1000 },
]

export interface ProgressMetrics {
  hours: number
  sessions: number
  longestStreak: number
  studyDays: number
}

export function metricValue(m: Milestone['metric'], p: ProgressMetrics): number {
  switch (m) {
    case 'hours':
      return p.hours
    case 'sessions':
      return p.sessions
    case 'streak':
      return p.longestStreak
    case 'days':
      return p.studyDays
  }
}

export function milestoneStates(p: ProgressMetrics) {
  return MILESTONES.map((m) => {
    const value = metricValue(m.metric, p)
    return { ...m, value, unlocked: value >= m.threshold, ratio: Math.min(1, value / m.threshold) }
  })
}

// ───────────────────────── sky themes ─────────────────────────

export interface SkyTheme {
  id: string
  name: string
  cost: number
  /** Gradient stops, top → bottom. */
  stops: [string, string, string]
  /** Tint for faint "dust" and constellation lines. */
  line: string
  glow: string
}

export const SKY_THEMES: SkyTheme[] = [
  { id: 'midnight', name: 'Midnight', cost: 0, stops: ['#070913', '#0d1226', '#1a1f3d'], line: '#8f9bd6', glow: '#f2c46d' },
  { id: 'dusk', name: 'Dusk', cost: 0, stops: ['#120c24', '#2a1840', '#5b2d4a'], line: '#c9a0d8', glow: '#ffb38a' },
  { id: 'aurora', name: 'Aurora', cost: 150, stops: ['#03110f', '#07302b', '#0f4a3f'], line: '#7fe3c4', glow: '#b6ffe0' },
  { id: 'abyss', name: 'Abyss', cost: 200, stops: ['#01060d', '#04182b', '#08304d'], line: '#6fb7e8', glow: '#9fe1ff' },
  { id: 'nebula', name: 'Nebula', cost: 300, stops: ['#0d0514', '#2b0c33', '#4a1646'], line: '#e59ad8', glow: '#ffc4ee' },
  { id: 'solstice', name: 'Solstice', cost: 400, stops: ['#0f0a04', '#2a1b08', '#4a2e0c'], line: '#f0c27b', glow: '#ffe2a8' },
  { id: 'eclipse', name: 'Eclipse', cost: 600, stops: ['#000000', '#07070a', '#121218'], line: '#d8d8e8', glow: '#ffffff' },
]

export const skyTheme = (id: string) => SKY_THEMES.find((t) => t.id === id) ?? SKY_THEMES[0]

export const isThemeOwned = (id: string, unlocks: Unlock[]) =>
  skyTheme(id).cost === 0 || unlocks.some((u) => u.item === `theme:${id}`)
