/**
 * ============================================================================
 * ROOT LAYOUT - app/layout.js
 * ============================================================================
 * 
 * Este es el layout raíz de Next.js App Router. Envuelve TODAS las páginas
 * de la aplicación.
 * 
 * FUNCIÓN:
 * - Define la estructura HTML base (<html>, <body>)
 * - Define los metadatos de la aplicación (título, descripción)
 * - Importa estilos globales
 * - Proporciona el contexto base para todas las páginas
 * 
 * IMPORTANTE:
 * - Este archivo NO puede ser un Client Component ('use client')
 * - Debe ser un Server Component (por defecto en Next.js 14)
 * - Se ejecuta en el servidor, no en el navegador
 */

// Importar estilos globales que se aplicarán a toda la aplicación
import './globals.css'

/**
 * Metadatos de la aplicación
 * 
 * Estos metadatos se usan para:
 * - El título de la pestaña del navegador
 * - La descripción en los resultados de búsqueda (SEO)
 * - Compartir en redes sociales (Open Graph)
 * 
 * En Next.js 14, exportar 'metadata' automáticamente configura estos valores
 */
export const metadata = {
  title: 'Dashboard casos Chagas - Región de Coquimbo',
  description: 'Sistema de visualización de indicadores epidemiológicos de la enfermedad de Chagas',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

/**
 * Componente RootLayout
 * 
 * @param {Object} props - Props del componente
 * @param {React.ReactNode} props.children - Contenido de las páginas (se inyecta automáticamente)
 * 
 * Este componente se ejecuta en el servidor y envuelve todas las páginas.
 * Las páginas se renderizan donde está {children}
 */
export default function RootLayout({ children }) {
  return (
    // Etiqueta HTML raíz
    // lang="es" indica que el contenido está en español (útil para accesibilidad y SEO)
    <html lang="es">
      {/* Cuerpo del documento */}
      {/* {children} es donde Next.js inyecta el contenido de cada página */}
      {/* Por ejemplo: si estás en /login, children será el componente LoginPage */}
      <body>{children}</body>
    </html>
  )
}


