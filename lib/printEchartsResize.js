/**
 * ECharts no recalcula el layout al imprimir; redimensionamos todas las instancias visibles.
 * Los gráficos con layout propio en impresión se registran con registerDashboardPrintLayout.
 */
import * as echarts from 'echarts'

const printLayoutHandlers = new Set()

/** @param {(printMode: boolean) => void} fn */
export function registerDashboardPrintLayout(fn) {
  printLayoutHandlers.add(fn)
  return () => printLayoutHandlers.delete(fn)
}

/** Aplica layout de impresión de forma síncrona (antes de window.print). */
export function prepareDashboardForPrint() {
  printLayoutHandlers.forEach((fn) => {
    try {
      fn(true)
    } catch {
      /* ignore */
    }
  })
  resizeAllDashboardCharts()
}

/** Restaura layout de pantalla tras imprimir o cancelar. */
export function restoreDashboardAfterPrint() {
  printLayoutHandlers.forEach((fn) => {
    try {
      fn(false)
    } catch {
      /* ignore */
    }
  })
  resizeAllDashboardCharts()
}

function resizeDom(el) {
  try {
    const inst = echarts.getInstanceByDom(el)
    if (inst) inst.resize()
  } catch {
    /* ignore */
  }
}

export function resizeAllDashboardCharts() {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.dashboardEchartHost').forEach(resizeDom)
  document.querySelectorAll('.comunaSparklineChart').forEach(resizeDom)
}

export function schedulePrintChartResize() {
  prepareDashboardForPrint()
  requestAnimationFrame(() => {
    resizeAllDashboardCharts()
    setTimeout(resizeAllDashboardCharts, 0)
    setTimeout(resizeAllDashboardCharts, 100)
    setTimeout(resizeAllDashboardCharts, 300)
  })
}

export function openDashboardPrintDialog() {
  if (typeof window === 'undefined') return
  prepareDashboardForPrint()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      prepareDashboardForPrint()
      window.print()
    })
  })
}
