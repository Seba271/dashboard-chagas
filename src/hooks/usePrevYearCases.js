'use client'

/**
 * Trae la serie de casos del PERÍODO ESPEJO del año anterior, con los mismos
 * filtros que el dataset principal (sector, estado, género, grupo etario, ocupación por FK).
 */

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { ageGroupRange } from '@/lib/caseEnums'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'
import { applyOcupacionQueryFilter } from '@/lib/ocupacionFilter'

function shiftYearStr(dateStr, delta) {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const parts = dateStr.slice(0, 10).split('-')
  if (parts.length !== 3) return ''
  const y = parseInt(parts[0], 10)
  if (Number.isNaN(y)) return ''
  return `${y + delta}-${parts[1]}-${parts[2]}`
}

function computePrevRange({ yearFilter, dateFrom, dateTo }) {
  if (yearFilter && yearFilter !== 'all') {
    const y = parseInt(yearFilter, 10)
    if (Number.isNaN(y)) return null
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  }
  if (dateFrom && dateTo) {
    const from = shiftYearStr(dateFrom, -1)
    const to = shiftYearStr(dateTo, -1)
    if (!from || !to) return null
    return { from, to }
  }
  return null
}

export function usePrevYearCases({
  yearFilter = 'all',
  dateFrom = '',
  dateTo = '',
  sectorId = 'all',
  estadoFilter = 'all',
  generoFilter = 'all',
  ageGroupFilter = 'all',
  ocupacionFilter = 'all',
  enabled = true,
  limit = 5000,
  sectorScopeReady = true,
  sectorScopeIds = undefined
} = {}) {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setSeries([])
      return
    }
    if (!sectorScopeReady) {
      setSeries([])
      return
    }
    if (sectorScopeIds !== undefined && sectorScopeIds.length === 0) {
      setSeries([])
      return
    }
    const rangeDates = computePrevRange({ yearFilter, dateFrom, dateTo })
    if (!rangeDates) {
      setSeries([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()

      let query = supabase
        .from('casos_epidemiologicos')
        .select('fecha_registro, fecha_nacimiento')
        .gte('fecha_registro', rangeDates.from)
        .lte('fecha_registro', rangeDates.to)
        .order('fecha_registro', { ascending: true })
        .limit(limit)

      if (sectorScopeIds !== undefined && sectorScopeIds.length > 0) {
        query = query.in('id_sector', sectorScopeIds)
      }

      if (sectorId && sectorId !== 'all') {
        const sid = parseInt(sectorId, 10)
        if (!Number.isNaN(sid)) query = query.eq('id_sector', sid)
      }
      if (estadoFilter && estadoFilter !== 'all') {
        query = query.eq('estado_actual', estadoFilter)
      }
      if (generoFilter && generoFilter !== 'all') {
        query = query.eq('genero', generoFilter)
      }

      query = applyOcupacionQueryFilter(query, ocupacionFilter)

      const ageR = ageGroupRange(ageGroupFilter)

      const { data: rows, error: queryError } = await query
      if (queryError) throw new Error(queryError.message || 'Error al cargar casos del año anterior')

      const counts = new Map()
      for (const row of rows || []) {
        if (ageR) {
          const a = ageCompletedAtReference(row.fecha_nacimiento, row.fecha_registro)
          if (a == null || a < ageR.min || a > ageR.max) continue
        }
        const d = typeof row.fecha_registro === 'string' ? row.fecha_registro.slice(0, 10) : null
        if (!d) continue
        const shifted = shiftYearStr(d, 1)
        if (!shifted) continue
        counts.set(shifted, (counts.get(shifted) || 0) + 1)
      }

      const out = [...counts.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([month, value]) => ({ month, value }))

      setSeries(out)
    } catch (err) {
      setError(err.message || 'Error al cargar casos del año anterior')
      setSeries([])
    } finally {
      setLoading(false)
    }
  }, [
    yearFilter,
    dateFrom,
    dateTo,
    sectorId,
    estadoFilter,
    generoFilter,
    ageGroupFilter,
    ocupacionFilter,
    enabled,
    limit,
    sectorScopeReady,
    sectorScopeIds
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { series, loading, error, refetch: fetchData }
}
