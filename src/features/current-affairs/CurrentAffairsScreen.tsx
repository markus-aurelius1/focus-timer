/** Direct-to-publisher daily reading list; RSS thumbnails and local read/save actions need no article popup. */
import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowLeft, BarChart3, Bookmark, Check, RefreshCw, Search, SlidersHorizontal, StickyNote, X } from 'lucide-react'
import { useRoute } from '@/app/router'
import { Workspace } from '@/app/Workspace'
import { cn } from '@/lib/cn'
import { classify } from '@/current-affairs/relevance'
import { clusterItems } from '@/current-affairs/cluster'
import { NEWS_SOURCES, activeFeedItems, isActiveSource } from '@/current-affairs/sources'
import { eventPersonalState } from '@/current-affairs/personal-state'
import { buildWorkspace, editionProgress, filterWorkspace, publicationDay, UNDATED, type WorkspaceFilters } from '@/current-affairs/workspace'
import { thumbnailUrl } from '@/current-affairs/feed'
import { useFeeds, relativeAge } from './useFeeds'
import { usePersonalState } from './usePersonalState'
import { useArchive } from './useArchive'
import { archiveDays, archivePeriods, periodKey, periodLabel, type ArchivePeriod } from '@/current-affairs/archive'
import type { NewsItem } from '@/current-affairs/types'
import { queueCounts, readingScopes, recentCoverage, latestPublication } from '@/current-affairs/analytics'
import { NotesSheet } from './NotesSheet'
import { ReadingAnalytics } from './ReadingAnalytics'
import { toast } from '@/ui/toast'
import './workspace.css'
import { useRouteState } from '@/app/routeState'
const tabs = ['To be Read', 'Read', 'Saved'] as const
const subjects = ['All subjects', 'Polity', 'Economy', 'Environment', 'Sci-Tech', 'Geography', 'International relations', 'Governance', 'Security', 'History & Culture', 'General studies']
const control = 'press min-h-11 rounded-xl px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40'
const iconControl = 'press flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40'
const rowAction = 'press flex size-11 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink'
function FeedThumbnail({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false)
  const safe = url && thumbnailUrl(url)
  useEffect(() => setFailed(false), [url])
  if (!safe || failed) return null
  return <img src={safe} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-16 shrink-0 rounded-[10px] bg-surface-2 object-cover sm:h-[68px] sm:w-[104px]" />
}
export default function CurrentAffairsScreen() {
  const route = useRoute(), debug = route.params.get('debug') === '1' || new URLSearchParams(location.search).get('debug') === '1'
  const { data, index, loading, error, cached, now, online, reload } = useFeeds()
  const { state, stateError, patch } = usePersonalState()
  const today = publicationDay(now)
  // The tab, filters and archive position are kept while the app is open (app/routeState.ts); the day always starts as today.
  const [filters, setFilters] = useRouteState<WorkspaceFilters>('current-affairs:filters', () => ({ day: publicationDay(Date.now()), tab: 'To be Read', exam: 'All', subject: 'All subjects', publisher: 'All sources', query: '', budget: null }))
  useEffect(() => {
    const day = publicationDay(Date.now())
    setFilters(f => (f.day === day ? f : { ...f, day }))
  }, [setFilters])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false), [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [view, setView] = useRouteState<'Today' | 'Archive'>('current-affairs:view', 'Today')
  const [period, setPeriod] = useRouteState<ArchivePeriod>('current-affairs:period', 'Daily'), [archiveKey, setArchiveKey] = useRouteState('current-affairs:archive', 'all')
  const [visibleCount, setVisibleCount] = useState(50)
  useEffect(() => setVisibleCount(50), [filters, view, period, archiveKey])
  const current = useMemo(() => data && index ? activeFeedItems(data.items).map(item => ({ ...item, relevance: classify(item, index) })) : [], [data, index])
  const { archived, archiveError } = useArchive(current, data?.fetchedAt)
  const classified = useMemo(() => {
    if (!index) return []
    const items = new Map<string, NewsItem>(archived.map(item => [item.url, item]))
    const retained = new Map(archived.map(item => [item.url, item]))
    for (const item of activeFeedItems(data?.items ?? [])) {
      const prior = retained.get(item.url)
      if (!prior || prior.lastSeenAt <= Date.parse(data!.fetchedAt)) items.set(item.url, item)
    }
    return [...items.values()].map(item => ({ ...item, relevance: classify(item, index) }))
  }, [data, index, archived])
  const events = useMemo(() => index ? buildWorkspace(clusterItems(classified), index) : [], [classified, index])
  const scopes = useMemo(() => readingScopes(events, now), [events, now])
  const base = view === 'Today' ? scopes.today : scopes.archive
  const periods = [...new Set(scopes.archive.map(e => periodKey(e.day, period)))].sort((a, b) => a === UNDATED ? 1 : b === UNDATED ? -1 : b.localeCompare(a))
  const scope = useMemo(() => { if (view !== 'Archive' || archiveKey === 'all') return base; const included = new Set(archiveDays(base, period, archiveKey)); return base.filter(e => included.has(e.day)) }, [view, archiveKey, base, period])
  const days = useMemo(() => [...new Set(scope.map(e => e.day))], [scope])
  const filtered = useMemo(() => {
    const rows = filterWorkspace(scope, state, { ...filters, days })
    return view === 'Archive' ? rows.sort((a, b) => latestPublication(b) - latestPublication(a) || a.id.localeCompare(b.id)) : rows
  }, [scope, state, filters, days, view])
  const visibleScope = scope.filter(e => !eventPersonalState(e, state).ignoredAt)
  const progress = editionProgress(visibleScope, state), counts = queueCounts(scope, state)
  const stale = !!data && (!online || cached || now - Date.parse(data.fetchedAt) > 3600000)
  const unavailable = data?.sources.filter(s => isActiveSource(s.sourceId) && s.status !== 'ok') ?? []
  const publishers = [...new Set(events.flatMap(e => e.members.map(m => m.publisher)))].sort()
  const updateFilters = (value: Partial<WorkspaceFilters>) => setFilters(f => ({ ...f, ...value }))
  const activeFilterCount = [view === 'Archive' && archiveKey !== 'all', filters.subject !== 'All subjects', filters.publisher !== 'All sources', filters.exam !== 'All', !!filters.budget].filter(Boolean).length
  const resetFilters = () => { setArchiveKey('all'); updateFilters({ day: today, subject: 'All subjects', publisher: 'All sources', exam: 'All', budget: null }) }
  const changeView = () => { setView(v => v === 'Today' ? 'Archive' : 'Today'); setArchiveKey('all'); setFiltersOpen(false); updateFilters({ tab: 'To be Read', query: '', subject: 'All subjects', publisher: 'All sources', exam: 'All', budget: null }) }
  const remove = (event: typeof events[number]) => {
    const ignoredAt = eventPersonalState(event, state).ignoredAt
    if (patch(event, { ignoredAt: Date.now() })) toast({ title: 'Article removed', action: { label: 'Undo', run: () => { patch(event, { ignoredAt }) } } })
  }
  const field = 'mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink outline-none focus:border-accent/60'
  const emptyTitle = filters.query || activeFilterCount ? 'No articles match these filters' : filters.tab === 'To be Read' ? 'Your reading queue is clear' : filters.tab === 'Read' ? 'No read articles here yet' : 'No saved articles here yet'
  return (
    <section className="ca-workspace" aria-labelledby="news-title">
      <Workspace
        width="lg"
        titleId="news-title"
        title={view === 'Archive' ? 'Archive' : 'Current Affairs'}
        actions={
          <>
            <button type="button" aria-label="Short notes" title="Short notes" onClick={() => setNotesOpen(true)} className={iconControl}>
              <StickyNote className="size-[18px]" />
            </button>
            <button type="button" aria-label="Analytics" title="Reading analytics" aria-expanded={analyticsOpen} aria-controls="ca-analytics" onClick={() => setAnalyticsOpen(v => !v)} className={cn(iconControl, analyticsOpen && 'bg-accent-soft text-accent')}>
              <BarChart3 className="size-[18px]" />
            </button>
            <button type="button" aria-label={view === 'Archive' ? 'Back to Today' : 'Archive'} onClick={changeView} className={cn(control, 'inline-flex shrink-0 items-center gap-2', view === 'Archive' && 'text-accent')}>
              {view === 'Archive' ? <ArrowLeft className="size-4" /> : <Archive className="size-4" />}
              <span className="hidden sm:inline">{view === 'Archive' ? 'Today' : 'Archive'}</span>
            </button>
          </>
        }
      >
        <div className="flex items-start gap-1">
          <p role="status" className="t-meta min-w-0 flex-1 py-3 leading-relaxed">
            {data ? `Updated ${relativeAge(data.fetchedAt, now)}` : archived.length ? 'Local archive' : 'Trusted publisher feeds'}
            {((data && stale) || (!data && cached && archived.length > 0)) && <span className="block">{!data ? !online ? 'Offline – local archive' : 'Refresh unavailable – local archive' : !online ? 'Offline – cached feed' : cached ? 'Cached feed – offline or refresh unavailable' : 'Stale feed'}</span>}
            {!!unavailable.length && <span className="block">Some sources unavailable</span>}
          </p>
          <button type="button" aria-label="Refresh news" onClick={reload} disabled={loading} className={cn(iconControl, '-mr-2')}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin motion-reduce:animate-none')} />
          </button>
        </div>

        {analyticsOpen && <ReadingAnalytics events={events} state={state} now={now} />}

        <div className="pt-1 pb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="t-heading">{view === 'Archive' ? archiveKey === 'all' ? 'Older articles · newest first' : periodLabel(archiveKey, period) : 'Today · past 24 hours'}</h2>
            <p data-edition-progress className="t-num text-[13px] text-ink-2">{progress.total > 0 && progress.unread === 0 ? 'Complete ✓' : `${progress.read} / ${progress.total} read`}</p>
          </div>
          <div role="progressbar" aria-label="Daily reading progress" aria-valuemin={0} aria-valuemax={Math.max(progress.total, 1)} aria-valuenow={progress.read} className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${progress.total ? progress.read / progress.total * 100 : 0}%` }} />
          </div>
          <p data-edition-summary className="t-meta mt-2.5">{progress.total} articles · ~{progress.minutesLeft} min left{view === 'Today' ? ' in the past 24 hours' : ''}</p>
          <p data-reading-tracker className="t-meta mt-0.5">{counts['To be Read']} to be read · {counts.Read} read · {counts.Saved} saved</p>
        </div>

        <div role="group" aria-label="Reading filter" className="flex gap-1 rounded-2xl bg-surface-2/70 p-1">
          {tabs.map(value => (
            <button key={value} type="button" aria-label={value} aria-pressed={filters.tab === value} onClick={() => updateFilters({ tab: value })} className={cn('press min-h-11 min-w-11 flex-1 rounded-xl px-3 text-[13.5px] font-semibold transition-colors', filters.tab === value ? 'bg-bg text-ink shadow-[0_0_0_1px_var(--line),var(--shadow-soft-value)]' : 'text-ink-3 hover:text-ink')}>
              {value}
              <span className={cn('t-num ml-1.5 text-[11.5px]', filters.tab === value ? 'text-accent' : 'text-ink-3')}>{counts[value]}</span>
            </button>
          ))}
        </div>

        <div className="my-4 flex items-center gap-2">
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-accent/60">
            <Search className="size-4 shrink-0 text-ink-3" />
            <input type="search" aria-label="Search articles, topics or sources" placeholder="Search articles…" value={filters.query} onChange={e => updateFilters({ query: e.target.value })} className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-3" />
          </label>
          <button type="button" aria-label="Filters" title="Filters" aria-expanded={filtersOpen} aria-controls="ca-filters" onClick={() => setFiltersOpen(value => !value)} className={cn(control, 'inline-flex shrink-0 items-center gap-2', (filtersOpen || activeFilterCount > 0) && 'bg-accent-soft text-accent')}>
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
        </div>

        <div id="ca-filters" hidden={!filtersOpen} className="mb-5 rounded-2xl bg-surface-2/60 p-4">
          {view === 'Archive' && (
            <div data-archive-controls className="mb-3 flex flex-wrap items-center gap-2">
              <label className="t-label text-[12px] text-ink-3">View
                <select aria-label="Archive grouping" value={period} onChange={e => { setPeriod(e.target.value as ArchivePeriod); setArchiveKey('all') }} className="ml-2 min-h-11 rounded-xl border border-line bg-surface px-2 text-[13px] font-semibold text-ink">{archivePeriods.map(p => <option key={p}>{p}</option>)}</select>
              </label>
              <select aria-label="Archive period" value={archiveKey} onChange={e => setArchiveKey(e.target.value)} className="min-h-11 max-w-full min-w-0 rounded-xl border border-line bg-surface px-2 text-[13px] font-semibold text-ink">
                <option value="all">All older dates</option>
                {periods.map(key => <option key={key} value={key}>{periodLabel(key, period)}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="t-label text-[12px] text-ink-3">Subject<select aria-label="Subject filter" value={filters.subject} onChange={e => updateFilters({ subject: e.target.value })} className={field}>{subjects.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="t-label text-[12px] text-ink-3">Exam<select aria-label="Exam filter" value={filters.exam} onChange={e => updateFilters({ exam: e.target.value as WorkspaceFilters['exam'] })} className={field}>{['All', 'Prelims', 'Mains', 'Both'].map(value => <option key={value} value={value}>{value === 'All' ? 'All exams' : value}</option>)}</select></label>
            <label className="t-label text-[12px] text-ink-3">Publisher<select aria-label="Publisher filter" value={filters.publisher} onChange={e => updateFilters({ publisher: e.target.value })} className={field}>{['All sources', ...publishers].map(value => <option key={value}>{value}</option>)}</select></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Reading time budget" className="flex items-center gap-1">
              <span className="t-label mr-1 text-[12px] text-ink-3">Time</span>
              {[15, 30, 60].map(value => <button key={value} type="button" aria-pressed={filters.budget === value} onClick={() => updateFilters({ budget: filters.budget === value ? null : value })} className={cn(control, 'px-2.5', filters.budget === value && 'bg-accent-soft text-accent')}>{value} min</button>)}
            </div>
            {activeFilterCount > 0 && <button type="button" onClick={resetFilters} className={control}>Reset filters</button>}
          </div>
          {unavailable.length > 0 && <p className="t-meta mt-3 leading-relaxed">Unavailable or empty sources: {[...new Set(unavailable.map(s => NEWS_SOURCES.find(n => n.id === s.sourceId)?.publisher ?? s.sourceId))].join(', ')}.</p>}
        </div>

        {activeFilterCount > 0 && !filtersOpen && (
          <p className="t-meta mb-4">
            {[view === 'Archive' && archiveKey !== 'all' && periodLabel(archiveKey, period), filters.subject !== 'All subjects' && filters.subject, filters.publisher !== 'All sources' && filters.publisher, filters.exam !== 'All' && filters.exam, filters.budget && `${filters.budget} min plan`].filter(Boolean).join(' · ')}
            <button type="button" onClick={resetFilters} className="press ml-2 min-h-10 px-2 font-semibold text-accent">Reset filters</button>
          </p>
        )}
        {loading && <p role="status" className="py-3 text-sm text-ink-2">Loading trusted feeds…</p>}
        {error && <p role="alert" className="py-3 text-sm text-ink-2">{error}</p>}
        {stateError && <p role="alert" className="py-3 text-sm text-danger">{stateError}</p>}
        {archiveError && <p role="alert" className="py-3 text-sm text-danger">{archiveError}</p>}

        <div data-news-list className="ca-list">
          {(filters.query || filters.tab !== 'To be Read' || activeFilterCount > 0) && <p className="t-meta pb-2">{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}{filters.budget ? ` · ~${filtered.reduce((n, e) => n + e.minutes, 0)} min plan` : ''}</p>}
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[15px] font-bold">{emptyTitle}</p>
              <p className="t-meta mx-auto mt-2 max-w-sm leading-relaxed">{view === 'Today' ? 'Today contains only articles published in the past 24 hours. Older articles are in Archive.' : 'Archive contains older retained articles. Change the queue or filters to find more.'}</p>
            </div>
          )}
          {filtered.slice(0, visibleCount).map(event => {
            const p = eventPersonalState(event, state), item = event.primary, related = (view === 'Today' ? recentCoverage(event, now) : event.members).filter(member => member.url !== item.url)
            return (
              <article key={event.id} data-news-event className="ca-row flex min-w-0 flex-wrap items-center gap-x-2 border-t border-line py-2.5 first:border-t-0">
                <a data-news-original href={item.url} target="_blank" rel="noopener noreferrer" className="ca-row-main -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-3.5 rounded-xl px-2 py-2 sm:mr-0 sm:w-auto sm:flex-1">
                  <div className="min-w-0 flex-1">
                    <h3 className={cn('ca-headline text-[15px] leading-snug tracking-[-0.005em] sm:text-[15.5px]', p.readAt ? 'font-medium text-ink-3' : 'font-bold text-ink')}>
                      {event.mustRead && <span className="mr-1.5 text-xs text-accent" aria-label="Must Read">★</span>}
                      {item.title}
                    </h3>
                    <div className="t-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-ink-2">{item.publisher}</span>
                      <span>· {item.publishedAt ? view === 'Archive' ? periodLabel(publicationDay(item.publishedAt), 'Daily') : relativeAge(item.publishedAt, now) : 'Undated'}</span>
                      <span>· {item.relevance.subjects[0]}</span>
                      <span title="Approximate reading time">· {event.minutes} min</span>
                    </div>
                  </div>
                  <FeedThumbnail url={item.thumbnailUrl} />
                </a>
                <div className="-mt-1 -mr-2.5 ml-auto flex shrink-0 sm:mt-0 sm:ml-0">
                  <button type="button" onClick={() => patch(event, { readAt: p.readAt ? undefined : Date.now() })} aria-label={`${p.readAt ? 'Mark unread' : 'Mark as read'}: ${item.title}`} title={p.readAt ? 'Mark unread' : 'Mark as read'} aria-pressed={!!p.readAt} className={cn(rowAction, p.readAt && 'text-success')}><Check className="size-4" /></button>
                  <button type="button" onClick={() => patch(event, { savedAt: p.savedAt ? undefined : Date.now() })} aria-label={`${p.savedAt ? 'Unsave' : 'Save'} ${item.title}`} title={p.savedAt ? 'Unsave' : 'Save'} aria-pressed={!!p.savedAt} className={rowAction}><Bookmark className={cn('size-4', p.savedAt && 'fill-current text-accent')} /></button>
                  <button type="button" onClick={() => remove(event)} aria-label={`Remove article: ${item.title}`} title="Remove irrelevant article" className={rowAction}><X className="size-4" /></button>
                </div>
                {related.length > 0 && (
                  <details data-related-coverage className="w-full text-xs text-ink-2">
                    <summary className="press min-h-10 cursor-pointer py-2 font-semibold text-ink-3 hover:text-ink">{related.length} more {related.length === 1 ? 'article' : 'articles'} on this topic</summary>
                    <p className="pb-1 text-[11px] text-ink-3">Preferred using section and feed metadata. Reading progress tracks this topic.</p>
                    <ul className="divide-y divide-line">{related.map(member => <li key={member.url}><a href={member.url} target="_blank" rel="noopener noreferrer" className="block min-h-11 py-3 leading-relaxed hover:text-accent"><span className="font-semibold">{member.publisher} ↗</span><span className="ml-2">{member.title}</span></a></li>)}</ul>
                  </details>
                )}
                {debug && <details className="w-full text-xs"><summary className="min-h-11 py-3">Evidence</summary><pre className="break-words whitespace-pre-wrap">{JSON.stringify({ ...item.relevance, mustReadScore: event.priority, members: event.members.map(m => m.url) }, null, 2)}</pre></details>}
              </article>
            )
          })}
        </div>
        {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount(n => n + 50)} className={cn(control, 'mt-4 w-full bg-surface-2')}>Show more · {filtered.length - visibleCount} remaining</button>}
        {debug && <details className="mt-4 text-xs"><summary className="min-h-11 cursor-pointer py-3">Debug · {classified.filter(i => !i.relevance.accepted).length} rejected links</summary><ul className="space-y-2 text-ink-2">{classified.filter(i => !i.relevance.accepted).map(i => <li key={i.url}>{i.title} · {i.relevance.rejectionReason} · {i.relevance.signals.join(', ')}</li>)}</ul></details>}
        <p className="t-meta mt-8 leading-relaxed">Read on the original publisher’s website. Reading times are approximate. Older metadata is retained on this device as you use Tars.</p>
        <NotesSheet open={notesOpen} onClose={() => setNotesOpen(false)} />
      </Workspace>
    </section>
  )
}
