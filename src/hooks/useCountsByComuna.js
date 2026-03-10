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
 * - caseType: 'all' | 'agudo' | 'bajo_control' | 'gestante'
 * - sex: 'all' | 'M' | 'F'
 * - ageGroup: 'all' | '0_14' | '15_29' | '30_44' | '45_59' | '60_plus'
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

export function useCountsByComuna(caseType = 'all', sex = 'all', ageGroup = 'all') {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_counts_by_comuna (solo casos, opcionalmente filtrados por tipo, sexo y grupo etario)
      const params = { p_limit: 50 }
      if (caseType && caseType !== 'all') {
        params.p_case_type = caseType
      }

      if (sex && sex !== 'all') {
        params.p_sex = sex
      }

      if (ageGroup && ageGroup !== 'all') {
        params.p_age_group = ageGroup
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_counts_by_comuna',
        params
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
  }, [caseType, sex, ageGroup])

  // Cargar datos al montar o cuando cambie el parámetro caseType, sex o ageGroup
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
