/**
 * Study music, composed by code.
 *
 * Each track in catalog.ts is turned into a short piece – a tempo, a key, a
 * chord progression and a handful of parts (keys, bass, drums, pads, bells) –
 * chosen deterministically from the track's id, so "Desk lamp" is the same
 * piece on every device. The piece is rendered once into a seamless loop with
 * an OfflineAudioContext, exactly as the ambient sounds are, and the store
 * plays the loop and moves on to the next track after a few minutes.
 *
 * Nothing here is a recording and nothing is downloaded: there are no audio
 * files to license. The writing aims at music that can be ignored: slow
 * harmony, soft attacks, no hooks.
 */
import { seededRandom } from '@/lib/random'
import { TRACK_META, type MusicGenre } from './catalog'
import { burst, chain, filter, flushGrains, gain, noiseSource, note as playNote, panner, reverb, seamGain } from './dsp'

type Rand = () => number

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const
type Mode = keyof typeof SCALES

interface Piece {
  genre: MusicGenre
  bpm: number
  /** Bars in the loop (4 beats each). */
  bars: number
  /** MIDI note of the key's root, around C3–B3. */
  root: number
  mode: Mode
  /** Scale degree (0-based) of each chord; the progression repeats to fill the bars. */
  chords: number[]
  /** Bars each chord lasts. */
  hold: number
  swing: number
  rand: Rand
}

const PROGRESSIONS: Record<MusicGenre, number[][]> = {
  lofi: [[1, 4, 0, 5], [0, 5, 3, 4], [5, 3, 0, 4], [3, 4, 2, 5], [0, 2, 3, 4], [5, 1, 4, 0]],
  piano: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 5, 4], [3, 0, 4, 5]],
  ambient: [[0, 3], [0, 5, 3, 0], [3, 0], [0, 4, 3, 0]],
  synth: [[5, 3, 0, 4], [0, 2, 5, 3], [5, 0, 3, 4], [0, 5, 1, 4]],
  deep: [[0, 0], [0, 3], [0, 4]],
  rain: [[0, 5, 3, 4], [5, 3, 0, 4], [1, 4, 0, 0], [3, 4, 5, 0]],
}

function pieceFor(id: string): Piece {
  const genre = TRACK_META.get(id)?.genre ?? 'ambient'
  const rand = seededRandom(`music:${id}`)
  const between = (a: number, b: number) => a + (b - a) * rand()
  const choose = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]
  const chords = choose(PROGRESSIONS[genre])
  const root = 48 + Math.floor(rand() * 12)
  switch (genre) {
    case 'lofi':
      return { genre, bpm: Math.round(between(68, 84)), bars: 8, root, mode: choose(['dorian', 'minor', 'major'] as const), chords, hold: 1, swing: between(0.12, 0.2), rand }
    case 'piano':
      return { genre, bpm: Math.round(between(56, 70)), bars: 8, root, mode: choose(['major', 'minor', 'lydian'] as const), chords, hold: 2, swing: 0, rand }
    case 'ambient':
      return { genre, bpm: Math.round(between(48, 58)), bars: 8, root, mode: choose(['lydian', 'major', 'dorian'] as const), chords, hold: 4, swing: 0, rand }
    case 'synth':
      return { genre, bpm: Math.round(between(84, 98)), bars: 8, root, mode: choose(['minor', 'dorian'] as const), chords, hold: 2, swing: 0, rand }
    case 'deep':
      return { genre, bpm: 50, bars: 8, root: 36 + Math.floor(rand() * 7), mode: choose(['dorian', 'minor', 'lydian'] as const), chords, hold: 4, swing: 0, rand }
    case 'rain':
      return { genre, bpm: Math.round(between(60, 74)), bars: 8, root, mode: choose(['major', 'dorian', 'minor'] as const), chords, hold: 2, swing: between(0, 0.12), rand }
  }
}

/** Loop length of a track in seconds. */
export function trackSeconds(id: string): number {
  const p = pieceFor(id)
  return (p.bars * 4 * 60) / p.bpm
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** A scale degree (may be beyond one octave, or negative) as a MIDI note. */
const note = (p: Piece, degree: number, octave = 0) => {
  const scale = SCALES[p.mode]
  const d = ((degree % 7) + 7) % 7
  return p.root + scale[d] + 12 * (Math.floor(degree / 7) + octave)
}
/** The chord on a degree: root, third, fifth, seventh, as scale degrees. */
const chordDegrees = (degree: number, seventh = true) => (seventh ? [degree, degree + 2, degree + 4, degree + 6] : [degree, degree + 2, degree + 4])

// ── instruments ─────────────────────────────────────────────────────────────
// Struck and plucked voices are sums of decaying sine partials, computed by
// dsp.note (see there for why they are not oscillator nodes). Only the pads,
// which are few and long, are built from nodes.

type Voice = (ctx: OfflineAudioContext, out: AudioNode, t: number, midi: number, dur: number, vel: number, pan?: number) => void

/** An electric piano: a soft sine with a bell an octave up that dies away first. */
const keys: Voice = (ctx, out, t, midi, dur, vel, pan = 0) =>
  playNote(ctx, out, t, { freq: hz(midi), gain: vel, pan, attack: 0.012, partials: [[1, 1, Math.max(0.15, dur)], [2, 0.32, Math.max(0.15, dur * 0.4)], [3.01, 0.08, Math.max(0.15, dur * 0.2)]] })

/** A felt piano: a rounded tone whose upper partials leave first, with a soft hammer at the front. */
const piano: Voice = (ctx, out, t, midi, dur, vel, pan = 0) =>
  playNote(ctx, out, t, {
    freq: hz(midi),
    gain: vel,
    pan,
    attack: 0.008,
    partials: [[1, 0.5, dur], [1, 0.6, 0.35], [2.002, 0.2, dur * 0.6], [3, 0.11, dur * 0.45], [4.01, 0.05, dur * 0.3], [5, 0.03, dur * 0.2]],
  })

/** A plucked synth voice: the odd partials of a square, the upper ones closing quickly. */
const pluck: Voice = (ctx, out, t, midi, dur, vel, pan = 0) =>
  playNote(ctx, out, t, { freq: hz(midi), gain: vel, pan, attack: 0.006, partials: [[1, 1, dur], [3, 0.33, dur * 0.5], [5, 0.2, dur * 0.32], [7, 0.14, dur * 0.22], [9, 0.08, dur * 0.15]] })

/** A bell: a sine with inharmonic partials, ringing for seconds. */
function bell(ctx: OfflineAudioContext, out: AudioNode, t: number, midi: number, vel: number, pan = 0, ring = 3.5) {
  playNote(ctx, out, t, { freq: hz(midi), gain: vel, pan, attack: 0.006, partials: [[1, 1, ring], [2.76, 0.22, ring * 0.35], [5.4, 0.06, ring * 0.15]] })
}

/** A round bass: nearly a sine, held for its length and then let go. */
function bass(ctx: OfflineAudioContext, out: AudioNode, t: number, midi: number, dur: number, vel: number) {
  playNote(ctx, out, t, { freq: hz(midi), gain: vel, attack: 0.02, cut: dur, partials: [[1, 1, dur * 3], [2, 0.12, dur * 1.2], [3, 0.08, dur * 0.8]] })
}

function kick(ctx: OfflineAudioContext, out: AudioNode, t: number, vel: number) {
  playNote(ctx, out, t, { freq: 42, gain: vel, attack: 0.002, glide: { from: 120 / 42, seconds: 0.12 }, partials: [[1, 1, 0.26]] })
}

/** A pad: two slightly detuned saws per note behind a low filter, arriving and leaving slowly. */
function pad(ctx: OfflineAudioContext, out: AudioNode, t: number, midis: number[], dur: number, level: number, cutoff = 900, attack = 1.4) {
  const lp = filter(ctx, 'lowpass', cutoff, 0.5)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + Math.min(attack, dur * 0.4))
  g.gain.setValueAtTime(level, t + dur * 0.7)
  g.gain.linearRampToValueAtTime(0, t + dur + 1.2)
  chain(lp, g, out)
  midis.forEach((m, i) => {
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = hz(m)
      osc.detune.value = detune
      chain(osc, gain(ctx, 0.5 / midis.length), panner(ctx, (i / Math.max(1, midis.length - 1) - 0.5) * 1.2 * Math.sign(detune)), lp)
      osc.start(t)
      osc.stop(t + dur + 1.3)
    }
  })
}

/** Seconds over which a continuous part crosses itself at the loop point. */
const SEAM = 3

// ── arrangements ────────────────────────────────────────────────────────────

interface Mix {
  ctx: OfflineAudioContext
  /** Straight to the output. */
  dry: AudioNode
  /** Into the room. */
  wet: AudioNode
  /** Seconds per beat, per bar, and for the whole loop. */
  beat: number
  bar: number
  total: number
  /** The chord (as scale degrees) sounding in a bar. */
  chordAt: (bar: number) => number
}

function lofi(p: Piece, m: Mix) {
  const { ctx, dry, wet, beat, bar } = m
  const r = p.rand
  const noise = null
  const swing = (step: number) => (step % 2 ? p.swing * beat * 0.5 : 0)
  for (let b = 0; b < p.bars; b++) {
    const t0 = b * bar
    const degrees = chordDegrees(m.chordAt(b))
    // Keys: the chord on the first beat, an answer late in the bar.
    degrees.forEach((d, i) => keys(ctx, wet, t0 + i * 0.012, note(p, d, 1), beat * 2.6, 0.085, (i - 1.5) * 0.25))
    if (r() < 0.7) degrees.slice(1).forEach((d, i) => keys(ctx, wet, t0 + beat * 2.5 + swing(1) + i * 0.01, note(p, d, 1), beat * 1.3, 0.055, (i - 1) * 0.3))
    // Bass: the root, and the fifth on the way to the next bar.
    bass(ctx, dry, t0, note(p, m.chordAt(b), -1), beat * 1.8, 0.2)
    if (r() < 0.6) bass(ctx, dry, t0 + beat * 2.5, note(p, m.chordAt(b) + 4, -1), beat * 1.2, 0.14)
    // Drums: kick on one and the "and" of two, a rim on two and four, soft hats in eighths.
    kick(ctx, dry, t0, 0.5)
    kick(ctx, dry, t0 + beat * 2.5 + swing(1), 0.36)
    for (const beatNo of [1, 3]) burst(ctx, dry, noise, t0 + beat * beatNo, { freq: 1700, q: 1.2, gain: 0.2, decay: 0.09, pan: 0.1 })
    for (let s = 0; s < 8; s++) burst(ctx, dry, noise, t0 + s * (beat / 2) + swing(s), { freq: 7000, q: 1, gain: s % 2 ? 0.03 : 0.05, decay: 0.03, pan: -0.25, type: 'highpass' })
    // A few notes of melody, never on the beat.
    if (b % 2 === 1 || r() < 0.35) {
      const count = 2 + Math.floor(r() * 3)
      for (let k = 0; k < count; k++) {
        const step = 1 + Math.floor(r() * 6)
        keys(ctx, wet, t0 + step * (beat / 2) + swing(step), note(p, pickTone(degrees, r), 2), beat * 1.1, 0.05 + r() * 0.03, 0.35)
      }
    }
  }
  // Dust: tape hiss and the odd crackle.
  const hiss = noiseSource(ctx, 'pink', m.total + SEAM + 1, r)
  chain(hiss, filter(ctx, 'highpass', 2500), seamGain(ctx, 0.012, m.total, SEAM), dry)
  hiss.start()
  for (let t = 0; t < m.total; t += 0.15 + r() * 0.7) burst(ctx, dry, noise, t, { freq: 2500 + r() * 3000, q: 4, gain: 0.02 + r() * 0.05, decay: 0.004, pan: r() * 2 - 1 })
}

function pianoPiece(p: Piece, m: Mix) {
  const { ctx, wet, beat, bar } = m
  const r = p.rand
  for (let b = 0; b < p.bars; b++) {
    const t0 = b * bar
    const degrees = chordDegrees(m.chordAt(b), false)
    // Left hand: root and fifth, let ring. Right hand: the chord broken slowly upward.
    piano(ctx, wet, t0, note(p, degrees[0], -1), bar * 0.95, 0.2, -0.3)
    piano(ctx, wet, t0 + beat * 0.5, note(p, degrees[2], -1), bar * 0.8, 0.11, -0.2)
    const figure = [degrees[0] + 7, degrees[1] + 7, degrees[2] + 7, degrees[1] + 7]
    figure.forEach((d, i) => {
      if (i > 1 && r() < 0.25) return
      piano(ctx, wet, t0 + beat * (1 + i * 0.75) + r() * 0.02, note(p, d, 0), beat * 2.2, 0.1 + r() * 0.05, 0.1 + i * 0.1)
    })
    if (b % 2 === 1) piano(ctx, wet, t0 + beat * 3.5, note(p, pickTone(degrees, r) + 7, 1), beat * 2.5, 0.09, 0.4)
  }
}

function ambient(p: Piece, m: Mix) {
  const { ctx, wet, bar, beat } = m
  const r = p.rand
  for (let b = 0; b < p.bars; b += p.hold) {
    const degrees = chordDegrees(m.chordAt(b))
    pad(ctx, wet, b * bar, degrees.map((d) => note(p, d, 0)), bar * p.hold, 0.2, 700 + r() * 500, 2.4)
    pad(ctx, wet, b * bar, [note(p, degrees[0], -1)], bar * p.hold, 0.12, 300, 3)
  }
  // Bells, far apart, from the scale's quieter notes.
  for (let t = beat * 2; t < m.total - beat; t += beat * (3 + Math.floor(r() * 5))) {
    const b = Math.floor(t / bar)
    bell(ctx, wet, t, note(p, pickTone(chordDegrees(m.chordAt(b)), r) + 7, 1), 0.05 + r() * 0.04, r() * 1.4 - 0.7, 4 + r() * 2)
  }
}

function synth(p: Piece, m: Mix) {
  const { ctx, dry, wet, beat, bar } = m
  const r = p.rand
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2].map((i) => (r() < 0.2 ? (i + 1) % 4 : i))
  for (let b = 0; b < p.bars; b++) {
    const t0 = b * bar
    const degrees = chordDegrees(m.chordAt(b))
    if (b % p.hold === 0) pad(ctx, wet, t0, degrees.slice(0, 3).map((d) => note(p, d, 0)), bar * p.hold, 0.12, 1100, 0.8)
    // An arpeggio in eighths, quiet and even.
    pattern.forEach((i, s) => pluck(ctx, wet, t0 + s * (beat / 2), note(p, degrees[i], 1), beat * 0.45, 0.045 + (s % 4 === 0 ? 0.015 : 0), s % 2 ? 0.35 : -0.35))
    bass(ctx, dry, t0, note(p, degrees[0], -1), bar * 0.9, 0.16)
    kick(ctx, dry, t0, 0.22)
    kick(ctx, dry, t0 + beat * 2, 0.16)
  }
}

function deep(p: Piece, m: Mix) {
  const { ctx, dry, wet, bar } = m
  const r = p.rand
  // Every continuous voice completes a whole number of cycles in the loop and stops at the loop point, so the seam is silent.
  const fit = (f: number) => Math.round(f * m.total) / m.total
  // A drone on the root and fifth with a slow beat between the ears, and one pad that shifts every four bars.
  for (const [degree, octave, pan, level] of [[0, 0, -0.9, 0.2], [0, 0, 0.9, 0.2], [4, 0, 0, 0.09], [0, 1, 0, 0.05]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = fit(hz(note(p, degree, octave)) + (pan > 0 ? 0.6 : 0))
    const g = gain(ctx, level)
    const lfo = ctx.createOscillator()
    // Whole cycles in the loop, so the swell lines up at the seam.
    lfo.frequency.value = Math.round(m.total / 12) / m.total
    lfo.connect(gain(ctx, level * 0.35)).connect(g.gain)
    chain(osc, filter(ctx, 'lowpass', 700, 0.4), g, panner(ctx, pan), dry)
    osc.start()
    lfo.start()
    osc.stop(m.total)
    lfo.stop(m.total)
  }
  for (let b = 0; b < p.bars; b += p.hold) pad(ctx, wet, b * bar, chordDegrees(m.chordAt(b), false).map((d) => note(p, d, 1)), bar * p.hold, 0.07, 500 + r() * 300, 4)
}

function rainKeys(p: Piece, m: Mix) {
  const { ctx, dry, wet, beat, bar } = m
  const r = p.rand
  // The rain is part of the track: steady, with drops on the sill.
  const rain = noiseSource(ctx, 'pink', m.total + SEAM + 1, r)
  chain(rain, filter(ctx, 'highpass', 500), filter(ctx, 'lowpass', 6000), seamGain(ctx, 0.16, m.total, SEAM), dry)
  rain.start()
  const body = noiseSource(ctx, 'brown', m.total + SEAM + 1, r)
  chain(body, filter(ctx, 'lowpass', 340), seamGain(ctx, 0.12, m.total, SEAM), dry)
  body.start()
  const drops = null
  for (let t = 0; t < m.total; t += 0.03 + r() * 0.09) burst(ctx, dry, drops, t, { freq: 1800 + r() * 4500, q: 2 + r() * 5, gain: 0.03 + r() * 0.1, decay: 0.01 + r() * 0.03, pan: r() * 2 - 1 })
  for (let b = 0; b < p.bars; b++) {
    const t0 = b * bar
    const degrees = chordDegrees(m.chordAt(b))
    const swing = p.swing * beat * 0.5
    if (b % p.hold === 0) degrees.forEach((d, i) => keys(ctx, wet, t0 + i * 0.03, note(p, d, 1), bar * p.hold * 0.8, 0.075, (i - 1.5) * 0.3))
    bass(ctx, dry, t0, note(p, degrees[0], -1), beat * 3, 0.13)
    const count = 1 + Math.floor(r() * 3)
    for (let k = 0; k < count; k++) {
      const step = 2 + Math.floor(r() * 6)
      piano(ctx, wet, t0 + step * (beat / 2) + (step % 2 ? swing : 0), note(p, pickTone(degrees, r) + 7, 0), beat * 2, 0.08 + r() * 0.04, 0.3)
    }
  }
}

/** A chord tone, most often the third or the fifth. */
function pickTone(degrees: number[], r: Rand): number {
  const x = r()
  return x < 0.3 ? degrees[1] : x < 0.6 ? degrees[2] : x < 0.8 ? degrees[0] : (degrees[3] ?? degrees[1])
}

const ARRANGE: Record<MusicGenre, (p: Piece, m: Mix) => void> = { lofi, piano: pianoPiece, ambient, synth, deep, rain: rainKeys }
const WET: Record<MusicGenre, number> = { lofi: 0.28, piano: 0.5, ambient: 0.7, synth: 0.4, deep: 0.6, rain: 0.42 }
const TRIM: Record<MusicGenre, number> = { lofi: 1.4, piano: 3.4, ambient: 2.6, synth: 1.5, deep: 0.8, rain: 1.5 }
/** The RMS level every track is brought to (the quieter ambient sounds sit around the same figure). */
const LOUDNESS = 0.11
/** Seconds of decay rendered past the loop point and folded back onto its start. */
const TAIL = 6

const cache = new Map<string, Promise<AudioBuffer>>()

/**
 * The rate tracks are rendered at. Nothing in them reaches above ten kilohertz,
 * so this loses nothing audible, takes a third less time to make and a third
 * less memory to hold; the player resamples to the device's rate.
 */
export const TRACK_RATE = 32000

/** Render a track into a seamless loop. The two most recent tracks are kept; older ones are released. */
export function renderTrack(id: string): Promise<AudioBuffer> {
  const sampleRate = TRACK_RATE
  const key = id
  const hit = cache.get(key)
  if (hit) return hit
  const promise = (async () => {
    const p = pieceFor(id)
    const beat = 60 / p.bpm
    const bar = beat * 4
    const total = bar * p.bars
    const length = Math.ceil(total * sampleRate)
    const ctx = new OfflineAudioContext(2, length + Math.ceil(TAIL * sampleRate), sampleRate)
    const out = ctx.createGain()
    out.gain.value = TRIM[p.genre]
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    // Lo-fi and rain-backed tracks lose their top end, as a worn tape would.
    const tone = p.genre === 'lofi' || p.genre === 'rain' ? filter(ctx, 'lowpass', 4200, 0.5) : null
    if (tone) chain(out, tone, comp, ctx.destination)
    else chain(out, comp, ctx.destination)
    const wet = ctx.createGain()
    const room = reverb(ctx, p.genre === 'ambient' || p.genre === 'deep' ? 4 : 2.2, seededRandom(`room:${id}`))
    wet.connect(out)
    wet.connect(room.input)
    chain(room.output, gain(ctx, WET[p.genre]), out)
    ARRANGE[p.genre](p, { ctx, dry: out, wet, beat, bar, total, chordAt: (b) => p.chords[Math.floor(b / p.hold) % p.chords.length] })
    flushGrains(ctx)
    const rendered = await ctx.startRendering()
    // What rings past the end of the loop belongs at its beginning: add the tail onto the head.
    const loop = new AudioBuffer({ numberOfChannels: 2, length, sampleRate })
    for (let ch = 0; ch < 2; ch++) {
      const src = rendered.getChannelData(ch)
      const dst = loop.getChannelData(ch)
      dst.set(src.subarray(0, length))
      const tail = Math.min(src.length - length, length)
      for (let i = 0; i < tail; i++) dst[i] += src[length + i]
    }
    // Every track leaves at the same loudness, however it was written, and none can clip.
    let peak = 0
    let sum = 0
    for (let ch = 0; ch < 2; ch++) {
      const data = loop.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const a = Math.abs(data[i])
        if (a > peak) peak = a
        sum += a * a
      }
    }
    const rms = Math.sqrt(sum / (length * 2))
    const scale = rms > 0 ? Math.min(LOUDNESS / rms, 0.9 / peak) : 1
    for (let ch = 0; ch < 2; ch++) {
      const data = loop.getChannelData(ch)
      for (let i = 0; i < length; i++) data[i] *= scale
    }
    return loop
  })()
  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  // Keep memory bounded: a loop is several megabytes. The track playing and the one after it are enough.
  while (cache.size > 2) cache.delete(cache.keys().next().value!)
  return promise
}

/** How long a track plays before the next one takes over: whole loops, about three and a half minutes. */
export function playSeconds(id: string): number {
  const loop = trackSeconds(id)
  return Math.max(2, Math.round(210 / loop)) * loop
}
