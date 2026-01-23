/**
 * ============================================================================
 * HOOK: useSession
 * ============================================================================
 * 
 * Hook personalizado para manejar la sesión de autenticación de Supabase.
 * 
 * FUNCIONALIDADES:
 * - Obtiene la sesión actual del usuario
 * - Maneja estados de loading y error
 * - Redirige a /login si no hay sesión
 * - Escucha cambios en el estado de autenticación
 * 
 * RETORNA:
 * {
 *   user: User | null - Datos del usuario autenticado
 *   session: Session | null - Sesión completa de Supabase
 *   loading: boolean - Estado de carga
 *   error: string | null - Mensaje de error si existe
 * }
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'

export function useSession() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createSupabaseClient()
        
        // Obtener sesión actual
        const { data: { session: currentSession }, error: sessionError } = 
          await supabase.auth.getSession()

        if (sessionError) {
          setError('Error al verificar la sesión')
          setLoading(false)
          return
        }

        if (!currentSession) {
          // No hay sesión, redirigir a login
          router.push('/login')
          return
        }

        // Hay sesión válida
        setSession(currentSession)
        setUser(currentSession.user)
        setLoading(false)

        // Escuchar cambios en el estado de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, newSession) => {
            if (!newSession) {
              router.push('/login')
            } else {
              setSession(newSession)
              setUser(newSession.user)
            }
          }
        )

        // Limpiar suscripción al desmontar
        return () => {
          subscription.unsubscribe()
        }
      } catch (err) {
        setError('Error inesperado al verificar sesión')
        setLoading(false)
      }
    }

    checkSession()
  }, [router])

  return { user, session, loading, error }
}
