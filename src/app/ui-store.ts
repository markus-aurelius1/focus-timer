/** Global UI state: which sheets are open and cross-screen intents. */
import { create } from 'zustand'
import { KEYS } from '@/lib/storage'

type TaskDraft = { plannedFor?: string | null; projectId?: string | null; labelId?: string | null; title?: string }

interface UiStore {
  taskSheet: { id: string | null; draft?: TaskDraft } | null
  soundOpen: boolean
  contextOpen: boolean
  profileOpen: boolean
  immersive: boolean
  quickAddOpen: boolean
  /** Quick capture: a note or a task, from anywhere (C). */
  captureOpen: boolean
  /** Command palette (Ctrl/⌘ K). */
  paletteOpen: boolean
  /** Keyboard shortcuts reference (?). */
  shortcutsOpen: boolean
  /** The navigation rail shows icons only (persisted; always so on tablets). */
  sidebarCollapsed: boolean
  /** The Atlas fills the screen: app chrome (sidebar, tab bar) steps aside. */
  atlasFullscreen: boolean
  openTask: (id: string) => void
  newTask: (draft?: TaskDraft) => void
  closeTask: () => void
  toggleSidebar: () => void
  set: (patch: Partial<Omit<UiStore, 'set' | 'openTask' | 'newTask' | 'closeTask' | 'toggleSidebar'>>) => void
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEYS.sidebar) === '1'
  } catch {
    return false
  }
}

export const useUi = create<UiStore>((set, get) => ({
  taskSheet: null,
  soundOpen: false,
  contextOpen: false,
  profileOpen: false,
  immersive: false,
  quickAddOpen: false,
  captureOpen: false,
  paletteOpen: false,
  shortcutsOpen: false,
  sidebarCollapsed: typeof localStorage === 'undefined' ? false : readCollapsed(),
  atlasFullscreen: false,
  openTask: (id) => set({ taskSheet: { id } }),
  newTask: (draft) => set({ taskSheet: { id: null, draft } }),
  closeTask: () => set({ taskSheet: null }),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    try {
      localStorage.setItem(KEYS.sidebar, next ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  },
  set: (patch) => set(patch),
}))
