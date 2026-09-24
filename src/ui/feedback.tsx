import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'
import { Button } from './controls'
import { Sheet } from './Sheet'
import { useToasts } from './toast'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lift"
            role="status"
          >
            <span className={cn('mt-0.5 shrink-0', t.tone === 'success' && 'text-success', t.tone === 'warning' && 'text-danger', t.tone === 'celebrate' && 'text-accent', t.tone === 'default' && 'text-ink-2')}>
              {t.tone === 'warning' ? <TriangleAlert className="size-5" /> : t.tone === 'celebrate' ? <Sparkles className="size-5" /> : <CheckCircle2 className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.body}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded-full px-2 py-1 text-[13px] font-bold text-accent hover:bg-accent-soft"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" className="-mr-1 shrink-0 rounded-full p-1 text-ink-3 hover:text-ink" onClick={() => dismiss(t.id)}>
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────── confirm ─────────────────────────

interface ConfirmRequest {
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }))

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }))
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req)
  const close = (ok: boolean) => {
    req?.resolve(ok)
    useConfirmStore.setState({ req: null })
  }
  return (
    <Sheet open={!!req} onClose={() => close(false)} title={req?.title} size="sm">
      {req?.body && <div className="text-[15px] leading-relaxed text-ink-2">{req.body}</div>}
      <div className="mt-5 flex gap-2">
        <Button block onClick={() => close(false)}>
          Cancel
        </Button>
        <Button block variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
          {req?.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Sheet>
  )
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">{icon}</div>}
      <p className="font-display text-lg font-medium">{title}</p>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
