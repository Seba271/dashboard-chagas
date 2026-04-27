'use client'

/**
 * Pirámide poblacional clásica (edad × género).
 *
 * Eje Y: grupos etarios (0-14, 15-29, 30-44, 45-59, 60+).
 * Eje X: masculino a la izquierda (valores negativos visualmente),
 *        femenino a la derecha (valores positivos).
 *
 * Los casos con género distinto de masculino/femenino o sin edad se
 * muestran como texto-pie del gráfico para no introducir una tercera
 * serie que distorsione la lectura clásica de la pirámide.
 *
 * Props:
 *   cases:   Array<{ edad?: number, genero?: string }>
 *   loading: boolean
 */

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'

const AGE_BUCKETS = [
  { key: '0_14', label: '0-14' },
  { key: '15_29', label: '15-29' },
  { key: '30_44', label: '30-44' },
  { key: '45_59', label: '45-59' },
  { key: '60_plus', label: '60+' }
]

const COLOR_M = '#3b82f6'
const COLOR_F = '#ec4899'

function ageGroupOf(edad) {
  const n = Number(edad)
  if (!Number.isFinite(n) || n < 0) return null
  if (n <= 14) return '0_14'
  if (n <= 29) return '15_29'
  if (n <= 44) return '30_44'
  if (n <= 59) return '45_59'
  return '60_plus'
}

export default function AgeGenderPyramid({ cases = [], loading = false }) {
  const { masculinoData, femeninoData, otroCount, sinEdadCount, total } = useMemo(() => {
    const buckets = AGE_BUCKETS.reduce(
      (m, b) => ({ ...m, [b.key]: { masculino: 0, femenino: 0 } }),
      {}
    )
    let otro = 0
    let sinEdad = 0
    for (const c of cases || []) {
      const ag = ageGroupOf(c.edad)
      if (!ag) {
        sinEdad++
        continue
      }
      const g = c.genero
      if (g === 'masculino') buckets[ag].masculino++
      else if (g === 'femenino') buckets[ag].femenino++
      else otro++
    }
    const m = AGE_BUCKETS.map((b) => buckets[b.key].masculino)
    const f = AGE_BUCKETS.map((b) => buckets[b.key].femenino)
    const t = m.reduce((s, v) => s + v, 0) + f.reduce((s, v) => s + v, 0)
    return { masculinoData: m, femeninoData: f, otroCount: otro, sinEdadCount: sinEdad, total: t }
  }, [cases])

  /** Máximo absoluto del eje X con un poco de headroom (~20 %) para que las
      barras nunca toquen el borde del grid y los data-labels respiren. */
  const maxAbs = useMemo(() => {
    const vals = [...masculinoData, ...femeninoData]
    const m = Math.max(1, ...vals)
    return m + Math.max(1, Math.ceil(m * 0.2))
  }, [masculinoData, femeninoData])

  const option = useMemo(() => {
    const labels = AGE_BUCKETS.map((b) => b.label)
    const totalSafe = Math.max(1, total)

    return {
      title: {
        text: 'Pirámide poblacional',
        left: 'center',
        textStyle: { color: '#1e293b', fontSize: 15, fontWeight: '600' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155' },
        formatter: (params) => {
          const ageLabel = params[0]?.name ?? ''
          const lines = params
            .map((p) => {
              const abs = Math.abs(p.value)
              const pctTxt = ((abs / totalSafe) * 100).toFixed(1)
              return `<div style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                  <span><strong>${p.seriesName}:</strong> ${abs} (${pctTxt}%)</span>
                </div>`
            })
            .join('')
          return `<div style="font-weight:600;margin-bottom:4px">${ageLabel} años</div>${lines}`
        }
      },
      legend: {
        data: ['Masculino', 'Femenino'],
        top: 30,
        textStyle: { color: '#475569', fontSize: 12 },
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 18
      },
      grid: { left: '6%', right: '6%', bottom: '4%', top: '22%', containLabel: true },
      xAxis: {
        type: 'value',
        min: -maxAbs,
        max: maxAbs,
        interval: Math.max(1, Math.ceil(maxAbs / 4)),
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          margin: 10,
          formatter: (v) => Math.abs(v).toString()
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisTick: { show: false },
        axisLabel: { color: '#1e293b', fontSize: 12, fontWeight: 500, margin: 14 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      series: [
        {
          name: 'Masculino',
          type: 'bar',
          stack: 'pyramid',
          data: masculinoData.map((v) => -v),
          itemStyle: {
            color: COLOR_M,
            borderRadius: [4, 0, 0, 4]
          },
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'insideRight',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            distance: 4,
            formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
          },
          emphasis: { itemStyle: { color: '#2563eb' } }
        },
        {
          name: 'Femenino',
          type: 'bar',
          stack: 'pyramid',
          data: femeninoData,
          itemStyle: {
            color: COLOR_F,
            borderRadius: [0, 4, 4, 0]
          },
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'insideLeft',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            distance: 4,
            formatter: (p) => (p.value > 0 ? p.value : '')
          },
          emphasis: { itemStyle: { color: '#db2777' } }
        }
      ]
    }
  }, [masculinoData, femeninoData, maxAbs, total])

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '0.65rem',
    padding: '0.9rem 1rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  }

  if (loading) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <SkeletonChart height={380} lines={5} />
      </div>
    )
  }

  if (total === 0 && otroCount === 0 && sinEdadCount === 0) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <div style={loadingBoxStyle}>No hay casos con edad y género para los filtros actuales</div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="dashboardChartCard">
      <ReactECharts
        className="dashboardEchartHost"
        option={option}
        style={{ height: '380px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
      {(otroCount > 0 || sinEdadCount > 0) && (
        <div style={footerNoteStyle}>
          {otroCount > 0 && (
            <span>
              <strong>{otroCount}</strong> {otroCount === 1 ? 'caso' : 'casos'} de otro género o sin
              dato
            </span>
          )}
          {otroCount > 0 && sinEdadCount > 0 && <span style={{ color: '#cbd5e1' }}>·</span>}
          {sinEdadCount > 0 && (
            <span>
              <strong>{sinEdadCount}</strong> sin edad registrada
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const loadingBoxStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '380px',
  color: '#64748b',
  fontSize: '0.875rem'
}

const footerNoteStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  marginTop: '0.65rem',
  paddingTop: '0.65rem',
  borderTop: '1px solid #f1f5f9',
  fontSize: '0.75rem',
  color: '#64748b'
}
