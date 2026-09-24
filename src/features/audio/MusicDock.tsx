import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ExternalLink, Music2, X } from 'lucide-react'
import { useRef } from 'react'
import { embedUrl, parseMediaUrl, playerCommand } from '@/audio/youtube'
import { cn } from '@/lib/cn'
import { openExternal, useMusic } from './music'

/**
 * The official YouTube embed, kept visible while it plays (as YouTube's terms
 * require). Minimising pauses playback rather than hiding a playing video.
 */
export function MusicDock() {
  const { current, minimized, close, setMinimized } = useMusic()
  const frame = useRef<HTMLIFrameElement>(null)
  const media = current ? parseMediaUrl(current.url) : null
  const src = media ? embedUrl(media) : null

  return (
    <AnimatePresence>
      {current && src && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            'fixed right-4 z-30 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift',
            'bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6',
            minimized ? 'w-auto' : 'left-4 sm:left-auto sm:w-[380px]',
          )}
        >
          <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
            <Music2 className="size-4 shrink-0 text-accent" />
            <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-bold" onClick={() => minimized && setMinimized(false)}>
              {current.title}
            </button>
            <button type="button" aria-label="Open in YouTube" onClick={() => openExternal(current.url)} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <ExternalLink className="size-4" />
            </button>
            {!minimized && (
              <button
                type="button"
                aria-label="Pause and minimise"
                onClick={() => {
                  playerCommand(frame.current, 'pauseVideo')
                  setMinimized(true)
                }}
                className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronDown className="size-4" />
              </button>
            )}
            <button type="button" aria-label="Close player" onClick={close} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          {/* Minimised = unloaded, so nothing ever plays out of sight. */}
          {!minimized && (
            <div className="relative aspect-video min-h-[200px] w-full">
              <iframe
                ref={frame}
                src={`${src}&autoplay=1`}
                title={current.title}
                className="absolute inset-0 size-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
