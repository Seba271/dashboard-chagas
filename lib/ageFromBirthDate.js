/**
 * Edad en años cumplidos a una fecha de referencia (solo calendario, sin TZ).
 */

function parseCalendarDateParts(iso) {
  if (iso == null) return null
  const s = typeof iso === 'string' ? iso.slice(0, 10) : ''
  const parts = s.split('-')
  if (parts.length !== 3) return null
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

/**
 * Devuelve edad cumplida (entero) la fecha refIso, o null si faltan datos o ref < nacimiento.
 *
 * @param {string|null|undefined} fechaNacimientoIso  'YYYY-MM-DD'
 * @param {string|null|undefined} refIso                'YYYY-MM-DD' (p. ej. fecha_registro)
 */
export function ageCompletedAtReference(fechaNacimientoIso, refIso) {
  const dob = parseCalendarDateParts(fechaNacimientoIso)
  const ref = parseCalendarDateParts(refIso)
  if (!dob || !ref) return null
  if (
    dob.y > ref.y ||
    (dob.y === ref.y && (dob.mo > ref.mo || (dob.mo === ref.mo && dob.d > ref.d)))
  ) {
    return null
  }
  let age = ref.y - dob.y
  if (ref.mo < dob.mo || (ref.mo === dob.mo && ref.d < dob.d)) age--
  return age
}
