/**
 * ============================================================================
 * PÁGINA DE DASHBOARD (PROTEGIDA) - app/dashboard/page.js
 * ============================================================================
 * 
 * Esta es la página principal del dashboard. REQUIERE AUTENTICACIÓN.
 * 
 * FUNCIONALIDADES:
 * 1. Verifica que el usuario esté autenticado antes de mostrar contenido
 * 2. Si no está autenticado, redirige automáticamente a /login
 * 3. Muestra información del usuario autenticado
 * 4. Permite cerrar sesión
 * 5. Escucha cambios en el estado de autenticación (si el usuario cierra sesión en otra pestaña)
 * 
 * PROTECCIÓN:
 * - Esta página está protegida: solo usuarios autenticados pueden verla
 * - La verificación se hace en el cliente (navegador) usando Supabase Auth
 * - Si no hay sesión, se redirige inmediatamente a /login
 * 
 * PRÓXIMAS ETAPAS:
 * - Aquí se implementarán los KPIs epidemiológicos
 * - Gráficos y visualizaciones de datos
 * - Mapas interactivos de la Región de Coquimbo
 * - Filtros y búsquedas avanzadas
 */

// 'use client' es necesario porque usamos hooks de React y Supabase Auth
'use client'

// Importar hooks de React para manejar estado y efectos
import { useState, useEffect } from 'react'

// Importar router de Next.js para navegar entre páginas
import { useRouter } from 'next/navigation'

// Importar función para crear cliente Supabase
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Componente principal del Dashboard
 */
export default function DashboardPage() {
  // ============================================================================
  // HOOKS Y ESTADO
  // ============================================================================
  
  // Router para navegar entre páginas (usado para redirigir a /login si no hay sesión)
  const router = useRouter()
  
  // Estado para almacenar los datos del usuario autenticado
  // null = no hay usuario, { email, id, ... } = datos del usuario
  const [user, setUser] = useState(null)
  
  // Estado para saber si estamos cargando/verificando la autenticación
  // true = estamos verificando, false = ya verificamos
  const [loading, setLoading] = useState(true)
  
  // Estado para almacenar mensajes de error
  // null = no hay error, string = mensaje de error
  const [error, setError] = useState(null)

  // ============================================================================
  // EFECTO: VERIFICAR AUTENTICACIÓN AL CARGAR LA PÁGINA
  // ============================================================================
  
  // useEffect se ejecuta cuando el componente se monta (cuando se carga la página)
  useEffect(() => {
    /**
     * Función asíncrona para verificar la autenticación del usuario
     * 
     * Esta función:
     * 1. Obtiene la sesión actual del usuario
     * 2. Si no hay sesión, redirige a /login
     * 3. Si hay sesión, guarda los datos del usuario
     * 4. Configura un listener para detectar cambios en el estado de autenticación
     */
    const checkAuth = async () => {
      try {
        // Crear cliente Supabase
        const supabase = createSupabaseClient()
        
        // Obtener la sesión actual del usuario
        // getSession() busca en localStorage/cookies si hay una sesión guardada
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // Si hay un error al obtener la sesión (muy raro, pero puede pasar)
        if (sessionError) {
          setError('Error al verificar la sesión')
          setLoading(false)  // Dejar de mostrar el estado de carga
          return  // Salir de la función
        }

        // Si NO hay sesión (usuario no autenticado)
        if (!session) {
          // Redirigir inmediatamente a la página de login
          router.push('/login')
          return  // Salir de la función (no continuar)
        }

        // Si llegamos aquí, hay una sesión válida
        // Guardar los datos del usuario en el estado
        // session.user contiene: { id, email, created_at, ... }
        setUser(session.user)
        
        // Dejar de mostrar el estado de carga (ya verificamos)
        setLoading(false)

        // ========================================================================
        // CONFIGURAR LISTENER DE CAMBIOS DE AUTENTICACIÓN
        // ========================================================================
        
        // onAuthStateChange() escucha cambios en el estado de autenticación
        // Se ejecuta cuando:
        // - El usuario inicia sesión
        // - El usuario cierra sesión
        // - El token se refresca
        // - El usuario cierra sesión en otra pestaña del navegador
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          // Si la sesión se perdió (usuario cerró sesión)
          if (!session) {
            // Redirigir a login
            router.push('/login')
          } else {
            // Si hay una nueva sesión (usuario inició sesión o token se refrescó)
            // Actualizar los datos del usuario
            setUser(session.user)
          }
        })

        // ========================================================================
        // LIMPIEZA: DESUSCRIBIRSE AL DESMONTAR EL COMPONENTE
        // ========================================================================
        
        // Es importante limpiar la suscripción cuando el componente se desmonta
        // Esto evita memory leaks (fugas de memoria)
        // El return en useEffect se ejecuta cuando el componente se desmonta
        return () => {
          subscription.unsubscribe()  // Dejar de escuchar cambios
        }
      } catch (err) {
        // Capturar cualquier error inesperado
        setError('Error inesperado al cargar el dashboard')
        setLoading(false)
      }
    }

    // Ejecutar la verificación
    checkAuth()
  }, [router])  // Se ejecuta cuando el componente se monta o cuando router cambia

  // ============================================================================
  // FUNCIÓN: MANEJAR EL CIERRE DE SESIÓN
  // ============================================================================
  
  /**
   * Esta función se ejecuta cuando el usuario hace clic en "Cerrar Sesión"
   * 
   * ¿Qué hace?
   * 1. Llama a signOut() de Supabase para eliminar la sesión
   * 2. Elimina la sesión del navegador (localStorage/cookies)
   * 3. Redirige al usuario a la página de login
   */
  const handleLogout = async () => {
    try {
      // Crear cliente Supabase
      const supabase = createSupabaseClient()
      
      // Cerrar sesión del usuario
      // signOut() elimina la sesión del navegador y del servidor
      const { error } = await supabase.auth.signOut()
      
      // Si hay un error al cerrar sesión
      if (error) {
        setError('Error al cerrar sesión')
      } else {
        // Si el cierre de sesión fue exitoso
        // Redirigir al usuario a la página de login
        router.push('/login')
        
        // Refrescar el router para asegurar que los cambios se apliquen
        router.refresh()
      }
    } catch (err) {
      // Capturar cualquier error inesperado
      setError('Error inesperado al cerrar sesión')
    }
  }

  // ============================================================================
  // RENDERIZADO CONDICIONAL: ESTADO DE CARGA
  // ============================================================================
  
  // Si todavía estamos verificando la autenticación, mostrar un mensaje de carga
  // Esto evita que la página parpadee o muestre contenido antes de verificar
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'white'
      }}>
        <div style={{ fontSize: '1.25rem' }}>Cargando dashboard...</div>
      </div>
    )
  }

  // ============================================================================
  // RENDERIZADO CONDICIONAL: ESTADO DE ERROR (SIN USUARIO)
  // ============================================================================
  
  // Si hay un error y no hay usuario (no se pudo autenticar)
  // Mostrar un mensaje de error con opción de ir a login
  if (error && !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
          <button
            onClick={() => router.push('/login')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Ir a Login
          </button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDERIZADO: CONTENIDO PRINCIPAL DEL DASHBOARD
  // ============================================================================
  
  // Si llegamos aquí, el usuario está autenticado y podemos mostrar el dashboard
  return (
    <div style={{
      minHeight: '100vh',        // Altura mínima: pantalla completa
      padding: '2rem',           // Espaciado interno
      color: 'white'             // Texto blanco (fondo es degradado morado)
    }}>
      {/* ========================================================================
          HEADER: Encabezado con título y botón de logout
          ======================================================================== */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',  // Título a la izquierda, usuario/logout a la derecha
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'  // Línea divisoria sutil
      }}>
        {/* Título y subtítulo del dashboard */}
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            Dashboard Chagas
          </h1>
          <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>
            Región de Coquimbo - Indicadores Epidemiológicos
          </p>
        </div>
        
        {/* Información del usuario y botón de logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Mostrar email del usuario autenticado */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Usuario:</p>
            {/* user?.email usa optional chaining: si user es null, no intenta acceder a email */}
            <p style={{ fontWeight: '500' }}>{user?.email || 'N/A'}</p>
          </div>
          
          {/* Botón para cerrar sesión */}
          <button
            onClick={handleLogout}  // Ejecutar handleLogout cuando se hace clic
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',  // Fondo semi-transparente
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'background-color 0.2s'
            }}
            // Efecto hover: hacer el botón más visible al pasar el mouse
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* ========================================================================
          MAIN: Contenido principal del dashboard
          ======================================================================== */}
      <main>
        {/* Tarjeta con información del proyecto */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',      // Fondo semi-transparente
          backdropFilter: 'blur(10px)',                 // Efecto de desenfoque (glassmorphism)
          borderRadius: '1rem',
          padding: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Bienvenido al Dashboard
          </h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
            Esta es la primera etapa del proyecto. La autenticación está funcionando correctamente.
          </p>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
            En las siguientes etapas se implementarán:
          </p>
          {/* Lista de funcionalidades futuras */}
          <ul style={{ 
            listStyle: 'none',      // Sin viñetas
            paddingLeft: '0',
            lineHeight: '2'
          }}>
            <li>• Visualización de KPIs epidemiológicos</li>
            <li>• Gráficos y estadísticas</li>
            <li>• Mapas interactivos de la Región de Coquimbo</li>
            <li>• Filtros y búsquedas avanzadas</li>
          </ul>
        </div>

        {/* Mostrar error si hay uno (pero el usuario está autenticado) */}
        {/* Esto puede pasar si hay un error al cerrar sesión, por ejemplo */}
        {error && user && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',  // Fondo rojo semi-transparente
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '0.5rem',
            color: 'white'
          }}>
            {error}
          </div>
        )}
      </main>
    </div>
  )
}


