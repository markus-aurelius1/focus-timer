/** Global UI state: which sheets are open and cross-screen intents. */
import { create } from 'zustand'

interface UiStore {
  taskSheet: { id: string | null; draft?: { plannedFor?: string | null; projectId?: string | null; labelId?: string | null } } | null
  soundOpen: boolean
  contextOpen: boolean
  profileOpen: boolean
  immersive: boolean
  quickAddOpen: boolean
  openTask: (id: string) => void
  newTask: (draft?: { plannedFor?: string | null; projectId?: string | null; labelId?: string | null }) => void
  closeTask: () => void
  set: (patch: Partial<Omit<UiStore, 'set' | 'openTask' | 'newTask' | 'closeTask'>>) => void
}

export const useUi = create<UiStore>((set) => ({
  taskSheet: null,
  soundOpen: false,
  contextOpen: false,
  profileOpen: false,
  immersive: false,
  quickAddOpen: false,
  openTask: (id) => set({ taskSheet: { id } }),
  newTask: (draft) => set({ taskSheet: { id: null, draft } }),
  closeTask: () => set({ taskSheet: null }),
  set: (patch) => set(patch),
}))
