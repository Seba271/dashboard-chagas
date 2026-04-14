/**
 * ============================================================================
 * HOOK: useCasesByDateRange
 * ============================================================================
 * get_cases_by_date_range:
 * - Serie por DATE(creado_en): UNION agudo/bc/gestantes, COUNT(DISTINCT id_persona) por día (como casos_por_fecha en KPI).
 * - Filtros de panel: tipo, sexo, edad, comuna.
 * - Si yearFilter !== 'all' → p_year (año calendario; fechas explícitas NULL).
 * - Si yearFilter === 'all' → p_date_from y p_date_to (p_year NULL).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

export function useCasesByDateRange(
  dateFrom,
  dateTo,
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
    const useYear = yearFilter && yearFilter !== 'all'
    const y = useYear ? parseInt(yearFilter, 10) : NaN

    if (useYear && Number.isNaN(y)) {
      setLoading(false)
      return
    }
    if (!useYear && (!dateFrom || !dateTo)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()

      const c = (comuna || '').trim()
      const params = {
        p_date_from: useYear ? null : dateFrom,
        p_date_to: useYear ? null : dateTo,
        p_year: useYear ? y : null,
        p_case_type: caseType === 'all' ? null : caseType,
        p_sex: sex === 'all' ? null : sex,
        p_age_group: ageGroup === 'all' ? null : ageGroup,
        p_comuna: c || null
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_cases_by_date_range', params)
      if (rpcError) throw new Error(rpcError.message || 'Error al obtener casos')
      const rows = Array.isArray(rpcData) ? rpcData : []
      setData(
        rows.map((item) => {
          const d = item.dia ?? item.day
          return { month: d, value: Number(item.total_casos) || 0 }
        })
      )
    } catch (err) {
      setError(err.message || 'Error al cargar casos')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, yearFilter, caseType, sex, ageGroup, comuna])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
