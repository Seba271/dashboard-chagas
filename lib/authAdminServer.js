/**
 * Verificación de sesión JWT y rol admin en rutas API (servidor).
 * La SERVICE ROLE solo se usa después de comprobar admin.
 */

import { loadEnvConfig } from '@next/env'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Carpeta del proyecto: npm define INIT_CWD; con `next dev` a veces `process.cwd()` no es la raíz
 * (y .env.local no se carga en process.env).
 */
function getProjectRoot() {
  if (typeof process === 'undefined') return ''
  return (process.env.INIT_CWD && process.env.INIT_CWD.trim()) || process.cwd()
}

/**
 * Lee SUPABASE_SERVICE_ROLE_KEY del disco (una línea, el JWT puede terminar en =).
 * Solo si process.env aún no la tiene.
 */
function readServiceRoleKeyFromEnvFile() {
  if (typeof process === 'undefined') return null
  const roots = [getProjectRoot(), process.cwd()]
  const unique = [...new Set(roots.filter(Boolean))]
  for (const root of unique) {
    for (const name of ['.env.local', '.env']) {
      const filePath = join(root, name)
      try {
        if (!existsSync(filePath)) continue
        const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.trim()
          if (!line || line.startsWith('#')) continue
          if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            let val = line.slice('SUPABASE_SERVICE_ROLE_KEY='.length).trim()
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1)
            }
            return val.trim() || null
          }
        }
      } catch {
        continue
      }
    }
  }
  return null
}

/** Algunos entornos no cargan .env.local en process.env hasta loadEnvConfig en la raíz correcta. */
let didLoadLocalEnv = false
function ensureLocalEnvLoaded() {
  if (didLoadLocalEnv || typeof process === 'undefined') return
  didLoadLocalEnv = true
  try {
    const dir = getProjectRoot()
    loadEnvConfig(dir, process.env.NODE_ENV !== 'production')
  } catch {
    /* ignorar */
  }
}

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

/**
 * Usuario asociado al JWT (anon key + getUser).
 */
export async function getUserFromBearer(request) {
  const token = getBearerToken(request)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anon) {
    return { user: null, error: 'missing_auth' }
  }
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token)
  if (error || !user) return { user: null, error: 'invalid_session' }
  return { user, error: null }
}

/**
 * Cliente con service role (solo rutas servidor). Lanza si falta la key.
 */
export function getServiceRoleClient() {
  ensureLocalEnvLoaded()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    key = readServiceRoleKeyFromEnvFile()
    if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key
  }
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Requiere JWT válido + role admin en public.profiles.
 * Devuelve adminClient (service role) para auth.admin y updates de profiles.
 */
export async function requireAdmin(request) {
  ensureLocalEnvLoaded()
  const { user, error } = await getUserFromBearer(request)
  if (!user) {
    const msg =
      error === 'missing_auth'
        ? 'Falta cabecera Authorization'
        : 'Sesión inválida o expirada'
    return {
      error: NextResponse.json({ error: msg }, { status: 401 }),
      user: null,
      adminClient: null
    }
  }

  const adminClient = getServiceRoleClient()
  if (!adminClient) {
    const devHint =
      process.env.NODE_ENV === 'development'
        ? ' En desarrollo: guardá .env.local en la carpeta del proyecto, detené el servidor (Ctrl+C) y volvé a ejecutar npm run dev.'
        : ''
    return {
      error: NextResponse.json(
        {
          error:
            'Servidor sin SUPABASE_SERVICE_ROLE_KEY: agregá la clave service_role (Supabase → Settings → API) en .env.local en la raíz del proyecto (sin NEXT_PUBLIC_). Jamás en el cliente.' +
            devHint
        },
        { status: 503 }
      ),
      user: null,
      adminClient: null
    }
  }

  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const role = String(profile?.role ?? '')
    .trim()
    .toLowerCase()
  if (!profile || role !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Se requiere rol de administrador' }, { status: 403 }),
      user: null,
      adminClient: null
    }
  }

  return { error: null, user, adminClient }
}
