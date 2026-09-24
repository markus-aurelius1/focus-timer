import { cn } from '@/lib/cn'

/** The Lodestar mark: a four-point guiding star with a smaller cross of light behind it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden="true">
      <path d="M16 1.5 L18.2 13.8 L30.5 16 L18.2 18.2 L16 30.5 L13.8 18.2 L1.5 16 L13.8 13.8 Z" fill="currentColor" />
      <path d="M16 7 L17 15 L25 16 L17 17 L16 25 L15 17 L7 16 L15 15 Z" transform="rotate(45 16 16)" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-5 text-accent" />
      <span className="font-display text-[19px] font-medium tracking-tight">Lodestar</span>
    </span>
  )
}
