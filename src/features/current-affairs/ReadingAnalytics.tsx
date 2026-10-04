/** Global personal reading metrics, with a two-week activity chart and subject breakdown. No stored totals. */
import { readingAnalytics } from '@/current-affairs/analytics'
import { editionLabel } from '@/current-affairs/workspace'
import type { PersonalState } from '@/current-affairs/personal-state'
import type { WorkspaceEvent } from '@/current-affairs/workspace'
export function ReadingAnalytics({ events, state, now }: { events: WorkspaceEvent[]; state: PersonalState; now: number }) {
  // Feed age ticks every minute; personal actions must count immediately after they are saved.
  const stats = readingAnalytics(events, state, Math.max(now, Date.now())), peak = Math.max(1, ...stats.daily.map(d => d.read))
  const metrics = [['Articles read', stats.read], ['Articles saved', stats.saved], ['To be read', stats.pending], ['Saved for later', stats.savedForLater], ['Read this week', stats.readWeek], ['Read this month', stats.readMonth], ['Reading streak', `${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`], ['Removed', stats.removed]]
  return <section id="ca-analytics" data-reading-analytics className="mb-6 rounded-2xl bg-surface-2/60 p-4 sm:p-5" aria-label="Reading analytics">
    <h2 className="t-heading">Reading analytics</h2><p className="t-meta mt-1 leading-relaxed">Across Today and Archive. Related coverage counts as one article; read totals include read saved articles.</p>
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">{metrics.map(([label, value]) => <div key={label}><dt className="t-meta">{label}</dt><dd data-metric={label} className="t-num mt-0.5 text-[22px] leading-tight">{value}</dd></div>)}</dl>
    <p className="mt-4 text-xs text-ink-3">Read today: {stats.readToday} · ~{stats.estimatedReadMinutes} min of marked reading <span>(estimate, not measured time)</span></p>
    <h3 className="t-label mt-6">Reading activity · last 14 days</h3>
    <div className="mt-3 grid h-28 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1" role="img" aria-label={stats.daily.map(d => `${editionLabel(d.day)}: ${d.read} read`).join('; ')}>{stats.daily.map(day => <div key={day.day} className="flex h-full flex-col justify-end" title={`${day.day}: ${day.read} read, ${day.saved} saved`}><div className="min-h-0.5 rounded-t bg-accent" style={{ height: `${day.read / peak * 85}%`, opacity: day.read ? 1 : 0.2 }} /><span className="mt-1 text-center text-[9px] tabular-nums text-ink-3">{day.day.slice(-2)}</span></div>)}</div>
    <details className="mt-4"><summary className="press min-h-11 cursor-pointer py-3 text-xs font-semibold">Read by subject</summary>{stats.subjects.length ? <ul className="space-y-2 text-xs text-ink-2">{stats.subjects.map(subject => <li key={subject.subject} className="flex justify-between gap-3"><span>{subject.subject}</span><span className="tabular-nums">{subject.read}</span></li>)}</ul> : <p className="text-xs text-ink-3">Mark an article read to build your subject breakdown.</p>}</details>
    <p className="mt-3 text-xs leading-relaxed text-ink-3">Totals reflect current read/save flags and change when you undo them. Activity uses the date you marked an article read, in IST.{stats.metadataUnavailable > 0 && ` ${stats.metadataUnavailable} tracked links have no retained metadata; their time and subject are unavailable.`}</p>
  </section>
}
