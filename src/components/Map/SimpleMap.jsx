'use client'

import { useEffect, useRef, useState } from 'react'
import { ESTADO_OPTIONS, ESTADO_COLOR, GENERO_LABEL, ESTADO_LABEL } from '@/lib/caseEnums'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'
import { sectorOptionLabel } from '@/lib/sectorDisplay'

const SECTOR_GEOJSON_URL = '/geo/sectores_monte_patria_provisorio.geojson'

/** Posición manual del marcador blanco cuando el centroide automático no coincide con el sector. */
const SECTOR_MARKER_OVERRIDES = {
  caren: { lat: -30.849466450756175, lng: -70.77064336332236 }
}

/** Semáforo en el mapa: tratado en gris para no competir con la capa territorial (azules). */
const MAP_ESTADO_COLOR = {
  ...ESTADO_COLOR,
  tratado: '#737373'
}

/**
 * Mapa territorial epidemiológico.
 *
 *  Capa 1 — Polígonos por sector
 *    GeoJSON local provisorio con límites territoriales referenciales.
 *    El archivo vive en /public/geo y queda preparado para reemplazarse
 *    por el archivo geográfico municipal oficial cuando llegue.
 *
 *  Capa 2 — Marcadores por sector
 *    Un círculo en un punto interior del polígono (o centroide del catálogo como fallback).
 *    Al hacer clic se abre el desglose al costado fuera del mapa.
 *
 *  Props:
 *    sectors: Array<{ id_sector, nombre_sector, comuna, latitud_centroide, longitud_centroide }>
 *    cases:   Array<{ ..., ocupacion_nombre, ocupacion_label?, ... }>
 *    loading: boolean
 */
function sortCasosStable(arr) {
  return [...(arr || [])].sort((a, b) => (Number(a.id_caso) || 0) - (Number(b.id_caso) || 0))
}

function formatCaseDateLabelPlain(iso) {
  if (iso == null || iso === '') return '—'
  const slice = typeof iso === 'string' ? iso.slice(0, 10) : ''
  if (!slice) return '—'
  try {
    return new Date(`${slice}T12:00:00`).toLocaleDateString('es-CL')
  } catch {
    return slice
  }
}

function ChevronTiny() {
  return (
    <svg
      className="map-sector-estado-summary__chev"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CaseDetailCard({ caso, estadoBorderColor }) {
  const codigo = caso.codigo_caso || (caso.id_caso != null ? `Caso #${caso.id_caso}` : 'Caso')
  const estadoTxt = ESTADO_LABEL[caso.estado_actual] || caso.estado_actual || '—'
  const gen = GENERO_LABEL[caso.genero] || caso.genero || '—'
  const edad = ageCompletedAtReference(caso.fecha_nacimiento, caso.fecha_registro)
  const edadTxt = edad != null ? `${edad} años` : '—'
  const fnac = formatCaseDateLabelPlain(caso.fecha_nacimiento)
  const freg = formatCaseDateLabelPlain(caso.fecha_registro)
  const ocupRaw = caso.ocupacion_label ?? caso.ocupacion_nombre ?? 'Sin ocupación'
  const ocup = ocupRaw != null && ocupRaw !== '' ? String(ocupRaw) : '—'
  const nc = Number(caso.numero_contactos)
  const contactos = Number.isFinite(nc) ? String(nc) : '—'

  const field = (label, value) => (
    <div className="map-sector-case-field">
      <div className="map-sector-case-field-label">{label}</div>
      <div className="map-sector-case-field-value">{value}</div>
    </div>
  )

  return (
    <article
      className="map-sector-case-card"
      style={{
        borderLeft: `4px solid ${estadoBorderColor}`
      }}
    >
      <div className="map-sector-case-heading">{codigo}</div>
      <div className="map-sector-case-field-grid">
        {field('Estado', estadoTxt)}
        {field('Género', gen)}
        {field('Edad al registro', edadTxt)}
        {field('Fecha de nacimiento', fnac)}
        {field('Fecha de registro', freg)}
        {field('Ocupación', ocup)}
        {field('Contactos directos', contactos)}
      </div>
    </article>
  )
}

function SectorBreakdownAside({ sector, casosPorEstado, otrosCasos, total, onClose }) {
  const titulo =
    sectorOptionLabel({
      nombre_sector: sector.nombre_sector,
      comuna: sector.comuna,
      id_sector: sector.id_sector
    }) || `Sector ${sector.id_sector}`

  return (
    <aside className="map-sector-breakdown-aside" aria-label="Desglose del sector seleccionado">
      <header className="map-sector-breakdown-aside-header">
        <div style={{ minWidth: 0 }}>
          <h3 className="map-sector-breakdown-title">{titulo}</h3>
          <p className="map-sector-breakdown-sub">
            {total === 1 ? '1 caso' : `${total} casos`} con el filtro actual
          </p>
        </div>
        <button type="button" className="map-sector-breakdown-close" onClick={onClose} aria-label="Cerrar panel">
          <span aria-hidden style={{ transform: 'translateY(-1px)', display: 'block' }}>
            ✕
          </span>
        </button>
      </header>
      <div className="map-sector-breakdown-aside-inner">
        <details open className="map-sector-breakdown map-sector-breakdown-root-details">
          <summary>Desglose por estado</summary>
          <div className="map-sector-estados-stack">
            {ESTADO_OPTIONS.map((o) => {
              const col = MAP_ESTADO_COLOR[o.value] || '#64748b'
              const lista = sortCasosStable(casosPorEstado[o.value] || [])
              const n = lista.length

              return (
                <details key={o.value} className="map-sector-estado">
                  <summary className="map-sector-estado-summary">
                    <span className="map-sector-estado-summary__left">
                      <span
                        className="map-sector-estado-summary__dot"
                        style={{
                          background: col
                        }}
                      />
                      {o.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="map-sector-count-pill">{n}</span>
                      <ChevronTiny />
                    </span>
                  </summary>
                  <div className="map-sector-detail-body">
                    {n > 0 ? (
                      <div className="map-sector-case-scroll">
                        {lista.map((c, idx) => (
                          <CaseDetailCard
                            key={`${c.id_caso ?? c.codigo_caso ?? idx}`}
                            caso={c}
                            estadoBorderColor={col}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="map-sector-estado-muted">Sin casos en este estado.</div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
          {otrosCasos.length > 0 && (
            <details className="map-sector-otros-block">
              <summary className="map-sector-estado-summary">
                <span className="map-sector-estado-summary__left">
                  <span
                    className="map-sector-estado-summary__dot"
                    style={{ background: '#a8a29e', borderColor: '#d6d3d1' }}
                  />
                  Otros estados
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="map-sector-count-pill map-sector-count-pill--amber">{otrosCasos.length}</span>
                  <ChevronTiny />
                </span>
              </summary>
              <div className="map-sector-detail-body map-sector-detail-body--otros">
                <div className="map-sector-case-scroll">
                  {sortCasosStable(otrosCasos).map((c, idx) => (
                    <CaseDetailCard
                      key={`otros-${c.id_caso ?? c.codigo_caso ?? idx}`}
                      caso={c}
                      estadoBorderColor="#a8a29e"
                    />
                  ))}
                </div>
              </div>
            </details>
          )}
        </details>
      </div>
    </aside>
  )
}

export default function SimpleMap({ sectors = [], cases = [], loading = false }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef({ polygons: null, markers: [], hull: null })
  const initialViewRef = useRef({ center: [-30.85, -70.85], zoom: 10 })
  const initialFitDoneRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [sectorGeoJson, setSectorGeoJson] = useState(null)
  const [geoJsonError, setGeoJsonError] = useState(null)
  const [sectorBreakdown, setSectorBreakdown] = useState(null)

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady) return
    const id = requestAnimationFrame(() => {
      try {
        map.invalidateSize({ animate: false })
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [sectorBreakdown, mapReady])

  useEffect(() => {
    if (!sectorBreakdown) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setSectorBreakdown(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sectorBreakdown])

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
    if (!mounted) return undefined
    let cancelled = false

    fetch(SECTOR_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar ${SECTOR_GEOJSON_URL}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setSectorGeoJson(json)
        setGeoJsonError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('SimpleMap: Error al cargar GeoJSON territorial:', err)
        setSectorGeoJson(null)
        setGeoJsonError(err.message || 'Error al cargar límites territoriales')
      })

    return () => {
      cancelled = true
    }
  }, [mounted])

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
    if (loading && !layersRef.current.polygons) return
    if (!sectorGeoJson) return

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

        const openBreakdownForSector = (secRow, opts = {}) => {
          const { desdeCentroid = false } = opts
          const sectorCasesInner = casesBySector.get(secRow.id_sector) || []
          const cp = { nuevo: [], reingreso: [], tratado: [] }
          const otros = []
          for (const c of sectorCasesInner) {
            const st = c.estado_actual
            if (st != null && Object.prototype.hasOwnProperty.call(cp, st)) cp[st].push(c)
            else otros.push(c)
          }
          setSectorBreakdown({
            sector: secRow,
            casosPorEstado: cp,
            otrosCasos: otros,
            total: sectorCasesInner.length,
            desdeCentroid
          })
        }
        const sectorsByKey = new Map()
        validSectors.forEach((sec) => {
          const keys = [
            sec.id_sector,
            sec.nombre_sector,
            makeSectorSlug(sec.nombre_sector)
          ].filter((v) => v != null && v !== '')
          keys.forEach((key) => sectorsByKey.set(normalizeSectorKey(key), sec))
        })

        const geoFeatures = (sectorGeoJson?.features || [])
          .map((feature) => {
            const p = feature.properties || {}
            const sectorRow =
              sectorsByKey.get(normalizeSectorKey(p.slug)) ||
              sectorsByKey.get(normalizeSectorKey(p.nombre_sector)) ||
              sectorsByKey.get(normalizeSectorKey(p.id))
            if (!sectorRow) return null
            const count = casesBySector.get(sectorRow.id_sector)?.length || 0
            return {
              ...feature,
              properties: {
                ...p,
                id_sector: sectorRow.id_sector,
                nombre_sector: sectorRow.nombre_sector || p.nombre_sector,
                comuna: sectorRow.comuna,
                centroid: getSectorMarkerPosition(turf, feature, p),
                count
              }
            }
          })
          .filter(Boolean)

        const polygonLayer = L.geoJSON(turf.featureCollection(geoFeatures), {
          pane: 'sectorsPane',
          style: (feature) => {
            const count = feature.properties?.count || 0
            const baseColor = feature.properties?.color || getChoroplethColor(count, maxCount)
            return {
              color: '#ffffff',
              weight: 1.6,
              fillColor: count > 0 ? getChoroplethColor(count, maxCount) : baseColor,
              fillOpacity: count === 0 ? 0.34 : 0.7
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
              }) || p.nombre_sector || 'Sector'
            )
            layer.bindTooltip(
              `<div style="font:600 12px system-ui;color:#0f172a;line-height:1.35">
                ${secTitulo}
                <div style="font:600 12px system-ui;color:#0f172a;margin-top:2px">
                  ${count} ${count === 1 ? 'caso' : 'casos'}
                </div>
                <div style="font:500 10.5px system-ui;color:#92400e;margin-top:3px">
                  Límite referencial
                </div>
              </div>`,
              { sticky: true, direction: 'top', opacity: 0.96 }
            )
            layer.on('mouseover', function () {
              this.setStyle({ weight: 2.6, color: '#0f172a', fillOpacity: 0.82 })
            })
            layer.on('mouseout', function () {
              this.setStyle({ weight: 1.6, color: '#ffffff', fillOpacity: count === 0 ? 0.34 : 0.7 })
            })
            layer.on('click', (clickEv) => {
              const dom = clickEv.originalEvent
              if (dom) L.DomEvent.stopPropagation(dom)
              const sectorRow = validSectors.find((s) => String(s.id_sector) === String(p.id_sector))
              if (sectorRow) openBreakdownForSector(sectorRow, { desdeCentroid: false })
            })
          }
        }).addTo(map)
        layersRef.current.polygons = polygonLayer

        /* Un marcador por sector (centroide): clic → panel lateral (no popup Leaflet). */
        validSectors.forEach((sec) => {
          const feature = geoFeatures.find((f) => String(f.properties?.id_sector) === String(sec.id_sector))
          const centroid = feature?.properties?.centroid
          const lat = centroid?.lat ?? sec.latitud_centroide
          const lng = centroid?.lng ?? sec.longitud_centroide

          const halo = L.circleMarker([lat, lng], {
            pane: 'casesPane',
            radius: 12,
            color: '#ffffff',
            weight: 3,
            fillColor: '#ffffff',
            fillOpacity: 0,
            opacity: 0.95,
            interactive: false
          }).addTo(map)
          layersRef.current.markers.push(halo)

          const marker = L.circleMarker([lat, lng], {
            pane: 'casesPane',
            radius: 8,
            color: '#0f172a',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2.5,
            bubblingMouseEvents: false
          })

          marker.on('click', (clickEv) => {
            const dom = clickEv.originalEvent
            if (dom) L.DomEvent.stopPropagation(dom)
            openBreakdownForSector(sec, { desdeCentroid: true })
          })
          marker.on('mouseover', function () {
            this.setStyle({ radius: 10, weight: 3 })
            halo.setRadius(14)
            halo.setStyle({ weight: 3.5 })
          })
          marker.on('mouseout', function () {
            this.setStyle({ radius: 8, weight: 2.5 })
            halo.setRadius(12)
            halo.setStyle({ weight: 3 })
          })
          marker.addTo(map)
          layersRef.current.markers.push(marker)
        })

        /* Encuadre automático solo la primera vez; así no salta la vista al refrescar datos. */
        if (!initialFitDoneRef.current) {
          try {
            const bounds = polygonLayer.getBounds?.()
            if (bounds && bounds.isValid()) {
              map.fitBounds(bounds, { animate: false, padding: [30, 30], maxZoom: 12 })
              initialViewRef.current = {
                center: [map.getCenter().lat, map.getCenter().lng],
                zoom: map.getZoom()
              }
              initialFitDoneRef.current = true
            } else if (validSectors.length > 0) {
              const centroidBounds = L.latLngBounds(
                validSectors.map((s) => [s.latitud_centroide, s.longitud_centroide])
              )
              map.fitBounds(centroidBounds, { animate: false, padding: [30, 30], maxZoom: 12 })
              initialFitDoneRef.current = true
            }
          } catch (e) {}
        }
      })
      .catch((err) => console.error('SimpleMap: Error al construir capas:', err))
  }, [sectors, cases, loading, mapReady, sectorGeoJson])

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

  if (geoJsonError && !sectorGeoJson) {
    return (
      <div style={errorBoxStyle}>
        <p style={{ fontWeight: 600 }}>Error al cargar límites territoriales</p>
        <p style={{ fontSize: '0.875rem' }}>{geoJsonError}</p>
      </div>
    )
  }

  const totalSectores = (sectors || []).length
  const totalCasos = (cases || []).length

  return (
    <div
      className="simple-map-shell"
      style={{
        background: '#ffffff',
        overflow: 'hidden'
      }}
    >
      <div className="map-sector-breakdown-layout">
        <div className="map-sector-map-shell">
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
            {mapReady ? (
              <div className="map-stats-overlay">
                <div className="map-stats-overlay__card">
                  {loading ? (
                    <span className="map-stats-loading">Cargando datos del mapa</span>
                  ) : totalSectores > 0 ? (
                    <>
                      <div className="map-stats-chips">
                        <span className="map-stats-chip">
                          <span className="map-stats-chip__n">{totalSectores}</span>
                          <span className="map-stats-chip__label">{totalSectores === 1 ? 'sector' : 'sectores'}</span>
                        </span>
                        <span className="map-stats-chip__divider" aria-hidden />
                        <span className="map-stats-chip">
                          <span className="map-stats-chip__n">{totalCasos}</span>
                          <span className="map-stats-chip__label">
                            {totalCasos === 1 ? 'caso en el filtro' : 'casos en el filtro'}
                          </span>
                        </span>
                      </div>
                      <div className="map-overlay-stats-hint">
                        Clic en el sector coloreado o en el marcador del centro → desglose lateral.
                      </div>
                    </>
                  ) : (
                    <span className="map-stats-overlay__empty-msg">Sin sectores con coordenadas para el mapa</span>
                  )}
                </div>
              </div>
            ) : null}
            {mapReady && (
              <>
                <div className="map-legend-floating" title="Leyenda">
                  <p className="map-legend-floating__heading">Densidad por sector</p>
                  <span className="map-legend-gradient-bar" />
                  <div className="map-legend-scale">
                    <span>0</span>
                    <span>{Math.ceil(((cases?.length ?? 0) / Math.max(1, sectors?.length || 1)) * 0.5)}</span>
                    <span>
                      {(cases?.length ?? 0) > 0
                        ? Math.max(1, Math.ceil((cases?.length ?? 0) / Math.max(1, sectors?.length || 1)))
                        : '—'}
                      +
                    </span>
                  </div>
                  {sectorBreakdown?.desdeCentroid ? (
                    <div className="map-legend-rule">
                      <p className="map-legend-floating__heading map-legend-floating__heading--estado">
                        Estado del caso
                      </p>
                      <div className="map-legend-item">
                        <span className="map-legend-dot" style={{ background: MAP_ESTADO_COLOR.nuevo }} />
                        <span>Nuevo</span>
                      </div>
                      <div className="map-legend-item">
                        <span className="map-legend-dot" style={{ background: MAP_ESTADO_COLOR.reingreso }} />
                        <span>Reingreso</span>
                      </div>
                      <div className="map-legend-item">
                        <span className="map-legend-dot" style={{ background: MAP_ESTADO_COLOR.tratado }} />
                        <span>Tratado</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="map-control-fab"
                  onClick={handleResetZoom}
                  title="Vista general del mapa"
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
        </div>

        {sectorBreakdown ? (
          <SectorBreakdownAside
            sector={sectorBreakdown.sector}
            casosPorEstado={sectorBreakdown.casosPorEstado}
            otrosCasos={sectorBreakdown.otrosCasos}
            total={sectorBreakdown.total}
            onClose={() => setSectorBreakdown(null)}
          />
        ) : null}
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

function normalizeSectorKey(value) {
  if (value == null) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeSectorSlug(value) {
  return normalizeSectorKey(value)
}

function getSectorMarkerPosition(turf, feature, properties) {
  const keys = [properties?.slug, properties?.id, properties?.nombre_sector]
    .filter((v) => v != null && v !== '')
    .map((v) => normalizeSectorKey(v))

  for (const key of keys) {
    const override = SECTOR_MARKER_OVERRIDES[key]
    if (override && Number.isFinite(override.lat) && Number.isFinite(override.lng)) {
      return override
    }
  }

  return getFeatureCentroid(turf, feature)
}

function getFeatureCentroid(turf, feature) {
  try {
    // En polígonos cóncavos el centroide matemático puede quedar fuera (ej. Carén).
    if (typeof turf.pointOnFeature === 'function') {
      const inside = turf.pointOnFeature(feature)
      const insideCoords = inside?.geometry?.coordinates
      if (Array.isArray(insideCoords) && insideCoords.length >= 2) {
        const [lng, lat] = insideCoords
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
      }
    }

    const center = turf.centroid(feature)
    const coords = center?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    if (typeof turf.booleanPointInPolygon === 'function') {
      const insideCentroid = turf.booleanPointInPolygon(turf.point([lng, lat]), feature)
      if (insideCentroid) return { lat, lng }
    } else {
      return { lat, lng }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Escala tipo mapa de calor (amarillo → naranja → rojo): poca densidad clara,
 * máximo intenso. Separada del semáforo de estado clínico.
 */
function getChoroplethColor(count, maxCount) {
  if (count === 0) return '#fefce8'
  const ratio = count / Math.max(1, maxCount)
  if (ratio >= 0.85) return '#991b1b'
  if (ratio >= 0.65) return '#dc2626'
  if (ratio >= 0.45) return '#ea580c'
  if (ratio >= 0.25) return '#fb923c'
  if (ratio >= 0.1) return '#eab308'
  return '#fef08a'
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
