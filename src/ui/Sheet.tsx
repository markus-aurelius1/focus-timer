import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { createContext, useContext, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './controls'
import { DUR, EASE_IN, EASE_OUT, T } from './motion'
import { lockScroll } from './scrollLock'
import { useIsWide } from './useMedia'

/** Open dialogs, innermost last: only the top one answers Escape and traps Tab. */
const stack: string[] = []

/** Register a modal layer (sheets, the command palette). Returns its removal. */
export function pushLayer(id: string): () => void {
  stack.push(id)
  return () => {
    const i = stack.lastIndexOf(id)
    if (i >= 0) stack.splice(i, 1)
  }
}
export const isTopLayer = (id: string) => stack[stack.length - 1] === id
export const anyLayerOpen = () => stack.length > 0

/** The footer element of the enclosing sheet, for <SheetFooter> rendered deep in its content. */
const FooterSlot = createContext<HTMLElement | null>(null)

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Actions pinned below the scrolling body (always visible). Use <SheetActions> for button rows. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Extra element in the header, left of the close button. */
  headerAction?: ReactNode
  /** Replaces the standard title row (the sheet still handles dragging, focus and Escape). */
  header?: ReactNode
  bodyClassName?: string
  /** Render without padding/header chrome (for custom layouts). */
  bare?: boolean
  /** Accessible name when the title isn't plain text (or there is none). */
  label?: string
}

/**
 * Bottom sheet on phones, centred dialog on larger screens.
 *
 * Layout: a flex column capped to the viewport – header and footer never scroll,
 * the body scrolls only when its content is genuinely taller than the space left,
 * and nothing inside may scroll sideways.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, size = 'md', headerAction, header, bodyClassName, bare, label }: SheetProps) {
  const wide = useIsWide()
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const id = useId()
  const titleId = `${id}-title`
  const subtitleId = `${id}-subtitle`
  // Only a press that starts on the backdrop closes the sheet. The trailing
  // click of the tap that opened it (e.g. a place on the map) lands on the new
  // backdrop too, and must not close it again.
  const backdropPress = useRef(false)
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const unlock = lockScroll()
    const pop = pushLayer(id)
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(id)) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab') trapTab(e, panelRef.current)
    }
    window.addEventListener('keydown', onKey)
    const prevFocus = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
      ;(target ?? panelRef.current)?.focus({ preventScroll: true })
    }, 60)
    return () => {
      clearTimeout(t)
      unlock()
      pop()
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [open, id])

  const maxW = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
  const plainTitle = typeof title === 'string' ? title : undefined
  const startDrag = (e: ReactPointerEvent) => {
    if (!wide) drag.start(e)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/45 dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DUR.base, ease: EASE_IN } }}
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
            aria-labelledby={!bare && !header && title ? titleId : undefined}
            aria-label={label ?? (bare || header ? plainTitle : undefined)}
            aria-describedby={!bare && !header && subtitle ? subtitleId : undefined}
            tabIndex={-1}
            className={cn(
              'relative flex w-full min-w-0 flex-col overflow-hidden border border-line bg-surface shadow-dialog outline-none',
              'max-h-[calc(100dvh-max(20px,env(safe-area-inset-top)))] rounded-t-[28px]',
              'sm:max-h-[min(88dvh,900px)] sm:rounded-[24px]',
              maxW,
            )}
            initial={wide ? { opacity: 0, scale: 0.97, y: 10 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0, transition: T.base } : { y: 0, transition: T.sheet }}
            exit={wide ? { opacity: 0, scale: 0.98, y: 6, transition: T.exit } : { y: '100%', transition: { duration: DUR.base, ease: EASE_IN } }}
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
              <div className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1" onPointerDown={startDrag} aria-hidden="true">
                <span className="h-1.5 w-10 rounded-full bg-line-strong" />
              </div>
            )}
            {header ? (
              <div className="shrink-0" onPointerDown={startDrag}>
                {header}
              </div>
            ) : (
              !bare &&
              (title || headerAction) && (
                <div className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-3 sm:px-6 sm:pt-5" onPointerDown={startDrag}>
                  <div className="min-w-0 flex-1">
                    {title && (
                      <h2 id={titleId} className="font-display text-[22px] leading-tight font-medium tracking-tight text-balance">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p id={subtitleId} className="mt-1 text-sm leading-snug text-ink-2">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {headerAction}
                  <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
                    <X className="size-4.5" />
                  </IconButton>
                </div>
              )
            )}
            <div data-sheet-body className={cn('scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain', !bare && 'sheet-pad px-5 sm:px-6', bodyClassName)}>
              <FooterSlot.Provider value={footerEl}>{children}</FooterSlot.Provider>
            </div>
            <div ref={setFooterEl} data-sheet-footer className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] empty:hidden sm:px-6 sm:pb-4">
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Render actions into the enclosing sheet's pinned footer from anywhere inside it. */
export function SheetFooter({ children }: { children: ReactNode }) {
  const el = useContext(FooterSlot)
  return el ? createPortal(children, el) : null
}

/**
 * The standard action row for a sheet footer: optional secondary actions at the
 * start, the main actions at the end. Wraps onto a second line on narrow
 * screens rather than ever needing to scroll sideways.
 */
export function SheetActions({ start, children, stack: stacked }: { start?: ReactNode; children: ReactNode; stack?: boolean }) {
  if (stacked) return <div className="flex flex-col gap-2">{children}</div>
  return (
    <div className="flex flex-wrap items-center gap-2">
      {start && <div className="flex shrink-0 items-center gap-1">{start}</div>}
      <div className="flex min-w-[min(100%,15rem)] flex-1 flex-wrap items-center justify-end gap-2 *:min-w-0 *:flex-1 sm:*:flex-none">{children}</div>
    </div>
  )
}

export function trapTab(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
  if (!items.length) {
    e.preventDefault()
    panel.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (!panel.contains(active)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}
