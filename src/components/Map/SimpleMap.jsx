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
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

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
    if (!mapInstanceRef.current || !mapReady || loading) return

    // Remover capa de calor y puntos anteriores
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
        const heatData = validPoints.map(p => [p.lat, p.lng, 1])
        const heat = L.heatLayer(heatData, {
          radius: 25,
          blur: 20,
          maxZoom: 17,
          minOpacity: 0.3,
          max: 1,
          gradient: {
            0.0: '#667eea',
            0.3: '#8b9aff',
            0.5: '#10b981',
            0.7: '#f59e0b',
            1.0: '#ef4444'
          }
        })
        heat.addTo(map)
        heatLayerRef.current = heat

        // 2. Puntos = ubicación de cada caso (encima del heatmap)
        validPoints.forEach((point) => {
          const marker = L.circleMarker([point.lat, point.lng], {
            radius: 6,
            color: '#0f172a',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
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
        height: '500px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        color: 'rgba(255, 255, 255, 0.5)'
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
        height: '500px',
        background: 'rgba(239, 68, 68, 0.2)',
        borderRadius: '1rem',
        color: 'rgba(255, 255, 255, 0.9)',
        padding: '2rem',
        textAlign: 'center',
        gap: '1rem'
      }}>
        <p style={{ fontWeight: 'bold' }}>Error al cargar el mapa</p>
        <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>{error}</p>
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
            backgroundColor: '#667eea',
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
        height: '500px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        Cargando datos del mapa...
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '1rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      overflow: 'hidden'
    }}>
      <h3 style={{
        color: '#ffffff',
        fontSize: '1.25rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        textAlign: 'center'
      }}>
        Mapa de Calor - Monte Patria
      </h3>
      
      <p style={{
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        marginBottom: '1rem'
      }}>
        Cada punto = ubicación de un caso. El color del calor indica zonas con más casos cercanos.
      </p>
      
      <div
        ref={mapRef}
        style={{
          height: '500px',
          width: '100%',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 0
        }}
      />
      
      <p style={{
        marginTop: '1rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        {loading ? (
          'Cargando puntos...'
        ) : points && points.length > 0 ? (
          `${points.length} ${points.length === 1 ? 'punto' : 'puntos'} en el mapa de calor`
        ) : (
          'Esperando datos...'
        )}
        {!mapReady && ' (Inicializando mapa...)'}
      </p>
    </div>
  )
}
