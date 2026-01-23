/**
 * ============================================================================
 * HOOK: useKpiSummary
 * ============================================================================
 * 
 * Hook personalizado para obtener el resumen de KPIs desde Supabase.
 * 
 * FUNCIONALIDADES:
 * - Llama al RPC get_kpi_summary() de Supabase
 * - Maneja estados de loading y error
 * - Retorna los datos de KPIs en formato estructurado
 * 
 * RETORNA:
 * {
 *   kpiData: Object | null - Datos de KPIs
 *   loading: boolean - Estado de carga
 *   error: string | null - Mensaje de error si existe
 *   refetch: Function - Función para recargar los datos
 * }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useKpiSummary() {
  const [kpiData, setKpiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchKpiSummary = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createSupabaseClient()

      // Llamar al RPC get_kpi_summary()
      const { data, error: rpcError } = await supabase.rpc('get_kpi_summary')

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener KPIs')
      }

      if (!data) {
        throw new Error('No se recibieron datos del servidor')
      }

      setKpiData(data)
    } catch (err) {
      setError(err.message || 'Error al cargar los indicadores')
      setKpiData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchKpiSummary()
  }, [fetchKpiSummary])

  return {
    kpiData,
    loading,
    error,
    refetch: fetchKpiSummary
  }
}
