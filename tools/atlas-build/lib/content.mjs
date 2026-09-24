/** Gathers the hand-written gazetteer from content/. */
import { slug } from './geo.mjs'
import indiaRivers from '../content/india-rivers.mjs'
import indiaMountains from '../content/india-mountains.mjs'
import indiaLand from '../content/india-land.mjs'
import indiaWater from '../content/india-water.mjs'
import indiaPlaces from '../content/india-places.mjs'
import world from '../content/world.mjs'
import expeditions from '../content/expeditions.mjs'

export const CONTENT = {
  india: [...indiaRivers, ...indiaMountains, ...indiaLand, ...indiaWater, ...indiaPlaces],
  world,
}
export const EXPEDITIONS = expeditions

export const PREFIX = { india: 'in', world: 'w' }
export const placeId = (sheet, p) => `${PREFIX[sheet]}.${p.kind}.${p.id ?? slug(p.name)}`

/** Rivers that need a traced or hand-drawn course on the India sheet. */
export function riverSpecs() {
  return CONTENT.india
    .filter((p) => p.kind === 'river' && p.line)
    .map((p) => ({ id: p.id ?? slug(p.name), name: p.name, rank: p.lvl === 1 ? 2 : p.lvl === 3 ? 4 : 3, ...p.line }))
}
