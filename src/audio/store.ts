/**
 * The study-audio engine: ambient layers and study music, and their persisted state.
 *
 * There is one engine for the whole app. It lives at module level, outside
 * React, and is driven only by this store – no screen, sheet or popover owns a
 * player, so timer ticks, re-renders, closing the sound panel and changing
 * route cannot restart or drop what is playing.
 *
 *   ambient layers  any number at once, each a seamless loop with its own
 *                   volume and mute
 *   music           one track at a time, itself a seamless loop; after a few
 *                   minutes the next track is crossfaded in. If that hand-over
 *                   is ever late (a throttled background tab), the current
 *                   track simply keeps looping – there is no end to run into,
 *                   so there is never silence.
 *
 *   play            fade in; start what is missing
 *   pause           fade out, then release the voices; the music's position is
 *                   kept, so resuming carries on from where it was
 *   stop            quick fade, release, and the music starts from the top next time
 *
 * Every layer has at most one voice (`voices`, `pending`) and the music at most
 * one plus the one it is fading from; everything released is stopped and
 * disconnected, and rendered loops are dropped when no longer in use.
 */
import { create } from 'zustand'
import { KEYS, migrateLegacyKeys } from '@/lib/storage'
import { MUSIC_TRACKS, SOUND_META, TRACK_META, type MusicGenre } from './catalog'
import { getAudioContext, unlockAudio } from './context'

const STORAGE_KEY = KEYS.audio

export interface Layer {
  volume: number
  muted: boolean
}

export interface MusicState {
  /** Whether music is part of the mix. */
  on: boolean
  /** The current track (catalog.ts). */
  track: string
  /** Tracks advance within this genre; 'all' runs through every genre. */
  genre: MusicGenre | 'all'
  volume: number
  shuffle: boolean
}

interface Persisted {
  layers: Record<string, Layer>
  master: number
  presetId: string | null
  music: MusicState
}

interface AudioStore extends Persisted {
  playing: boolean
  /** Ids being rendered: a sound id, or `music:<track id>`. */
  loading: string[]
  toggleSound: (id: string) => void
  setVolume: (id: string, volume: number) => void
  toggleMute: (id: string) => void
  setMaster: (volume: number) => void
  play: () => void
  /** Fade out; voices are released once silent. The music keeps its place. */
  pause: () => void
  /** Quick fade and release – the next play starts the music from the top. */
  stop: () => void
  togglePlay: () => void
  applyPreset: (layers: Array<{ sound: string; volume: number }>, presetId: string | null) => void
  /** Remove every ambient layer and turn the music off. */
  clear: () => void
  setMusic: (on: boolean) => void
  playTrack: (id: string) => void
  nextTrack: () => void
  prevTrack: () => void
  setMusicVolume: (volume: number) => void
  setShuffle: (shuffle: boolean) => void
  setGenre: (genre: MusicGenre | 'all') => void
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const DEFAULT_MUSIC: MusicState = { on: false, track: MUSIC_TRACKS[0].id, genre: 'all', volume: 0.6, shuffle: false }
const DEFAULTS: Persisted = { layers: {}, master: 0.8, presetId: null, music: DEFAULT_MUSIC }

/** Read what was saved. Layers used to be plain volumes; those still load. Exported for tests. */
export function parsePersisted(raw: string | null): Persisted {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<Persisted> & { layers?: Record<string, unknown> }) : null
    if (!p || typeof p.master !== 'number' || !p.layers || typeof p.layers !== 'object') return DEFAULTS
    const layers: Record<string, Layer> = {}
    for (const [id, v] of Object.entries(p.layers)) {
      if (!SOUND_META.has(id)) continue
      if (typeof v === 'number') layers[id] = { volume: clamp(v), muted: false }
      else if (v && typeof v === 'object' && typeof (v as Layer).volume === 'number') layers[id] = { volume: clamp((v as Layer).volume), muted: !!(v as Layer).muted }
    }
    const m = (p.music ?? {}) as Partial<MusicState>
    const music: MusicState = {
      on: !!m.on,
      track: typeof m.track === 'string' && TRACK_META.has(m.track) ? m.track : DEFAULT_MUSIC.track,
      genre: m.genre === 'all' || MUSIC_TRACKS.some((t) => t.genre === m.genre) ? (m.genre as MusicState['genre']) : 'all',
      volume: typeof m.volume === 'number' ? clamp(m.volume) : DEFAULT_MUSIC.volume,
      shuffle: !!m.shuffle,
    }
    return { layers, master: clamp(p.master), presetId: typeof p.presetId === 'string' ? p.presetId : null, music }
  } catch {
    return DEFAULTS
  }
}

function load(): Persisted {
  migrateLegacyKeys()
  try {
    return parsePersisted(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULTS
  }
}

const hasSomething = (s: Pick<Persisted, 'layers' | 'music'>) => s.music.on || Object.keys(s.layers).length > 0

/** The tracks the music moves through, in order. */
export function queue(music: Pick<MusicState, 'genre'>) {
  return music.genre === 'all' ? MUSIC_TRACKS : MUSIC_TRACKS.filter((t) => t.genre === music.genre)
}

/** Tracks played before the current one, so "previous" means what was heard, also when shuffling. */
const history: string[] = []

/** The track after `current`. Exported for tests. */
export function following(music: MusicState, current: string, rand: () => number = Math.random): string {
  const list = queue(music)
  if (list.length < 2) return list[0]?.id ?? current
  if (music.shuffle) {
    const others = list.filter((t) => t.id !== current)
    return others[Math.floor(rand() * others.length)].id
  }
  return list[(list.findIndex((t) => t.id === current) + 1) % list.length].id
}

export const useAudio = create<AudioStore>((set, get) => ({
  ...(typeof localStorage === 'undefined' ? DEFAULTS : load()),
  playing: false,
  loading: [],
  toggleSound: (id) => {
    if (!SOUND_META.has(id)) return
    unlockAudio()
    const layers = { ...get().layers }
    if (layers[id]) delete layers[id]
    else layers[id] = { volume: 0.5, muted: false }
    // Adding a sound starts the mix; taking the last thing away ends it.
    set({ layers, presetId: null, playing: layers[id] ? true : get().playing && hasSomething({ layers, music: get().music }) })
  },
  setVolume: (id, volume) => {
    const layer = get().layers[id]
    // Moving a muted layer's slider is asking to hear it.
    if (layer) set({ layers: { ...get().layers, [id]: { volume: clamp(volume), muted: false } }, presetId: null })
  },
  toggleMute: (id) => {
    const layer = get().layers[id]
    if (layer) set({ layers: { ...get().layers, [id]: { ...layer, muted: !layer.muted } } })
  },
  setMaster: (master) => set({ master: clamp(master) }),
  play: () => {
    unlockAudio()
    if (hasSomething(get())) set({ playing: true })
  },
  pause: () => set({ playing: false }),
  stop: () => {
    stopping = true
    set({ playing: false })
  },
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  applyPreset: (layers, presetId) => {
    unlockAudio()
    set({ layers: Object.fromEntries(layers.filter((l) => SOUND_META.has(l.sound)).map((l) => [l.sound, { volume: clamp(l.volume), muted: false }])), presetId, playing: true })
  },
  clear: () => set({ layers: {}, playing: false, presetId: null, music: { ...get().music, on: false } }),
  setMusic: (on) => {
    unlockAudio()
    const music = { ...get().music, on }
    set({ music, playing: on ? true : get().playing && hasSomething({ layers: get().layers, music }) })
  },
  playTrack: (id) => {
    if (!TRACK_META.has(id)) return
    unlockAudio()
    const music = get().music
    if (music.track !== id) history.push(music.track)
    if (history.length > 50) history.shift()
    // A track from another genre widens the queue to everything, or "next" would jump back.
    const genre = music.genre === 'all' || TRACK_META.get(id)!.genre === music.genre ? music.genre : 'all'
    set({ music: { ...music, on: true, track: id, genre }, playing: true })
  },
  nextTrack: () => get().playTrack(following(get().music, get().music.track)),
  prevTrack: () => {
    const music = get().music
    const list = queue(music)
    const back = history.pop() ?? list[(list.findIndex((t) => t.id === music.track) - 1 + list.length) % list.length]?.id
    if (!back || back === music.track) return
    unlockAudio()
    set({ music: { ...music, on: true, track: back }, playing: true })
  },
  setMusicVolume: (volume) => set({ music: { ...get().music, volume: clamp(volume) } }),
  setShuffle: (shuffle) => set({ music: { ...get().music, shuffle } }),
  setGenre: (genre) => {
    const music = { ...get().music, genre }
    // Keep the current track if it belongs; otherwise move to the first of the genre.
    if (!queue(music).some((t) => t.id === music.track)) music.track = queue(music)[0].id
    set({ music })
  },
}))

// ───────────────────────── audio graph ─────────────────────────

interface Voice {
  src: AudioBufferSourceNode
  gain: GainNode
}

interface MusicVoice extends Voice {
  id: string
  /** Context time this voice started, and how far into the track's run it was then. */
  startedAt: number
  playedBefore: number
}

const voices = new Map<string, Voice>()
const pending = new Set<string>()
let master: GainNode | null = null
let musicBus: GainNode | null = null
let musicVoice: MusicVoice | null = null
/** The track being rendered to play next; a newer request replaces it. */
let musicWanted: string | null = null
/** Seconds of the current track already played, kept across a pause. */
let musicPlayed = 0
let stopTimer: ReturnType<typeof setTimeout> | undefined
let advanceTimer: ReturnType<typeof setInterval> | undefined
const FADE = 1.2
const STOP_FADE = 0.3
const CROSSFADE = 3
/** Set by stop(): the next fade-out is quick and the music rewinds. */
let stopping = false
/** Every source node ever started, for the QA suite: a count that does not move means nothing was restarted. */
let started = 0

function masterNode(ctx: AudioContext) {
  if (!master) {
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  return master
}

function musicNode(ctx: AudioContext) {
  if (!musicBus) {
    musicBus = ctx.createGain()
    musicBus.gain.value = useAudio.getState().music.volume
    musicBus.connect(masterNode(ctx))
  }
  return musicBus
}

function ramp(param: AudioParam, to: number, ctx: AudioContext, seconds = FADE) {
  const now = ctx.currentTime
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.linearRampToValueAtTime(to, now + seconds)
}

/** Fade a voice out and let go of it. */
function release(ctx: AudioContext, v: Voice, seconds: number) {
  ramp(v.gain.gain, 0, ctx, seconds)
  setTimeout(
    () => {
      try {
        v.src.stop()
      } catch {
        /* already stopped */
      }
      v.src.disconnect()
      v.gain.disconnect()
    },
    seconds * 1000 + 100,
  )
}

const setLoading = (id: string, on: boolean) => useAudio.setState((s) => ({ loading: on ? [...new Set([...s.loading, id])] : s.loading.filter((x) => x !== id) }))
const level = (layer: Layer) => (layer.muted ? 0 : layer.volume)

async function startVoice(ctx: AudioContext, id: string) {
  if (voices.has(id) || pending.has(id)) return
  pending.add(id)
  setLoading(id, true)
  try {
    const { renderSound } = await import('./sounds')
    const buffer = await renderSound(id, ctx.sampleRate)
    const s = useAudio.getState()
    if (!s.playing || !s.layers[id] || voices.has(id)) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(masterNode(ctx))
    // Start each loop at a different offset so layered sounds don't phase together.
    src.start(0, (id.length * 1.37) % buffer.duration)
    started++
    voices.set(id, { src, gain })
    ramp(gain.gain, level(s.layers[id]), ctx, 0.8)
  } catch (err) {
    console.warn('[audio] could not render', id, err)
  } finally {
    pending.delete(id)
    setLoading(id, false)
  }
}

function stopVoice(ctx: AudioContext, id: string, seconds = 0.6) {
  const v = voices.get(id)
  if (!v) return
  voices.delete(id)
  release(ctx, v, seconds)
}

/** Seconds the current music voice has been playing its track, including before any pause. */
const musicElapsed = (ctx: AudioContext) => (musicVoice ? musicVoice.playedBefore + (ctx.currentTime - musicVoice.startedAt) : musicPlayed)

async function startMusic(ctx: AudioContext, id: string) {
  if (musicWanted === id) return
  musicWanted = id
  setLoading(`music:${id}`, true)
  try {
    const { renderTrack } = await import('./music')
    const buffer = await renderTrack(id)
    const s = useAudio.getState()
    // Something else was asked for while this was rendering.
    if (musicWanted !== id || !s.playing || !s.music.on || s.music.track !== id) return
    if (musicVoice?.id === id) return
    const resumed = musicVoice ? 0 : musicPlayed
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(musicNode(ctx))
    src.start(0, resumed % buffer.duration)
    started++
    // The outgoing track and the incoming one cross; a resumed track just fades in with the master.
    if (musicVoice) release(ctx, musicVoice, CROSSFADE)
    ramp(gain.gain, 1, ctx, musicVoice ? CROSSFADE : 0.4)
    musicVoice = { src, gain, id, startedAt: ctx.currentTime, playedBefore: resumed }
    musicPlayed = resumed
    watchMusic(ctx)
  } catch (err) {
    console.warn('[audio] could not render track', id, err)
    // A track that cannot be made must not end the music: try the one after it.
    const s = useAudio.getState()
    if (s.music.on && s.music.track === id && queue(s.music).length > 1) setTimeout(() => useAudio.getState().nextTrack(), 0)
  } finally {
    if (musicWanted === id) musicWanted = null
    setLoading(`music:${id}`, false)
  }
}

function stopMusic(ctx: AudioContext, seconds: number, keepPlace: boolean) {
  clearInterval(advanceTimer)
  advanceTimer = undefined
  musicWanted = null
  if (!musicVoice) {
    if (!keepPlace) musicPlayed = 0
    return
  }
  musicPlayed = keepPlace ? musicElapsed(ctx) : 0
  release(ctx, musicVoice, seconds)
  musicVoice = null
}

/**
 * Move to the next track when this one has had its run. Checked on a slow
 * interval rather than scheduled exactly: being late only means the current
 * loop plays a little longer.
 */
function watchMusic(ctx: AudioContext) {
  if (advanceTimer) return
  let primed: string | null = null
  advanceTimer = setInterval(() => {
    const s = useAudio.getState()
    if (!musicVoice || !s.playing || !s.music.on) return
    const id = musicVoice.id
    void import('./music').then(({ playSeconds, renderTrack }) => {
      if (musicVoice?.id !== id) return
      const left = playSeconds(id) - musicElapsed(ctx)
      // Render the next track ahead of time, so the hand-over is immediate. (Not when shuffling: the choice is made at the hand-over.)
      if (left < 45 && primed !== id && !s.music.shuffle) {
        primed = id
        void renderTrack(following(s.music, id)).catch(() => {})
      }
      if (left <= 0 && queue(s.music).length > 1) useAudio.getState().nextTrack()
    })
  }, 2000)
}

function sync(state: AudioStore, prev: AudioStore) {
  const ctx = getAudioContext()
  if (!ctx) return
  const m = masterNode(ctx)
  // A different track starts from its beginning. (While a voice is playing, the place is read from the voice.)
  if (state.music.track !== prev.music.track) musicPlayed = 0
  if (state.playing) {
    clearTimeout(stopTimer)
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    ramp(m.gain, state.master, ctx, prev.playing ? 0.2 : FADE)
    for (const id of Object.keys(state.layers)) {
      const v = voices.get(id)
      if (v) ramp(v.gain.gain, level(state.layers[id]), ctx, 0.25)
      else void startVoice(ctx, id)
    }
    for (const id of [...voices.keys()]) if (!state.layers[id]) stopVoice(ctx, id)
    if (state.music.on) {
      ramp(musicNode(ctx).gain, state.music.volume, ctx, 0.2)
      if (musicVoice?.id !== state.music.track) void startMusic(ctx, state.music.track)
    } else if (musicVoice || musicWanted) stopMusic(ctx, 0.6, false)
  } else {
    const rewind = stopping
    const fade = rewind ? STOP_FADE : FADE
    stopping = false
    ramp(m.gain, 0, ctx, fade)
    // Note where the music is now, before the fade, so resuming carries on from what was last heard.
    if (rewind) musicPlayed = 0
    else if (musicVoice) musicPlayed = musicElapsed(ctx)
    const kept = musicPlayed
    clearTimeout(stopTimer)
    // Release every voice once silent, so nothing keeps playing (or running) unheard.
    stopTimer = setTimeout(
      () => {
        if (useAudio.getState().playing) return
        for (const id of [...voices.keys()]) stopVoice(ctx, id, 0.05)
        stopMusic(ctx, 0.05, false)
        musicPlayed = kept
      },
      fade * 1000 + 100,
    )
  }
  // Loops for layers no longer in the mix are several megabytes each: let them go.
  for (const id of Object.keys(prev.layers)) if (!state.layers[id]) void import('./sounds').then((m) => m.forgetSound(id))
  updateMediaSession(state)
}

function updateMediaSession(state: AudioStore) {
  if (!('mediaSession' in navigator)) return
  try {
    const names = Object.keys(state.layers)
      .map((id) => SOUND_META.get(id)?.name)
      .filter(Boolean)
      .join(' · ')
    const track = state.music.on ? TRACK_META.get(state.music.track)?.name : undefined
    if (state.playing && (track || names)) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track ?? names, artist: track && names ? names : track ? 'Tars study music' : 'Tars soundscape' })
      navigator.mediaSession.playbackState = 'playing'
    } else navigator.mediaSession.playbackState = 'paused'
    navigator.mediaSession.setActionHandler('play', () => useAudio.getState().play())
    navigator.mediaSession.setActionHandler('pause', () => useAudio.getState().pause())
    navigator.mediaSession.setActionHandler('stop', () => useAudio.getState().stop())
    navigator.mediaSession.setActionHandler('nexttrack', state.music.on ? () => useAudio.getState().nextTrack() : null)
    navigator.mediaSession.setActionHandler('previoustrack', state.music.on ? () => useAudio.getState().prevTrack() : null)
  } catch {
    /* unsupported action */
  }
}

/** What the engine is doing right now – for the QA suites, which check there is one voice per layer and one music voice. */
export function engineSnapshot() {
  const ctx = getAudioContext()
  return {
    voices: [...voices.keys()],
    pending: [...pending],
    music: musicVoice?.id ?? null,
    musicElapsed: ctx ? musicElapsed(ctx) : 0,
    context: ctx?.state ?? null,
    started,
  }
}

let meter: AnalyserNode | null = null
/** For tools/perf/audio-check.mjs only: read the output level, and move the music forward in its run. */
export const audioTest = {
  /** RMS of what is going to the speakers right now. */
  level(): number {
    const ctx = getAudioContext()
    if (!ctx) return 0
    if (!meter) {
      meter = ctx.createAnalyser()
      meter.fftSize = 2048
      masterNode(ctx).connect(meter)
    }
    const data = new Float32Array(meter.fftSize)
    meter.getFloatTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += v * v
    return Math.sqrt(sum / data.length)
  },
  skip(seconds: number) {
    if (musicVoice) musicVoice.playedBefore += seconds
  },
}

let installed = false
export function installAudio() {
  if (installed || typeof window === 'undefined') return
  installed = true
  useAudio.subscribe((state, prev) => {
    if (state.layers !== prev.layers || state.master !== prev.master || state.presetId !== prev.presetId || state.music !== prev.music) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ layers: state.layers, master: state.master, presetId: state.presetId, music: state.music }))
      } catch {
        /* ignore */
      }
    }
    if (state.playing !== prev.playing || state.layers !== prev.layers || state.master !== prev.master || state.music !== prev.music) sync(state, prev)
  })
  // Leaving the page (closing the tab, navigating away, bfcache): nothing may keep sounding.
  window.addEventListener('pagehide', () => {
    if (!useAudio.getState().playing) return
    useAudio.getState().stop()
  })
}
