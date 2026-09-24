import { BookmarkPlus, ChevronRight, Crosshair, GraduationCap, Lock, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { MASTERY_LABEL, type PlaceMastery } from '@/atlas/mastery'
import type { Place, PlaceRelations } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { addTask } from '@/planner/tasks'
import { todayKey, relativeDayLabel } from '@/lib/time'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/controls'
import { toast } from '@/ui/toast'
import { MASTERY_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { breadcrumb, masteryFn, PlaceIcon } from './util'
import type { MapTarget } from './AtlasMap'

const REL_LABEL: Record<keyof PlaceRelations, string> = {
  tributaryOf: 'Tributary of',
  bank: 'Bank',
  distributaryOf: 'Distributary of',
  flowsInto: 'Flows into',
  onRiver: 'On the river',
  range: 'Range',
  border: 'Border with',
  connects: 'Connects',
  source: 'Source',
  within: 'Within',
  near: 'Near',
  famousFor: 'Famous for',
}
const BACK_LABEL: Partial<Record<keyof PlaceRelations, string>> = {
  tributaryOf: 'Tributaries',
  distributaryOf: 'Distributaries',
  onRiver: 'Along its banks',
  range: 'In this range',
  source: 'Rises here',
  within: 'Contains',
  flowsInto: 'Receives',
  connects: 'Connected by',
  near: 'Nearby',
}

export function PlaceDetails({ ex, place: p, onSelect, onTest, onShow }: { ex: Exploration; place: Place; onSelect: (t: MapTarget) => void; onTest: (id: string) => void; onShow?: (p: Place) => void }) {
  const { atlas } = ex
  const discovered = ex.state.discovered.get(p.id)
  const level = masteryFn(ex)(p.id)
  const m = ex.mastery.get(p.id)
  const crumbs = breadcrumb(atlas, p)

  const rels: Array<{ label: string; items: ReactNode }> = []
  for (const [key, v] of Object.entries(p.rel ?? {}) as Array<[keyof PlaceRelations, unknown]>) {
    if (key === 'bank') continue
    const ids = (Array.isArray(v) ? v : [v]) as string[]
    const label = key === 'tributaryOf' && p.rel?.bank ? `Tributary (${p.rel.bank} bank) of` : REL_LABEL[key]
    rels.push({
      label,
      items: ids.map((id) => {
        const target = atlas.byId.get(id)
        if (target) return <LinkChip key={id} place={target} ex={ex} onClick={() => onSelect({ type: 'place', id })} />
        const c = atlas.country(id)
        return <span key={id} className="rounded-full border border-line px-2.5 py-1 text-[13px] font-semibold">{c?.name ?? id}</span>
      }),
    })
  }
  const back = new Map<string, Place[]>()
  for (const r of atlas.referencedBy.get(p.id) ?? []) {
    const label = BACK_LABEL[r.key as keyof PlaceRelations]
    if (!label) continue
    if (!back.has(label)) back.set(label, [])
    if (!back.get(label)!.includes(r.place)) back.get(label)!.push(r.place)
  }
  for (const [label, list] of back) rels.push({ label, items: list.map((q) => <LinkChip key={q.id} place={q} ex={ex} onClick={() => onSelect({ type: 'place', id: q.id })} />) })

  const stopsIn = atlas.expeditions.flatMap((e) =>
    e.chapters.flatMap((c, ci) => c.stops.map((s, si) => ({ e, ci, si, c, s }))).filter((x) => x.s.place === p.id),
  )

  const addRevision = async () => {
    await addTask({ title: `Revise ${p.name}`, notes: p.facts.join('\n'), plannedFor: todayKey(), estimatedPomodoros: 1 })
    toast({ title: 'Revision task added', body: `Revise ${p.name} · today`, tone: 'success' })
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-10 items-center justify-center rounded-2xl bg-surface-2">
          <PlaceIcon kind={p.kind} tags={p.tags} size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[26px] leading-tight font-medium tracking-tight">{p.name}</h2>
          <p className="mt-0.5 text-[13px] font-semibold text-ink-2">{placeSubtitle(p, atlas, KIND_NAME[p.kind])}</p>
          {p.aka?.length ? <p className="mt-0.5 text-[13px] text-ink-3 italic">Also {p.aka.join(', ')}</p> : null}
        </div>
      </div>

      <nav aria-label="Where" className="mt-3 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-ink-3">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            {c.target ? (
              <button type="button" className="rounded px-0.5 text-ink-2 underline-offset-2 hover:underline" onClick={() => onSelect(c.target!)}>
                {c.label}
              </button>
            ) : (
              <span>{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {discovered ? (
        <>
          <MasteryRow level={level} m={m} />
          <ul className="mt-4 space-y-2">
            {p.facts.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {rels.length > 0 && (
            <div className="mt-5 space-y-2.5">
              {rels.map((r, i) => (
                <div key={i}>
                  <p className="text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">{r.label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{r.items}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="primary" icon={<GraduationCap className="size-4" />} onClick={() => onTest(p.id)}>
              Test me
            </Button>
            <Button icon={<BookmarkPlus className="size-4" />} onClick={addRevision}>
              Revision task
            </Button>
            {onShow && (
              <Button className="col-span-2" variant="ghost" icon={<Crosshair className="size-4" />} onClick={() => onShow(p)}>
                Show on the map
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="flex items-center gap-2 text-[15px] font-bold">
            <Lock className="size-4 text-ink-3" /> Not yet discovered
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Its notes and questions unlock when your focus time reaches it.</p>
          {stopsIn.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {stopsIn.map(({ e, c, ci, si }) => (
                <li key={`${e.id}${ci}${si}`} className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                  <MapPin className="size-3.5" style={{ color: e.color }} />
                  {e.title} · {c.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] font-semibold text-ink-2">Found by free survey outward from your base camp.</p>
          )}
        </div>
      )}
    </div>
  )
}

function LinkChip({ place, ex, onClick }: { place: Place; ex: Exploration; onClick: () => void }) {
  const known = ex.state.discovered.has(place.id)
  return (
    <button type="button" onClick={onClick} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold transition-colors hover:bg-surface-2', known ? 'border-line-strong' : 'border-dashed border-line text-ink-2')}>
      <PlaceIcon kind={place.kind} tags={place.tags} size={16} />
      {place.name}
    </button>
  )
}

export function MasteryRow({ level, m }: { level: ReturnType<ReturnType<typeof masteryFn>>; m?: PlaceMastery }) {
  const steps = ['discovered', 'familiar', 'strong', 'mastered'] as const
  const idx = steps.indexOf(level as (typeof steps)[number])
  let hint = 'Answer one question to make it Familiar.'
  if (m) {
    if (m.level === 'familiar') hint = `For Strong: 3 correct answers (${m.correct}), 2 question types (${m.types.size}), on 2 days.`
    else if (m.level === 'strong') hint = 'For Mastered: 5 correct over a week or more, including a map or ordering question, 85% recent accuracy.'
    else if (m.level === 'mastered') hint = 'Mastered – keep it fresh with spaced reviews.'
  }
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold" style={{ color: level === 'discovered' ? undefined : MASTERY_COLOUR[level] }}>
          {MASTERY_LABEL[level]}
        </span>
        {m?.due && <span className="text-[12px] font-semibold text-ink-3">Review {m.due <= todayKey() ? 'due now' : relativeDayLabel(m.due).toLowerCase()}</span>}
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= idx ? MASTERY_COLOUR[s === 'discovered' ? 'discovered' : s] : 'var(--line)' }} />
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-2">{hint}</p>
    </div>
  )
}
