/**
 * Etiqueta corta para desplegables de sector.
 * Si la comuna es solo "Monte Patria" (todo el panel es esa comuna), no se repite.
 */
export function sectorOptionLabel(sector) {
  if (!sector) return ''
  const name = sector.nombre_sector?.trim() || `Sector ${sector.id_sector ?? ''}`
  const comuna = (sector.comuna || '').trim()
  if (!comuna) return name
  if (/^monte\s*patria$/i.test(comuna)) return name
  return `${name} — ${comuna}`
}
