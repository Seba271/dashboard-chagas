'use client'

/**
 * Pirámide poblacional (edad cumplida al registro × género).
 *
 * Eje Y: grupos etarios quinquenales (0–4 … 75–79 y 80+), desde `fecha_nacimiento` y `fecha_registro`.
 * Izquierda: Masculino y Otro apilados (valores negativos).
 * Derecha: Femenino y No informa apilados (valores positivos).
 *
 * Sin fecha de nacimiento o género no reconocido: pie del gráfico.
 *
 * Props:
 *   cases:   Array<{ fecha_nacimiento?: string, fecha_registro?: string, genero?: string }>
 *   loading: boolean
 */

import { useMemo, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'
import { AGE_QUINQUENIAL_GROUPS } from '@/lib/caseEnums'

const AGE_BUCKETS = AGE_QUINQUENIAL_GROUPS.map((g) => ({ key: g.value, label: g.label }))

const barLabel = {
  show: true,
  position: 'inside',
  fontSize: 11,
  fontWeight: 700,
  color: '#ffffff',
  textBorderColor: 'rgba(15, 23, 42, 0.35)',
  textBorderWidth: 1
}

function ageGroupOf(edadCalculada) {
  const n = Number(edadCalculada)
  if (!Number.isFinite(n) || n < 0) return null
  const maxIdx = AGE_QUINQUENIAL_GROUPS.length - 1
  const i = Math.min(Math.floor(n / 5), maxIdx)
  return AGE_QUINQUENIAL_GROUPS[i]?.value ?? null
}

function emptyBuckets() {
  return AGE_BUCKETS.reduce(
    (m, b) => ({
      ...m,
      [b.key]: { masculino: 0, femenino: 0, otro: 0, noInforma: 0 }
    }),
    {}
  )
}

export default function AgeGenderPyramid({ cases = [], loading = false }) {
  const [forPrint, setForPrint] = useState(false)

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

  const {
    masculinoData,
    femeninoData,
    otroData,
    noInformaData,
    sinEdadCount,
    generoNoEnumCount,
    total
  } = useMemo(() => {
    const buckets = emptyBuckets()
    let sinEdad = 0
    let generoNoEnum = 0
    for (const c of cases || []) {
      const ag = ageGroupOf(ageCompletedAtReference(c.fecha_nacimiento, c.fecha_registro))
      if (!ag) {
        sinEdad++
        continue
      }
      const g = c.genero
      if (g === 'masculino') buckets[ag].masculino++
      else if (g === 'femenino') buckets[ag].femenino++
      else if (g === 'otro') buckets[ag].otro++
      else if (g === 'no_informa') buckets[ag].noInforma++
      else generoNoEnum++
    }
    const m = AGE_BUCKETS.map((b) => buckets[b.key].masculino)
    const f = AGE_BUCKETS.map((b) => buckets[b.key].femenino)
    const o = AGE_BUCKETS.map((b) => buckets[b.key].otro)
    const ni = AGE_BUCKETS.map((b) => buckets[b.key].noInforma)
    const t = [...m, ...f, ...o, ...ni].reduce((s, v) => s + v, 0)
    return {
      masculinoData: m,
      femeninoData: f,
      otroData: o,
      noInformaData: ni,
      sinEdadCount: sinEdad,
      generoNoEnumCount: generoNoEnum,
      total: t
    }
  }, [cases])

  const maxAbs = useMemo(() => {
    let peak = 1
    for (let i = 0; i < AGE_BUCKETS.length; i++) {
      const left = (masculinoData[i] || 0) + (otroData[i] || 0)
      const right = (femeninoData[i] || 0) + (noInformaData[i] || 0)
      peak = Math.max(peak, left, right)
    }
    return peak + Math.max(1, Math.ceil(peak * 0.15))
  }, [masculinoData, femeninoData, otroData, noInformaData])

  const option = useMemo(() => {
    const labels = AGE_BUCKETS.map((b) => b.label)
    const totalSafe = Math.max(1, total)

    const titleBlock = forPrint
      ? {
          text: 'Pirámide poblacional',
          left: 'center',
          top: 6,
          textStyle: { color: '#1e293b', fontSize: 13, fontWeight: '600' }
        }
      : {
          text: 'Pirámide poblacional',
          subtext: 'Edad cumplida al registro · mismo filtro que el panel',
          left: 'center',
          top: 4,
          textStyle: { color: '#0f172a', fontSize: 15, fontWeight: 700 },
          subtextStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 400 }
        }

    const legendBlock = forPrint
      ? {
          data: ['Masculino', 'Otro', 'Femenino', 'No informa'],
          orient: 'horizontal',
          left: 'center',
          bottom: 4,
          top: 'auto',
          itemWidth: 12,
          itemHeight: 8,
          itemGap: 10,
          textStyle: { color: '#475569', fontSize: 10 }
        }
      : {
          data: ['Masculino', 'Otro', 'Femenino', 'No informa'],
          top: 54,
          left: 'center',
          itemWidth: 14,
          itemHeight: 10,
          itemGap: 20,
          icon: 'roundRect',
          textStyle: { color: '#475569', fontSize: 12, fontWeight: 500 }
        }

    const gridBlock = forPrint
      ? { left: 56, right: 56, bottom: 72, top: 48, containLabel: true }
      : { left: '8%', right: '8%', bottom: '7%', top: '20%', containLabel: true }

    const shadowL = { shadowBlur: 6, shadowColor: 'rgba(15, 23, 42, 0.12)', shadowOffsetX: -2, shadowOffsetY: 0 }
    const shadowR = { shadowBlur: 6, shadowColor: 'rgba(15, 23, 42, 0.12)', shadowOffsetX: 2, shadowOffsetY: 0 }

    return {
      animationDuration: 420,
      animationEasing: 'cubicOut',
      title: titleBlock,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#334155', fontSize: 12 },
        formatter: (params) => {
          if (!params?.length) return ''
          const ageLabel = params[0]?.name ?? ''
          const rows = params.filter((p) => Math.abs(Number(p.value) || 0) > 0)
          if (!rows.length) {
            return `<div style="font-weight:600">${ageLabel}</div><div style="margin-top:4px;color:#64748b">Sin casos en este tramo</div>`
          }
          const lines = rows
            .map((p) => {
              const abs = Math.abs(p.value)
              const pctTxt = ((abs / totalSafe) * 100).toFixed(1)
              return `<div style="display:flex;align-items:center;gap:8px;line-height:1.4;margin-top:2px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${p.color};flex-shrink:0"></span>
                  <span><strong>${p.seriesName}:</strong> ${abs.toLocaleString('es-CL')} · ${pctTxt}% del total</span>
                </div>`
            })
            .join('')
          return `<div style="font-weight:700;margin-bottom:6px">${ageLabel}</div>${lines}`
        }
      },
      legend: legendBlock,
      grid: gridBlock,
      xAxis: {
        type: 'value',
        min: -maxAbs,
        max: maxAbs,
        interval: Math.max(1, Math.ceil(maxAbs / 4)),
        name: 'Casos',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 600 },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          margin: 10,
          formatter: (v) => Math.abs(v).toString()
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: [4, 4] } },
        minorSplitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisTick: { alignWithLabel: true, length: 4, lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#334155', fontSize: 11, fontWeight: 600, margin: 14 },
        axisLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
        boundaryGap: true
      },
      series: [
        {
          name: 'Masculino',
          type: 'bar',
          stack: 'izquierda',
          data: masculinoData.map((v) => -v),
          barWidth: '68%',
          barCategoryGap: '24%',
          barMinWidth: 12,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#1d4ed8' },
                { offset: 1, color: '#60a5fa' }
              ]
            },
            borderRadius: [0, 0, 0, 0],
            ...shadowL
          },
          label: {
            ...barLabel,
            formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
          },
          emphasis: { focus: 'series', itemStyle: { shadowBlur: 10 } },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: { color: '#cbd5e1', width: 2, type: 'solid' },
            label: { show: false },
            data: [{ xAxis: 0 }]
          }
        },
        {
          name: 'Otro',
          type: 'bar',
          stack: 'izquierda',
          data: otroData.map((v) => -v),
          barWidth: '68%',
          barCategoryGap: '24%',
          barMinWidth: 12,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#7e22ce' },
                { offset: 1, color: '#c084fc' }
              ]
            },
            borderRadius: [6, 0, 0, 6],
            ...shadowL
          },
          label: {
            ...barLabel,
            formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
          },
          emphasis: { focus: 'series' }
        },
        {
          name: 'Femenino',
          type: 'bar',
          stack: 'derecha',
          data: femeninoData,
          barWidth: '68%',
          barCategoryGap: '24%',
          barMinWidth: 12,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#f472b6' },
                { offset: 1, color: '#db2777' }
              ]
            },
            borderRadius: [0, 0, 0, 0],
            ...shadowR
          },
          label: {
            ...barLabel,
            formatter: (p) => (p.value > 0 ? p.value : '')
          },
          emphasis: { focus: 'series' }
        },
        {
          name: 'No informa',
          type: 'bar',
          stack: 'derecha',
          data: noInformaData,
          barWidth: '68%',
          barCategoryGap: '24%',
          barMinWidth: 12,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#cbd5e1' },
                { offset: 1, color: '#64748b' }
              ]
            },
            borderRadius: [0, 6, 6, 0],
            ...shadowR
          },
          label: {
            ...barLabel,
            formatter: (p) => (p.value > 0 ? p.value : '')
          },
          emphasis: { focus: 'series' }
        }
      ]
    }
  }, [masculinoData, femeninoData, otroData, noInformaData, maxAbs, total, forPrint])

  const cardClass = 'dashboardChartCard dashboardChartCard--pyramid'

  if (loading) {
    return (
      <div className={cardClass}>
        <SkeletonChart height={520} lines={8} />
      </div>
    )
  }

  const showFooter =
    sinEdadCount > 0 || generoNoEnumCount > 0

  if (total === 0 && !showFooter) {
    return (
      <div className={cardClass}>
        <div className="pyramidChartEmpty">
          No hay casos con edad conocida al registro (fecha de nacimiento) ni género para los filtros
          actuales
        </div>
      </div>
    )
  }

  if (total === 0 && showFooter) {
    return (
      <div className={cardClass}>
        <div className="pyramidChartEmpty">
          No hay casos con edad al registro en las categorías de género para graficar
        </div>
        <div className="pyramidChartFooter">
          {sinEdadCount > 0 && (
            <span>
              <strong>{sinEdadCount}</strong> sin fecha de nacimiento (edad no calculable)
            </span>
          )}
          {sinEdadCount > 0 && generoNoEnumCount > 0 && <span className="pyramidChartFooterSep">·</span>}
          {generoNoEnumCount > 0 && (
            <span>
              <strong>{generoNoEnumCount}</strong>{' '}
              {generoNoEnumCount === 1 ? 'caso con género no reconocido' : 'casos con género no reconocido'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <ReactECharts
        className="dashboardEchartHost dashboardEchartHost--pyramid"
        option={option}
        style={{ height: '560px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
      {showFooter && (
        <div className="pyramidChartFooter">
          {sinEdadCount > 0 && (
            <span>
              <strong>{sinEdadCount}</strong> sin fecha de nacimiento (fuera de la pirámide)
            </span>
          )}
          {sinEdadCount > 0 && generoNoEnumCount > 0 && <span className="pyramidChartFooterSep">·</span>}
          {generoNoEnumCount > 0 && (
            <span>
              <strong>{generoNoEnumCount}</strong>{' '}
              {generoNoEnumCount === 1
                ? 'caso con género no reconocido'
                : 'casos con género no reconocido'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
