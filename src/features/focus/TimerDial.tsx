import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Phase } from '@/data/types'
import { progress as progressAt, type TimerState } from '@/timer/engine'
import { useTimer } from '@/timer/store'
import { EASE_OUT } from '@/ui/motion'
import { phaseColor } from './phase'

const SIZE = 400
const C = SIZE / 2
const R = 168
const CIRC = 2 * Math.PI * R
/** How long a settling ring (reset, phase change, pause) glides to its new value. */
const GLIDE_MS = 520

export type DialState = 'idle' | 'running' | 'paused'

/**
 * The dial: a fine clockwork ring around the time. While a timer runs, the
 * progress arc and its head move continuously (driven by requestAnimationFrame
 * and written straight to the SVG – no React render per frame); paused, the arc
 * greys and the head's halo stills; idle, only the track and ticks remain.
 * When a focus phase completes the ring blooms once.
 */
export function TimerDial({ timer, children }: { timer: TimerState; children: ReactNode }) {
  const phase = timer.phase
  const state: DialState = timer.status
  const color = phaseColor(phase)
  const arc = useRef<SVGCircleElement>(null)
  const head = useRef<SVGGElement>(null)
  const glow = useRef<SVGCircleElement>(null)
  const [lit, setLit] = useState(0)
  const litRef = useRef(0)
  const bloom = useBloom(phase)

  useSmoothProgress(timer, (p) => {
    arc.current?.setAttribute('stroke-dashoffset', String(CIRC * (1 - p)))
    head.current?.setAttribute('transform', `rotate(${p * 360} ${C} ${C})`)
    if (glow.current) glow.current.style.opacity = String(phase === 'focus' && state !== 'idle' ? 0.05 + p * 0.2 : 0)
    // Ticks light at most once a second or so – only re-render when one changes.
    const n = state === 'idle' ? 0 : Math.floor(p * 60 + 1e-6)
    if (n !== litRef.current) {
      litRef.current = n
      setLit(n)
    }
  })

  return (
    <div className="dial relative aspect-square w-full" data-state={state} data-phase={phase}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="dial-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="50%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The light that gathers in the centre as a focus session goes on. */}
        <circle ref={glow} cx={C} cy={C} r={R - 12} fill="url(#dial-core)" style={{ opacity: 0, transition: 'opacity 900ms linear' }} />

        {/* Minute ticks: lit as the session passes them. */}
        <g>
          {Array.from({ length: 60 }, (_, i) => {
            const major = i % 5 === 0
            const a = (i / 60) * 2 * Math.PI - Math.PI / 2
            const r1 = 186
            const r2 = major ? 196 : 192
            const on = i < lit
            return (
              <line
                key={i}
                x1={C + r1 * Math.cos(a)}
                y1={C + r1 * Math.sin(a)}
                x2={C + r2 * Math.cos(a)}
                y2={C + r2 * Math.sin(a)}
                stroke={on ? color : 'var(--ink-3)'}
                strokeOpacity={on ? (state === 'paused' ? 0.45 : 0.9) : major ? 0.42 : 0.2}
                strokeWidth={major ? 2 : 1.2}
                strokeLinecap="round"
                style={{ transition: 'stroke 500ms, stroke-opacity 500ms' }}
              />
            )
          })}
        </g>

        {/* Track + progress */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
        <circle
          ref={arc}
          className="dial-arc"
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
          transform={`rotate(-90 ${C} ${C})`}
        />
        {/* The head: a small four-point star riding the ring, with a breathing halo while running. */}
        <g ref={head} className="dial-head">
          <g transform={`translate(${C} ${C - R})`}>
            <circle className="dial-halo" r={14} fill={color} />
            <circle r={9.5} fill={color} opacity={0.16} />
            <path d="M0 -9 L1.8 -1.8 L9 0 L1.8 1.8 L0 9 L-1.8 1.8 L-9 0 L-1.8 -1.8 Z" fill={color} />
            <circle r={2.1} fill="var(--surface)" opacity={0.9} />
          </g>
        </g>

        {/* Completion bloom. */}
        <AnimatePresence>
          {bloom && (
            <motion.circle
              key={bloom.at}
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke={phaseColor(bloom.phase)}
              initial={{ opacity: 0.9, strokeWidth: 5, scale: 1 }}
              animate={{ opacity: 0, strokeWidth: 1, scale: 1.14, transition: { duration: 1.4, ease: EASE_OUT } }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {bloom ? (
            <motion.div
              key="done"
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.32, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.24 } }}
              role="status"
            >
              <span className="flex size-14 items-center justify-center rounded-full text-white shadow-lift" style={{ background: phaseColor(bloom.phase) }}>
                <Check className="size-7" strokeWidth={3} />
              </span>
              <span className="mt-3 font-display text-2xl font-medium tracking-tight">{bloom.phase === 'focus' ? 'Focus complete' : 'Break’s over'}</span>
              <span className="mt-1 text-[13px] font-semibold text-ink-2">{bloom.phase === 'focus' ? 'Nicely done.' : 'Ready when you are.'}</span>
            </motion.div>
          ) : (
            <motion.div key="time" className="flex w-full flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Feed `apply` the dial's progress: every frame while running, and a short
 * eased glide whenever it jumps (pause→reset, a new phase, adding time).
 */
export function useSmoothProgress(timer: TimerState, apply: (p: number) => void) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  const shown = useRef<number | null>(null)
  const running = timer.status === 'running'

  useLayoutEffect(() => {
    const target = () => (timer.status === 'idle' ? 0 : progressAt(timer, Date.now()))
    let frame = 0
    let glideFrom = shown.current ?? target()
    let glideStart = performance.now()
    const step = () => {
      const t = target()
      const k = Math.min(1, (performance.now() - glideStart) / GLIDE_MS)
      const eased = 1 - Math.pow(1 - k, 3)
      // Glide towards the target; a running timer's target keeps moving underneath.
      const p = k >= 1 ? t : glideFrom + (t - glideFrom) * eased
      shown.current = p
      applyRef.current(p)
      if (running || k < 1) frame = requestAnimationFrame(step)
    }
    // Big jumps glide; a running timer continuing from where it is doesn't need to.
    if (shown.current === null || Math.abs(target() - (shown.current ?? 0)) < 0.002) glideStart = -Infinity
    else glideFrom = shown.current
    step()
    return () => cancelAnimationFrame(frame)
  }, [timer, running])
}

/** The completion moment: shown for a few seconds after a phase completes. */
function useBloom(phase: Phase) {
  const ended = useTimer((s) => s.phaseEnded)
  const [bloom, setBloom] = useState<{ phase: Phase; at: number } | null>(null)
  useEffect(() => {
    if (!ended || !ended.completed || Date.now() - ended.at > 4000) return
    setBloom({ phase: ended.phase, at: ended.at })
    const t = setTimeout(() => setBloom(null), 2600)
    return () => clearTimeout(t)
  }, [ended])
  // Starting the next phase ends the moment early.
  useEffect(() => {
    if (bloom && phase !== bloom.phase && useTimer.getState().timer.status === 'running') {
      const t = setTimeout(() => setBloom(null), 1200)
      return () => clearTimeout(t)
    }
  }, [phase, bloom])
  return bloom
}

/** Digits in fixed-width slots so nothing shifts as time changes. */
export function TimeDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {text.split('').map((ch, i) =>
        ch === ':' ? (
          <span key={i} className="inline-block w-[0.3em] -translate-y-[0.06em] text-center opacity-60">
            :
          </span>
        ) : (
          <span key={i} className="inline-block w-[0.62em] text-center">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
