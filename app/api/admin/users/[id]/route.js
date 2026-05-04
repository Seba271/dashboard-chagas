import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authAdminServer'
import { parseDashboardRoleFromBody } from '@/lib/dashboardRoles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH — Actualiza rol de un usuario (solo admin).
 * Body: { role: 'admin' | 'viewer' }
 */
export async function PATCH(request, { params }) {
  const { error, adminClient, user: actingAdmin } = await requireAdmin(request)
  if (error) return error

  const targetId = params?.id
  if (!targetId || typeof targetId !== 'string') {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  }

  if (actingAdmin?.id && targetId === actingAdmin.id) {
    return NextResponse.json(
      { error: 'No puedes modificar el rol de tu propia cuenta; permanece como administrador.' },
      { status: 400 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const role = parseDashboardRoleFromBody(body.role)

  try {
    const { data: admins, error: admErr } = await adminClient.from('profiles').select('id').eq('role', 'admin')

    if (admErr) throw admErr

    const adminIds = admins || []
    const isLastAdmin = adminIds.length === 1 && adminIds[0].id === targetId

    if (isLastAdmin && role !== 'admin') {
      return NextResponse.json(
        { error: 'No se puede cambiar el rol del único administrador restante' },
        { status: 400 }
      )
    }

    const { data: updated, error: upErr } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', targetId)
      .select('id')
      .maybeSingle()

    if (upErr) throw upErr
    if (!updated) {
      return NextResponse.json({ error: 'Usuario sin perfil en la tabla profiles' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      id: targetId,
      role,
      updated_by: actingAdmin?.email
    })
  } catch (e) {
    console.error('PATCH /api/admin/users/[id]:', e)
    return NextResponse.json({ error: e.message || 'Error al actualizar rol' }, { status: 500 })
  }
}
