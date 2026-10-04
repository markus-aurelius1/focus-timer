/** Semantic zoom for study places: frequency affects when a hotspot appears, never whether it is searchable. */
import type { Place } from '@/atlas/types'

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
