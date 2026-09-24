/**
 * The live timer: the pure engine + persistence + side effects.
 *
 * State is written to localStorage on every transition (synchronous, so it is
 * there instantly on the next launch) and reconciled against the wall clock
 * whenever the app wakes. Completed focus phases are written to IndexedDB as
 * sessions using the phase id, so a replayed effect can never double count.
 */
import { create } from 'zustand'
import { db } from '@/data/db'
import type { Phase, Session, TimerProfile } from '@/data/types'
import { playChime } from '@/audio/chimes'
import { unlockAudio } from '@/audio/context'
import { isNative } from '@/lib/platform'
import { formatDuration, MINUTE } from '@/lib/time'
import { haptics } from '@/services/haptics'
import { isHidden, onWake } from '@/services/lifecycle'
import {
  replaceScheduled,
  showNotification,
  TIMER_NOTIFICATION_BASE,
  TIMER_NOTIFICATION_SPAN,
  type ScheduledNotification,
} from '@/services/notifications'
import { toast } from '@/ui/toast'
import {
  adjustTarget,
  configFromProfile,
  configure,
  createTimer,
  endsAt,
  isTimerState,
  pause,
  projectSchedule,
  reconcile,
  reset,
  selectPhase,
  setContext,
  skip,
  start,
  stop,
  type TimerConfig,
  type TimerContext,
  type TimerEffect,
  type TimerState,
  type Transition,
} from './engine'

const STORAGE_KEY = 'lodestar.timer.v1'
/** Effects older than this happened while the app was asleep – report them quietly. */
const FRESH_MS = 15_000

export const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
}

interface Runtime {
  minSessionMs: number
  endSound: string
  endVolume: number
  notifications: boolean
  /** Human description of what is being studied, used in notifications. */
  contextTitle: string
}

const runtime: Runtime = {
  minSessionMs: MINUTE,
  endSound: 'bell',
  endVolume: 0.7,
  notifications: true,
  contextTitle: '',
}

export function configureTimerRuntime(patch: Partial<Runtime>) {
  const before = runtime.contextTitle
  Object.assign(runtime, patch)
  if (patch.contextTitle !== undefined && patch.contextTitle !== before) syncSchedule(useTimer.getState().timer)
}

export interface LastSession {
  id: string
  fresh: boolean
  at: number
}

interface TimerStore {
  timer: TimerState
  hydrated: boolean
  /** Most recent focus session recorded by the timer – drives the "how did it go?" card. */
  lastSession: LastSession | null
  start: () => void
  pause: () => void
  toggle: () => void
  stop: (opts?: { discard?: boolean }) => void
  skip: () => void
  reset: () => void
  adjust: (deltaMs: number) => void
  selectPhase: (phase: Phase) => void
  setContext: (patch: Partial<TimerContext>) => void
  applyProfile: (profile: TimerProfile) => void
  dismissLastSession: () => void
  reconcileNow: () => void
}

export const DEFAULT_CONFIG: TimerConfig = configFromProfile({
  mode: 'pomodoro',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
})

function load(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isTimerState(parsed)) return parsed
    }
  } catch {
    /* corrupted or unavailable storage */
  }
  return createTimer(DEFAULT_CONFIG)
}

function persist(state: TimerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

export const useTimer = create<TimerStore>((set, get) => {
  const run = (fn: (s: TimerState, now: number) => Transition) => {
    const now = Date.now()
    commit(fn(get().timer, now), now)
  }
  const runPure = (fn: (s: TimerState) => TimerState) => commit({ state: fn(get().timer), effects: [] }, Date.now())

  return {
    timer: typeof localStorage === 'undefined' ? createTimer(DEFAULT_CONFIG) : load(),
    hydrated: false,
    lastSession: null,
    start: () => {
      unlockAudio()
      haptics.press()
      run((s, now) => {
        const settled = reconcile(s, now, runtime.minSessionMs)
        const started = start(settled.state, now)
        return { state: started.state, effects: [...settled.effects, ...started.effects] }
      })
    },
    pause: () => {
      haptics.tap()
      run((s, now) => pause(s, now))
    },
    toggle: () => (get().timer.status === 'running' ? get().pause() : get().start()),
    stop: (opts) => {
      haptics.press()
      run((s, now) => stop(s, now, runtime.minSessionMs, opts))
    },
    skip: () => {
      haptics.tap()
      run((s, now) => skip(s, now, runtime.minSessionMs))
    },
    reset: () => runPure(reset),
    adjust: (deltaMs) => {
      haptics.tap()
      run((s, now) => adjustTarget(s, deltaMs, now))
    },
    selectPhase: (phase) => runPure((s) => selectPhase(s, phase)),
    setContext: (patch) => runPure((s) => setContext(s, patch)),
    applyProfile: (profile) => {
      const config = configFromProfile(profile)
      const cur = get().timer
      if (sameConfig(cur.config, config) && cur.context.profileId === profile.id) return
      runPure((s) => configure(s, config, profile.id))
    },
    dismissLastSession: () => set({ lastSession: null }),
    reconcileNow: () => run((s, now) => reconcile(s, now, runtime.minSessionMs)),
  }
})

function sameConfig(a: TimerConfig, b: TimerConfig) {
  return (
    a.mode === b.mode &&
    a.focusMs === b.focusMs &&
    a.shortBreakMs === b.shortBreakMs &&
    a.longBreakMs === b.longBreakMs &&
    a.longBreakEvery === b.longBreakEvery &&
    a.autoStartBreaks === b.autoStartBreaks &&
    a.autoStartFocus === b.autoStartFocus
  )
}

function commit(t: Transition, now: number) {
  const prev = useTimer.getState().timer
  if (t.state !== prev) {
    useTimer.setState({ timer: t.state })
    persist(t.state)
  }
  if (t.effects.length) void applyEffects(t.effects, now)
  if (t.state !== prev || t.effects.length) syncSchedule(t.state)
}

// ───────────────────────── effects ─────────────────────────

async function saveSession(draft: Extract<TimerEffect, { type: 'session' }>['session']): Promise<boolean> {
  const record: Session = { ...draft, rating: null, source: 'timer', createdAt: draft.endedAt, updatedAt: Date.now() }
  try {
    await db.sessions.add(record)
    return true
  } catch (err) {
    // ConstraintError → another tab (or a replay) already stored it. That's the point of stable ids.
    if ((err as { name?: string })?.name !== 'ConstraintError') console.error('[timer] failed to save session', err)
    return false
  }
}

async function applyEffects(effects: TimerEffect[], now: number) {
  let missedFocus = 0
  let missedSeconds = 0
  for (const effect of effects) {
    const fresh = now - (effect.type === 'session' ? effect.session.endedAt : effect.at) < FRESH_MS
    if (effect.type === 'session') {
      const saved = await saveSession(effect.session)
      if (!saved) continue
      if (fresh) useTimer.setState({ lastSession: { id: effect.session.id, fresh, at: effect.session.endedAt } })
      else {
        missedFocus += 1
        missedSeconds += effect.session.duration
      }
      window.dispatchEvent(new CustomEvent('lodestar:session', { detail: effect.session }))
    } else if (effect.type === 'phaseEnd' && fresh) {
      announcePhaseEnd(effect.phase, effect.next)
    }
  }
  if (missedFocus > 0) {
    toast({
      title: missedFocus === 1 ? 'Focus session completed' : `${missedFocus} focus sessions completed`,
      body: `${formatDuration(missedSeconds)} recorded while you were away.`,
      tone: 'success',
    })
  }
}

function describeNext(next: Phase, state = useTimer.getState().timer): string {
  if (next === 'focus') return state.status === 'running' ? 'Focus has started.' : 'Ready when you are.'
  const mins = Math.round((state.targetMs ?? 0) / MINUTE)
  return `Time for a ${mins}-minute ${next === 'longBreak' ? 'long ' : ''}break.`
}

function announcePhaseEnd(phase: Phase, next: Phase) {
  const title = phase === 'focus' ? 'Focus complete' : 'Break is over'
  const body = describeNext(next)
  playChime(runtime.endSound, runtime.endVolume, phase === 'focus' ? 'focusEnd' : 'breakEnd')
  haptics.phaseEnd()
  if (!isNative && runtime.notifications && isHidden()) {
    void showNotification(title, `${body}${runtime.contextTitle ? ` · ${runtime.contextTitle}` : ''}`, {
      tag: 'lodestar-timer',
      route: '#/focus',
      channel: 'timer',
    })
  }
}

// ───────────────────────── scheduling ─────────────────────────

let watchTimer: ReturnType<typeof setTimeout> | undefined
let preemptTimer: ReturnType<typeof setTimeout> | undefined
let nativeQueue: Promise<void> = Promise.resolve()
const MAX_DELAY = 2 ** 31 - 1

function notificationText(phase: Phase, next: Phase, s: TimerState) {
  const nextMins = Math.round(
    (next === 'focus' ? s.config.focusMs : next === 'longBreak' ? s.config.longBreakMs : s.config.shortBreakMs) / MINUTE,
  )
  if (phase === 'focus') {
    return {
      title: 'Focus complete ✦',
      body: `${runtime.contextTitle ? `${runtime.contextTitle} · ` : ''}Take a ${nextMins}-minute ${next === 'longBreak' ? 'long ' : ''}break.`,
    }
  }
  return { title: 'Break is over', body: 'Back to it – your next focus block is ready.' }
}

function syncSchedule(state: TimerState) {
  clearTimeout(watchTimer)
  clearTimeout(preemptTimer)
  const now = Date.now()
  const end = endsAt(state)
  if (end !== null) {
    // A single one-shot timeout at the exact end time. Even if it is throttled,
    // correctness does not depend on it: any wake event reconciles the state.
    watchTimer = setTimeout(() => useTimer.getState().reconcileNow(), Math.min(MAX_DELAY, Math.max(0, end - now + 25)))
    if (isNative) {
      // If the app is on screen when the phase ends, handle it in-app and withdraw
      // the OS notification so the user doesn't get a duplicate alert.
      preemptTimer = setTimeout(() => {
        if (!isHidden()) void replaceScheduled(TIMER_NOTIFICATION_BASE, 1, [])
      }, Math.min(MAX_DELAY, Math.max(0, end - now - 1500)))
    }
  }
  if (isNative) {
    const items: ScheduledNotification[] = runtime.notifications
      ? projectSchedule(state, now, 6).map((e, i) => ({
          id: TIMER_NOTIFICATION_BASE + i,
          at: e.at,
          channel: 'timer',
          route: '#/focus',
          ...notificationText(e.phase, e.next, state),
        }))
      : []
    nativeQueue = nativeQueue.then(() => replaceScheduled(TIMER_NOTIFICATION_BASE, TIMER_NOTIFICATION_SPAN, items))
  }
}

// ───────────────────────── boot ─────────────────────────

let booted = false

/** Reconcile persisted state, then keep it reconciled across wakes and tabs. */
export function bootTimer() {
  if (booted || typeof window === 'undefined') return
  booted = true
  useTimer.setState({ timer: load(), hydrated: true })
  useTimer.getState().reconcileNow()
  syncSchedule(useTimer.getState().timer)

  onWake(() => useTimer.getState().reconcileNow())

  // Another tab changed the timer – adopt its state (it already applied the effects).
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    try {
      const next: unknown = JSON.parse(e.newValue)
      if (isTimerState(next)) {
        useTimer.setState({ timer: next })
        syncSchedule(next)
      }
    } catch {
      /* ignore */
    }
  })
}
