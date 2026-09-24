/** The gazetteer – a searchable index of every place, and the accessible alternative to the map. */
import { Lock, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { MASTERY_LABEL } from '@/atlas/mastery'
import type { Place, PlaceKind, SheetId } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { cn } from '@/lib/cn'
import { Chip, Segmented, TextInput, Toggle } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { BAND_CLASS, BAND_LABEL } from './PastPapers'
import { MASTERY_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { masteryFn, PlaceIcon } from './util'

const GROUPS: Array<{ id: string; label: string; kinds: PlaceKind[] }> = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'mountains', label: 'Mountains', kinds: ['range', 'peak', 'pass', 'glacier', 'volcano'] },
  { id: 'water', label: 'Water', kinds: ['river', 'confluence', 'lake', 'wetland', 'dam', 'waterfall', 'sea', 'gulf', 'strait', 'canal'] },
  { id: 'land', label: 'Land & coast', kinds: ['plateau', 'plain', 'desert', 'valley', 'coast', 'delta', 'island', 'cape', 'grassland', 'region'] },
  { id: 'places', label: 'Cities & ports', kinds: ['capital', 'city', 'port'] },
  { id: 'parks', label: 'Parks', kinds: ['park'] },
  { id: 'heritage', label: 'Heritage', kinds: ['monument'] },
]

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function GazetteerSheet({ ex, open, onClose, onPick, sheet }: { ex: Exploration; open: boolean; onClose: () => void; onPick: (id: string) => void; sheet: SheetId }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [scope, setScope] = useState<SheetId>(sheet)
  const [onlyKnown, setOnlyKnown] = useState(false)
  // Study-priority order is offered once the gazetteer carries PYQ-based scores.
  const hasPriority = !!ex.atlas.yieldModel
  const [order, setOrder] = useState<'name' | 'priority'>('name')
  const byPriority = hasPriority && order === 'priority'
  const level = masteryFn(ex)

  const results = useMemo(() => {
    const kinds = GROUPS.find((g) => g.id === group)!.kinds
    const term = norm(q.trim())
    const list = ex.atlas.bySheet[scope].filter(
      (p) =>
        (!kinds.length || kinds.includes(p.kind)) &&
        (!onlyKnown || ex.state.discovered.has(p.id)) &&
        (!term || norm(p.name).includes(term) || p.aka?.some((a) => norm(a).includes(term)) || (p.states ?? []).some((s) => norm(ex.atlas.state(s)?.name ?? '').includes(term))),
    )
    const rank = (name: string) => (term && norm(name).startsWith(term) ? 0 : 1)
    const prio = (p: Place) => (byPriority ? (p.yield?.score ?? 0) : 0)
    return list.sort((a, b) => rank(a.name) - rank(b.name) || prio(b) - prio(a) || a.level - b.level || a.name.localeCompare(b.name))
  }, [q, group, scope, onlyKnown, ex, byPriority])

  const known = results.filter((p) => ex.state.discovered.has(p.id)).length

  return (
    <Sheet open={open} onClose={onClose} title="Gazetteer" subtitle={`${known} of ${results.length} discovered`} size="lg">
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places, rivers, parks, states…" className="pl-10" aria-label="Search the gazetteer" data-autofocus />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Segmented value={scope} onChange={setScope} options={[{ value: 'india', label: 'India' }, { value: 'world', label: 'World' }]} />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            Discovered only <Toggle checked={onlyKnown} onChange={setOnlyKnown} label="Discovered only" />
          </label>
        </div>
        {hasPriority && (
          <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            Order
            <Segmented
              size="sm"
              value={order}
              onChange={setOrder}
              options={[
                { value: 'name', label: 'A–Z' },
                { value: 'priority', label: 'Study priority' },
              ]}
            />
          </div>
        )}
        <div className="scrollbar-none -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
          {GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)} className="shrink-0">
              {g.label}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {results.slice(0, 250).map((p) => {
          const found = ex.state.discovered.has(p.id)
          const lvl = level(p.id)
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60">
                <PlaceIcon kind={p.kind} tags={p.tags} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[15px] font-semibold', !found && 'text-ink-2')}>{p.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">{placeSubtitle(p, ex.atlas, KIND_NAME[p.kind])}</span>
                </span>
                {byPriority && p.yield && (
                  <span className={cn('tabular shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold', BAND_CLASS[p.yield.band])} title={BAND_LABEL[p.yield.band]}>
                    {p.yield.score}
                  </span>
                )}
                {found ? (
                  <span className="shrink-0 text-[12px] font-bold" style={{ color: lvl === 'discovered' ? 'var(--ink-3)' : MASTERY_COLOUR[lvl] }}>
                    {MASTERY_LABEL[lvl]}
                  </span>
                ) : (
                  <Lock className="size-4 shrink-0 text-ink-3" aria-label="Not yet discovered" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {results.length > 250 && <p className="py-3 text-center text-[13px] text-ink-3">Showing 250 of {results.length} – refine your search.</p>}
      {!results.length && <p className="py-10 text-center text-[14px] text-ink-2">No places match.</p>}
    </Sheet>
  )
}
