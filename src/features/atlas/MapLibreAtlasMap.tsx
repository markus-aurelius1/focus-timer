/** Experimental MapLibre renderer adapter. Kept isolated until Atlas interaction parity and physical-device checks are green. */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Map as LibreMap, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { AtlasMapHandle, AtlasMapProps, MapInsets } from './renderer/types'
import { placeMinZoom } from './renderer/disclosure'

setWorkerUrl(workerUrl)

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const SOURCE = 'tars-study-places'
const INDIA_BORDER = 'tars-india-controlled-border'

type PlaceProps = {
  id: string
  name: string
  kind: string
  minZoom: number
  pyqWeight: number
  selected: boolean
}

const centerFor = (sheet: AtlasMapProps['sheet']['id']): [number, number] => sheet === 'india' ? [81, 23] : [10, 15]
const zoomFor = (sheet: AtlasMapProps['sheet']['id']) => sheet === 'india' ? 3.2 : 1.2

function nearestPlace(props: AtlasMapProps, x: number, y: number) {
  let best = props.places[0], distance = Infinity
  for (const place of props.places) {
    const next = Math.hypot(place.x - x, place.y - y)
    if (next < distance) { best = place; distance = next }
  }
  return best
}

function collectionFor(props: AtlasMapProps): FeatureCollection<Point, PlaceProps> {
  const features = props.places
    .filter(place => !props.kinds || props.kinds.has(place.kind))
    .filter(place => props.showUndiscovered !== false || props.discovered?.has(place.id))
    .map(place => {
      const known = !props.discovered || props.discovered.has(place.id)
      const pyqWeight = props.pyqWeights?.get(place.id) ?? 0
      return {
        type: 'Feature' as const,
        id: place.id,
        properties: { id: place.id, name: place.name, kind: place.kind, minZoom: placeMinZoom(place, known, pyqWeight), pyqWeight, selected: props.selectedId === place.id },
        geometry: { type: 'Point' as const, coordinates: [place.lon, place.lat] },
      }
    })
  return { type: 'FeatureCollection', features }
}

function hideGenericIndiaBoundaries(map: LibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'line' || !/(boundary|admin|border)/i.test(layer.id)) continue
    try { map.setLayoutProperty(layer.id, 'visibility', 'none') } catch { /* Provider style changed; controlled overlay still loads. */ }
  }
}

function addStudyLayers(map: LibreMap, data: FeatureCollection<Point, PlaceProps>, sheet: AtlasMapProps['sheet']['id']) {
  map.addSource(SOURCE, { type: 'geojson', data, cluster: true, clusterMaxZoom: 6, clusterRadius: 44 })
  map.addLayer({
    id: 'tars-clusters',
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#315f83',
      'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 23],
      'circle-stroke-color': '#fffdf7',
      'circle-stroke-width': 2,
      'circle-opacity': 0.92,
    },
  })
  map.addLayer({
    id: 'tars-cluster-count',
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 },
    paint: { 'text-color': '#ffffff' },
  })
  map.addLayer({
    id: 'tars-study-points',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 9, 7],
      'circle-color': ['case', ['>', ['get', 'pyqWeight'], 0], '#b3832d', '#294968'],
      'circle-stroke-color': '#fffdf7',
      'circle-stroke-width': ['case', ['get', 'selected'], 3, 1.5],
      'circle-opacity': ['case', ['>=', ['zoom'], ['get', 'minZoom']], 0.95, 0],
    },
  })
  map.addLayer({
    id: 'tars-study-labels',
    type: 'symbol',
    source: SOURCE,
    minzoom: 5,
    filter: ['!', ['has', 'point_count']],
    layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
    paint: {
      'text-color': '#17283a',
      'text-halo-color': '#fffdf7',
      'text-halo-width': 1.4,
      'text-opacity': ['case', ['>=', ['zoom'], ['get', 'minZoom']], 1, 0],
    },
  })
  if (sheet === 'india') {
    hideGenericIndiaBoundaries(map)
    map.addSource(INDIA_BORDER, { type: 'geojson', data: `${import.meta.env.BASE_URL}atlas-assets/v1/india-controlled-border.geojson` })
    map.addLayer({ id: 'tars-india-controlled-border-line', type: 'line', source: INDIA_BORDER, paint: { 'line-color': '#202a36', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.7, 7, 3.1], 'line-opacity': 0.95 } })
  }
}

export const MapLibreAtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function MapLibreAtlasMap(props, ref) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const data = useMemo(() => collectionFor(props), [props.places, props.kinds, props.showUndiscovered, props.discovered, props.pyqWeights, props.selectedId])
  const propsRef = useRef(props)
  propsRef.current = props

  useImperativeHandle(ref, () => ({
    flyTo: (x, y, zoom = 3) => {
      const place = nearestPlace(propsRef.current, x, y)
      if (place) mapRef.current?.flyTo({ center: [place.lon, place.lat], zoom: Math.max(3, zoom + 2) })
    },
    reveal: (x, y, insets?: MapInsets) => {
      const map = mapRef.current, place = nearestPlace(propsRef.current, x, y)
      if (!map || !place) return
      const point = map.project([place.lon, place.lat]), canvas = map.getCanvas()
      const left = insets?.left ?? 0, right = canvas.clientWidth - (insets?.right ?? 0), top = insets?.top ?? 0, bottom = canvas.clientHeight - (insets?.bottom ?? 0)
      if (point.x < left || point.x > right || point.y < top || point.y > bottom) map.easeTo({ center: [place.lon, place.lat] })
    },
    fitFocus: () => mapRef.current?.flyTo({ center: centerFor(propsRef.current.sheet.id), zoom: zoomFor(propsRef.current.sheet.id) }),
    zoomBy: factor => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 1) + Math.log2(factor)),
  }), [])

  useEffect(() => {
    if (!node.current) return
    const map = new LibreMap({
      container: node.current,
      style: OPEN_FREE_MAP_STYLE,
      center: centerFor(props.sheet.id),
      zoom: zoomFor(props.sheet.id),
      renderWorldCopies: false,
      attributionControl: true,
      cooperativeGestures: false,
    })
    mapRef.current = map
    const loaded = () => addStudyLayers(map, data, props.sheet.id)
    map.on('load', loaded)

    const selectPoint = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      const id = feature?.properties?.id
      if (typeof id === 'string') propsRef.current.onSelect?.({ type: 'place', id })
    }
    const expand = async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0], clusterId = Number(feature?.properties?.cluster_id)
      const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : null
      if (!Number.isFinite(clusterId) || !coordinates) return
      const source = map.getSource(SOURCE) as GeoJSONSource
      const zoom = await source.getClusterExpansionZoom(clusterId)
      map.easeTo({ center: coordinates, zoom })
    }
    map.on('click', 'tars-study-points', selectPoint)
    map.on('click', 'tars-clusters', expand)
    map.on('click', event => {
      if (map.queryRenderedFeatures(event.point, { layers: ['tars-study-points', 'tars-clusters'] }).length) return
      propsRef.current.onSelect?.({ type: 'point', x: 0, y: 0 })
    })

    return () => { mapRef.current = null; map.remove() }
  }, [props.sheet.id]) // The renderer is recreated only when switching India/World.

  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCE) as GeoJSONSource | undefined
    source?.setData(data)
  }, [data])

  return <div ref={node} className="absolute inset-0 size-full" role="application" aria-label="Interactive Tars vector Atlas" />
})

export default MapLibreAtlasMap
