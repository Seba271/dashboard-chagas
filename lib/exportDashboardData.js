/**
 * Exportación CSV para series temporales (casos) y ranking por comuna.
 */
import { downloadCsv } from '@/lib/csvExport'

export function exportCasesSeriesCsv(casesData, prevCasesData, filename = 'casos_temporal.csv') {
  const rows = []
  const prevMap = new Map((prevCasesData || []).map((r) => [r.month, r.value]))
  for (const row of casesData || []) {
    rows.push({
      fecha: row.month,
      casos: row.value,
      casos_ano_anterior: prevMap.get(row.month) ?? ''
    })
  }
  downloadCsv(rows, [
    { key: 'fecha', label: 'Fecha' },
    { key: 'casos', label: 'Casos' },
    { key: 'casos_ano_anterior', label: 'Casos año anterior' }
  ], filename)
}

export function exportComunaRankingCsv(data, filename = 'casos_por_comuna.csv') {
  const total = (data || []).reduce((s, r) => s + (Number(r.value) || 0), 0)
  const rows = (data || []).map((r) => ({
    comuna: r.comuna,
    total_casos: r.value,
    porcentaje: total > 0 ? ((Number(r.value) / total) * 100).toFixed(2) : '0'
  }))
  downloadCsv(rows, [
    { key: 'comuna', label: 'Comuna' },
    { key: 'total_casos', label: 'Total casos' },
    { key: 'porcentaje', label: '% del total' }
  ], filename)
}
