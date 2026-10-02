import { Tent } from 'lucide-react'
import { useMemo, useState } from 'react'
import { chooseBaseCamp } from '@/atlas/actions'
import type { AtlasData } from '@/atlas/data'
import { suggestExpedition } from '@/atlas/explore'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { Button } from '@/ui/controls'

const ZONES: Array<{ id: string; label: string }> = [
  { id: 'north', label: 'North' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'east', label: 'East' },
  { id: 'central', label: 'Central' },
  { id: 'west', label: 'West' },
  { id: 'south', label: 'South' },
  { id: 'islands', label: 'Islands' },
]

/** Pick a home state: it starts explored, and the free survey spreads out from it. */
export function BaseCampPicker({ atlas, current, onDone, compact }: { atlas: AtlasData; current?: string | null; onDone?: () => void; compact?: boolean }) {
  const [pick, setPick] = useState<string | null>(current ?? null)
  const [busy, setBusy] = useState(false)
  const byZone = useMemo(() => ZONES.map((z) => ({ ...z, states: atlas.states.filter((s) => s.region === z.id).sort((a, b) => a.name.localeCompare(b.name)) })), [atlas])
  const suggested = pick ? suggestExpedition(atlas, pick) : null
  return (
    <div>
      <div className={cn('space-y-3', !compact && 'max-h-[46dvh] overflow-y-auto pr-1')}>
        {byZone.map((z) => (
          <div key={z.id}>
            <p className="mb-1.5 t-label text-[12px] text-ink-3">{z.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {z.states.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    haptics.tap()
                    setPick(s.id)
                  }}
                  aria-pressed={pick === s.id}
                  className={cn('rounded-full border px-3 py-1.5 text-[13.5px] font-semibold transition-colors', pick === s.id ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface hover:bg-surface-2')}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {suggested && !current && <p className="mt-3 text-[13px] text-ink-2">Your first expedition: <b>{suggested.title}</b>. You can switch any time.</p>}
      <Button
        variant="primary"
        block
        className="mt-4"
        disabled={!pick || busy}
        icon={<Tent className="size-4" />}
        onClick={async () => {
          if (!pick) return
          setBusy(true)
          await chooseBaseCamp(atlas, pick)
          haptics.success()
          setBusy(false)
          onDone?.()
        }}
      >
        {current ? 'Move base camp' : 'Set up base camp'}
      </Button>
    </div>
  )
}
