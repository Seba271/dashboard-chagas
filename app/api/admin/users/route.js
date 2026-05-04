import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authAdminServer'
import { parseDashboardRoleFromBody } from '@/lib/dashboardRoles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * GET — Lista usuarios de Auth + rol desde profiles.
 */
export async function GET(request) {
  const { error, adminClient } = await requireAdmin(request)
  if (error) return error

  try {
    const perPage = 500
    let page = 1
    const allUsers = []
    while (page <= 10) {
      const { data, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (listErr) throw listErr
      allUsers.push(...(data?.users || []))
      if (!data?.users?.length || data.users.length < perPage) break
      page++
    }

    const ids = allUsers.map((u) => u.id)
    const { data: profiles } = await adminClient.from('profiles').select('id, role').in('id', ids)
    const roleById = new Map((profiles || []).map((p) => [p.id, p.role]))

    const users = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: roleById.get(u.id) || 'viewer'
    }))

    return NextResponse.json({ users })
  } catch (e) {
    console.error('GET /api/admin/users:', e)
    return NextResponse.json({ error: e.message || 'Error al listar usuarios' }, { status: 500 })
  }
}

/**
 * POST — Crea usuario en Auth + perfil con rol.
 * Body: { email, password, role?: 'admin' | 'viewer' }
 */
export async function POST(request) {
  const { error, adminClient, user: actingAdmin } = await requireAdmin(request)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = parseDashboardRoleFromBody(body.role)

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  try {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }

    const uid = created?.user?.id
    if (!uid) {
      return NextResponse.json({ error: 'No se obtuvo id del usuario creado' }, { status: 500 })
    }

    const { error: upsertErr } = await adminClient.from('profiles').upsert(
      { id: uid, email, role },
      { onConflict: 'id' }
    )

    if (upsertErr) {
      console.error('Profile upsert:', upsertErr)
      return NextResponse.json(
        { error: `Usuario creado pero falló el perfil: ${upsertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: uid,
        email: created.user.email,
        role,
        created_by: actingAdmin?.email
      }
    })
  } catch (e) {
    console.error('POST /api/admin/users:', e)
    return NextResponse.json({ error: e.message || 'Error al crear usuario' }, { status: 500 })
  }
}
