import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ExternalLink, Music2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { onTimerSound } from '@/audio/follow'
import { useAudio } from '@/audio/store'
import { embedUrl, parseMediaUrl, playerCommand } from '@/audio/youtube'
import { cn } from '@/lib/cn'
import { T } from '@/ui/motion'
import { openExternal, useMusic } from './music'

/**
 * The official YouTube embed, kept visible while it plays (as YouTube's terms
 * require). Minimising pauses playback rather than hiding a playing video.
 *
 * It follows the timer like the soundscape does (pause/stop pause the video,
 * resuming focus resumes it if the timer paused it), and it never plays at the
 * same time as the soundscape: starting one pauses the other.
 */
export function MusicDock() {
  const { current, minimized, close, setMinimized } = useMusic()
  const frame = useRef<HTMLIFrameElement>(null)
  const media = current ? parseMediaUrl(current.url) : null
  const src = media ? embedUrl(media) : null
  /** Last state the player reported (1 playing, 2 paused…); null until it reports. */
  const playerState = useRef<number | null>(null)
  const pausedByTimer = useRef(false)
  const live = !!current && !!src && !minimized

  // Listen to the player's state through the IFrame API message channel.
  useEffect(() => {
    if (!live) return
    playerState.current = null
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      try {
        const msg = JSON.parse(e.data) as { event?: string; info?: { playerState?: number } | number }
        const state = msg.event === 'onStateChange' && typeof msg.info === 'number' ? msg.info : typeof msg.info === 'object' ? msg.info?.playerState : undefined
        if (typeof state !== 'number') return
        playerState.current = state
        // The video started playing: the soundscape steps aside.
        if (state === 1) {
          pausedByTimer.current = false
          if (useAudio.getState().playing) useAudio.getState().pause()
        }
      } catch {
        /* not a player message */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [live, src])

  // Follow the timer.
  useEffect(() => {
    if (!live) return
    return onTimerSound((action) => {
      if (action === 'play') {
        if (pausedByTimer.current) playerCommand(frame.current, 'playVideo')
        pausedByTimer.current = false
      } else if (playerState.current === null || playerState.current === 1 || playerState.current === 3) {
        // Pause keeps the place; stop rewinds, so the next session starts the video afresh.
        playerCommand(frame.current, action === 'stop' ? 'stopVideo' : 'pauseVideo')
        pausedByTimer.current = true
      }
    })
  }, [live])

  // The soundscape started: pause the video so only one thing plays.
  useEffect(() => {
    if (!live) return
    return useAudio.subscribe((s, prev) => {
      if (s.playing && !prev.playing && playerState.current !== 2) {
        playerCommand(frame.current, 'pauseVideo')
        pausedByTimer.current = false
      }
    })
  }, [live])

  const subscribePlayer = () => {
    // Ask the embed to report its state (the IFrame API's "listening" handshake).
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'tars-music', channel: 'widget' }), '*')
  }

  return (
    <AnimatePresence>
      {current && src && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: T.base }}
          exit={{ opacity: 0, y: 20, transition: T.exit }}
          className={cn(
            'fixed right-4 z-30 overflow-hidden rounded-2xl border border-line bg-surface shadow-dialog',
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
                onLoad={subscribePlayer}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
