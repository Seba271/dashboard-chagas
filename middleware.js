/**
 * ============================================================================
 * MIDDLEWARE DE NEXT.JS - middleware.js
 * ============================================================================
 * 
 * El middleware se ejecuta ANTES de que cualquier request llegue a las páginas.
 * Es como un "guardián" que intercepta todas las peticiones.
 * 
 * ¿QUÉ HACE ESTE MIDDLEWARE?
 * - En esta implementación, simplemente permite que todas las requests pasen
 * - La verificación de autenticación se hace en cada página protegida
 * 
 * ¿POR QUÉ NO VERIFICAMOS AQUÍ?
 * - Supabase Auth necesita acceso al contexto del navegador (localStorage, cookies)
 * - El middleware se ejecuta en el servidor, no tiene acceso al navegador
 * - Por eso, cada página protegida verifica su propia autenticación
 * 
 * ALTERNATIVAS FUTURAS:
 * - Podrías verificar cookies aquí si implementas un sistema de cookies personalizado
 * - Podrías hacer redirecciones basadas en headers o cookies
 * - Para proyectos más complejos, podrías usar @supabase/auth-helpers-nextjs
 */

// NextResponse es una clase de Next.js para crear respuestas HTTP
// Se usa para modificar requests/responses en el middleware
import { NextResponse } from 'next/server'

/**
 * Función del middleware
 * 
 * @param {Object} req - Request object de Next.js
 * @returns {NextResponse} - Response que permite continuar o redirigir
 * 
 * Esta función se ejecuta en CADA request que coincide con el matcher
 */
export async function middleware(req) {
  // Crear una respuesta que permite que la request continúe normalmente
  // NextResponse.next() significa "continuar con el request normal"
  const res = NextResponse.next()
  
  // Retornar la respuesta (permite que todas las requests pasen)
  // En el futuro, aquí podrías agregar lógica para:
  // - Verificar cookies de autenticación
  // - Redirigir basándose en el pathname
  // - Agregar headers personalizados
  return res
}

/**
 * Configuración del middleware
 * 
 * Define en qué rutas se ejecuta el middleware
 */
export const config = {
  matcher: [
    /*
     * PATRÓN DE RUTAS
     * 
     * Este patrón regex hace que el middleware se ejecute en TODAS las rutas
     * EXCEPTO las que empiezan con:
     * 
     * - api/          → Rutas de API (no necesitan middleware de autenticación)
     * - _next/static  → Archivos estáticos de Next.js (CSS, JS, imágenes)
     * - _next/image   → Optimización de imágenes de Next.js
     * - favicon.ico   → Icono del sitio
     * 
     * ¿Por qué excluir estas rutas?
     * - Son recursos estáticos o de sistema
     * - No necesitan verificación de autenticación
     * - Mejora el rendimiento (no ejecuta middleware innecesariamente)
     * 
     * Ejemplos de rutas donde SÍ se ejecuta:
     * - /              → Página principal
     * - /login         → Página de login
     * - /dashboard     → Página de dashboard
     * - /cualquier-otra-ruta
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

