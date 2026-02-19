/**
 * ============================================================================
 * HOOK: useGeoPoints
 * ============================================================================
 * 
 * Hook personalizado para obtener puntos geográficos desde Supabase RPC.
 * 
 * FUNCIONALIDADES:
 * - Llama al RPC get_geo_points() de Supabase
 * - Maneja estados de loading y error
 * - Permite recargar datos con refetch
 * 
 * PARÁMETROS:
 * - limit: int - Número máximo de puntos a obtener (default: 2000)
 * 
 * RETORNA:
 * {
 *   data: Array<{lat: number, lon: number}> | null
 *   loading: boolean
 *   error: string | null
 *   refetch: Function
 * }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useGeoPoints(limit = 2000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_geo_points
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_geo_points',
        { p_limit: limit }
      )

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener puntos geográficos')
      }

      if (!rpcData) {
        throw new Error('No se recibieron datos del servidor')
      }

      // Transformar datos para el formato esperado por el mapa
      // Filtrar puntos inválidos
      const transformedData = rpcData
        .filter(item => 
          item.lat != null && 
          item.lon != null &&
          typeof item.lat === 'number' &&
          typeof item.lon === 'number' &&
          item.lat >= -90 && item.lat <= 90 &&
          item.lon >= -180 && item.lon <= 180
        )
        .map(item => ({
          lat: item.lat,
          lng: item.lon // Leaflet usa 'lng' en lugar de 'lon'
        }))

      setData(transformedData)
    } catch (err) {
      setError(err.message || 'Error al cargar puntos geográficos')
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
