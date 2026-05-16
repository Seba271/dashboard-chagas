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
 * - loading?: boolean — estado de fetch del dataset principal.
 * - controls?: ReactNode — rango Desde/Hasta del gráfico (habitualmente).
 * - yearComparisonEnabled?: boolean — segunda serie −1 año (por defecto true).
 * - comparisonFocusYear?: string — año del filtro del panel para leyendas (ej. «2026»).
 * - comparisonOffHint?: string — texto cuando no se muestra comparación (ej. filtro «Todos»).
 * - comparisonStyle?: 'mirror' | 'calendarYoY' — cómo explicar la segunda serie («Todos» ⇒ año natural Ene‑Dic vs año −1).
 */

'use client'

import { useMemo, useEffect, useState, useId } from 'react'
import { flushSync } from 'react-dom'
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

/** Texto contextual bajo el título (solo pantalla). */
function buildTrendLead(
  granularity,
  sparseTimeline,
  showComparison,
  forPrint,
  comparisonFocusYear,
  comparisonStyle
) {
  if (forPrint) return ''
  const parts = []
  if (granularity === 'month') {
    parts.push(
      comparisonStyle === 'calendarYoY'
        ? 'Totales mensuales del año civil (un punto por mes).'
        : 'Agrupación mensual porque el período seleccionado es amplio.'
    )
  } else if (granularity === 'week') {
    parts.push('Agrupación semanal — cada punto es la semana que inicia ese lunes.')
  } else if (granularity === 'day' && sparseTimeline) {
    parts.push('Solo se muestran días con casos porque el período tiene muchos días en cero.')
  } else if (granularity === 'day') {
    parts.push('Cada punto suma los casos con esa fecha de registro.')
  }
  if (showComparison && comparisonStyle === 'calendarYoY') {
    const y = comparisonFocusYear && String(comparisonFocusYear).trim()
    const yPrev = y ? Number.parseInt(y, 10) - 1 : null
    if (yPrev != null && !Number.isNaN(yPrev) && y && yPrev > 1900) {
      parts.push(
        `Ventana año calendario (${y}) frente al año anterior (${yPrev}), mes a mes sobre el mismo eje.`
      )
    }
  } else if (showComparison) {
    const y = comparisonFocusYear && String(comparisonFocusYear).trim()
    const yPrev = y ? Number.parseInt(y, 10) - 1 : null
    if (yPrev != null && !Number.isNaN(yPrev) && y && yPrev > 1900) {
      parts.push(
        `Serie discontinua · año ${yPrev}: mismo mes/día en calendario que la serie ${y} (comparación año seguido).`
      )
    } else {
      parts.push(
        'Línea discontinua: período equivalente corrido −1 año respecto de lo que marca el año filtrado (Desde/Hasta).'
      )
    }
  }
  return parts.filter(Boolean).join(' ')
}

function formatBucketLabel(dateStr, granularity) {
  const parts = dateStr.split('-')
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  if (granularity === 'month' && parts.length >= 2) {
    return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`
  }
  if (granularity === 'week' && parts.length === 3) {
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

const CASOS_LEYENDA_SERIE_UNICA = 'Casos en el período'

export default function TendencyChart({
  casesData = [],
  prevCasesData = [],
  rangeFrom = '',
  rangeTo = '',
  title = 'Casos en el tiempo',
  type = 'line',
  loading = false,
  controls = null,
  yearComparisonEnabled = true,
  comparisonFocusYear,
  comparisonStyle = 'mirror',
  comparisonOffHint = ''
}) {
  const [forPrint, setForPrint] = useState(false)
  const tendencyInfoTooltipId = useId()

  const showComparisonSeries =
    yearComparisonEnabled && Boolean(rangeFrom && rangeTo && String(rangeFrom).trim() && String(rangeTo).trim())

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
    const nonZero = bucketsWithCases(showComparisonSeries ? [casesMap, prevMap] : [casesMap])
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
      /** Siempre que haya ventana válida mostramos la serie de referencia (puede ir en ceros). */
      hasPrev: showComparisonSeries,
      sparseTimeline,
      granularity,
      xLabelInterval:
        sortedMonths.length > 45 ? Math.max(1, Math.ceil(sortedMonths.length / 14)) : 0
    }
  }, [casesData, prevCasesData, rangeFrom, rangeTo, showComparisonSeries])

  const chartLead = buildTrendLead(
    chartData.granularity,
    chartData.sparseTimeline,
    chartData.hasPrev,
    forPrint,
    comparisonFocusYear,
    comparisonStyle
  )

  const option = useMemo(() => {
    const yStr =
      comparisonFocusYear && String(comparisonFocusYear).trim().length ? String(comparisonFocusYear).trim() : ''
    const yNum = Number.parseInt(yStr, 10)
    const yPrev = Number.isFinite(yNum) ? yNum - 1 : null

    const nameActual = (() => {
      if (!chartData.hasPrev) {
        return CASOS_LEYENDA_SERIE_UNICA
      }
      if (!yStr) return CASOS_LEYENDA_SERIE_UNICA
      const suffix = comparisonStyle === 'calendarYoY' ? '(año actual)' : '(año filtrado)'
      return `${yStr} ${suffix}`
    })()

    const nameAnterior =
      yPrev != null && Number.isFinite(yPrev) ? `${yPrev} (año anterior)` : 'Año anterior'
    const legendItems = chartData.hasPrev ? [nameActual, nameAnterior] : [nameActual]
    const series = [
      {
        name: nameActual,
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
        emphasis: { focus: 'series', itemStyle: { color: '#0f766e' } },
        z: chartData.hasPrev ? 3 : 2
      }
    ]
    if (chartData.hasPrev) {
      series.push({
        name: nameAnterior,
        type: type,
        data: chartData.casesPrev,
        smooth: type === 'line',
        showSymbol: chartData.months.length <= 36,
        symbolSize: chartData.months.length <= 24 ? 5 : 3,
        itemStyle: { color: '#b45309' },
        lineStyle: { type: 'dashed', width: 2, color: '#c2410d', opacity: 0.9 },
        emphasis: { focus: 'series', lineStyle: { width: 2.5 } },
        areaStyle: undefined,
        z: 1
      })
    }
    return {
      title: { show: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#334155', fontSize: 12 },
        formatter: (items) => {
          if (!Array.isArray(items) || !items.length) return ''
          const head = items[0]?.axisValueLabel ?? ''
          const lines = items.map((item) => {
            const marker = typeof item.marker === 'string' ? item.marker.replace(/;$/, '').trim() : ''
            const v = Number(item.value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
            const label = marker ? `${marker} ${item.seriesName ?? ''}` : String(item.seriesName ?? '')
            return `<div style="display:flex;align-items:center;gap:8px;line-height:1.35">${label}<strong>${v}</strong></div>`
          })
          return `<div style="font-weight:700;margin-bottom:6px">${head}</div>${lines.join('')}`
        },
        valueFormatter: (value) => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 }),
        axisPointer: {
          type: type === 'line' ? 'line' : 'shadow',
          shadowStyle: { color: 'rgba(13, 148, 136, 0.08)' }
        }
      },
      legend: forPrint
        ? {
            data: legendItems,
            orient: 'horizontal',
            left: 'center',
            bottom: 2,
            top: 'auto',
            itemGap: 14,
            textStyle: { color: '#64748b', fontSize: 10 }
          }
        : {
            show: legendItems.length > 0,
            data: legendItems,
            orient: 'horizontal',
            left: 'center',
            top: '2%',
            itemGap: chartData.hasPrev ? 28 : 20,
            itemWidth: chartData.hasPrev ? 14 : 16,
            textStyle: { color: '#64748b', fontSize: 12, fontWeight: 500 },
            inactiveColor: '#cbd5e1'
          },
      grid: forPrint
        ? {
            left: '4%',
            right: '4%',
            bottom: chartData.months.length > 12 ? '22%' : '18%',
            top: legendItems.length > 1 ? 58 : 48,
            containLabel: true
          }
        : {
            left: '3%',
            right: '3%',
            bottom: chartData.months.length > 12 ? '12%' : '9%',
            top: legendItems.length > 1 ? '17%' : '14%',
            containLabel: true
          },
      xAxis: {
        type: 'category',
        data: chartData.months.map((m) => formatBucketLabel(m, chartData.granularity)),
        axisLabel: {
          color: '#64748b',
          fontSize: forPrint ? 10 : 11,
          rotate:
            chartData.months.length > 10 ? (forPrint ? 26 : 32) : 0,
          ...(chartData.xLabelInterval > 0 ? { interval: chartData.xLabelInterval } : {})
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        splitLine: { show: false }
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
  }, [chartData, comparisonFocusYear, comparisonStyle, type, forPrint])

  const leadTrimmed = typeof chartLead === 'string' ? chartLead.trim() : ''
  const hintTrimmed = typeof comparisonOffHint === 'string' ? comparisonOffHint.trim() : ''
  const hasScreenInfoBubble = Boolean(!forPrint && (leadTrimmed || hintTrimmed))

  const chartHead = (
    <div className="dashboardTendencyHead">
      <div className="dashboardTendencyHeadMain">
        <div className="dashboardTendencyTitleRow">
          {title ? <p className="dashboardTendencyTitle">{title}</p> : null}
          {hasScreenInfoBubble ? (
            <span className="dashboardInfoTooltip dashboardInfoTooltip--tendency no-print">
              <button
                type="button"
                className="dashboardInfoTooltipBtn"
                aria-label="Ver cómo leer este gráfico temporal"
                aria-describedby={tendencyInfoTooltipId}
              >
                i
              </button>
              <span id={tendencyInfoTooltipId} role="tooltip" className="dashboardInfoTooltipBubble">
                {leadTrimmed ? (
                  <span className="dashboardInfoTooltipBubbleBlock">{leadTrimmed}</span>
                ) : null}
                {hintTrimmed ? (
                  <span className="dashboardInfoTooltipBubbleBlock">{hintTrimmed}</span>
                ) : null}
              </span>
            </span>
          ) : null}
        </div>
        {forPrint ? (
          <p className="dashboardTendencyLead dashboardTendencyLead--print">
            Casos agrupados según granularidad ({chartData.granularity}
            ){chartData.hasPrev ? '. Incluye referencia año anterior.' : ''}
          </p>
        ) : null}
      </div>
      {controls ? (
        <div className="dashboardTendencyHeadControls chartControlsDatesWrap no-print">{controls}</div>
      ) : null}
    </div>
  )

  if (loading) {
    return (
      <div className="dashboardChartCard dashboardChartCard--tendency">
        {chartHead}
        <div className="dashboardTendencyBody dashboardTendencyBody--chart">
          <SkeletonChart height={440} lines={5} />
        </div>
      </div>
    )
  }

  if (chartData.months.length === 0) {
    return (
      <div className="dashboardChartCard dashboardChartCard--tendency">
        {chartHead}
        <div className="dashboardTendencyBody dashboardTendencyEmpty">
          No hay datos de casos en el período seleccionado
        </div>
      </div>
    )
  }

  return (
    <div className="dashboardChartCard dashboardChartCard--tendency">
      {chartHead}
      <div className="dashboardTendencyBody dashboardTendencyBody--chart">
        <ReactECharts
          className="dashboardEchartHost dashboardEchartHost--tendency"
          option={option}
          style={{ height: '480px', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>
    </div>
  )
}
