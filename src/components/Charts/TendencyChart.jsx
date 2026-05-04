/**
 * ============================================================================
 * COMPONENTE: TendencyChart
 * ============================================================================
 * Gráfico de tendencia temporal de casos epidemiológicos en el tiempo.
 * Opcional: serie punteada del mismo período del año anterior.
 * 
 * PROPS:
 * - casesData: Array<{month: string, value: number}> - Casos por fecha (month = YYYY-MM-DD)
 * - prevCasesData?: Array<{month: string, value: number}> - Casos año anterior
 * - rangeFrom / rangeTo: YYYY-MM-DD del período del gráfico; rellena días sin datos con 0 en el eje X.
 * - title?: string - Título del gráfico
 * - type?: 'line' | 'bar'
 * - loading?: boolean
 */

'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseIso(s) {
  if (!s || typeof s !== 'string') return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Decide la granularidad temporal según el ancho del rango. */
function pickGranularity(fromStr, toStr) {
  const from = parseIso(fromStr)
  const to = parseIso(toStr)
  if (!from || !to || from > to) return 'day'
  const days = Math.round((to - from) / 86_400_000) + 1
  if (days <= 30) return 'day'
  if (days <= 90) return 'week'
  return 'month'
}

/** Devuelve la clave de bucket (string) para un ISO según la granularidad. */
function bucketKey(iso, granularity) {
  if (!iso) return ''
  const s = iso.slice(0, 10)
  if (granularity === 'day') return s
  if (granularity === 'month') return s.slice(0, 7) + '-01'
  /* week → lunes de esa semana */
  const d = parseIso(s)
  if (!d) return s
  const dow = d.getDay() || 7
  d.setDate(d.getDate() - (dow - 1))
  return isoFromDate(d)
}

/** Lista ordenada de buckets (incluyentes) para el rango y granularidad dados. */
function eachBucketInRange(fromStr, toStr, granularity) {
  const from = parseIso(fromStr)
  const to = parseIso(toStr)
  if (!from || !to || from > to) return []
  const out = []
  if (granularity === 'day') {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      out.push(isoFromDate(d))
    }
    return out
  }
  if (granularity === 'month') {
    const cur = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (cur <= end) {
      out.push(isoFromDate(cur))
      cur.setMonth(cur.getMonth() + 1)
    }
    return out
  }
  /* week */
  const start = parseIso(bucketKey(fromStr, 'week'))
  for (let d = new Date(start); d <= to; d.setDate(d.getDate() + 7)) {
    out.push(isoFromDate(d))
  }
  return out
}

/** Agrega una serie (con .month en ISO) en buckets sumando los valores. */
function aggregateByBucket(series, granularity, validBuckets) {
  const out = new Map()
  for (const item of series || []) {
    const key = bucketKey(typeof item.month === 'string' ? item.month : '', granularity)
    if (!key || !validBuckets.has(key)) continue
    out.set(key, (out.get(key) || 0) + (Number(item.value) || 0))
  }
  return out
}

/** Buckets con valor > 0, dentro del rango, ordenados. Acepta múltiples series. */
function bucketsWithCases(seriesMaps) {
  const seen = new Set()
  for (const m of seriesMaps) {
    if (!m) continue
    for (const [k, v] of m.entries()) {
      if ((Number(v) || 0) > 0) seen.add(k)
    }
  }
  return [...seen].sort()
}

const CASOS_LEYENDA_ANO_ACTUAL = 'Casos (año actual)'

export default function TendencyChart({
  casesData = [],
  prevCasesData = [],
  rangeFrom = '',
  rangeTo = '',
  title = 'Casos en el tiempo',
  type = 'line',
  loading = false,
  controls = null
}) {
  const chartData = useMemo(() => {
    const granularity = pickGranularity(rangeFrom, rangeTo)
    const fullBuckets = eachBucketInRange(rangeFrom, rangeTo, granularity)
    const validBucketSet = new Set(fullBuckets)

    /* `prevCasesData` ya viene con fechas alineadas al año actual (los casos
       del año anterior vienen renombrados al año en curso), por eso podemos
       hacer match directo por bucket. */
    const casesMap = aggregateByBucket(casesData, granularity, validBucketSet)
    const prevMap = aggregateByBucket(prevCasesData, granularity, validBucketSet)

    /* En modo diario seguimos usando "sparse" para no inundar el eje con ceros
       cuando el rango es largo y los datos son escasos. En semana/mes los
       buckets ya están agregados, así que mostramos todo el rango. */
    const nonZero = bucketsWithCases([casesMap, prevMap])
    const sparseTimeline =
      granularity === 'day' &&
      fullBuckets.length > 45 &&
      nonZero.length > 0 &&
      nonZero.length < fullBuckets.length * 0.3

    let sortedMonths
    if (fullBuckets.length > 0 && fullBuckets.length <= 1200) {
      sortedMonths = sparseTimeline ? nonZero : fullBuckets
    } else {
      const all = new Set([...casesMap.keys(), ...prevMap.keys()])
      sortedMonths = [...all].sort()
    }

    return {
      months: sortedMonths,
      cases: sortedMonths.map((b) => casesMap.get(b) || 0),
      casesPrev: sortedMonths.map((b) => prevMap.get(b) || 0),
      hasPrev: prevCasesData && prevCasesData.length > 0,
      sparseTimeline,
      granularity,
      xLabelInterval:
        sortedMonths.length > 45 ? Math.max(1, Math.ceil(sortedMonths.length / 14)) : 0
    }
  }, [casesData, prevCasesData, rangeFrom, rangeTo])

  const formatLabel = (dateStr) => {
    const parts = dateStr.split('-')
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    if (chartData.granularity === 'month' && parts.length >= 2) {
      return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`
    }
    if (chartData.granularity === 'week' && parts.length === 3) {
      const [, month, day] = parts
      return `${parseInt(day, 10)} ${monthNames[parseInt(month, 10) - 1]}`
    }
    if (parts.length === 3) {
      const [, month, day] = parts
      return `${parseInt(day, 10)} ${monthNames[parseInt(month, 10) - 1]} ${parts[0].slice(2)}`
    }
    if (parts.length === 2) {
      return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`
    }
    return dateStr
  }

  const option = useMemo(() => {
    const legendItems = chartData.hasPrev
      ? [CASOS_LEYENDA_ANO_ACTUAL, 'Casos (año anterior)']
      : [CASOS_LEYENDA_ANO_ACTUAL]
    const series = [
      {
        name: CASOS_LEYENDA_ANO_ACTUAL,
        type: type,
        data: chartData.cases,
        smooth: type === 'line',
        showSymbol: true,
        symbolSize: chartData.months.length <= 24 ? 9 : 6,
        itemStyle: { color: '#0d9488' },
        areaStyle: type === 'line' ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(13, 148, 136, 0.25)' },
              { offset: 1, color: 'rgba(13, 148, 136, 0.04)' }
            ]
          }
        } : undefined,
        emphasis: { focus: 'series', itemStyle: { color: '#0f766e' } }
      }
    ]
    if (chartData.hasPrev) {
      series.push({
        name: 'Casos (año anterior)',
        type: type,
        data: chartData.casesPrev,
        smooth: type === 'line',
        showSymbol: true,
        symbolSize: chartData.months.length <= 24 ? 6 : 4,
        itemStyle: { color: '#94a3b8' },
        lineStyle: { type: 'dashed', width: 1.5, color: '#94a3b8', opacity: 0.85 },
        emphasis: { focus: 'series', lineStyle: { width: 2 } },
        areaStyle: undefined,
        z: 1
      })
    }
    const hasTitleText = Boolean(title && String(title).trim())
    let subtext = ''
    if (chartData.granularity === 'month') {
      subtext = 'Casos agrupados por mes (rango amplio).'
    } else if (chartData.granularity === 'week') {
      subtext = 'Casos agrupados por semana (semana inicia el lunes).'
    } else if (chartData.sparseTimeline) {
      subtext = 'Solo se muestran días con al menos un caso (el período tiene muchos días en cero).'
    }
    const showTitleBlock = hasTitleText || Boolean(subtext)
    return {
      title: {
        show: showTitleBlock,
        text: title,
        subtext,
        left: 'center',
        textStyle: { color: '#1e293b', fontSize: 15, fontWeight: '600' },
        subtextStyle: { color: '#64748b', fontSize: 11, fontWeight: 'normal' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#334155' },
        valueFormatter: (value) => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 }),
        axisPointer: {
          type: type === 'line' ? 'line' : 'shadow',
          shadowStyle: { color: 'rgba(13, 148, 136, 0.08)' }
        }
      },
      legend: {
        data: legendItems,
        top: subtext ? '14%' : '10%',
        textStyle: { color: '#64748b', fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: chartData.months.length > 12 ? '14%' : '10%',
        top: subtext ? '22%' : '18%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.months.map(formatLabel),
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          rotate: chartData.months.length > 10 ? 35 : 0,
          ...(chartData.xLabelInterval > 0 ? { interval: chartData.xLabelInterval } : {})
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
          formatter: (value) => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series
    }
  }, [chartData, title, type])

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
        {controls && (
          <div
            className="dashboardChartControls no-print"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}
          >
            {controls}
          </div>
        )}
        <SkeletonChart height={440} lines={5} />
      </div>
    )
  }

  if (chartData.months.length === 0) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        {controls && (
          <div
            className="dashboardChartControls no-print"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}
          >
            {controls}
          </div>
        )}
        <div style={{
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '440px',
          color: '#64748b'
        }}>
          No hay datos de casos en el período seleccionado
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="dashboardChartCard">
      {controls && (
        <div
          className="dashboardChartControls no-print"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}
        >
          {controls}
        </div>
      )}
      <ReactECharts
        className="dashboardEchartHost dashboardEchartHost--tendency"
        option={option}
        style={{ height: '480px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
