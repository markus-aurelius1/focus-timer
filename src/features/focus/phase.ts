import type { Phase } from '@/data/types'

export const phaseColor = (phase: Phase) =>
  phase === 'focus' ? 'var(--phase-focus)' : phase === 'longBreak' ? 'var(--phase-long)' : 'var(--phase-break)'
