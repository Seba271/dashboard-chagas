/**
 * Filtro de ocupación exclusivamente por FK `casos_epidemiologicos.id_ocupacion`.
 * `id_ocupacion` es bigint en PostgreSQL: se envía como string a PostgREST.
 */

/** Convierte el valor del <select> ("19") a string id o null. */
export function parseOcupacionFilterId(ocupacionFilter) {
  if (ocupacionFilter == null || ocupacionFilter === '' || ocupacionFilter === 'all') {
    return null
  }
  const s = String(ocupacionFilter).trim()
  if (!/^\d+$/.test(s)) return null
  return s
}

/**
 * Aplica `.eq('id_ocupacion', id)` sobre la consulta de casos.
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder} query
 */
export function applyOcupacionQueryFilter(query, ocupacionFilter) {
  const id = parseOcupacionFilterId(ocupacionFilter)
  if (id == null) return query
  return query.eq('id_ocupacion', id)
}
