/**
 * What there is to listen to: the ambient sounds and the study-music tracks,
 * as names and categories only. This file is small and safe to import
 * anywhere; the synthesis that makes the audio lives in sounds.ts and music.ts
 * and is loaded the first time something is played.
 *
 * Everything is generated on the device from these definitions – there are no
 * audio files, nothing to download and nothing to license.
 */

export type SoundCategory = 'weather' | 'water' | 'forest' | 'nature' | 'night' | 'fire' | 'cafe' | 'urban' | 'transport' | 'noise'

export interface SoundMeta {
  id: string
  name: string
  category: SoundCategory
}

export const SOUND_CATEGORIES: Array<{ id: SoundCategory; name: string }> = [
  { id: 'weather', name: 'Weather' },
  { id: 'water', name: 'Water' },
  { id: 'forest', name: 'Forest' },
  { id: 'nature', name: 'Nature' },
  { id: 'night', name: 'Night' },
  { id: 'fire', name: 'Fire' },
  { id: 'cafe', name: 'Café & study' },
  { id: 'urban', name: 'Urban' },
  { id: 'transport', name: 'Transport' },
  { id: 'noise', name: 'Noise & tones' },
]

export const SOUND_LIST: SoundMeta[] = [
  { id: 'rain', name: 'Rain', category: 'weather' },
  { id: 'heavy-rain', name: 'Heavy rain', category: 'weather' },
  { id: 'rain-window', name: 'Rain on the window', category: 'weather' },
  { id: 'thunder', name: 'Thunder', category: 'weather' },
  { id: 'wind', name: 'Wind', category: 'weather' },
  { id: 'blizzard', name: 'Snowstorm', category: 'weather' },
  { id: 'waves', name: 'Ocean', category: 'water' },
  { id: 'stream', name: 'Stream', category: 'water' },
  { id: 'waterfall', name: 'Waterfall', category: 'water' },
  { id: 'lake', name: 'Lakeside', category: 'water' },
  { id: 'drip', name: 'Cave drips', category: 'water' },
  { id: 'birds', name: 'Birdsong', category: 'forest' },
  { id: 'leaves', name: 'Rustling leaves', category: 'forest' },
  { id: 'cicadas', name: 'Cicadas', category: 'forest' },
  { id: 'meadow', name: 'Summer meadow', category: 'nature' },
  { id: 'frogs', name: 'Pond frogs', category: 'nature' },
  { id: 'night', name: 'Night crickets', category: 'night' },
  { id: 'owl', name: 'Owl in the dark', category: 'night' },
  { id: 'fire', name: 'Fireplace', category: 'fire' },
  { id: 'campfire', name: 'Campfire', category: 'fire' },
  { id: 'cafe', name: 'Café murmur', category: 'cafe' },
  { id: 'cups', name: 'Cups and saucers', category: 'cafe' },
  { id: 'keyboard', name: 'Typing', category: 'cafe' },
  { id: 'pages', name: 'Library pages', category: 'cafe' },
  { id: 'clock', name: 'Study clock', category: 'cafe' },
  { id: 'city', name: 'City hum', category: 'urban' },
  { id: 'fan', name: 'Ceiling fan', category: 'urban' },
  { id: 'train', name: 'Train carriage', category: 'transport' },
  { id: 'plane', name: 'Aeroplane cabin', category: 'transport' },
  { id: 'car', name: 'Night drive', category: 'transport' },
  { id: 'white', name: 'White noise', category: 'noise' },
  { id: 'pink', name: 'Pink noise', category: 'noise' },
  { id: 'brown', name: 'Brown noise', category: 'noise' },
  { id: 'drone', name: 'Alpha drone', category: 'noise' },
]

export const SOUND_META = new Map(SOUND_LIST.map((s) => [s.id, s]))

// ───────────────────────── study music ─────────────────────────

export type MusicGenre = 'lofi' | 'piano' | 'ambient' | 'synth' | 'deep' | 'rain'

export const MUSIC_GENRES: Array<{ id: MusicGenre; name: string; about: string }> = [
  { id: 'lofi', name: 'Lo-fi', about: 'Dusty keys, soft drums' },
  { id: 'piano', name: 'Piano', about: 'Slow, unhurried piano' },
  { id: 'ambient', name: 'Ambient', about: 'Pads and distant bells' },
  { id: 'synth', name: 'Synth', about: 'Warm arpeggios' },
  { id: 'deep', name: 'Deep focus', about: 'Low drones, nothing to follow' },
  { id: 'rain', name: 'Rain-backed', about: 'Keys with rain behind them' },
]

export interface TrackMeta {
  id: string
  name: string
  genre: MusicGenre
}

/** Names only; music.ts turns each id into a piece (tempo, key, progression, parts) deterministically. */
export const MUSIC_TRACKS: TrackMeta[] = [
  { id: 'lofi-desk-lamp', name: 'Desk lamp', genre: 'lofi' },
  { id: 'lofi-second-cup', name: 'Second cup', genre: 'lofi' },
  { id: 'lofi-margin-notes', name: 'Margin notes', genre: 'lofi' },
  { id: 'lofi-late-bus', name: 'Late bus', genre: 'lofi' },
  { id: 'lofi-paper-planes', name: 'Paper planes', genre: 'lofi' },
  { id: 'lofi-window-seat', name: 'Window seat', genre: 'lofi' },
  { id: 'lofi-slow-sunday', name: 'Slow Sunday', genre: 'lofi' },
  { id: 'lofi-index-cards', name: 'Index cards', genre: 'lofi' },
  { id: 'piano-first-light', name: 'First light', genre: 'piano' },
  { id: 'piano-open-book', name: 'Open book', genre: 'piano' },
  { id: 'piano-quiet-hall', name: 'Quiet hall', genre: 'piano' },
  { id: 'piano-long-walk', name: 'Long walk', genre: 'piano' },
  { id: 'piano-still-water', name: 'Still water', genre: 'piano' },
  { id: 'piano-half-moon', name: 'Half moon', genre: 'piano' },
  { id: 'ambient-high-plateau', name: 'High plateau', genre: 'ambient' },
  { id: 'ambient-slow-tide', name: 'Slow tide', genre: 'ambient' },
  { id: 'ambient-glass-air', name: 'Glass air', genre: 'ambient' },
  { id: 'ambient-far-shore', name: 'Far shore', genre: 'ambient' },
  { id: 'ambient-snow-line', name: 'Snow line', genre: 'ambient' },
  { id: 'ambient-blue-hour', name: 'Blue hour', genre: 'ambient' },
  { id: 'synth-night-map', name: 'Night map', genre: 'synth' },
  { id: 'synth-soft-grid', name: 'Soft grid', genre: 'synth' },
  { id: 'synth-low-orbit', name: 'Low orbit', genre: 'synth' },
  { id: 'synth-meridian', name: 'Meridian', genre: 'synth' },
  { id: 'synth-warm-circuit', name: 'Warm circuit', genre: 'synth' },
  { id: 'deep-undertow', name: 'Undertow', genre: 'deep' },
  { id: 'deep-long-room', name: 'Long room', genre: 'deep' },
  { id: 'deep-bedrock', name: 'Bedrock', genre: 'deep' },
  { id: 'deep-held-breath', name: 'Held breath', genre: 'deep' },
  { id: 'deep-night-shift', name: 'Night shift', genre: 'deep' },
  { id: 'rain-attic-keys', name: 'Attic keys', genre: 'rain' },
  { id: 'rain-grey-morning', name: 'Grey morning', genre: 'rain' },
  { id: 'rain-tin-roof', name: 'Tin roof', genre: 'rain' },
  { id: 'rain-lamplight', name: 'Lamplight', genre: 'rain' },
  { id: 'rain-last-train', name: 'Last train', genre: 'rain' },
  { id: 'rain-monsoon-desk', name: 'Monsoon desk', genre: 'rain' },
]

export const TRACK_META = new Map(MUSIC_TRACKS.map((t) => [t.id, t]))

// ───────────────────────── ready-made mixes ─────────────────────────

/** Ambient mixes that come with the app. Mixes a learner saves are in the database (audioPresets). */
export const MIXES: Array<{ id: string; name: string; layers: Array<{ sound: string; volume: number }> }> = [
  { id: 'mix:monsoon-study', name: 'Monsoon study', layers: [{ sound: 'heavy-rain', volume: 0.55 }, { sound: 'thunder', volume: 0.3 }, { sound: 'fan', volume: 0.2 }] },
  { id: 'mix:night-train', name: 'Night train', layers: [{ sound: 'train', volume: 0.6 }, { sound: 'rain-window', volume: 0.35 }] },
  { id: 'mix:mountain-cabin', name: 'Mountain cabin', layers: [{ sound: 'campfire', volume: 0.55 }, { sound: 'blizzard', volume: 0.35 }] },
  { id: 'mix:library-afternoon', name: 'Library afternoon', layers: [{ sound: 'pages', volume: 0.5 }, { sound: 'clock', volume: 0.2 }, { sound: 'keyboard', volume: 0.2 }] },
  { id: 'mix:lakeside-dawn', name: 'Lakeside dawn', layers: [{ sound: 'lake', volume: 0.55 }, { sound: 'birds', volume: 0.35 }, { sound: 'leaves', volume: 0.25 }] },
  { id: 'mix:summer-night', name: 'Summer night', layers: [{ sound: 'night', volume: 0.45 }, { sound: 'frogs', volume: 0.3 }, { sound: 'owl', volume: 0.2 }] },
  { id: 'mix:long-haul', name: 'Long-haul flight', layers: [{ sound: 'plane', volume: 0.6 }, { sound: 'brown', volume: 0.2 }] },
  { id: 'mix:city-window', name: 'City window', layers: [{ sound: 'city', volume: 0.5 }, { sound: 'rain-window', volume: 0.4 }] },
  { id: 'mix:cafe-table', name: 'Café table', layers: [{ sound: 'cafe', volume: 0.55 }, { sound: 'cups', volume: 0.35 }, { sound: 'keyboard', volume: 0.2 }] },
  { id: 'mix:waterfall-trail', name: 'Waterfall trail', layers: [{ sound: 'waterfall', volume: 0.5 }, { sound: 'leaves', volume: 0.3 }, { sound: 'birds', volume: 0.25 }] },
  { id: 'mix:rainy-drive', name: 'Rainy drive', layers: [{ sound: 'car', volume: 0.5 }, { sound: 'heavy-rain', volume: 0.4 }] },
  { id: 'mix:meadow-noon', name: 'Meadow noon', layers: [{ sound: 'meadow', volume: 0.5 }, { sound: 'cicadas', volume: 0.25 }, { sound: 'wind', volume: 0.2 }] },
  { id: 'mix:deep-cave', name: 'Deep cave', layers: [{ sound: 'drip', volume: 0.5 }, { sound: 'drone', volume: 0.2 }] },
  { id: 'mix:storm-shelter', name: 'Storm shelter', layers: [{ sound: 'thunder', volume: 0.45 }, { sound: 'heavy-rain', volume: 0.5 }, { sound: 'fire', volume: 0.35 }] },
]
