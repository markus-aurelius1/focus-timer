import { describe, expect, it } from 'vitest'
import { BUILT_IN_AUDIO } from '@/data/seed'
import { MIXES, MUSIC_GENRES, MUSIC_TRACKS, SOUND_CATEGORIES, SOUND_LIST, SOUND_META } from './catalog'
import { playSeconds, trackSeconds } from './music'
import { SOUNDS } from './sounds'
import { following, parsePersisted, queue, type MusicState } from './store'

describe('sound catalog', () => {
  it('lists exactly the sounds that can be rendered', () => {
    expect(SOUND_LIST.map((s) => s.id).sort()).toEqual(SOUNDS.map((s) => s.id).sort())
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length)
  })

  it('has every category filled and every sound in a known category', () => {
    const categories = new Set(SOUND_CATEGORIES.map((c) => c.id))
    for (const s of SOUND_LIST) expect(categories.has(s.category), s.id).toBe(true)
    for (const c of SOUND_CATEGORIES) expect(SOUND_LIST.filter((s) => s.category === c.id).length, c.id).toBeGreaterThanOrEqual(2)
  })

  it('names are unique', () => {
    expect(new Set(SOUND_LIST.map((s) => s.name)).size).toBe(SOUND_LIST.length)
  })

  it('mixes only use sounds that exist, at sensible levels', () => {
    for (const mix of [...MIXES, ...BUILT_IN_AUDIO]) {
      expect(mix.layers.length).toBeGreaterThan(0)
      for (const l of mix.layers) {
        expect(SOUND_META.has(l.sound), `${mix.name}: ${l.sound}`).toBe(true)
        expect(l.volume).toBeGreaterThan(0)
        expect(l.volume).toBeLessThanOrEqual(1)
      }
    }
    expect(new Set(MIXES.map((m) => m.id)).size).toBe(MIXES.length)
  })
})

describe('study music', () => {
  it('has unique tracks in every genre', () => {
    expect(new Set(MUSIC_TRACKS.map((t) => t.id)).size).toBe(MUSIC_TRACKS.length)
    expect(new Set(MUSIC_TRACKS.map((t) => t.name)).size).toBe(MUSIC_TRACKS.length)
    for (const g of MUSIC_GENRES) expect(MUSIC_TRACKS.filter((t) => t.genre === g.id).length, g.id).toBeGreaterThanOrEqual(5)
  })

  it('every track is a loop of a sensible length that plays for a few minutes', () => {
    for (const t of MUSIC_TRACKS) {
      const loop = trackSeconds(t.id)
      expect(loop, t.id).toBeGreaterThan(15)
      expect(loop, t.id).toBeLessThan(45)
      const run = playSeconds(t.id)
      expect(run, t.id).toBeGreaterThanOrEqual(150)
      expect(run, t.id).toBeLessThanOrEqual(270)
      // Whole loops, so the hand-over falls on a bar line.
      expect(Math.abs(run / loop - Math.round(run / loop))).toBeLessThan(1e-9)
    }
  })

  it('is the same piece every time', () => {
    expect(trackSeconds('lofi-desk-lamp')).toBe(trackSeconds('lofi-desk-lamp'))
  })

  const music = (over: Partial<MusicState> = {}): MusicState => ({ on: true, track: MUSIC_TRACKS[0].id, genre: 'all', volume: 0.6, shuffle: false, ...over })

  it('moves through the queue in order and wraps round', () => {
    const all = queue(music())
    expect(following(music(), all[0].id)).toBe(all[1].id)
    expect(following(music(), all[all.length - 1].id)).toBe(all[0].id)
    const piano = queue(music({ genre: 'piano' }))
    expect(piano.every((t) => t.genre === 'piano')).toBe(true)
    expect(following(music({ genre: 'piano' }), piano[piano.length - 1].id)).toBe(piano[0].id)
  })

  it('never repeats the current track when shuffling', () => {
    const m = music({ shuffle: true, genre: 'deep' })
    const current = queue(m)[2].id
    for (let i = 0; i < 50; i++) {
      const next = following(m, current, () => i / 50)
      expect(next).not.toBe(current)
      expect(queue(m).some((t) => t.id === next)).toBe(true)
    }
  })
})

describe('saved audio state', () => {
  it('reads the earlier shape, where a layer was just a volume', () => {
    const p = parsePersisted(JSON.stringify({ layers: { rain: 0.65, brown: 0.2, gone: 0.5 }, master: 0.7, presetId: 'abc' }))
    expect(p.layers).toEqual({ rain: { volume: 0.65, muted: false }, brown: { volume: 0.2, muted: false } })
    expect(p.master).toBe(0.7)
    expect(p.presetId).toBe('abc')
    expect(p.music.on).toBe(false)
    expect(MUSIC_TRACKS.some((t) => t.id === p.music.track)).toBe(true)
  })

  it('reads the current shape and repairs what it cannot use', () => {
    const p = parsePersisted(JSON.stringify({ layers: { rain: { volume: 2, muted: true }, wind: { volume: 'x' } }, master: 0.5, presetId: null, music: { on: true, track: 'no-such-track', genre: 'jazz', volume: 0.3, shuffle: true } }))
    expect(p.layers).toEqual({ rain: { volume: 1, muted: true } })
    expect(p.music).toMatchObject({ on: true, genre: 'all', volume: 0.3, shuffle: true })
    expect(MUSIC_TRACKS.some((t) => t.id === p.music.track)).toBe(true)
  })

  it('falls back to defaults for nothing or nonsense', () => {
    for (const raw of [null, '', '{', '[]', '{"layers":null,"master":1}']) {
      const p = parsePersisted(raw)
      expect(p.layers).toEqual({})
      expect(p.music.on).toBe(false)
    }
  })
})
