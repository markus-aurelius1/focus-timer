/**
 * The picture behind the clock, and the line of words beneath it.
 *
 * The wallpaper is drawn by code (wallpaper/scenes.ts) and shown as an image:
 * the browser rasterises it once, off the main thread, and from then on it is a
 * single compositor layer. Changing it cross-fades two such layers. Until the
 * scenes chunk has loaded (first visit only) the stage is simply dark.
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useDay } from '@/lib/useDay'
import { loadQuotes, loadScenes, pickOfTheDay, useAmbience } from './ambience'

/** The id on screen: the chosen wallpaper, or today's; null while the catalogue loads or when the stage is plain. */
export function useWallpaperId(): string | null {
  const chosen = useAmbience((s) => s.wallpaper)
  const plain = useAmbience((s) => s.plain)
  const day = useDay()
  const [ids, setIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (plain) return
    let alive = true
    void loadScenes().then((m) => alive && setIds(m.WALLPAPERS.map((w) => w.id)))
    return () => {
      alive = false
    }
  }, [plain])
  if (plain || !ids) return null
  return chosen && ids.includes(chosen) ? chosen : ids[pickOfTheDay(ids.length, day, 'wallpaper')]
}

export function Backdrop({ id }: { id: string | null }) {
  const dim = useAmbience((s) => s.dim)
  /** Two layers: the one showing and the one coming in. */
  const [layers, setLayers] = useState<Array<{ id: string; url: string }>>([])
  const latest = useRef<string | null>(null)

  useEffect(() => {
    latest.current = id
    if (!id) {
      setLayers([])
      return
    }
    let alive = true
    void loadScenes().then(async (m) => {
      const url = m.wallpaperUrl(id)
      // Decode before showing, so the cross-fade starts with the picture ready.
      const img = new Image()
      img.src = url
      await img.decode().catch(() => {})
      if (!alive || latest.current !== id) return
      setLayers((cur) => [...cur.filter((l) => l.id !== id).slice(-1), { id, url }])
    })
    return () => {
      alive = false
    }
  }, [id])

  // Once the new layer has faded in, drop the old one.
  useEffect(() => {
    if (layers.length < 2) return
    const t = setTimeout(() => setLayers((cur) => cur.slice(-1)), 700)
    return () => clearTimeout(t)
  }, [layers])

  if (!id && !layers.length) return null
  return (
    <div className="focus-backdrop" aria-hidden="true" style={{ '--dim': dim } as React.CSSProperties}>
      {layers.map((l, i) => (
        <FadeIn key={l.id} url={l.url} drift={i === layers.length - 1} />
      ))}
      <div className="focus-scrim" />
    </div>
  )
}

function FadeIn({ url, drift }: { url: string; drift: boolean }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return <img src={url} alt="" draggable={false} data-shown={shown ? '' : undefined} className={cn(drift && 'ambience-drift')} />
}

/** Today's line, or the next one if it has been asked for. Null until the quotes chunk has loaded. */
export function useQuote(): string | null {
  const on = useAmbience((s) => s.quotes)
  const step = useAmbience((s) => s.quoteStep)
  const day = useDay()
  const [quotes, setQuotes] = useState<readonly string[] | null>(null)
  useEffect(() => {
    if (!on) return
    let alive = true
    void loadQuotes().then((q) => alive && setQuotes(q))
    return () => {
      alive = false
    }
  }, [on])
  if (!on || !quotes?.length) return null
  // A different line each day; "another" walks on from there by a stride that visits every line.
  return quotes[(pickOfTheDay(quotes.length, day, 'quote') + step * 97) % quotes.length]
}
