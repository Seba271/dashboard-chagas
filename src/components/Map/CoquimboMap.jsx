/**
 * ============================================================================
 * COMPONENTE: CoquimboMap
 * ============================================================================
 * 
 * Mapa interactivo de la Región de Coquimbo usando Leaflet.
 * Muestra puntos geográficos anonimizados con categorías.
 * 
 * PROPS:
 * - markers: Array<{lat: number, lng: number, comuna: string, provincia: string, category: string}>
 * - loading?: boolean - Mostrar estado de carga (opcional)
 */

'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Importar CSS de Leaflet solo en el cliente
if (typeof window !== 'undefined') {
  require('leaflet/dist/leaflet.css')
}

// Fix para íconos de Leaflet en Next.js
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Colores por categoría
const categoryColors = {
  agudo: '#ef4444',        // Rojo
  gestante: '#ec4899',     // Rosa
  bajo_control: '#10b981', // Verde
  persona: '#667eea'       // Azul
}

// Función para crear ícono personalizado por categoría
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

// Componente para centrar el mapa (solo se renderiza dentro de MapContainer)
function MapCenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (map && center && Array.isArray(center) && center.length === 2 && zoom) {
      try {
        map.setView(center, zoom)
      } catch (error) {
        console.error('Error al centrar el mapa:', error)
      }
    }
  }, [map, center, zoom])
  return null
}

export default function CoquimboMap({ 
  markers = [], 
  loading = false 
}) {
  // Coordenadas del centro de Coquimbo/La Serena
  const center = [-29.9027, -71.2519]
  const zoom = 9

  // Traducir categorías al español
  const getCategoryLabel = (category) => {
    const labels = {
      agudo: 'Caso Agudo',
      gestante: 'Gestante',
      bajo_control: 'Bajo Control',
      persona: 'Persona'
    }
    return labels[category] || category
  }

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

  if (markers.length === 0) {
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
        marginBottom: '1rem'
      }}>
        <h3 style={{
          color: '#ffffff',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          margin: 0
        }}>
          Mapa de la Región de Coquimbo
        </h3>
        
        {/* Leyenda de categorías */}
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
        overflow: 'hidden'
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
          
          {markers.map((marker, index) => (
            <Marker
              key={index}
              position={[marker.lat, marker.lng]}
              icon={createCategoryIcon(marker.category)}
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
                    Categoría: {getCategoryLabel(marker.category)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
