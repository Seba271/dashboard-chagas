'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Catálogo de ocupaciones (`public.catalogo_ocupaciones`).
 * Usado en filtros y formularios; el valor de filtro es `id_ocupacion`.
 */
export function useOcupaciones() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOcupaciones = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rows, error: queryError } = await supabase
        .from('catalogo_ocupaciones')
        .select('id_ocupacion, codigo, nombre')
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (queryError) throw new Error(queryError.message || 'Error al cargar ocupaciones')

      setData(
        (rows || [])
          .filter((r) => r.id_ocupacion != null && r.id_ocupacion !== '')
          .map((r) => ({
            id_ocupacion: r.id_ocupacion,
            codigo: r.codigo,
            nombre: r.nombre
          }))
      )
    } catch (err) {
      setError(err.message || 'Error al cargar ocupaciones')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOcupaciones()
  }, [fetchOcupaciones])

  return { data, loading, error, refetch: fetchOcupaciones }
}
