/** Semantic zoom and viewport slicing for study places; the renderer never needs the full corpus at once. */
import type { Place, PlaceKind, SheetId } from '@/atlas/types'

export interface GeoViewBounds {
  west: number
  east: number
  south: number
  north: number
}

export interface StudySliceOptions {
  zoom: number
  bounds?: GeoViewBounds
  discovered?: ReadonlySet<string> | ReadonlyMap<string, unknown>
  showUndiscovered?: boolean
  kinds?: ReadonlySet<PlaceKind> | null
  pyqWeights?: ReadonlyMap<string, number> | null
  selectedId?: string
}

export function baseMinZoom(place: Place) {
  if (place.kind === 'capital') return place.tags?.includes('national') || place.level === 1 ? 0 : 1.4
  return place.level === 1 ? 1.3 : place.level === 2 ? 2 : 2.9
}

export function hotspotMinZoom(weight: number) {
  if (weight >= 6) return 0.9
  if (weight >= 3) return 1.25
  if (weight >= 2) return 1.6
  return 2.15
}

export function placeMinZoom(place: Place, known: boolean, pyqWeight = 0) {
  const normal = baseMinZoom(place) + (known ? 0 : 0.35)
  return pyqWeight > 0 ? Math.min(normal, hotspotMinZoom(pyqWeight)) : normal
}

/** MapLibre's fitted India overview starts around z3.2 while the legacy study zoom starts at 1. Normalize both to one semantic scale. */
export function semanticZoomForMap(sheet: SheetId, mapZoom: number) {
  return Math.max(0, mapZoom - (sheet === 'india' ? 2.2 : 0.2))
}

function inBounds(place: Place, bounds: GeoViewBounds) {
  const latitude = place.lat >= bounds.south && place.lat <= bounds.north
  const longitude = bounds.west <= bounds.east ? place.lon >= bounds.west && place.lon <= bounds.east : place.lon >= bounds.west || place.lon <= bounds.east
  return latitude && longitude
}

function known(discovered: StudySliceOptions['discovered'], id: string) {
  return !discovered || discovered.has(id)
}

function priority(place: Place, isKnown: boolean, pyqWeight: number, selected: boolean) {
  return (selected ? 100000 : 0) + pyqWeight * 120 + (isKnown ? 220 : 0) + (place.kind === 'capital' ? 90 : 0) + (4 - place.level) * 30 + (place.yield?.score ?? 0)
}

export function studySourceLimit(zoom: number) {
  if (zoom < 1.15) return 80
  if (zoom < 2.25) return 160
  if (zoom < 3.1) return 300
  if (zoom < 4) return 500
  return 800
}

/**
 * Returns only the places useful for the settled viewport. Search still owns the
 * complete gazetteer; selecting a hidden place forces it into this slice.
 */
export function studyPlacesForView(places: readonly Place[], options: StudySliceOptions) {
  const candidates = places.flatMap(place => {
    const isSelected = place.id === options.selectedId
    const isKnown = known(options.discovered, place.id)
    const pyqWeight = options.pyqWeights?.get(place.id) ?? 0
    if (!isSelected && options.kinds && !options.kinds.has(place.kind)) return []
    if (!isSelected && options.showUndiscovered === false && !isKnown) return []
    if (!isSelected && options.zoom < placeMinZoom(place, isKnown, pyqWeight)) return []
    if (!isSelected && options.bounds && !inBounds(place, options.bounds)) return []
    return [{ place, score: priority(place, isKnown, pyqWeight, isSelected) }]
  })

  candidates.sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id))
  return candidates.slice(0, studySourceLimit(options.zoom)).map(candidate => candidate.place)
}
