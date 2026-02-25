/**
 * ============================================================================
 * HOOK: useNotificationsByDateRange
 * ============================================================================
 * Obtiene serie temporal de notificaciones entre dos fechas (formato YYYY-MM-DD).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useNotificationsByDateRange(dateFrom, dateTo) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_notifications_by_date_range',
        { p_date_from: dateFrom, p_date_to: dateTo }
      )
      if (rpcError) throw new Error(rpcError.message || 'Error al obtener notificaciones')
      if (!rpcData) throw new Error('No se recibieron datos')
      setData(rpcData.map(item => ({ month: item.month, value: item.total_notifications })))
    } catch (err) {
      setError(err.message || 'Error al cargar notificaciones')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
