/**
 * Exportación CSV del dashboard epidemiológico:
 * - Serie temporal de casos por fecha de registro.
 * - Ranking por sector (con comuna y porcentaje).
 * - Distribución por estado del caso.
 */
import { downloadCsv } from '@/lib/csvExport'

export function exportCasesSeriesCsv(casesData, filename = 'casos_temporal.csv') {
  const rows = (casesData || []).map((row) => ({
    fecha: row.month,
    casos: row.value
  }))
  downloadCsv(
    rows,
    [
      { key: 'fecha', label: 'Fecha' },
      { key: 'casos', label: 'Casos' }
    ],
    filename
  )
}

/** Dos columnas mensuales (primer día del mes) para año calendario vs año −1 en el mismo eje temporal. */
export function exportMonthlyYoYComparisonCsv(
  seriesCurr = [],
  seriesPrev = [],
  anchorYearRaw,
  filename = 'casos_yoy_calendario.csv'
) {
  const anchorYear = Number(anchorYearRaw)
  const yPrev = anchorYear - 1
  const rows = seriesCurr.map((row, i) => ({
    mes_primero_dia: row.month,
    [`casos_${anchorYear}`]: row.value ?? 0,
    [`casos_${yPrev}`]: (seriesPrev[i] && Number(seriesPrev[i].value)) || 0
  }))
  downloadCsv(
    rows,
    [
      { key: 'mes_primero_dia', label: 'Mes (inicio)' },
      { key: `casos_${anchorYear}`, label: `Casos ${anchorYear}` },
      { key: `casos_${yPrev}`, label: `Casos ${yPrev}` }
    ],
    filename
  )
}

export function exportSectorRankingCsv(data, filename = 'casos_por_sector.csv') {
  const total = (data || []).reduce((s, r) => s + (Number(r.value) || 0), 0)
  const rows = (data || []).map((r) => ({
    sector: r.sector ?? '',
    comuna: r.comuna ?? '',
    total_casos: r.value,
    porcentaje: total > 0 ? ((Number(r.value) / total) * 100).toFixed(2) : '0'
  }))
  downloadCsv(
    rows,
    [
      { key: 'sector', label: 'Sector' },
      { key: 'comuna', label: 'Comuna' },
      { key: 'total_casos', label: 'Total casos' },
      { key: 'porcentaje', label: '% del total' }
    ],
    filename
  )
}

export function exportEstadoBreakdownCsv(data, filename = 'casos_por_estado.csv') {
  const total = (data || []).reduce((s, r) => s + (Number(r.value) || 0), 0)
  const rows = (data || []).map((r) => ({
    estado: r.label ?? r.estado ?? '',
    total_casos: r.value,
    porcentaje: total > 0 ? ((Number(r.value) / total) * 100).toFixed(2) : '0'
  }))
  downloadCsv(
    rows,
    [
      { key: 'estado', label: 'Estado' },
      { key: 'total_casos', label: 'Total casos' },
      { key: 'porcentaje', label: '% del total' }
    ],
    filename
  )
}
