'use client'

/**
 * Skeleton "shimmer" reutilizable para reemplazar textos "Cargando..." y dar
 * feedback visual mientras se cargan datos. La animación está en globals.css
 * (`.skeletonShimmer`) — esta función solo dibuja un bloque del tamaño pedido.
 *
 * Props:
 *   width / height: cualquier valor CSS (px, rem, %).
 *   borderRadius:   default 6px.
 *   block:          si true, ocupa todo el ancho disponible.
 *   style:          override opcional.
 */
export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  block = false,
  style = null,
  ariaLabel = 'Cargando…'
}) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className="skeletonShimmer"
      style={{
        display: block ? 'block' : 'inline-block',
        width,
        height,
        borderRadius,
        ...(style || {})
      }}
    />
  )
}

/** Skeleton específico para el contenedor de un chart (ocupa toda la card). */
export function SkeletonChart({ height = 360, lines = 4 }) {
  return (
    <div
      role="status"
      aria-label="Cargando gráfico"
      aria-busy="true"
      style={{
        width: '100%',
        height,
        position: 'relative',
        overflow: 'hidden',
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #f1f5f9'
      }}
    >
      <div className="skeletonShimmer" style={skeletonOverlayStyle} />
      <div style={{ position: 'absolute', inset: '14% 8% 14% 8%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 6,
              background: 'rgba(148, 163, 184, 0.18)'
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Skeleton para una fila de tabla (n columnas configurables). */
export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr aria-busy="true" aria-label="Cargando fila">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '0.55rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>
          <Skeleton block height="0.85rem" width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

const skeletonOverlayStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: 0.55
}
