'use client'

/**
 * Heatmap-tabla Sector × Estado.
 *
 * Cada fila es un sector; las columnas muestran cuántos casos hay en cada
 * estado (Nuevo / Reingreso / Tratado), más el total y los "pendientes"
 * (nuevo + reingreso). La intensidad del color de cada celda es relativa
 * al máximo de su columna — así se identifica de un vistazo qué sectores
 * concentran más casos sin tratar.
 *
 * Por defecto se muestra el top 5; el resto se despliega con un botón
 * "Ver más".
 *
 * Props:
 *   cases:           Array<{ id_sector, sector_nombre, sector_comuna, estado_actual }>
 *   loading:         boolean
 *   initialVisible:  filas mostradas antes de expandir (default 5)
 */

import { useMemo, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { ESTADO_COLOR, ESTADO_LABEL } from '@/lib/caseEnums'
import Skeleton, { SkeletonTableRow } from '@/src/components/Skeleton'

const COLOR_PENDIENTE = '#dc2626'

export default function SectorEstadoMatrix({ cases = [], loading = false, initialVisible = 5 }) {
  const [orderBy, setOrderBy] = useState('pendientes')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const showAllForPrint = () => {
      flushSync(() => setExpanded(true))
    }
    window.addEventListener('beforeprint', showAllForPrint, true)
    return () => window.removeEventListener('beforeprint', showAllForPrint, true)
  }, [])

  const rows = useMemo(() => {
    const m = new Map()
    for (const c of cases || []) {
      const k = c.id_sector
      if (k == null) continue
      const existing =
        m.get(k) || {
          id_sector: k,
          sector: c.sector_nombre || `Sector ${k}`,
          comuna: c.sector_comuna || '',
          nuevo: 0,
          reingreso: 0,
          tratado: 0,
          total: 0,
          pendientes: 0
        }
      existing.total += 1
      if (c.estado_actual === 'nuevo') existing.nuevo += 1
      else if (c.estado_actual === 'reingreso') existing.reingreso += 1
      else if (c.estado_actual === 'tratado') existing.tratado += 1
      existing.pendientes = existing.nuevo + existing.reingreso
      m.set(k, existing)
    }
    return [...m.values()]
  }, [cases])

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const cmp = (b[orderBy] || 0) - (a[orderBy] || 0)
      if (cmp !== 0) return cmp
      return (a.sector || '').localeCompare(b.sector || '', 'es')
    })
    return arr
  }, [rows, orderBy])

  const hasMore = sorted.length > initialVisible
  const visible = expanded || !hasMore ? sorted : sorted.slice(0, initialVisible)
  const hiddenCount = sorted.length - initialVisible

  const max = useMemo(
    () => ({
      nuevo: Math.max(1, ...visible.map((r) => r.nuevo)),
      reingreso: Math.max(1, ...visible.map((r) => r.reingreso)),
      tratado: Math.max(1, ...visible.map((r) => r.tratado)),
      pendientes: Math.max(1, ...visible.map((r) => r.pendientes)),
      total: Math.max(1, ...visible.map((r) => r.total))
    }),
    [visible]
  )

  const totalCasos = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])

  if (loading) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <div style={toolbarStyle}>
          <Skeleton width="180px" height="0.95rem" />
          <Skeleton width="220px" height="0.75rem" />
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thNameStyle}>
                <Skeleton width="60%" height="0.7rem" />
              </th>
              <th style={thNameStyle}>
                <Skeleton width="60%" height="0.7rem" />
              </th>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} style={thNumStyle}>
                  <Skeleton width="60%" height="0.7rem" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={7} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <div style={emptyStyle}>No hay datos para mostrar la matriz</div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="dashboardChartCard sectorEstadoMatrixWrap">
      <div style={toolbarStyle}>
        <span style={titleStyle}>Sectores × estado</span>
        <span style={metaStyle}>
          {expanded || !hasMore
            ? `${sorted.length} ${sorted.length === 1 ? 'sector' : 'sectores'}`
            : `Top ${visible.length} de ${sorted.length} sectores`}{' '}
          · {totalCasos.toLocaleString('es-CL')} casos
        </span>
      </div>

      <div className="sectorEstadoMatrixScroll" style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thNameStyle}>Sector</th>
              <th style={thNameStyle}>Comuna</th>
              {[
                { key: 'nuevo', label: 'Nuevo', color: ESTADO_COLOR.nuevo },
                { key: 'reingreso', label: 'Reingreso', color: ESTADO_COLOR.reingreso },
                { key: 'tratado', label: 'Tratado', color: ESTADO_COLOR.tratado },
                { key: 'pendientes', label: 'Sin tratar', color: COLOR_PENDIENTE },
                { key: 'total', label: 'Total', color: '#475569' }
              ].map((col) => (
                <th key={col.key} style={thNumStyle}>
                  {/* div en lugar de <button>: Chrome perdía el texto del thead repetido en hojas siguientes */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="sectorEstadoMatrixSortBtn"
                    onClick={() => setOrderBy(col.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setOrderBy(col.key)
                      }
                    }}
                    style={{
                      ...thBtnStyle,
                      color: orderBy === col.key ? col.color : '#475569',
                      fontWeight: orderBy === col.key ? 700 : 600
                    }}
                    aria-sort={orderBy === col.key ? 'descending' : 'none'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: col.color,
                          opacity: orderBy === col.key ? 1 : 0.55
                        }}
                      />
                      {col.label}
                      <span
                        className="sectorEstadoMatrixSortGlyph"
                        style={{ fontSize: '0.75rem', opacity: orderBy === col.key ? 1 : 0.35 }}
                        aria-hidden
                      >
                        {orderBy === col.key ? '↓' : '↕'}
                      </span>
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, idx) => (
              <tr
                key={r.id_sector}
                style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}
              >
                <td style={tdNameStyle}>{r.sector || '—'}</td>
                <td style={{ ...tdNameStyle, color: '#64748b', fontWeight: 400 }}>
                  {r.comuna || '—'}
                </td>
                {renderHeatCell(r.nuevo, max.nuevo, ESTADO_COLOR.nuevo)}
                {renderHeatCell(r.reingreso, max.reingreso, ESTADO_COLOR.reingreso)}
                {renderHeatCell(r.tratado, max.tratado, ESTADO_COLOR.tratado)}
                {renderHeatCell(r.pendientes, max.pendientes, COLOR_PENDIENTE, true)}
                <td style={{ ...tdNumStyle, fontWeight: 700, color: '#0f172a' }}>
                  {r.total.toLocaleString('es-CL')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="comunaRankExpandBar">
          <button
            type="button"
            className="comunaRankExpandBtn"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span>
              {expanded
                ? 'Ver menos'
                : `Ver ${hiddenCount} sector${hiddenCount === 1 ? '' : 'es'} más`}
            </span>
            <span className="comunaRankExpandIcon" aria-hidden>
              {expanded ? '▲' : '▼'}
            </span>
          </button>
        </div>
      )}

      <div style={legendStyle}>
        <span>
          <span
            style={{
              ...legendDot,
              background: 'linear-gradient(90deg, #ffffff 0%, #dc2626 100%)',
              border: '1px solid #fecaca'
            }}
          />
          Sin tratar (nuevo + reingreso) · cuanto más oscuro, más casos pendientes
        </span>
      </div>
    </div>
  )
}

function renderHeatCell(value, maxValue, baseColor, bold = false) {
  const ratio = maxValue > 0 ? value / maxValue : 0
  const alpha = value === 0 ? 0 : 0.18 + ratio * 0.62
  const bg = value === 0 ? '#f8fafc' : `${baseColor}${alphaToHex(alpha)}`
  const fg = ratio >= 0.55 && value > 0 ? '#ffffff' : '#0f172a'
  return (
    <td
      style={{
        ...tdNumStyle,
        background: bg,
        color: fg,
        fontWeight: bold ? 700 : 600,
        transition: 'background 0.15s'
      }}
    >
      {value.toLocaleString('es-CL')}
    </td>
  )
}

function alphaToHex(a) {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
  return v.toString(16).padStart(2, '0')
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: '0.65rem',
  padding: '0.9rem 1rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
}

const emptyStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '220px',
  color: '#64748b',
  fontSize: '0.875rem'
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginBottom: '0.75rem'
}

const titleStyle = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#1e293b'
}

const metaStyle = {
  fontSize: '0.75rem',
  color: '#64748b'
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '0.8125rem'
}

const thBaseStyle = {
  padding: '0.5rem 0.65rem',
  borderBottom: '2px solid #e2e8f0',
  fontWeight: 600,
  color: '#475569',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: '#f8fafc'
}

const thNameStyle = {
  ...thBaseStyle,
  textAlign: 'left'
}

const thNumStyle = {
  ...thBaseStyle,
  textAlign: 'right'
}

const thBtnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'right',
  width: '100%',
  font: 'inherit',
  fontWeight: 'inherit',
  boxSizing: 'border-box' /* mismo box que <button> para impresión */
}

const tdBaseStyle = {
  padding: '0.55rem 0.65rem',
  borderBottom: '1px solid #f1f5f9'
}

const tdNameStyle = {
  ...tdBaseStyle,
  color: '#0f172a',
  fontWeight: 500,
  whiteSpace: 'nowrap'
}

const tdNumStyle = {
  ...tdBaseStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums'
}

const legendStyle = {
  marginTop: '0.75rem',
  paddingTop: '0.65rem',
  borderTop: '1px solid #f1f5f9',
  fontSize: '0.7rem',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem'
}

const legendDot = {
  display: 'inline-block',
  width: '36px',
  height: '8px',
  borderRadius: '4px',
  marginRight: '0.4rem',
  verticalAlign: 'middle'
}
