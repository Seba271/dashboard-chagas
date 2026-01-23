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
  loading = false 
}) {
  // Ordenar datos de mayor a menor
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    return [...data].sort((a, b) => b.value - a.value)
  }, [data])

  const option = useMemo(() => {
    if (sortedData.length === 0) {
      return {
        title: {
          text: title,
          left: 'center',
          textStyle: {
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 'bold'
          }
        }
      }
    }

    return {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#667eea',
        borderWidth: 1,
        textStyle: {
          color: '#ffffff'
        },
        formatter: (params) => {
          const param = params[0]
          return `${param.name}<br/>${param.seriesName}: ${param.value.toLocaleString('es-CL')}`
        }
      },
      grid: {
        left: '25%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: false
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 12,
          formatter: (value) => value.toLocaleString('es-CL')
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.2)'
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'category',
        data: sortedData.map(d => d.comuna),
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 11
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.2)'
          }
        }
      },
      series: [
        {
          name: 'Total Personas',
          type: 'bar',
          data: sortedData.map(d => d.value),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 1, color: '#8b9aff' }
              ]
            },
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 11,
            formatter: (params) => params.value.toLocaleString('es-CL')
          },
          emphasis: {
            focus: 'series',
            itemStyle: {
              color: '#8b9aff'
            }
          }
        }
      ]
    }
  }, [sortedData, title])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '500px',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        Cargando gráfico...
      </div>
    )
  }

  if (sortedData.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '500px',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        No hay datos disponibles
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '1rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      <ReactECharts
        option={option}
        style={{ height: '500px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
