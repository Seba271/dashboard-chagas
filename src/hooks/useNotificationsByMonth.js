/**
 * ============================================================================
 * HOOK: useNotificationsByMonth
 * ============================================================================
 * 
 * Hook personalizado para obtener serie temporal de notificaciones por mes.
 * 
 * FUNCIONALIDADES:
 * - Llama al RPC get_notifications_by_month() de Supabase
 * - Maneja estados de loading y error
 * - Permite recargar datos con refetch
 * 
 * PARÁMETROS:
 * - months: int - Número de meses a obtener (default: 12)
 * 
 * RETORNA:
 * {
 *   data: Array<{month: string, total_notifications: number}> | null
 *   loading: boolean
 *   error: string | null
 *   refetch: Function
 * }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useNotificationsByMonth(months = 12) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_notifications_by_month
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_notifications_by_month',
        { p_months: months }
      )

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener datos de notificaciones')
      }

      if (!rpcData) {
        throw new Error('No se recibieron datos del servidor')
      }

      // Transformar datos para el formato esperado por el gráfico
      const transformedData = rpcData.map(item => ({
        month: item.month,
        value: item.total_notifications
      }))

      setData(transformedData)
    } catch (err) {
      setError(err.message || 'Error al cargar datos de notificaciones')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [months])

  // Cargar datos al montar o cuando cambie el parámetro months
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}
