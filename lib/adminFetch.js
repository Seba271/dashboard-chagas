'use client'

import { createSupabaseClient } from '@/lib/supabase'

/** Llama a rutas /api/admin/* con el access_token de la sesión actual. */
export async function adminFetch(path, options = {}) {
  const supabase = createSupabaseClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sin sesión activa')
  }
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)

  let body = options.body
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body)
    headers.set('Content-Type', 'application/json')
  }

  return fetch(path, { ...options, headers, body })
}
