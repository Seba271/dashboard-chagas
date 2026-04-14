/**
 * ============================================================================
 * COMPONENTE: TendencyChart
 * ============================================================================
 * Gráfico de tendencia temporal de casos (personas con Chagas en el tiempo).
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

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Lista inclusiva YYYY-MM-DD … YYYY-MM-DD (fechas locales, sin UTC). */
function eachDayInRangeISO(fromStr, toStr) {
  if (!fromStr || !toStr) return []
  const a = fromStr.slice(0, 10).split('-').map(Number)
  const b = toStr.slice(0, 10).split('-').map(Number)
  if (a.length < 3 || b.length < 3 || a.some(Number.isNaN) || b.some(Number.isNaN)) return []
  const from = new Date(a[0], a[1] - 1, a[2])
  const to = new Date(b[0], b[1] - 1, b[2])
  if (from > to) return []
  const out = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
  }
  return out
}

/** Fechas YYYY-MM-DD con al menos un caso (> 0), dentro del rango, ordenadas. */
function datesWithCasesInRange(casesData, fullRangeSet) {
  const seen = new Set()
  const out = []
  for (const item of casesData) {
    const key = typeof item.month === 'string' ? item.month.slice(0, 10) : ''
    if (!key || !fullRangeSet.has(key)) continue
    if ((Number(item.value) || 0) <= 0) continue
    if (!seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out.sort()
}

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
    const casesMap = new Map(
      casesData.map((item) => {
        const k = typeof item.month === 'string' ? item.month.slice(0, 10) : item.month
        return [k, item.value]
      })
    )

    const fullRange = eachDayInRangeISO(rangeFrom, rangeTo)
    const fullRangeSet = new Set(fullRange)

    /* Si el rango es largo y casi todos los días son 0, el eje solo muestra días con casos (evita un pico invisible al final). */
    const nonZeroDates = datesWithCasesInRange(casesData, fullRangeSet)
    const sparseTimeline =
      fullRange.length > 45 &&
      nonZeroDates.length > 0 &&
      nonZeroDates.length < fullRange.length * 0.3

    let sortedMonths
    /* Límite para no colgar el navegador con rangos enormes (> ~3 años día a día). */
    if (fullRange.length > 0 && fullRange.length <= 1200) {
      sortedMonths = sparseTimeline ? nonZeroDates : fullRange
    } else {
      const allMonths = new Set()
      casesData.forEach((item) => allMonths.add(item.month))
      prevCasesData.forEach((item) => allMonths.add(item.month))
      sortedMonths = Array.from(allMonths).sort()
    }
    const getMonthKey = (monthStr) => {
      if (!monthStr) return null
      const parts = monthStr.split('-')
      return parts[1] || null
    }
    const prevMap = new Map(prevCasesData.map(item => [getMonthKey(item.month), item.value]))

    return {
      months: sortedMonths,
      cases: sortedMonths.map((month) => casesMap.get(month) || 0),
      casesPrev: sortedMonths.map((month) => {
        const key = getMonthKey(month)
        return (key && prevMap.get(key)) || 0
      }),
      hasPrev: prevCasesData && prevCasesData.length > 0,
      sparseTimeline,
      xLabelInterval:
        sortedMonths.length > 45 ? Math.max(1, Math.ceil(sortedMonths.length / 14)) : 0
    }
  }, [casesData, prevCasesData, rangeFrom, rangeTo])

  const formatLabel = (dateStr) => {
    const parts = dateStr.split('-')
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
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
    const legendItems = chartData.hasPrev ? ['Casos', 'Casos (año anterior)'] : ['Casos']
    const series = [
      {
        name: 'Casos',
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
        itemStyle: { color: '#0d9488' },
        lineStyle: { type: 'dashed' },
        areaStyle: undefined
      })
    }
    const hasTitleText = Boolean(title && String(title).trim())
    const showTitleBlock = hasTitleText || chartData.sparseTimeline
    return {
      title: {
        show: showTitleBlock,
        text: title,
        subtext: chartData.sparseTimeline
          ? 'Solo se muestran días con al menos un caso (el período tiene muchos días en cero).'
          : '',
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
        top: chartData.sparseTimeline ? '14%' : '10%',
        textStyle: { color: '#64748b', fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: chartData.months.length > 12 ? '14%' : '10%',
        top: chartData.sparseTimeline ? '22%' : '18%',
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
    borderRadius: '0.75rem',
    padding: '1.25rem',
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
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '440px',
          color: '#64748b'
        }}>
          Cargando gráfico...
        </div>
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
