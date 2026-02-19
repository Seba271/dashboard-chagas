/**
 * ============================================================================
 * COMPONENTE: CoquimboMapClient
 * ============================================================================
 * 
 * Versión simplificada del mapa que solo se renderiza en el cliente.
 * Evita problemas con SSR y react-leaflet.
 */

'use client'

import { useEffect, useState } from 'react'

export default function CoquimboMapClient({ markers = [], loading = false }) {
  const [mounted, setMounted] = useState(false)
  const [MapComponents, setMapComponents] = useState(null)

  useEffect(() => {
    setMounted(true)
    
    // Importar solo cuando esté en el cliente
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([leafletModule, LModule]) => {
      const L = LModule.default
      const { MapContainer, TileLayer, Marker, Popup, useMap } = leafletModule
      
      // Fix para íconos de Leaflet
      if (L.Icon && L.Icon.Default) {
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })
      }
      
      // Importar CSS de Leaflet
      import('leaflet/dist/leaflet.css')
      
      // Componente para centrar el mapa
      function MapCenter({ center, zoom }) {
        const map = useMap()
        useEffect(() => {
          if (map && center && Array.isArray(center) && center.length === 2 && typeof zoom === 'number') {
            try {
              map.setView(center, zoom)
            } catch (error) {
              console.error('Error al centrar el mapa:', error)
            }
          }
        }, [map, center, zoom])
        return null
      }

      // Colores por categoría
      const categoryColors = {
        agudo: '#ef4444',
        gestante: '#ec4899',
        bajo_control: '#10b981',
        persona: '#667eea'
      }

      const getCategoryLabel = (category) => {
        const labels = {
          agudo: 'Caso Agudo',
          gestante: 'Gestante',
          bajo_control: 'Bajo Control',
          persona: 'Persona'
        }
        return labels[category] || category
      }

      const createCategoryIcon = (category) => {
        const color = categoryColors[category] || categoryColors.persona
        return L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background-color: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }

      // Componente interno del mapa
      function CoquimboMapInner() {
        const center = [-29.9027, -71.2519]
        const zoom = 9

        if (loading) {
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
              Cargando mapa...
            </div>
          )
        }

        if (!markers || markers.length === 0) {
          return (
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '500px',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              No hay puntos disponibles
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <h3 style={{
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                margin: 0
              }}>
                Mapa de la Región de Coquimbo
              </h3>
              
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                {Object.entries(categoryColors).map(([category, color]) => (
                  <div key={category} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: '1px solid white'
                    }} />
                    <span>{getCategoryLabel(category)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ 
              height: '500px', 
              width: '100%',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenter center={center} zoom={zoom} />
                
                {markers.map((marker, index) => {
                  if (!marker || !marker.lat || !marker.lng) return null
                  
                  return (
                    <Marker
                      key={index}
                      position={[marker.lat, marker.lng]}
                      icon={createCategoryIcon(marker.category || 'persona')}
                    >
                      <Popup>
                        <div style={{ 
                          color: '#1f2937',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          minWidth: '150px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: categoryColors[marker.category] || categoryColors.persona
                            }} />
                            <strong>{marker.comuna || 'Sin comuna'}</strong>
                          </div>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                            Provincia: {marker.provincia || 'Sin provincia'}
                          </p>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                            Categoría: {getCategoryLabel(marker.category || 'persona')}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
          </div>
        )
      }

      setMapComponents({
        Map: CoquimboMapInner
      })
    }).catch((error) => {
      console.error('Error al cargar Leaflet:', error)
      setMapComponents({ error: true })
    })
  }, [])

  // Mostrar loading mientras se carga
  if (!mounted || !MapComponents) {
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
        Cargando mapa...
      </div>
    )
  }

  // Mostrar error si falló la carga
  if (MapComponents.error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '500px',
        background: 'rgba(239, 68, 68, 0.2)',
        borderRadius: '1rem',
        color: 'rgba(255, 255, 255, 0.9)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        Error al cargar el mapa. Por favor, recarga la página.
      </div>
    )
  }

  // Renderizar el mapa
  const { Map } = MapComponents
  return <Map />
}
