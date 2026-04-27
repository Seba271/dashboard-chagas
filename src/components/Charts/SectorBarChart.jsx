'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'

/**
 * Barras horizontales de casos por sector (mismo look del antiguo ComunaBarChart).
 *
 * data: Array<{ sector: string, value: number }>
 */
export default function SectorBarChart({
  data = [],
  title = 'Casos por sector',
  loading = false,
  controls = null
}) {
  const cardStyle = {
    background: '#ffffff',
    borderRadius: '0.65rem',
    padding: '0.9rem 1rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  }

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    return [...data].sort((a, b) => {
      const cmp = (b.value || 0) - (a.value || 0)
      if (cmp !== 0) return cmp
      return (a.sector || '').localeCompare(b.sector || '', 'es')
    })
  }, [data])

  const chartHeight = 380

  const option = useMemo(() => {
    if (sortedData.length === 0) {
      return {
        title: {
          text: title,
          left: 'center',
          textStyle: { color: '#1e293b', fontSize: 15, fontWeight: '600' }
        }
      }
    }

    const n = sortedData.length
    /* Etiquetas rotadas cuando hay muchos sectores para que no se solapen. */
    const rotate = n > 8 ? 35 : 0
    const labelInterval = n > 30 ? Math.max(1, Math.ceil(n / 20)) : 0

    return {
      title: {
        text: title,
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
          const param = params[0]
          return `${param.name}<br/>${param.seriesName}: ${Number(param.value).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
        }
      },
      grid: {
        left: '3%',
        right: '3%',
        top: '14%',
        bottom: rotate ? '20%' : '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedData.map((d) => d.sector),
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          rotate,
          interval: labelInterval || 0,
          hideOverlap: true
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { alignWithLabel: true }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
          formatter: (value) => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [
        {
          name: 'Total casos',
          type: 'bar',
          data: sortedData.map((d) => d.value),
          barMaxWidth: 38,
          barCategoryGap: '32%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#14b8a6' },
                { offset: 1, color: '#0d9488' }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            color: '#475569',
            fontSize: 11,
            formatter: (params) => Number(params.value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
          },
          emphasis: { focus: 'series', itemStyle: { color: '#0f766e' } }
        }
      ]
    }
  }, [sortedData, title])

  if (loading) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        {controls && <div className="dashboardChartControls no-print" style={{ marginBottom: '0.5rem' }}>{controls}</div>}
        <SkeletonChart height={360} lines={6} />
      </div>
    )
  }

  if (sortedData.length === 0) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        {controls && <div className="dashboardChartControls no-print" style={{ marginBottom: '0.5rem' }}>{controls}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '360px', color: '#64748b' }}>
          No hay casos en los sectores con los filtros actuales
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle} className="dashboardChartCard">
      {controls && <div className="dashboardChartControls no-print" style={{ marginBottom: '0.5rem' }}>{controls}</div>}
      <ReactECharts
        className="dashboardEchartHost dashboardEchartHostBar"
        option={option}
        style={{ height: `${chartHeight}px`, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
