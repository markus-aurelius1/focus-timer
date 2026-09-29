/**
 * A place's record in previous-year papers and its study priority, with the
 * reasons behind it. Renders nothing until the gazetteer carries PYQ data.
 * The papers it cites are listed with the place's other sources (PlaceSources).
 */
import type { PriorityBand, Place } from '@/atlas/types'
import { cn } from '@/lib/cn'

export const BAND_LABEL: Record<PriorityBand, string> = { core: 'Top priority', high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

export const BAND_CLASS: Record<PriorityBand, string> = {
  core: 'bg-accent text-accent-ink',
  high: 'bg-accent-soft text-accent',
  medium: 'bg-surface-3 text-ink-2',
  low: 'bg-surface-2 text-ink-3',
}

export function PastPapers({ place: p }: { place: Place }) {
  const { pyq, yield: y } = p
  if (!pyq && !y) return null
  // The history line already says how often and when; the rest explain the priority.
  const reasons = (y?.reasons ?? []).filter((r) => !r.startsWith('Asked') && !r.startsWith('Last asked') && !r.startsWith('Recurs'))
  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface-2/50 p-3.5" aria-label="Past papers and study priority">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">Past papers</p>
        {y && <span className={cn('tabular rounded-full px-2.5 py-0.5 text-[12px] font-bold', BAND_CLASS[y.band])}>{`${BAND_LABEL[y.band]} · ${y.score}`}</span>}
      </div>
      {pyq ? (
        <>
          <p className="mt-1.5 text-[15px] font-semibold">
            Asked {pyq.count}× <span className="font-medium text-ink-2">in {pyq.exams.join(', ')}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pyq.years.map((yr) => (
              <span key={yr} className="tabular rounded-md bg-surface px-1.5 py-0.5 text-[12px] font-semibold text-ink-2">
                {yr}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[14px] text-ink-2">Not in the collected papers yet.</p>
      )}
      {reasons.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[13.5px] leading-snug text-ink-2">
          {reasons.slice(0, 4).map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-3" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
