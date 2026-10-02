/**
 * The app-wide dialogs and floating surfaces: the task editor, sounds, timer
 * profiles, session context, session complete, quick capture, onboarding, the
 * command palette, the shortcuts sheet and the music dock.
 *
 * None of them is in the entry chunk. Each is rendered from the first time it
 * is needed (and stays mounted afterwards, so its closing animation plays), and
 * its code is fetched in idle time after start-up so that first use is instant.
 */
import { Suspense, useEffect, useState, type ComponentType } from 'react'
import { useSettings } from '@/data/hooks'
import { useMusic } from '@/features/audio/music'
import { lazyScreen, whenIdle, type Preloadable } from '@/lib/lazy'
import { useTimer } from '@/timer/store'
import { useUi } from './ui-store'

type Overlay = Preloadable<ComponentType<object>>

const TaskSheet = lazyScreen(() => import('@/features/tasks/TaskSheet').then((m) => ({ default: m.TaskSheet })))
const SoundSheet = lazyScreen(() => import('@/features/audio/SoundSheet').then((m) => ({ default: m.SoundSheet })))
const SessionCompleteSheet = lazyScreen(() => import('@/features/focus/SessionCompleteSheet').then((m) => ({ default: m.SessionCompleteSheet })))
const ContextSheet = lazyScreen(() => import('@/features/focus/ContextSheet').then((m) => ({ default: m.ContextSheet })))
const ProfileSheet = lazyScreen(() => import('@/features/focus/ProfileSheet').then((m) => ({ default: m.ProfileSheet })))
const QuickCapture = lazyScreen(() => import('@/features/notes/QuickCapture').then((m) => ({ default: m.QuickCapture })))
const Onboarding = lazyScreen(() => import('@/features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })))
const CommandPalette = lazyScreen(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))
const ShortcutsSheet = lazyScreen(() => import('./ShortcutsSheet').then((m) => ({ default: m.ShortcutsSheet })))
const MusicDock = lazyScreen(() => import('@/features/audio/MusicDock').then((m) => ({ default: m.MusicDock })))

/** Most likely first: the palette and capture are a keystroke away on every screen. */
const IDLE_ORDER: Overlay[] = [CommandPalette, QuickCapture, TaskSheet, ContextSheet, SessionCompleteSheet, SoundSheet, ProfileSheet, ShortcutsSheet, MusicDock]

/** Renders `of` from the first time `when` is true. */
function From({ when, of: Component }: { when: boolean; of: Overlay }) {
  const [seen, setSeen] = useState(when)
  if (when && !seen) setSeen(true)
  if (!seen) return null
  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  )
}

export function Overlays() {
  const ui = useUi()
  const settings = useSettings()
  const hasSession = useTimer((s) => !!s.lastSession)
  const music = useMusic((s) => !!s.current)

  useEffect(() => {
    let i = 0
    let cancel = () => {}
    const next = () => {
      if (i >= IDLE_ORDER.length) return
      cancel = whenIdle(() => {
        IDLE_ORDER[i++].preload()
        next()
      }, 2500)
    }
    // After the screens (app/screens.tsx): what is on screen comes first.
    const start = setTimeout(next, 1200)
    return () => {
      clearTimeout(start)
      cancel()
    }
  }, [])

  return (
    <>
      <From when={music} of={MusicDock} />
      <From when={!!ui.taskSheet} of={TaskSheet} />
      <From when={ui.soundOpen} of={SoundSheet} />
      <From when={hasSession} of={SessionCompleteSheet} />
      <From when={ui.contextOpen} of={ContextSheet} />
      <From when={ui.profileOpen} of={ProfileSheet} />
      <From when={ui.captureOpen} of={QuickCapture} />
      <From when={settings.updatedAt > 0 && !settings.onboarded} of={Onboarding} />
      <From when={ui.paletteOpen} of={CommandPalette} />
      <From when={ui.shortcutsOpen} of={ShortcutsSheet} />
    </>
  )
}
