/**
 * KPIs «Programa y vigilancia» filtrados por panel (año, tipo, sexo, edad, comuna).
 * RPC: get_kpi_program_filtered (ver supabase/sql/get_kpi_program_filtered.sql).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

function normalizePayload(data) {
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

export function useKpiProgramFiltered(
  yearFilter = 'all',
  caseType = 'all',
  sex = 'all',
  ageGroup = 'all',
  comuna = ''
) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()

      const params = {}
      if (yearFilter && yearFilter !== 'all') {
        const y = parseInt(yearFilter, 10)
        if (!Number.isNaN(y)) params.p_year = y
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
      const c = (comuna || '').trim()
      if (c) params.p_comuna = c

      const { data: raw, error: rpcError } = await supabase.rpc('get_kpi_program_filtered', params)
      if (rpcError) throw new Error(rpcError.message || 'Error al obtener KPIs de programa')

      const row = normalizePayload(raw)
      if (!row) throw new Error('No se recibieron datos del servidor')
      setData(row)
    } catch (err) {
      setError(err.message || 'Error al cargar indicadores de programa')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [yearFilter, caseType, sex, ageGroup, comuna])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
