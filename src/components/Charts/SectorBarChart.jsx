'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'

/**
 * Barras por sector (compacto, cabecera DOM alineada con la tabla Ranking al costado).
 *
 * data: Array<{ sector: string, value: number }>
 */
export default function SectorBarChart({
  data = [],
  title = 'Casos por sector',
  loading = false,
  controls = null
}) {
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    return [...data].sort((a, b) => {
      const cmp = (b.value || 0) - (a.value || 0)
      if (cmp !== 0) return cmp
      return (a.sector || '').localeCompare(b.sector || '', 'es')
    })
  }, [data])

  const chartHeight = 392

  const option = useMemo(() => {
    if (!sortedData.length) return null

    const n = sortedData.length
    const rotate = n > 8 ? 35 : 0
    const labelInterval = n > 30 ? Math.max(1, Math.ceil(n / 20)) : 0

    const barCategoryGap = n <= 6 ? '18%' : n <= 12 ? '24%' : '32%'
    const barMaxWidth = n <= 6 ? 52 : n <= 12 ? 44 : 36

    return {
      title: { show: false },
      animationDuration: 480,
      animationEasingUpdate: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(13,148,136,0.08)' }
        },
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#334155', fontSize: 12 },
        formatter: (params) => {
          const param = params[0]
          const v = Number(param.value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
          return `${param.name}\nCasos: ${v}`
        }
      },
      grid: {
        left: '4%',
        right: '6%',
        top: rotate ? '7%' : '6%',
        bottom: rotate ? '22%' : '12%',
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
          hideOverlap: true,
          fontWeight: 500
        },
        axisLine: { lineStyle: { color: '#ebeef4', width: 1 } },
        axisTick: { alignWithLabel: true, length: 3, lineStyle: { color: '#cbd5e1' } }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        name: 'Casos',
        nameTextStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 600 },
        nameGap: 11,
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (value) => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: [4, 4], width: 1 } }
      },
      series: [
        {
          name: 'Total casos',
          type: 'bar',
          data: sortedData.map((d) => d.value),
          barMaxWidth,
          barCategoryGap,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#2dd4bf' },
                { offset: 0.45, color: '#14b8a6' },
                { offset: 1, color: '#0d9488' }
              ]
            },
            borderRadius: [6, 6, 0, 0],
            shadowBlur: 12,
            shadowColor: 'rgba(13, 148, 136, 0.12)',
            shadowOffsetY: 4
          },
          label: {
            show: true,
            position: 'top',
            color: '#475569',
            fontSize: 11,
            fontWeight: 600,
            formatter: (params) => Number(params.value).toLocaleString('es-CL', { maximumFractionDigits: 0 })
          },
          emphasis: {
            focus: 'series',
            itemStyle: {
              shadowBlur: 18,
              shadowColor: 'rgba(13, 148, 136, 0.22)'
            }
          }
        }
      ]
    }
  }, [sortedData])

  const headRow = (
    <div className="dashboardSectorBarHead no-print">
      <h3 className="dashboardSectorBarHead__title">{title}</h3>
      {controls ? <div className="dashboardSectorBarHead__aside">{controls}</div> : null}
    </div>
  )

  if (loading) {
    return (
      <div className="dashboardChartCard dashboardChartCard--sectorBar">
        {headRow}
        <div className="dashboardSectorBarBody">
          <SkeletonChart height={360} lines={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboardChartCard dashboardChartCard--sectorBar">
      {headRow}
      <div className="dashboardSectorBarBody">
        {!sortedData.length ? (
          <div className="dashboardSectorBarEmpty">
            <p className="dashboardSectorBarEmpty__text">No hay casos para graficar con los filtros actuales.</p>
          </div>
        ) : (
          <ReactECharts
            className="dashboardEchartHost dashboardEchartHostBar"
            option={option}
            style={{ height: `${chartHeight}px`, width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        )}
      </div>
    </div>
  )
}
