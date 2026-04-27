'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Catálogo dinámico de ocupaciones presentes en `casos_epidemiologicos`.
 *
 * Hace una sola lectura al montar (no depende de filtros del panel) y
 * normaliza valores: trim + dedupe case-insensitive. Para cada grupo
 * se conserva la versión con más apariciones como "label" canónico
 * (típicamente la mejor capitalizada), y como "value" la cadena exacta
 * más usada — eso permite filtrar después con ILIKE de forma estable.
 *
 * Para acelerar la consulta DISTINCT cuando crezca el dataset, se
 * recomienda crear el índice:
 *
 *   CREATE INDEX IF NOT EXISTS idx_casos_ocupacion
 *     ON casos_epidemiologicos (ocupacion);
 *
 * data: Array<{ value: string, label: string, count: number }>
 */
export function useOcupaciones({ limit = 5000 } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOcupaciones = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rows, error: queryError } = await supabase
        .from('casos_epidemiologicos')
        .select('ocupacion')
        .not('ocupacion', 'is', null)
        .neq('ocupacion', '')
        .limit(limit)

      if (queryError) throw new Error(queryError.message || 'Error al cargar ocupaciones')

      /* Agrupamos por clave normalizada (lowercase + trim) y contamos
         cuántas veces aparece cada variante exacta para elegir el label
         canónico de cada grupo. */
      const groups = new Map()
      for (const r of rows || []) {
        const raw = (r?.ocupacion || '').trim()
        if (!raw) continue
        const key = raw.toLowerCase()
        const g = groups.get(key) || { variants: new Map(), total: 0 }
        g.variants.set(raw, (g.variants.get(raw) || 0) + 1)
        g.total += 1
        groups.set(key, g)
      }

      const out = []
      for (const [key, g] of groups.entries()) {
        let bestVariant = ''
        let bestCount = -1
        for (const [variant, n] of g.variants.entries()) {
          if (n > bestCount) {
            bestCount = n
            bestVariant = variant
          }
        }
        out.push({
          value: key,
          label: bestVariant,
          count: g.total
        })
      }

      out.sort((a, b) => a.label.localeCompare(b.label, 'es'))
      setData(out)
    } catch (err) {
      setError(err.message || 'Error al cargar ocupaciones')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchOcupaciones()
  }, [fetchOcupaciones])

  return { data, loading, error, refetch: fetchOcupaciones }
}
