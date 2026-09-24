import { Check } from 'lucide-react'
import { PALETTE } from '@/data/seed'
import { cn } from '@/lib/cn'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {PALETTE.map((c) => {
        const active = c.value.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            className={cn('flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform active:scale-90', active && 'ring-2 ring-ink/40')}
            style={{ background: c.value }}
          >
            {active && <Check className="size-4 text-white drop-shadow" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
