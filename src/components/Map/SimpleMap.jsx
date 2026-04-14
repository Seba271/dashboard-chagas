/**
 * ============================================================================
 * COMPONENTE: SimpleMap
 * ============================================================================
 * 
 * Mapa con capa de calor (heatmap) para mostrar densidad de puntos en Monte Patria.
 * Las zonas con más puntos cercanos muestran un color más intenso.
 */

'use client'

import { useEffect, useRef, useState } from 'react'

export default function SimpleMap({ points = [], loading = false }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const heatLayerRef = useRef(null)
  const markersRef = useRef([])
  const initialViewRef = useRef({ center: [-30.6944, -70.9500], zoom: 11 }) // Monte Patria
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

  // Efecto para inicializar el mapa solo una vez
  useEffect(() => {
    if (!mounted) return
    if (mapInstanceRef.current) return

    const initMap = () => {
      if (!mapRef.current) {
        setTimeout(initMap, 100)
        return
      }

      Promise.all([
        import('leaflet'),
        import('leaflet/dist/leaflet.css')
      ]).then(([leafletModule]) => {
        const L = leafletModule.default
        // leaflet.heat espera L global; lo exponemos temporalmente
        if (typeof window !== 'undefined') {
          window.L = L
        }
        return import('leaflet.heat').then(() => L)
      }).then((L) => {
        // Fix para íconos (por si se usan marcadores en el futuro)
        if (L.Icon && L.Icon.Default) {
          delete L.Icon.Default.prototype._getIconUrl
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          })
        }

        if (!mapRef.current) {
          setError('Contenedor del mapa no disponible')
          return
        }

        const center = [-30.6944, -70.9500] // Monte Patria
        const zoom = 11

        try {
          const map = L.map(mapRef.current, {
            center: center,
            zoom: zoom,
            scrollWheelZoom: true
          })

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(map)

          mapInstanceRef.current = map
          setMapReady(true)
        } catch (err) {
          console.error('SimpleMap: Error al inicializar el mapa:', err)
          setError(err.message || 'Error al inicializar el mapa')
        }
      }).catch((err) => {
        console.error('SimpleMap: Error al cargar Leaflet:', err)
        setError(err.message || 'Error al cargar Leaflet')
      })
    }

    const timer = setTimeout(initMap, 200)

    return () => {
      clearTimeout(timer)
      markersRef.current.forEach(m => {
        if (m && mapInstanceRef.current) {
          try { mapInstanceRef.current.removeLayer(m) } catch (e) {}
        }
      })
      markersRef.current = []
      if (heatLayerRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(heatLayerRef.current)
        } catch (e) {}
        heatLayerRef.current = null
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {}
        mapInstanceRef.current = null
        setMapReady(false)
      }
    }
  }, [mounted])

  // Efecto para actualizar la capa de calor cuando cambian los puntos
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return

    // Siempre quitar capas anteriores primero (si loading === true antes no se limpiaba y el heat quedaba de otro filtro/año).
    markersRef.current.forEach(m => {
      if (m && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeLayer(m) } catch (e) {}
      }
    })
    markersRef.current = []
    if (heatLayerRef.current && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.removeLayer(heatLayerRef.current)
      } catch (e) {}
      heatLayerRef.current = null
    }

    if (loading) return

    if (points && points.length > 0) {
      Promise.all([import('leaflet')]).then(([leafletModule]) => {
        const L = leafletModule.default
        if (typeof window !== 'undefined' && !window.L) {
          window.L = L
        }
        return import('leaflet.heat').then(() => ({ L, map: mapInstanceRef.current }))
      }).then(({ L, map }) => {
        if (!map || !L.heatLayer) return

        const validPoints = points.filter(p => p && p.lat != null && p.lng != null)
        if (validPoints.length === 0) return

        // 1. Capa de calor (de fondo)
        // Usamos radio grande y opacidad mayor para resaltar zonas con puntos cercanos.
        const heatData = validPoints.map(p => [p.lat, p.lng, 1])
        const heat = L.heatLayer(heatData, {
          radius: 45,
          blur: 25,
          maxZoom: 17,
          minOpacity: 0.55,
          max: 1,
          gradient: {
            0.0: '#22c55e',   // verde suave
            0.4: '#eab308',   // amarillo
            0.7: '#f97316',   // naranjo
            1.0: '#b91c1c'    // rojo intenso
          }
        })
        heat.addTo(map)
        heatLayerRef.current = heat

        // 2. Puntos = ubicación de cada caso (encima del heatmap). Casos del mes actual = rojo.
        validPoints.forEach((point) => {
          const isNewCase = point.isNewCase === true
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: 5,
            color: isNewCase ? '#b91c1c' : '#0f172a',
            fillColor: isNewCase ? '#dc2626' : '#ffffff',
            fillOpacity: 0.85,
            weight: isNewCase ? 2 : 1.5
          })
          marker.addTo(map)
          // Al hacer clic en el punto, hacer zoom a la zona
          marker.on('click', () => {
            map.flyTo([point.lat, point.lng], 15, { duration: 0.5 })
          })
          marker.on('mouseover', function () {
            this.setStyle({ weight: 3 })
            map.getContainer().style.cursor = 'pointer'
          })
          marker.on('mouseout', function () {
            this.setStyle({ weight: 2 })
            map.getContainer().style.cursor = ''
          })
          if (marker.bringToFront) {
            marker.bringToFront()
          }
          markersRef.current.push(marker)
        })
      }).catch((err) => console.error('SimpleMap: Error al crear heatmap:', err))
    }
  }, [points, loading, mapReady])

  if (!mounted) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '420px',
        background: '#f8fafc',
        borderRadius: '0.75rem',
        color: '#64748b',
        border: '1px solid #e2e8f0'
      }}>
        Inicializando mapa...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '420px',
        background: '#fef2f2',
        borderRadius: '0.75rem',
        color: '#dc2626',
        padding: '1.5rem',
        textAlign: 'center',
        gap: '0.75rem',
        border: '1px solid #fecaca'
      }}>
        <p style={{ fontWeight: '600' }}>Error al cargar el mapa</p>
        <p style={{ fontSize: '0.875rem' }}>{error}</p>
        <button
          onClick={() => {
            setError(null)
            setMapReady(false)
            if (mapInstanceRef.current) {
              try { mapInstanceRef.current.remove() } catch (e) {}
              mapInstanceRef.current = null
            }
            window.location.reload()
          }}
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
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '420px',
        background: '#f8fafc',
        borderRadius: '0.75rem',
        color: '#64748b',
        border: '1px solid #e2e8f0'
      }}>
        Cargando datos del mapa...
      </div>
    )
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          ref={mapRef}
          style={{
            height: '420px',
            width: '100%',
            display: 'block',
            position: 'relative',
            zIndex: 0
          }}
        />
        {mapReady && (
          <>
            <div
              title="Leyenda"
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '10px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                fontSize: '12px',
                color: '#334155'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#dc2626',
                    border: '2px solid #b91c1c',
                    flexShrink: 0
                  }}
                />
                <span>Casos de este mes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: '2px solid #0f172a',
                    flexShrink: 0
                  }}
                />
                <span>Resto de casos</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Vista general"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              padding: 0,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0fdfa'
              e.currentTarget.style.borderColor = '#0d9488'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#e2e8f0'
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
      <p style={{
        margin: 0,
        padding: '0.5rem 1rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: '#64748b',
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        {loading ? 'Cargando puntos...' : points?.length > 0
          ? `Cada punto = ubicación de un caso · ${points.length} ${points.length === 1 ? 'punto' : 'puntos'}`
          : 'Esperando datos...'}
      </p>
    </div>
  )
}
