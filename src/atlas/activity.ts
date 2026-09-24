import type { AtlasActivity } from '@/game/challenges'
import type { ExpeditionRun, RecallAttempt, Session } from '@/data/types'
import { dayEndMs, dayStartMs, type DayKey } from '@/lib/time'
import { discoveredBetween, expeditionMinutesIn } from './explore'
import type { Exploration } from './useExploration'

/** Atlas activity between two days (inclusive), for challenges and Insights. */
export function atlasActivity(ex: Exploration | null, sessions: Session[], runs: ExpeditionRun[], recalls: RecallAttempt[], start: DayKey, end: DayKey): AtlasActivity {
  const inRange = recalls.filter((r) => r.date >= start && r.date <= end)
  const from = dayStartMs(start)
  const to = dayEndMs(end)
  let passesStrong = 0
  if (ex) for (const [id, m] of ex.mastery) if (m.strongAt !== null && m.strongAt >= from && m.strongAt < to && ex.atlas.byId.get(id)?.kind === 'pass') passesStrong++
  return {
    reviewed: inRange.length,
    correct: inRange.filter((r) => r.correct).length,
    expeditionMinutes: expeditionMinutesIn(
      sessions.filter((s) => s.date >= start && s.date <= end),
      runs,
    ),
    discovered: ex ? discoveredBetween(ex.state, from, to).length : 0,
    passesStrong,
  }
}
