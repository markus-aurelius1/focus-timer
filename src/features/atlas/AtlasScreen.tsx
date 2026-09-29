/**
 * The Atlas: a real atlas map that fills in as you study. Focus time moves your
 * expedition and uncovers places; recall makes them Familiar, Strong and
 * Mastered; mastered regions develop. Every place in the gazetteer is on the
 * map – the ones not yet discovered are drawn quietly until you reach them.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, ChevronUp, Crosshair, Flag, GraduationCap, Info, Layers, Lock, Maximize2, Minimize2, Minus, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { consumeParams, useRoute } from '@/app/router'
import { isTyping } from '@/app/shortcuts'
import { useUi } from '@/app/ui-store'
import { useSheet, type Sheet as MapSheet } from '@/atlas/sheet'
import { livingWorld } from '@/atlas/living'
import type { Place, SheetId } from '@/atlas/types'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { updateSettings, useSettings } from '@/data/hooks'
import { DEFAULT_SETTINGS } from '@/data/seed'
import type { AtlasLayers } from '@/data/types'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/lib/device'
import { KEYS, migrateLegacyKeys } from '@/lib/storage'
import { enterFullscreen, exitFullscreen, isFullscreen, onFullscreenExit } from '@/services/fullscreen'
import { haptics } from '@/services/haptics'
import { useTimer } from '@/timer/store'
import { Button, Chip, IconButton, Segmented, Toggle } from '@/ui/controls'
import { anyLayerOpen, Sheet } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { AtlasMap, type AtlasMapHandle, type Highlight, type MapTarget, type RouteOverlay } from './AtlasMap'
import { AtlasPanel, expeditionStatus, ExplorerCard } from './AtlasPanel'
import { BaseCampPicker } from './BaseCamp'
import { ExpeditionSheet } from './ExpeditionSheet'
import { FieldReviewSheet, type ReviewRequest } from './FieldReview'
import { GazetteerSheet } from './Gazetteer'
import { kindsFor, PLACE_GROUPS } from './groups'
import { LegendSheet } from './Legend'
import { PlaceDetails } from './PlaceDetails'
import { UnitDetails } from './UnitDetails'
import { masteryFn, viewFor } from './util'

type Selection = { type: 'place'; id: string } | { type: 'state'; id: string } | { type: 'country'; id: string }
type Panel = 'expeditions' | 'gazetteer' | 'legend' | 'basecamp' | 'more' | null

const VISIT_KEY = KEYS.atlasVisit
const readVisit = () => {
  migrateLegacyKeys()
  try {
    return Number(localStorage.getItem(VISIT_KEY)) || 0
  } catch {
    return 0
  }
}
const writeVisit = (t: number) => {
  try {
    localStorage.setItem(VISIT_KEY, String(t))
  } catch {
    /* storage unavailable */
  }
}

/** How close to fly in for a place: big features stay wide, points come close. */
const WIDE = new Set(['sea', 'gulf', 'desert', 'plateau', 'plain', 'region', 'range', 'coast', 'grassland'])
const zoomFor = (p: Place) => (WIDE.has(p.kind) ? 1.4 : p.kind === 'river' || p.kind === 'canal' || p.kind === 'strait' || p.kind === 'delta' ? 1.8 : p.shape === 'area' ? 2.6 : 3)

export default function AtlasScreen() {
  const ex = useExploration()
  if (!ex) return <MapLoading />
  return <Atlas ex={ex} />
}

/** The Atlas fills the viewport minus the phone tab bar – or all of it in full screen. */
const MAP_HEIGHT = 'h-[calc(100dvh-64px-env(safe-area-inset-bottom))] lg:h-dvh'

function MapLoading({ error }: { error?: boolean }) {
  const full = useUi((s) => s.atlasFullscreen)
  return (
    <div className={cn('flex items-center justify-center bg-[#c6e1f2]', full ? 'h-dvh' : MAP_HEIGHT)}>
      <p className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#1f3a64] shadow-soft">{error ? 'The bundled map couldn’t load. Reload Atlas and try again.' : 'Unrolling the map…'}</p>
    </div>
  )
}

function Atlas({ ex }: { ex: Exploration }) {
  const settings = useSettings()
  const desktop = useIsDesktop()
  const route = useRoute()
  const [sheetId, setSheetId] = useState<SheetId>(() => (route.params.get('sheet') === 'world' ? 'world' : 'india'))
  const { sheet: loaded, error } = useSheet(sheetId)
  // Keep showing the previous sheet until the next one is ready, then cross-fade.
  const [sheet, setSheet] = useState<MapSheet | null>(loaded)
  useEffect(() => {
    if (loaded) setSheet(loaded)
  }, [loaded])
  const map = useRef<AtlasMapHandle | null>(null)
  const setMap = useCallback((h: AtlasMapHandle | null) => {
    if (h) map.current = h
  }, [])
  const [sel, setSel] = useState<Selection | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const [lastVisit] = useState(readVisit)
  const pendingFly = useRef<Place | null>(null)
  const pendingInsets = useRef<{ bottom: number } | undefined>(undefined)
  const timerActive = useTimer((s) => s.timer.status !== 'idle')
  const layers: AtlasLayers = settings.atlasLayers ?? DEFAULT_SETTINGS.atlasLayers!
  const full = useAtlasFullscreen()
  // The floating timer pill sits above the HUD on phones – but not in full screen.
  const pillShown = timerActive && !full.on

  useEffect(() => () => writeVisit(Date.now()), [])
  // First visit without a base camp: ask for one (once settings have loaded).
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || settings.updatedAt === 0) return
    asked.current = true
    if (!settings.baseCamp) setPanel('basecamp')
  }, [settings.updatedAt, settings.baseCamp])

  const view = viewFor(settings.atlasStyle, ex.level.rankIndex)
  const mastery = useMemo(() => masteryFn(ex), [ex])
  const shownId: SheetId = sheet?.id ?? sheetId

  const places = ex.atlas.bySheet[shownId]
  const discovered = ex.state.discovered
  const newIds = useMemo(() => {
    if (!lastVisit) return new Set<string>()
    const fresh = places.filter((p) => (discovered.get(p.id)?.at ?? 0) > lastVisit)
    fresh.sort((a, b) => (discovered.get(b.id)?.at ?? 0) - (discovered.get(a.id)?.at ?? 0))
    return new Set(fresh.slice(0, 12).map((p) => p.id))
  }, [places, discovered, lastVisit])
  const { muted, linked, features } = useMemo(() => {
    const muted = new Set<string>()
    const linked = new Map<string, string>()
    const features = new Map<string, string>()
    for (const p of places) {
      if (!p.geom) continue
      if (discovered.has(p.id)) {
        linked.set(p.geom, p.id)
        features.set(p.geom, p.id)
      } else {
        muted.add(p.geom)
        if (!features.has(p.geom)) features.set(p.geom, p.id)
      }
    }
    return { muted, linked, features }
  }, [places, discovered])
  const explored = useMemo(() => (shownId === 'world' ? new Set([...ex.state.explored].map((u) => u.toLowerCase())) : ex.state.explored), [ex, shownId])
  const kinds = useMemo(() => kindsFor(layers.groups), [layers.groups])

  const routeOverlay = useMemo<RouteOverlay | null>(() => {
    const a = ex.state.active
    if (!a || a.complete || a.expedition.sheet !== shownId) return null
    // The current chapter only: the way travelled, and the leg ahead.
    const chapter = a.next?.stop.chapter ?? a.stops[a.stops.length - 1]?.chapter ?? 0
    const shown = a.stops.filter((s) => s.chapter === chapter && (s.reached || s === a.next?.stop))
    if (!shown.length) return null
    return { points: shown.map((s) => ({ id: s.place.id, x: s.place.x, y: s.place.y, state: s.reached ? 'reached' : 'next' })) }
  }, [ex, shownId])
  const previousExpedition = useRef(ex.state.active?.expedition.id)
  useEffect(() => {
    const active = ex.state.active?.expedition
    if (previousExpedition.current === active?.id) return
    previousExpedition.current = active?.id
    if (active) setSheetId(active.sheet)
  }, [ex.state.active])

  const living = useMemo(() => livingWorld(ex, shownId), [ex, shownId])
  const selectedPlace = sel?.type === 'place' ? ex.atlas.byId.get(sel.id) : undefined
  const highlights = useMemo<Highlight[]>(() => {
    if (!sel) return []
    if (sel.type === 'state' || sel.type === 'country') return [{ kind: sel.type, id: sel.id }]
    const p = ex.atlas.byId.get(sel.id)
    if (!p?.geom || p.sheet !== shownId) return []
    const [layer, id] = p.geom.split(':')
    return [{ kind: layer as Highlight['kind'], id }]
  }, [sel, ex, shownId])

  /** Fly to a place (switching sheet first if needed), centred above whatever covers the map. */
  const flyToPlace = useCallback(
    (p: Place, opts: { sheetOpen?: boolean } = {}) => {
      const insets = !desktop && opts.sheetOpen ? { bottom: Math.round(window.innerHeight * 0.55) } : undefined
      if (p.sheet !== shownId || !sheet) {
        pendingFly.current = p
        setSheetId(p.sheet)
        pendingInsets.current = insets
        return
      }
      map.current?.flyTo(p.x, p.y, zoomFor(p), insets)
    },
    [shownId, sheet, desktop],
  )
  useEffect(() => {
    if (!sheet || !pendingFly.current || pendingFly.current.sheet !== shownId) return
    const p = pendingFly.current
    pendingFly.current = null
    // Let the new sheet fit and paint first, then travel from the overview.
    const id = setTimeout(() => {
      map.current?.flyTo(p.x, p.y, zoomFor(p), pendingInsets.current)
    }, prefersReducedMotion() ? 0 : 280)
    return () => clearTimeout(id)
  }, [sheet, shownId])

  const select = useCallback(
    (t: MapTarget) => {
      if (t.type === 'point' || t.type === 'pin') return setSel(null)
      haptics.tap()
      if (t.type === 'place') {
        const p = ex.atlas.byId.get(t.id)
        if (p && p.sheet !== shownId) flyToPlace(p, { sheetOpen: true })
      }
      if (t.type === 'country' && shownId === 'india' && t.id === 'ind') return
      setSel(t)
    },
    [ex, shownId, flyToPlace],
  )

  /** From a card (a related place, a place listed in a state): select it and bring it into view. */
  const selectAndShow = useCallback(
    (t: MapTarget) => {
      select(t)
      const p = t.type === 'place' ? ex.atlas.byId.get(t.id) : undefined
      if (p) flyToPlace(p, { sheetOpen: true })
    },
    [select, ex, shownId, flyToPlace],
  )

  // Deep links: #/atlas?place=…, ?review=1, ?expeditions=1
  useEffect(() => {
    const id = route.params.get('place')
    if (id && ex.atlas.byId.get(id)) {
      const p = ex.atlas.byId.get(id)!
      setSel({ type: 'place', id })
      flyToPlace(p, { sheetOpen: true })
    }
    if (route.params.get('review') && ex.due.length) setReview({ placeIds: ex.due.slice(0, 8).map((d) => d.id), source: 'review' })
    if (route.params.get('expeditions')) setPanel('expeditions')
    consumeParams('place', 'review', 'expeditions', 'sheet')
  }, [route.raw]) // eslint-disable-line react-hooks/exhaustive-deps

  const startReview = () => {
    const ids = ex.due.slice(0, 8).map((d) => d.id)
    if (ids.length) setReview({ placeIds: ids, source: 'review' })
  }
  const actions = {
    openExpeditions: () => setPanel('expeditions'),
    startReview,
    pickState: (id: string) => {
      setPanel(null)
      if (sheetId !== 'india') setSheetId('india')
      setSel({ type: 'state', id })
    },
    openBaseCamp: () => setPanel('basecamp'),
  }

  const details = sel ? (
    sel.type === 'place' && selectedPlace ? (
      <PlaceDetails
        ex={ex}
        place={selectedPlace}
        onSelect={selectAndShow}
        onTest={(id) => setReview({ placeIds: [id], source: 'card', title: 'Test me' })}
        onShow={(p) => {
          if (!desktop) setSel(null)
          flyToPlace(p)
        }}
      />
    ) : sel.type !== 'place' ? (
      <UnitDetails ex={ex} unit={sel} onSelect={selectAndShow} />
    ) : null
  ) : null

  const status = expeditionStatus(ex)
  const setLayers = (patch: Partial<AtlasLayers>) => void updateSettings({ atlasLayers: { ...layers, ...patch } })

  return (
    <div className={cn('flex', full.on ? 'h-dvh' : MAP_HEIGHT)}>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {sheet ? (
          <AnimatePresence initial={false}>
            <motion.div key={sheet.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion() ? 0 : 0.26, ease: 'easeOut' }}>
              <AtlasMap
                ref={setMap}
                sheet={sheet}
                plate={view.plate}
                tone={view.tone}
                explored={explored}
                places={places}
                discovered={discovered}
                showUndiscovered={layers.undiscovered}
                kinds={kinds}
                showAreas={layers.areas}
                featurePlaces={features}
                mastery={mastery}
                newIds={newIds}
                selectedId={sel?.type === 'place' ? sel.id : undefined}
                highlights={highlights}
                route={routeOverlay}
                mutedLabels={muted}
                linkedLabels={linked}
                living={living}
                onSelect={select}
                insets={desktop ? { top: 56, bottom: 0 } : { top: 56, bottom: pillShown ? 210 : 160 }}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <MapLoading error={!!error} />
        )}

        {/* Top controls */}
        <div data-map-ui className="pt-safe pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:flex-nowrap">
          <div className="pointer-events-auto flex items-center gap-2">
            <Segmented
              value={sheetId}
              onChange={(v) => {
                setSel(null)
                setSheetId(v)
              }}
              options={[
                { value: 'india', label: 'India' },
                { value: 'world', label: 'World' },
              ]}
              className="border border-line bg-surface shadow-soft"
            />
          </div>
          <div className="pointer-events-auto ml-auto flex gap-1.5">
            <MapButton label="Search places" onClick={() => setPanel('gazetteer')}>
              <Search className="size-[18px]" />
            </MapButton>
            <LayersMenu current={view.style} rankIndex={ex.level.rankIndex} layers={layers} onLayers={setLayers} />
            <MapButton label="Legend" onClick={() => setPanel('legend')}>
              <Info className="size-[18px]" />
            </MapButton>
            <MapButton label="Fit the map" onClick={() => map.current?.fitFocus()}>
              <Crosshair className="size-[18px]" />
            </MapButton>
            <MapButton label={full.on ? 'Exit full screen (Esc)' : 'Full-screen map (Shift+F)'} onClick={full.toggle} pressed={full.on}>
              {full.on ? <Minimize2 className="size-[18px]" /> : <Maximize2 className="size-[18px]" />}
            </MapButton>
          </div>
        </div>

        {(
          <div data-map-ui className={cn('absolute flex flex-col gap-1.5', desktop ? 'right-3 bottom-3' : 'top-[110px] left-3')}>
            <MapButton label="Zoom in" onClick={() => map.current?.zoomBy(1.6)}>
              <Plus className="size-[18px]" />
            </MapButton>
            <MapButton label="Zoom out" onClick={() => map.current?.zoomBy(1 / 1.6)}>
              <Minus className="size-[18px]" />
            </MapButton>
          </div>
        )}

        {/* Mobile HUD */}
        {!desktop && (
          <div data-map-ui className={cn('absolute inset-x-3 transition-[bottom] duration-300', pillShown ? 'bottom-[64px]' : 'bottom-3', full.on && 'pb-[env(safe-area-inset-bottom)]')}>
            <div className="rounded-[22px] border border-line bg-surface p-3.5 shadow-soft">
              <ExplorerCard ex={ex} compact />
              {status && (
                <button type="button" onClick={() => setPanel('expeditions')} className="mt-2.5 flex w-full items-center gap-2 text-left">
                  <Flag className="size-4 shrink-0" style={{ color: status.color }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    <b>{status.title}</b> <span className={cn(status.blocked ? 'font-semibold text-accent' : 'text-ink-2')}>· {status.line}</span>
                  </span>
                </button>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant={ex.due.length ? 'primary' : 'secondary'} className="flex-1" icon={<GraduationCap className="size-3.5" />} onClick={startReview} disabled={!ex.due.length}>
                  Review{ex.due.length ? ` · ${Math.min(ex.due.length, 99)}` : ''}
                </Button>
                <Button size="sm" className="flex-1" icon={<Flag className="size-3.5" />} onClick={() => setPanel('expeditions')}>
                  Expeditions
                </Button>
                <IconButton label="More" size="sm" variant="secondary" onClick={() => setPanel('more')}>
                  <ChevronUp className="size-4" />
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {desktop && (
        <aside className="scrollbar-thin w-[380px] shrink-0 overflow-y-auto border-l border-line bg-surface/60 p-4">
          <AnimatePresence mode="wait" initial={false}>
            {details ? (
              <motion.div key={sel?.type === 'place' ? sel.id : `${sel?.type}:${sel?.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <button type="button" onClick={() => setSel(null)} className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-ink-2 hover:text-ink">
                  <ArrowLeft className="size-4" /> Atlas
                </button>
                <div className="rounded-card border border-line bg-surface p-4 shadow-soft">{details}</div>
              </motion.div>
            ) : (
              <motion.div key="panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <h1 className="mb-3 px-1 font-display text-[28px] leading-tight font-medium tracking-tight">Atlas</h1>
                <AtlasPanel ex={ex} actions={actions} />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      )}

      {!desktop && (
        <Sheet open={!!details} onClose={() => setSel(null)} size="md">
          {details}
        </Sheet>
      )}
      {!desktop && (
        <Sheet open={panel === 'more'} onClose={() => setPanel(null)} title="Atlas" size="md">
          <AtlasPanel ex={ex} actions={actions} />
        </Sheet>
      )}
      <ExpeditionSheet
        ex={ex}
        open={panel === 'expeditions'}
        onClose={() => setPanel(null)}
        onCheckpoint={(ids, title) => {
          setPanel(null)
          setReview({ placeIds: ids, source: 'checkpoint', title })
        }}
        onPlace={(id) => {
          setPanel(null)
          selectAndShow({ type: 'place', id })
        }}
      />
      <GazetteerSheet
        ex={ex}
        sheet={sheetId}
        open={panel === 'gazetteer'}
        onClose={() => setPanel(null)}
        onPick={(id) => {
          setPanel(null)
          const p = ex.atlas.byId.get(id)
          setSel({ type: 'place', id })
          if (p) flyToPlace(p, { sheetOpen: true })
        }}
      />
      <LegendSheet open={panel === 'legend'} onClose={() => setPanel(null)} />
      <Sheet open={panel === 'basecamp'} onClose={() => setPanel(null)} title={settings.baseCamp ? 'Move base camp' : 'Choose your base camp'} subtitle="Your home state starts explored, and free survey spreads outward from it." size="md">
        <BaseCampPicker atlas={ex.atlas} current={settings.baseCamp} onDone={() => setPanel(null)} />
      </Sheet>
      <FieldReviewSheet request={review} onClose={() => setReview(null)} />
    </div>
  )
}

function MapButton({ label, onClick, children, active, pressed }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={active}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('press flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-soft hover:border-line-strong', (active || pressed) && 'border-accent text-accent')}
    >
      {children}
    </button>
  )
}

/**
 * Full-screen map: the app's chrome slides away (ShellSync sets data-chrome on
 * <html>) and, where the Fullscreen API exists, the browser goes full screen too.
 * Escape, the browser's own exit and leaving the Atlas all come back out; on
 * phones without the API (iPhone) it still fills the window.
 */
function useAtlasFullscreen() {
  const on = useUi((s) => s.atlasFullscreen)
  const toggle = useCallback(() => {
    haptics.tap()
    const ui = useUi.getState()
    if (ui.atlasFullscreen) {
      ui.set({ atlasFullscreen: false })
      void exitFullscreen()
    } else {
      ui.set({ atlasFullscreen: true })
      void enterFullscreen()
    }
  }, [])

  useEffect(() => {
    // The browser left full screen (Escape, F11, its own control): follow it.
    const off = onFullscreenExit(() => useUi.getState().set({ atlasFullscreen: false }))
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || anyLayerOpen()) return
      if (e.key === 'F' && e.shiftKey) {
        e.preventDefault()
        toggle()
      } else if (e.key === 'Escape' && useUi.getState().atlasFullscreen && !isFullscreen()) {
        // No browser full screen to leave (unsupported/denied): Escape exits our own.
        useUi.getState().set({ atlasFullscreen: false })
      }
    }
    const onCommand = () => toggle()
    window.addEventListener('keydown', onKey)
    window.addEventListener('tars:atlas-fullscreen', onCommand)
    return () => {
      off()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('tars:atlas-fullscreen', onCommand)
      // Leaving the Atlas always restores the app.
      if (useUi.getState().atlasFullscreen) {
        useUi.getState().set({ atlasFullscreen: false })
        void exitFullscreen()
      }
    }
  }, [toggle])

  return { on, toggle }
}

/** Map style, what to show, and which kinds of place – one menu. */
function LayersMenu({ current, rankIndex, layers, onLayers }: {
  current: string; rankIndex: number; layers: AtlasLayers; onLayers: (patch: Partial<AtlasLayers>) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const toggleGroup = (id: string) => onLayers({ groups: layers.groups.includes(id) ? layers.groups.filter((g) => g !== id) : [...layers.groups, id] })
  return (
    <div className="relative" ref={box}>
      <MapButton label="Map layers" onClick={() => setOpen((o) => !o)} active={open}>
        <Layers className="size-[18px]" />
      </MapButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Map layers"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="scrollbar-thin absolute top-full right-0 z-40 mt-1.5 max-h-[min(70dvh,560px)] w-[min(18.5rem,calc(100vw-1.5rem))] origin-top-right overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
          >
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">Study map style</p>
            {MAP_STYLES.map((s) => {
              const locked = s.minRank > rankIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current === s.id}
                  disabled={locked}
                  onClick={() => void updateSettings({ atlasStyle: s.id })}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.name}</span>
                    <span className="block text-[12px] text-ink-2">{locked ? `Unlocks at ${RANKS[s.minRank].title}` : s.description}</span>
                  </span>
                  {locked ? <Lock className="size-4 text-ink-3" /> : current === s.id && <Check className="size-4 text-accent" />}
                </button>
              )
            })}
            <div className="my-1.5 border-t border-line" />
            <p className="px-3 pt-1 pb-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">Show</p>
            <label className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Places not yet discovered</span>
                <span className="block text-[12px] text-ink-2">Drawn faintly until you reach them</span>
              </span>
              <Toggle checked={layers.undiscovered} onChange={(v) => onLayers({ undiscovered: v })} label="Places not yet discovered" />
            </label>
            <label className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Protected areas &amp; disputed regions</span>
                <span className="block text-[12px] text-ink-2">Park outlines appear as you zoom in</span>
              </span>
              <Toggle checked={layers.areas} onChange={(v) => onLayers({ areas: v })} label="Protected areas and disputed regions" />
            </label>
            <div className="my-1.5 border-t border-line" />
            <p className="px-3 pt-1 pb-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">Places</p>
            <div className="flex flex-wrap gap-1.5 px-3 pt-1 pb-2.5">
              <Chip active={!layers.groups.length} onClick={() => onLayers({ groups: [] })}>
                All
              </Chip>
              {PLACE_GROUPS.map((g) => (
                <Chip key={g.id} active={layers.groups.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
