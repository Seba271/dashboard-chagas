/**
 * Roles en public.profiles para el panel web.
 * `none` = usuario en Auth pero sin acceso al dashboard (rechazado en login).
 */

export const DASHBOARD_ROLE = {
  ADMIN: 'admin',
  VIEWER: 'viewer',
  NONE: 'none'
}

const ALLOWED = new Set(['admin', 'viewer', 'none'])

export function normalizeDashboardRole(r) {
  return String(r ?? '')
    .trim()
    .toLowerCase()
}

/** Valida cuerpos API: admin | viewer | none */
export function parseDashboardRoleFromBody(bodyRole) {
  const n = normalizeDashboardRole(bodyRole)
  if (n === DASHBOARD_ROLE.ADMIN) return DASHBOARD_ROLE.ADMIN
  if (n === DASHBOARD_ROLE.NONE) return DASHBOARD_ROLE.NONE
  return DASHBOARD_ROLE.VIEWER
}

export function canAccessDashboard(role) {
  const n = normalizeDashboardRole(role)
  return n === DASHBOARD_ROLE.ADMIN || n === DASHBOARD_ROLE.VIEWER
}

export function isValidProfileRoleString(role) {
  return ALLOWED.has(normalizeDashboardRole(role))
}
