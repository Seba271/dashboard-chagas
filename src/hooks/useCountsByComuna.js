/**
 * ============================================================================
 * HOOK: useCountsByComuna
 * ============================================================================
 * 
 * Hook personalizado para obtener ranking de comunas por cantidad de personas.
 * 
 * FUNCIONALIDADES:
 * - Llama al RPC get_counts_by_comuna() de Supabase
 * - Maneja estados de loading y error
 * - Permite recargar datos con refetch
 * 
 * PARÁMETROS:
 * - limit: int - Número máximo de comunas a obtener (default: 10)
 * 
 * RETORNA:
 * {
 *   data: Array<{comuna: string, total_personas: number}> | null
 *   loading: boolean
 *   error: string | null
 *   refetch: Function
 * }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useCountsByComuna(limit = 10) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_counts_by_comuna
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_counts_by_comuna',
        { p_limit: limit }
      )

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener datos de comunas')
      }

      if (!rpcData) {
        throw new Error('No se recibieron datos del servidor')
      }

      // Transformar datos para el formato esperado por el gráfico
      const transformedData = rpcData.map(item => ({
        comuna: item.comuna,
        value: item.total_personas
      }))

      setData(transformedData)
    } catch (err) {
      setError(err.message || 'Error al cargar datos de comunas')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Cargar datos al montar o cuando cambie el parámetro limit
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
