/** Experimental MapLibre renderer adapter. Kept isolated until Atlas interaction parity and physical-device checks are green. */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Map as LibreMap, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Point } from 'geojson'
import type { AtlasMapHandle, AtlasMapProps, MapInsets } from './renderer/types'
import { semanticZoomForMap, studyPlacesForView, type GeoViewBounds } from './renderer/disclosure'

setWorkerUrl(workerUrl)

const OPEN_FREE_MAP_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const OPEN_FREE_MAP_DARK = 'https://tiles.openfreemap.org/styles/dark'
const SOURCE = 'tars-study-places'
const INDIA_BORDER = 'tars-india-controlled-border'

type PlaceProps = {
  id: string
  name: string
  kind: string
  pyqWeight: number
  selected: boolean
}

const centerFor = (sheet: AtlasMapProps['sheet']['id']): [number, number] => sheet === 'india' ? [81, 23] : [10, 15]
const zoomFor = (sheet: AtlasMapProps['sheet']['id']) => sheet === 'india' ? 3.2 : 1.2
const mapZoomForStudy = (sheet: AtlasMapProps['sheet']['id'], zoom: number) => zoom + (sheet === 'india' ? 2.2 : 0.2)
const styleFor = (tone: AtlasMapProps['tone']) => tone === 'night' ? OPEN_FREE_MAP_DARK : OPEN_FREE_MAP_LIGHT

function paddingFor(insets?: MapInsets) {
  return { top: insets?.top ?? 0, bottom: insets?.bottom ?? 0, left: insets?.left ?? 0, right: insets?.right ?? 0 }
}

function nearestPlace(props: AtlasMapProps, x: number, y: number) {
  let best = props.places[0], distance = Infinity
  for (const place of props.places) {
    const next = Math.hypot(place.x - x, place.y - y)
    if (next < distance) { best = place; distance = next }
  }
  return best
}

/** Overscan keeps a settled slice useful through the next gesture; a new slice is built only on moveend. */
function viewBounds(map: LibreMap): GeoViewBounds {
  const canvas = map.getCanvas()
  const px = Math.max(80, canvas.clientWidth * 0.18), py = Math.max(80, canvas.clientHeight * 0.18)
  const northWest = map.unproject([-px, -py])
  const southEast = map.unproject([canvas.clientWidth + px, canvas.clientHeight + py])
  return { west: northWest.lng, east: southEast.lng, south: southEast.lat, north: northWest.lat }
}

function collectionFor(props: AtlasMapProps, map: LibreMap): FeatureCollection<Point, PlaceProps> {
  if (props.showPlaces === false) return { type: 'FeatureCollection', features: [] }
  const zoom = semanticZoomForMap(props.sheet.id, map.getZoom())
  const places = studyPlacesForView(props.places, {
    zoom,
    bounds: viewBounds(map),
    discovered: props.discovered,
    showUndiscovered: props.showUndiscovered,
    kinds: props.kinds,
    pyqWeights: props.pyqWeights,
    selectedId: props.selectedId,
  })
  return {
    type: 'FeatureCollection',
    features: places.map(place => ({
      type: 'Feature' as const,
      id: place.id,
      properties: {
        id: place.id,
        name: place.name,
        kind: place.kind,
        pyqWeight: props.pyqWeights?.get(place.id) ?? 0,
        selected: props.selectedId === place.id,
      },
      geometry: { type: 'Point' as const, coordinates: [place.lon, place.lat] },
    })),
  }
}

/** Preserve ordinary administrative boundaries; suppress only the provider's disputed/claim linework before drawing the controlled India border. */
function hideGenericIndiaDisputedBoundaries(map: LibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'line' || !/(boundary|admin|border)/i.test(layer.id) || !/(disput|claim)/i.test(layer.id)) continue
    try { map.setLayoutProperty(layer.id, 'visibility', 'none') } catch { /* Provider style changed; controlled overlay still loads. */ }
  }
}

function addStudyLayers(map: LibreMap, data: FeatureCollection<Point, PlaceProps>, sheet: AtlasMapProps['sheet']['id']) {
  if (map.getSource(SOURCE)) return
  if (sheet === 'india') {
    hideGenericIndiaDisputedBoundaries(map)
    map.addSource(INDIA_BORDER, { type: 'geojson', data: import.meta.env.BASE_URL + 'atlas-assets/v1/india-controlled-border.geojson' })
    map.addLayer({
      id: 'tars-india-controlled-border-line',
      type: 'line',
      source: INDIA_BORDER,
      paint: { 'line-color': '#202a36', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.7, 7, 3.1], 'line-opacity': 0.95 },
    })
  }

  map.addSource(SOURCE, { type: 'geojson', data, cluster: true, clusterMaxZoom: 4, clusterRadius: 44 })
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
      'circle-opacity': 0.95,
    },
  })
  map.addLayer({
    id: 'tars-study-labels',
    type: 'symbol',
    source: SOURCE,
    minzoom: sheet === 'india' ? 5 : 3.5,
    filter: ['!', ['has', 'point_count']],
    layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
    paint: { 'text-color': '#17283a', 'text-halo-color': '#fffdf7', 'text-halo-width': 1.4 },
  })
}

type MapLibreAtlasProps = AtlasMapProps & { onFailure?: () => void }

export const MapLibreAtlasMap = forwardRef<AtlasMapHandle, MapLibreAtlasProps>(function MapLibreAtlasMap(props, ref) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const propsRef = useRef(props)
  const styleRef = useRef(styleFor(props.tone))
  propsRef.current = props

  const refreshSource = () => {
    const map = mapRef.current
    if (!map) return
    const collection = collectionFor(propsRef.current, map)
    if (node.current) {
      node.current.dataset.studyCount = String(collection.features.length)
      node.current.dataset.studyZoom = semanticZoomForMap(propsRef.current.sheet.id, map.getZoom()).toFixed(2)
    }
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined
    if (source) void source.setData(collection)
  }

  useImperativeHandle(ref, () => ({
    flyTo: (x, y, zoom = 3, insets?: MapInsets) => {
      const place = nearestPlace(propsRef.current, x, y), map = mapRef.current
      if (place && map) map.flyTo({ center: [place.lon, place.lat], zoom: mapZoomForStudy(propsRef.current.sheet.id, zoom), padding: paddingFor(insets) })
    },
    reveal: (x, y, insets?: MapInsets) => {
      const map = mapRef.current, place = nearestPlace(propsRef.current, x, y)
      if (!map || !place) return
      const point = map.project([place.lon, place.lat]), canvas = map.getCanvas()
      const left = insets?.left ?? 0, right = canvas.clientWidth - (insets?.right ?? 0), top = insets?.top ?? 0, bottom = canvas.clientHeight - (insets?.bottom ?? 0)
      if (point.x < left || point.x > right || point.y < top || point.y > bottom) map.easeTo({ center: [place.lon, place.lat], padding: paddingFor(insets) })
    },
    fitFocus: () => mapRef.current?.flyTo({ center: centerFor(propsRef.current.sheet.id), zoom: zoomFor(propsRef.current.sheet.id), padding: paddingFor(propsRef.current.insets) }),
    zoomBy: factor => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 1) + Math.log2(factor)),
  }), [])

  useEffect(() => {
    if (!node.current) return
    let ready = false
    const loadTimeout = window.setTimeout(() => { if (!ready) propsRef.current.onFailure?.() }, 8000)
    const map = new LibreMap({
      container: node.current,
      style: styleRef.current,
      center: centerFor(props.sheet.id),
      zoom: zoomFor(props.sheet.id),
      renderWorldCopies: false,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })
    mapRef.current = map

    const setup = () => {
      ready = true
      window.clearTimeout(loadTimeout)
      addStudyLayers(map, collectionFor(propsRef.current, map), propsRef.current.sheet.id)
      refreshSource()
    }
    const failBeforeReady = () => { if (!ready) propsRef.current.onFailure?.() }
    map.on('load', setup)
    map.on('style.load', setup)
    map.on('error', failBeforeReady)
    map.on('moveend', refreshSource)

    const selectPoint = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0], id = feature?.properties?.id
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

    return () => {
      window.clearTimeout(loadTimeout)
      map.off('error', failBeforeReady)
      map.off('moveend', refreshSource)
      mapRef.current = null
      map.remove()
    }
  }, [props.sheet.id]) // The renderer is recreated only when switching India/World.

  useEffect(() => {
    const map = mapRef.current, next = styleFor(props.tone)
    if (!map || styleRef.current === next) return
    styleRef.current = next
    map.setStyle(next)
  }, [props.tone])

  useEffect(() => {
    refreshSource()
  }, [props.places, props.kinds, props.showPlaces, props.showUndiscovered, props.discovered, props.pyqWeights, props.selectedId])

  return <div ref={node} data-renderer="maplibre" data-sheet={props.sheet.id} className="absolute inset-0 size-full" role="application" aria-label={`${props.sheet.title} interactive Tars vector Atlas`} />
})

export default MapLibreAtlasMap
