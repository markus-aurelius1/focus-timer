/** Repackages existing, controlled Atlas vectors into a local experimental archive. No geographic content is added. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { feature } from '../../node_modules/topojson-client/src/index.js'
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'
import { zxyToTileId } from 'pmtiles'
import { SHEETS, sheetFrame } from '../atlas-build/lib/sheets.mjs'
mkdirSync('data', { recursive: true })
const layers = {}
for (const id of ['world', 'india']) {
  const sheet = JSON.parse(readFileSync(`../../public/atlas/v1/${id}.json`))
  const projection = sheetFrame(SHEETS[id]).projection
  const inverse = (c) => typeof c[0] === 'number' ? projection.invert(c) : c.map(inverse)
  for (const [name, object] of Object.entries(sheet.topology.objects)) {
    const collection = feature(sheet.topology, object)
    const features = (collection.features ?? [collection]).filter(f => f.geometry?.coordinates).map(f => ({ ...f, geometry: { ...f.geometry, coordinates: inverse(f.geometry.coordinates) } }))
    layers[`${id}_${name}`] = { type: 'FeatureCollection', features }
  }
}
const indexes = Object.fromEntries(Object.entries(layers).map(([k,v]) => [k, new geojsonvt(v, { maxZoom: 4, tolerance: 2 })]))
const tiles = []
for (let z = 0; z <= 4; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) {
  const tileLayers = Object.fromEntries(Object.entries(indexes).map(([k,v]) => [k,v.getTile(z,x,y)]).filter(([,v]) => v?.features.length))
  if (Object.keys(tileLayers).length) tiles.push({ id: zxyToTileId(z,x,y), data: gzipSync(vtpbf.fromGeojsonVt(tileLayers)) })
}
tiles.sort((a,b) => a.id-b.id)
const bytes = []
const varint = (n) => { while (n >= 128) { bytes.push(n % 128 + 128); n = Math.floor(n / 128) } bytes.push(n) }
varint(tiles.length)
let prev = 0
for (const t of tiles) { varint(t.id-prev); prev=t.id }
for (const t of tiles) varint(1)
for (const t of tiles) varint(t.data.length)
for (let i=0;i<tiles.length;i++) varint(i===0 ? 1 : 0)
const dir = gzipSync(Buffer.from(bytes))
const metadata = gzipSync(Buffer.from(JSON.stringify({ name: 'Tars controlled Atlas experiment', attribution: 'Existing Tars Atlas source policy', vector_layers: Object.keys(layers).map(id => ({ id, fields: {}, minzoom: 0, maxzoom: 4 })) })))
const data = Buffer.concat(tiles.map(t => t.data))
const header = Buffer.alloc(127)
header.write('PMTiles'); header[7]=3
for (const [offset,value] of [[8,127],[16,dir.length],[24,127+dir.length],[32,metadata.length],[40,127+dir.length+metadata.length],[48,0],[56,127+dir.length+metadata.length],[64,data.length],[72,tiles.length],[80,tiles.length],[88,tiles.length]]) header.writeBigUInt64LE(BigInt(value),offset)
header[96]=1; header[97]=2; header[98]=2; header[99]=1; header[100]=0; header[101]=4
for (const [off,value] of [[102,-180],[106,-85],[110,180],[114,85],[119,81],[123,23]]) header.writeInt32LE(value*1e7,off)
header[118]=3
writeFileSync('data/controlled.pmtiles',Buffer.concat([header,dir,metadata,data]))
const places = JSON.parse(readFileSync('../../public/atlas/v1/places.json')).places
writeFileSync('data/study.json',JSON.stringify({ type:'FeatureCollection', features:places.map(p => ({ type:'Feature',id:p.id,properties:{id:p.id,name:p.name,kind:p.kind,sheet:p.sheet},geometry:{type:'Point',coordinates:[p.lon,p.lat]} })) }))
writeFileSync('data/layers.json',JSON.stringify(Object.keys(layers)))
console.log(JSON.stringify({tiles:tiles.length,archiveBytes:127+dir.length+metadata.length+data.length,places:places.length,layers:Object.keys(layers)}))
