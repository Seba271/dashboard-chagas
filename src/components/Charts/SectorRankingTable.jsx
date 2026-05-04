'use client'

import { useMemo, useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { SkeletonTableRow } from '@/src/components/Skeleton'

const INITIAL_VISIBLE = 5

/**
 * Tabla ordenable con ranking por sector. Reemplaza al antiguo ComunaRankingTable
 * (mantiene clases CSS para no requerir cambios de estilos).
 *
 * data:    Array<{ sector: string, comuna?: string, value: number }>
 * compact: si true, esconde columnas redundantes (Comuna y Casos), dejando solo
 *          # | Sector | % del total — pensado para ir al lado del bar chart.
 */
export default function SectorRankingTable({ data = [], loading = false, compact = false }) {
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const showAllForPrint = () => {
      flushSync(() => setExpanded(true))
    }
    window.addEventListener('beforeprint', showAllForPrint, true)
    return () => window.removeEventListener('beforeprint', showAllForPrint, true)
  }, [])

  const total = useMemo(() => data.reduce((s, r) => s + (Number(r.value) || 0), 0), [data])

  const sorted = useMemo(() => {
    const rows = [...data]
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'sector') {
        cmp = (a.sector || '').localeCompare(b.sector || '', 'es')
      } else if (sortKey === 'comuna') {
        cmp = (a.comuna || '').localeCompare(b.comuna || '', 'es')
      } else if (sortKey === 'value') {
        cmp = (Number(a.value) || 0) - (Number(b.value) || 0)
      } else if (sortKey === 'pct') {
        const pa = total > 0 ? (Number(a.value) || 0) / total : 0
        const pb = total > 0 ? (Number(b.value) || 0) / total : 0
        cmp = pa - pb
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [data, sortKey, sortDir, total])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'sector' || key === 'comuna' ? 'asc' : 'desc')
    }
  }

  const thBtn = (key, label) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => toggleSort(key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleSort(key)
        }
      }}
      className="comunaRankSortBtn"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <span className="comunaRankSortIcon" aria-hidden>
        {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </div>
  )

  const colCount = compact ? 3 : 5

  if (loading) {
    return (
      <div className={`comunaRankTableWrap${compact ? ' comunaRankTableWrap--compact' : ''}`}>
        <div className="comunaRankTableToolbar">
          <span className="comunaRankTableTitle">
            {compact ? 'Ranking por sector' : 'Detalle del ranking por sector'}
          </span>
        </div>
        <div className="comunaRankTableScroll">
          <table className="comunaRankTable">
            <thead>
              <tr>
                <th scope="col" className="comunaRankTh comunaRankThRank">#</th>
                <th scope="col" className="comunaRankTh">Sector</th>
                {!compact && <th scope="col" className="comunaRankTh">Comuna</th>}
                {!compact && <th scope="col" className="comunaRankTh comunaRankThNum">Casos</th>}
                <th scope="col" className="comunaRankTh comunaRankThNum">% del total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={colCount} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className={`comunaRankTableWrap${compact ? ' comunaRankTableWrap--compact' : ''}`}>
        <p className="comunaRankEmpty">Sin datos para el ranking</p>
      </div>
    )
  }

  const hasMore = sorted.length > INITIAL_VISIBLE
  const visibleRows = expanded || !hasMore ? sorted : sorted.slice(0, INITIAL_VISIBLE)
  const hiddenCount = sorted.length - INITIAL_VISIBLE

  return (
    <div className={`comunaRankTableWrap${compact ? ' comunaRankTableWrap--compact' : ''}`}>
      <div className="comunaRankTableToolbar">
        <span className="comunaRankTableTitle">
          {compact ? 'Ranking por sector' : 'Detalle del ranking por sector'}
        </span>
        <span className="comunaRankTableMeta">{total.toLocaleString('es-CL')} casos en total</span>
      </div>
      <div className="comunaRankTableScroll">
        <table className="comunaRankTable">
          <thead>
            <tr>
              <th scope="col" className="comunaRankTh comunaRankThRank">#</th>
              <th scope="col" className="comunaRankTh">{thBtn('sector', 'Sector')}</th>
              {!compact && (
                <th scope="col" className="comunaRankTh">{thBtn('comuna', 'Comuna')}</th>
              )}
              {!compact && (
                <th scope="col" className="comunaRankTh comunaRankThNum">{thBtn('value', 'Casos')}</th>
              )}
              <th scope="col" className="comunaRankTh comunaRankThNum">{thBtn('pct', '% del total')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => {
              const val = Number(row.value) || 0
              const pct = total > 0 ? (val / total) * 100 : 0
              const rank = idx + 1
              const topByCasos = sortKey === 'value' && sortDir === 'desc'
              let rowClass = 'comunaRankRow'
              if (topByCasos && rank === 1) rowClass += ' comunaRankRow--gold'
              else if (topByCasos && rank === 2) rowClass += ' comunaRankRow--silver'
              else if (topByCasos && rank === 3) rowClass += ' comunaRankRow--bronze'

              return (
                <tr key={row.sector || idx} className={rowClass}>
                  <td className="comunaRankTd comunaRankTdRank">
                    <span className="comunaRankBadge">{rank}</span>
                  </td>
                  <td className="comunaRankTd comunaRankTdName">{row.sector || '—'}</td>
                  {!compact && (
                    <td className="comunaRankTd comunaRankTdName">{row.comuna || '—'}</td>
                  )}
                  {!compact && (
                    <td className="comunaRankTd comunaRankTdNum">{val.toLocaleString('es-CL')}</td>
                  )}
                  <td className="comunaRankTd comunaRankTdNum">{pct.toFixed(1)}%</td>
                </tr>
              )
            })}
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
    </div>
  )
}
