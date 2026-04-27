'use client'

/**
 * Trae la serie de casos del PERÍODO ESPEJO del año anterior, con los mismos
 * filtros que el dataset principal (sector, estado, género, edad), pero con
 * `fecha_registro` desplazado un año atrás.
 *
 * Para alinear visualmente con el eje X del TendencyChart, las fechas que
 * devuelve este hook ya vienen "renombradas" al año actual (ej. un caso del
 * 2024-03-15 aparece como 2025-03-15 con el conteo de ese día). Eso permite
 * superponer la serie como línea punteada del año anterior sin más cálculos.
 *
 * Solo dispara la query cuando hay un período definido (yearFilter !== 'all'
 * o un par dateFrom/dateTo válido). Si no, devuelve [].
 */

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { ageGroupRange } from '@/lib/caseEnums'

function shiftYearStr(dateStr, delta) {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const parts = dateStr.slice(0, 10).split('-')
  if (parts.length !== 3) return ''
  const y = parseInt(parts[0], 10)
  if (Number.isNaN(y)) return ''
  return `${y + delta}-${parts[1]}-${parts[2]}`
}

/** Calcula el período espejo (1 año antes) según los filtros activos. */
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
  limit = 5000
} = {}) {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setSeries([])
      return
    }
    const range = computePrevRange({ yearFilter, dateFrom, dateTo })
    if (!range) {
      setSeries([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()

      let query = supabase
        .from('casos_epidemiologicos')
        .select('fecha_registro')
        .gte('fecha_registro', range.from)
        .lte('fecha_registro', range.to)
        .order('fecha_registro', { ascending: true })
        .limit(limit)

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
      if (ocupacionFilter && ocupacionFilter !== 'all') {
        query = query.ilike('ocupacion', ocupacionFilter)
      }
      const r = ageGroupRange(ageGroupFilter)
      if (r) query = query.gte('edad', r.min).lte('edad', r.max)

      const { data: rows, error: queryError } = await query
      if (queryError) throw new Error(queryError.message || 'Error al cargar casos del año anterior')

      /* Agrupar por día y desplazar 1 año adelante para alinear con el eje del actual. */
      const counts = new Map()
      for (const row of rows || []) {
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
  }, [yearFilter, dateFrom, dateTo, sectorId, estadoFilter, generoFilter, ageGroupFilter, ocupacionFilter, enabled, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { series, loading, error, refetch: fetchData }
}
