/**
 * Mapper de ocupación vía FK `id_ocupacion` → `catalogo_ocupaciones`.
 * Fuente oficial del nombre: `catalogo_ocupaciones.nombre`.
 */

function normalizeCatalogEmbed(raw) {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

export function mapCasoOcupacionFromRow(r) {
  const co = normalizeCatalogEmbed(r?.catalogo_ocupaciones)
  return {
    id_ocupacion: r?.id_ocupacion ?? null,
    ocupacion_codigo: co?.codigo ?? null,
    ocupacion_nombre: co?.nombre ?? 'Sin ocupación'
  }
}

/** Etiqueta para UI (mapa, tooltips, tablas). */
export function ocupacionLabelFromCaso(caso) {
  return caso?.ocupacion_nombre ?? 'Sin ocupación'
}
