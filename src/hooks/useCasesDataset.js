'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { ageGroupRange } from '@/lib/caseEnums'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'

/**
 * Devuelve los casos epidemiológicos filtrados (con join a sectores) en una sola consulta.
 *
 * Las agregaciones (serie temporal, conteos por sector / estado, KPIs, mapa) se derivan en
 * el componente con `useMemo`, así evitamos múltiples roundtrips por cada cambio de filtros.
 *
 * Filtros soportados:
 * - yearFilter: 'all' | 'YYYY'
 * - dateFrom / dateTo: 'YYYY-MM-DD' (solo cuando yearFilter === 'all'). Si ambos
 *   van vacíos con año "Todos", no se filtra por fecha (toda la historia).
 * - sectorId: 'all' | number
 * - estadoFilter: 'all' | 'nuevo' | 'reingreso' | 'tratado'
 * - generoFilter: 'all' | 'masculino' | 'femenino' | 'otro' (según enum)
 * - ageGroupFilter: 'all' | quinquenios (`0_4` … `75_79`) | `80_plus`
 * - ocupacionFilter: 'all' | string (`codigo` del catálogo). Igualdad exacta
 *   contra `casos_epidemiologicos.ocupacion`. Casos con texto libre antiguo
 *   no entran al filtro hasta migrar el valor al código correspondiente.
 *
 * - sectorScopeReady: si es false, no se consulta hasta tener el catálogo de sectores.
 * - sectorScopeIds: si se omite (undefined), no se restringe por sector (compatibilidad).
 *   Si es [], ningún caso coincide. Si tiene ids, solo esos `id_sector`.
 *
 * Grupo etario: edad cumplida a la fecha de registro deducida desde `fecha_nacimiento`.
 * El filtro se aplica después de obtener filas de Supabase (no hay forma exacta equivalente a
 * un solo `.gte`/`.lte` sobre `fecha_nacimiento` que respete `fecha_registro` por fila).
 *
 * Cada caso devuelto incluye:
 *   {
 *     id_caso, codigo_caso, fecha_registro, genero, fecha_nacimiento,
 *     id_sector, sector_nombre, sector_comuna, sector_lat, sector_lon,
 *     ocupacion, estado_actual, numero_contactos,
 *     observacion_general, creado_en, actualizado_en
 *   }
 */
export function useCasesDataset({
  yearFilter = 'all',
  dateFrom = '',
  dateTo = '',
  sectorId = 'all',
  estadoFilter = 'all',
  generoFilter = 'all',
  ageGroupFilter = 'all',
  ocupacionFilter = 'all',
  limit = 5000,
  sectorScopeReady = true,
  sectorScopeIds = undefined
} = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!sectorScopeReady) {
      setLoading(true)
      setError(null)
      return
    }
    if (sectorScopeIds !== undefined && sectorScopeIds.length === 0) {
      try {
        setLoading(true)
        setError(null)
        setData([])
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()

      let query = supabase
        .from('casos_epidemiologicos')
        .select(
          `
            id_caso,
            codigo_caso,
            fecha_registro,
            genero,
            fecha_nacimiento,
            id_sector,
            ocupacion,
            estado_actual,
            numero_contactos,
            observacion_general,
            creado_en,
            actualizado_en,
            sectores (
              id_sector,
              nombre_sector,
              comuna,
              latitud_centroide,
              longitud_centroide
            )
          `
        )
        .order('fecha_registro', { ascending: true })
        .limit(limit)

      if (sectorScopeIds !== undefined && sectorScopeIds.length > 0) {
        query = query.in('id_sector', sectorScopeIds)
      }

      if (yearFilter && yearFilter !== 'all') {
        const y = parseInt(yearFilter, 10)
        if (!Number.isNaN(y)) {
          query = query.gte('fecha_registro', `${y}-01-01`).lte('fecha_registro', `${y}-12-31`)
        }
      } else {
        if (dateFrom) query = query.gte('fecha_registro', dateFrom)
        if (dateTo) query = query.lte('fecha_registro', dateTo)
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

      if (ocupacionFilter && ocupacionFilter !== 'all') {
        query = query.eq('ocupacion', ocupacionFilter)
      }

      const { data: rows, error: queryError } = await query
      if (queryError) throw new Error(queryError.message || 'Error al cargar casos')

      const flat = (rows || []).map((r) => ({
        id_caso: r.id_caso,
        codigo_caso: r.codigo_caso,
        fecha_registro: r.fecha_registro,
        genero: r.genero,
        fecha_nacimiento: r.fecha_nacimiento,
        id_sector: r.id_sector,
        sector_nombre: r.sectores?.nombre_sector ?? null,
        sector_comuna: r.sectores?.comuna ?? null,
        sector_lat: r.sectores?.latitud_centroide ?? null,
        sector_lon: r.sectores?.longitud_centroide ?? null,
        ocupacion: r.ocupacion,
        estado_actual: r.estado_actual,
        numero_contactos: Number(r.numero_contactos) || 0,
        observacion_general: r.observacion_general,
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en
      }))

      const range = ageGroupRange(ageGroupFilter)
      let out = flat
      if (range) {
        out = flat.filter((c) => {
          const a = ageCompletedAtReference(c.fecha_nacimiento, c.fecha_registro)
          return a != null && a >= range.min && a <= range.max
        })
      }

      setData(out)
    } catch (err) {
      setError(err.message || 'Error al cargar casos')
      setData(null)
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
    limit,
    sectorScopeReady,
    sectorScopeIds
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
