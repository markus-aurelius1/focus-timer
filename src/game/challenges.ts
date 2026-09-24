/**
 * Daily and weekly challenges. The set for a period is chosen deterministically
 * from the date, so every device shows the same challenges and nothing needs to
 * be stored until the user claims a reward.
 */
import type { ChallengeClaim, Session, Task } from '@/data/types'
import { addDaysKey, dayKey, startOfWeekKey, type DayKey, type WeekStart } from '@/lib/time'
import { hashString, pick, seededRandom, shuffle } from '@/lib/random'

/** Atlas activity within the challenge period (computed by the caller). */
export interface AtlasActivity {
  /** Recall questions answered. */
  reviewed: number
  correct: number
  /** Focus minutes that moved an expedition on. */
  expeditionMinutes: number
  /** Places discovered. */
  discovered: number
  /** Mountain passes that reached Strong in this period. */
  passesStrong: number
}

export const NO_ATLAS: AtlasActivity = { reviewed: 0, correct: 0, expeditionMinutes: 0, discovered: 0, passesStrong: 0 }

export interface ChallengeContext {
  /** Sessions within the challenge period. */
  sessions: Session[]
  /** Tasks completed within the challenge period. */
  tasksCompleted: Task[]
  /** All open tasks – for planning challenges. */
  openTasks: Task[]
  today: DayKey
  dailyGoalMinutes: number
  atlas: AtlasActivity
}

interface ChallengeDef {
  id: string
  period: 'day' | 'week'
  targets: number[]
  reward: (target: number) => number
  title: (target: number) => string
  measure: (ctx: ChallengeContext) => number
  unit?: 'minutes' | 'hours'
}

const minutes = (sessions: Session[]) => sessions.reduce((a, s) => a + s.duration, 0) / 60

const DAILY: ChallengeDef[] = [
  {
    id: 'd-sessions',
    period: 'day',
    targets: [2, 3, 4],
    reward: (n) => 10 + n * 5,
    title: (n) => `Complete ${n} focus sessions`,
    measure: (c) => c.sessions.filter((s) => s.completed).length,
  },
  {
    id: 'd-minutes',
    period: 'day',
    targets: [45, 60, 90, 120],
    reward: (n) => Math.round(n / 3),
    title: (n) => `Focus for ${n} minutes`,
    measure: (c) => Math.floor(minutes(c.sessions)),
    unit: 'minutes',
  },
  {
    id: 'd-early',
    period: 'day',
    targets: [1],
    reward: () => 20,
    title: () => 'Start a session before 10:00',
    measure: (c) => c.sessions.filter((s) => new Date(s.startedAt).getHours() < 10).length,
  },
  {
    id: 'd-tasks',
    period: 'day',
    targets: [2, 3, 5],
    reward: (n) => 8 + n * 4,
    title: (n) => `Complete ${n} tasks`,
    measure: (c) => c.tasksCompleted.length,
  },
  {
    id: 'd-deep',
    period: 'day',
    targets: [1],
    reward: () => 30,
    title: () => 'Finish a 45+ minute session without pausing',
    measure: (c) => c.sessions.filter((s) => s.completed && s.duration >= 45 * 60 && s.pauseCount === 0).length,
  },
  {
    id: 'd-subjects',
    period: 'day',
    targets: [2, 3],
    reward: (n) => 10 + n * 5,
    title: (n) => `Study ${n} different subjects`,
    measure: (c) => new Set(c.sessions.map((s) => s.labelId).filter(Boolean)).size,
  },
  {
    id: 'd-reflect',
    period: 'day',
    targets: [2],
    reward: () => 15,
    title: () => 'Rate or add a note to 2 sessions',
    measure: (c) => c.sessions.filter((s) => s.rating || s.note.trim()).length,
  },
  {
    id: 'd-plan',
    period: 'day',
    targets: [3],
    reward: () => 15,
    title: () => 'Plan tomorrow: schedule 3 tasks',
    measure: (c) => c.openTasks.filter((t) => t.plannedFor === addDaysKey(c.today, 1)).length,
  },
  {
    id: 'd-goal',
    period: 'day',
    targets: [1],
    reward: () => 25,
    title: () => 'Reach your daily focus goal',
    measure: (c) => (minutes(c.sessions) >= c.dailyGoalMinutes ? 1 : 0),
  },
  {
    id: 'd-review',
    period: 'day',
    targets: [5, 8],
    reward: (n) => n * 3,
    title: (n) => `Review ${n} places in the Atlas`,
    measure: (c) => c.atlas.reviewed,
  },
  {
    id: 'd-expedition',
    period: 'day',
    targets: [45, 60, 90],
    reward: (n) => Math.round(n / 3),
    title: (n) => `Advance your expedition ${n} minutes`,
    measure: (c) => Math.floor(c.atlas.expeditionMinutes),
    unit: 'minutes',
  },
]

const WEEKLY: ChallengeDef[] = [
  {
    id: 'w-hours',
    period: 'week',
    targets: [5, 8, 12],
    reward: (n) => n * 8,
    title: (n) => `Focus ${n} hours this week`,
    measure: (c) => Math.floor((minutes(c.sessions) / 60) * 10) / 10,
    unit: 'hours',
  },
  {
    id: 'w-days',
    period: 'week',
    targets: [4, 5, 6],
    reward: (n) => n * 12,
    title: (n) => `Study on ${n} different days`,
    measure: (c) => new Set(c.sessions.map((s) => s.date)).size,
  },
  {
    id: 'w-sessions',
    period: 'week',
    targets: [10, 15, 20],
    reward: (n) => n * 4,
    title: (n) => `Complete ${n} focus sessions`,
    measure: (c) => c.sessions.filter((s) => s.completed).length,
  },
  {
    id: 'w-tasks',
    period: 'week',
    targets: [8, 12, 15],
    reward: (n) => n * 4,
    title: (n) => `Complete ${n} tasks`,
    measure: (c) => c.tasksCompleted.length,
  },
  {
    id: 'w-recall',
    period: 'week',
    targets: [20, 30, 45],
    reward: (n) => n * 2,
    title: (n) => `Answer ${n} Atlas questions correctly`,
    measure: (c) => c.atlas.correct,
  },
  {
    id: 'w-discover',
    period: 'week',
    targets: [8, 12, 16],
    reward: (n) => n * 5,
    title: (n) => `Discover ${n} new places`,
    measure: (c) => c.atlas.discovered,
  },
  {
    id: 'w-pass',
    period: 'week',
    targets: [1, 2],
    reward: (n) => 40 + n * 20,
    title: (n) => (n === 1 ? 'Make a mountain pass Strong' : `Make ${n} mountain passes Strong`),
    measure: (c) => c.atlas.passesStrong,
  },
]

export interface ChallengeInstance {
  key: string
  id: string
  period: 'day' | 'week'
  periodKey: string
  title: string
  target: number
  reward: number
  progress: number
  complete: boolean
  claimed: boolean
  unit?: 'minutes' | 'hours'
}

function instantiate(def: ChallengeDef, periodKey: string, ctx: ChallengeContext, claims: ChallengeClaim[]): ChallengeInstance {
  const rand = seededRandom(hashString(`${def.id}:${periodKey}`))
  const target = pick(rand, def.targets)
  const progress = def.measure(ctx)
  return {
    key: `${def.id}@${periodKey}`,
    id: def.id,
    period: def.period,
    periodKey,
    title: def.title(target),
    target,
    reward: def.reward(target),
    progress,
    complete: progress >= target,
    claimed: claims.some((c) => c.challengeId === def.id && c.period === periodKey),
    unit: def.unit,
  }
}

export function dailyChallenges(today: DayKey, ctx: ChallengeContext, claims: ChallengeClaim[], count = 3): ChallengeInstance[] {
  const defs = shuffle(seededRandom(`daily:${today}`), DAILY).slice(0, count)
  return defs.map((d) => instantiate(d, today, ctx, claims))
}

export function weeklyChallenges(today: DayKey, weekStartsOn: WeekStart, ctx: ChallengeContext, claims: ChallengeClaim[], count = 2) {
  const week = startOfWeekKey(today, weekStartsOn)
  const defs = shuffle(seededRandom(`weekly:${week}`), WEEKLY).slice(0, count)
  return defs.map((d) => instantiate(d, week, ctx, claims))
}

export function buildContext(
  sessions: Session[],
  tasks: Task[],
  start: DayKey,
  end: DayKey,
  today: DayKey,
  dailyGoalMinutes: number,
  atlas: AtlasActivity = NO_ATLAS,
): ChallengeContext {
  return {
    atlas,
    sessions: sessions.filter((s) => s.date >= start && s.date <= end),
    tasksCompleted: tasks.filter((t) => t.completedAt && dayKey(t.completedAt) >= start && dayKey(t.completedAt) <= end),
    openTasks: tasks.filter((t) => !t.done),
    today,
    dailyGoalMinutes,
  }
}
