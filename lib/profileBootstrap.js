/**
 * Pasa datos de perfil conocidos tras el login desde /login hasta el primer montaje del
 * dashboard, para que useProfile pueda pintar sin esperar otra lectura a `profiles`.
 * Se limpia tras el primer fetch autoritativo desde Supabase.
 */

const KEY = 'chagas_dashboard_profile_bootstrap'

/** TTL: evita usar datos muy viejos si el usuario recarga o cambian roles en servidor */
const BOOTSTRAP_MAX_AGE_MS = 3 * 60 * 1000

/** @typedef {{ uid: string, role: string | null, email?: string | null }} ProfileBootstrap */

/**
 * Guarda antes de navegar al dashboard (mismo uid que sesión Supabase).
 * @param {string} uid
 * @param {{ role?: string | null, email?: string | null }} prof
 */
export function setProfileBootstrap(uid, prof) {
  if (typeof window === 'undefined' || !uid) return
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        uid,
        role: prof?.role ?? null,
        email: prof?.email ?? null,
        ts: Date.now(),
      })
    )
  } catch {
    /* almacenamiento lleno o modo privado */
  }
}

/**
 * Solo lectura (no borra): compatible con Strict Mode donde el efecto corre dos veces.
 * @param {string} uid
 * @returns {{ role: string | null, email: string | null } | null}
 */
export function peekProfileBootstrap(uid) {
  if (typeof window === 'undefined' || !uid) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.uid !== uid) return null
    const ts = typeof data.ts === 'number' ? data.ts : 0
    if (BOOTSTRAP_MAX_AGE_MS > 0 && Date.now() - ts > BOOTSTRAP_MAX_AGE_MS) {
      clearProfileBootstrap()
      return null
    }
    return { role: data.role ?? null, email: data.email ?? null }
  } catch {
    return null
  }
}

/** Quitar marca tras fetch de perfil desde red (dato autoritativo). */
export function clearProfileBootstrap() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* vacío */
  }
}
