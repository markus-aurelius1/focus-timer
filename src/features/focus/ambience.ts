/**
 * The look of the Focus screen: which wallpaper is behind the clock, and the
 * line under it. Kept on this device (localStorage), not in the database – it
 * is a taste, not study data.
 *
 * The wallpaper catalogue (a few hundred generated scenes) and the quotes are
 * separate chunks, loaded the first time the Focus screen needs them; nothing
 * here is paid for at start-up.
 */
import { create } from 'zustand'
import { once } from '@/lib/lazy'
import { hashString } from '@/lib/random'
import { todayKey } from '@/lib/time'

const KEY = 'tars.focus.ambience'

interface Saved {
  /** A chosen wallpaper id; null follows the day (a different one each day). */
  wallpaper: string | null
  /** No wallpaper at all: the plain stage, in the app's own colours. */
  plain: boolean
  /** Show a line under the clock. */
  quotes: boolean
  /** How strongly the picture is dimmed behind the clock, 0–1. */
  dim: number
}

interface AmbienceStore extends Saved {
  /** How many times "another quote" was pressed today (added to the day's pick). */
  quoteStep: number
  /** Wallpapers shown before the current one, most recent last (for "previous"). */
  back: string[]
  set: (patch: Partial<Saved>) => void
  show: (id: string) => void
  next: () => Promise<void>
  previous: () => Promise<void>
  random: () => Promise<void>
  nextQuote: () => void
}

const DEFAULTS: Saved = { wallpaper: null, plain: false, quotes: true, dim: 0.5 }

function load(): Saved {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const v = JSON.parse(raw) as Partial<Saved>
    return {
      wallpaper: typeof v.wallpaper === 'string' ? v.wallpaper : null,
      plain: !!v.plain,
      quotes: v.quotes !== false,
      dim: typeof v.dim === 'number' && v.dim >= 0 && v.dim <= 1 ? v.dim : DEFAULTS.dim,
    }
  } catch {
    return DEFAULTS
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ wallpaper: s.wallpaper, plain: s.plain, quotes: s.quotes, dim: s.dim }))
  } catch {
    /* storage unavailable: the choice lasts for this page */
  }
}

/** The wallpaper catalogue and renderer (its own chunk). */
export const loadScenes = once(() => import('./wallpaper/scenes'))
/** The quotes (their own chunk). */
export const loadQuotes = once(() => import('./quotes').then((m) => m.QUOTES))

/** The same pick for everyone on a given day: stable through the day, new tomorrow. */
export function pickOfTheDay(count: number, day: string = todayKey(), salt = ''): number {
  return count ? hashString(`${day}:${salt}`) % count : 0
}

export const useAmbience = create<AmbienceStore>((set, get) => {
  const update = (patch: Partial<AmbienceStore>) => {
    set(patch)
    save(get())
  }
  /** The id on screen now: the chosen one, or today's. */
  const current = async () => {
    const { WALLPAPERS } = await loadScenes()
    return get().wallpaper ?? WALLPAPERS[pickOfTheDay(WALLPAPERS.length, todayKey(), 'wallpaper')].id
  }
  const go = async (to: (index: number, count: number) => number) => {
    const { WALLPAPERS } = await loadScenes()
    const now = await current()
    const i = Math.max(0, WALLPAPERS.findIndex((w) => w.id === now))
    update({ wallpaper: WALLPAPERS[to(i, WALLPAPERS.length)].id, plain: false, back: [...get().back.slice(-30), now] })
  }
  return {
    ...load(),
    quoteStep: 0,
    back: [],
    set: (patch) => update(patch),
    show: (id) => {
      const before = get().wallpaper
      update({ wallpaper: id, plain: false, back: before ? [...get().back.slice(-30), before] : get().back })
    },
    next: () => go((i, n) => (i + 1) % n),
    previous: async () => {
      const back = get().back
      // "Previous" retraces what was actually shown; with no history it steps back through the catalogue.
      if (back.length) update({ wallpaper: back[back.length - 1], plain: false, back: back.slice(0, -1) })
      else await go((i, n) => (i - 1 + n) % n)
    },
    random: () => go((i, n) => (i + 1 + Math.floor(Math.random() * (n - 1))) % n),
    nextQuote: () => set({ quoteStep: get().quoteStep + 1 }),
  }
})
