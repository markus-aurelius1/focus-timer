import { cn } from '@/lib/cn'

/** Digits in fixed-width slots so nothing shifts as time changes. */
export function TimeDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('type-numeric', className)} aria-hidden="true">
      {text.split('').map((ch, i) =>
        ch === ':' ? (
          <span key={i} className="inline-block w-[0.3em] -translate-y-[0.06em] text-center opacity-60">
            :
          </span>
        ) : (
          <span key={i} className="inline-block w-[0.62em] text-center">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
