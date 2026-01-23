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
// FUNCIÓN PARA CREAR CLIENTE SUPABASE
// ============================================================================

/**
 * Crea y retorna un nuevo cliente Supabase
 * 
 * ¿Por qué una función en lugar de una constante?
 * - Permite crear múltiples instancias si es necesario
 * - Útil cuando necesitas diferentes configuraciones
 * - Mejor para testing y desarrollo
 * 
 * @returns {Object} Cliente de Supabase configurado
 */
export function createSupabaseClient() {
  // Crear el cliente con la URL y la clave anónima
  return createClient(supabaseUrl, supabaseAnonKey, {
    // Configuración de autenticación
    auth: {
      // persistSession: true
      // Guarda la sesión del usuario en el navegador (localStorage/cookies)
      // Esto permite que el usuario permanezca logueado al recargar la página
      persistSession: true,
      
      // autoRefreshToken: true
      // Renueva automáticamente el token de acceso cuando está por expirar
      // Los tokens de Supabase expiran después de cierto tiempo por seguridad
      autoRefreshToken: true,
      
      // detectSessionInUrl: true
      // Detecta si hay información de sesión en la URL (útil para OAuth)
      // Por ejemplo, cuando un usuario se autentica con Google y es redirigido
      detectSessionInUrl: true
    }
  })
}

// ============================================================================
// CLIENTE SINGLETON (OPCIONAL)
// ============================================================================

/**
 * Cliente Supabase pre-instanciado para uso rápido
 * 
 * Útil cuando solo necesitas una instancia del cliente en toda la app.
 * 
 * NOTA: En este proyecto preferimos usar createSupabaseClient() porque:
 * - Es más flexible
 * - Evita problemas de estado compartido
 * - Mejor para componentes de React que se re-renderizan
 */
export const supabase = createSupabaseClient()