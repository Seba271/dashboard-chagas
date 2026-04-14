'use client'

import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'

function SparklineCell({ value, maxValue }) {
  const v = Number(value) || 0
  const max = Math.max(maxValue || 0, 1)
  const option = useMemo(
    () => ({
      grid: { left: 2, right: 2, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false, data: [0, 1, 2, 3, 4] },
      yAxis: { type: 'value', show: false, min: 0, max },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: [0, v * 0.15, v * 0.45, v * 0.78, v],
          lineStyle: { width: 2, color: '#0d9488' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(13, 148, 136, 0.25)' },
                { offset: 1, color: 'rgba(13, 148, 136, 0.02)' }
              ]
            }
          }
        }
      ]
    }),
    [v, max]
  )

  return (
    <div className="comunaSparklineCell" style={{ width: 88, height: 36 }} aria-hidden>
      <ReactECharts
        className="comunaSparklineChart"
        option={option}
        style={{ height: 36, width: 88 }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}

/**
 * Tabla ordenable con ranking por comuna y mini tendencia (sparkline) por fila.
 */
export default function ComunaRankingTable({ data = [], loading = false }) {
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  const maxVal = useMemo(() => {
    if (!data.length) return 1
    return Math.max(...data.map((d) => Number(d.value) || 0), 1)
  }, [data])

  const total = useMemo(() => data.reduce((s, r) => s + (Number(r.value) || 0), 0), [data])

  const sorted = useMemo(() => {
    const rows = [...data]
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'comuna') {
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
      setSortDir(key === 'comuna' ? 'asc' : 'desc')
    }
  }

  const thBtn = (key, label) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="comunaRankSortBtn"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <span className="comunaRankSortIcon" aria-hidden>
        {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  )

  if (loading) {
    return (
      <div className="comunaRankTableWrap">
        <p className="comunaRankLoading">Cargando ranking…</p>
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="comunaRankTableWrap">
        <p className="comunaRankEmpty">Sin datos para el ranking</p>
      </div>
    )
  }

  return (
    <div className="comunaRankTableWrap">
      <div className="comunaRankTableToolbar">
        <span className="comunaRankTableTitle">Detalle del ranking</span>
        <span className="comunaRankTableMeta">
          {total.toLocaleString('es-CL')} casos en total
        </span>
      </div>
      <div className="comunaRankTableScroll">
        <table className="comunaRankTable">
          <thead>
            <tr>
              <th scope="col" className="comunaRankTh comunaRankThRank">
                #
              </th>
              <th scope="col" className="comunaRankTh">
                {thBtn('comuna', 'Comuna')}
              </th>
              <th scope="col" className="comunaRankTh comunaRankThNum">
                {thBtn('value', 'Casos')}
              </th>
              <th scope="col" className="comunaRankTh comunaRankThNum">
                {thBtn('pct', '% del total')}
              </th>
              <th scope="col" className="comunaRankTh comunaRankThSpark">
                Tendencia
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const val = Number(row.value) || 0
              const pct = total > 0 ? (val / total) * 100 : 0
              const rank = idx + 1
              const topByCasos = sortKey === 'value' && sortDir === 'desc'
              let rowClass = 'comunaRankRow'
              if (topByCasos && rank === 1) rowClass += ' comunaRankRow--gold'
              else if (topByCasos && rank === 2) rowClass += ' comunaRankRow--silver'
              else if (topByCasos && rank === 3) rowClass += ' comunaRankRow--bronze'

              return (
                <tr key={row.comuna || idx} className={rowClass}>
                  <td className="comunaRankTd comunaRankTdRank">
                    <span className="comunaRankBadge">{rank}</span>
                  </td>
                  <td className="comunaRankTd comunaRankTdName">{row.comuna}</td>
                  <td className="comunaRankTd comunaRankTdNum">{val.toLocaleString('es-CL')}</td>
                  <td className="comunaRankTd comunaRankTdNum">{pct.toFixed(1)}%</td>
                  <td className="comunaRankTd comunaRankTdSpark">
                    <SparklineCell value={val} maxValue={maxVal} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
