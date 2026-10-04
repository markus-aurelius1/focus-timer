/** Progressive disclosure keeps one-off PYQ places out of the overview while surfacing repeated hotspots. */
import { describe, expect, it } from 'vitest'
import type { Place } from '@/atlas/types'
import { hotspotMinZoom, placeMinZoom } from './disclosure'

const place = { id: 'x', name: 'X', kind: 'park', sheet: 'india', x: 0, y: 0, lon: 0, lat: 0, facts: [], level: 2 } as Place

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
})
