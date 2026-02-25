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
        color: '#1e293b',
        fontSize: 15,
        fontWeight: '600'
      }
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
      data: ['Exámenes', 'Notificaciones'],
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
      data: chartData.months.map(formatMonth),
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        rotate: chartData.months.length > 12 ? 45 : 0
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
    series: [
      {
        name: 'Exámenes',
        type: type,
        data: chartData.exams,
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
      },
      {
        name: 'Notificaciones',
        type: type,
        data: chartData.notifications,
        smooth: type === 'line',
        itemStyle: { color: '#f59e0b' },
        areaStyle: type === 'line' ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.25)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.04)' }
            ]
          }
        } : undefined,
        emphasis: { focus: 'series', itemStyle: { color: '#d97706' } }
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
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        color: '#64748b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        Cargando gráfico...
      </div>
    )
  }

  if (chartData.months.length === 0) {
    return (
      <div style={{
        background: '#ffffff',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: '#64748b',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        No hay datos disponibles
      </div>
    )
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    }}>
      <ReactECharts
        option={option}
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
