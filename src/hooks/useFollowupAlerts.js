'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Alertas de seguimiento (RPC get_followup_alerts).
 * Retorna: { controles_atrasados, gestantes_sin_seguimiento, inasistentes_30d }
 */
export function useFollowupAlerts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_followup_alerts')

      if (rpcError) throw new Error(rpcError.message || 'Error al cargar alertas')
      setData(rpcData || null)
    } catch (err) {
      setError(err.message || 'Error al cargar alertas de seguimiento')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return { data, loading, error, refetch: fetchAlerts }
}
