import { describe, expect, it } from 'vitest'
import type { Label, Session } from '@/data/types'
import {
  breakdown,
  computeStreaks,
  goalProgress,
  labelScope,
  periodRange,
  rootOf,
  secondsByHour,
  summarize,
  weeklyTrend,
} from './aggregate'
import { levelInfo, xpBreakdown } from '@/game/progression'
import { buildContext, dailyChallenges } from '@/game/challenges'

const at = (day: string, h: number, m = 0) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

let n = 0
function session(day: string, h: number, minutes: number, extra: Partial<Session> = {}): Session {
  const startedAt = at(day, h)
  return {
    id: `s${++n}`,
    createdAt: startedAt,
    updatedAt: startedAt,
    mode: 'pomodoro',
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    duration: minutes * 60,
    plannedDuration: minutes * 60,
    completed: true,
    date: day,
    labelId: null,
    taskId: null,
    projectId: null,
    profileId: null,
    note: '',
    rating: null,
    pauseCount: 0,
    source: 'timer',
    ...extra,
  }
}

const label = (id: string, parentId: string | null = null): Label => ({
  id,
  parentId,
  name: id,
  color: '#5D7BEA',
  kind: 'subject',
  archived: false,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
})

describe('stats', () => {
  it('summarises sessions', () => {
    const s = summarize([session('2026-09-21', 9, 25), session('2026-09-21', 10, 50, { completed: false }), session('2026-09-22', 9, 25)])
    expect(s.totalSeconds).toBe(100 * 60)
    expect(s.count).toBe(3)
    expect(s.studyDays).toBe(2)
    expect(s.completionRate).toBeCloseTo(2 / 3)
  })

  it('splits sessions across hour boundaries', () => {
    const hours = secondsByHour([session('2026-09-21', 9, 60, { startedAt: at('2026-09-21', 9, 30), endedAt: at('2026-09-21', 10, 30) })])
    expect(hours[9]).toBeCloseTo(1800)
    expect(hours[10]).toBeCloseTo(1800)
  })

  it('computes current and longest streaks', () => {
    const days = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']
    expect(computeStreaks(days, '2026-09-23')).toEqual({ current: 4, longest: 4, todayDone: true })
    // Not studied yet today – yesterday's streak is still alive.
    expect(computeStreaks(days, '2026-09-24')).toMatchObject({ current: 4, todayDone: false })
    expect(computeStreaks(days, '2026-09-25').current).toBe(0)
  })

  it('rolls labels up to their roots and scopes goals to descendants', () => {
    const labels = [label('exam'), label('bio', 'exam'), label('cells', 'bio'), label('other')]
    const root = rootOf(labels)
    expect(root('cells')).toBe('exam')
    expect([...labelScope(labels, 'bio')].sort()).toEqual(['bio', 'cells'])
    const sessions = [session('2026-09-24', 9, 30, { labelId: 'cells' }), session('2026-09-24', 11, 30, { labelId: 'other' })]
    const byRoot = breakdown(sessions, (s) => root(s.labelId))
    expect(byRoot.map((b) => b.id).sort()).toEqual(['exam', 'other'])
    const goal = { id: 'g', title: '', period: 'day' as const, targetMinutes: 60, labelId: 'exam', projectId: null, active: true, order: 0, createdAt: 0, updatedAt: 0 }
    const p = goalProgress(goal, sessions, labels, '2026-09-24', 1)
    expect(p.seconds).toBe(1800)
    expect(p.ratio).toBeCloseTo(0.5)
  })

  it('builds period ranges', () => {
    expect(periodRange('week', '2026-09-24', 1)).toEqual({ start: '2026-09-21', end: '2026-09-27' })
    expect(periodRange('week', '2026-09-24', 0)).toEqual({ start: '2026-09-20', end: '2026-09-26' })
    expect(periodRange('month', '2026-02-10', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('weekly trend buckets sessions', () => {
    const t = weeklyTrend([session('2026-09-22', 9, 60), session('2026-09-15', 9, 30)], 3, '2026-09-24', 1)
    expect(t.map((w) => w.seconds)).toEqual([0, 1800, 3600])
  })
})

describe('progression', () => {
  it('levels up on a square-root curve', () => {
    expect(levelInfo(0).level).toBe(1)
    expect(levelInfo(120).level).toBe(3)
    expect(levelInfo(6000).rank.title).toBe('Navigator')
  })

  it('computes XP from sessions and claims – old stardust rewards count as XP', () => {
    const b = xpBreakdown(
      [session('2026-09-24', 9, 25), session('2026-09-24', 10, 12, { completed: false })],
      [{ id: 'c', challengeId: 'x', period: 'p', reward: 20, createdAt: 0, updatedAt: 0 }],
      [],
    )
    expect(b.focus).toBe(25 + 3 + 12)
    expect(b.total).toBe(25 + 3 + 12 + 20)
  })

  it('selects deterministic challenges and measures progress', () => {
    const sessions = [session('2026-09-24', 8, 50, { labelId: 'a' }), session('2026-09-24', 11, 25, { labelId: 'b' })]
    const ctx = buildContext(sessions, [], '2026-09-24', '2026-09-24', '2026-09-24', 60)
    const a = dailyChallenges('2026-09-24', ctx, [])
    const b = dailyChallenges('2026-09-24', ctx, [])
    expect(a.map((c) => c.key)).toEqual(b.map((c) => c.key))
    expect(a).toHaveLength(3)
    for (const c of a) expect(c.progress).toBeGreaterThanOrEqual(0)
  })
})
