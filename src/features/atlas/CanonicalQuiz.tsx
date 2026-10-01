/** Premium canonical questions, with supplied answers only and role-aware return paths to the map. */
import { useEffect, useRef, useState } from 'react'
import { getPyqCatalog, getPyqQuestion } from '@/atlas/pyq/catalog'
import { meaningfulRelations, pyqAttempt } from '@/atlas/pyq/experience'
import { AtlasPyqBody } from '@/atlas/pyq/QuestionBody'
import type { AtlasPyqQuestion, AtlasPyqAnswer, OptionKey } from '@/atlas/pyq/types'
import type { AtlasData } from '@/atlas/data'
import { create } from '@/data/repo'
import { todayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'

export function CanonicalQuiz({ id, atlas, onClose, onPlace }: { id: string | null; atlas: AtlasData; onClose: () => void; onPlace: (id: string) => void }) {
  return <Sheet open={!!id} onClose={onClose} title="Previous question" size="lg">{id && <Question key={id} id={id} atlas={atlas} onPlace={onPlace} />}</Sheet>
}
function Question({ id, atlas, onPlace }: { id: string; atlas: AtlasData; onPlace: (id: string) => void }) {
  const [data, setData] = useState<{ question: AtlasPyqQuestion; answer: AtlasPyqAnswer }>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<OptionKey | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  useEffect(() => { let live = true; setError(''); void getPyqCatalog().then(({ manifest }) => getPyqQuestion(id, manifest)).then((v) => { if (live) setData(v) }).catch(() => { if (live) setError('This verified question couldn’t load. Connect and try again.') }); return () => { live = false } }, [id, retry])
  if (error && !data) return <div role="alert"><p>{error}</p><Button className="mt-3" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div>
  if (!data) return <p role="status">Loading the verified question…</p>
  const { question: q, answer } = data
  const correct = selected && answer.correctOptions.includes(selected)
  const submit = async () => {
    if (!selected || lock.current || submitted) return
    lock.current = true; setSaving(true); setError('')
    try { await create('recalls', pyqAttempt(q, answer, selected, Date.now(), todayKey())); setSubmitted(true) }
    catch { setError('Your answer couldn’t be saved. Try submitting again.'); lock.current = false }
    finally { setSaving(false) }
  }
  const related = [...new Map(meaningfulRelations(q.relations).map((r) => [r.placeId, r])).values()].filter((r) => atlas.byId.has(r.placeId))
  return <article className="canonical-quiz" data-question-id={q.id} data-question-type={q.question.type}>
    <p className="mb-5 text-xs font-bold tracking-wide text-ink-3">{q.family} · {q.exam.year}{q.exam.cycle ? ` · ${q.exam.cycle}` : ''} · Question {q.question.number}{q.family === 'CDS' ? ' · Enrichment' : ''}</p>
    <AtlasPyqBody blocks={q.question.content} />
    <fieldset className="mt-7 min-w-0 space-y-3" disabled={submitted || saving}><legend className="sr-only">Choose your answer</legend>
      {q.question.options.map((option) => <label key={option.key} className={cn('quiz-option flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors', selected === option.key ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-surface-2', submitted && answer.correctOptions.includes(option.key) && 'border-success bg-success/10', submitted && selected === option.key && !correct && 'border-danger bg-danger/10')}>
        <input type="radio" name={`answer-${q.id}`} value={option.key} checked={selected === option.key} onChange={() => setSelected(option.key)} className="mt-1 shrink-0 accent-[var(--accent)]" />
        <span className="text-sm font-bold">{option.key}</span><span className="min-w-0 flex-1"><AtlasPyqBody blocks={option.content} /></span>
      </label>)}
    </fieldset>
    {!submitted && <Button variant="primary" className="mt-5 w-full" disabled={!selected || saving} onClick={() => void submit()}>{saving ? 'Saving…' : 'Submit answer'}</Button>}
    {error && <p className="mt-3 text-danger" role="alert">{error}</p>}
    {submitted && <section className="mt-6 border-t border-line pt-5" aria-live="polite"><h3 className={cn('font-bold', correct ? 'text-success' : 'text-danger')}>{correct ? 'Correct' : 'Incorrect'}</h3><p className="mt-2 text-sm">Your answer: {selected} · Accepted answer{answer.correctOptions.length > 1 ? 's' : ''}: {answer.correctOptions.join(' or ')}</p><p className="mt-2 text-xs text-ink-3">Saved to your quiz history.</p></section>}
    <section className="mt-7 border-t border-line pt-5"><h3 className="text-xs font-bold tracking-wide text-ink-3 uppercase">Related places · View on Atlas</h3><div className="mt-3 flex flex-wrap gap-2">{related.map((r) => <Button key={r.placeId} size="sm" onClick={() => onPlace(r.placeId)}>{atlas.byId.get(r.placeId)!.name} · {r.semanticRole === 'primary' ? 'Primary' : r.semanticRole === 'comparison' ? 'Comparison' : 'Supporting'}</Button>)}</div></section>
  </article>
}
