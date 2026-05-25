'use client'

/** Vista administradores: usuarios con acceso al panel epidemiológico. */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/src/hooks/useSession'
import { useProfile } from '@/src/hooks/useProfile'
import { adminFetch } from '@/lib/adminFetch'

function emailInitial(email) {
  const s = (email || '').trim()
  if (!s) return '?'
  return s.charAt(0).toUpperCase()
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'admin') return 'Administrador'
  if (r === 'none') return 'Sin acceso'
  return 'Solo lectura'
}

function AdminUsersSkeleton() {
  return (
    <div className="adminUserTableWrap adminUserTableWrap--skeleton" aria-hidden>
      <table className="adminUserTable">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Último acceso</th>
            <th>Creado en</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className="adminUserCell">
                  <span className="skeletonShimmer adminSkeletonAvatar" />
                  <span className="skeletonShimmer adminSkeletonLine adminSkeletonLine--email" />
                </div>
              </td>
              <td>
                <span className="skeletonShimmer adminSkeletonLine adminSkeletonLine--role" />
              </td>
              <td>
                <span className="skeletonShimmer adminSkeletonLine adminSkeletonLine--date" />
              </td>
              <td>
                <span className="skeletonShimmer adminSkeletonLine adminSkeletonLine--date" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, loading: sessionLoading, error: sessionError } = useSession()
  const { loading: profileLoading, isAdmin } = useProfile(user)

  const [users, setUsers] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createOk, setCreateOk] = useState(null)

  const [rowSaving, setRowSaving] = useState(null)
  const [rowError, setRowError] = useState(null)

  const loadUsers = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await adminFetch('/api/admin/users')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setUsers(json.users || [])
    } catch (e) {
      setListError(e.message || 'Error al cargar usuarios')
      setUsers([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || profileLoading) return
    if (!user) return
    if (!isAdmin) return
    loadUsers()
  }, [sessionLoading, profileLoading, user, isAdmin, loadUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateOk(null)
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        body: { email: email.trim(), password, role: newRole }
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setCreateOk(`Usuario creado: ${json.user?.email ?? email}`)
      setEmail('')
      setPassword('')
      setNewRole('viewer')
      await loadUsers()
    } catch (err) {
      setCreateError(err.message || 'No se pudo crear el usuario')
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (userId, nextRole, previousRole) => {
    if (user?.id && userId === user.id) return
    if (nextRole === previousRole) return
    setRowSaving(userId)
    setRowError(null)
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: { role: nextRole }
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)))
    } catch (err) {
      setRowError(err.message || 'No se pudo guardar el rol.')
      await loadUsers()
    } finally {
      setRowSaving(null)
    }
  }

  if (sessionLoading || (user && profileLoading)) {
    return (
      <div className="dashboardStateScreen adminStateScreen">
        <div className="adminStateSpinner" aria-hidden />
        <p>Comprobando sesión…</p>
      </div>
    )
  }

  if (sessionError && !user) {
    return (
      <div className="dashboardStateScreen">
        <div className="dashboardStateCard">
          <p className="dashboardStateError">{sessionError}</p>
          <Link href="/login" className="dashboardStateBtnPrimary">
            Ir a Login
          </Link>
        </div>
      </div>
    )
  }

  if (user && !profileLoading && !isAdmin) {
    return (
      <div className="dashboard-shell dashboardPageRoot">
        <header className="dashboardPageHeader no-print">
          <div className="dashboardPageHeaderTitles">
            <span className="adminPageEyebrow">Panel epidemiológico</span>
            <h1>Administración de usuarios</h1>
            <p>
              Tu cuenta <strong>no tiene permiso para administrar usuarios</strong> del panel. Solo quienes tienen rol de administrador
              pueden usar esta sección. Si necesitas ese acceso, contacta a quien administre el sistema de forma autorizada.
            </p>
          </div>
          <div className="dashboardPageHeaderActions">
            <div className="dashboardHeaderTools">
              <Link href="/dashboard" className="dashboardHeaderBtn dashboardHeaderBtn--secondary">
                <svg className="dashboardHeaderBtnIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor" />
                </svg>
                Volver al panel
              </Link>
            </div>
          </div>
        </header>
        <main className="dashboardMain adminAccessHint">
          <div className="adminRestrictedCard">
            <div className="adminRestrictedIcon" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M7 11V8a5 5 0 0 1 10 0v3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="16" r="1.25" fill="currentColor" />
              </svg>
            </div>
            <h2 className="adminRestrictedTitle">Acceso restringido</h2>
            <p className="adminRestrictedLead">
              Esta sección es solo para administradores del panel. Si necesitas permisos adicionales, solicítalos por los canales oficiales de
              tu institución.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-shell dashboardPageRoot">
      <header className="dashboardPageHeader no-print adminPageHeader">
        <div className="dashboardPageHeaderTitles">
          <span className="adminPageEyebrow">Panel epidemiológico · administración</span>
          <h1>Usuarios y accesos</h1>
          <p>
            Crea cuentas y asigna permisos para quienes usan este <strong>dashboard web</strong>. Los cambios de rol se aplican de inmediato.
          </p>
        </div>
        <div className="dashboardPageHeaderActions">
          <div className="dashboardHeaderTools">
            <Link href="/dashboard" className="dashboardHeaderBtn dashboardHeaderBtn--secondary">
              <svg className="dashboardHeaderBtnIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor" />
              </svg>
              Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <main className="dashboardMain adminPageMain">
        <section className="adminRolesLegend" aria-labelledby="admin-roles-legend-title">
          <h2 id="admin-roles-legend-title" className="adminRolesLegendTitle">
            Qué significa cada rol
          </h2>
          <ul className="adminRolesLegendList">
            <li className="adminRoleCard adminRoleCard--admin">
              <span className="adminRoleCardName">Administrador</span>
              <span className="adminRoleCardDesc">Indicadores, impresión y gestión de usuarios del panel.</span>
            </li>
            <li className="adminRoleCard adminRoleCard--viewer">
              <span className="adminRoleCardName">Solo lectura</span>
              <span className="adminRoleCardDesc">Consultar el panel sin administrar cuentas.</span>
            </li>
            <li className="adminRoleCard adminRoleCard--none">
              <span className="adminRoleCardName">Sin privilegios</span>
              <span className="adminRoleCardDesc">No puede ingresar al panel aunque la contraseña sea válida.</span>
            </li>
          </ul>
        </section>

        <section className="adminSurface" aria-labelledby="admin-create-heading">
          <div className="adminSurfaceHead">
            <h2 id="admin-create-heading" className="adminSurfaceTitle">
              Nueva cuenta
            </h2>
            <p className="adminSurfaceLead">
              Correo, contraseña inicial y rol. Si eliges <strong>sin privilegios</strong>, la persona no podrá ingresar al panel.
            </p>
          </div>

          <form className="adminUserForm" onSubmit={handleCreate}>
            <div className="adminUserFormGrid">
              <label className="adminUserField">
                <span>Correo electrónico</span>
                <input
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nombre@institución.cl"
                  className="adminUserInput"
                />
              </label>
              <label className="adminUserField">
                <span>Contraseña inicial</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="adminUserInput"
                />
                <span className="adminFieldHint">Compártela por un canal seguro; la persona podrá cambiarla al iniciar sesión.</span>
              </label>
              <label className="adminUserField adminUserField--full">
                <span>Rol asignado</span>
                <select className="adminUserInput adminUserInput--select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="viewer">Solo lectura — ver el panel epidemiológico</option>
                  <option value="admin">Administrador — panel + usuarios y roles</option>
                  <option value="none">Sin privilegios — no puede iniciar sesión en el panel</option>
                </select>
              </label>
            </div>
            <div className="adminFormActions">
              <button type="submit" className="dashboardStateBtnPrimary adminUserSubmit" disabled={creating}>
                {creating ? 'Creando cuenta…' : 'Crear acceso al panel'}
              </button>
            </div>
          </form>
          {createError && (
            <p className="adminUserMsg adminUserMsg--error adminUserMsg--boxed" role="alert">
              {createError}
            </p>
          )}
          {createOk && (
            <p className="adminUserMsg adminUserMsg--ok adminUserMsg--boxed" role="status">
              {createOk}
            </p>
          )}
        </section>

        <section className="adminSurface" aria-labelledby="admin-list-heading">
          <div className="adminSurfaceHead adminSurfaceHead--toolbar">
            <div>
              <h2 id="admin-list-heading" className="adminSurfaceTitle">
                Cuentas registradas
              </h2>
              <p className="adminSurfaceLead">
                Elige otro rol en el menú desplegable para guardar al instante. La fila resaltada es tu sesión actual.
              </p>
            </div>
            <div className="adminListToolbar">
              {!listLoading && (
                <span className="adminListCount" aria-live="polite">
                  {users.length === 1 ? '1 cuenta' : `${users.length} cuentas`}
                </span>
              )}
              <button
                type="button"
                className="adminBtnGhost"
                onClick={() => loadUsers()}
                disabled={listLoading}
              >
                {listLoading ? 'Actualizando…' : 'Actualizar lista'}
              </button>
            </div>
          </div>

          {listError && <div className="dashboardErrorBox adminListError">{listError}</div>}

          {listLoading ? (
            <AdminUsersSkeleton />
          ) : users.length === 0 && !listError ? (
            <div className="adminEmptyState">
              <p className="adminEmptyStateTitle">No hay usuarios para mostrar</p>
              <p className="adminEmptyStateLead">Crea la primera cuenta con el formulario de arriba o revisa la conexión con el servidor.</p>
            </div>
          ) : (
            <div className="adminUserTableWrap">
              <table className="adminUserTable">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Último acceso</th>
                    <th>Creado en</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = Boolean(user?.id && u.id === user.id)
                    const r = String(u.role || '').toLowerCase()
                    return (
                      <tr key={u.id} className={isSelf ? 'adminUserTableRow--self' : undefined}>
                        <td>
                          <div className="adminUserCell">
                            <span className="adminUserAvatar" aria-hidden>
                              {emailInitial(u.email)}
                            </span>
                            <span className="adminUserEmailBlock">
                              <span className="adminUserEmail">{u.email || '—'}</span>
                              {isSelf && (
                                <span className="adminYouBadge">Tu cuenta</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          {isSelf ? (
                            <div className="adminRoleLocked">
                              <span
                                className={`adminRolePill adminRolePill--${['admin', 'viewer', 'none'].includes(r) ? r : 'viewer'}`}
                              >
                                {roleLabel(u.role)}
                              </span>
                              <span className="adminRoleLockedHint">Fijo para tu usuario</span>
                            </div>
                          ) : (
                            <div className="adminRoleCell">
                              <select
                                className="adminUserInput adminUserInput--inline"
                                value={u.role}
                                disabled={rowSaving === u.id}
                                onChange={(e) => handleRoleChange(u.id, e.target.value, u.role)}
                                aria-label={`Rol de ${u.email || 'usuario'}`}
                              >
                                <option value="viewer">Solo lectura</option>
                                <option value="admin">Administrador</option>
                                <option value="none">Sin privilegios</option>
                              </select>
                              {rowSaving === u.id && (
                                <span className="adminRowSaving" aria-live="polite">
                                  Guardando…
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="adminUserTableMuted">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString('es-CL', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            : '—'}
                        </td>
                        <td className="adminUserTableMuted">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleString('es-CL', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rowError && (
            <p className="adminUserMsg adminUserMsg--error adminUserMsg--boxed" role="alert">
              {rowError} La lista se actualizó; puedes intentar de nuevo.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
