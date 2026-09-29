import { App as CapApp } from '@capacitor/app'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { installSoundFollow, setSoundFollowsTimer } from '@/audio/follow'
import { installAudio } from '@/audio/store'
import { db } from '@/data/db'
import { useLookups, useProfiles, useSettings, useTask } from '@/data/hooks'
import { ensureSeed } from '@/data/seed'
import { cn } from '@/lib/cn'
import { isNative } from '@/lib/platform'
import { formatClock } from '@/lib/time'
import { setHapticsEnabled } from '@/services/haptics'
import { onNotificationTap } from '@/services/notifications'
import { configureReminders, startReminders } from '@/services/reminders'
import { keepAwake } from '@/services/wakelock'
import { enterFullscreen } from '@/services/fullscreen'
import { elapsedMs, remainingMs } from '@/timer/engine'
import { bootTimer, configureTimerRuntime, PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { ConfirmHost, Toaster } from '@/ui/feedback'
import { LogoMark } from '@/ui/Logo'
import { toast } from '@/ui/toast'
import { FocusScreen } from '@/features/focus/FocusScreen'
import { ImmersiveFocus } from '@/features/focus/ImmersiveFocus'
import { SessionCompleteSheet } from '@/features/focus/SessionCompleteSheet'
import { ContextSheet } from '@/features/focus/ContextSheet'
import { ProfileSheet } from '@/features/focus/ProfileSheet'
import { TasksScreen } from '@/features/tasks/TasksScreen'
import { TaskSheet } from '@/features/tasks/TaskSheet'
import { SoundSheet } from '@/features/audio/SoundSheet'
import { MusicDock } from '@/features/audio/MusicDock'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { consumeParams, navigate, useRoute, type RouteName } from './router'
import { useOnline } from '@/lib/useOnline'
import { T } from '@/ui/motion'
import { CommandPalette } from './CommandPalette'
import { BottomNav, SideNav, TimerPill } from './Shell'
import { ShortcutsSheet } from './ShortcutsSheet'
import { useGlobalShortcuts } from './shortcuts'
import { useApplyTheme } from './theme'
import { useUi } from './ui-store'

const CalendarScreen = lazy(() => import('@/features/calendar/CalendarScreen'))
const InsightsScreen = lazy(() => import('@/features/insights/InsightsScreen'))
const AtlasScreen = lazy(() => import('@/features/atlas/AtlasScreen'))
const SettingsScreen = lazy(() => import('@/features/settings/SettingsScreen'))

type BootState = 'loading' | 'ready' | 'error'

function useBoot(): BootState {
  const [state, setState] = useState<BootState>('loading')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSeed()
        // Ask the browser not to evict our local-first data under storage pressure.
        void navigator.storage?.persist?.().catch(() => {})
        bootTimer()
        installAudio()
        installSoundFollow()
        if (!cancelled) setState('ready')
      } catch (err) {
        console.error('[boot]', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export function App() {
  const boot = useBoot()
  const settings = useSettings()
  const immersive = useUi((s) => s.immersive)
  useApplyTheme(settings.theme, immersive ? 'dark' : null)

  if (boot === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <LogoMark className="size-10 text-accent" />
        <p className="font-display text-xl">Tars couldn’t open its local database.</p>
        <p className="max-w-sm text-sm text-ink-2">Private browsing modes sometimes block storage. Try a normal window, or check that site data is allowed.</p>
      </div>
    )
  }
  if (boot === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LogoMark className="size-9 animate-breathe text-accent" />
      </div>
    )
  }
  return (
    <MotionConfig reducedMotion="user">
      <Main />
    </MotionConfig>
  )
}

function Main() {
  const route = useRoute()
  const immersive = useUi((s) => s.immersive)
  useGlobalShortcuts()
  // A new screen starts at the top, not at the previous screen's scroll position.
  const firstScreen = useRef(true)
  useLayoutEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    window.scrollTo(0, 0)
  }, [route.name])
  // Focus and the Atlas size themselves to the viewport; other screens scroll the page.
  const fitted = route.name === 'atlas'
  return (
    <>
      <RuntimeSync />
      <ShellSync route={route.name} />
      <DeepLinks />
      <TitleSync />
      <SideNav route={route.name} />
      <div className="shell-offset">
        <main className={cn('mx-auto w-full', fitted ? 'min-h-0' : 'min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))]', !fitted && (route.name === 'focus' ? 'lg:pb-0' : 'lg:pb-10'))}>
          {/* Enter-only transition: the old screen leaves at once (nothing can hold it on
              screen), the new one rises in from the top of the page. */}
          <motion.div key={route.name} initial={firstScreen.current ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: T.base }}>
            <Suspense fallback={<ScreenSkeleton />}>
              <Screen name={route.name} />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <BottomNav route={route.name} />
      <TimerPill route={route.name} />
      <MusicDock />
      <TaskSheet />
      <SoundSheet />
      <SessionCompleteSheet />
      <ContextSheet />
      <ProfileSheet />
      <Onboarding />
      <AnimatePresence>{immersive && <ImmersiveFocus key="immersive" />}</AnimatePresence>
      <CommandPalette />
      <ShortcutsSheet />
      <ConfirmHost />
      <Toaster />
    </>
  )
}

/**
 * Mirrors shell state onto <html> for CSS: the sidebar width, hidden chrome for
 * the full-screen Atlas, and the calm "in session" look while focus runs.
 */
function ShellSync({ route }: { route: RouteName }) {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const atlasFullscreen = useUi((s) => s.atlasFullscreen)
  const inSession = useTimer((s) => s.timer.status === 'running' && s.timer.phase === 'focus')
  useEffect(() => {
    const root = document.documentElement.dataset
    if (collapsed) root.sidebar = 'collapsed'
    else delete root.sidebar
  }, [collapsed])
  useEffect(() => {
    const root = document.documentElement.dataset
    if (atlasFullscreen && route === 'atlas') root.chrome = 'hidden'
    else delete root.chrome
  }, [atlasFullscreen, route])
  useEffect(() => {
    const root = document.documentElement.dataset
    if (inSession && route === 'focus') root.session = 'active'
    else delete root.session
  }, [inSession, route])
  // Say when the connection comes and goes – nothing is lost either way.
  const online = useOnline()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    toast(online ? { title: 'Back online', tone: 'success' } : { title: 'You’re offline', body: 'Tars keeps working – everything is saved on this device.' })
  }, [online])
  return null
}

/** Placeholder while a screen's code loads (first visit only). */
function ScreenSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-32" />
      <div className="skeleton mt-3 h-8 w-48" />
      <div className="mt-8 space-y-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20 opacity-70" />
      </div>
    </div>
  )
}

function Screen({ name }: { name: RouteName }) {
  switch (name) {
    case 'focus':
      return <FocusScreen />
    case 'tasks':
      return <TasksScreen />
    case 'calendar':
      return <CalendarScreen />
    case 'insights':
      return <InsightsScreen />
    case 'atlas':
      return <AtlasScreen />
    case 'settings':
      return <SettingsScreen />
  }
}

/** Keeps the timer, reminders, audio and device services in step with settings and data. */
function RuntimeSync() {
  const settings = useSettings()
  const profiles = useProfiles()
  const timer = useTimer((s) => s.timer)
  const { label } = useLookups()
  const task = useTask(timer.context.taskId)

  useEffect(() => {
    configureTimerRuntime({
      minSessionMs: settings.minSessionSeconds * 1000,
      endSound: settings.endSound,
      endVolume: settings.endVolume,
      notifications: settings.notifications,
    })
    configureReminders({ notifications: settings.notifications, use24h: settings.use24h })
    setHapticsEnabled(settings.haptics)
    setSoundFollowsTimer(settings.ambientFollowsTimer)
  }, [settings])

  useEffect(() => {
    if (!profiles.length) return
    const p = profiles.find((x) => x.id === settings.activeProfileId) ?? profiles[0]
    useTimer.getState().applyProfile(p)
  }, [profiles, settings.activeProfileId])

  const labelName = label(timer.context.labelId)?.name
  useEffect(() => {
    configureTimerRuntime({ contextTitle: [labelName, task?.title].filter(Boolean).join(' · ') })
  }, [labelName, task?.title])

  useEffect(() => {
    void keepAwake(settings.keepAwake && timer.status === 'running')
  }, [settings.keepAwake, timer.status])

  // Sound follows the timer through a store subscription – see audio/follow.ts.

  // Optional: go immersive the moment a focus session starts.
  const prevStatus = useRef(timer.status)
  useEffect(() => {
    const was = prevStatus.current
    prevStatus.current = timer.status
    if (settings.immersiveOnStart && was === 'idle' && timer.status === 'running' && timer.phase === 'focus') {
      useUi.getState().set({ immersive: true })
      void enterFullscreen()
    }
  }, [timer.status, timer.phase, settings.immersiveOnStart])

  // Reminders + notification taps + native back button.
  useEffect(() => {
    const stop = startReminders((r) => navigate(r))
    onNotificationTap((r) => navigate(r))
    const onMessage = (e: MessageEvent) => {
      // 'lodestar:navigate' comes from a service worker installed before the rename to Tars.
      if ((e.data?.type === 'tars:navigate' || e.data?.type === 'lodestar:navigate') && typeof e.data.route === 'string') navigate(e.data.route)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      stop()
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  useEffect(() => {
    if (!isNative) return
    const back = CapApp.addListener('backButton', () => {
      const ui = useUi.getState()
      if (ui.immersive) return ui.set({ immersive: false })
      if (location.hash && !location.hash.startsWith('#/focus')) navigate('#/focus')
      else void CapApp.minimizeApp()
    })
    // tars://focus?start=1 → #/focus?start=1 (launcher shortcuts, links, widgets).
    // The pre-rename lodestar:// scheme stays registered for shortcuts pinned before.
    const openDeepLink = (link: string) => {
      const m = link.match(/^(?:tars|lodestar):\/\/(.*)$/i)
      if (m) navigate(`#/${m[1]}`)
    }
    const url = CapApp.addListener('appUrlOpen', ({ url }) => openDeepLink(url))
    void CapApp.getLaunchUrl().then((r) => r?.url && openDeepLink(r.url))
    return () => {
      void back.then((h) => h.remove())
      void url.then((h) => h.remove())
    }
  }, [])

  useSwUpdates()
  return null
}

function useSwUpdates() {
  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator) || import.meta.env.DEV) return
    let cancelled = false
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return
      const update = registerSW({
        onNeedRefresh() {
          toast({
            title: 'A new version is ready',
            body: 'Reload to update – your timer keeps running.',
            duration: 0,
            action: { label: 'Reload', run: () => void update(true) },
          })
        },
        onOfflineReady() {
          toast({ title: 'Ready to work offline', body: 'Tars is installed on this device.', tone: 'success' })
        },
      })
    })
    return () => {
      cancelled = true
    }
  }, [])
}

/** Handle one-shot deep links from shortcuts, notifications and reminders. */
function DeepLinks() {
  const route = useRoute()
  const params = route.params.toString()
  useEffect(() => {
    const p = route.params
    if (route.name === 'focus') {
      const blockId = p.get('block')
      if (blockId) {
        void db.events.get(blockId).then((ev) => {
          if (!ev) return
          const t = useTimer.getState()
          if (t.timer.status === 'idle') {
            t.setContext({ taskId: ev.taskId, labelId: ev.labelId })
            t.start()
          }
        })
        consumeParams('block', 'date')
      }
      if (p.get('start') === '1') {
        const t = useTimer.getState()
        if (t.timer.status !== 'running') t.start()
        consumeParams('start')
      }
    }
    if (route.name === 'tasks') {
      if (p.get('add') === '1') {
        useUi.getState().set({ quickAddOpen: true })
        consumeParams('add')
      }
      const taskId = p.get('task')
      if (taskId) {
        useUi.getState().openTask(taskId)
        consumeParams('task')
      }
    }
  }, [route.name, params])
  return null
}

/** Show the countdown in the tab title – handy on desktop. */
function TitleSync() {
  const timer = useTimer((s) => s.timer)
  const active = timer.status !== 'idle'
  const now = useNow(active)
  useEffect(() => {
    if (!active) {
      document.title = 'Tars — Study & Focus'
      return
    }
    const rem = remainingMs(timer, now)
    const t = rem === null ? formatClock(elapsedMs(timer, now) / 1000) : formatClock(Math.ceil(rem / 1000))
    document.title = `${timer.status === 'paused' ? '❚❚ ' : ''}${t} · ${PHASE_LABEL[timer.phase]} — Tars`
  }, [timer, now, active])
  return null
}

