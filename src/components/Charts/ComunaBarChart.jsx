/**
 * ============================================================================
 * COMPONENTE: ComunaBarChart
 * ============================================================================
 * 
 * Gráfico de barras horizontal para mostrar distribución por comuna.
 * Usa datos reales desde Supabase RPC.
 * Usa Apache ECharts para renderizar el gráfico.
 * 
 * PROPS:
 * - data: Array<{comuna: string, value: number}> - Datos de comunas y valores
 * - title?: string - Título del gráfico (opcional)
 * - loading?: boolean - Mostrar estado de carga (opcional)
 */

'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

export default function ComunaBarChart({ 
  data = [], 
  title = 'Distribución por Comuna',
  loading = false,
  controls = null
}) {
  const cardStyle = {
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  }

  // Ordenar datos de mayor a menor
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    return [...data].sort((a, b) => b.value - a.value)
  }, [data])

  /** Altura según cantidad de comunas (barras horizontales legibles en pantalla e impresión). */
  const chartHeight = useMemo(() => {
    const n = sortedData.length
    if (n === 0) return 400
    return Math.min(900, Math.max(300, 110 + n * 54))
  }, [sortedData.length])

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
        left: '22%',
        right: '6%',
        bottom: '4%',
        top: '14%',
        containLabel: false
      },
      xAxis: {
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
      yAxis: {
        type: 'category',
        data: sortedData.map(d => d.comuna),
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      series: [
        {
          name: 'Total Personas',
          type: 'bar',
          data: sortedData.map(d => d.value),
          barMaxWidth: 26,
          barCategoryGap: '28%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#0d9488' },
                { offset: 1, color: '#14b8a6' }
              ]
            },
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
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
        {controls && (
          <div
            className="dashboardChartControls no-print"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
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
          height: '360px',
          color: '#64748b'
        }}>
          Cargando gráfico...
        </div>
      </div>
    )
  }

  if (sortedData.length === 0) {
    return (
      <div style={cardStyle} className="dashboardChartCard">
        {controls && (
          <div
            className="dashboardChartControls no-print"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
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
          height: '360px',
          color: '#64748b'
        }}>
          No hay datos disponibles
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
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}
        >
          {controls}
        </div>
      )}
      <ReactECharts
        className="dashboardEchartHost dashboardEchartHostBar"
        option={option}
        style={{ height: `${chartHeight}px`, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
