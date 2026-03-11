/**
 * ============================================================================
 * COMPONENTE: KpiCard
 * ============================================================================
 * Tarjeta de KPI con estilo claro y profesional (acento teal/color).
 */

export default function KpiCard({ 
  title, 
  value, 
  icon = '📊', 
  color = '#0d9488',
  loading = false 
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A'
    if (typeof val === 'number') return val.toLocaleString('es-CL')
    return val
  }

  return (
    <div
      className="kpi-card"
      style={{
        background: '#ffffff',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        cursor: 'default'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.75rem'
      }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <h3 style={{
          fontSize: '0.8125rem',
          fontWeight: '500',
          color: '#64748b',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          {title}
        </h3>
      </div>
      <div style={{
        fontSize: '1.75rem',
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: '1.2',
        letterSpacing: '-0.02em'
      }}>
        {loading ? (
          <span style={{ color: '#94a3b8', fontWeight: '500' }}>Cargando...</span>
        ) : (
          formatValue(value)
        )}
      </div>
      <div style={{
        marginTop: '1rem',
        height: '3px',
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        borderRadius: '2px',
        width: '40%'
      }} />
    </div>
  )
}
