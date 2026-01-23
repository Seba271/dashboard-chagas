/**
 * ============================================================================
 * COMPONENTE: TendencyChart
 * ============================================================================
 * 
 * Gráfico de línea/barra para mostrar tendencia temporal de indicadores.
 * Soporta múltiples series (Exámenes y Notificaciones).
 * Usa Apache ECharts para renderizar el gráfico.
 * 
 * PROPS:
 * - examsData: Array<{month: string, value: number}> - Datos de exámenes por mes
 * - notificationsData: Array<{month: string, value: number}> - Datos de notificaciones por mes
 * - title?: string - Título del gráfico (opcional)
 * - type?: 'line' | 'bar' - Tipo de gráfico (default: 'line')
 * - loading?: boolean - Mostrar estado de carga (opcional)
 */

'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

export default function TendencyChart({ 
  examsData = [],
  notificationsData = [],
  title = 'Tendencia Temporal',
  type = 'line',
  loading = false 
}) {
  // Combinar y normalizar datos de ambas series
  const chartData = useMemo(() => {
    // Obtener todos los meses únicos de ambas series
    const allMonths = new Set()
    
    examsData.forEach(item => allMonths.add(item.month))
    notificationsData.forEach(item => allMonths.add(item.month))
    
    const sortedMonths = Array.from(allMonths).sort()
    
    // Crear mapas para búsqueda rápida
    const examsMap = new Map(examsData.map(item => [item.month, item.value]))
    const notificationsMap = new Map(notificationsData.map(item => [item.month, item.value]))
    
    // Construir datos combinados
    return {
      months: sortedMonths,
      exams: sortedMonths.map(month => examsMap.get(month) || 0),
      notifications: sortedMonths.map(month => notificationsMap.get(month) || 0)
    }
  }, [examsData, notificationsData])

  // Formatear meses para mostrar (YYYY-MM -> MMM)
  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-')
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`
  }

  const option = useMemo(() => ({
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#667eea',
      borderWidth: 1,
      textStyle: {
        color: '#ffffff'
      },
      axisPointer: {
        type: type === 'line' ? 'line' : 'shadow',
        shadowStyle: {
          color: 'rgba(102, 126, 234, 0.2)'
        }
      }
    },
    legend: {
      data: ['Exámenes', 'Notificaciones'],
      top: '10%',
      textStyle: {
        color: 'rgba(255, 255, 255, 0.8)'
      }
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
      data: chartData.months.map(formatMonth),
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
        rotate: chartData.months.length > 12 ? 45 : 0
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)'
        }
      }
    },
    yAxis: {
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
    series: [
      {
        name: 'Exámenes',
        type: type,
        data: chartData.exams,
        smooth: type === 'line',
        itemStyle: {
          color: '#667eea'
        },
        areaStyle: type === 'line' ? {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
            ]
          }
        } : undefined,
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#8b9aff'
          }
        }
      },
      {
        name: 'Notificaciones',
        type: type,
        data: chartData.notifications,
        smooth: type === 'line',
        itemStyle: {
          color: '#10b981'
        },
        areaStyle: type === 'line' ? {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ]
          }
        } : undefined,
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#34d399'
          }
        }
      }
    ]
  }), [chartData, title, type])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        Cargando gráfico...
      </div>
    )
  }

  // Si no hay datos, mostrar mensaje
  if (chartData.months.length === 0) {
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
        height: '400px',
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
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
