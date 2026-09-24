import { Check, ChevronDown, Flag, Lock, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { startExpedition, stopExpedition } from '@/atlas/actions'
import type { ExpeditionProgress } from '@/atlas/explore'
import type { Expedition } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { Button } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { minutesText } from './util'

export function ExpeditionSheet({ ex, open, onClose, onCheckpoint, onPlace }: { ex: Exploration; open: boolean; onClose: () => void; onCheckpoint: (placeIds: string[], title: string) => void; onPlace: (id: string) => void }) {
  const activeId = ex.state.activeRun?.expeditionId ?? null
  const [expanded, setExpanded] = useState<string | null>(activeId)
  return (
    <Sheet open={open} onClose={onClose} title="Expeditions" subtitle="Focus minutes carry your active expedition from stop to stop." size="lg">
      <div className="space-y-2.5">
        {ex.atlas.expeditions.map((e) => (
          <ExpeditionRow
            key={e.id}
            ex={ex}
            e={e}
            progress={ex.state.expeditions.get(e.id)}
            active={activeId === e.id}
            expanded={expanded === e.id}
            onToggle={() => setExpanded((x) => (x === e.id ? null : e.id))}
            onCheckpoint={onCheckpoint}
            onPlace={onPlace}
          />
        ))}
        <div className="rounded-2xl border border-line p-4">
          <p className="text-[15px] font-bold">Free survey</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            With no expedition active, every {minutesText(25)} of focus uncovers the next place outward from your base camp.
            {ex.state.survey.found > 0 && ` ${ex.state.survey.found} found so far.`}
          </p>
          {activeId && (
            <Button
              size="sm"
              className="mt-3"
              icon={<Pause className="size-3.5" />}
              onClick={async () => {
                await stopExpedition()
                toast({ title: 'Free survey', body: 'Your minutes now explore outward from base camp.' })
              }}
            >
              Pause expeditions and survey
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function ExpeditionRow({
  ex,
  e,
  progress: p,
  active,
  expanded,
  onToggle,
  onCheckpoint,
  onPlace,
}: {
  ex: Exploration
  e: Expedition
  progress?: ExpeditionProgress
  active: boolean
  expanded: boolean
  onToggle: () => void
  onCheckpoint: (placeIds: string[], title: string) => void
  onPlace: (id: string) => void
}) {
  const total = e.chapters.reduce((a, c) => a + c.stops.length, 0)
  const reached = p?.reached ?? 0
  const status = p?.complete ? 'Complete' : active ? 'Active' : p && p.minutes > 0 ? 'Paused' : 'Not started'
  const start = async () => {
    haptics.success()
    await startExpedition(e.id)
    toast({ title: `${e.title} is now active`, body: 'Your next focus session moves it on.', tone: 'celebrate' })
  }
  const gate = p?.blockedBy
  const checkpointPlaces = gate ? gate.places.filter((id) => ex.state.discovered.has(id) && !ex.familiarAt.has(id)) : []
  return (
    <div className={cn('overflow-hidden rounded-2xl border transition-colors', active ? 'border-line-strong bg-surface-2/60' : 'border-line')}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={expanded}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: e.color }}>
          {p?.complete ? <Check className="size-5" /> : <Flag className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{e.title}</span>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', active ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-ink-2')}>{status}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{e.subtitle}</span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full" style={{ width: `${(reached / total) * 100}%`, background: e.color }} />
          </span>
          <span className="mt-1 block text-[12px] font-semibold text-ink-3">
            {reached} of {total} stops · {Math.round(p?.minutes ?? 0)} / {e.chapters.reduce((a, c) => a + c.stops.reduce((b, s) => b + s.minutes, 0), 0)} min
          </span>
        </span>
        <ChevronDown className={cn('size-4.5 shrink-0 text-ink-3 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          {gate && (
            <div className="mb-3 rounded-xl bg-accent-soft/60 p-3">
              <p className="text-[14px] font-bold">Checkpoint: {gate.title}</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {gate.have} of {gate.need} places Familiar. {Math.round(p!.banked)} minutes are waiting to carry you on.
              </p>
              {checkpointPlaces.length > 0 && (
                <Button size="sm" variant="primary" className="mt-2.5" onClick={() => onCheckpoint(checkpointPlaces.slice(0, 8), `Checkpoint · ${gate.title}`)}>
                  Take the checkpoint ({Math.min(8, checkpointPlaces.length)} questions)
                </Button>
              )}
            </div>
          )}
          <ol className="space-y-3">
            {e.chapters.map((c, ci) => (
              <li key={c.id}>
                <p className="text-[12px] font-bold tracking-[0.08em] text-ink-3 uppercase">
                  {ci + 1}. {c.title}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.stops.map((s) => {
                    const st = p?.stops.find((x) => x.place.id === s.place)
                    const place = ex.atlas.byId.get(s.place)
                    const next = p?.next?.stop.place.id === s.place
                    if (!place) return null
                    return (
                      <li key={s.place}>
                        <button
                          type="button"
                          onClick={() => onPlace(s.place)}
                          className={cn(
                            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold',
                            st?.reached ? 'border-transparent bg-surface-3' : next ? 'border-accent text-accent' : 'border-dashed border-line text-ink-3',
                          )}
                        >
                          {st?.reached ? <Check className="size-3" /> : !next && <Lock className="size-3" />}
                          {st?.reached || next ? place.name : '· · ·'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
          {p?.complete && (
            <div className="mt-4 rounded-xl border border-line p-3">
              <p className="text-[13px] font-bold">{e.reward.title}</p>
              <p className="mt-0.5 text-[13px] text-ink-2">{e.reward.body}</p>
            </div>
          )}
          {!active && !p?.complete && (
            <Button variant="primary" className="mt-4" icon={<Play className="size-4" />} onClick={start}>
              {p && p.minutes > 0 ? 'Resume this expedition' : 'Start this expedition'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
