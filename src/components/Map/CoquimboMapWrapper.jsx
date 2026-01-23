/**
 * ============================================================================
 * WRAPPER: CoquimboMapWrapper
 * ============================================================================
 * 
 * Wrapper dinámico para CoquimboMap que evita problemas de SSR con Leaflet.
 * Next.js necesita importar Leaflet de forma dinámica porque usa window.
 */

'use client'

import dynamic from 'next/dynamic'

// Importar dinámicamente el componente del mapa (sin SSR)
const CoquimboMap = dynamic(
  () => import('./CoquimboMap'),
  { 
    ssr: false, // Deshabilitar Server-Side Rendering
    loading: () => (
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
)

export default CoquimboMap
