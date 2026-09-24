import { motion } from 'motion/react'
import { Headphones, Minimize2, Pause, Play, SkipForward, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useUi } from '@/app/ui-store'
import { useAudio } from '@/audio/store'
import { useLookups, useSessions, useSettings, useTask } from '@/data/hooks'
import { skyTheme } from '@/game/progression'
import { backgroundStars, layoutWeek, SKY_H, SKY_W } from '@/game/sky'
import { cn } from '@/lib/cn'
import { formatClock, formatTimeOfDay, startOfWeekKey, todayKey } from '@/lib/time'
import { exitFullscreen } from '@/services/fullscreen'
import { elapsedMs, progress, remainingMs } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { TimeDigits } from './TimerDial'

/** Full-screen, distraction-free focus under your own night sky. */
export function ImmersiveFocus() {
  const timer = useTimer((s) => s.timer)
  const { start, pause, skip, stop } = useTimer.getState()
  const settings = useSettings()
  const theme = skyTheme(settings.skyTheme)
  const now = useNow(true)
  const { label } = useLookups()
  const task = useTask(timer.context.taskId)
  const sessions = useSessions()
  const soundPlaying = useAudio((s) => s.playing)
  const hasSounds = useAudio((s) => Object.keys(s.layers).length > 0)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const week = startOfWeekKey(todayKey(), settings.weekStartsOn)
  const constellation = useMemo(() => layoutWeek(week, sessions.filter((s) => s.date >= week), []), [sessions, week])
  const dust = useMemo(() => backgroundStars('immersive', 140), [])

  const running = timer.status === 'running'
  const rem = remainingMs(timer, now)
  const clock = rem === null ? formatClock(elapsedMs(timer, now) / 1000) : formatClock(Math.ceil(rem / 1000))
  const l = label(timer.context.labelId)
  const p = timer.status === 'idle' ? 0 : progress(timer, now)

  const poke = () => {
    setControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControls(false), 3500)
  }
  useEffect(() => {
    poke()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === ' ') {
        e.preventDefault()
        useTimer.getState().toggle()
      }
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(hideTimer.current)
    }
  }, [])

  const close = () => {
    useUi.getState().set({ immersive: false })
    void exitFullscreen()
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden text-white select-none"
      style={{ background: `linear-gradient(180deg, ${theme.stops[0]} 0%, ${theme.stops[1]} 55%, ${theme.stops[2]} 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onPointerMove={poke}
      onClick={poke}
      role="dialog"
      aria-label="Immersive focus"
    >
      <svg viewBox={`0 0 ${SKY_W} ${SKY_H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        {dust.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} className={s.twinkle ? 'animate-twinkle' : undefined} style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined} />
        ))}
        <g opacity={0.35}>
          {constellation.edges.map(([a, b], i) => (
            <line key={i} x1={constellation.stars[a].x} y1={constellation.stars[a].y} x2={constellation.stars[b].x} y2={constellation.stars[b].y} stroke={theme.line} strokeWidth={0.8} strokeOpacity={0.6} />
          ))}
          {constellation.stars.map((s) => (
            <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill={s.color} />
          ))}
        </g>
      </svg>

      {/* The forming star: a glow that gathers as the session progresses. */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.glow}55 0%, ${theme.glow}10 35%, transparent 65%)`, opacity: timer.phase === 'focus' ? 0.2 + p * 0.8 : 0.25, transition: 'opacity 1s linear' }}
      />

      <div className={cn('pt-safe relative flex items-center justify-between px-5 pt-4 transition-opacity duration-500', controls ? 'opacity-100' : 'opacity-0')}>
        <span className="tabular text-sm font-semibold text-white/60">{formatTimeOfDay(now, settings.use24h)}</span>
        <button type="button" onClick={close} className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold backdrop-blur hover:bg-white/15" aria-label="Exit immersive mode">
          <Minimize2 className="size-4" /> Exit
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-white/70">
          {l && <span className="size-2 rounded-full" style={{ background: l.color }} />}
          {[l?.name, task?.title].filter(Boolean).join(' · ') || PHASE_LABEL[timer.phase]}
        </p>
        <span role="timer" className="tabular font-display text-[clamp(84px,24vw,200px)] leading-none font-extralight tracking-tight">
          <TimeDigits text={clock} />
        </span>
        <div className="mt-8 h-[2px] w-[min(280px,60vw)] overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: theme.glow, transition: running ? 'width 1s linear' : 'width 300ms' }} />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-wide text-white/55">{timer.status === 'paused' ? 'Paused' : PHASE_LABEL[timer.phase]}</p>
        {timer.context.note && <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/60 italic">“{timer.context.note}”</p>}
      </div>

      <div className={cn('pb-safe relative flex items-center justify-center gap-4 pb-10 transition-opacity duration-500', controls ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <RoundButton label="Stop" onClick={() => stop()}>
          <Square className="size-4 fill-current" />
        </RoundButton>
        <button
          type="button"
          onClick={() => (running ? pause() : start())}
          aria-label={running ? 'Pause' : 'Start'}
          className="flex size-[72px] items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-95"
        >
          {running ? <Pause className="size-7 fill-current" strokeWidth={0} /> : <Play className="ml-1 size-7 fill-current" strokeWidth={0} />}
        </button>
        <RoundButton label="Skip" onClick={skip}>
          <SkipForward className="size-4 fill-current" />
        </RoundButton>
        {hasSounds && (
          <RoundButton label={soundPlaying ? 'Pause sounds' : 'Play sounds'} onClick={() => useAudio.getState().togglePlay()} active={soundPlaying}>
            <Headphones className="size-4" />
          </RoundButton>
        )}
      </div>
    </motion.div>
  )
}

function RoundButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('flex size-12 items-center justify-center rounded-full backdrop-blur transition-colors', active ? 'bg-white/25' : 'bg-white/10 hover:bg-white/15')}>
      {children}
    </button>
  )
}
