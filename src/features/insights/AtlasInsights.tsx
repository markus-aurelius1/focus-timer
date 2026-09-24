/** Insights › Atlas: discoveries over time, mastery spread, accuracy by question type, reviews due. */
import { useMemo } from 'react'
import { navigate } from '@/app/router'
import { atLeast, levelOf } from '@/atlas/mastery'
import { TYPE_LABEL } from '@/atlas/questions'
import { useExploration } from '@/atlas/useExploration'
import { useRecalls, useSettings } from '@/data/hooks'
import type { QuestionType } from '@/data/types'
import { addDaysKey, dayKey, shortDate, startOfWeekKey } from '@/lib/time'
import { Button } from '@/ui/controls'
import { MASTERY_COLOUR } from '@/features/atlas/style'
import { BarList, ChartCard, ColumnChart, StatTile } from './charts'

export function AtlasInsights() {
  const ex = useExploration()
  const recalls = useRecalls()
  const settings = useSettings()
  const data = useMemo(() => {
    if (!ex) return null
    const total = ex.atlas.places.length
    let familiar = 0
    let strong = 0
    let mastered = 0
    for (const id of ex.state.discovered.keys()) {
      const l = levelOf(id, true, ex.mastery)
      if (atLeast(l, 'familiar')) familiar++
      if (atLeast(l, 'strong')) strong++
      if (l === 'mastered') mastered++
    }
    // Discoveries per week, last 12 weeks.
    const thisWeek = startOfWeekKey(ex.today, settings.weekStartsOn)
    const weeks = Array.from({ length: 12 }, (_, i) => addDaysKey(thisWeek, (i - 11) * 7))
    const perWeek = new Map(weeks.map((w) => [w, 0]))
    for (const d of ex.state.discovered.values()) {
      const w = startOfWeekKey(dayKey(d.at), settings.weekStartsOn)
      if (perWeek.has(w)) perWeek.set(w, perWeek.get(w)! + 1)
    }
    // Accuracy by question type.
    const byType = new Map<QuestionType, { n: number; ok: number }>()
    for (const r of recalls) {
      const t = byType.get(r.type) ?? { n: 0, ok: 0 }
      t.n++
      t.ok += r.correct
      byType.set(r.type, t)
    }
    return { total, familiar, strong, mastered, weeks, perWeek, byType }
  }, [ex, recalls, settings.weekStartsOn])

  if (!ex || !data) return null
  const discovered = ex.state.discovered.size
  const spread = [
    { key: 'discovered', label: 'Discovered only', value: discovered - data.familiar, color: 'var(--ink-3)' },
    { key: 'familiar', label: 'Familiar', value: data.familiar - data.strong, color: MASTERY_COLOUR.familiar },
    { key: 'strong', label: 'Strong', value: data.strong - data.mastered, color: MASTERY_COLOUR.strong },
    { key: 'mastered', label: 'Mastered', value: data.mastered, color: MASTERY_COLOUR.mastered },
  ]
  const accuracy = [...data.byType.entries()]
    .map(([t, v]) => ({ key: t, label: TYPE_LABEL[t], value: Math.round((v.ok / v.n) * 100), sub: `${v.n} answered` }))
    .sort((a, b) => b.value - a.value)

  return (
    <section className="space-y-4" aria-label="Atlas">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Places discovered" value={String(discovered)} sub={`of ${data.total} in the Atlas`} />
        <StatTile label="Familiar or better" value={String(data.familiar)} sub={discovered ? `${Math.round((data.familiar / discovered) * 100)}% of discovered` : 'answer a question'} />
        <StatTile label="Mastered" value={String(data.mastered)} sub={`${data.strong} Strong or better`} />
        <StatTile label="Reviews due" value={String(ex.due.length)} sub={ex.due.length ? 'spaced review keeps them fresh' : 'all caught up'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Discoveries"
          subtitle="Places uncovered each week"
          table={data.weeks.map((w) => [`Week of ${shortDate(w)}`, String(data.perWeek.get(w) ?? 0)])}
          action={
            ex.due.length > 0 && (
              <Button size="sm" variant="primary" onClick={() => navigate('#/atlas?review=1')}>
                Review {Math.min(8, ex.due.length)}
              </Button>
            )
          }
        >
          <ColumnChart
            data={data.weeks.map((w) => ({ key: w, label: `Week of ${shortDate(w)}`, tick: shortDate(w), value: data.perWeek.get(w) ?? 0 }))}
            formatValue={(v) => String(Math.round(v))}
            tickEvery={3}
            height={150}
            ariaLabel="Places discovered per week"
          />
        </ChartCard>
        <ChartCard title="Mastery" subtitle="Recall – not time – moves places up" table={spread.map((r) => [r.label, String(r.value)])}>
          <BarList rows={spread} formatValue={(v) => String(v)} empty={<p className="text-sm text-ink-3">Nothing discovered yet.</p>} />
          {accuracy.length > 0 && (
            <>
              <p className="mt-5 mb-2 text-xs font-bold tracking-[0.1em] text-ink-3 uppercase">Accuracy by question type</p>
              <BarList rows={accuracy} formatValue={(v) => `${v}%`} limit={8} />
            </>
          )}
        </ChartCard>
      </div>
    </section>
  )
}
