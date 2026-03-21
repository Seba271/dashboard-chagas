'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Lista de controles atrasados (RPC get_overdue_followups).
 */
export function useOverdueFollowups(limit = 1000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchList = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createSupabaseClient()
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_overdue_followups', {
        p_limit: limit
      })

      if (rpcError) throw new Error(rpcError.message || 'Error al cargar lista')
      setData(Array.isArray(rpcData) ? rpcData : [])
    } catch (err) {
      setError(err.message || 'Error al cargar controles atrasados')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  return { data, loading, error, refetch: fetchList }
}
