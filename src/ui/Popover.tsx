import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { T } from './motion'
import { isTopLayer, pushLayer } from './Sheet'

interface Placement {
  left: number
  top?: number
  bottom?: number
  width: number
  maxHeight: number
}

/**
 * A panel anchored to a trigger, rendered in a portal so a dialog's scrolling
 * body can never clip it. Opens below the trigger, or above when there is more
 * room there; closes on Escape or a press outside.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  minWidth = 260,
  className,
  label,
}: {
  open: boolean
  onClose: () => void
  anchor: RefObject<HTMLElement | null>
  children: ReactNode
  minWidth?: number
  className?: string
  label?: string
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Placement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(vw - 16, Math.max(minWidth, a.width))
      const left = Math.max(8, Math.min(a.left, vw - width - 8))
      const below = vh - a.bottom - 12
      const above = a.top - 12
      if (below >= 240 || below >= above) setPlace({ left, top: a.bottom + 6, width, maxHeight: Math.max(160, Math.min(380, below)) })
      else setPlace({ left, bottom: vh - a.top + 6, width, maxHeight: Math.max(160, Math.min(380, above)) })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, anchor, minWidth])

  useEffect(() => {
    if (!open) return
    const pop = pushLayer(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopLayer(id)) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return
      onCloseRef.current()
    }
    // Capture phase, so the sheet underneath never sees this Escape.
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      pop()
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, id, anchor])

  return createPortal(
    <AnimatePresence>
      {open && place && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-label={label}
          initial={{ opacity: 0, y: place.top !== undefined ? -4 : 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: T.micro }}
          exit={{ opacity: 0, transition: T.exit }}
          className={cn('scrollbar-thin fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-dialog', className)}
          style={{ left: place.left, top: place.top, bottom: place.bottom, width: place.width, maxHeight: place.maxHeight, transformOrigin: place.top !== undefined ? 'top left' : 'bottom left' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
