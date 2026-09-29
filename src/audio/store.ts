/** Layered ambient mixer + its persisted state. */
import { create } from 'zustand'
import { KEYS, migrateLegacyKeys } from '@/lib/storage'
import { getAudioContext, unlockAudio } from './context'
import { renderSound, SOUND_BY_ID } from './sounds'

const STORAGE_KEY = KEYS.audio

interface Persisted {
  layers: Record<string, number>
  master: number
  presetId: string | null
}

interface AudioStore extends Persisted {
  playing: boolean
  loading: string[]
  toggleSound: (id: string) => void
  setVolume: (id: string, volume: number) => void
  setMaster: (volume: number) => void
  play: () => void
  /** Fade out; voices are released once silent. */
  pause: () => void
  /** Quick fade and release – the next play starts every loop from the top. */
  stop: () => void
  togglePlay: () => void
  applyPreset: (layers: Array<{ sound: string; volume: number }>, presetId: string | null) => void
  clear: () => void
}

function load(): Persisted {
  migrateLegacyKeys()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Persisted
      if (p && typeof p.master === 'number' && p.layers) {
        const layers = Object.fromEntries(Object.entries(p.layers).filter(([k, v]) => SOUND_BY_ID.has(k) && typeof v === 'number'))
        return { layers, master: p.master, presetId: p.presetId ?? null }
      }
    }
  } catch {
    /* ignore */
  }
  return { layers: {}, master: 0.8, presetId: null }
}

export const useAudio = create<AudioStore>((set, get) => ({
  ...(typeof localStorage === 'undefined' ? { layers: {}, master: 0.8, presetId: null } : load()),
  playing: false,
  loading: [],
  toggleSound: (id) => {
    unlockAudio()
    const layers = { ...get().layers }
    if (layers[id] !== undefined) delete layers[id]
    else layers[id] = 0.5
    set({ layers, presetId: null, playing: Object.keys(layers).length ? true : get().playing })
  },
  setVolume: (id, volume) => set({ layers: { ...get().layers, [id]: Math.max(0, Math.min(1, volume)) }, presetId: null }),
  setMaster: (master) => set({ master: Math.max(0, Math.min(1, master)) }),
  play: () => {
    unlockAudio()
    if (Object.keys(get().layers).length) set({ playing: true })
  },
  pause: () => set({ playing: false }),
  stop: () => {
    fadeOut = STOP_FADE
    set({ playing: false })
  },
  togglePlay: () => (get().playing ? get().pause() : get().play()),
  applyPreset: (layers, presetId) => {
    unlockAudio()
    set({ layers: Object.fromEntries(layers.filter((l) => SOUND_BY_ID.has(l.sound)).map((l) => [l.sound, l.volume])), presetId, playing: true })
  },
  clear: () => set({ layers: {}, playing: false, presetId: null }),
}))

// ───────────────────────── audio graph ─────────────────────────

interface Voice {
  src: AudioBufferSourceNode
  gain: GainNode
}

const voices = new Map<string, Voice>()
const pending = new Set<string>()
let master: GainNode | null = null
let stopTimer: ReturnType<typeof setTimeout> | undefined
const FADE = 1.2
const STOP_FADE = 0.3
/** Length of the next fade-out (a stop is quicker than a pause). */
let fadeOut = FADE

function masterNode(ctx: AudioContext) {
  if (!master) {
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  return master
}

function ramp(param: AudioParam, to: number, ctx: AudioContext, seconds = FADE) {
  const now = ctx.currentTime
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.linearRampToValueAtTime(to, now + seconds)
}

async function startVoice(ctx: AudioContext, id: string) {
  if (voices.has(id) || pending.has(id)) return
  pending.add(id)
  useAudio.setState((s) => ({ loading: [...new Set([...s.loading, id])] }))
  try {
    const buffer = await renderSound(id, ctx.sampleRate)
    const s = useAudio.getState()
    if (!s.playing || s.layers[id] === undefined || voices.has(id)) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(masterNode(ctx))
    // Start each loop at a different offset so layered sounds don't phase together.
    src.start(0, (id.length * 1.37) % buffer.duration)
    voices.set(id, { src, gain })
    ramp(gain.gain, s.layers[id], ctx, 0.8)
  } catch (err) {
    console.warn('[audio] could not render', id, err)
  } finally {
    pending.delete(id)
    useAudio.setState((s) => ({ loading: s.loading.filter((x) => x !== id) }))
  }
}

function stopVoice(ctx: AudioContext, id: string) {
  const v = voices.get(id)
  if (!v) return
  voices.delete(id)
  ramp(v.gain.gain, 0, ctx, 0.6)
  setTimeout(() => {
    try {
      v.src.stop()
      v.src.disconnect()
      v.gain.disconnect()
    } catch {
      /* already stopped */
    }
  }, 700)
}

function sync(state: AudioStore) {
  const ctx = getAudioContext()
  if (!ctx) return
  const m = masterNode(ctx)
  if (state.playing) {
    clearTimeout(stopTimer)
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    ramp(m.gain, state.master, ctx)
    for (const id of Object.keys(state.layers)) {
      const v = voices.get(id)
      if (v) ramp(v.gain.gain, state.layers[id], ctx, 0.25)
      else void startVoice(ctx, id)
    }
    for (const id of [...voices.keys()]) if (state.layers[id] === undefined) stopVoice(ctx, id)
  } else {
    const fade = fadeOut
    fadeOut = FADE
    ramp(m.gain, 0, ctx, fade)
    clearTimeout(stopTimer)
    // Release every voice once silent, so nothing keeps playing (or running) unheard.
    stopTimer = setTimeout(() => {
      if (!useAudio.getState().playing) for (const id of [...voices.keys()]) stopVoice(ctx, id)
    }, fade * 1000 + 100)
  }
  updateMediaSession(state)
}

function updateMediaSession(state: AudioStore) {
  if (!('mediaSession' in navigator)) return
  try {
    const names = Object.keys(state.layers)
      .map((id) => SOUND_BY_ID.get(id)?.name)
      .filter(Boolean)
      .join(' · ')
    if (state.playing && names) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: names, artist: 'Tars soundscape' })
      navigator.mediaSession.playbackState = 'playing'
    } else navigator.mediaSession.playbackState = 'paused'
    navigator.mediaSession.setActionHandler('play', () => useAudio.getState().play())
    navigator.mediaSession.setActionHandler('pause', () => useAudio.getState().pause())
    navigator.mediaSession.setActionHandler('stop', () => useAudio.getState().stop())
  } catch {
    /* unsupported action */
  }
}

let installed = false
export function installAudio() {
  if (installed || typeof window === 'undefined') return
  installed = true
  useAudio.subscribe((state, prev) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ layers: state.layers, master: state.master, presetId: state.presetId }))
    } catch {
      /* ignore */
    }
    if (state.playing !== prev.playing || state.layers !== prev.layers || state.master !== prev.master) sync(state)
  })
  // Leaving the page (closing the tab, navigating away, bfcache): nothing may keep sounding.
  window.addEventListener('pagehide', () => {
    if (!useAudio.getState().playing) return
    useAudio.getState().stop()
  })
}
