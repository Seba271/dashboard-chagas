/**
 * ============================================================================
 * COMPONENTE: KpiCard
 * ============================================================================
 * 
 * Componente reutilizable para mostrar una tarjeta de KPI.
 * 
 * PROPS:
 * - title: string - Título del KPI
 * - value: number | string - Valor a mostrar
 * - icon?: string - Emoji o ícono (opcional)
 * - color?: string - Color de acento (opcional)
 * - loading?: boolean - Mostrar estado de carga (opcional)
 */

export default function KpiCard({ 
  title, 
  value, 
  icon = '📊', 
  color = '#667eea',
  loading = false 
}) {
  // Formatear números grandes con separadores de miles
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A'
    if (typeof val === 'number') {
      return val.toLocaleString('es-CL')
    }
    return val
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '1rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)'
      e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      {/* Icono y título */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>{icon}</span>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'rgba(255, 255, 255, 0.8)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {title}
        </h3>
      </div>

      {/* Valor */}
      <div style={{
        fontSize: '2rem',
        fontWeight: 'bold',
        color: 'white',
        lineHeight: '1.2'
      }}>
        {loading ? (
          <span style={{ opacity: 0.5 }}>Cargando...</span>
        ) : (
          formatValue(value)
        )}
      </div>

      {/* Barra de acento decorativa */}
      <div style={{
        marginTop: '1rem',
        height: '3px',
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        borderRadius: '2px',
        width: '40%'
      }} />
    </div>
  )
}
