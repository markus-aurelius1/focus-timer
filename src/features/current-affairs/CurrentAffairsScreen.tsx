/** Daily original-link workspace with independent desktop panes, mobile details and a stable study queue. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, RefreshCw, Search } from 'lucide-react'
import { useRoute } from '@/app/router'
import { chordPending, isTyping } from '@/app/shortcuts'
import { cn } from '@/lib/cn'
import { classify } from '@/current-affairs/relevance'
import { clusterItems } from '@/current-affairs/cluster'
import { NEWS_SOURCES } from '@/current-affairs/sources'
import { eventPersonalState } from '@/current-affairs/personal-state'
import { buildWorkspace, dailyGroups, editionLabel, editionProgress, filterWorkspace, publicationDay, shiftDay, UNDATED, type WorkspaceFilters, type WorkspaceEvent } from '@/current-affairs/workspace'
import { Sheet, anyLayerOpen } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { ArticleActions, ArticleInspector, actionClass, examLabel } from './ArticleInspector'
import { useFeeds, relativeAge } from './useFeeds'
import { usePersonalState } from './usePersonalState'
import './workspace.css'
const tabs = ['All CA', 'Must Read', 'Unread', 'Saved'] as const
const subjects = ['All subjects', 'Polity', 'Economy', 'Environment', 'Sci-Tech', 'Geography', 'International relations', 'Governance', 'Security', 'History & Culture']
const control = 'press min-h-11 rounded-xl px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-40'
export default function CurrentAffairsScreen() {
  const route = useRoute(), desktop = useIsDesktop(), debug = route.params.get('debug') === '1' || new URLSearchParams(location.search).get('debug') === '1'
  const { data, index, loading, error, cached, now, online, reload } = useFeeds()
  const { state, stateError, patch } = usePersonalState()
  const today = publicationDay(now), lastToday = useRef(today)
  const [filters, setFilters] = useState<WorkspaceFilters>(() => ({ day: publicationDay(Date.now()), tab: 'All CA', exam: 'All', subject: 'All subjects', publisher: 'All sources', query: '', budget: null }))
  const [selectedKey, setSelectedKey] = useState<string | null>(null), [mobileOpen, setMobileOpen] = useState(false)
  const [studyQueue, setStudyQueue] = useState<WorkspaceEvent[] | null>(null), [studyPosition, setStudyPosition] = useState(0)
  const listRef = useRef<HTMLDivElement>(null), inspectorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (lastToday.current === today) return
    const prior = lastToday.current
    lastToday.current = today
    setFilters(f => f.day === prior ? { ...f, day: today } : f)
  }, [today])
  const classified = useMemo(() => data && index ? data.items.map(item => ({ ...item, relevance: classify(item, index) })) : [], [data, index])
  const events = useMemo(() => index ? buildWorkspace(clusterItems(classified), index) : [], [classified, index])
  const editions = useMemo(() => dailyGroups(events), [events])
  const filtered = useMemo(() => filterWorkspace(events, state, filters), [events, state, filters])
  const findEvent = (key: string | null) => events.find(e => e.id === key || e.members.some(m => m.url === key))
  const selected = findEvent(selectedKey) ?? filtered[0]
  const studyEvents = studyQueue ?? []
  const studyEvent = studyEvents[Math.min(studyPosition, studyEvents.length - 1)]
  const active = studyQueue ? studyEvent : selected
  const progress = editionProgress(editions.get(filters.day) ?? [], state)
  const personal = active ? eventPersonalState(active, state) : {}
  const stale = !!data && (!online || cached || now - Date.parse(data.fetchedAt) > 3600000)
  const unavailable = data?.sources.filter(s => s.status !== 'ok') ?? []
  const publishers = [...new Set(events.flatMap(e => e.members.map(m => m.publisher)))].sort()
  const recentDays = [...editions.keys()].filter(day => day !== UNDATED && day !== today).sort().reverse().slice(0, 4)
  const updateFilters = (value: Partial<WorkspaceFilters>) => { setFilters(f => ({ ...f, ...value })); setSelectedKey(null); if (listRef.current) listRef.current.scrollTop = 0 }
  const choose = (key: string) => { setSelectedKey(key); if (!desktop) setMobileOpen(true); if (inspectorRef.current) inspectorRef.current.scrollTop = 0 }
  const markRead = (event: WorkspaceEvent) => { setSelectedKey(event.id); patch(event, { readAt: eventPersonalState(event, state).readAt ? undefined : Date.now() }) }
  const toggleRead = () => { if (active) markRead(active) }
  const toggleSave = () => { if (active) patch(active, { savedAt: personal.savedAt ? undefined : Date.now() }) }
  const move = (delta: number) => {
    if (studyQueue) {
      const next = Math.max(0, Math.min(studyEvents.length - 1, studyPosition + delta))
      setStudyPosition(next)
      if (studyEvents[next]) setSelectedKey(studyEvents[next].id)
    } else {
      const position = filtered.findIndex(e => e.id === selected?.id)
      const next = position < 0 ? (delta > 0 ? 0 : filtered.length - 1) : Math.max(0, Math.min(filtered.length - 1, position + delta))
      if (filtered[next]) choose(filtered[next].id)
    }
  }
  useEffect(() => {
    if (!desktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || isTyping(e.target) || chordPending() || !active) return
      if (anyLayerOpen() && (!studyQueue || !document.querySelector('[data-ca-study]') || document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1)) return
      const key = e.key.toLowerCase()
      if (!['j', 'arrowdown', 'k', 'arrowup', 'r', 's', 'o'].includes(key)) return
      e.preventDefault()
      if (key === 'j' || key === 'arrowdown') move(1)
      else if (key === 'k' || key === 'arrowup') move(-1)
      else if (key === 'r') toggleRead()
      else if (key === 's') toggleSave()
      else window.open(active.primary.url, '_blank', 'noopener,noreferrer')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const startStudy = () => {
    const queue = filterWorkspace(events, state, { ...filters, day: today })
    updateFilters({ day: today }); setStudyQueue(queue); setStudyPosition(0); setMobileOpen(false)
    if (queue[0]) setSelectedKey(queue[0].id)
  }
  const studyCount = editionProgress(studyEvents, state)
  const studyAvailable = filterWorkspace(events, state, { ...filters, day: today }).length > 0
  const inspector = (event: WorkspaceEvent, actions = true) => <ArticleInspector key={event.id} event={event} personal={eventPersonalState(event, state)} onRead={() => markRead(event)} onSave={() => patch(event, { savedAt: eventPersonalState(event, state).savedAt ? undefined : Date.now() })} onNote={note => patch(event, { note })} debug={debug} actions={actions} />
  return <section className="ca-workspace mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 lg:px-8" aria-labelledby="news-title">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-[10px] font-bold tracking-[.18em] text-ink-3 uppercase">Your daily UPSC reading</p><h1 id="news-title" className="font-display text-3xl tracking-tight sm:text-4xl">Current Affairs</h1></div>
      <div className="flex max-w-full items-center gap-2"><p role="status" className="max-w-56 text-xs leading-relaxed text-ink-3">{data ? `Updated ${relativeAge(data.fetchedAt, now)}` : 'Trusted publisher feeds'}{data && stale && <span className="block">{!online ? 'Offline – cached feed' : cached ? 'Cached feed – offline or refresh unavailable' : 'Stale feed'}</span>}</p><button type="button" aria-label="Refresh news" onClick={reload} disabled={loading} className={control}><RefreshCw className={cn('size-4', loading && 'animate-spin motion-reduce:animate-none')} /></button></div>
    </header>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <button type="button" aria-label="Previous day" disabled={filters.day === UNDATED} onClick={() => updateFilters({ day: shiftDay(filters.day, -1) })} className={control}><ArrowLeft className="size-4" /></button>
        <button type="button" onClick={() => updateFilters({ day: today })} className={cn(control, filters.day === today && 'bg-accent-soft text-accent')}>Today</button>
        <label className="sr-only" htmlFor="ca-date">Edition date</label><input id="ca-date" type="date" aria-label="Edition date" value={filters.day === UNDATED ? '' : filters.day} onChange={e => e.target.value && updateFilters({ day: e.target.value })} className="min-h-11 min-w-0 max-w-[124px] rounded-xl border border-line bg-surface px-2 text-xs text-ink-2 sm:max-w-[154px]" />
        <button type="button" aria-label="Next day" disabled={filters.day === UNDATED || filters.day >= today} onClick={() => updateFilters({ day: shiftDay(filters.day, 1) })} className={control}><ArrowRight className="size-4" /></button>
      </div>
      <button type="button" aria-label="Study mode" title="Study mode" onClick={startStudy} disabled={!studyAvailable} className={cn(control, 'inline-flex items-center gap-2 border border-line-strong')}><BookOpen className="size-4" /><span className="hidden sm:inline">Study mode</span></button>
    </div>
    <div className="mt-4 border-y border-line py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xs font-bold tracking-wider uppercase">{filters.day === today ? `Today – ${editionLabel(today)}` : editionLabel(filters.day)}</h2><p data-edition-summary className="mt-1.5 text-xs text-ink-2">{progress.mustRead} Must Read · {progress.total} relevant · ~{progress.minutesLeft} min left{filters.day === today ? ' today' : ''}</p></div><p data-edition-progress className="text-xs font-semibold text-ink-2">{progress.total > 0 && progress.unread === 0 ? 'Complete ✓' : `${progress.read} / ${progress.total} read`}</p></div>
      <div role="progressbar" aria-label="Daily reading progress" aria-valuemin={0} aria-valuemax={Math.max(progress.total, 1)} aria-valuenow={progress.read} className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${progress.total ? progress.read / progress.total * 100 : 0}%` }} /></div>
      {(recentDays.length > 0 || editions.has(UNDATED)) && <nav aria-label="Recent editions" className="mt-2 flex flex-wrap gap-x-3">{[...recentDays, ...(editions.has(UNDATED) ? [UNDATED] : [])].map(day => { const p = editionProgress(editions.get(day) ?? [], state); return <button key={day} type="button" onClick={() => updateFilters({ day })} className={cn('press min-h-10 text-[11px] text-ink-3', filters.day === day && 'text-accent')}><span className="font-semibold">{editionLabel(day)}</span> · {p.unread ? `${p.unread} unread` : 'Complete ✓'}</button> })}</nav>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Reading filter" className="flex flex-wrap gap-1">{tabs.map(value => <button key={value} type="button" aria-pressed={filters.tab === value} onClick={() => updateFilters({ tab: value })} className={cn(control, filters.tab === value && 'bg-accent-soft text-accent')}>{value === 'Must Read' ? '★ Must Read' : value}</button>)}</div>
      <div role="group" aria-label="Reading time budget" className="flex gap-1">{[15, 30, 60].map(value => <button key={value} type="button" aria-pressed={filters.budget === value} onClick={() => updateFilters({ budget: filters.budget === value ? null : value })} className={cn(control, 'px-2.5', filters.budget === value && 'bg-accent-soft text-accent')}>{value} min</button>)}</div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="flex min-h-11 min-w-0 flex-[1_1_280px] items-center gap-2 rounded-xl border border-line-strong bg-surface px-3"><Search className="size-4 shrink-0 text-ink-3" /><input type="search" aria-label="Search articles, topics or sources" placeholder="Search articles, topics or sources…" value={filters.query} onChange={e => updateFilters({ query: e.target.value })} className="w-full min-w-0 bg-transparent text-sm outline-none" /></label>
      <select aria-label="Exam filter" value={filters.exam} onChange={e => updateFilters({ exam: e.target.value as WorkspaceFilters['exam'] })} className="min-h-11 min-w-0 rounded-xl border border-line bg-surface px-3 text-xs text-ink-2">{['All', 'Prelims', 'Mains', 'Both'].map(value => <option key={value} value={value}>{value === 'All' ? 'All exams' : value}</option>)}</select>
      <select aria-label="Publisher filter" value={filters.publisher} onChange={e => updateFilters({ publisher: e.target.value })} className="min-h-11 min-w-0 max-w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink-2">{['All sources', ...publishers].map(value => <option key={value}>{value}</option>)}</select>
    </div>
    {desktop ? <div className="mt-2 flex flex-wrap gap-x-1" role="group" aria-label="Subject filter">{subjects.map(value => <button type="button" key={value} aria-pressed={filters.subject === value} onClick={() => updateFilters({ subject: value })} className={cn(control, 'px-2.5', filters.subject === value && 'bg-surface-2 text-ink')}>{value === 'International relations' ? 'IR' : value}</button>)}</div> : <select aria-label="Subject filter" value={filters.subject} onChange={e => updateFilters({ subject: e.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink-2">{subjects.map(value => <option key={value}>{value}</option>)}</select>}
    {loading && <p role="status" className="py-3 text-sm text-ink-2">Loading trusted feeds…</p>}
    {error && <p role="alert" className="py-3 text-sm text-ink-2">{error}</p>}
    {stateError && <p role="alert" className="py-3 text-sm text-danger">{stateError}</p>}
    {unavailable.length > 0 && <p className="py-2 text-[11px] text-ink-3">Some sources are unavailable or empty: {[...new Set(unavailable.map(s => NEWS_SOURCES.find(n => n.id === s.sourceId)?.publisher ?? s.sourceId))].join(', ')}.</p>}
    <div className="ca-panes mt-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div ref={listRef} data-news-list className="ca-list min-w-0">
        <div className="flex min-h-11 items-center justify-between border-b border-line px-4 text-[11px] text-ink-3"><span>{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}{filters.budget ? ` · ~${filtered.reduce((n, e) => n + e.minutes, 0)} min plan` : ''}</span><span>{filters.tab === 'All CA' ? 'Priority first' : filters.tab}</span></div>
        {!loading && filtered.length === 0 && <div className="px-5 py-12"><p className="text-sm font-semibold">{progress.total === 0 ? 'No edition available for this date' : 'No articles match these filters'}</p><p className="mt-2 text-xs leading-relaxed text-ink-3">{progress.total === 0 ? 'Choose a recent edition or refresh later. Only dates in the cached feeds are available.' : 'Try All CA, another subject or a larger reading budget.'}</p></div>}
        {filtered.map(event => { const p = eventPersonalState(event, state), item = event.primary; return <article key={event.id} data-news-event data-selected={selected?.id === event.id} className={cn('ca-row relative flex min-w-0 items-stretch border-b border-line', selected?.id === event.id && 'bg-accent-soft')}>
          <button type="button" onClick={() => choose(event.id)} aria-label={`Inspect ${item.title}`} aria-pressed={selected?.id === event.id} className="ca-row-main min-w-0 flex-1 px-4 py-3 text-left">
            <div className="flex items-start gap-2"><span className={cn('mt-0.5 shrink-0 text-xs', event.mustRead ? 'text-accent' : 'text-ink-3')} aria-label={event.mustRead ? 'Must Read' : 'Relevant'}>{event.mustRead ? '★' : '·'}</span><h3 className={cn('ca-headline text-[13px] leading-snug font-semibold', p.readAt ? 'text-ink-2' : 'text-ink')}>{item.title}</h3></div>
            <p className="mt-1.5 text-[10px] text-ink-3">{item.publisher} · {item.publishedAt ? relativeAge(item.publishedAt, now) : 'Undated'}{p.readAt && <span className="ml-2 text-success">✓ Read</span>}</p>
            <p className="ca-row-meta mt-1 text-[10px] text-ink-3">{item.relevance.subjects.join(' · ')} · {item.relevance.topics[0]} · {examLabel(item.relevance.exam)}</p>
          </button>
          <div className="flex w-12 shrink-0 flex-col items-center justify-center"><button type="button" onClick={() => patch(event, { savedAt: p.savedAt ? undefined : Date.now() })} aria-label={`${p.savedAt ? 'Unsave' : 'Save'} ${item.title}`} aria-pressed={!!p.savedAt} className="press flex size-11 items-center justify-center text-ink-3"><Bookmark className={cn('size-3.5', p.savedAt && 'fill-current text-accent')} /></button><span title="Approximate reading time" className="pb-2 text-[10px] text-ink-3">{event.minutes} min</span></div>
        </article> })}
      </div>
      {desktop && <div ref={inspectorRef} data-desktop-inspector className="ca-inspector min-w-0 border-l border-line p-6 lg:p-7">{selected ? inspector(selected) : <p className="py-12 text-sm text-ink-3">Choose an article to inspect its UPSC context.</p>}</div>}
    </div>
    {desktop && selected && <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] text-ink-3">J / K · Next / previous &nbsp; R · Read &nbsp; S · Save &nbsp; O · Open</p><div className="flex gap-1"><button type="button" className={control} onClick={() => move(-1)} disabled={filtered.findIndex(e => e.id === selected.id) === 0 || !filtered.length}>← Previous</button><button type="button" className={control} onClick={() => move(1)} disabled={filtered.findIndex(e => e.id === selected.id) === filtered.length - 1 || !filtered.length}>Next →</button></div></div>}
    {debug && <details className="mt-4 text-xs"><summary className="min-h-11 cursor-pointer py-3">Debug · {classified.filter(i => !i.relevance.accepted).length} rejected links</summary><ul className="space-y-2 text-ink-2">{classified.filter(i => !i.relevance.accepted).map(i => <li key={i.url}>{i.title} · {i.relevance.rejectionReason} · {i.relevance.signals.join(', ')}</li>)}</ul></details>}
    <p className="mt-5 text-[11px] leading-relaxed text-ink-3">Read on the original publisher’s website. Time estimates use feed type; some articles require a subscription.</p>
    <Sheet open={!desktop && mobileOpen && !!selected && !studyQueue} onClose={() => setMobileOpen(false)} title="Article context" headerAction={<button type="button" onClick={() => setMobileOpen(false)} className={control}>← Back</button>} footer={selected && <ArticleActions event={selected} personal={eventPersonalState(selected, state)} onRead={toggleRead} onSave={toggleSave} />}>
      {selected && inspector(selected, false)}
    </Sheet>
    <Sheet open={!!studyQueue} onClose={() => setStudyQueue(null)} title="Study mode" subtitle={`Today · ${studyEvents.length ? Math.min(studyPosition + 1, studyEvents.length) : 0} / ${studyEvents.length} · ${studyCount.read} read`} size="lg" footer={studyEvent && <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className={control} onClick={() => move(-1)} disabled={studyPosition === 0}>← Previous</button><button type="button" onClick={toggleRead} className={cn(actionClass, 'bg-primary text-primary-ink')}>{personal.readAt ? 'Mark unread' : 'Mark as read'}</button><button type="button" className={control} onClick={() => move(1)} disabled={studyPosition >= studyEvents.length - 1}>Next →</button></div>}>
      <div data-ca-study className="pb-4">{studyEvent ? <><p className="mb-4 text-xs text-ink-3">{studyCount.total > 0 && studyCount.unread === 0 ? 'Reading set complete ✓' : `~${studyCount.minutesLeft} min left in this reading set`}</p><p className="text-xs text-ink-3">{studyEvent.primary.publisher} · {studyEvent.minutes} min</p><h2 className="mt-4 font-display text-[28px] leading-tight">{studyEvent.primary.title}</h2><p className="mt-4 text-sm text-ink-2">{studyEvent.primary.relevance.subjects.join(' · ')} · {studyEvent.mustRead ? '★ Must Read' : 'Relevant'} · {examLabel(studyEvent.primary.relevance.exam)}</p><div className="mt-6"><a data-study-original href={studyEvent.primary.url} target="_blank" rel="noopener noreferrer" className={cn(actionClass, 'bg-primary text-primary-ink')}>Open original ↗</a><button type="button" onClick={toggleSave} className={actionClass}>{personal.savedAt ? 'Unsave' : 'Save'}</button></div>{desktop && <p className="mt-6 text-xs text-ink-3">J / ↓ next · K / ↑ previous · R read · S save · O open</p>}</> : <p className="py-8 text-sm text-ink-2">No matching articles in today’s edition.</p>}</div>
    </Sheet>
  </section>
}
