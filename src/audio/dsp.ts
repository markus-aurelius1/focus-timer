/**
 * Building blocks for procedural audio: noise, filters, gain, panning and short
 * bursts and tones. Shared by the ambient sounds (sounds.ts, sounds-more.ts) and
 * the study music (music.ts). Everything works in an OfflineAudioContext, where
 * the loops are rendered once, off the main thread.
 */

export function noiseBuffer(ctx: BaseAudioContext, kind: 'white' | 'pink' | 'brown', seconds: number, rand: () => number): AudioBuffer {
  const length = Math.ceil(seconds * ctx.sampleRate)
  const buf = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = rand() * 2 - 1
      if (kind === 'white') data[i] = white * 0.5
      else if (kind === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      } else {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
  }
  return buf
}

export function noiseSource(ctx: BaseAudioContext, kind: 'white' | 'pink' | 'brown', seconds: number, rand: () => number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, kind, seconds, rand)
  return src
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, Q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = Q
  return f
}

export function gain(ctx: BaseAudioContext, value: number) {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

export function panner(ctx: BaseAudioContext, pan: number): AudioNode {
  if ('createStereoPanner' in ctx) {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    return p
  }
  return gain(ctx, 1)
}

export function chain(...nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1])
  return nodes[nodes.length - 1]
}

interface GrainBus {
  l: Float32Array
  r: Float32Array
}
const grainBuses = new WeakMap<BaseAudioContext, Map<AudioNode, GrainBus>>()

function busFor(ctx: OfflineAudioContext, out: AudioNode): GrainBus {
  let buses = grainBuses.get(ctx)
  if (!buses) grainBuses.set(ctx, (buses = new Map()))
  let bus = buses.get(out)
  if (!bus) buses.set(out, (bus = { l: new Float32Array(ctx.length), r: new Float32Array(ctx.length) }))
  return bus
}

/** One sine partial of a note: its frequency as a multiple of the note's, its level, and the seconds it takes to die away. */
export type Partial = readonly [multiple: number, level: number, seconds: number]

/**
 * A struck or plucked note, as a handful of decaying sine partials – written
 * into the destination's buffer like a burst, for the same reason: a track has
 * hundreds of notes, and as oscillator nodes each one costs time for the whole
 * render (three hundred notes took 3.5 s; computed here they take a few
 * milliseconds).
 *
 * `cut` ends the note early with a short release (a bass note that must not run into the next).
 * `glide` bends the pitch from a multiple of the frequency down to it (a kick drum).
 */
export function note(ctx: OfflineAudioContext, out: AudioNode, at: number, opts: { freq: number; partials: readonly Partial[]; gain: number; pan?: number; attack?: number; cut?: number; glide?: { from: number; seconds: number } }) {
  const { l, r } = busFor(ctx, out)
  const sr = ctx.sampleRate
  const start = Math.round(at * sr)
  if (start < 0 || start >= ctx.length || opts.gain <= 0) return
  const angle = (((opts.pan ?? 0) + 1) * Math.PI) / 4
  const gl = Math.cos(Math.max(0, Math.min(Math.PI / 2, angle))) * Math.SQRT2
  const gr = Math.sin(Math.max(0, Math.min(Math.PI / 2, angle))) * Math.SQRT2
  const attack = Math.max(1, Math.round((opts.attack ?? 0.01) * sr))
  const cutAt = opts.cut === undefined ? Infinity : Math.round(opts.cut * sr)
  const release = Math.round(0.03 * sr)
  for (const [multiple, level, seconds] of opts.partials) {
    const f = opts.freq * multiple
    if (f >= sr * 0.45) continue
    const peak = opts.gain * level
    const n = Math.min(ctx.length - start, Math.ceil(seconds * sr), cutAt + release)
    const fall = Math.pow(0.0001 / Math.max(peak, 0.0002), 1 / Math.max(1, seconds * sr - attack))
    let env = 0
    if (opts.glide) {
      // The pitch moves, so the phase is summed sample by sample.
      const k = Math.pow(1 / opts.glide.from, 1 / Math.max(1, opts.glide.seconds * sr))
      let ratio = opts.glide.from
      let phase = 0
      for (let i = 0; i < n; i++) {
        env = i < attack ? (peak * (i + 1)) / attack : env * fall
        const v = Math.sin(phase) * env * (i > cutAt ? Math.max(0, 1 - (i - cutAt) / release) : 1)
        l[start + i] += v * gl
        r[start + i] += v * gr
        phase += (2 * Math.PI * f * ratio) / sr
        if (ratio > 1) ratio = Math.max(1, ratio * k)
      }
      continue
    }
    // A fixed pitch: rotate a unit vector instead of calling sin() for every sample.
    const w = (2 * Math.PI * f) / sr
    const cos = Math.cos(w)
    const sin = Math.sin(w)
    let x = 1
    let y = 0
    for (let i = 0; i < n; i++) {
      env = i < attack ? (peak * (i + 1)) / attack : env * fall
      const v = y * env * (i > cutAt ? Math.max(0, 1 - (i - cutAt) / release) : 1)
      l[start + i] += v * gl
      r[start + i] += v * gr
      const nx = x * cos - y * sin
      y = x * sin + y * cos
      x = nx
    }
  }
}

/**
 * Short filtered noise burst – raindrops, crackles, clicks, key presses.
 *
 * A sound may have a thousand of these. As audio nodes (a source, a filter, a
 * gain and a panner each) every one is processed for the whole render, started
 * or not, and a rain loop took eight seconds to make. So a burst is computed
 * here instead and written straight into one stereo buffer per destination;
 * `flushGrains` then plays each buffer as a single source. Same sound, a
 * fraction of the work. (`noise` is unused now and kept for the call sites.)
 */
export function burst(ctx: OfflineAudioContext, out: AudioNode, _noise: AudioBuffer | null, at: number, opts: { freq: number; q: number; gain: number; decay: number; pan: number; type?: BiquadFilterType }) {
  const bus = busFor(ctx, out)
  const sr = ctx.sampleRate
  const start = Math.round(at * sr)
  if (start < 0 || start >= ctx.length || opts.gain <= 0) return
  const n = Math.min(ctx.length - start, Math.ceil((opts.decay + 0.004) * sr))

  // The filter (RBJ cookbook forms, as the Web Audio biquads are). Low- and high-pass take their Q in dB.
  const type = opts.type ?? 'bandpass'
  const w0 = (2 * Math.PI * Math.min(opts.freq, sr * 0.45)) / sr
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * (type === 'bandpass' ? Math.max(0.05, opts.q) : Math.pow(10, opts.q / 20)))
  let b0: number, b1: number, b2: number
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2
    b1 = 1 - cos
    b2 = b0
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2
    b1 = -(1 + cos)
    b2 = b0
  } else {
    b0 = alpha
    b1 = 0
    b2 = -alpha
  }
  const a0 = 1 + alpha
  const a1 = (-2 * cos) / a0
  const a2 = (1 - alpha) / a0
  b0 /= a0
  b1 /= a0
  b2 /= a0

  // The envelope: up in a millisecond and a half, then an exponential fall to nothing by `decay`.
  const attack = Math.max(1, Math.round(0.0015 * sr))
  const fall = Math.pow(0.0001 / opts.gain, 1 / Math.max(1, opts.decay * sr - attack))
  // Equal-power pan, scaled so a centred burst is as loud as it was as a stereo source.
  const angle = ((Math.max(-1, Math.min(1, opts.pan)) + 1) * Math.PI) / 4
  const gl = Math.cos(angle) * Math.SQRT2
  const gr = Math.sin(angle) * Math.SQRT2

  // Its own small generator, seeded by where it falls, so the same burst is the same on every device.
  let seed = (start * 2654435761 + 0x9e3779b9) >>> 0 || 1
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  let env = 0
  const { l, r } = bus
  for (let i = 0; i < n; i++) {
    seed ^= seed << 13
    seed >>>= 0
    seed ^= seed >>> 17
    seed ^= seed << 5
    seed >>>= 0
    const x = (seed / 4294967296 - 0.5) * 1 // white noise at ±0.5, as noiseBuffer makes it
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    env = i < attack ? (opts.gain * (i + 1)) / attack : env * fall
    const v = y * env
    l[start + i] += v * gl
    r[start + i] += v * gr
  }
}

/** Hand the bursts written so far to the context, one source per destination. Call once, just before rendering. */
export function flushGrains(ctx: OfflineAudioContext) {
  const buses = grainBuses.get(ctx)
  if (!buses) return
  for (const [out, bus] of buses) {
    const buffer = ctx.createBuffer(2, ctx.length, ctx.sampleRate)
    buffer.getChannelData(0).set(bus.l)
    buffer.getChannelData(1).set(bus.r)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(out)
    src.start(0)
  }
  grainBuses.delete(ctx)
}

/**
 * The gain for something that sounds the whole way through a loop whose tail
 * is folded back onto its head (rain behind a track, the air of a fan): it
 * fades in over the first seconds and out over the same span past the loop
 * point, so the two cross at equal power and there is no seam.
 */
export function seamGain(ctx: OfflineAudioContext, level: number, loop: number, fade: number): GainNode {
  const g = ctx.createGain()
  const n = 64
  const up = new Float32Array(n)
  const down = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    up[i] = level * Math.sin(((i / (n - 1)) * Math.PI) / 2)
    down[i] = level * Math.cos(((i / (n - 1)) * Math.PI) / 2)
  }
  g.gain.setValueCurveAtTime(up, 0, fade)
  g.gain.setValueCurveAtTime(down, loop, fade)
  return g
}

/**
 * A room: six damped feedback delays in parallel behind two short diffusers.
 * (A convolution reverb sounds a little better and took ten times as long to
 * render as everything else in a track put together.)
 */
export function reverb(ctx: OfflineAudioContext, seconds: number, rand: () => number): { input: AudioNode; output: AudioNode } {
  const input = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0.32
  // Diffusion: two all-pass stages smear each attack before it reaches the delays.
  let fed: AudioNode = input
  for (const time of [0.0051, 0.0037]) {
    const sum = ctx.createGain()
    const delay = ctx.createDelay(0.05)
    delay.delayTime.value = time
    const pass = ctx.createGain()
    fed.connect(sum)
    sum.connect(delay).connect(pass)
    chain(fed, gain(ctx, -0.6), pass)
    chain(pass, gain(ctx, 0.6), sum)
    fed = pass
  }
  ;[0.0297, 0.0371, 0.0411, 0.0437, 0.0533, 0.0617].forEach((time, i) => {
    const t = time * (1 + rand() * 0.05)
    const delay = ctx.createDelay(0.1)
    delay.delayTime.value = t
    // Sixty decibels down after `seconds`; the top goes first, as in a furnished room.
    const back = gain(ctx, Math.pow(10, (-3 * t) / seconds))
    // A shelf, not a low-pass: it never raises any frequency, so the loop's gain stays below one and it cannot run away.
    const damp = ctx.createBiquadFilter()
    damp.type = 'highshelf'
    damp.frequency.value = 2600 + i * 250
    damp.gain.value = -2.5
    fed.connect(delay)
    chain(delay, damp, back, delay)
    chain(delay, panner(ctx, i % 2 ? 0.7 : -0.7), output)
  })
  return { input, output }
}

export function tone(ctx: OfflineAudioContext, out: AudioNode, at: number, opts: { from: number; to: number; dur: number; gain: number; pan: number; type?: OscillatorType }) {
  const osc = ctx.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.from, at)
  osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(opts.gain, at + Math.min(0.012, opts.dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur)
  chain(osc, g, panner(ctx, opts.pan), out)
  osc.start(at)
  osc.stop(at + opts.dur + 0.02)
}

