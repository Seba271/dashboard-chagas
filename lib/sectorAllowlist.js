/**
 * Alcance territorial del dashboard: solo estos sectores (según `nombre_sector` en BD).
 * Coincidencia sin distinguir mayúsculas ni acentos.
 */

export const ALLOWED_SECTOR_CANONICAL_NAMES = ['Carén', 'El Palqui', 'Chañaral Alto', 'Monte Patria']

/** Otras denominaciones habituales en `nombre_sector` (equivalentes a las anteriores). */
export const ALLOWED_SECTOR_SYNONYMS = ['Palqui', 'Palqui Alto', 'Palqui Bajo']

function normalizeNombreSector(value) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

const ALLOWED_NORMALIZED = new Set(
  [...ALLOWED_SECTOR_CANONICAL_NAMES, ...ALLOWED_SECTOR_SYNONYMS].map(normalizeNombreSector)
)

export function isAllowedSectorRow(row) {
  return ALLOWED_NORMALIZED.has(normalizeNombreSector(row?.nombre_sector))
}

/** Filtra y ordena filas del catálogo `sectores`. */
export function filterSectorsToAllowedList(rows) {
  return (rows || []).filter(isAllowedSectorRow).sort((a, b) => {
    const na = a?.nombre_sector ?? ''
    const nb = b?.nombre_sector ?? ''
    return na.localeCompare(nb, 'es')
  })
}
