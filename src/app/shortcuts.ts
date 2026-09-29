/**
 * App-wide keyboard shortcuts. Screen-specific keys (Space on the timer, arrows
 * on the map…) live with their screens; this handles the global ones and lists
 * everything for the shortcuts reference (press ?).
 */
import { useEffect } from 'react'
import { useTimer } from '@/timer/store'
import { navigate, type RouteName } from './router'
import { useUi } from './ui-store'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
/** How the platform's command key is written in hints. */
export const modKey = isMac ? '⌘' : 'Ctrl '

export interface ShortcutGroup {
  title: string
  /** `join` says how several keys combine: pressed one after another, or alternatives. */
  items: Array<{ keys: string[]; label: string; join?: 'then' | 'or' }>
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Anywhere',
    items: [
      { keys: [`${modKey}K`], label: 'Search and commands' },
      { keys: ['N'], label: 'New task' },
      { keys: [`${modKey}\\`], label: 'Collapse or expand the sidebar' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close a dialog' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['G', 'F'], label: 'Focus' },
      { keys: ['G', 'T'], label: 'Tasks' },
      { keys: ['G', 'A'], label: 'Atlas' },
      { keys: ['G', 'C'], label: 'Calendar' },
      { keys: ['G', 'I'], label: 'Insights' },
      { keys: ['G', 'S'], label: 'Settings' },
    ],
  },
  {
    title: 'Timer',
    items: [
      { keys: ['Space'], label: 'Start or pause (on the Focus screen)' },
      { keys: ['F'], label: 'Immersive full-screen focus' },
      { keys: ['S'], label: 'Sounds' },
    ],
  },
  {
    title: 'Atlas',
    items: [
      { keys: ['Shift+F'], label: 'Full-screen map' },
      { keys: ['+', '−'], label: 'Zoom in and out', join: 'or' },
      { keys: ['←', '↑', '→', '↓'], label: 'Pan the map', join: 'or' },
    ],
  },
]

const GO: Record<string, RouteName> = { f: 'focus', t: 'tasks', a: 'atlas', c: 'calendar', i: 'insights', s: 'settings' }

/** True when a key press is meant for a text field, not for a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"], [role="combobox"]')
}

let chord = 0
/** A "G then …" chord has started – screen shortcuts should leave the next key alone. */
export const chordPending = () => chord > 0 && Date.now() - chord < 1200

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      const mod = isMac ? e.metaKey : e.ctrlKey
      // ⌘K / Ctrl+K works even while typing – it's how you get out.
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.set({ paletteOpen: !ui.paletteOpen })
        return
      }
      if (mod && !e.altKey && e.key === '\\') {
        e.preventDefault()
        ui.toggleSidebar()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.defaultPrevented) return
      // Dialogs own the keyboard while open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]') || ui.immersive) return

      const key = e.key.toLowerCase()
      if (chord && Date.now() - chord < 1200 && GO[key]) {
        e.preventDefault()
        chord = 0
        navigate(`#/${GO[key]}`)
        return
      }
      chord = 0
      if (key === 'g' && !e.shiftKey) {
        chord = Date.now()
      } else if (e.key === '?') {
        e.preventDefault()
        ui.set({ shortcutsOpen: true })
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault()
        ui.newTask({ plannedFor: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Start or pause from anywhere (command palette, media keys). */
export function toggleTimer() {
  useTimer.getState().toggle()
}
