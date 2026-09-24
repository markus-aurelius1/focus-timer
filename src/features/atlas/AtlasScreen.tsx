/**
 * The Atlas: a real atlas map that fills in as you study. Focus time moves your
 * expedition and uncovers places; recall makes them Familiar, Strong and
 * Mastered; mastered regions develop.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, ChevronUp, Crosshair, Flag, GraduationCap, Info, Layers, Lock, Minus, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { consumeParams, useRoute } from '@/app/router'
import { useSheet } from '@/atlas/sheet'
import { livingWorld } from '@/atlas/living'
import type { Place, SheetId } from '@/atlas/types'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { updateSettings, useSettings } from '@/data/hooks'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { useTimer } from '@/timer/store'
import { Button, IconButton, Segmented } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { AtlasMap, type AtlasMapHandle, type Highlight, type MapTarget, type RouteOverlay } from './AtlasMap'
import { AtlasPanel, expeditionStatus, ExplorerCard } from './AtlasPanel'
import { BaseCampPicker } from './BaseCamp'
import { ExpeditionSheet } from './ExpeditionSheet'
import { FieldReviewSheet, type ReviewRequest } from './FieldReview'
import { GazetteerSheet } from './Gazetteer'
import { LegendSheet } from './Legend'
import { PlaceDetails } from './PlaceDetails'
import { UnitDetails } from './UnitDetails'
import { masteryFn, viewFor } from './util'

type Selection = { type: 'place'; id: string } | { type: 'state'; id: string } | { type: 'country'; id: string }
type Panel = 'expeditions' | 'gazetteer' | 'legend' | 'basecamp' | 'more' | null

const VISIT_KEY = 'lodestar:atlas:lastVisit'
const readVisit = () => {
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

export default function AtlasScreen() {
  const ex = useExploration()
  if (!ex) return <MapLoading />
  return <Atlas ex={ex} />
}

function MapLoading({ error }: { error?: boolean }) {
  return (
    <div className="flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] items-center justify-center bg-[#c6e1f2] lg:h-dvh">
      <p className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#1f3a64] shadow-soft">{error ? 'The map couldn’t load. Check your connection once, then it works offline.' : 'Unrolling the map…'}</p>
    </div>
  )
}

function Atlas({ ex }: { ex: Exploration }) {
  const settings = useSettings()
  const desktop = useIsDesktop()
  const route = useRoute()
  const [sheetId, setSheetId] = useState<SheetId>(() => (route.params.get('sheet') === 'world' ? 'world' : 'india'))
  const { sheet, error } = useSheet(sheetId)
  const map = useRef<AtlasMapHandle>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const [lastVisit] = useState(readVisit)
  const pendingFly = useRef<Place | null>(null)
  const timerActive = useTimer((s) => s.timer.status !== 'idle')

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

  const onSheet = useMemo(() => ex.atlas.bySheet[sheetId], [ex, sheetId])
  const places = useMemo(() => onSheet.filter((p) => ex.state.discovered.has(p.id)), [onSheet, ex])
  const newIds = useMemo(() => {
    if (!lastVisit) return new Set<string>()
    const fresh = places.filter((p) => (ex.state.discovered.get(p.id)?.at ?? 0) > lastVisit)
    fresh.sort((a, b) => (ex.state.discovered.get(b.id)?.at ?? 0) - (ex.state.discovered.get(a.id)?.at ?? 0))
    return new Set(fresh.slice(0, 12).map((p) => p.id))
  }, [places, ex, lastVisit])
  const { muted, linked } = useMemo(() => {
    const muted = new Set<string>()
    const linked = new Map<string, string>()
    for (const p of onSheet) {
      if (!p.geom) continue
      if (ex.state.discovered.has(p.id)) linked.set(p.geom, p.id)
      else muted.add(p.geom)
    }
    return { muted, linked }
  }, [onSheet, ex])
  const explored = useMemo(() => (sheetId === 'world' ? new Set([...ex.state.explored].map((u) => u.toLowerCase())) : ex.state.explored), [ex, sheetId])

  const routeOverlay = useMemo<RouteOverlay | null>(() => {
    const a = ex.state.active
    if (!a || a.complete || a.expedition.sheet !== sheetId) return null
    // The current chapter only: the way travelled, and the leg ahead.
    const chapter = a.next?.stop.chapter ?? a.stops[a.stops.length - 1]?.chapter ?? 0
    const shown = a.stops.filter((s) => s.chapter === chapter && (s.reached || s === a.next?.stop))
    if (!shown.length) return null
    return { points: shown.map((s) => ({ id: s.place.id, x: s.place.x, y: s.place.y, state: s.reached ? 'reached' : 'next' })) }
  }, [ex, sheetId])

  const living = useMemo(() => livingWorld(ex, sheetId), [ex, sheetId])
  const selectedPlace = sel?.type === 'place' ? ex.atlas.byId.get(sel.id) : undefined
  const highlights = useMemo<Highlight[]>(() => {
    if (!sel) return []
    if (sel.type === 'state' || sel.type === 'country') return [{ kind: sel.type, id: sel.id }]
    const p = ex.atlas.byId.get(sel.id)
    if (!p?.geom || p.sheet !== sheetId || !ex.state.discovered.has(p.id)) return []
    const [layer, id] = p.geom.split(':')
    return [{ kind: layer === 'marine' ? 'marine' : (layer as Highlight['kind']), id }]
  }, [sel, ex, sheetId])

  const flyToPlace = useCallback(
    (p: Place) => {
      if (p.sheet !== sheetId) {
        pendingFly.current = p
        setSheetId(p.sheet)
        return
      }
      map.current?.flyTo(p.x, p.y, p.kind === 'river' || p.kind === 'range' ? 1.8 : 3)
    },
    [sheetId],
  )
  useEffect(() => {
    if (!sheet || !pendingFly.current || pendingFly.current.sheet !== sheet.id) return
    const p = pendingFly.current
    pendingFly.current = null
    setTimeout(() => map.current?.flyTo(p.x, p.y, 3), 80)
  }, [sheet])

  const select = useCallback(
    (t: MapTarget) => {
      if (t.type === 'point' || t.type === 'pin') return setSel(null)
      haptics.tap()
      if (t.type === 'place') {
        const p = ex.atlas.byId.get(t.id)
        if (p && p.sheet !== sheetId && ex.state.discovered.has(p.id)) flyToPlace(p)
      }
      if (t.type === 'country' && sheetId === 'india' && t.id === 'ind') return
      setSel(t)
    },
    [ex, sheetId, flyToPlace],
  )

  // Deep links: #/atlas?place=…, ?review=1, ?expeditions=1
  useEffect(() => {
    const id = route.params.get('place')
    if (id && ex.atlas.byId.get(id)) {
      const p = ex.atlas.byId.get(id)!
      setSel({ type: 'place', id })
      if (ex.state.discovered.has(id)) flyToPlace(p)
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
      <PlaceDetails ex={ex} place={selectedPlace} onSelect={select} onTest={(id) => setReview({ placeIds: [id], source: 'card', title: 'Test me' })} onShow={(p) => { flyToPlace(p); if (!desktop) setSel(null) }} />
    ) : sel.type !== 'place' ? (
      <UnitDetails ex={ex} unit={sel} onSelect={select} />
    ) : null
  ) : null

  const status = expeditionStatus(ex)

  return (
    <div className="flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] lg:h-dvh">
      <div className="relative min-w-0 flex-1">
        {sheet ? (
          <AtlasMap
            ref={map}
            sheet={sheet}
            plate={view.plate}
            tone={view.tone}
            explored={explored}
            places={places}
            mastery={mastery}
            newIds={newIds}
            selectedId={sel?.type === 'place' ? sel.id : undefined}
            highlights={highlights}
            route={routeOverlay}
            mutedLabels={muted}
            linkedLabels={linked}
            living={living}
            onSelect={select}
            insets={desktop ? { top: 56, bottom: 0 } : { top: 56, bottom: timerActive ? 210 : 160 }}
          />
        ) : (
          <MapLoading error={!!error} />
        )}

        {/* Top controls */}
        <div data-map-ui className="pt-safe pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
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
          <div className="pointer-events-auto flex gap-1.5">
            <MapButton label="Search places" onClick={() => setPanel('gazetteer')}>
              <Search className="size-[18px]" />
            </MapButton>
            <StyleMenu current={view.style} rankIndex={ex.level.rankIndex} />
            <MapButton label="Legend" onClick={() => setPanel('legend')}>
              <Info className="size-[18px]" />
            </MapButton>
            <MapButton label="Fit the map" onClick={() => map.current?.fitFocus()}>
              <Crosshair className="size-[18px]" />
            </MapButton>
          </div>
        </div>

        {desktop && (
          <div data-map-ui className="absolute right-3 bottom-3 flex flex-col gap-1.5">
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
          <div data-map-ui className={cn('absolute inset-x-3 transition-[bottom] duration-300', timerActive ? 'bottom-[64px]' : 'bottom-3')}>
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
              <motion.div key="details" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
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
          select({ type: 'place', id })
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
          if (p && ex.state.discovered.has(id)) flyToPlace(p)
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

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-soft transition-transform active:scale-95">
      {children}
    </button>
  )
}

function StyleMenu({ current, rankIndex }: { current: string; rankIndex: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <MapButton label="Map style" onClick={() => setOpen((o) => !o)}>
        <Layers className="size-[18px]" />
      </MapButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 z-40 mt-1.5 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
          >
            {MAP_STYLES.map((s) => {
              const locked = s.minRank > rankIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current === s.id}
                  disabled={locked}
                  onClick={() => {
                    void updateSettings({ atlasStyle: s.id })
                    setOpen(false)
                  }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
