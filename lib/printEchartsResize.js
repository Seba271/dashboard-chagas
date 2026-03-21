/**
 * ECharts no recalcula el layout al imprimir; redimensionamos todas las instancias visibles.
 */
import * as echarts from 'echarts'

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
  resizeAllDashboardCharts()
  requestAnimationFrame(() => {
    resizeAllDashboardCharts()
    setTimeout(resizeAllDashboardCharts, 0)
    setTimeout(resizeAllDashboardCharts, 100)
    setTimeout(resizeAllDashboardCharts, 300)
    setTimeout(resizeAllDashboardCharts, 600)
  })
}
