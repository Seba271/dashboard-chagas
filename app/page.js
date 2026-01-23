/**
 * ============================================================================
 * PÁGINA PRINCIPAL (HOME) - app/page.js
 * ============================================================================
 * 
 * Esta es la página que se muestra cuando el usuario accede a la raíz del sitio (/)
 * 
 * FUNCIÓN:
 * - Verifica si el usuario está autenticado
 * - Si está autenticado → redirige a /dashboard
 * - Si NO está autenticado → redirige a /login
 * 
 * Es como un "semáforo" que decide a dónde debe ir el usuario según su estado
 */

// 'use client' indica que este componente se ejecuta en el navegador (cliente)
// Es necesario porque usamos hooks de React (useEffect, useRouter) y Supabase
// En Next.js 14 App Router, los componentes son Server Components por defecto
'use client'

// useEffect: Hook de React para ejecutar código cuando el componente se monta
// o cuando cambian sus dependencias
import { useEffect } from 'react'

// useRouter: Hook de Next.js para navegar entre páginas programáticamente
// Permite hacer redirecciones desde el código
import { useRouter } from 'next/navigation'

// Importar la función para crear un cliente Supabase
// El @/ es un alias que apunta a la raíz del proyecto (configurado en jsconfig.json)
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Componente principal de la página home
 * 
 * Este componente no muestra contenido real, solo verifica la sesión y redirige
 */
export default function Home() {
  // Obtener la función router para poder navegar entre páginas
  const router = useRouter()

  // useEffect se ejecuta cuando el componente se monta (cuando se carga la página)
  // El array vacío [] significa que solo se ejecuta una vez al cargar
  useEffect(() => {
    /**
     * Función asíncrona para verificar si hay una sesión activa
     * 
     * ¿Por qué asíncrona?
     * - Porque getSession() es una operación que toma tiempo (consulta a Supabase)
     * - Necesitamos esperar la respuesta antes de redirigir
     */
    const checkSession = async () => {
      // Crear un cliente Supabase para esta verificación
      const supabase = createSupabaseClient()
      
      // Obtener la sesión actual del usuario
      // getSession() busca en localStorage/cookies si hay una sesión guardada
      // Retorna { data: { session: {...} }, error: null } si hay sesión
      // Retorna { data: { session: null }, error: null } si no hay sesión
      const { data: { session } } = await supabase.auth.getSession()
      
      // Si hay una sesión activa (usuario autenticado)
      if (session) {
        // Redirigir al dashboard
        router.push('/dashboard')
      } else {
        // Si no hay sesión (usuario no autenticado)
        // Redirigir a la página de login
        router.push('/login')
      }
    }

    // Ejecutar la verificación
    checkSession()
  }, [router]) // El array [router] significa que si router cambia, se vuelve a ejecutar
  // (aunque en la práctica router no cambia, es buena práctica incluirlo)

  // ============================================================================
  // RENDERIZADO
  // ============================================================================
  
  // Mientras se verifica la sesión, mostramos un mensaje de carga
  // Esto evita que la página se vea vacía o que parpadee
  return (
    <div style={{ 
      display: 'flex',           // Usar flexbox para centrar
      justifyContent: 'center',  // Centrar horizontalmente
      alignItems: 'center',     // Centrar verticalmente
      minHeight: '100vh'        // Altura mínima: 100% del viewport (pantalla completa)
    }}>
      <div style={{ 
        color: 'white',          // Texto blanco
        fontSize: '1.25rem',     // Tamaño de fuente
        textAlign: 'center'      // Centrar el texto
      }}>
        Cargando...
      </div>
    </div>
  )
}


