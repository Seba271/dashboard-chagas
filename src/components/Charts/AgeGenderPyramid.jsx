'use client'

/**
 * Pirámide poblacional (edad × género).
 *
 * Eje Y: grupos etarios (0-14 … 60+).
 * Izquierda: Masculino y Otro (valores negativos).
 * Derecha: Femenino y No informa (valores positivos).
 *
 * Sin edad o género no reconocido: pie del gráfico.
 *
 * Props:
 *   cases:   Array<{ edad?: number, genero?: string }>
 *   loading: boolean
 */

import { useMemo, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
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
const COLOR_OTRO = '#a855f7'
const COLOR_NO_INFORMA = '#94a3b8'

function ageGroupOf(edad) {
  const n = Number(edad)
  if (!Number.isFinite(n) || n < 0) return null
  if (n <= 14) return '0_14'
  if (n <= 29) return '15_29'
  if (n <= 44) return '30_44'
  if (n <= 59) return '45_59'
  return '60_plus'
}

function emptyBuckets() {
  return AGE_BUCKETS.reduce(
    (m, b) => ({
      ...m,
      [b.key]: { masculino: 0, femenino: 0, otro: 0, noInforma: 0 }
    }),
    {}
  )
}

export default function AgeGenderPyramid({ cases = [], loading = false }) {
  const [forPrint, setForPrint] = useState(false)

  useEffect(() => {
    const on = () => flushSync(() => setForPrint(true))
    const off = () => flushSync(() => setForPrint(false))
    window.addEventListener('beforeprint', on, true)
    window.addEventListener('afterprint', off)
    return () => {
      window.removeEventListener('beforeprint', on, true)
      window.removeEventListener('afterprint', off)
    }
  }, [])

  const {
    masculinoData,
    femeninoData,
    otroData,
    noInformaData,
    sinEdadCount,
    generoNoEnumCount,
    total
  } = useMemo(() => {
    const buckets = emptyBuckets()
    let sinEdad = 0
    let generoNoEnum = 0
    for (const c of cases || []) {
      const ag = ageGroupOf(c.edad)
      if (!ag) {
        sinEdad++
        continue
      }
      const g = c.genero
      if (g === 'masculino') buckets[ag].masculino++
      else if (g === 'femenino') buckets[ag].femenino++
      else if (g === 'otro') buckets[ag].otro++
      else if (g === 'no_informa') buckets[ag].noInforma++
      else generoNoEnum++
    }
    const m = AGE_BUCKETS.map((b) => buckets[b.key].masculino)
    const f = AGE_BUCKETS.map((b) => buckets[b.key].femenino)
    const o = AGE_BUCKETS.map((b) => buckets[b.key].otro)
    const ni = AGE_BUCKETS.map((b) => buckets[b.key].noInforma)
    const t = [...m, ...f, ...o, ...ni].reduce((s, v) => s + v, 0)
    return {
      masculinoData: m,
      femeninoData: f,
      otroData: o,
      noInformaData: ni,
      sinEdadCount: sinEdad,
      generoNoEnumCount: generoNoEnum,
      total: t
    }
  }, [cases])

  const maxAbs = useMemo(() => {
    const vals = [...masculinoData, ...femeninoData, ...otroData, ...noInformaData]
    const peak = Math.max(1, ...vals)
    return peak + Math.max(1, Math.ceil(peak * 0.2))
  }, [masculinoData, femeninoData, otroData, noInformaData])

  const option = useMemo(() => {
    const labels = AGE_BUCKETS.map((b) => b.label)
    const totalSafe = Math.max(1, total)

    const titleBlock = forPrint
      ? {
          text: 'Pirámide poblacional',
          left: 'center',
          top: 6,
          textStyle: { color: '#1e293b', fontSize: 13, fontWeight: '600' }
        }
      : {
          text: 'Pirámide poblacional',
          left: 'center',
          textStyle: { color: '#1e293b', fontSize: 15, fontWeight: '600' }
        }

    const legendBlock = forPrint
      ? {
          data: ['Masculino', 'Otro', 'Femenino', 'No informa'],
          orient: 'horizontal',
          left: 'center',
          bottom: 4,
          top: 'auto',
          itemWidth: 12,
          itemHeight: 8,
          itemGap: 10,
          textStyle: { color: '#475569', fontSize: 10 }
        }
      : {
          data: ['Masculino', 'Otro', 'Femenino', 'No informa'],
          top: 30,
          textStyle: { color: '#475569', fontSize: 12 },
          itemWidth: 14,
          itemHeight: 10,
          itemGap: 14
        }

    /* Impresión: márgenes simétricos en px para que el eje 0 quede centrado (evita “todo a la derecha”) */
    const gridBlock = forPrint
      ? { left: 56, right: 56, bottom: 72, top: 42, containLabel: true }
      : { left: '6%', right: '6%', bottom: '4%', top: '22%', containLabel: true }

    return {
      title: titleBlock,
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
      legend: legendBlock,
      grid: gridBlock,
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
          data: masculinoData.map((v) => -v),
          itemStyle: {
            color: COLOR_M,
            borderRadius: [4, 0, 0, 4]
          },
          barMaxWidth: 22,
          barGap: '15%',
          label: {
            show: true,
            position: 'insideRight',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            distance: 2,
            formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
          },
          emphasis: { itemStyle: { color: '#2563eb' } }
        },
        {
          name: 'Otro',
          type: 'bar',
          data: otroData.map((v) => -v),
          itemStyle: {
            color: COLOR_OTRO,
            borderRadius: [4, 0, 0, 4]
          },
          barMaxWidth: 22,
          barGap: '15%',
          label: {
            show: true,
            position: 'insideRight',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            distance: 2,
            formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
          },
          emphasis: { itemStyle: { color: '#9333ea' } }
        },
        {
          name: 'Femenino',
          type: 'bar',
          data: femeninoData,
          itemStyle: {
            color: COLOR_F,
            borderRadius: [0, 4, 4, 0]
          },
          barMaxWidth: 22,
          barGap: '15%',
          label: {
            show: true,
            position: 'insideLeft',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            distance: 2,
            formatter: (p) => (p.value > 0 ? p.value : '')
          },
          emphasis: { itemStyle: { color: '#db2777' } }
        },
        {
          name: 'No informa',
          type: 'bar',
          data: noInformaData,
          itemStyle: {
            color: COLOR_NO_INFORMA,
            borderRadius: [0, 4, 4, 0]
          },
          barMaxWidth: 22,
          barGap: '15%',
          label: {
            show: true,
            position: 'insideLeft',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            distance: 2,
            formatter: (p) => (p.value > 0 ? p.value : '')
          },
          emphasis: { itemStyle: { color: '#64748b' } }
        }
      ]
    }
  }, [masculinoData, femeninoData, otroData, noInformaData, maxAbs, total, forPrint])

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

  const showFooter =
    sinEdadCount > 0 || generoNoEnumCount > 0

  if (total === 0 && !showFooter) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <div style={loadingBoxStyle}>No hay casos con edad y género para los filtros actuales</div>
      </div>
    )
  }

  if (total === 0 && showFooter) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        <div style={loadingBoxStyle}>
          No hay casos con edad en las categorías de género para graficar
        </div>
        <div style={footerNoteStyle}>
          {sinEdadCount > 0 && (
            <span>
              <strong>{sinEdadCount}</strong> sin edad registrada
            </span>
          )}
          {sinEdadCount > 0 && generoNoEnumCount > 0 && <span style={{ color: '#cbd5e1' }}>·</span>}
          {generoNoEnumCount > 0 && (
            <span>
              <strong>{generoNoEnumCount}</strong>{' '}
              {generoNoEnumCount === 1 ? 'caso con género no reconocido' : 'casos con género no reconocido'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="dashboardChartCard">
      <ReactECharts
        className="dashboardEchartHost"
        option={option}
        style={{ height: '420px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
      {showFooter && (
        <div style={footerNoteStyle}>
          {sinEdadCount > 0 && (
            <span>
              <strong>{sinEdadCount}</strong> sin edad registrada (fuera de la pirámide)
            </span>
          )}
          {sinEdadCount > 0 && generoNoEnumCount > 0 && <span style={{ color: '#cbd5e1' }}>·</span>}
          {generoNoEnumCount > 0 && (
            <span>
              <strong>{generoNoEnumCount}</strong>{' '}
              {generoNoEnumCount === 1
                ? 'caso con género no reconocido'
                : 'casos con género no reconocido'}
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
  minHeight: '200px',
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
