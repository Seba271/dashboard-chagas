'use client'

/**
 * Pirámide poblacional (edad cumplida al registro × género).
 *
 * Eje Y: grupos etarios quinquenales (0–4 … 75–79 y 80+), desde `fecha_nacimiento` y `fecha_registro`.
 * Izquierda: Masculino y Otro apilados (valores negativos).
 * Derecha: Femenino y No informa apilados (valores positivos).
 *
 * Título y leyenda en HTML (fuera del canvas ECharts). El layout de impresión se aplica con
 * setOption síncrono (registerDashboardPrintLayout): React no alcanza a repintar antes del PDF.
 */

import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import ReactECharts from 'echarts-for-react'
import { SkeletonChart } from '@/src/components/Skeleton'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'
import { AGE_QUINQUENIAL_GROUPS } from '@/lib/caseEnums'
import { registerDashboardPrintLayout } from '@/lib/printEchartsResize'

const AGE_BUCKETS = AGE_QUINQUENIAL_GROUPS.map((g) => ({ key: g.value, label: g.label }))

const PYRAMID_HTML_LEGEND = [
  { label: 'Masculino', background: 'linear-gradient(90deg, #1d4ed8 0%, #60a5fa 100%)' },
  { label: 'Otro', background: 'linear-gradient(90deg, #7e22ce 0%, #c084fc 100%)' },
  { label: 'Femenino', background: 'linear-gradient(90deg, #f472b6 0%, #db2777 100%)' },
  { label: 'No informa', background: 'linear-gradient(90deg, #cbd5e1 0%, #64748b 100%)' }
]

const PYRAMID_CHART_PX = 480
const PYRAMID_CHART_PRINT_PX = 360

const barLabel = {
  show: true,
  position: 'inside',
  fontSize: 11,
  fontWeight: 700,
  color: '#ffffff',
  textBorderColor: 'rgba(15, 23, 42, 0.35)',
  textBorderWidth: 1
}

const barLabelPrint = { ...barLabel, fontSize: 10 }

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

const PYRAMID_LABEL_COL_PX = { screen: 54, print: 50 }

/** Márgenes iguales izq/der → la línea x=0 cae en el centro horizontal del contenedor */
function pyramidGrid(printMode) {
  const side = printMode ? PYRAMID_LABEL_COL_PX.print : PYRAMID_LABEL_COL_PX.screen
  return {
    left: side,
    right: side,
    top: printMode ? 4 : 10,
    bottom: printMode ? 28 : 48,
    containLabel: false
  }
}

function buildPyramidOption({
  labels,
  masculinoData,
  femeninoData,
  otroData,
  noInformaData,
  maxAbs,
  total,
  printMode = false
}) {
  const totalSafe = Math.max(1, total)
  const shadowL = printMode
    ? {}
    : { shadowBlur: 6, shadowColor: 'rgba(15, 23, 42, 0.12)', shadowOffsetX: -2, shadowOffsetY: 0 }
  const shadowR = printMode
    ? {}
    : { shadowBlur: 6, shadowColor: 'rgba(15, 23, 42, 0.12)', shadowOffsetX: 2, shadowOffsetY: 0 }
  const seriesLabel = printMode ? barLabelPrint : barLabel

  return {
    animation: !printMode,
    animationDuration: printMode ? 0 : 420,
    animationEasing: 'cubicOut',
    title: { show: false },
    legend: { show: false },
    tooltip: printMode
      ? { show: false }
      : {
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
    grid: pyramidGrid(printMode),
    xAxis: {
      type: 'value',
      min: -maxAbs,
      max: maxAbs,
      interval: Math.max(1, Math.ceil(maxAbs / 4)),
      name: 'Casos',
      nameLocation: 'middle',
      nameGap: printMode ? 20 : 28,
      nameTextStyle: { color: '#94a3b8', fontSize: printMode ? 10 : 11, fontWeight: 600 },
      axisLabel: {
        color: '#64748b',
        fontSize: printMode ? 10 : 11,
        margin: printMode ? 6 : 10,
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
      axisTick: { alignWithLabel: true, length: printMode ? 3 : 4, lineStyle: { color: '#e2e8f0' } },
      axisLabel: printMode
        ? {
            color: '#334155',
            fontSize: 8.5,
            fontWeight: 600,
            margin: 2,
            align: 'right',
            width: PYRAMID_LABEL_COL_PX.print - 4
          }
        : {
            color: '#334155',
            fontSize: 11,
            fontWeight: 600,
            margin: 8,
            align: 'right',
            width: PYRAMID_LABEL_COL_PX.screen - 6
          },
      axisLine: { lineStyle: { color: '#e2e8f0', width: 1 } },
      boundaryGap: true
    },
    series: [
      {
        name: 'Masculino',
        type: 'bar',
        stack: 'izquierda',
        data: masculinoData.map((v) => -v),
        barWidth: printMode ? '72%' : '68%',
        barCategoryGap: printMode ? '14%' : '24%',
        barMinWidth: printMode ? 6 : 12,
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
          ...seriesLabel,
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
        barWidth: printMode ? '72%' : '68%',
        barCategoryGap: printMode ? '14%' : '24%',
        barMinWidth: printMode ? 6 : 12,
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
          ...seriesLabel,
          formatter: (p) => (Math.abs(p.value) > 0 ? Math.abs(p.value) : '')
        },
        emphasis: { focus: 'series' }
      },
      {
        name: 'Femenino',
        type: 'bar',
        stack: 'derecha',
        data: femeninoData,
        barWidth: printMode ? '72%' : '68%',
        barCategoryGap: printMode ? '14%' : '24%',
        barMinWidth: printMode ? 6 : 12,
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
          ...seriesLabel,
          formatter: (p) => (p.value > 0 ? p.value : '')
        },
        emphasis: { focus: 'series' }
      },
      {
        name: 'No informa',
        type: 'bar',
        stack: 'derecha',
        data: noInformaData,
        barWidth: printMode ? '72%' : '68%',
        barCategoryGap: printMode ? '14%' : '24%',
        barMinWidth: printMode ? 6 : 12,
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
          ...seriesLabel,
          formatter: (p) => (p.value > 0 ? p.value : '')
        },
        emphasis: { focus: 'series' }
      }
    ]
  }
}

export default function AgeGenderPyramid({ cases = [], loading = false }) {
  const chartRef = useRef(null)
  const chartPayloadRef = useRef(null)
  const [printLayoutActive, setPrintLayoutActive] = useState(false)

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

  const labels = useMemo(() => AGE_BUCKETS.map((b) => b.label), [])

  chartPayloadRef.current = {
    labels,
    masculinoData,
    femeninoData,
    otroData,
    noInformaData,
    maxAbs,
    total
  }

  const option = useMemo(
    () =>
      buildPyramidOption({
        labels,
        masculinoData,
        femeninoData,
        otroData,
        noInformaData,
        maxAbs,
        total,
        printMode: printLayoutActive
      }),
    [
      labels,
      masculinoData,
      femeninoData,
      otroData,
      noInformaData,
      maxAbs,
      total,
      printLayoutActive
    ]
  )

  const applyChartLayout = useCallback((printMode) => {
    const payload = chartPayloadRef.current
    const inst = chartRef.current?.getEchartsInstance?.()
    if (!payload || !inst) return

    const dom = inst.getDom?.()
    const height = printMode ? PYRAMID_CHART_PRINT_PX : PYRAMID_CHART_PX
    const width = dom?.clientWidth || dom?.offsetWidth
    const nextOption = buildPyramidOption({ ...payload, printMode })

    flushSync(() => {
      setPrintLayoutActive(printMode)
    })

    inst.setOption(nextOption, {
      notMerge: false,
      lazyUpdate: false
    })

    if (width) inst.resize({ width, height })
    else inst.resize({ height })
  }, [])

  useEffect(() => registerDashboardPrintLayout(applyChartLayout), [applyChartLayout])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const onBeforePrint = () => applyChartLayout(true)
    const onAfterPrint = () => applyChartLayout(false)

    window.addEventListener('beforeprint', onBeforePrint, true)
    window.addEventListener('afterprint', onAfterPrint)

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint, true)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [applyChartLayout])

  const cardClass = 'dashboardChartCard dashboardChartCard--pyramid'

  if (loading) {
    return (
      <div className={cardClass}>
        <SkeletonChart height={520} lines={8} />
      </div>
    )
  }

  const showFooter = sinEdadCount > 0 || generoNoEnumCount > 0

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
      <div className="pyramidChartHead">
        <h3 className="pyramidChartTitle">Pirámide poblacional</h3>
        <p className="pyramidChartSubtitle">Edad cumplida al registro · mismo filtro que el panel</p>
        <ul className="pyramidChartLegend" aria-label="Leyenda del gráfico">
          {PYRAMID_HTML_LEGEND.map((item) => (
            <li key={item.label} className="pyramidChartLegendItem">
              <span className="pyramidChartLegendSwatch" style={{ background: item.background }} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <ReactECharts
        ref={chartRef}
        className="dashboardEchartHost dashboardEchartHost--pyramid"
        option={option}
        style={{
          height: `${printLayoutActive ? PYRAMID_CHART_PRINT_PX : PYRAMID_CHART_PX}px`,
          width: '100%'
        }}
        opts={{ renderer: 'svg' }}
        notMerge
        lazyUpdate={false}
        onChartReady={() => chartRef.current?.getEchartsInstance?.()?.resize()}
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
