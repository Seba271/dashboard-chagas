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
 * - title?: string - Título del gráfico
 * - type?: 'line' | 'bar'
 * - loading?: boolean
 */

'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

export default function TendencyChart({
  casesData = [],
  prevCasesData = [],
  title = 'Casos en el tiempo',
  type = 'line',
  loading = false,
  controls = null
}) {
  const chartData = useMemo(() => {
    const allMonths = new Set()
    casesData.forEach(item => allMonths.add(item.month))
    prevCasesData.forEach(item => allMonths.add(item.month))
    const sortedMonths = Array.from(allMonths).sort()

    const casesMap = new Map(casesData.map(item => [item.month, item.value]))
    const getMonthKey = (monthStr) => {
      if (!monthStr) return null
      const parts = monthStr.split('-')
      return parts[1] || null
    }
    const prevMap = new Map(prevCasesData.map(item => [getMonthKey(item.month), item.value]))

    return {
      months: sortedMonths,
      cases: sortedMonths.map(month => casesMap.get(month) || 0),
      casesPrev: sortedMonths.map(month => {
        const key = getMonthKey(month)
        return (key && prevMap.get(key)) || 0
      }),
      hasPrev: prevCasesData && prevCasesData.length > 0
    }
  }, [casesData, prevCasesData])

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
    return {
      title: {
        text: title,
        left: 'center',
        textStyle: { color: '#1e293b', fontSize: 15, fontWeight: '600' }
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
        top: '10%',
        textStyle: { color: '#64748b', fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.months.map(formatLabel),
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          rotate: chartData.months.length > 8 ? 45 : 0
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
      <div style={cardStyle}>
        {controls && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            {controls}
          </div>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '360px',
          color: '#64748b'
        }}>
          Cargando gráfico...
        </div>
      </div>
    )
  }

  if (chartData.months.length === 0) {
    return (
      <div style={cardStyle}>
        {controls && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            {controls}
          </div>
        )}
        <div style={{
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '360px',
          color: '#64748b'
        }}>
          No hay datos de casos en el período seleccionado
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {controls && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          {controls}
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
