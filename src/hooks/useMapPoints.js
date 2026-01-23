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
 * - limit: int - Número máximo de puntos a obtener (default: 1000)
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

export function useMapPoints(limit = 1000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_map_points
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_map_points',
        { p_limit: limit }
      )

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener puntos del mapa')
      }

      if (!rpcData) {
        throw new Error('No se recibieron datos del servidor')
      }

      // Transformar datos para el formato esperado por el mapa
      const transformedData = rpcData.map(item => ({
        lat: item.lat,
        lng: item.lon, // Leaflet usa 'lng' en lugar de 'lon'
        comuna: item.comuna || 'Sin comuna',
        provincia: item.provincia || 'Sin provincia',
        category: item.category || 'persona',
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
