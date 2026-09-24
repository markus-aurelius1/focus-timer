import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './controls'
import { useIsWide } from './useMedia'

let locks = 0
function lockScroll() {
  locks++
  document.documentElement.style.overflow = 'hidden'
}
function unlockScroll() {
  locks = Math.max(0, locks - 1)
  if (!locks) document.documentElement.style.overflow = ''
}

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Extra element in the header, left of the close button. */
  headerAction?: ReactNode
  bodyClassName?: string
  /** Render without padding/header chrome (for custom layouts). */
  bare?: boolean
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, subtitle, children, footer, size = 'md', headerAction, bodyClassName, bare }: SheetProps) {
  const wide = useIsWide()
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  // Only a press that starts on the backdrop closes the sheet. The trailing
  // click of the tap that opened it (e.g. a place on the map) lands on the new
  // backdrop too, and must not close it again.
  const backdropPress = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    lockScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    const prevFocus = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
      ;(target ?? panelRef.current)?.focus({ preventScroll: true })
    }, 60)
    return () => {
      clearTimeout(t)
      unlockScroll()
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [open])

  const maxW = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/45 dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={() => (backdropPress.current = true)}
            onClick={() => {
              if (backdropPress.current) onClose()
              backdropPress.current = false
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-lift outline-none sm:rounded-[24px]',
              maxW,
            )}
            initial={wide ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.97, y: 4 } : { y: '100%' }}
            transition={wide ? { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } : { type: 'spring', stiffness: 420, damping: 40 }}
            drag={wide ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            {!wide && (
              <div className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1" onPointerDown={(e) => drag.start(e)}>
                <span className="h-1.5 w-10 rounded-full bg-line-strong" />
              </div>
            )}
            {!bare && (title || headerAction) && (
              <div className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-3 sm:pt-5" onPointerDown={(e) => !wide && drag.start(e)}>
                <div className="min-w-0 flex-1">
                  {title && <h2 className="font-display text-[22px] leading-tight font-medium tracking-tight">{title}</h2>}
                  {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
                </div>
                {headerAction}
                <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
                  <X className="size-4.5" />
                </IconButton>
              </div>
            )}
            <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain', !bare && 'px-5 pb-5', bodyClassName)}>{children}</div>
            {footer && <div className="pb-safe shrink-0 border-t border-line bg-surface px-5 py-3">{footer}</div>}
            {!footer && !wide && <div className="pb-safe shrink-0" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
