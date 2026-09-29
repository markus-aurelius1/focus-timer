/**
 * Tars timer engine – a pure state machine.
 *
 * The timer is never driven by setInterval. Its state stores *timestamps*
 * (when the running segment began, how much time was banked before it) and
 * every read derives elapsed/remaining time from the wall clock. Any code path
 * that wakes the app – a render tick, a visibility change, an app resume, a
 * reload, another tab – calls `reconcile(state, now)`, which replays whatever
 * happened while nobody was watching: phases that ended are closed at the exact
 * moment they ended, sessions are emitted, and auto-started phases are chained.
 *
 * Functions return `{ state, effects }`. Effects (record a session, announce a
 * phase change) are applied by the store; they carry stable ids so applying one
 * twice (e.g. two tabs) is harmless.
 */
import type { Phase, TimerMode } from '@/data/types'
import { dayKey, MINUTE, HOUR } from '@/lib/time'

export interface TimerConfig {
  mode: TimerMode
  focusMs: number
  shortBreakMs: number
  longBreakMs: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}

export interface TimerContext {
  labelId: string | null
  taskId: string | null
  projectId: string | null
  profileId: string | null
  note: string
}

export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerState {
  v: 1
  status: TimerStatus
  phase: Phase
  config: TimerConfig
  /** Id of the current phase run – becomes the session id, making writes idempotent. */
  phaseId: string
  /** Wall clock time the current phase was first started (null while idle). */
  phaseStartedAt: number | null
  /** Start of the currently running segment (null unless running). */
  segmentStartedAt: number | null
  /** Time banked by earlier segments of this phase (pauses excluded). */
  accumulatedMs: number
  /** Length of this phase; null counts up (stopwatch). */
  targetMs: number | null
  /** Focus sessions completed since the last long break. */
  cycleCount: number
  pauseCount: number
  context: TimerContext
}

export interface SessionDraft {
  id: string
  mode: TimerMode
  startedAt: number
  endedAt: number
  duration: number
  plannedDuration: number | null
  completed: boolean
  date: string
  labelId: string | null
  taskId: string | null
  projectId: string | null
  profileId: string | null
  note: string
  pauseCount: number
}

export type TimerEffect =
  | { type: 'session'; session: SessionDraft }
  | { type: 'phaseEnd'; phase: Phase; next: Phase; at: number; autoStarted: boolean; completed: boolean }

export interface Transition {
  state: TimerState
  effects: TimerEffect[]
}

/** Stopwatch sessions are closed automatically at this length – protects stats from a forgotten timer. */
export const STOPWATCH_CAP_MS = 4 * HOUR
/** Suggested break after an open-ended session: one fifth of the focus time (Flowtime), clamped. */
export const flowBreakMs = (focusMs: number) => Math.min(30 * MINUTE, Math.max(3 * MINUTE, Math.round(focusMs / 5 / MINUTE) * MINUTE))

let idCounter = 0
/** Overridable id factory (tests use a deterministic one). */
export let makePhaseId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  idCounter += 1
  return `phase-${Date.now().toString(36)}-${idCounter}`
}
export function setPhaseIdFactory(fn: () => string) {
  makePhaseId = fn
}

export const EMPTY_CONTEXT: TimerContext = { labelId: null, taskId: null, projectId: null, profileId: null, note: '' }

export function createTimer(config: TimerConfig, context: TimerContext = EMPTY_CONTEXT): TimerState {
  return {
    v: 1,
    status: 'idle',
    phase: 'focus',
    config,
    phaseId: makePhaseId(),
    phaseStartedAt: null,
    segmentStartedAt: null,
    accumulatedMs: 0,
    targetMs: targetFor('focus', config),
    cycleCount: 0,
    pauseCount: 0,
    context,
  }
}

export function targetFor(phase: Phase, config: TimerConfig): number | null {
  if (phase === 'focus') return config.mode === 'stopwatch' ? null : config.focusMs
  if (phase === 'shortBreak') return config.shortBreakMs
  return config.longBreakMs
}

// ───────────────────────── reading ─────────────────────────

export function elapsedMs(s: TimerState, now: number): number {
  if (s.status !== 'running' || s.segmentStartedAt === null) return s.accumulatedMs
  // Clamp: if the system clock moves backwards never report negative progress.
  return s.accumulatedMs + Math.max(0, now - s.segmentStartedAt)
}

export function remainingMs(s: TimerState, now: number): number | null {
  if (s.targetMs === null) return null
  return Math.max(0, s.targetMs - elapsedMs(s, now))
}

/** 0..1 progress through the current phase (stopwatch: progress within the current hour). */
export function progress(s: TimerState, now: number): number {
  const e = elapsedMs(s, now)
  if (s.targetMs === null) return (e % HOUR) / HOUR
  if (s.targetMs <= 0) return 1
  return Math.min(1, e / s.targetMs)
}

/** Wall clock time the running phase will end, or null. */
export function endsAt(s: TimerState): number | null {
  if (s.status !== 'running' || s.segmentStartedAt === null) return null
  const limit = s.targetMs ?? (s.phase === 'focus' ? STOPWATCH_CAP_MS : null)
  if (limit === null) return null
  return s.segmentStartedAt + (limit - s.accumulatedMs)
}

export function nextPhaseAfter(s: TimerState): Phase {
  if (s.phase !== 'focus') return 'focus'
  if (s.config.mode === 'countdown') return 'focus'
  if (s.config.mode === 'stopwatch') return 'shortBreak'
  const every = s.config.longBreakEvery
  return every > 0 && (s.cycleCount + 1) % every === 0 ? 'longBreak' : 'shortBreak'
}

// ───────────────────────── transitions ─────────────────────────

const ok = (state: TimerState, effects: TimerEffect[] = []): Transition => ({ state, effects })

export function start(s: TimerState, now: number): Transition {
  if (s.status === 'running') return ok(s)
  if (s.status === 'paused') return resume(s, now)
  return ok({
    ...s,
    status: 'running',
    phaseStartedAt: now,
    segmentStartedAt: now,
    accumulatedMs: 0,
    pauseCount: 0,
  })
}

export function pause(s: TimerState, now: number): Transition {
  const settled = reconcile(s, now)
  const cur = settled.state
  if (cur.status !== 'running') return settled
  return {
    state: {
      ...cur,
      status: 'paused',
      accumulatedMs: elapsedMs(cur, now),
      segmentStartedAt: null,
      pauseCount: cur.pauseCount + 1,
    },
    effects: settled.effects,
  }
}

export function resume(s: TimerState, now: number): Transition {
  if (s.status !== 'paused') return ok(s)
  return ok({ ...s, status: 'running', segmentStartedAt: now })
}

export function toggle(s: TimerState, now: number): Transition {
  return s.status === 'running' ? pause(s, now) : start(s, now)
}

/** Add (or remove) time from the current phase. */
export function adjustTarget(s: TimerState, deltaMs: number, now: number): Transition {
  if (s.targetMs === null) return ok(s)
  const minTarget = Math.max(MINUTE, elapsedMs(s, now) + 5_000)
  const target = Math.max(minTarget, s.targetMs + deltaMs)
  return ok({ ...s, targetMs: s.status === 'idle' ? Math.max(MINUTE, s.targetMs + deltaMs) : target })
}

function sessionFrom(s: TimerState, endedAt: number, focusedMs: number, completed: boolean): SessionDraft {
  const startedAt = s.phaseStartedAt ?? endedAt - focusedMs
  return {
    id: s.phaseId,
    mode: s.config.mode,
    startedAt,
    endedAt,
    duration: Math.round(focusedMs / 1000),
    plannedDuration: s.targetMs === null ? null : Math.round(s.targetMs / 1000),
    completed,
    date: dayKey(startedAt),
    labelId: s.context.labelId,
    taskId: s.context.taskId,
    projectId: s.context.projectId,
    profileId: s.context.profileId,
    note: s.context.note,
    pauseCount: s.pauseCount,
  }
}

/** Move into `phase`, optionally auto-starting it at `at`. */
function enterPhase(s: TimerState, phase: Phase, at: number, autoStart: boolean, cycleCount: number, targetOverride?: number | null): TimerState {
  const target = targetOverride !== undefined ? targetOverride : targetFor(phase, s.config)
  return {
    ...s,
    status: autoStart ? 'running' : 'idle',
    phase,
    phaseId: makePhaseId(),
    phaseStartedAt: autoStart ? at : null,
    segmentStartedAt: autoStart ? at : null,
    accumulatedMs: 0,
    targetMs: target,
    cycleCount,
    pauseCount: 0,
    // A new focus block keeps the subject/task, but notes belong to a single session.
    context: phase === 'focus' ? { ...s.context, note: '' } : s.context,
  }
}

function shouldAutoStart(s: TimerState, next: Phase): boolean {
  if (s.config.mode === 'countdown') return false
  if (s.config.mode === 'stopwatch') return false
  return next === 'focus' ? s.config.autoStartFocus : s.config.autoStartBreaks
}

/** Close the current phase at time `at`. `natural` = it ran to its target. */
function finishPhase(s: TimerState, at: number, natural: boolean, minSessionMs: number): Transition {
  const effects: TimerEffect[] = []
  const focused = natural && s.targetMs !== null ? s.targetMs : Math.min(elapsedMs(s, at), s.targetMs ?? Infinity)
  let cycleCount = s.cycleCount
  let next: Phase = nextPhaseAfter(s)
  let breakOverride: number | null | undefined

  if (s.phase === 'focus') {
    const completed = natural || s.config.mode === 'stopwatch'
    if (focused >= minSessionMs || natural) {
      effects.push({ type: 'session', session: sessionFrom(s, at, focused, completed) })
    }
    cycleCount = next === 'longBreak' ? 0 : cycleCount + 1
    if (s.config.mode === 'stopwatch') breakOverride = flowBreakMs(focused)
  }

  const autoStarted = shouldAutoStart(s, next)
  const state = enterPhase(s, next, at, autoStarted, cycleCount, breakOverride)
  effects.push({ type: 'phaseEnd', phase: s.phase, next, at, autoStarted, completed: natural })
  return { state, effects }
}

/**
 * Replay time. Closes every phase whose end has passed, chaining auto-started
 * phases exactly as a foreground timer would have. Pure and idempotent.
 */
export function reconcile(s: TimerState, now: number, minSessionMs = MINUTE): Transition {
  let state = s
  const effects: TimerEffect[] = []
  for (let guard = 0; guard < 64; guard++) {
    const end = endsAt(state)
    if (end === null || now < end) break
    const natural = state.targetMs !== null
    const t = finishPhase(state, end, natural, minSessionMs)
    state = t.state
    effects.push(...t.effects)
  }
  return { state, effects }
}

/**
 * End the phase now. For focus this records the session (if long enough) and
 * moves to the following break; for a break it returns to focus.
 */
export function skip(s: TimerState, now: number, minSessionMs = MINUTE): Transition {
  const settled = reconcile(s, now, minSessionMs)
  const cur = settled.state
  if (cur.status === 'idle' && cur.phase === 'focus') return settled
  if (cur.status === 'idle') {
    // Skipping an idle break → straight to an idle focus.
    return { state: enterPhase(cur, 'focus', now, false, cur.cycleCount), effects: settled.effects }
  }
  const t = finishPhase(cur, now, false, minSessionMs)
  // A manual skip never auto-starts the next phase – the user is in control.
  const next = t.state.status === 'running' ? { ...t.state, status: 'idle' as const, phaseStartedAt: null, segmentStartedAt: null } : t.state
  const effects = t.effects.map((e) => (e.type === 'phaseEnd' ? { ...e, autoStarted: false } : e))
  return { state: next, effects: [...settled.effects, ...effects] }
}

/** Stop and return to an idle focus phase. A focus in progress is recorded if long enough. */
export function stop(s: TimerState, now: number, minSessionMs = MINUTE, opts: { discard?: boolean } = {}): Transition {
  const settled = reconcile(s, now, minSessionMs)
  const cur = settled.state
  const effects = [...settled.effects]
  if (cur.phase === 'focus' && cur.status !== 'idle' && !opts.discard) {
    const focused = elapsedMs(cur, now)
    if (focused >= minSessionMs) {
      const completed = cur.config.mode === 'stopwatch'
      effects.push({ type: 'session', session: sessionFrom(cur, now, focused, completed) })
    }
  }
  if (cur.config.mode === 'stopwatch' && cur.phase === 'focus' && cur.status !== 'idle' && !opts.discard) {
    // Offer a proportional break after open focus.
    const focused = elapsedMs(cur, now)
    if (focused >= minSessionMs) {
      const state = enterPhase(cur, 'shortBreak', now, false, cur.cycleCount, flowBreakMs(focused))
      effects.push({ type: 'phaseEnd', phase: 'focus', next: 'shortBreak', at: now, autoStarted: false, completed: true })
      return { state, effects }
    }
  }
  return { state: enterPhase(cur, 'focus', now, false, cur.cycleCount), effects }
}

/** Reset everything including the long-break cycle. Discards the running phase. */
export function reset(s: TimerState): TimerState {
  return { ...createTimer(s.config, { ...s.context, note: '' }) }
}

/** Apply a new configuration. Running phases keep going; idle ones pick up the new target. */
export function configure(s: TimerState, config: TimerConfig, profileId: string | null): TimerState {
  const context = { ...s.context, profileId }
  if (s.status === 'idle') {
    const modeChanged = config.mode !== s.config.mode
    const phase: Phase = modeChanged ? 'focus' : s.phase
    const next: TimerState = { ...s, config, context, phase, targetMs: targetFor(phase, config), cycleCount: modeChanged ? 0 : s.cycleCount }
    return next
  }
  return { ...s, config, context }
}

export function setContext(s: TimerState, patch: Partial<TimerContext>): TimerState {
  return { ...s, context: { ...s.context, ...patch } }
}

/** Jump to a specific phase (e.g. tapping "Long break"). Only allowed while idle. */
export function selectPhase(s: TimerState, phase: Phase): TimerState {
  if (s.status !== 'idle') return s
  return { ...s, phase, phaseId: makePhaseId(), targetMs: targetFor(phase, s.config) }
}

// ───────────────────────── schedule projection ─────────────────────────

export interface UpcomingEnd {
  phase: Phase
  next: Phase
  at: number
}

/**
 * Project future phase ends assuming nobody touches the timer. Used to
 * pre-schedule native notifications so they fire even if the app is killed.
 */
export function projectSchedule(s: TimerState, now: number, max = 6): UpcomingEnd[] {
  const out: UpcomingEnd[] = []
  let state = reconcile(s, now).state
  for (let i = 0; i < max; i++) {
    const end = endsAt(state)
    // Open-ended focus has no meaningful "end" to announce.
    if (end === null || state.targetMs === null) break
    const next = nextPhaseAfter(state)
    out.push({ phase: state.phase, next, at: end })
    state = finishPhase(state, end, state.targetMs !== null, 0).state
  }
  return out
}

export function configFromProfile(p: {
  mode: TimerMode
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}): TimerConfig {
  return {
    mode: p.mode,
    focusMs: Math.max(1, p.focusMinutes) * MINUTE,
    shortBreakMs: Math.max(1, p.shortBreakMinutes) * MINUTE,
    longBreakMs: Math.max(1, p.longBreakMinutes) * MINUTE,
    longBreakEvery: Math.max(0, Math.round(p.longBreakEvery)),
    autoStartBreaks: p.autoStartBreaks,
    autoStartFocus: p.autoStartFocus,
  }
}

/** Validate a persisted blob before trusting it. */
export function isTimerState(value: unknown): value is TimerState {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<TimerState>
  return (
    v.v === 1 &&
    (v.status === 'idle' || v.status === 'running' || v.status === 'paused') &&
    (v.phase === 'focus' || v.phase === 'shortBreak' || v.phase === 'longBreak') &&
    typeof v.accumulatedMs === 'number' &&
    typeof v.phaseId === 'string' &&
    !!v.config &&
    !!v.context
  )
}
