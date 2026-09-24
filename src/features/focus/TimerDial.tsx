import type { ReactNode } from 'react'
import type { Phase } from '@/data/types'
import { phaseColor } from './phase'

const SIZE = 400
const C = SIZE / 2
const R = 168
const CIRC = 2 * Math.PI * R

/**
 * The dial: a fine clockwork ring whose progress head is a small star – the
 * lodestar you navigate by. During focus a soft glow gathers in the centre as
 * the session progresses.
 */
export function TimerDial({ progress, phase, running, phaseKey, children, idle }: { progress: number; phase: Phase; running: boolean; phaseKey: string; children: ReactNode; idle: boolean }) {
  const color = phaseColor(phase)
  const p = Math.max(0, Math.min(1, progress))
  const angle = p * 360
  const transition = running ? 'stroke-dashoffset 1s linear, transform 1s linear' : 'stroke-dashoffset 400ms ease, transform 400ms ease'
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  const passed = Math.floor(p * 60 + 1e-6)

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="dial-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="45%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <filter id="dial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The gathering light at the centre. */}
        <circle
          cx={C}
          cy={C}
          r={R - 12}
          fill="url(#dial-core)"
          style={{ opacity: phase === 'focus' ? 0.12 + p * 0.5 : 0.18, transition: 'opacity 1s linear' }}
        />

        {/* Minute ticks */}
        <g>
          {ticks.map((i) => {
            const major = i % 5 === 0
            const a = (i / 60) * 2 * Math.PI - Math.PI / 2
            const r1 = 186
            const r2 = major ? 196 : 192
            const lit = !idle && i < passed
            return (
              <line
                key={i}
                x1={C + r1 * Math.cos(a)}
                y1={C + r1 * Math.sin(a)}
                x2={C + r2 * Math.cos(a)}
                y2={C + r2 * Math.sin(a)}
                stroke={lit ? color : 'var(--ink-3)'}
                strokeOpacity={lit ? 0.9 : major ? 0.45 : 0.22}
                strokeWidth={major ? 2 : 1.2}
                strokeLinecap="round"
                style={{ transition: 'stroke 400ms, stroke-opacity 400ms' }}
              />
            )
          })}
        </g>

        {/* Track + progress */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
        <g key={phaseKey}>
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - p)}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ transition }}
          />
          {/* Progress head: a small four-point star */}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${C}px ${C}px`, transition }}>
            <g transform={`translate(${C} ${C - R})`} filter="url(#dial-glow)">
              <circle r={9} fill={color} opacity={0.18} />
              <path d="M0 -9 L1.8 -1.8 L9 0 L1.8 1.8 L0 9 L-1.8 1.8 L-9 0 L-1.8 -1.8 Z" fill={color} />
              <circle r={2.2} fill="var(--surface)" opacity={0.9} />
            </g>
          </g>
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/** Digits in fixed-width slots so nothing shifts as time changes. */
export function TimeDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {text.split('').map((ch, i) =>
        ch === ':' ? (
          <span key={i} className="inline-block w-[0.3em] -translate-y-[0.06em] text-center opacity-70">
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
