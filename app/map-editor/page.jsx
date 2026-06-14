'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const GEOJSON_URL = '/geo/sectores_monte_patria_provisorio.geojson'
// Copiar la imagen municipal a: public/img/mapa_sectores_municipal.png
const MUNICIPAL_IMAGE_URL = '/img/mapa_sectores_municipal.png'

const DEFAULT_IMAGE_BOUNDS = {
  north: -30.48,
  south: -31.31,
  west: -71.44,
  east: -70.28
}

const SECTOR_META = [
  { id: 'monte-patria', nombre_sector: 'Monte Patria', slug: 'monte-patria', color: '#22c55e' },
  { id: 'caren', nombre_sector: 'Carén', slug: 'caren', color: '#3b82f6' },
  { id: 'el-palqui', nombre_sector: 'El Palqui', slug: 'el-palqui', color: '#ef4444' },
  { id: 'chanaral-alto', nombre_sector: 'Chañaral Alto', slug: 'chanaral-alto', color: '#eab308' }
]

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function ringFromLatLngs(latlngs) {
  const firstRing = Array.isArray(latlngs?.[0]) ? latlngs[0] : latlngs
  return (firstRing || []).map((p) => [Number(p.lng), Number(p.lat)])
}

function closeRing(coords) {
  if (!coords.length) return coords
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...coords, first]
  return coords
}

function normalizeFeature(feature, fallbackIndex = 0) {
  const meta = SECTOR_META[fallbackIndex % SECTOR_META.length]
  const props = feature?.properties || {}
  return {
    type: 'Feature',
    properties: {
      id: props.id || meta.id,
      nombre_sector: props.nombre_sector || meta.nombre_sector,
      slug: props.slug || meta.slug,
      color: props.color || meta.color
    },
    geometry: feature?.geometry || {
      type: 'Polygon',
      coordinates: [[]]
    }
  }
}

function buildFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    name: 'sectores_monte_patria_provisorio',
    metadata: {
      description:
        'Representación territorial esquemática y referencial para el dashboard epidemiológico. No corresponde a límites oficiales.',
      source: 'Ajuste visual con herramienta interna /map-editor sobre imagen municipal referencial.',
      replacement:
        'Reemplazar este archivo por GeoJSON municipal oficial manteniendo properties.id, properties.nombre_sector, properties.slug y properties.color.'
    },
    features: features.map((f, idx) => normalizeFeature(f, idx))
  }
}

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

export default function MapEditorPage() {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const drawLayerRef = useRef(null)
  const imageOverlayRef = useRef(null)
  const drawControlRef = useRef(null)
  const selectedSectorSlugRef = useRef(SECTOR_META[0].slug)
  const fileInputRef = useRef(null)
  const customImageBlobRef = useRef(null)
  const imageDragRef = useRef({ active: false, startLatLng: null, startBounds: null })
  const imageMoveModeRef = useRef(false)
  const overlayImageUrlRef = useRef(null)
  const imageBoundsRef = useRef(DEFAULT_IMAGE_BOUNDS)
  const [leafletReady, setLeafletReady] = useState(false)
  const [status, setStatus] = useState('Inicializando editor...')
  const [features, setFeatures] = useState([])
  const [selectedSectorSlug, setSelectedSectorSlug] = useState(SECTOR_META[0].slug)
  const [showImage, setShowImage] = useState(true)
  const [showPolygons, setShowPolygons] = useState(true)
  const [imageOpacity, setImageOpacity] = useState(0.42)
  const [imageBounds, setImageBounds] = useState(DEFAULT_IMAGE_BOUNDS)
  const [overlayImageUrl, setOverlayImageUrl] = useState(null)
  const [overlayImageName, setOverlayImageName] = useState('')
  const [imageMoveMode, setImageMoveMode] = useState(false)
  const [moveStep, setMoveStep] = useState(0.02)
  const [scaleStep, setScaleStep] = useState(0.02)
  const [copyMessage, setCopyMessage] = useState('')

  const outputGeoJson = useMemo(() => buildFeatureCollection(features), [features])
  const outputText = useMemo(() => formatJson(outputGeoJson), [outputGeoJson])
  const boundsText = useMemo(() => formatJson(imageBounds), [imageBounds])
  const imageSizeLabel = useMemo(() => {
    const height = Math.abs(imageBounds.north - imageBounds.south)
    const width = Math.abs(imageBounds.east - imageBounds.west)
    return `${height.toFixed(3)}° alto × ${width.toFixed(3)}° ancho`
  }, [imageBounds])

  useEffect(() => {
    selectedSectorSlugRef.current = selectedSectorSlug
  }, [selectedSectorSlug])

  useEffect(() => {
    imageMoveModeRef.current = imageMoveMode
  }, [imageMoveMode])

  useEffect(() => {
    overlayImageUrlRef.current = overlayImageUrl
  }, [overlayImageUrl])

  useEffect(() => {
    imageBoundsRef.current = imageBounds
  }, [imageBounds])

  useEffect(() => {
    let mounted = true

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      .then(async ([leafletModule]) => {
        if (!mounted || !mapElRef.current || mapRef.current) return
        const L = leafletModule.default
        if (typeof window !== 'undefined') window.L = L
        await import('leaflet-draw')
        await import('leaflet-draw/dist/leaflet.draw.css')

        const map = L.map(mapElRef.current, {
          center: [-30.88, -70.85],
          zoom: 10,
          scrollWheelZoom: true
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map)

        const drawnItems = new L.FeatureGroup()
        drawnItems.addTo(map)
        drawLayerRef.current = drawnItems

        const drawControl = new L.Control.Draw({
          position: 'topleft',
          draw: {
            polygon: {
              allowIntersection: false,
              showArea: true,
              shapeOptions: {
                color: '#0f172a',
                weight: 2,
                fillOpacity: 0.28
              }
            },
            rectangle: false,
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false
          },
          edit: {
            featureGroup: drawnItems,
            remove: true
          }
        })
        map.addControl(drawControl)
        drawControlRef.current = drawControl

        map.on(L.Draw.Event.CREATED, (event) => {
          const layer = event.layer
          const meta = SECTOR_META.find((s) => s.slug === selectedSectorSlugRef.current) || SECTOR_META[0]
          layer.feature = {
            type: 'Feature',
            properties: { ...meta }
          }
          layer.setStyle?.({
            color: meta.color,
            fillColor: meta.color,
            fillOpacity: 0.26,
            weight: 2
          })
          drawnItems.addLayer(layer)
          syncFeaturesFromDrawnItems(L)
        })

        map.on(L.Draw.Event.EDITED, () => syncFeaturesFromDrawnItems(L))
        map.on(L.Draw.Event.DELETED, () => syncFeaturesFromDrawnItems(L))

        mapRef.current = map
        setLeafletReady(true)
        setStatus('Editor listo.')
      })
      .catch((err) => {
        console.error('MapEditor: error al cargar Leaflet/leaflet-draw:', err)
        setStatus(`Error cargando editor: ${err.message || err}`)
      })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (customImageBlobRef.current) {
        URL.revokeObjectURL(customImageBlobRef.current)
        customImageBlobRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return

    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar ${GEOJSON_URL}`)
        return res.json()
      })
      .then((geojson) => {
        const loadedFeatures = (geojson.features || []).map((f, idx) => normalizeFeature(f, idx))
        setFeatures(loadedFeatures)
        renderFeaturesOnMap(loadedFeatures)
        setStatus(`GeoJSON cargado: ${loadedFeatures.length} sectores.`)
      })
      .catch((err) => {
        console.error('MapEditor: error al cargar GeoJSON:', err)
        setStatus(`Error cargando GeoJSON: ${err.message || err}`)
      })
  }, [leafletReady])

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return
    renderImageOverlay()
  }, [leafletReady, imageBounds, imageOpacity, showImage, overlayImageUrl])

  useEffect(() => {
    if (drawLayerRef.current) {
      if (showPolygons) drawLayerRef.current.addTo(mapRef.current)
      else mapRef.current.removeLayer(drawLayerRef.current)
    }
  }, [showPolygons])

  useEffect(() => {
    const map = mapRef.current
    if (!leafletReady || !map || typeof window === 'undefined') return

    const onMouseDown = (e) => {
      if (!imageMoveModeRef.current || !overlayImageUrlRef.current) return
      imageDragRef.current = {
        active: true,
        startLatLng: e.latlng,
        startBounds: { ...imageBoundsRef.current }
      }
      map.getContainer().style.cursor = 'grabbing'
    }

    const onMouseMove = (e) => {
      const drag = imageDragRef.current
      if (!drag.active || !drag.startLatLng || !drag.startBounds) return
      const deltaLat = e.latlng.lat - drag.startLatLng.lat
      const deltaLng = e.latlng.lng - drag.startLatLng.lng
      setImageBounds({
        north: drag.startBounds.north + deltaLat,
        south: drag.startBounds.south + deltaLat,
        west: drag.startBounds.west + deltaLng,
        east: drag.startBounds.east + deltaLng
      })
    }

    const endDrag = () => {
      if (!imageDragRef.current.active) return
      imageDragRef.current = { active: false, startLatLng: null, startBounds: null }
      if (imageMoveModeRef.current) map.getContainer().style.cursor = 'grab'
    }

    if (imageMoveMode && overlayImageUrl) {
      map.dragging.disable()
      map.getContainer().style.cursor = 'grab'
      map.on('mousedown', onMouseDown)
      map.on('mousemove', onMouseMove)
      map.on('mouseup', endDrag)
      map.on('mouseleave', endDrag)
    } else {
      map.dragging.enable()
      map.getContainer().style.cursor = ''
      imageDragRef.current = { active: false, startLatLng: null, startBounds: null }
    }

    return () => {
      map.dragging.enable()
      map.getContainer().style.cursor = ''
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', endDrag)
      map.off('mouseleave', endDrag)
    }
  }, [leafletReady, imageMoveMode, overlayImageUrl])

  function renderImageOverlay() {
    const map = mapRef.current
    if (!map || typeof window === 'undefined') return
    const L = window.L
    if (imageOverlayRef.current) {
      map.removeLayer(imageOverlayRef.current)
      imageOverlayRef.current = null
    }
    if (!showImage || !overlayImageUrl) return
    const bounds = [
      [imageBounds.south, imageBounds.west],
      [imageBounds.north, imageBounds.east]
    ]
    imageOverlayRef.current = L.imageOverlay(overlayImageUrl, bounds, {
      opacity: imageOpacity,
      interactive: false
    }).addTo(map)
  }

  function setCustomOverlayFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Selecciona un archivo de imagen válido (PNG, JPG, WEBP).')
      return
    }
    if (customImageBlobRef.current) {
      URL.revokeObjectURL(customImageBlobRef.current)
    }
    const blobUrl = URL.createObjectURL(file)
    customImageBlobRef.current = blobUrl
    setOverlayImageUrl(blobUrl)
    setOverlayImageName(file.name)
    setShowImage(true)
    setStatus(`Imagen cargada: ${file.name}. Ajusta transparencia y bounds para calcar.`)
  }

  function loadDefaultMunicipalImage() {
    if (customImageBlobRef.current) {
      URL.revokeObjectURL(customImageBlobRef.current)
      customImageBlobRef.current = null
    }
    setOverlayImageUrl(MUNICIPAL_IMAGE_URL)
    setOverlayImageName('mapa_sectores_municipal.png')
    setShowImage(true)
    setStatus('Imagen municipal por defecto cargada. Si no se ve, copia el PNG en public/img/.')
  }

  function clearOverlayImage() {
    if (customImageBlobRef.current) {
      URL.revokeObjectURL(customImageBlobRef.current)
      customImageBlobRef.current = null
    }
    setOverlayImageUrl(null)
    setOverlayImageName('')
    setShowImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setStatus('Imagen de referencia quitada del mapa.')
  }

  function renderFeaturesOnMap(nextFeatures) {
    const map = mapRef.current
    const drawnItems = drawLayerRef.current
    if (!map || !drawnItems || typeof window === 'undefined') return
    const L = window.L
    drawnItems.clearLayers()

    L.geoJSON(buildFeatureCollection(nextFeatures), {
      style: (feature) => ({
        color: feature.properties?.color || '#0f172a',
        fillColor: feature.properties?.color || '#0f172a',
        fillOpacity: 0.24,
        weight: 2
      }),
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.feature = normalizeFeature(feature)
        leafletLayer.bindTooltip(feature.properties?.nombre_sector || 'Sector', {
          sticky: true
        })
        drawnItems.addLayer(leafletLayer)
      }
    })

    const bounds = drawnItems.getBounds?.()
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08), { padding: [16, 16], maxZoom: 11 })
    }
  }

  function syncFeaturesFromDrawnItems(L) {
    const next = []
    drawLayerRef.current?.eachLayer((layer, idx) => {
      const meta = normalizeFeature(layer.feature || {}, idx).properties
      const coords = closeRing(ringFromLatLngs(layer.getLatLngs?.()))
      if (coords.length < 4) return
      next.push({
        type: 'Feature',
        properties: meta,
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        }
      })
    })
    setFeatures(next)
    setStatus(`GeoJSON actualizado desde el mapa: ${next.length} polígonos.`)
  }

  function updateBound(key, value) {
    setImageBounds((prev) => ({
      ...prev,
      [key]: safeNumber(value, prev[key])
    }))
  }

  function shiftImage(deltaLat, deltaLng) {
    setImageBounds((prev) => ({
      north: prev.north + deltaLat,
      south: prev.south + deltaLat,
      west: prev.west + deltaLng,
      east: prev.east + deltaLng
    }))
  }

  function nudgeImage(direction) {
    const step = moveStep
    if (direction === 'north') shiftImage(step, 0)
    if (direction === 'south') shiftImage(-step, 0)
    if (direction === 'west') shiftImage(0, -step)
    if (direction === 'east') shiftImage(0, step)
  }

  function scaleImageBounds(bounds, { verticalFactor = 1, horizontalFactor = 1 }) {
    const centerLat = (bounds.north + bounds.south) / 2
    const centerLng = (bounds.west + bounds.east) / 2
    const halfLat = (bounds.north - bounds.south) / 2
    const halfLng = (bounds.east - bounds.west) / 2
    return {
      north: centerLat + halfLat * verticalFactor,
      south: centerLat - halfLat * verticalFactor,
      east: centerLng + halfLng * horizontalFactor,
      west: centerLng - halfLng * horizontalFactor
    }
  }

  function applyImageScale(type, direction) {
    const factor = direction === 'in' ? 1 - scaleStep : 1 + scaleStep
    setImageBounds((prev) => {
      if (type === 'uniform') {
        return scaleImageBounds(prev, { verticalFactor: factor, horizontalFactor: factor })
      }
      if (type === 'vertical') {
        return scaleImageBounds(prev, { verticalFactor: factor })
      }
      if (type === 'horizontal') {
        return scaleImageBounds(prev, { horizontalFactor: factor })
      }
      return prev
    })
    const verb = direction === 'in' ? 'achicada' : 'agrandada'
    const parte =
      type === 'uniform' ? 'en todo' : type === 'vertical' ? 'en altura' : 'en ancho'
    setStatus(`Imagen ${verb} ${parte} (${Math.round(scaleStep * 100)}%).`)
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(`${label} copiado al portapapeles.`)
    } catch {
      setCopyMessage(`No se pudo copiar ${label}. Selecciona el texto manualmente.`)
    }
    setTimeout(() => setCopyMessage(''), 3500)
  }

  function downloadGeoJson() {
    const blob = new Blob([outputText], { type: 'application/geo+json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sectores_monte_patria_provisorio.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }

  function centerOnImage() {
    if (!mapRef.current || typeof window === 'undefined') return
    const bounds = window.L.latLngBounds(
      [imageBounds.south, imageBounds.west],
      [imageBounds.north, imageBounds.east]
    )
    mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 11 })
  }

  function centerOnGeoJson() {
    const bounds = drawLayerRef.current?.getBounds?.()
    if (bounds && bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.08), { padding: [16, 16], maxZoom: 11 })
    }
  }

  return (
    <main className="map-editor-page">
      <section className="map-editor-map-panel">
        <div className="map-editor-warning">
          Herramienta interna para georreferenciar visualmente la imagen municipal y ajustar polígonos referenciales.
          No corresponde a límites oficiales.
        </div>
        {imageMoveMode && overlayImageUrl ? (
          <div className="map-editor-move-hint">Modo mover imagen: arrastra sobre el mapa</div>
        ) : null}
        <div ref={mapElRef} className={`map-editor-map${imageMoveMode ? ' map-editor-map--move' : ''}`} />
      </section>

      <aside className="map-editor-sidebar">
        <header>
          <p className="map-editor-eyebrow">Herramienta interna</p>
          <h1>Editor de mapa territorial</h1>
          <p className="map-editor-status">{status}</p>
          {copyMessage ? <p className="map-editor-copy-msg">{copyMessage}</p> : null}
        </header>

        <section className="map-editor-card">
          <h2>Uso</h2>
          <ol>
            <li>Sube una imagen (PNG/JPG) o carga la municipal por defecto.</li>
            <li>Baja la transparencia para calcar la imagen sobre el mapa base.</li>
            <li>Activa <strong>Mover imagen</strong> y arrastra, o usa las flechas para desplazarla.</li>
            <li>Usa <strong>Tamaño de imagen</strong> para achicar o agrandar (alto/ancho) hasta calzar sectores.</li>
            <li>Ajusta los bounds hasta calzar la imagen con el territorio real.</li>
            <li>Edita los polígonos con la barra de dibujo de Leaflet.</li>
            <li>Selecciona un sector antes de dibujar un polígono nuevo.</li>
            <li>Copia o descarga el GeoJSON final y reemplaza el archivo provisorio.</li>
          </ol>
        </section>

        <section className="map-editor-card">
          <h2>Sectores</h2>
          <label className="map-editor-field">
            Sector para nuevo polígono
            <select value={selectedSectorSlug} onChange={(e) => setSelectedSectorSlug(e.target.value)}>
              {SECTOR_META.map((sector) => (
                <option key={sector.slug} value={sector.slug}>
                  {sector.nombre_sector}
                </option>
              ))}
            </select>
          </label>
          <div className="map-editor-sector-list">
            {SECTOR_META.map((sector) => (
              <span key={sector.slug}>
                <i style={{ background: sector.color }} />
                {sector.nombre_sector}
              </span>
            ))}
          </div>
        </section>

        <section className="map-editor-card">
          <h2>Imagen de referencia (calcar)</h2>
          <p className="map-editor-card-hint">
            Sube la imagen municipal y regula la transparencia para ver el mapa base debajo mientras ajustas polígonos.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="map-editor-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setCustomOverlayFromFile(file)
            }}
          />
          <div className="map-editor-actions map-editor-actions--tight">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Subir imagen
            </button>
            <button type="button" onClick={loadDefaultMunicipalImage}>
              Imagen municipal
            </button>
            <button type="button" onClick={clearOverlayImage}>
              Quitar imagen
            </button>
          </div>
          {overlayImageName ? (
            <p className="map-editor-image-name">
              Activa: <strong>{overlayImageName}</strong>
            </p>
          ) : (
            <p className="map-editor-image-name map-editor-image-name--muted">
              Sin imagen cargada
            </p>
          )}
          <label className="map-editor-field">
            Transparencia para calcar: {Math.round(imageOpacity * 100)}%
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={imageOpacity}
              onChange={(e) => setImageOpacity(Number(e.target.value))}
            />
          </label>
          <div className="map-editor-opacity-presets">
            <span>Presets:</span>
            {[
              { label: 'Muy transparente', value: 0.22 },
              { label: 'Calcar', value: 0.38 },
              { label: 'Media', value: 0.55 },
              { label: 'Visible', value: 0.78 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={Math.abs(imageOpacity - preset.value) < 0.02 ? 'is-active' : ''}
                onClick={() => setImageOpacity(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="map-editor-move-block">
            <div className="map-editor-move-head">
              <h3>Mover imagen</h3>
              <label className="map-editor-move-toggle">
                <input
                  type="checkbox"
                  checked={imageMoveMode}
                  disabled={!overlayImageUrl}
                  onChange={(e) => setImageMoveMode(e.target.checked)}
                />
                Modo arrastrar
              </label>
            </div>
            <p className="map-editor-card-hint">
              Con el modo activo, haz clic y arrastra sobre el mapa. También puedes usar las flechas.
            </p>
            <label className="map-editor-field">
              Paso de movimiento
              <select value={moveStep} onChange={(e) => setMoveStep(Number(e.target.value))}>
                <option value={0.005}>Fino (0.005°)</option>
                <option value={0.02}>Medio (0.02°)</option>
                <option value={0.05}>Grueso (0.05°)</option>
              </select>
            </label>
            <div className="map-editor-move-pad" aria-label="Mover imagen con flechas">
              <button type="button" disabled={!overlayImageUrl} onClick={() => nudgeImage('north')} title="Mover al norte">
                ↑
              </button>
              <div className="map-editor-move-pad__middle">
                <button type="button" disabled={!overlayImageUrl} onClick={() => nudgeImage('west')} title="Mover al oeste">
                  ←
                </button>
                <span className="map-editor-move-pad__center">Mover</span>
                <button type="button" disabled={!overlayImageUrl} onClick={() => nudgeImage('east')} title="Mover al este">
                  →
                </button>
              </div>
              <button type="button" disabled={!overlayImageUrl} onClick={() => nudgeImage('south')} title="Mover al sur">
                ↓
              </button>
            </div>
          </div>
          <div className="map-editor-move-block map-editor-scale-block">
            <div className="map-editor-move-head">
              <h3>Tamaño de imagen</h3>
              <span className="map-editor-scale-size">{imageSizeLabel}</span>
            </div>
            <p className="map-editor-card-hint">
              Si un sector calza pero otro queda desfasado (ej. Monte Patria muy arriba), achica o agranda solo el alto o el ancho.
            </p>
            <label className="map-editor-field">
              Paso de escala
              <select value={scaleStep} onChange={(e) => setScaleStep(Number(e.target.value))}>
                <option value={0.01}>1%</option>
                <option value={0.02}>2%</option>
                <option value={0.05}>5%</option>
              </select>
            </label>
            <div className="map-editor-scale-rows">
              <div className="map-editor-scale-row">
                <span>Todo</span>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('uniform', 'in')}>
                  − Achicar
                </button>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('uniform', 'out')}>
                  + Agrandar
                </button>
              </div>
              <div className="map-editor-scale-row">
                <span>Alto</span>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('vertical', 'in')}>
                  − Achicar alto
                </button>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('vertical', 'out')}>
                  + Agrandar alto
                </button>
              </div>
              <div className="map-editor-scale-row">
                <span>Ancho</span>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('horizontal', 'in')}>
                  − Achicar ancho
                </button>
                <button type="button" disabled={!overlayImageUrl} onClick={() => applyImageScale('horizontal', 'out')}>
                  + Agrandar ancho
                </button>
              </div>
            </div>
          </div>
          <div className="map-editor-grid">
            <label className="map-editor-field">
              Latitud norte
              <input type="number" step="0.001" value={imageBounds.north} onChange={(e) => updateBound('north', e.target.value)} />
            </label>
            <label className="map-editor-field">
              Latitud sur
              <input type="number" step="0.001" value={imageBounds.south} onChange={(e) => updateBound('south', e.target.value)} />
            </label>
            <label className="map-editor-field">
              Longitud oeste
              <input type="number" step="0.001" value={imageBounds.west} onChange={(e) => updateBound('west', e.target.value)} />
            </label>
            <label className="map-editor-field">
              Longitud este
              <input type="number" step="0.001" value={imageBounds.east} onChange={(e) => updateBound('east', e.target.value)} />
            </label>
          </div>
          <div className="map-editor-checks">
            <label>
              <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
              Mostrar imagen
            </label>
            <label>
              <input type="checkbox" checked={showPolygons} onChange={(e) => setShowPolygons(e.target.checked)} />
              Mostrar polígonos
            </label>
          </div>
          <textarea className="map-editor-small-output" value={boundsText} readOnly />
          <div className="map-editor-actions">
            <button type="button" onClick={() => copyText(boundsText, 'Bounds')}>Copiar bounds</button>
            <button type="button" onClick={() => setImageBounds(DEFAULT_IMAGE_BOUNDS)}>Reset bounds</button>
            <button type="button" onClick={centerOnImage}>Centrar en imagen</button>
            <button type="button" onClick={centerOnGeoJson}>Centrar en GeoJSON</button>
          </div>
        </section>

        <section className="map-editor-card map-editor-output-card">
          <h2>GeoJSON generado</h2>
          <p>Listo para reemplazar <code>public/geo/sectores_monte_patria_provisorio.geojson</code>.</p>
          <textarea className="map-editor-output" value={outputText} readOnly />
          <div className="map-editor-actions">
            <button type="button" onClick={() => copyText(outputText, 'GeoJSON')}>Copiar GeoJSON actual</button>
            <button type="button" onClick={downloadGeoJson}>Descargar GeoJSON</button>
          </div>
        </section>
      </aside>
    </main>
  )
}
