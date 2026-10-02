/** The Atlas side panel: explorer rank, expedition, reviews, challenges, regions and journal. */
import { motion } from 'motion/react'
import { BookOpen, Check, ChevronRight, Compass, Flag, GraduationCap, Lock, Map as MapIcon, Tent, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { atlasActivity } from '@/atlas/activity'
import type { Exploration } from '@/atlas/useExploration'
import { db } from '@/data/db'
import { useClaims, useExpeditionRuns, useGoals, useRecalls, useSessions, useSettings, useTasks } from '@/data/hooks'
import { buildContext, dailyChallenges, weeklyChallenges, type ChallengeInstance } from '@/game/challenges'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { cn } from '@/lib/cn'
import { addDaysKey, startOfWeekKey } from '@/lib/time'
import { haptics } from '@/services/haptics'
import { Button } from '@/ui/controls'
import { toast } from '@/ui/toast'
import { DEVELOPMENT_LABEL, developmentOf, minutesText } from './util'

export interface PanelActions {
  openExpeditions: () => void
  startReview: () => void
  pickState: (id: string) => void
  openBaseCamp: () => void
}

export function ExplorerCard({ ex, compact }: { ex: Exploration; compact?: boolean }) {
  const { level } = ex
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-bold">
          {level.rank.title} <span className="font-semibold text-ink-3">· Level {level.level}</span>
        </p>
        <p className="text-[12px] font-semibold text-ink-2 tabular">{ex.xp.total.toLocaleString()} XP</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      {!compact && (
        <p className="mt-1.5 text-[12px] text-ink-2">
          {level.xpToNext} XP to level {level.level + 1}
          {level.nextRank && ` · ${(level.nextRank.minXp - ex.xp.total).toLocaleString()} XP to ${level.nextRank.title}`}
        </p>
      )}
    </div>
  )
}

/** One line: where the active expedition is headed. */
export function expeditionStatus(ex: Exploration): { title: string; line: string; color: string; blocked: boolean } | null {
  const a = ex.state.active
  if (!a) {
    const next = ex.state.survey.next
    return { title: 'Free survey', line: next ? `${minutesText(ex.state.survey.remaining)} to the next stop` : 'Everything nearby is explored', color: 'var(--ink-3)', blocked: false }
  }
  if (a.complete) return { title: a.expedition.title, line: 'Complete – choose your next expedition', color: a.expedition.color, blocked: false }
  if (a.blockedBy) return { title: a.expedition.title, line: `Checkpoint: ${a.blockedBy.need - a.blockedBy.have} more place${a.blockedBy.need - a.blockedBy.have === 1 ? '' : 's'} to recall`, color: a.expedition.color, blocked: true }
  if (a.next) return { title: a.expedition.title, line: `${minutesText(a.next.remaining)} to ${a.next.stop.place.name}`, color: a.expedition.color, blocked: false }
  return { title: a.expedition.title, line: '', color: a.expedition.color, blocked: false }
}

export function AtlasPanel({ ex, actions, hideExplorer }: { ex: Exploration; actions: PanelActions; hideExplorer?: boolean }) {
  const status = expeditionStatus(ex)
  const a = ex.state.active
  return (
    <div className="mt-5">
      {!hideExplorer && (
        <Section>
          <ExplorerCard ex={ex} />
        </Section>
      )}

      <Section title="Expedition" icon={<Flag className="size-3.5" />} action={<LinkButton onClick={actions.openExpeditions}>All</LinkButton>}>
        {status && (
          <button type="button" onClick={actions.openExpeditions} className="block w-full text-left">
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <span className="size-2.5 rounded-full" style={{ background: status.color }} />
              {status.title}
            </p>
            <p className={cn('mt-0.5 text-[13.5px]', status.blocked ? 'font-semibold text-accent' : 'text-ink-2')}>{status.line}</p>
            {a && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${(a.reached / Math.max(1, a.total)) * 100}%`, background: a.expedition.color }} />
              </div>
            )}
            {a && <p className="mt-1 text-[12px] font-semibold text-ink-3">{a.reached} of {a.total} stops</p>}
          </button>
        )}
      </Section>

      <Section title="Field review" icon={<GraduationCap className="size-3.5" />}>
        <p className="text-[13.5px] text-ink-2">
          {ex.due.length ? `${ex.due.length} place${ex.due.length === 1 ? '' : 's'} due – spaced reviews make places Strong, then Mastered.` : ex.state.discovered.size ? 'All caught up. New reviews appear as places come due.' : 'Choose any place to test your recall.'}
        </p>
        <Button variant="primary" size="sm" className="mt-3" disabled={!ex.due.length} onClick={actions.startReview}>
          Review {Math.min(8, ex.due.length) || ''} now
        </Button>
      </Section>

      <Challenges ex={ex} />

      <Regions ex={ex} onPick={actions.pickState} onBaseCamp={actions.openBaseCamp} />

      <Journal ex={ex} />
    </div>
  )
}

function Section({ title, icon, action, children }: { title?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 t-label text-[12px]">
            {icon}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-0.5 text-[12px] font-bold text-ink-2 hover:text-ink">
      {children} <ChevronRight className="size-3.5" />
    </button>
  )
}

function Challenges({ ex }: { ex: Exploration }) {
  const settings = useSettings()
  const sessions = useSessions()
  const tasks = useTasks()
  const claims = useClaims()
  const goals = useGoals()
  const runs = useExpeditionRuns()
  const recalls = useRecalls()
  const today = ex.today
  const week = startOfWeekKey(today, settings.weekStartsOn)
  const dailyGoalMinutes = goals.find((g) => g.active && g.period === 'day' && !g.labelId)?.targetMinutes ?? 120
  const daily = dailyChallenges(today, buildContext(sessions, tasks, today, today, today, dailyGoalMinutes, atlasActivity(ex, sessions, runs, recalls, today, today)), claims)
  const weekly = weeklyChallenges(today, settings.weekStartsOn, buildContext(sessions, tasks, week, addDaysKey(week, 6), today, dailyGoalMinutes, atlasActivity(ex, sessions, runs, recalls, week, addDaysKey(week, 6))), claims)
  const claim = async (c: ChallengeInstance) => {
    haptics.success()
    await db.claims.put({ id: c.key, challengeId: c.id, period: c.periodKey, reward: c.reward, createdAt: Date.now(), updatedAt: Date.now() })
    toast({ title: `+${c.reward} XP`, body: c.title, tone: 'celebrate' })
  }
  return (
    <Section title="Challenges" icon={<Trophy className="size-3.5" />}>
      <ul className="space-y-3">
        {[...daily, ...weekly].map((c) => (
          <li key={c.key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{c.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(1, c.progress / c.target) * 100}%` }} />
                </span>
                <span className="text-[11px] font-bold text-ink-3 tabular">
                  {c.period === 'week' ? 'Week' : 'Today'} · +{c.reward}
                </span>
              </div>
            </div>
            {c.claimed ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-success/15 text-success" aria-label="Claimed">
                <Check className="size-4" />
              </span>
            ) : (
              <Button size="sm" variant={c.complete ? 'accent' : 'secondary'} disabled={!c.complete} onClick={() => claim(c)}>
                Claim
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Regions({ ex, onPick, onBaseCamp }: { ex: Exploration; onPick: (id: string) => void; onBaseCamp: () => void }) {
  const rows = ex.atlas.states
    .filter((s) => ex.state.explored.has(s.id))
    .map((s) => ({ s, d: developmentOf(ex, s.id) }))
    .sort((a, b) => b.d.discovered - a.d.discovered || a.s.name.localeCompare(b.s.name))
  const camp = ex.atlas.state(ex.state.baseCamp)
  return (
    <Section title="Regions" icon={<MapIcon className="size-3.5" />} action={<LinkButton onClick={onBaseCamp}>Base camp</LinkButton>}>
      {camp && (
        <p className="mb-2.5 flex items-center gap-1.5 text-[13px] text-ink-2">
          <Tent className="size-3.5" /> Base camp: <b className="text-ink">{camp.name}</b>
        </p>
      )}
      <ul className="space-y-1">
        {rows.slice(0, 12).map(({ s, d }) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                <span className="block text-[12px] text-ink-3">
                  {DEVELOPMENT_LABEL[d.level]} · {d.discovered}/{d.total} travelled
                </span>
              </span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${d.total ? (d.familiar / d.total) * 100 : 0}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-ink-3">{ex.state.explored.size - 1} of 36 states and UTs explored</p>
    </Section>
  )
}

function Journal({ ex }: { ex: Exploration }) {
  const done = [...ex.state.expeditions.values()].filter((p) => p.complete)
  return (
    <Section title="Journal" icon={<BookOpen className="size-3.5" />}>
      {done.length ? (
        <ul className="space-y-2">
          {done.map((p) => (
            <li key={p.expedition.id} className="rounded-xl border border-line p-3">
              <p className="flex items-center gap-2 text-[14px] font-bold">
                <Compass className="size-4" style={{ color: p.expedition.color }} /> {p.expedition.reward.title}
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-2">{p.expedition.reward.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-2">Complete an expedition to add its journal page here.</p>
      )}
      <p className="mt-4 t-label text-[12px] text-ink-3">Map styles</p>
      <ul className="mt-1.5 space-y-1">
        {MAP_STYLES.map((s) => {
          const open = s.minRank <= ex.level.rankIndex
          return (
            <li key={s.id} className={cn('flex items-center gap-2 text-[13px]', !open && 'text-ink-3')}>
              {open ? <Check className="size-3.5 text-success" /> : <Lock className="size-3.5" />}
              <span className="font-semibold">{s.name}</span>
              {!open && <span>· {RANKS[s.minRank].title}</span>}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
