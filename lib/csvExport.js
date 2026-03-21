/**
 * Descarga un CSV en UTF-8 con BOM para Excel (columnas con acentos).
 */
export function downloadCsv(rows, columns, filename = 'export.csv') {
  if (!rows?.length) return

  const header = columns.map((c) => c.label).join(';')
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key]
        if (v == null) return ''
        const s = String(v)
        if (s.includes(';') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      })
      .join(';')
  )

  const bom = '\uFEFF'
  const csv = [header, ...lines].join('\r\n')
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
