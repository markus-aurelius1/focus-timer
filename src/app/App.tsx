import { App as CapApp } from '@capacitor/app'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { installAudio, useAudio } from '@/audio/store'
import { db } from '@/data/db'
import { useLookups, useProfiles, useSettings, useTask } from '@/data/hooks'
import { ensureSeed } from '@/data/seed'
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
import { BottomNav, SideNav, TimerPill } from './Shell'
import { useApplyTheme } from './theme'
import { useUi } from './ui-store'

const CalendarScreen = lazy(() => import('@/features/calendar/CalendarScreen'))
const InsightsScreen = lazy(() => import('@/features/insights/InsightsScreen'))
const SkyScreen = lazy(() => import('@/features/sky/SkyScreen'))
const AtlasPreview = lazy(() => import('@/features/atlas/AtlasPreview'))
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
        <p className="font-display text-xl">Lodestar couldn’t open its local database.</p>
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
  return (
    <>
      <RuntimeSync />
      <DeepLinks />
      <TitleSync />
      <SideNav route={route.name} />
      <div className="lg:pl-60">
        <main className="mx-auto min-h-dvh w-full pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={route.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <Suspense fallback={<div className="h-[60dvh]" />}>
                <Screen name={route.name} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
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
      <ConfirmHost />
      <Toaster />
    </>
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
    case 'sky':
      return <SkyScreen />
    case 'atlas':
      return <AtlasPreview />
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

  // Soundscape follows the timer: resume when focus starts, fade out for breaks.
  const prev = useRef<{ phase: string; status: string } | null>(null)
  useEffect(() => {
    const before = prev.current
    prev.current = { phase: timer.phase, status: timer.status }
    if (!before || !settings.ambientFollowsTimer) return
    const audio = useAudio.getState()
    if (!Object.keys(audio.layers).length) return
    const focusRunning = timer.phase === 'focus' && timer.status === 'running'
    const wasFocusRunning = before.phase === 'focus' && before.status === 'running'
    if (focusRunning && !wasFocusRunning) audio.play()
    else if (!focusRunning && wasFocusRunning && (timer.phase !== 'focus' || timer.status === 'idle')) audio.pause()
  }, [timer.phase, timer.status, settings.ambientFollowsTimer])

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
      if (e.data?.type === 'lodestar:navigate' && typeof e.data.route === 'string') navigate(e.data.route)
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
    // lodestar://focus?start=1 → #/focus?start=1 (launcher shortcuts, links, widgets).
    const openDeepLink = (link: string) => {
      const m = link.match(/^lodestar:\/\/(.*)$/i)
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
          toast({ title: 'Ready to work offline', body: 'Lodestar is installed on this device.', tone: 'success' })
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
      document.title = 'Lodestar — Study & Focus'
      return
    }
    const rem = remainingMs(timer, now)
    const t = formatClock((rem ?? elapsedMs(timer, now)) / 1000)
    document.title = `${timer.status === 'paused' ? '❚❚ ' : ''}${t} · ${PHASE_LABEL[timer.phase]} — Lodestar`
  }, [timer, now, active])
  return null
}

