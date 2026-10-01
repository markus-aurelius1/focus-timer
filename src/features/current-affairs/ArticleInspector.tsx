/** Context stays grounded in classifier/feed evidence; publisher pages remain the reading surface. */
import { useEffect, useState } from 'react'
import { ArrowUpRight, Bookmark, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { referenceLinks } from '@/current-affairs/static-links'
import { NOTE_LIMIT, type PersonalEntry } from '@/current-affairs/personal-state'
import { EDITION_TIMEZONE, type WorkspaceEvent } from '@/current-affairs/workspace'
export const actionClass = 'press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40'
export const examLabel = (exam: string) => exam === 'both' ? 'Prelims + Mains' : exam === 'mains' ? 'Mains' : 'Prelims'
const gsPapers: Record<string, string> = { Polity: 'GS2', Governance: 'GS2', 'International relations': 'GS2', Economy: 'GS3', Environment: 'GS3', 'Sci-Tech': 'GS3', Security: 'GS3', Geography: 'GS1', 'History & Culture': 'GS1' }
export function ArticleActions({ event, personal, onRead, onSave }: { event: WorkspaceEvent; personal: PersonalEntry; onRead: () => void; onSave: () => void }) {
  return <div className="flex flex-wrap gap-2">
    <a className={cn(actionClass, 'bg-primary text-primary-ink')} href={event.primary.url} target="_blank" rel="noopener noreferrer">Open original <ArrowUpRight className="size-4" /></a>
    <button type="button" onClick={onRead} className={cn(actionClass, 'bg-surface-2 text-ink')}><Check className="size-4" />{personal.readAt ? 'Mark unread' : 'Mark as read'}</button>
    <button type="button" onClick={onSave} aria-label={personal.savedAt ? 'Unsave article' : 'Save article'} aria-pressed={!!personal.savedAt} className={cn(actionClass, 'text-ink-2', personal.savedAt && 'text-accent')}><Bookmark className={cn('size-4', personal.savedAt && 'fill-current')} />{personal.savedAt ? 'Unsave' : 'Save'}</button>
  </div>
}
function Notes({ note, onNote }: { note: string; onNote: (note: string) => boolean }) {
  const [draft, setDraft] = useState(note), [saved, setSaved] = useState(true)
  useEffect(() => { setDraft(note) }, [note])
  return <div>
    <label htmlFor="ca-note" className="mb-3 block text-sm font-semibold">Your notes</label>
    <textarea id="ca-note" rows={7} maxLength={NOTE_LIMIT} value={draft} placeholder="Connect this event to what you’re studying…" onChange={e => { setDraft(e.target.value); setSaved(onNote(e.target.value)) }} className="w-full resize-y rounded-xl border border-line-strong bg-bg p-4 text-sm leading-relaxed outline-none focus:border-accent" />
    <p role="status" className="mt-2 text-xs text-ink-3">{saved ? 'Saved on this device' : 'Not saved – local storage is unavailable'} · {draft.length.toLocaleString()} / {NOTE_LIMIT.toLocaleString()}</p>
  </div>
}
export function ArticleInspector({ event, personal, onRead, onSave, onNote, debug = false, actions = true }: { event: WorkspaceEvent; personal: PersonalEntry; onRead: () => void; onSave: () => void; onNote: (note: string) => boolean; debug?: boolean; actions?: boolean }) {
  const [tab, setTab] = useState('Overview')
  const references = event.primary.relevance.staticAnchors.flatMap(referenceLinks).filter((link, i, all) => all.findIndex(other => other.url === link.url) === i)
  const tabs = ['Overview', ...(event.members.length > 1 ? ['Related coverage'] : []), ...(references.length ? ['References'] : []), 'Notes']
  const activeTab = tabs.includes(tab) ? tab : 'Overview'
  const item = event.primary, r = item.relevance
  return <article data-news-inspector className="min-w-0">
    <p className="text-xs leading-relaxed text-ink-3">{item.publisher} · {item.publishedAt ? <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleString('en-IN', { timeZone: EDITION_TIMEZONE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} IST</time> : 'Publication date unavailable'}</p>
    <div className="mt-4 flex items-center justify-between gap-3"><span className={cn('text-xs font-bold', event.mustRead ? 'text-accent' : 'text-ink-2')}>{event.mustRead ? '★ Must Read' : 'Relevant'}</span>{!!personal.readAt && <span className="flex items-center gap-1 text-xs text-success"><Check className="size-3.5" />Read</span>}</div>
    <h2 className="mt-4 break-words font-display text-[28px] leading-[1.22] tracking-tight text-ink lg:text-[34px]">{item.title}</h2>
    <div className="mt-5 flex flex-wrap gap-2 text-xs text-ink-2">{[...r.subjects, ...new Set(r.subjects.map(s => gsPapers[s]).filter(Boolean)), ...r.topics, examLabel(r.exam)].map(label => <span key={label} className="rounded-lg bg-surface-2 px-2.5 py-1.5">{label}</span>)}<span title="Approximate reading time, estimated from feed type" className="py-1.5">{event.minutes} min</span></div>
    {actions && <div className="mt-6"><ArticleActions event={event} personal={personal} onRead={onRead} onSave={onSave} /></div>}
    <div className="mt-7 flex flex-wrap gap-x-4 border-b border-line" role="tablist" aria-label="Article context">{tabs.map(value => <button key={value} type="button" role="tab" aria-selected={value === activeTab} aria-controls="ca-context-panel" id={`ca-tab-${value.replace(/ /g, '-')}`} onClick={() => setTab(value)} className={cn('press min-h-11 border-b-2 text-xs font-semibold', activeTab === value ? 'border-accent text-accent' : 'border-transparent text-ink-3')}>{value}</button>)}</div>
    <div id="ca-context-panel" role="tabpanel" aria-labelledby={`ca-tab-${activeTab.replace(/ /g, '-')}`} className="py-5 text-sm leading-relaxed">
      {activeTab === 'Overview' && <>
        <h3 className="mb-3 text-sm font-semibold">Why Tars kept this</h3>
        <ul className="list-disc space-y-2 pl-4 text-ink-2">{[...new Set([...r.staticAnchors, ...r.topics, ...event.priorityReasons])].map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p className="mt-4 text-xs text-ink-3">Based on headline concepts, CSE PYQ demand and syllabus evidence.</p>
        {item.description && <div className="mt-6 border-t border-line pt-5"><h3 className="mb-2 text-xs font-bold tracking-wide text-ink-3 uppercase">From the feed</h3><p className="break-words text-ink-2">{item.description}</p></div>}
      </>}
      {activeTab === 'Related coverage' && <ul className="divide-y divide-line">{event.members.filter(m => m.url !== item.url).map(member => <li key={member.url} className="py-3"><a className="inline-flex min-h-11 items-start gap-2 text-sm font-semibold text-ink hover:text-accent" href={member.url} target="_blank" rel="noopener noreferrer">{member.title}<ArrowUpRight className="mt-1 size-4 shrink-0" /></a><p className="text-xs text-ink-3">{member.publisher} · {member.section}</p></li>)}</ul>}
      {activeTab === 'References' && <ul className="space-y-2">{references.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-2 hover:text-accent">{link.concept} · {link.provider}<ArrowUpRight className="size-4" /></a></li>)}</ul>}
      {activeTab === 'Notes' && <Notes key={event.id} note={personal.note ?? ''} onNote={onNote} />}
    </div>
    {debug && <pre className="overflow-auto whitespace-pre-wrap break-words text-xs text-ink-2">{JSON.stringify({ score: r.score, mustReadScore: event.priority, signals: r.signals, members: event.members.map(m => m.url) }, null, 2)}</pre>}
  </article>
}
