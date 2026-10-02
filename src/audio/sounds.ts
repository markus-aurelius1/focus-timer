/**
 * Procedural soundscapes.
 *
 * Every ambient sound is synthesised – no audio files, so they work offline and
 * add nothing to the download. Each one is rendered once into a seamless loop
 * with an OfflineAudioContext (a few hundred ms of CPU), then played as a looping
 * buffer. Playback therefore needs no JavaScript timers and keeps going when the
 * app is in the background.
 */
import { seededRandom } from '@/lib/random'
import { burst, chain, filter, flushGrains, gain, noiseBuffer, noiseSource, panner, seamGain, tone } from './dsp'
import { MORE_SOUNDS } from './sounds-more'

/** How a sound is made. Its name and category are in catalog.ts (kept apart so listing sounds never loads this file). */
export interface SoundDef {
  id: string
  /** Loop length in seconds. */
  duration: number
  /** Seconds of equal-power crossfade across the loop seam (default 1.5). */
  crossfade?: number
  /**
   * For sounds with a rhythm: instead of a crossfade, this many seconds are
   * rendered past the loop point and added onto the start, so whatever is still
   * ringing carries over. Events are scheduled within `loop` only, and anything
   * continuous uses `seamGain` (or stops at `loop` after a whole number of cycles).
   */
  fold?: number
  /** Output trim so sounds sit at similar loudness. */
  trim: number
  /** `loop` is the loop length in seconds; the context is longer by the crossfade or fold. */
  render: (ctx: OfflineAudioContext, out: AudioNode, rand: () => number, loop: number) => void
}


// ───────────────────────── sound definitions ─────────────────────────

export const SOUNDS: SoundDef[] = [
  {
    id: 'rain',
    duration: 12,
    trim: 1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const hiss = noiseSource(ctx, 'pink', D, rand)
      chain(hiss, filter(ctx, 'highpass', 450), filter(ctx, 'lowpass', 7500), gain(ctx, 0.55), out)
      hiss.start()
      const body = noiseSource(ctx, 'brown', D, rand)
      chain(body, filter(ctx, 'lowpass', 380), gain(ctx, 0.35), out)
      body.start()
      const drops = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.018 + rand() * 0.06) {
        burst(ctx, out, drops, t, {
          freq: 1800 + rand() * 5200,
          q: 1.5 + rand() * 6,
          gain: 0.06 + rand() * 0.26,
          decay: 0.008 + rand() * 0.03,
          pan: rand() * 2 - 1,
        })
      }
    },
  },
  {
    id: 'thunder',
    duration: 40,
    trim: 1.1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const bed = noiseSource(ctx, 'pink', D, rand)
      chain(bed, filter(ctx, 'highpass', 600), filter(ctx, 'lowpass', 5000), gain(ctx, 0.12), out)
      bed.start()
      const rolls = [4 + rand() * 6, 21 + rand() * 8]
      for (const at of rolls) {
        const src = noiseSource(ctx, 'brown', 12, rand)
        const lp = filter(ctx, 'lowpass', 140 + rand() * 90, 0.9)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(1.1, at + 0.25 + rand() * 0.5)
        g.gain.setTargetAtTime(0.5, at + 0.9, 0.6)
        g.gain.setTargetAtTime(0.0001, at + 2.2, 1.6 + rand())
        chain(src, lp, g, panner(ctx, rand() - 0.5), out)
        src.start(at)
        src.stop(at + 11)
      }
    },
  },
  {
    id: 'waves',
    duration: 24,
    trim: 1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const period = D / 3
      for (let layer = 0; layer < 2; layer++) {
        const src = noiseSource(ctx, layer ? 'brown' : 'pink', D, rand)
        const lp = filter(ctx, 'lowpass', 400, 0.6)
        const g = ctx.createGain()
        g.gain.value = 0.05
        const offset = layer * period * 0.45
        for (let w = -1; w < 4; w++) {
          const t0 = w * period + offset + rand() * 0.8
          const peak = t0 + period * (0.42 + rand() * 0.1)
          if (peak < 0 || t0 > D) continue
          g.gain.linearRampToValueAtTime(0.06, Math.max(0, t0))
          g.gain.linearRampToValueAtTime(layer ? 0.75 : 0.5, Math.max(0, peak))
          g.gain.linearRampToValueAtTime(0.08, Math.max(0, t0 + period))
          lp.frequency.linearRampToValueAtTime(320, Math.max(0, t0))
          lp.frequency.linearRampToValueAtTime(layer ? 900 : 2400, Math.max(0, peak))
          lp.frequency.linearRampToValueAtTime(350, Math.max(0, t0 + period))
        }
        chain(src, lp, g, panner(ctx, layer ? 0.25 : -0.25), out)
        src.start()
      }
    },
  },
  {
    id: 'wind',
    duration: 24,
    trim: 1.2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      for (let layer = 0; layer < 2; layer++) {
        const src = noiseSource(ctx, 'pink', D, rand)
        const bp = filter(ctx, 'bandpass', 500, 0.9 + layer * 0.8)
        const g = ctx.createGain()
        g.gain.value = 0.3
        for (let t = 0; t <= D; t += 1.5 + rand() * 2.5) {
          bp.frequency.linearRampToValueAtTime(260 + rand() * (layer ? 1200 : 700), t)
          g.gain.linearRampToValueAtTime(0.18 + rand() * 0.6, t)
        }
        chain(src, bp, g, panner(ctx, layer ? 0.4 : -0.4), out)
        src.start()
      }
    },
  },
  {
    id: 'stream',
    duration: 16,
    trim: 1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const src = noiseSource(ctx, 'white', D, rand)
      chain(src, filter(ctx, 'bandpass', 2600, 0.6), filter(ctx, 'lowpass', 6000), gain(ctx, 0.22), out)
      src.start()
      const low = noiseSource(ctx, 'brown', D, rand)
      chain(low, filter(ctx, 'lowpass', 500), gain(ctx, 0.3), out)
      low.start()
      // Bubbles: short upward sine chirps.
      for (let t = 0; t < D; t += 0.015 + rand() * 0.07) {
        const f = 350 + rand() * 1100
        tone(ctx, out, t, { from: f, to: f * (1.4 + rand() * 0.8), dur: 0.02 + rand() * 0.05, gain: 0.02 + rand() * 0.05, pan: rand() * 1.6 - 0.8 })
      }
    },
  },
  {
    id: 'fire',
    duration: 18,
    trim: 1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const roar = noiseSource(ctx, 'brown', D, rand)
      const lp = filter(ctx, 'lowpass', 520, 0.8)
      const g = ctx.createGain()
      g.gain.value = 0.55
      for (let t = 0; t <= D; t += 0.6 + rand()) g.gain.linearRampToValueAtTime(0.4 + rand() * 0.3, t)
      chain(roar, lp, g, out)
      roar.start()
      const hiss = noiseSource(ctx, 'white', D, rand)
      chain(hiss, filter(ctx, 'highpass', 3000), gain(ctx, 0.018), out)
      hiss.start()
      const clicks = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.04 + rand() * 0.35) {
        const cluster = rand() < 0.2 ? 3 + Math.floor(rand() * 5) : 1
        for (let k = 0; k < cluster; k++) {
          burst(ctx, out, clicks, t + k * (0.01 + rand() * 0.03), {
            freq: 900 + rand() * 4000,
            q: 0.8 + rand() * 3,
            gain: 0.12 + rand() * 0.5,
            decay: 0.003 + rand() * 0.02,
            pan: rand() * 1.2 - 0.6,
            type: rand() < 0.5 ? 'bandpass' : 'highpass',
          })
        }
      }
    },
  },
  {
    id: 'birds',
    duration: 30,
    trim: 3.2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const air = noiseSource(ctx, 'pink', D, rand)
      chain(air, filter(ctx, 'bandpass', 1200, 0.4), gain(ctx, 0.05), out)
      air.start()
      const species = Array.from({ length: 4 }, () => ({
        base: 2200 + rand() * 2600,
        notes: 2 + Math.floor(rand() * 5),
        gap: 0.06 + rand() * 0.1,
        dur: 0.05 + rand() * 0.1,
        pan: rand() * 1.6 - 0.8,
        gain: 0.03 + rand() * 0.05,
      }))
      for (let t = 0.3; t < D - 1.5; t += 0.9 + rand() * 2.4) {
        const s = species[Math.floor(rand() * species.length)]
        for (let n = 0; n < s.notes; n++) {
          const f = s.base * (0.85 + rand() * 0.35)
          const up = rand() < 0.5
          tone(ctx, out, t + n * (s.dur + s.gap), { from: f, to: f * (up ? 1.35 : 0.7), dur: s.dur, gain: s.gain, pan: s.pan })
        }
      }
    },
  },
  {
    id: 'night',
    duration: 12,
    trim: 1.4,
    fold: 2,
    render(ctx, out, rand, D) {
      const bed = noiseSource(ctx, 'brown', D + 2, rand)
      chain(bed, filter(ctx, 'lowpass', 300), seamGain(ctx, 0.2, D, 2), out)
      bed.start()
      const crickets = Array.from({ length: 3 }, (_, i) => ({ f: 4200 + i * 380 + rand() * 200, every: 0.7 + rand() * 0.6, pulses: 3 + Math.floor(rand() * 2), pan: (i - 1) * 0.6, g: 0.02 + rand() * 0.02 }))
      for (const c of crickets) {
        // Choose an interval that divides the loop length so the rhythm loops seamlessly.
        const every = D / Math.round(D / c.every)
        for (let t = rand() * every; t < D; t += every) {
          for (let p = 0; p < c.pulses; p++) tone(ctx, out, t + p * 0.035, { from: c.f, to: c.f * 1.01, dur: 0.025, gain: c.g, pan: c.pan })
        }
      }
    },
  },
  {
    id: 'cafe',
    duration: 24,
    trim: 1.1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const room = noiseSource(ctx, 'brown', D, rand)
      chain(room, filter(ctx, 'lowpass', 250), gain(ctx, 0.35), out)
      room.start()
      // Voices: formant-filtered noise with syllable-rate envelopes.
      for (let v = 0; v < 6; v++) {
        const src = noiseSource(ctx, 'pink', D, rand)
        const f1 = filter(ctx, 'bandpass', 400 + rand() * 500, 3)
        const f2 = filter(ctx, 'bandpass', 1100 + rand() * 1200, 4)
        const mix = ctx.createGain()
        mix.gain.value = 0
        src.connect(f1).connect(mix)
        src.connect(f2).connect(mix)
        let t = rand() * 2
        while (t < D) {
          const phrase = 1 + rand() * 3
          for (let s = t; s < Math.min(D, t + phrase); s += 0.12 + rand() * 0.14) {
            mix.gain.linearRampToValueAtTime(0.25 + rand() * 0.45, s)
            mix.gain.linearRampToValueAtTime(0.05, s + 0.08)
            f1.frequency.linearRampToValueAtTime(350 + rand() * 600, s)
          }
          t += phrase + 0.5 + rand() * 2.5
          mix.gain.linearRampToValueAtTime(0, Math.min(D, t - 0.3))
        }
        chain(mix, gain(ctx, 0.35), filter(ctx, 'lowpass', 2600), panner(ctx, rand() * 1.4 - 0.7), out)
        src.start()
      }
      // Cups and spoons.
      for (let t = 1 + rand() * 3; t < D - 1; t += 2.5 + rand() * 5) {
        const f = 2400 + rand() * 1800
        for (const [ratio, g] of [[1, 0.05], [2.7, 0.02], [5.1, 0.01]] as const) {
          tone(ctx, out, t, { from: f * ratio, to: f * ratio * 0.998, dur: 0.35 + rand() * 0.4, gain: g, pan: rand() * 1.4 - 0.7 })
        }
      }
    },
  },
  {
    id: 'clock',
    duration: 8,
    crossfade: 0,
    trim: 6,
    render(ctx, out, rand) {
      const click = noiseBuffer(ctx, 'white', 0.5, rand)
      for (let i = 0; i < 8; i++) {
        burst(ctx, out, click, i + 0.02, { freq: i % 2 ? 2400 : 2900, q: 9, gain: 0.5, decay: 0.035, pan: 0 })
        burst(ctx, out, click, i + 0.025, { freq: 900, q: 5, gain: 0.25, decay: 0.05, pan: 0 })
      }
    },
  },
  {
    id: 'white',
    duration: 10,
    trim: 0.45,
    render(ctx, out, rand) {
      const src = noiseSource(ctx, 'white', ctx.length / ctx.sampleRate, rand)
      chain(src, filter(ctx, 'lowpass', 11000), out)
      src.start()
    },
  },
  {
    id: 'pink',
    duration: 10,
    trim: 0.8,
    render(ctx, out, rand) {
      const src = noiseSource(ctx, 'pink', ctx.length / ctx.sampleRate, rand)
      src.connect(out)
      src.start()
    },
  },
  {
    id: 'brown',
    duration: 10,
    trim: 0.9,
    render(ctx, out, rand) {
      const src = noiseSource(ctx, 'brown', ctx.length / ctx.sampleRate, rand)
      chain(src, filter(ctx, 'lowpass', 900), out)
      src.start()
    },
  },
  {
    id: 'drone',
    duration: 20,
    trim: 0.7,
    render(ctx, out) {
      // A warm pad with a gentle 10 Hz binaural offset between the ears (headphones).
      const voices: Array<[number, number, number]> = [
        [110, -1, 0.22],
        [120, 1, 0.22],
        [164.81, -0.4, 0.12],
        [220, 0.4, 0.08],
        [329.63, 0, 0.04],
      ]
      const lp = filter(ctx, 'lowpass', 900, 0.5)
      lp.connect(out)
      for (const [f, pan, g] of voices) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        const vg = ctx.createGain()
        vg.gain.value = g
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.1
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = g * 0.3
        lfo.connect(lfoGain).connect(vg.gain)
        chain(osc, vg, panner(ctx, pan), lp)
        osc.start()
        lfo.start()
      }
    },
  },
  ...MORE_SOUNDS,
]

export const SOUND_BY_ID = new Map(SOUNDS.map((s) => [s.id, s]))

const cache = new Map<string, Promise<AudioBuffer>>()

/** Render (once) a seamless loop for a sound. */
export function renderSound(id: string, sampleRate: number): Promise<AudioBuffer> {
  const key = `${id}@${sampleRate}`
  const hit = cache.get(key)
  if (hit) return hit
  const def = SOUND_BY_ID.get(id)
  if (!def) return Promise.reject(new Error(`Unknown sound ${id}`))
  const p = (async () => {
    const xf = def.fold ?? def.crossfade ?? 1.5
    const total = Math.ceil((def.duration + xf) * sampleRate)
    const ctx = new OfflineAudioContext(2, total, sampleRate)
    const out = ctx.createGain()
    out.gain.value = def.trim
    // Soft limiter keeps layered sounds from clipping.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 4
    out.connect(comp).connect(ctx.destination)
    def.render(ctx, out, seededRandom(`sound:${id}`), def.duration)
    flushGrains(ctx)
    const rendered = await ctx.startRendering()
    if (xf <= 0) return rendered
    if (def.fold) {
      const len = Math.floor(def.duration * sampleRate)
      const loop = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate })
      for (let ch = 0; ch < 2; ch++) {
        const src = rendered.getChannelData(ch)
        const dst = loop.getChannelData(ch)
        dst.set(src.subarray(0, len))
        for (let i = len; i < src.length; i++) dst[i - len] += src[i]
      }
      return loop
    }
    // Fold the tail over the head with an equal-power crossfade → no audible seam.
    const len = Math.floor(def.duration * sampleRate)
    const fade = Math.floor(xf * sampleRate)
    const loop = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate })
    for (let ch = 0; ch < 2; ch++) {
      const src = rendered.getChannelData(ch)
      const dst = loop.getChannelData(ch)
      dst.set(src.subarray(0, len))
      for (let i = 0; i < fade; i++) {
        const t = i / fade
        dst[i] = src[i] * Math.sin((t * Math.PI) / 2) + src[len + i] * Math.cos((t * Math.PI) / 2)
      }
    }
    return loop
  })()
  cache.set(key, p)
  p.catch(() => cache.delete(key))
  return p
}

/** Release a rendered loop (several megabytes each) once its layer is gone. */
export function forgetSound(id: string) {
  for (const key of [...cache.keys()]) if (key.startsWith(`${id}@`)) cache.delete(key)
}
