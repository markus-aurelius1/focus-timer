import { motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:opacity-90 shadow-soft',
  accent: 'bg-accent text-accent-ink hover:opacity-90 shadow-soft',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-full',
  md: 'h-10 px-4 text-sm gap-2 rounded-full',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-full',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,opacity,transform,color] duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      onClick={(e) => {
        haptics.tap()
        onClick?.(e)
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary' | 'primary' | 'accent'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', active, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  const s = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : 'size-10'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full transition-[background,color,transform] duration-150 active:scale-[0.94] disabled:opacity-40',
        s,
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'primary' && 'bg-primary text-primary-ink shadow-soft hover:opacity-90',
        variant === 'accent' && 'bg-accent text-accent-ink shadow-soft hover:opacity-90',
        active && 'bg-accent-soft text-accent',
        className,
      )}
      onClick={(e) => {
        haptics.tap()
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptics.tap()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40',
        checked ? 'border-transparent bg-accent' : 'border-line-strong bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={cn('block size-5 rounded-full shadow-sm', checked ? 'bg-accent-ink' : 'bg-surface')}
        style={{ marginLeft: checked ? 24 : 3 }}
      />
    </button>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  layoutId,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  layoutId?: string
}) {
  const auto = useId()
  const id = layoutId ?? `seg-${auto}`
  return (
    <div role="tablist" className={cn('inline-flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) haptics.tap()
              onChange(o.value)
            }}
            className={cn(
              'relative flex-1 rounded-full font-semibold whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-[13px]',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-full bg-surface shadow-soft dark:bg-surface-3"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Chip({ children, color, active, onClick, className }: { children: ReactNode; color?: string; active?: boolean; onClick?: () => void; className?: string }) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        active ? 'border-transparent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2',
        onClick && 'hover:text-ink',
        className,
      )}
    >
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </Comp>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; label: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label={label}>
      <IconButton label={`Decrease ${label}`} size="sm" onClick={() => set(value - step)} disabled={value <= min}>
        <Minus className="size-4" />
      </IconButton>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          if (!Number.isNaN(n)) set(n)
        }}
        className="tabular w-10 bg-transparent text-center text-sm font-bold outline-none"
      />
      {suffix && <span className="-ml-1 pr-1 text-xs text-ink-3">{suffix}</span>}
      <IconButton label={`Increase ${label}`} size="sm" onClick={() => set(value + step)} disabled={value >= max}>
        <Plus className="size-4" />
      </IconButton>
    </div>
  )
}

const fieldBase =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/15'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, className)} {...rest} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-20 resize-y leading-relaxed', className)} {...rest} />
})

export function Select({ className, children, compact, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <select
      className={cn(
        compact
          ? 'h-9 rounded-full border border-line bg-surface pr-8 pl-3 text-[13px] font-semibold text-ink outline-none focus:border-accent/60'
          : fieldBase,
        'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9',
        className,
      )} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")' }} {...rest}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-xs font-bold tracking-wide text-ink-2 uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function Row({ icon, title, subtitle, right, onClick, className }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string }) {
  const inner = (
    <>
      {icon && <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{subtitle}</span>}
      </span>
      {right}
    </>
  )
  const cls = cn('flex w-full items-center gap-3 px-4 py-3', onClick && 'transition-colors hover:bg-surface-2/60 active:bg-surface-2', className)
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('rounded-card border border-line bg-surface shadow-soft', className)}>{children}</As>
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-3 px-1', className)}>
      <h2 className="text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Dot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: color ?? 'var(--ink-3)' }} />
}
