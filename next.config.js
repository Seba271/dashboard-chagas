/**
 * ============================================================================
 * CONFIGURACIÓN DE NEXT.JS - next.config.js
 * ============================================================================
 * 
 * Este archivo configura el comportamiento de Next.js.
 * Puedes agregar aquí configuraciones personalizadas del framework.
 * 
 * Documentación: https://nextjs.org/docs/api-reference/next.config.js
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * REACT STRICT MODE
   * 
   * reactStrictMode: true activa el modo estricto de React.
   * 
   * ¿Qué hace?
   * - Identifica componentes con efectos secundarios problemáticos
   * - Ayuda a detectar problemas de rendimiento
   * - Prepara la app para futuras mejoras de React
   * 
   * En desarrollo, puede hacer que algunos efectos se ejecuten dos veces
   * (esto es normal y ayuda a encontrar bugs).
   */
  reactStrictMode: true,
}

// Exportar la configuración para que Next.js la use
module.exports = nextConfig


