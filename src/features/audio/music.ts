import { create } from 'zustand'
import { useAudio } from '@/audio/store'
import type { Playlist } from '@/data/types'

interface MusicStore {
  current: Pick<Playlist, 'id' | 'title' | 'url' | 'provider'> | null
  minimized: boolean
  play: (p: Pick<Playlist, 'id' | 'title' | 'url' | 'provider'>) => void
  close: () => void
  setMinimized: (m: boolean) => void
}

export const useMusic = create<MusicStore>((set) => ({
  current: null,
  minimized: false,
  play: (current) => {
    // One thing plays at a time: the video replaces the soundscape.
    if (useAudio.getState().playing) useAudio.getState().pause()
    set({ current, minimized: false })
  },
  close: () => set({ current: null, minimized: false }),
  setMinimized: (minimized) => set({ minimized }),
}))

/** Open a link in the system browser / the YouTube Music app. */
export function openExternal(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
