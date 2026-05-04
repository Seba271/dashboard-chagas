'use client'

import { useEffect, useRef, useState } from 'react'
import { ESTADO_COLOR, ESTADO_LABEL, GENERO_LABEL } from '@/lib/caseEnums'
import { sectorOptionLabel } from '@/lib/sectorDisplay'

/**
 * Mapa territorial epidemiológico.
 *
 *  Capa 1 — Polígonos por sector
 *    Voronoi sobre los centroides de los sectores, recortado a un convex-hull
 *    suavizado (área "real" de cobertura territorial). Coloreado en degradé
 *    secuencial azul epidemiológico (claro → índigo) según número de casos;
 *    estándar en mapas de carga sin semántica de riesgo y complementa el semáforo.
 *
 *  Capa 2 — Puntos individuales por caso
 *    Un círculo por cada caso. Posición aleatoria dentro del polígono del sector
 *    (Voronoi recortado); semilla por id_caso para que no se muevan entre recargas.
 *    Si no hay polígono, punto aleatorio en un disco alrededor del centroide.
 *    Color semáforo por estado.
 *
 *  Props:
 *    sectors: Array<{ id_sector, nombre_sector, comuna, latitud_centroide, longitud_centroide }>
 *    cases:   Array<{ ..., ocupacion, ocupacion_label?, ... }>
 *    loading: boolean
 */
export default function SimpleMap({ sectors = [], cases = [], loading = false }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef({ polygons: null, markers: [], hull: null })
  const initialViewRef = useRef({ center: [-30.85, -70.85], zoom: 10 })
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const handleResetZoom = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const { center, zoom } = initialViewRef.current
    map.flyTo(center, zoom, { duration: 0.5 })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (mapInstanceRef.current) return

    const initMap = () => {
      if (!mapRef.current) {
        setTimeout(initMap, 100)
        return
      }

      Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
        .then(([leafletModule]) => {
          const L = leafletModule.default
          if (typeof window !== 'undefined') window.L = L
          return L
        })
        .then((L) => {
          if (L.Icon && L.Icon.Default) {
            delete L.Icon.Default.prototype._getIconUrl
            L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
              iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
            })
          }

          if (!mapRef.current) {
            setError('Contenedor del mapa no disponible')
            return
          }

          const map = L.map(mapRef.current, {
            center: initialViewRef.current.center,
            zoom: initialViewRef.current.zoom,
            scrollWheelZoom: true,
            zoomControl: true
          })

          /* Panes separados para garantizar que los puntos queden SIEMPRE por encima
             de los polígonos, incluso cuando el polígono se eleva en hover. */
          const sectorsPane = map.createPane('sectorsPane')
          sectorsPane.style.zIndex = 410
          const casesPane = map.createPane('casesPane')
          casesPane.style.zIndex = 460

          /* Tile-layer OSM. */
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(map)

          mapInstanceRef.current = map
          setMapReady(true)
        })
        .catch((err) => {
          console.error('SimpleMap: Error al cargar Leaflet:', err)
          setError(err.message || 'Error al cargar Leaflet')
        })
    }

    const timer = setTimeout(initMap, 200)

    return () => {
      clearTimeout(timer)
      clearLayers()
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {}
        mapInstanceRef.current = null
        setMapReady(false)
      }
    }
  }, [mounted])

  const clearLayers = () => {
    const map = mapInstanceRef.current
    if (!map) return
    if (layersRef.current.polygons) {
      try {
        map.removeLayer(layersRef.current.polygons)
      } catch (e) {}
      layersRef.current.polygons = null
    }
    if (layersRef.current.hull) {
      try {
        map.removeLayer(layersRef.current.hull)
      } catch (e) {}
      layersRef.current.hull = null
    }
    layersRef.current.markers.forEach((m) => {
      try {
        map.removeLayer(m)
      } catch (e) {}
    })
    layersRef.current.markers = []
  }

  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return
    if (loading) return

    clearLayers()

    const validSectors = (sectors || []).filter(
      (s) =>
        typeof s.latitud_centroide === 'number' &&
        typeof s.longitud_centroide === 'number' &&
        !Number.isNaN(s.latitud_centroide) &&
        !Number.isNaN(s.longitud_centroide)
    )
    if (validSectors.length === 0) return

    const casesBySector = new Map()
    for (const c of cases || []) {
      const k = c.id_sector
      if (k == null) continue
      if (!casesBySector.has(k)) casesBySector.set(k, [])
      casesBySector.get(k).push(c)
    }

    const counts = validSectors.map((s) => casesBySector.get(s.id_sector)?.length || 0)
    const maxCount = Math.max(1, ...counts)

    Promise.all([import('leaflet'), import('@turf/turf')])
      .then(([leafletModule, turfModule]) => {
        const L = leafletModule.default
        const turf = turfModule
        const map = mapInstanceRef.current
        if (!map) return

        const points = turf.featureCollection(
          validSectors.map((s) =>
            turf.point([s.longitud_centroide, s.latitud_centroide], { id_sector: s.id_sector })
          )
        )

        /* Convex hull de los centroides + buffer suave → "máscara" orgánica de la zona. */
        let mask = null
        try {
          const hull = validSectors.length >= 3 ? turf.convex(points) : null
          if (hull) {
            mask = turf.buffer(hull, 4, { units: 'kilometers' })
          } else {
            mask = turf.buffer(points.features[0], 6, { units: 'kilometers' })
          }
        } catch (e) {
          mask = null
        }

        /* Bbox amplio para que el Voronoi no salga truncado. */
        const lats = validSectors.map((s) => s.latitud_centroide)
        const lons = validSectors.map((s) => s.longitud_centroide)
        const padLat = (Math.max(...lats) - Math.min(...lats)) * 0.6 || 0.3
        const padLon = (Math.max(...lons) - Math.min(...lons)) * 0.6 || 0.3
        const voronoiBbox = [
          Math.min(...lons) - padLon,
          Math.min(...lats) - padLat,
          Math.max(...lons) + padLon,
          Math.max(...lats) + padLat
        ]

        let voronoi = null
        try {
          voronoi = turf.voronoi(points, { bbox: voronoiBbox })
        } catch (err) {
          console.warn('SimpleMap: voronoi falló, se omiten polígonos:', err)
        }

        const sectorPolygons = new Map()
        if (voronoi && voronoi.features) {
          const clippedFeatures = []
          voronoi.features.forEach((feat, idx) => {
            if (!feat) return
            const sec = validSectors[idx]
            if (!sec) return
            let final = feat
            if (mask) {
              try {
                const inter = turf.intersect(turf.featureCollection([feat, mask]))
                if (inter) final = inter
              } catch (e) {
                /* fallback al feat sin recortar */
              }
            }
            final.properties = {
              id_sector: sec.id_sector,
              nombre_sector: sec.nombre_sector,
              comuna: sec.comuna,
              count: casesBySector.get(sec.id_sector)?.length || 0
            }
            sectorPolygons.set(sec.id_sector, final)
            clippedFeatures.push(final)
          })

          const polygonLayer = L.geoJSON(turf.featureCollection(clippedFeatures), {
            pane: 'sectorsPane',
            style: (feature) => {
              const count = feature.properties?.count || 0
              return {
                color: '#ffffff',
                weight: 1.5,
                fillColor: getChoroplethColor(count, maxCount),
                fillOpacity: count === 0 ? 0.32 : 0.78
              }
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {}
              const count = p.count || 0
              const secTitulo = escapeHtml(
                sectorOptionLabel({
                  nombre_sector: p.nombre_sector,
                  comuna: p.comuna,
                  id_sector: p.id_sector
                }) || 'Sector'
              )
              layer.bindTooltip(
                `<div style="font:600 12px system-ui;color:#0f172a;line-height:1.35">
                  ${secTitulo}
                  <div style="font:600 12px system-ui;color:#0f172a;margin-top:2px">
                    ${count} ${count === 1 ? 'caso' : 'casos'}
                  </div>
                </div>`,
                { sticky: true, direction: 'top', opacity: 0.96 }
              )
              layer.on('mouseover', function () {
                this.setStyle({ weight: 2.5, color: '#0f172a' })
              })
              layer.on('mouseout', function () {
                this.setStyle({ weight: 1.5, color: '#ffffff' })
              })
            }
          }).addTo(map)
          layersRef.current.polygons = polygonLayer
        }

        /* Halo gris muy sutil del contorno general (mejora la composición visual). */
        if (mask) {
          try {
            const hullLayer = L.geoJSON(mask, {
              pane: 'sectorsPane',
              style: {
                color: '#0f172a',
                weight: 1.2,
                opacity: 0.18,
                fill: false,
                dashArray: '2 4'
              },
              interactive: false
            }).addTo(map)
            layersRef.current.hull = hullLayer
          } catch (e) {}
        }

        const caseLatLngById = buildCaseLatLngMap({
          cases: cases || [],
          validSectors,
          casesBySector,
          sectorPolygons,
          turf
        })

        /* Puntos individuales (semáforo por estado), repartidos dentro del sector. */
        ;(cases || []).forEach((c) => {
          if (c.id_sector == null) return
          const sec = validSectors.find((s) => s.id_sector === c.id_sector)
          if (!sec) return

          const idKey = c.id_caso != null ? c.id_caso : null
          const { lat, lng } =
            idKey != null && caseLatLngById.has(idKey)
              ? caseLatLngById.get(idKey)
              : latLngOnSectorCentroid(sec, c.id_caso)

          const color = ESTADO_COLOR[c.estado_actual] || '#64748b'

          /* Halo blanco para destacar sobre los polígonos coloreados. */
          const halo = L.circleMarker([lat, lng], {
            pane: 'casesPane',
            radius: 7,
            color: '#ffffff',
            weight: 2.5,
            fillColor: '#ffffff',
            fillOpacity: 0,
            opacity: 0.95,
            interactive: false
          }).addTo(map)
          layersRef.current.markers.push(halo)

          const marker = L.circleMarker([lat, lng], {
            pane: 'casesPane',
            radius: 5,
            color: '#0f172a',
            fillColor: color,
            fillOpacity: 1,
            weight: 1.2,
            bubblingMouseEvents: false
          })

          const codigoTxt = escapeHtml(c.codigo_caso || `Caso ${c.id_caso}`)
          const sectorTxt = escapeHtml(sec.nombre_sector || c.sector_nombre || '—')
          const estadoTxt = escapeHtml(ESTADO_LABEL[c.estado_actual] || c.estado_actual || '—')
          const edadTxt = c.edad != null ? escapeHtml(String(c.edad)) : '—'
          const generoTxt = escapeHtml(GENERO_LABEL[c.genero] || c.genero || '—')
          const ocupRaw = c.ocupacion_label ?? c.ocupacion
          const ocupTxt = ocupRaw != null && ocupRaw !== '' ? escapeHtml(String(ocupRaw)) : '—'
          const nContactos = Number(c.numero_contactos) || 0
          const detailHtml = `<div style="font:500 12px system-ui;color:#0f172a;line-height:1.45;max-width:280px">
              <div><strong>Código del caso:</strong> ${codigoTxt}</div>
              <div><strong>Sector:</strong> ${sectorTxt}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};border:1px solid rgba(15,23,42,.4)"></span>
                <span><strong>Estado actual:</strong> ${estadoTxt}</span>
              </div>
              <div><strong>Edad:</strong> ${edadTxt}</div>
              <div><strong>Género:</strong> ${generoTxt}</div>
              <div><strong>Ocupación:</strong> ${ocupTxt}</div>
              <div><strong>Cantidad de contactos directos:</strong> ${nContactos}</div>
            </div>`
          marker.bindPopup(detailHtml, { maxWidth: 320, closeButton: true, className: 'mapCasoPopup' })
          marker.on('mouseover', function () {
            this.setStyle({ radius: 8, weight: 2 })
            halo.setRadius(11)
            halo.setStyle({ weight: 3 })
          })
          marker.on('mouseout', function () {
            this.setStyle({ radius: 5, weight: 1.2 })
            halo.setRadius(7)
            halo.setStyle({ weight: 2.5 })
          })
          marker.addTo(map)
          layersRef.current.markers.push(marker)
        })

        /* Encuadre automático al área cubierta. Usamos padding en píxeles
           (independiente del tamaño del bbox) y un maxZoom razonable, así
           cuando los sectores están todos cercanos (ej. Monte Patria) la
           vista no queda demasiado lejana. */
        try {
          if (validSectors.length > 0) {
            const bounds = L.latLngBounds(validSectors.map((s) => [s.latitud_centroide, s.longitud_centroide]))
            map.fitBounds(bounds, { animate: false, padding: [30, 30], maxZoom: 12 })
            initialViewRef.current = {
              center: [map.getCenter().lat, map.getCenter().lng],
              zoom: map.getZoom()
            }
          }
        } catch (e) {}
      })
      .catch((err) => console.error('SimpleMap: Error al construir capas:', err))
  }, [sectors, cases, loading, mapReady])

  if (!mounted) {
    return <div style={emptyBoxStyle}>Inicializando mapa...</div>
  }

  if (error) {
    return (
      <div style={errorBoxStyle}>
        <p style={{ fontWeight: 600 }}>Error al cargar el mapa</p>
        <p style={{ fontSize: '0.875rem' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0d9488',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Recargar página
        </button>
      </div>
    )
  }

  if (loading && !mapReady) {
    return <div style={emptyBoxStyle}>Cargando datos del mapa...</div>
  }

  const totalSectores = (sectors || []).length
  const totalCasos = (cases || []).length

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.05)'
      }}
    >
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          ref={mapRef}
          style={{
            height: '520px',
            width: '100%',
            display: 'block',
            position: 'relative',
            zIndex: 0,
            background: '#f8fafc'
          }}
        />
        {mapReady && (
          <>
            <div title="Leyenda" style={legendStyle}>
              <div style={legendTitle}>Densidad por sector</div>
              <div style={{ marginBottom: 4 }}>
                <span style={gradientBar} />
              </div>
              <div style={legendScaleRow}>
                <span>0</span>
                <span>{Math.ceil(((cases?.length ?? 0) / Math.max(1, sectors?.length || 1)) * 0.5)}</span>
                <span>{(cases?.length ?? 0) > 0 ? Math.max(1, Math.ceil((cases?.length ?? 0) / Math.max(1, sectors?.length || 1))) : '—'}+</span>
              </div>
              <div style={{ ...legendTitle, marginTop: 12 }}>Estado del caso</div>
              <div style={legendItemRow}>
                <span style={{ ...legendDot, background: ESTADO_COLOR.nuevo }} />
                <span>Nuevo</span>
              </div>
              <div style={legendItemRow}>
                <span style={{ ...legendDot, background: ESTADO_COLOR.reingreso }} />
                <span>Reingreso</span>
              </div>
              <div style={legendItemRow}>
                <span style={{ ...legendDot, background: ESTADO_COLOR.tratado }} />
                <span>Tratado</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Vista general"
              style={resetBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0fdfa'
                e.currentTarget.style.borderColor = '#0d9488'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ display: 'block' }}>
                <polygon points="5,5 10,6 6,10" fill="#0d9488" stroke="#0d9488" strokeWidth="0.6" />
                <polygon points="19,5 18,10 14,6" fill="#0d9488" stroke="#0d9488" strokeWidth="0.6" />
                <polygon points="19,19 18,14 14,18" fill="#0d9488" stroke="#0d9488" strokeWidth="0.6" />
                <polygon points="5,19 6,14 10,18" fill="#0d9488" stroke="#0d9488" strokeWidth="0.6" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div style={footerStyle}>
        {loading ? (
          <span>Cargando datos del mapa…</span>
        ) : totalSectores > 0 ? (
          <>
            <span style={footerKpi}>
              <strong>{totalSectores}</strong>{' '}
              {totalSectores === 1 ? 'sector' : 'sectores'}
            </span>
            <span style={footerSep}>·</span>
            <span style={footerKpi}>
              <strong>{totalCasos}</strong> {totalCasos === 1 ? 'caso' : 'casos'} en el filtro
            </span>
            <span style={footerSep}>·</span>
            <span style={{ color: '#94a3b8' }}>posición aleatoria dentro de cada sector (fija por caso) — datos anónimos</span>
          </>
        ) : (
          <span>No hay sectores con coordenadas para mostrar</span>
        )}
      </div>
    </div>
  )
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Mapa id_caso → { lat, lng }: muestra aleatoria dentro del polígono de cada sector.
 */
function buildCaseLatLngMap({ cases, validSectors, casesBySector, sectorPolygons, turf }) {
  const out = new Map()
  const sectorById = new Map(validSectors.map((s) => [s.id_sector, s]))

  for (const sec of validSectors) {
    const list = casesBySector.get(sec.id_sector)
    if (!list?.length) continue
    const sorted = [...list].sort((a, b) => (a.id_caso || 0) - (b.id_caso || 0))
    const poly = sectorPolygons.get(sec.id_sector) || null
    const placed = placeCasesRandomInPolygon({ sorted, sector: sec, polygonFeature: poly, turf })
    for (const [id, ll] of placed) {
      if (id != null) out.set(id, ll)
    }
  }

  /* Casos con sector no listado en validSectors: fallback por caso. */
  for (const c of cases) {
    if (c.id_sector == null || c.id_caso == null) continue
    if (out.has(c.id_caso)) continue
    const sec = sectorById.get(c.id_sector)
    if (!sec) continue
    out.set(c.id_caso, latLngOnSectorCentroid(sec, c.id_caso))
  }

  return out
}

/**
 * Asigna a cada caso una posición aleatoria dentro del polígono del sector (rechazo en bbox).
 * Semilla estable por caso para que el mapa no “tiemble” al refetch.
 */
function placeCasesRandomInPolygon({ sorted, sector, polygonFeature, turf }) {
  const out = new Map()
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]
    const idKey = c.id_caso
    if (idKey == null) continue
    const seed = caseLayoutSeed(sector.id_sector, idKey) ^ (i * 747796405)
    const { lat, lng } = randomLatLngInsideSector({ sector, polygonFeature, turf, seed })
    out.set(idKey, { lat, lng })
  }
  return out
}

function caseLayoutSeed(idSector, idCaso) {
  const a = typeof idCaso === 'number' && !Number.isNaN(idCaso) ? idCaso : String(idCaso).split('').reduce((s, ch) => s + ch.charCodeAt(0), 0)
  const b = Number(idSector) || 0
  return (((a * 2654435761) ^ (b * 1597334677)) >>> 0) || 1
}

/**
 * Un punto aleatorio dentro del polígono (uniforme en bbox + filtro), o disco alrededor del centroide.
 */
function randomLatLngInsideSector({ sector, polygonFeature, turf, seed }) {
  const rand = seededRandom((seed >>> 0) ^ 0x9e3779b9)

  if (polygonFeature && isPolygonFeature(polygonFeature)) {
    try {
      const bbox = turf.bbox(polygonFeature)
      const minX = bbox[0]
      const minY = bbox[1]
      const maxX = bbox[2]
      const maxY = bbox[3]
      const spanX = Math.max(maxX - minX, 1e-10)
      const spanY = Math.max(maxY - minY, 1e-10)

      for (let t = 0; t < 160; t++) {
        const lng = minX + rand() * spanX
        const lat = minY + rand() * spanY
        const pt = turf.point([lng, lat])
        if (booleanPointInPolygonSafe(turf, pt, polygonFeature)) {
          return { lat, lng }
        }
      }

      const c0 = turf.centroid(polygonFeature)
      const [clng, clat] = c0.geometry.coordinates
      return { lat: clat, lng: clng }
    } catch {
      /* continuar a disco */
    }
  }

  return randomInDiskAroundCentroid(sector, turf, rand)
}

function randomInDiskAroundCentroid(sector, turf, rand) {
  const center = turf.point([sector.longitud_centroide, sector.latitud_centroide])
  const distKm = 0.018 + rand() * 0.48
  const bearing = rand() * 360
  const p = turf.destination(center, distKm, bearing, { units: 'kilometers' })
  const [lng, lat] = p.geometry.coordinates
  return { lat, lng }
}

function isPolygonFeature(feat) {
  const g = feat?.geometry?.type
  return g === 'Polygon' || g === 'MultiPolygon'
}

function booleanPointInPolygonSafe(turf, pt, poly) {
  try {
    return Boolean(turf.booleanPointInPolygon(pt, poly))
  } catch {
    return false
  }
}

/** Un solo caso: offset moderado (~55–95 m) para no caer exacto en el centroide. */
function singleCaseJitterLatLng(sector, seed) {
  const rand = seededRandom(((Number(seed) || 1) * 2654435761) >>> 0)
  const r = 0.00048 + rand() * 0.00042
  const angle = rand() * Math.PI * 2
  return {
    lat: sector.latitud_centroide + r * Math.cos(angle),
    lng: sector.longitud_centroide + r * Math.sin(angle)
  }
}

/**
 * Respaldo: centroide con micro-offset (no usado cuando hay mapa precomputado).
 */
function latLngOnSectorCentroid(sector, idCaso) {
  return singleCaseJitterLatLng(sector, idCaso)
}

/**
 * Escala secuencial azul (tipo mapas epidemiológicos / coropléticos): de azul
 * muy claro (0 casos) a índigo profundo (máximo). Separada del semáforo R/A/V.
 */
function getChoroplethColor(count, maxCount) {
  if (count === 0) return '#eff6ff'
  const ratio = count / Math.max(1, maxCount)
  if (ratio >= 0.85) return '#172554'
  if (ratio >= 0.65) return '#1e40af'
  if (ratio >= 0.45) return '#2563eb'
  if (ratio >= 0.25) return '#3b82f6'
  if (ratio >= 0.1) return '#60a5fa'
  return '#93c5fd'
}

/* PRNG determinista (mulberry32). Misma semilla → misma salida. */
function seededRandom(seed) {
  let t = (seed >>> 0) || 1
  return function rand() {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const emptyBoxStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '520px',
  background: '#f8fafc',
  borderRadius: '14px',
  color: '#64748b',
  border: '1px solid #e2e8f0'
}

const errorBoxStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '520px',
  background: '#fef2f2',
  borderRadius: '14px',
  color: '#dc2626',
  padding: '1.5rem',
  textAlign: 'center',
  gap: '0.75rem',
  border: '1px solid #fecaca'
}

const legendStyle = {
  position: 'absolute',
  bottom: '14px',
  left: '14px',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
  fontSize: '11.5px',
  color: '#334155',
  minWidth: 168,
  backdropFilter: 'blur(8px)'
}

const legendTitle = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#64748b',
  marginBottom: 6
}

const gradientBar = {
  display: 'block',
  width: '100%',
  height: 8,
  borderRadius: 4,
  background: 'linear-gradient(90deg, #eff6ff 0%, #93c5fd 22%, #3b82f6 48%, #2563eb 72%, #172554 100%)',
  border: '1px solid #cbd5e1'
}

const legendScaleRow = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 9.5,
  color: '#94a3b8',
  marginTop: 2
}

const legendItemRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11.5,
  color: '#1e293b',
  fontWeight: 500
}

const legendDot = {
  width: 11,
  height: 11,
  borderRadius: '50%',
  border: '2px solid #ffffff',
  boxShadow: '0 0 0 1px rgba(15,23,42,0.25)',
  flexShrink: 0
}

const resetBtnStyle = {
  position: 'absolute',
  top: '14px',
  right: '14px',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '38px',
  height: '38px',
  padding: 0,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '50%',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
  transition: 'all 0.18s ease'
}

const footerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  margin: 0,
  padding: '0.65rem 1rem',
  fontSize: '0.78rem',
  color: '#475569',
  borderTop: '1px solid #e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
}

const footerKpi = {
  color: '#0f172a'
}

const footerSep = {
  color: '#cbd5e1'
}
