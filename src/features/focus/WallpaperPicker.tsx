/**
 * Choose what is behind the clock: a category, then a picture; or let it change
 * each day; or have no picture at all. A popover beside its button in the
 * window, a sheet on a phone. Thumbnails are drawn only as they scroll into
 * view, so opening the picker never renders the whole catalogue.
 */
import { Check, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Button, IconButton, Slider, SwitchRow, Tabs } from '@/ui/controls'
import { Pressable } from '@/ui/Pressable'
import { Popover } from '@/ui/surface/Popover'
import { loadScenes, useAmbience } from './ambience'
import type { Wallpaper, WallpaperCategory } from './wallpaper/scenes'

type Scenes = Awaited<ReturnType<typeof loadScenes>>

export function WallpaperPicker({ open, onClose, anchor, current }: { open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; current: string | null }) {
  const a = useAmbience()
  const [scenes, setScenes] = useState<Scenes | null>(null)
  const [category, setCategory] = useState<WallpaperCategory | null>(null)
  useEffect(() => {
    if (open && !scenes) void loadScenes().then(setScenes)
  }, [open, scenes])

  const shownCategory = category ?? scenes?.WALLPAPERS.find((w) => w.id === current)?.category ?? scenes?.WALLPAPER_CATEGORIES[0] ?? null
  const list = useMemo(() => scenes?.WALLPAPERS.filter((w) => w.category === shownCategory) ?? [], [scenes, shownCategory])

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} label="Wallpaper" side="bottom" align="end" width={420} sheet={{ title: 'Wallpaper' }} className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="t-heading max-sm:hidden">Wallpaper</p>
        <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
          <IconButton label="Previous wallpaper" size="sm" tip="top" onClick={() => void a.previous()}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <Button size="sm" icon={<Shuffle className="size-3.5" />} onClick={() => void a.random()}>
            Surprise me
          </Button>
          <IconButton label="Next wallpaper" size="sm" tip="top" onClick={() => void a.next()}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>

      {scenes && shownCategory && (
        <>
          <Tabs label="Wallpaper categories" className="mt-3" value={shownCategory} onChange={setCategory} items={scenes.WALLPAPER_CATEGORIES.map((c) => ({ id: c, label: c }))} layoutId="wallpaper-categories" />
          <div className="wall-grid mt-3" role="radiogroup" aria-label={`${shownCategory} wallpapers`}>
            {list.map((w) => (
              <Thumb key={w.id} wallpaper={w} scenes={scenes} selected={!a.plain && current === w.id} onSelect={() => a.show(w.id)} />
            ))}
          </div>
        </>
      )}
      {!scenes && <div className="skeleton mt-3 h-40" aria-hidden="true" />}

      <div className="mt-4 -mx-2 border-t border-line pt-2">
        <SwitchRow title="A new picture each day" description="Choosing one above keeps it until you turn this back on." checked={!a.plain && a.wallpaper === null} onChange={(on) => a.set(on ? { wallpaper: null, plain: false } : { wallpaper: current, plain: false })} />
        <SwitchRow title="Plain background" description="No picture: the clock on the app’s own colours." checked={a.plain} onChange={(plain) => a.set({ plain })} />
        <SwitchRow title="A line to think about" description="One short sentence under the clock." checked={a.quotes} onChange={(quotes) => a.set({ quotes })} />
        {!a.plain && (
          <div className="px-2 pt-2 pb-1">
            <p className="t-label mb-1">Dimming</p>
            <Slider label="Dimming behind the clock" value={a.dim} onChange={(dim) => a.set({ dim })} min={0.15} max={0.85} step={0.05} valueLabel={`${Math.round(a.dim * 100)}%`} />
          </div>
        )}
      </div>
    </Popover>
  )
}

function Thumb({ wallpaper, scenes, selected, onSelect }: { wallpaper: Wallpaper; scenes: Scenes; selected: boolean; onSelect: () => void }) {
  const el = useRef<HTMLButtonElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Draw the picture only when its tile is (nearly) on screen.
  useEffect(() => {
    const node = el.current
    if (!node || url) return
    if (typeof IntersectionObserver === 'undefined') {
      setUrl(scenes.wallpaperUrl(wallpaper.id))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setUrl(scenes.wallpaperUrl(wallpaper.id))
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [scenes, wallpaper.id, url])

  return (
    <Pressable ref={el as never} role="radio" aria-checked={selected} aria-label={wallpaper.name} title={wallpaper.name} press="surface" className="wall-thumb" onClick={onSelect}>
      {url && <img src={url} alt="" loading="lazy" decoding="async" draggable={false} data-loaded={loaded ? '' : undefined} onLoad={() => setLoaded(true)} />}
      {selected && (
        <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </Pressable>
  )
}
