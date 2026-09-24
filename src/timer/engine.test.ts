import { beforeEach, describe, expect, it } from 'vitest'
import {
  adjustTarget,
  configFromProfile,
  createTimer,
  elapsedMs,
  endsAt,
  isTimerState,
  pause,
  projectSchedule,
  reconcile,
  remainingMs,
  resume,
  setPhaseIdFactory,
  skip,
  start,
  stop,
  STOPWATCH_CAP_MS,
  type TimerConfig,
  type TimerEffect,
} from './engine'

const MIN = 60_000
const T0 = new Date(2026, 8, 24, 9, 0, 0).getTime()

const pomodoro: TimerConfig = configFromProfile({
  mode: 'pomodoro',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
})

const sessions = (effects: TimerEffect[]) => effects.flatMap((e) => (e.type === 'session' ? [e.session] : []))

beforeEach(() => {
  let n = 0
  setPhaseIdFactory(() => `p${++n}`)
})

describe('timer engine', () => {
  it('derives time from timestamps, not ticks', () => {
    const s = start(createTimer(pomodoro), T0).state
    expect(remainingMs(s, T0)).toBe(25 * MIN)
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(endsAt(s)).toBe(T0 + 25 * MIN)
  })

  it('excludes paused time', () => {
    let s = start(createTimer(pomodoro), T0).state
    s = pause(s, T0 + 5 * MIN).state
    // Paused for an hour – nothing moves.
    expect(elapsedMs(s, T0 + 65 * MIN)).toBe(5 * MIN)
    s = resume(s, T0 + 65 * MIN).state
    expect(remainingMs(s, T0 + 70 * MIN)).toBe(15 * MIN)
    expect(s.pauseCount).toBe(1)
  })

  it('closes a phase at the exact moment it ended when the device wakes late', () => {
    const s = start(createTimer(pomodoro), T0).state
    // Phone slept – we only get to run code 40 minutes later.
    const r = reconcile(s, T0 + 40 * MIN)
    const [session] = sessions(r.effects)
    expect(session.startedAt).toBe(T0)
    expect(session.endedAt).toBe(T0 + 25 * MIN)
    expect(session.duration).toBe(25 * 60)
    expect(session.completed).toBe(true)
    // Break auto-started at T0+25 and is now 15 minutes in, i.e. already finished (5 min break).
    expect(r.state.phase).toBe('focus')
    expect(r.state.status).toBe('idle') // autoStartFocus is off
    const ends = r.effects.filter((e) => e.type === 'phaseEnd')
    expect(ends.map((e) => (e.type === 'phaseEnd' ? e.at : 0))).toEqual([T0 + 25 * MIN, T0 + 30 * MIN])
  })

  it('chains auto-started phases through a long sleep and inserts long breaks', () => {
    const cfg = { ...pomodoro, autoStartFocus: true }
    const s = start(createTimer(cfg), T0).state
    // 4 × (25 + 5) minus the last short break which is a long break instead.
    const r = reconcile(s, T0 + 4 * 25 * MIN + 3 * 5 * MIN + 1)
    expect(sessions(r.effects)).toHaveLength(4)
    expect(r.state.phase).toBe('longBreak')
    expect(r.state.status).toBe('running')
    expect(r.state.cycleCount).toBe(0)
  })

  it('is idempotent – reconciling twice emits nothing new', () => {
    const s = start(createTimer(pomodoro), T0).state
    const once = reconcile(s, T0 + 26 * MIN)
    const twice = reconcile(once.state, T0 + 26 * MIN)
    expect(twice.effects).toHaveLength(0)
    expect(twice.state).toEqual(once.state)
  })

  it('uses the phase id as the session id so duplicate writes collapse', () => {
    const s = start(createTimer(pomodoro), T0).state
    const [a] = sessions(reconcile(s, T0 + 26 * MIN).effects)
    const [b] = sessions(reconcile(s, T0 + 27 * MIN).effects)
    expect(a.id).toBe(b.id)
  })

  it('never reports negative progress when the clock goes backwards', () => {
    const s = start(createTimer(pomodoro), T0).state
    expect(elapsedMs(s, T0 - 10 * MIN)).toBe(0)
    expect(reconcile(s, T0 - 10 * MIN).effects).toHaveLength(0)
  })

  it('records an interrupted session on stop only when long enough', () => {
    let s = start(createTimer(pomodoro), T0).state
    expect(sessions(stop(s, T0 + 30_000).effects)).toHaveLength(0)
    s = start(createTimer(pomodoro), T0).state
    const r = stop(s, T0 + 12 * MIN)
    const [session] = sessions(r.effects)
    expect(session.duration).toBe(12 * 60)
    expect(session.completed).toBe(false)
    expect(r.state.status).toBe('idle')
    expect(r.state.phase).toBe('focus')
  })

  it('skipping focus records progress and moves to a break without auto-starting', () => {
    const s = start(createTimer(pomodoro), T0).state
    const r = skip(s, T0 + 20 * MIN)
    expect(sessions(r.effects)[0].duration).toBe(20 * 60)
    expect(r.state.phase).toBe('shortBreak')
    expect(r.state.status).toBe('idle')
  })

  it('stopwatch counts up, offers a proportional break, and caps forgotten sessions', () => {
    const cfg = configFromProfile({ mode: 'stopwatch', focusMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 0, autoStartBreaks: false, autoStartFocus: false })
    let s = start(createTimer(cfg), T0).state
    expect(remainingMs(s, T0 + MIN)).toBeNull()
    const r = stop(s, T0 + 50 * MIN)
    expect(sessions(r.effects)[0]).toMatchObject({ duration: 50 * 60, completed: true, plannedDuration: null })
    expect(r.state.phase).toBe('shortBreak')
    expect(r.state.targetMs).toBe(10 * MIN)

    s = start(createTimer(cfg), T0).state
    const capped = reconcile(s, T0 + 9 * 60 * MIN)
    expect(sessions(capped.effects)[0].duration).toBe(STOPWATCH_CAP_MS / 1000)
  })

  it('countdown runs once and returns to idle focus', () => {
    const cfg = configFromProfile({ mode: 'countdown', focusMinutes: 45, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 0, autoStartBreaks: true, autoStartFocus: true })
    const r = reconcile(start(createTimer(cfg), T0).state, T0 + 3 * 60 * MIN)
    expect(sessions(r.effects)).toHaveLength(1)
    expect(r.state).toMatchObject({ phase: 'focus', status: 'idle' })
  })

  it('extends and shortens the running phase safely', () => {
    let s = start(createTimer(pomodoro), T0).state
    s = adjustTarget(s, 5 * MIN, T0 + MIN).state
    expect(s.targetMs).toBe(30 * MIN)
    s = adjustTarget(s, -60 * MIN, T0 + 10 * MIN).state
    expect(s.targetMs).toBeGreaterThan(10 * MIN)
  })

  it('projects upcoming phase ends for notification scheduling', () => {
    const s = start(createTimer({ ...pomodoro, autoStartFocus: true }), T0).state
    const ends = projectSchedule(s, T0, 3)
    expect(ends.map((e) => e.at)).toEqual([T0 + 25 * MIN, T0 + 30 * MIN, T0 + 55 * MIN])
    expect(ends[0]).toMatchObject({ phase: 'focus', next: 'shortBreak' })
  })

  it('validates persisted state', () => {
    expect(isTimerState(createTimer(pomodoro))).toBe(true)
    expect(isTimerState({ v: 2 })).toBe(false)
    expect(isTimerState(null)).toBe(false)
  })
})
