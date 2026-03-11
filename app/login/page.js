/**
 * ============================================================================
 * PÁGINA DE LOGIN - app/login/page.js
 * ============================================================================
 * 
 * Esta página permite a los usuarios autenticarse con email y contraseña.
 * 
 * FUNCIONALIDADES:
 * 1. Verifica si el usuario ya está autenticado (si es así, redirige al dashboard)
 * 2. Muestra un formulario de login (email y contraseña)
 * 3. Valida las credenciales con Supabase Auth
 * 4. Si las credenciales son correctas, crea una sesión y redirige al dashboard
 * 5. Si las credenciales son incorrectas, muestra un mensaje de error
 * 
 * FLUJO:
 * Usuario ingresa email/password → Supabase valida → Si OK: sesión creada → Redirige a /dashboard
 */

// 'use client' es necesario porque usamos hooks de React y eventos del navegador
'use client'

// useState: Hook para manejar el estado del componente (valores que cambian)
// useEffect: Hook para ejecutar código cuando el componente se monta o cambia
import { useState, useEffect } from 'react'

// useRouter: Para navegar entre páginas
import { useRouter } from 'next/navigation'

// Importar función para crear cliente Supabase
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Componente de la página de login
 */
export default function LoginPage() {
  // ============================================================================
  // HOOKS Y ESTADO
  // ============================================================================
  
  // Router para navegar entre páginas
  const router = useRouter()
  
  // Estado para el email del formulario
  // useState('') crea una variable 'email' con valor inicial '' (vacío)
  // setEmail es la función para actualizar el valor de email
  const [email, setEmail] = useState('')
  
  // Estado para la contraseña del formulario
  const [password, setPassword] = useState('')
  
  // Estado para saber si se está procesando el login
  // true = está enviando datos, false = no está procesando
  // Se usa para deshabilitar el botón y mostrar "Iniciando sesión..."
  const [loading, setLoading] = useState(false)
  
  // Estado para almacenar mensajes de error
  // null = no hay error, string = mensaje de error a mostrar
  const [error, setError] = useState(null)
  
  // Estado para saber si estamos verificando si ya hay una sesión activa
  // true = estamos verificando, false = ya verificamos
  // Evita mostrar el formulario antes de saber si el usuario ya está logueado
  const [checkingSession, setCheckingSession] = useState(true)

  // ============================================================================
  // EFECTO: VERIFICAR SESIÓN AL CARGAR LA PÁGINA
  // ============================================================================
  
  // useEffect se ejecuta cuando el componente se monta (cuando se carga la página)
  useEffect(() => {
    /**
     * Función para verificar si el usuario ya tiene una sesión activa
     * 
     * Si el usuario ya está logueado, no tiene sentido mostrar el formulario de login,
     * así que lo redirigimos directamente al dashboard.
     */
    const checkSession = async () => {
      // Crear cliente Supabase
      const supabase = createSupabaseClient()
      
      // Obtener la sesión actual (busca en localStorage/cookies)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Si hay sesión, el usuario ya está autenticado
        // Redirigir al dashboard (no mostrar el formulario de login)
        router.push('/dashboard')
      } else {
        // Si no hay sesión, el usuario necesita hacer login
        // Cambiar el estado para mostrar el formulario
        setCheckingSession(false)
      }
    }

    // Ejecutar la verificación
    checkSession()
  }, [router]) // Se ejecuta cuando el componente se monta o cuando router cambia

  // ============================================================================
  // FUNCIÓN: MANEJAR EL ENVÍO DEL FORMULARIO DE LOGIN
  // ============================================================================
  
  /**
   * Esta función se ejecuta cuando el usuario envía el formulario (hace clic en "Iniciar Sesión")
   * 
   * @param {Event} e - Evento del formulario (necesario para prevenir el comportamiento por defecto)
   */
  const handleLogin = async (e) => {
    // Prevenir el comportamiento por defecto del formulario
    // Sin esto, la página se recargaría al enviar el formulario
    e.preventDefault()
    
    // Activar el estado de carga (deshabilita el botón y muestra "Iniciando sesión...")
    setLoading(true)
    
    // Limpiar cualquier error previo
    setError(null)

    try {
      // Crear cliente Supabase
      const supabase = createSupabaseClient()
      
      // Intentar autenticar al usuario con email y contraseña
      // signInWithPassword() es una función de Supabase Auth que:
      // 1. Valida las credenciales contra la base de datos
      // 2. Si son correctas, crea una sesión y la guarda en el navegador
      // 3. Retorna { data: { session, user }, error: null } si es exitoso
      // 4. Retorna { data: { session: null, user: null }, error: {...} } si falla
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,      // Email ingresado por el usuario
        password,   // Contraseña ingresada por el usuario
      })

      // Si hay un error en la autenticación
      if (authError) {
        const rawMessage = authError.message || ''
        const normalized = rawMessage.toLowerCase()
        const spanishMessage =
          normalized.includes('invalid login credentials')
            ? 'Correo o contraseña incorrectos.'
            : rawMessage || 'Error al iniciar sesión'

        setError(spanishMessage)
        
        // Desactivar el estado de carga para que el usuario pueda intentar de nuevo
        setLoading(false)
        
        // Salir de la función (no redirigir)
        return
      }

      // Si no hay error y hay una sesión creada
      if (data.session) {
        // El login fue exitoso
        // Redirigir al usuario al dashboard
        router.push('/dashboard')
        
        // Refrescar el router para asegurar que los cambios se apliquen
        router.refresh()
      }
    } catch (err) {
      // Capturar cualquier error inesperado (no relacionado con Supabase)
      // Por ejemplo: error de red, error de JavaScript, etc.
      setError('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
      setLoading(false)
    }
  }

  // ============================================================================
  // RENDERIZADO CONDICIONAL: ESTADO DE CARGA INICIAL
  // ============================================================================
  
  // Si todavía estamos verificando si hay una sesión activa,
  // mostramos un mensaje de carga en lugar del formulario
  // Esto evita que el formulario aparezca y desaparezca rápidamente
  if (checkingSession) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 'clamp(1rem, 5vw, 2rem)',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      }}>
        <div style={{ color: '#0c4a6e', fontSize: 'clamp(1rem, 4vw, 1.25rem)' }}>Verificando sesión...</div>
      </div>
    )
  }

  // ============================================================================
  // RENDERIZADO: FORMULARIO DE LOGIN
  // ============================================================================
  
  // Si ya verificamos la sesión y no hay sesión activa, mostramos el formulario
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: 'clamp(1rem, 5vw, 2rem)',
      boxSizing: 'border-box',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'clamp(0.75rem, 2vw, 1rem)',
        padding: 'clamp(1.5rem, 5vw, 2.5rem)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '400px',
        minWidth: 0,
        boxSizing: 'border-box',
      }}>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 5vw, 2rem)',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          color: '#1f2937',
          textAlign: 'center',
        }}>
          Dashboard Chagas
        </h1>
        <p style={{
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
          fontSize: 'clamp(0.8125rem, 2vw, 0.875rem)',
        }}>
          Inicia sesión para acceder al sistema
        </p>

        {/* Formulario de login */}
        {/* onSubmit={handleLogin} ejecuta handleLogin cuando el usuario envía el formulario */}
        <form onSubmit={handleLogin}>
          {/* Campo de Email */}
          <div style={{ marginBottom: '1.5rem' }}>
            {/* Label para el campo de email - Conecta el label con el input mediante el id */}
            <label 
              htmlFor="email"
              style={{
                // Hace que el label ocupe toda la línea
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151'
              }}
            >
              Email
            </label>
            {/* Input de email - ID que conecta con el label, tipo email valida formato básico */}
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              style={{
                width: '100%',
                padding: 'clamp(0.75rem, 2.5vw, 1rem)',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: 'clamp(1rem, 2.5vw, 1rem)',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              // Cambiar color del borde cuando el usuario hace foco en el input
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              // Volver al color original cuando pierde el foco
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* Campo de Contraseña */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151'
              }}
            >
              Contraseña
            </label>
            {/* Input de contraseña - type="password" oculta los caracteres mientras se escribe */}
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: 'clamp(0.75rem, 2.5vw, 1rem)',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          {/* Mostrar mensaje de error si existe - Renderizado condicional: solo se muestra si error tiene un valor */}
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              // Fondo rojo claro
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              // Texto rojo
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              {/* Mostrar el mensaje de error */}
              {error}
            </div>
          )}

          {/* Botón de envío del formulario - type="submit" hace que se ejecute onSubmit del form */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 'clamp(0.75rem, 2.5vw, 1rem)',
              minHeight: '48px',
              backgroundColor: loading ? '#9ca3af' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: 'clamp(1rem, 2.5vw, 1rem)',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              boxSizing: 'border-box',
            }}
            // Efecto hover: oscurecer el botón cuando el mouse pasa por encima
            onMouseEnter={(e) => {
              if (!loading) e.target.style.backgroundColor = '#5568d3'
            }}
            // Volver al color original cuando el mouse sale
            onMouseLeave={(e) => {
              if (!loading) e.target.style.backgroundColor = '#667eea'
            }}
          >
            {/* Mostrar texto diferente según el estado de carga */}
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}


