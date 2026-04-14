/**
 * ============================================================================
 * HOOK: useKpiSummary
 * ============================================================================
 * Resumen de KPIs vía get_kpi_summary() sin parámetros (compatible con BD actual).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

function normalizeKpiPayload(data) {
  if (data == null) return null
  if (Array.isArray(data)) return data[0] ?? null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return data
}

export function useKpiSummary() {
  const [kpiData, setKpiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchKpiSummary = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data, error: rpcError } = await supabase.rpc('get_kpi_summary')

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al obtener KPIs')
      }

      const row = normalizeKpiPayload(data)
      if (!row) {
        throw new Error('No se recibieron datos del servidor')
      }

      setKpiData(row)
    } catch (err) {
      setError(err.message || 'Error al cargar los indicadores')
      setKpiData(null)
    } finally {
      setLoading(false)
    }
  }, [])

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
