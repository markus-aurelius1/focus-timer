/**
 * The gazetteer (places.json): loaded once, indexed, cached by the service
 * worker for offline use. Static geographic data only – user progress lives in
 * IndexedDB and refers to places by id.
 */
import { useEffect, useState } from 'react'
import type { CountryInfo, Expedition, Place, PlacesFile, SheetId, StateInfo } from './types'

export interface AtlasData {
  places: Place[]
  byId: Map<string, Place>
  expeditions: Expedition[]
  expedition: (id: string | null | undefined) => Expedition | undefined
  states: StateInfo[]
  state: (id: string | null | undefined) => StateInfo | undefined
  countries: CountryInfo[]
  country: (iso: string | null | undefined) => CountryInfo | undefined
  regions: PlacesFile['regions']
  /** Places whose fog unit is this state / country. */
  inUnit: Map<string, Place[]>
  bySheet: Record<SheetId, Place[]>
  /** Places that name this place in a relation (reverse links for place cards). */
  referencedBy: Map<string, Array<{ place: Place; key: string }>>
}

export function indexAtlas(file: PlacesFile): AtlasData {
  const byId = new Map(file.places.map((p) => [p.id, p]))
  const inUnit = new Map<string, Place[]>()
  const bySheet: Record<SheetId, Place[]> = { india: [], world: [] }
  const referencedBy = new Map<string, Array<{ place: Place; key: string }>>()
  for (const p of file.places) {
    bySheet[p.sheet].push(p)
    if (p.unit) {
      if (!inUnit.has(p.unit)) inUnit.set(p.unit, [])
      inUnit.get(p.unit)!.push(p)
    }
    for (const [key, v] of Object.entries(p.rel ?? {})) {
      for (const ref of Array.isArray(v) ? v : [v]) {
        if (typeof ref !== 'string' || !byId.has(ref)) continue
        if (!referencedBy.has(ref)) referencedBy.set(ref, [])
        referencedBy.get(ref)!.push({ place: p, key })
      }
    }
  }
  const expById = new Map(file.expeditions.map((e) => [e.id, e]))
  const stateById = new Map(file.states.map((s) => [s.id, s]))
  const countryByIso = new Map(file.countries.map((c) => [c.iso, c]))
  return {
    places: file.places,
    byId,
    expeditions: file.expeditions,
    expedition: (id) => (id ? expById.get(id) : undefined),
    states: file.states,
    state: (id) => (id ? stateById.get(id) : undefined),
    countries: file.countries,
    country: (iso) => (iso ? countryByIso.get(iso) : undefined),
    regions: file.regions,
    inUnit,
    bySheet,
    referencedBy,
  }
}

let pending: Promise<AtlasData> | null = null
let loaded: AtlasData | null = null

export function loadAtlas(): Promise<AtlasData> {
  if (pending) return pending
  pending = fetch(`${import.meta.env.BASE_URL}atlas/v1/places.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Atlas places: ${r.status}`)
      return r.json() as Promise<PlacesFile>
    })
    .then((f) => (loaded = indexAtlas(f)))
  pending.catch(() => (pending = null))
  return pending
}

/** The gazetteer, or null while it loads. */
export function useAtlas(): AtlasData | null {
  const [data, setData] = useState<AtlasData | null>(loaded)
  useEffect(() => {
    if (loaded) return
    let alive = true
    loadAtlas().then(
      (d) => alive && setData(d),
      (e) => console.error('[atlas]', e),
    )
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** A short descriptor, e.g. "Mountain pass · 4,310 m · Sikkim". */
export function placeSubtitle(p: Place, atlas: AtlasData, kindName: string): string {
  const parts = [p.subtitle ?? kindName]
  if (p.elevation) parts.push(`${p.elevation.toLocaleString('en-IN')} m`)
  const where = p.states?.length
    ? p.states.length > 2
      ? `${p.states.length} states`
      : p.states.map((s) => atlas.state(s)?.name ?? s).join(' / ')
    : p.countries?.length
      ? p.countries.length > 2
        ? `${p.countries.length} countries`
        : p.countries.map((c) => atlas.country(c)?.name ?? c).join(' / ')
      : null
  if (where) parts.push(where)
  return parts.join(' · ')
}
