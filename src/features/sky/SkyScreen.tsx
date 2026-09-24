import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Flame, Lock, Settings2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { navigate } from '@/app/router'
import { db } from '@/data/db'
import { updateSettings, useClaims, useGoals, useLabels, useSessions, useSettings, useTasks, useUnlocks } from '@/data/hooks'
import { create } from '@/data/repo'
import type { Session } from '@/data/types'
import { buildContext, dailyChallenges, weeklyChallenges, type ChallengeInstance } from '@/game/challenges'
import { isThemeOwned, levelInfo, milestoneStates, SKY_THEMES, skyTheme, stardustBalance, type CelestialId } from '@/game/progression'
import { backgroundStars, layoutWeek, SKY_H, SKY_W, type Constellation } from '@/game/sky'
import { cn } from '@/lib/cn'
import { addDaysKey, formatDuration, formatTimeOfDay, relativeDayLabel, shortDate, startOfWeekKey, todayKey, type DayKey } from '@/lib/time'
import { haptics } from '@/services/haptics'
import { computeStreaks, studyDays } from '@/stats/aggregate'
import { Button, IconButton } from '@/ui/controls'
import { useIsWide } from '@/ui/useMedia'
import { confirmDialog } from '@/ui/feedback'
import { toast } from '@/ui/toast'
import { CelestialDefs, CelestialIcon, CelestialLayer } from './Celestial'

export default function SkyScreen() {
  const settings = useSettings()
  const sessions = useSessions()
  const labels = useLabels(true)
  const tasks = useTasks()
  const claims = useClaims()
  const unlocks = useUnlocks()
  const goals = useGoals()
  const today = todayKey()
  const thisWeek = startOfWeekKey(today, settings.weekStartsOn)
  const [week, setWeek] = useState<DayKey>(thisWeek)

  const total = useMemo(() => sessions.reduce((a, s) => a + s.duration, 0), [sessions])
  const level = levelInfo(total)
  const streaks = useMemo(() => computeStreaks(studyDays(sessions), today), [sessions, today])
  const dust = stardustBalance(sessions, claims, unlocks)
  const milestones = useMemo(
    () => milestoneStates({ hours: total / 3600, sessions: sessions.filter((s) => s.completed).length, longestStreak: streaks.longest, studyDays: studyDays(sessions).size }),
    [total, sessions, streaks.longest],
  )
  const unlocked = useMemo(() => new Set(milestones.filter((m) => m.unlocked).map((m) => m.id as CelestialId)), [milestones])
  const theme = skyTheme(settings.skyTheme)

  const byWeek = useMemo(() => {
    const map = new Map<DayKey, Session[]>()
    for (const s of sessions) {
      const w = startOfWeekKey(s.date, settings.weekStartsOn)
      if (!map.has(w)) map.set(w, [])
      map.get(w)!.push(s)
    }
    return map
  }, [sessions, settings.weekStartsOn])
  // A near-square sky on phones, a wide panorama on larger screens.
  const wide = useIsWide()
  const skyW = wide ? SKY_W : 620
  const skyH = wide ? SKY_H : 600
  const constellation = useMemo(() => layoutWeek(week, byWeek.get(week) ?? [], labels, skyW, skyH), [week, byWeek, labels, skyW, skyH])
  const pastWeeks = useMemo(() => [...byWeek.keys()].filter((w) => w !== thisWeek).sort().reverse().slice(0, 12), [byWeek, thisWeek])

  // Challenges
  const dailyGoalMinutes = goals.find((g) => g.active && g.period === 'day' && !g.labelId)?.targetMinutes ?? 120
  const dayCtx = buildContext(sessions, tasks, today, today, today, dailyGoalMinutes)
  const weekCtx = buildContext(sessions, tasks, thisWeek, addDaysKey(thisWeek, 6), today, dailyGoalMinutes)
  const daily = dailyChallenges(today, dayCtx, claims)
  const weekly = weeklyChallenges(today, settings.weekStartsOn, weekCtx, claims)

  const claim = async (c: ChallengeInstance) => {
    haptics.success()
    await db.claims.put({ id: c.key, challengeId: c.id, period: c.periodKey, reward: c.reward, createdAt: Date.now(), updatedAt: Date.now() })
    toast({ title: `+${c.reward} stardust`, body: c.title, tone: 'celebrate' })
  }

  const buyTheme = async (id: string) => {
    const t = skyTheme(id)
    if (isThemeOwned(id, unlocks)) return void updateSettings({ skyTheme: id })
    if (dust.balance < t.cost) return
    if (!(await confirmDialog({ title: `Unlock ${t.name}?`, body: `Spend ${t.cost} stardust on this sky. It also colours immersive focus mode.`, confirmLabel: 'Unlock' }))) return
    await create('unlocks', { item: `theme:${id}`, cost: t.cost })
    await updateSettings({ skyTheme: id })
    haptics.success()
    toast({ title: `${t.name} unlocked`, tone: 'celebrate' })
  }

  return (
    <div className="pt-safe mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="flex items-end justify-between gap-3 pt-5 pb-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-ink-3 uppercase">Your sky</p>
          <h1 className="font-display text-[32px] leading-tight font-medium tracking-tight">{level.rank.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-bold shadow-soft" title="Stardust">
            <Sparkles className="size-4 text-accent" /> {dust.balance}
          </span>
          <IconButton label="Settings" className="lg:hidden" onClick={() => navigate('#/settings')}>
            <Settings2 className="size-5" />
          </IconButton>
        </div>
      </header>

      <SkyView w={skyW} h={skyH} constellation={constellation} theme={theme} unlocked={unlocked} week={week} thisWeek={thisWeek} onWeek={setWeek} canNext={week < thisWeek} labels={labels} use24h={settings.use24h} />

      {/* Level */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold">Level {level.level}</p>
            <p className="text-xs font-semibold text-ink-2">{level.nextRank ? `${Math.max(0, level.nextRank.minHours - level.hours).toFixed(1)}h to ${level.nextRank.title}` : 'Highest rank'}</p>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
          </div>
          <p className="mt-2 text-xs text-ink-2">
            {formatDuration(total)} focused in all · {level.hoursToNext.toFixed(1)}h to level {level.level + 1}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-soft">
          <span className={cn('flex size-11 items-center justify-center rounded-2xl', streaks.todayDone ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-3')}>
            <Flame className="size-5.5" />
          </span>
          <div>
            <p className="text-lg font-semibold">
              {streaks.current} day{streaks.current === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-ink-2">{streaks.todayDone ? 'Streak alive today' : streaks.current ? 'Focus today to extend it' : `Longest: ${streaks.longest}`}</p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Today’s challenges</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {daily.map((c) => (
            <ChallengeCard key={c.key} c={c} onClaim={claim} />
          ))}
        </div>
        <h2 className="mt-5 mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">This week</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {weekly.map((c) => (
            <ChallengeCard key={c.key} c={c} onClaim={claim} />
          ))}
        </div>
      </section>

      {/* Milestones */}
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">
          Celestial collection · {unlocked.size}/{milestones.length}
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {milestones.map((m) => (
            <div key={m.id} className={cn('flex flex-col items-center rounded-2xl border px-2 pt-2 pb-3 text-center', m.unlocked ? 'border-line bg-[#0b0e1a]' : 'border-line bg-surface-2/50')} title={m.description}>
              <div className="relative size-16">
                <CelestialIcon id={m.id} locked={!m.unlocked} />
                {!m.unlocked && <Lock className="absolute right-0 bottom-0 size-3.5 text-ink-3" />}
              </div>
              <p className={cn('mt-1 text-xs font-bold', m.unlocked ? 'text-[#ece9f1]' : 'text-ink')}>{m.name}</p>
              <p className={cn('mt-0.5 text-[10px] leading-snug', m.unlocked ? 'text-[#9a9fb2]' : 'text-ink-3')}>{m.description}</p>
              {!m.unlocked && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${m.ratio * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Atlas */}
      {pastWeeks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Atlas of past weeks</h2>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
            {pastWeeks.map((w) => {
              const list = byWeek.get(w) ?? []
              const c = layoutWeek(w, list, labels)
              return (
                <button key={w} type="button" onClick={() => setWeek(w)} className={cn('w-40 shrink-0 overflow-hidden rounded-2xl border text-left sm:w-auto', week === w ? 'border-accent/60' : 'border-line')}>
                  <MiniSky c={c} theme={theme} />
                  <div className="bg-surface px-3 py-2">
                    <p className="truncate font-display text-sm font-medium italic">{c.name}</p>
                    <p className="text-[11px] text-ink-2">
                      {shortDate(w)} · {list.length} stars · {formatDuration(list.reduce((a, s) => a + s.duration, 0))}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Themes */}
      <section className="mt-6 pb-8">
        <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">Skies</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SKY_THEMES.map((t) => {
            const owned = isThemeOwned(t.id, unlocks)
            const active = settings.skyTheme === t.id
            const affordable = dust.balance >= t.cost
            return (
              <button key={t.id} type="button" onClick={() => void buyTheme(t.id)} disabled={!owned && !affordable} className={cn('overflow-hidden rounded-2xl border text-left transition-transform active:scale-[0.98] disabled:opacity-60', active ? 'border-accent ring-2 ring-accent/30' : 'border-line')}>
                <div className="relative h-16" style={{ background: `linear-gradient(180deg, ${t.stops[0]}, ${t.stops[1]} 60%, ${t.stops[2]})` }}>
                  {[
                    [18, 30],
                    [52, 18],
                    [70, 44],
                    [34, 52],
                    [86, 22],
                  ].map(([x, y], i) => (
                    <span key={i} className="absolute size-[3px] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, opacity: 0.8 - i * 0.1 }} />
                  ))}
                  {active && <Check className="absolute top-2 right-2 size-4 text-white" strokeWidth={3} />}
                </div>
                <div className="flex items-center justify-between bg-surface px-3 py-2">
                  <span className="text-sm font-bold">{t.name}</span>
                  <span className="text-[11px] font-bold text-ink-2">{owned ? (active ? 'In use' : 'Owned') : `✦ ${t.cost}`}</span>
                </div>
              </button>
            )
          })}
        </div>
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-3">Stardust: 1 for every 5 focused minutes, +3 for finishing a planned session, plus challenge rewards. Earned {dust.earned}, spent {dust.spent}.</p>
      </section>
    </div>
  )
}

function SkyView({ w, h, constellation, theme, unlocked, week, thisWeek, onWeek, canNext, labels, use24h }: { w: number; h: number; constellation: Constellation; theme: ReturnType<typeof skyTheme>; unlocked: Set<CelestialId>; week: DayKey; thisWeek: DayKey; onWeek: (w: DayKey) => void; canNext: boolean; labels: ReturnType<typeof useLabels>; use24h: boolean }) {
  const dust = useMemo(() => backgroundStars(`sky:${theme.id}`, 180, w, h), [theme.id, w, h])
  const [picked, setPicked] = useState<string | null>(null)
  const star = constellation.stars.find((s) => s.id === picked)
  const hours = constellation.stars.reduce((a, s) => a + s.session.duration, 0)

  return (
    <section className="relative overflow-hidden rounded-[28px] shadow-lift" style={{ background: `linear-gradient(180deg, ${theme.stops[0]} 0%, ${theme.stops[1]} 60%, ${theme.stops[2]} 100%)` }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" role="img" aria-label={`${constellation.name}: ${constellation.stars.length} stars from this week's focus sessions`} onClick={() => setPicked(null)}>
        <CelestialDefs />
        <defs>
          <filter id="star-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {dust.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o * 0.8} className={s.twinkle ? 'animate-twinkle' : undefined} style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined} />
        ))}
        <CelestialLayer unlocked={unlocked} width={w} />
        <AnimatePresence mode="wait">
          <motion.g key={constellation.week} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            {constellation.edges.map(([a, b], i) => (
              <motion.line
                key={i}
                x1={constellation.stars[a].x}
                y1={constellation.stars[a].y}
                x2={constellation.stars[b].x}
                y2={constellation.stars[b].y}
                stroke={theme.line}
                strokeWidth={1.1}
                strokeOpacity={0.45}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.04 }}
              />
            ))}
            {constellation.stars.map((s, i) => (
              <motion.g key={s.id} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 14 }} style={{ transformOrigin: `${s.x}px ${s.y}px` }}>
                <circle cx={s.x} cy={s.y} r={s.r * 3.2} fill={s.color} opacity={0.12} />
                <circle cx={s.x} cy={s.y} r={s.r} fill={s.color} filter="url(#star-glow)" />
                {s.session.duration >= 45 * 60 && <path transform={`translate(${s.x} ${s.y})`} d={`M0 ${-s.r * 3} L${s.r * 0.3} 0 L0 ${s.r * 3} L${-s.r * 0.3} 0 Z M${-s.r * 3} 0 L0 ${s.r * 0.3} L${s.r * 3} 0 L0 ${-s.r * 0.3} Z`} fill={s.color} opacity={0.55} />}
                {/* Generous hit area */}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={16}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatDuration(s.session.duration)} on ${s.session.date}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPicked(s.id)
                  }}
                  onFocus={() => setPicked(s.id)}
                  className="cursor-pointer outline-none"
                />
                {picked === s.id && <circle cx={s.x} cy={s.y} r={s.r + 7} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1} />}
              </motion.g>
            ))}
          </motion.g>
        </AnimatePresence>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 text-white">
        <div>
          <p className="font-display text-xl leading-tight italic sm:text-2xl">{constellation.stars.length ? constellation.name : 'An empty sky'}</p>
          <p className="mt-0.5 text-xs font-semibold text-white/60">
            {week === thisWeek ? 'This week' : `Week of ${shortDate(week)}`} · {constellation.stars.length} {constellation.stars.length === 1 ? 'star' : 'stars'}
            {hours > 0 && ` · ${formatDuration(hours)}`}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-1">
          <button type="button" aria-label="Previous week" onClick={() => onWeek(addDaysKey(week, -7))} className="flex size-8 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next week" disabled={!canNext} onClick={() => onWeek(addDaysKey(week, 7))} className="flex size-8 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
        {star ? (
          <div className="pointer-events-auto rounded-2xl bg-black/35 px-3 py-2 text-xs backdrop-blur">
            <p className="font-bold">
              {formatDuration(star.session.duration)} · {labels.find((l) => l.id === star.session.labelId)?.name ?? 'Focus'}
            </p>
            <p className="text-white/70">
              {relativeDayLabel(star.session.date)} at {formatTimeOfDay(star.session.startedAt, use24h)}
              {star.session.note && ` · ${star.session.note}`}
            </p>
          </div>
        ) : (
          <p className="max-w-xs text-[11px] leading-snug text-white/50">
            {constellation.stars.length ? 'Left to right: the days of your week. Higher up: earlier in the day. Brighter: longer sessions.' : 'Complete a focus session and your first star appears here.'}
          </p>
        )}
      </div>
    </section>
  )
}

function MiniSky({ c, theme }: { c: Constellation; theme: ReturnType<typeof skyTheme> }) {
  return (
    <svg viewBox={`0 0 ${SKY_W} ${SKY_H}`} className="block h-auto w-full" style={{ background: `linear-gradient(180deg, ${theme.stops[0]}, ${theme.stops[2]})` }} aria-hidden="true">
      {c.edges.map(([a, b], i) => (
        <line key={i} x1={c.stars[a].x} y1={c.stars[a].y} x2={c.stars[b].x} y2={c.stars[b].y} stroke={theme.line} strokeWidth={3} strokeOpacity={0.4} />
      ))}
      {c.stars.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.y} r={s.r * 2.2} fill={s.color} />
      ))}
    </svg>
  )
}

export function ChallengeCard({ c, onClaim }: { c: ChallengeInstance; onClaim: (c: ChallengeInstance) => void }) {
  const ratio = Math.min(1, c.progress / c.target)
  return (
    <div className={cn('flex flex-col rounded-2xl border p-3.5', c.claimed ? 'border-line bg-surface-2/50' : 'border-line bg-surface shadow-soft')}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[13px] leading-snug font-bold', c.claimed && 'text-ink-2')}>{c.title}</p>
        <span className="shrink-0 text-[11px] font-bold text-accent">✦ {c.reward}</span>
      </div>
      <div className="mt-auto pt-3">
        {c.claimed ? (
          <p className="flex items-center gap-1 text-xs font-bold text-success">
            <Check className="size-3.5" /> Claimed
          </p>
        ) : c.complete ? (
          <Button size="sm" variant="accent" block onClick={() => onClaim(c)}>
            Claim stardust
          </Button>
        ) : (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
            </div>
            <p className="tabular mt-1.5 text-[11px] font-semibold text-ink-3">
              {c.unit === 'hours' ? c.progress.toFixed(1) : Math.floor(c.progress)} / {c.target}
              {c.unit === 'minutes' ? ' min' : c.unit === 'hours' ? ' h' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
