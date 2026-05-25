'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { canAccessDashboard, normalizeDashboardRole } from '@/lib/dashboardRoles'
import { peekProfileBootstrap, clearProfileBootstrap } from '@/lib/profileBootstrap'

/**
 * Perfil en `public.profiles` (rol para UI: enlace admin).
 *
 * Si venís desde /login recién autorizado, `profileBootstrap` evita esperar un round-trip de
 * `profiles` idéntico al que ya ejecutó la página de login (mismo sessionStorage + peek).
 *
 * Siempre confirmamos contra Supabase y limpiamos bootstrap al terminar.
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

    const boot = peekProfileBootstrap(user.id)
    if (boot && boot.role != null && canAccessDashboard(boot.role)) {
      setProfile({ role: boot.role, email: boot.email ?? null })
      setDashboardAccess('allowed')
      setLoading(false)
    } else {
      setDashboardAccess('pending')
      setProfile(null)
      setLoading(true)
    }
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

        clearProfileBootstrap()
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
    canAccessDashboard: canAccessDashboardFlag,
  }
}
