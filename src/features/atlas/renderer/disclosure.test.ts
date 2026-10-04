/** Progressive disclosure keeps the overview sparse while search-selected and nearby study places remain available. */
import { describe, expect, it } from 'vitest'
import type { Place } from '@/atlas/types'
import { hotspotMinZoom, placeMinZoom, semanticZoomForMap, studyPlacesForView, studySourceLimit } from './disclosure'

const place = { id: 'x', name: 'X', kind: 'park', sheet: 'india', x: 0, y: 0, lon: 80, lat: 20, facts: [], level: 2 } as Place

describe('Atlas semantic zoom', () => {
  it('reveals repeated hotspots before one-off mentions', () => {
    expect(hotspotMinZoom(6)).toBeLessThan(hotspotMinZoom(3))
    expect(hotspotMinZoom(3)).toBeLessThan(hotspotMinZoom(1))
  })

  it('never hides a hotspot later than its normal place threshold', () => {
    expect(placeMinZoom(place, true, 1)).toBeLessThanOrEqual(placeMinZoom(place, true, 0))
  })

  it('keeps undiscovered non-hotspots slightly later than known places', () => {
    expect(placeMinZoom(place, false, 0)).toBeGreaterThan(placeMinZoom(place, true, 0))
  })

  it('normalizes the fitted India and World overview to the same study zoom', () => {
    expect(semanticZoomForMap('india', 3.2)).toBeCloseTo(1)
    expect(semanticZoomForMap('world', 1.2)).toBeCloseTo(1)
  })

  it('excludes off-screen places but always keeps an explicitly selected place', () => {
    const nearby = { ...place, id: 'nearby', lon: 81, lat: 21 }
    const far = { ...place, id: 'far', lon: 10, lat: 50 }
    const options = { zoom: 3, bounds: { west: 70, east: 90, south: 10, north: 30 } }
    expect(studyPlacesForView([nearby, far], options).map(p => p.id)).toEqual(['nearby'])
    expect(studyPlacesForView([nearby, far], { ...options, selectedId: 'far' }).map(p => p.id)).toContain('far')
  })

  it('caps low-zoom source size deterministically', () => {
    const places: Place[] = Array.from({ length: 120 }, (_, i) => ({ ...place, id: 'p-' + String(i).padStart(3, '0'), kind: 'capital' as const, level: 1 as const }))
    const result = studyPlacesForView(places, { zoom: 1 })
    expect(result).toHaveLength(studySourceLimit(1))
    expect(result.map(p => p.id)).toEqual([...result].map(p => p.id).sort())
  })
})
