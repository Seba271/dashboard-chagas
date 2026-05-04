'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { canAccessDashboard, normalizeDashboardRole } from '@/lib/dashboardRoles'

/**
 * Perfil en `public.profiles` (rol para UI: enlace admin).
 *
 * `dashboardAccess`: evita condición de carrera en el 1.er render (loading=false y profile=null
 * antes del fetch), que cerraba sesión incluso a admins.
 */
export function useProfile(user) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  /** pending = consultando; allowed = puede entrar; denied = sin fila o rol bloqueado */
  const [dashboardAccess, setDashboardAccess] = useState('pending')

  useLayoutEffect(() => {
    if (!user?.id) {
      setDashboardAccess('pending')
      setProfile(null)
      setLoading(false)
      return
    }
    setDashboardAccess('pending')
    setProfile(null)
    setLoading(true)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const supabase = createSupabaseClient()
    supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        const prof = error ? null : data
        if (error) console.warn('useProfile:', error.message)
        setProfile(prof)
        setLoading(false)
        if (!prof || !canAccessDashboard(prof.role)) {
          setDashboardAccess('denied')
        } else {
          setDashboardAccess('allowed')
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const roleNorm = normalizeDashboardRole(profile?.role)

  const canAccessDashboardFlag =
    !user || dashboardAccess === 'pending' || dashboardAccess === 'allowed'

  return {
    profile,
    loading,
    isAdmin: roleNorm === 'admin',
    canAccessDashboard: canAccessDashboardFlag
  }
}
