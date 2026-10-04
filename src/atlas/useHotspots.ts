/** Tiny build-derived PYQ metadata; question packs stay lazy and map disclosure uses only aggregate counts. */
import { useEffect, useState } from 'react'

type HotspotCounts = { CSE: number; PCS: number; CDS: number }
let weights: ReadonlyMap<string, number> | null = null
let pending: Promise<ReadonlyMap<string, number>> | null = null

export function useHotspots(enabled: boolean) {
  const [value, setValue] = useState(weights)
  useEffect(() => {
    if (!enabled) return
    let live = true
    pending ??= fetch(`${import.meta.env.BASE_URL}atlas-assets/v1/pyq-hotspots.json`)
      .then(r => {
        if (!r.ok) throw new Error('Hotspots unavailable')
        return r.json() as Promise<{ places: Record<string, HotspotCounts> }>
      })
      .then(m => {
        weights = new Map(Object.entries(m.places).map(([id, count]) => [id, count.CSE + count.PCS + count.CDS]))
        return weights
      })
    pending.then(v => { if (live) setValue(v) }).catch(() => { pending = null })
    return () => { live = false }
  }, [enabled])
  return enabled ? value : undefined
}
