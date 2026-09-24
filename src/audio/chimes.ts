/**
 * End-of-phase chimes, synthesised with Web Audio so they work offline and
 * weigh nothing. Each is a handful of decaying partials – bells, bowls, marimba.
 */
import { getAudioContext } from './context'

export interface ChimeDef {
  id: string
  name: string
}

export const CHIMES: ChimeDef[] = [
  { id: 'bell', name: 'Observatory bell' },
  { id: 'bowl', name: 'Singing bowl' },
  { id: 'marimba', name: 'Marimba' },
  { id: 'glass', name: 'Glass' },
  { id: 'soft', name: 'Soft pulse' },
  { id: 'none', name: 'Silent' },
]

interface Partial {
  ratio: number
  gain: number
  decay: number
}

function strike(ctx: AudioContext, out: AudioNode, at: number, freq: number, partials: Partial[], attack = 0.004) {
  for (const p of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * p.ratio
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(p.gain, at + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, at + p.decay)
    osc.connect(g).connect(out)
    osc.start(at)
    osc.stop(at + p.decay + 0.05)
  }
}

const BELL: Partial[] = [
  { ratio: 1, gain: 0.5, decay: 3.2 },
  { ratio: 2.0, gain: 0.22, decay: 2.4 },
  { ratio: 2.76, gain: 0.18, decay: 1.8 },
  { ratio: 5.4, gain: 0.08, decay: 0.9 },
  { ratio: 8.93, gain: 0.04, decay: 0.5 },
]
const BOWL: Partial[] = [
  { ratio: 1, gain: 0.45, decay: 6 },
  { ratio: 2.71, gain: 0.2, decay: 4.5 },
  { ratio: 5.15, gain: 0.08, decay: 3 },
]
const MARIMBA: Partial[] = [
  { ratio: 1, gain: 0.55, decay: 0.9 },
  { ratio: 4, gain: 0.12, decay: 0.3 },
  { ratio: 9.2, gain: 0.04, decay: 0.12 },
]
const GLASS: Partial[] = [
  { ratio: 1, gain: 0.35, decay: 2.2 },
  { ratio: 2.32, gain: 0.2, decay: 1.6 },
  { ratio: 4.25, gain: 0.12, decay: 1.1 },
  { ratio: 6.63, gain: 0.06, decay: 0.7 },
]

/** Play a chime. `kind` hints whether focus or a break just ended (different motifs). */
export function playChime(id: string, volume = 0.7, kind: 'focusEnd' | 'breakEnd' | 'preview' = 'preview'): void {
  if (id === 'none' || volume <= 0) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  const out = ctx.createGain()
  out.gain.value = Math.min(1, volume) * 0.8
  out.connect(ctx.destination)
  const t = ctx.currentTime + 0.05
  // Rising motif when focus ends (reward), falling when a break ends (back to work).
  const up = kind !== 'breakEnd'
  switch (id) {
    case 'bowl':
      strike(ctx, out, t, 220, BOWL, 0.02)
      break
    case 'marimba': {
      const notes = up ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25]
      notes.forEach((f, i) => strike(ctx, out, t + i * 0.16, f, MARIMBA))
      break
    }
    case 'glass': {
      const notes = up ? [1046.5, 1318.5] : [1318.5, 1046.5]
      notes.forEach((f, i) => strike(ctx, out, t + i * 0.28, f, GLASS))
      break
    }
    case 'soft': {
      const f = up ? 440 : 330
      ;[0, 0.35, 0.7].forEach((d) => strike(ctx, out, t + d, f, [{ ratio: 1, gain: 0.35, decay: 0.45 }], 0.03))
      break
    }
    case 'bell':
    default: {
      const notes = up ? [587.33, 880] : [880, 587.33]
      notes.forEach((f, i) => strike(ctx, out, t + i * 0.42, f, BELL))
    }
  }
}
