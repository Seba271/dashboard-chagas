/**
 * ============================================================================
 * HOOK: useMapPoints
 * ============================================================================
 * 
 * Hook personalizado para obtener puntos geográficos anonimizados para el mapa.
 * 
 * FUNCIONALIDADES:
 * - Llama al RPC get_map_points() de Supabase
 * - Maneja estados de loading y error
 * - Permite recargar datos con refetch
 * 
 * PARÁMETROS:
 * - yearFilter: 'all' | '2025' | '2026' | string numérico de año
 * - caseType: 'all' | 'agudo' | 'bajo_control' | 'gestante'
 * - sex: 'all' | 'M' | 'F'
 * - ageGroup: 'all' | '0_14' | '15_29' | '30_44' | '45_59' | '60_plus'
 * 
 * RETORNA:
 * {
 *   data: Array<{lat: number, lon: number, comuna: string, provincia: string, category: string}> | null
 *   loading: boolean
 *   error: string | null
 *   refetch: Function
 * }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useMapPoints(yearFilter = 'all', caseType = 'all', sex = 'all', ageGroup = 'all') {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      const params = { p_limit: 2000 }
      if (yearFilter && yearFilter !== 'all') {
        const parsed = parseInt(yearFilter, 10)
        if (!Number.isNaN(parsed)) {
          params.p_year = parsed
        }
      }

      if (caseType && caseType !== 'all') {
        params.p_case_type = caseType
      }

      if (sex && sex !== 'all') {
        params.p_sex = sex
      }

      if (ageGroup && ageGroup !== 'all') {
        params.p_age_group = ageGroup
      }

      // Llamar al RPC get_map_points (solo casos, opcionalmente filtrados por año)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_map_points',
        params
      )

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener puntos del mapa')
      }

      if (!rpcData) {
        throw new Error('No se recibieron datos del servidor')
      }

      // Transformar datos para el formato esperado por el mapa (incl. flag caso nuevo = mes actual)
      const transformedData = rpcData.map(item => ({
        lat: item.lat,
        lng: item.lon,
        comuna: item.comuna || 'Sin comuna',
        provincia: item.provincia || 'Sin provincia',
        category: item.category || 'persona',
        isNewCase: !!item.es_caso_nuevo,
        title: `${item.comuna || 'Sin comuna'} (${item.category})`,
        description: `Provincia: ${item.provincia || 'Sin provincia'}`
      }))

      setData(transformedData)
    } catch (err) {
      setError(err.message || 'Error al cargar puntos del mapa')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [yearFilter, caseType, sex, ageGroup])

  // Cargar datos al montar o cuando cambie el filtro de año, tipo de caso, sexo o grupo etario
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
