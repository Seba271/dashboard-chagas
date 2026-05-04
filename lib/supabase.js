/**
 * ============================================================================
 * CLIENTE SUPABASE REUTILIZABLE
 * ============================================================================
 * 
 * Este archivo crea y exporta un cliente de Supabase que se puede usar en
 * toda la aplicación. Es el punto central de conexión con Supabase.
 * 
 * IMPORTANTE DE SEGURIDAD:
 * - Solo usa la ANON PUBLIC KEY (nunca la SERVICE ROLE KEY)
 * - La SERVICE ROLE KEY solo debe usarse en el backend (nunca en frontend)
 * - La seguridad se maneja mediante Row Level Security (RLS) en Supabase
 * - Las políticas RLS en Supabase controlan qué datos puede ver cada usuario
 */

// Importar la función createClient de la librería oficial de Supabase
// Esta función crea una instancia del cliente que nos permite interactuar
// con nuestra base de datos y sistema de autenticación
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ============================================================================

// Obtener la URL de nuestro proyecto Supabase desde las variables de entorno
// El prefijo NEXT_PUBLIC_ hace que esta variable sea accesible en el navegador
// Ejemplo: https://abcdefghijklmnop.supabase.co
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

// Obtener la clave pública anónima (anon key) de Supabase
// Esta key es segura para usar en el frontend porque está protegida por RLS
// Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ============================================================================
// VALIDACIÓN DE VARIABLES DE ENTORNO
// ============================================================================

// Verificar que las variables de entorno estén definidas
// Si faltan, lanzamos un error para que el desarrollador sepa qué configurar
// Esto evita errores confusos más adelante cuando se intente usar Supabase
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
    'Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local'
  )
}

// ============================================================================
// SINGLETON EN EL NAVEGADOR (evita "Multiple GoTrueClient instances")
// ============================================================================

let browserClient = null

/**
 * Cliente Supabase (anon) compartido en todo el front.
 * No crear un `createClient` nuevo en cada hook: GoTrue advierte y puede fallar el auth.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient() {
  if (browserClient) return browserClient
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
  return browserClient
}

/** Alias del mismo singleton (imports existentes). */
export const supabase = createSupabaseClient()