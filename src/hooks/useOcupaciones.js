'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Catálogo fijo de ocupaciones (`public.catalogo_ocupaciones`).
 *
 * `value` = columna `codigo` (lo que debe guardarse en `casos_epidemiologicos.ocupacion`).
 * `label` = columna `nombre` (texto para filtros y formularios).
 *
 * Casos antiguos con texto libre en `ocupacion` no coinciden con estos códigos hasta
 * migrarlos; con filtro "Todos" siguen apareciendo.
 *
 * En Supabase suele hacer falta una política RLS de solo lectura para `authenticated`.
 *
 * data: Array<{ value: string, label: string }>
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
        .select('codigo, nombre')
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (queryError) throw new Error(queryError.message || 'Error al cargar ocupaciones')

      const out = (rows || []).map((r) => ({
        value: r.codigo,
        label: r.nombre
      }))

      setData(out)
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
