'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Catálogo de sectores activos. Se usa para selects, mapa y joins en cliente.
 *
 * data: Array<{ id_sector, nombre_sector, comuna, latitud_centroide, longitud_centroide }>
 */
export function useSectors() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSectors = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rows, error: queryError } = await supabase
        .from('sectores')
        .select('id_sector, nombre_sector, comuna, latitud_centroide, longitud_centroide, activo')
        .eq('activo', true)
        .order('nombre_sector', { ascending: true })

      if (queryError) throw new Error(queryError.message || 'Error al cargar sectores')
      setData(rows || [])
    } catch (err) {
      setError(err.message || 'Error al cargar sectores')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSectors()
  }, [fetchSectors])

  return { data, loading, error, refetch: fetchSectors }
}
