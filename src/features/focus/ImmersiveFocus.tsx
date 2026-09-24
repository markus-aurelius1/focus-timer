import { motion } from 'motion/react'
import { Headphones, Minimize2, Pause, Play, SkipForward, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useUi } from '@/app/ui-store'
import { useAudio } from '@/audio/store'
import { useLookups, useSettings, useTask } from '@/data/hooks'
import { useSheet } from '@/atlas/sheet'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { cn } from '@/lib/cn'
import { formatClock, formatTimeOfDay } from '@/lib/time'
import { exitFullscreen } from '@/services/fullscreen'
import { elapsedMs, progress, remainingMs } from '@/timer/engine'
import { PHASE_LABEL, useTimer } from '@/timer/store'
import { useNow } from '@/timer/useNow'
import { TimeDigits } from './TimerDial'

const GOLD = '#f2c46d'

/** Full-screen, distraction-free focus over your expedition's map, the route inking forward as you work. */
export function ImmersiveFocus() {
  const timer = useTimer((s) => s.timer)
  const { start, pause, skip, stop } = useTimer.getState()
  const settings = useSettings()
  const now = useNow(true)
  const { label } = useLookups()
  const task = useTask(timer.context.taskId)
  const ex = useExploration()
  const soundPlaying = useAudio((s) => s.playing)
  const hasSounds = useAudio((s) => Object.keys(s.layers).length > 0)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const focusMinutes = timer.phase === 'focus' && timer.status !== 'idle' ? elapsedMs(timer, now) / 60000 : 0

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
      style={{ background: 'linear-gradient(180deg, #070b16 0%, #0c1426 60%, #111c33 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onPointerMove={poke}
      onClick={poke}
      role="dialog"
      aria-label="Immersive focus"
    >
      {ex && <ExpeditionBackdrop ex={ex} extraMinutes={focusMinutes} />}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(7,11,22,0.25) 0%, rgba(7,11,22,0.78) 70%, rgba(7,11,22,0.92) 100%)' }} />

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
          <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: GOLD, transition: running ? 'width 1s linear' : 'width 300ms' }} />
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

/**
 * The active expedition's current leg, drawn as a night chart: reached stops
 * in gold, and the line to the next stop inking forward with this session.
 */
function ExpeditionBackdrop({ ex, extraMinutes }: { ex: Exploration; extraMinutes: number }) {
  const a = ex.state.active
  const sheetId = a?.expedition.sheet ?? 'india'
  const { sheet } = useSheet(sheetId)
  const leg = useMemo(() => {
    if (!a || !a.stops.length) return null
    const nextIdx = a.next ? a.stops.indexOf(a.next.stop) : a.stops.length - 1
    const from = Math.max(0, nextIdx - 3)
    const to = Math.min(a.stops.length - 1, nextIdx + 2)
    const shown = a.stops.slice(from, to + 1)
    const xs = shown.map((s) => s.place.x)
    const ys = shown.map((s) => s.place.y)
    const pad = 90
    let [x0, y0, x1, y1] = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
    // Keep a sensible minimum extent so a short leg isn't blown up.
    const minW = 420
    if (x1 - x0 < minW) {
      const cx = (x0 + x1) / 2
      x0 = cx - minW / 2
      x1 = cx + minW / 2
    }
    if (y1 - y0 < minW * 0.7) {
      const cy = (y0 + y1) / 2
      y0 = cy - minW * 0.35
      y1 = cy + minW * 0.35
    }
    return { shown, nextIdx, box: [x0, y0, x1 - x0, y1 - y0] as const }
  }, [a])
  if (!a || !sheet || !leg) return null
  const prev = a.stops[leg.nextIdx - 1]
  const next = a.next?.stop
  const prevT = prev?.threshold ?? 0
  const legP = next && !a.blockedBy ? Math.max(0, Math.min(1, (a.minutes + extraMinutes - prevT) / Math.max(1, next.threshold - prevT))) : 1
  const reached = leg.shown.filter((s) => s.reached)
  const start = prev ?? (next ? { place: next.place } : null)
  return (
    <svg viewBox={leg.box.join(' ')} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
      <image href={sheet.reliefUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={{ filter: 'grayscale(0.35) brightness(0.5) contrast(1.1)' }} />
      <path d={sheet.lines.stateBorders} fill="none" stroke="#9fb3d9" strokeOpacity={0.25} strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
      {reached.length > 1 && <polyline points={reached.map((s) => `${s.place.x},${s.place.y}`).join(' ')} fill="none" stroke={GOLD} strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
      {start && next && (
        <>
          <line x1={start.place.x} y1={start.place.y} x2={next.place.x} y2={next.place.y} stroke={GOLD} strokeOpacity={0.35} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeDasharray="2 6" strokeLinecap="round" />
          <line
            x1={start.place.x}
            y1={start.place.y}
            x2={start.place.x + (next.place.x - start.place.x) * legP}
            y2={start.place.y + (next.place.y - start.place.y) * legP}
            stroke={GOLD}
            strokeWidth={2.6}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            style={{ transition: 'all 1s linear' }}
          />
        </>
      )}
      {leg.shown.map((s) => (
        <circle key={s.place.id} cx={s.place.x} cy={s.place.y} r={s.reached ? 4 : 3} fill={s.reached ? GOLD : '#0c1426'} stroke={GOLD} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
      {next && (
        <g>
          <circle cx={next.place.x} cy={next.place.y} r={9} fill="none" stroke={GOLD} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="atlas-pulse" style={{ transformOrigin: `${next.place.x}px ${next.place.y}px`, transformBox: 'view-box' }} />
          <text x={next.place.x + 12} y={next.place.y + 4} fill={GOLD} fontFamily="Fraunces, Georgia, serif" fontStyle="italic" fontSize={Math.max(12, leg.box[2] / 38)} opacity={0.9}>
            {next.place.name}
          </text>
        </g>
      )}
    </svg>
  )
}

function RoundButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('flex size-12 items-center justify-center rounded-full backdrop-blur transition-colors', active ? 'bg-white/25' : 'bg-white/10 hover:bg-white/15')}>
      {children}
    </button>
  )
}
