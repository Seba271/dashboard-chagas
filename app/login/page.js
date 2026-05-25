/**
 * Página de login: sesión previa → formulario Supabase Auth → dashboard.
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { createSupabaseClient } from '@/lib/supabase'
import { canAccessDashboard } from '@/lib/dashboardRoles'
import { setProfileBootstrap } from '@/lib/profileBootstrap'

import styles from './login.module.css'

/** Tarjeta de carga (spinner + textos); reutilizada al verificar sesión y tras enviar el formulario. */
function LoginSpinnerCard({ title, subtitle }) {
  return (
    <div className={styles.splashCard} role="status" aria-busy="true" aria-live="polite">
      <div className={styles.orbitWrap}>
        <div className={styles.orbitGlow} aria-hidden />
        <div className={styles.orbitOuter} aria-hidden />
      </div>
      <p className={styles.splashTitle}>{title}</p>
      <p className={styles.splashSubtitle}>{subtitle}</p>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const m = new URLSearchParams(window.location.search).get('motivo')
      if (m === 'sin_acceso') {
        setError('Tu cuenta no tiene acceso al panel. Consultá con un administrador.')
      }
    }
  }, [])

  /* Precarga código de /dashboard cuando el usuario ve el login (primer paint más rápido al navegar). */
  useEffect(() => {
    router.prefetch('/dashboard')
  }, [router])

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createSupabaseClient()

      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, email')
          .eq('id', session.user.id)
          .maybeSingle()

        if (!prof || !canAccessDashboard(prof.role)) {
          await supabase.auth.signOut()
          setCheckingSession(false)
          return
        }

        setProfileBootstrap(session.user.id, prof)
        router.push('/dashboard')
      } else {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createSupabaseClient()

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        const rawMessage = authError.message || ''
        const normalized = rawMessage.toLowerCase()
        const spanishMessage =
          normalized.includes('invalid login credentials')
            ? 'Correo o contraseña incorrectos.'
            : rawMessage || 'Error al iniciar sesión'

        setError(spanishMessage)
        setLoading(false)
        return
      }

      if (data.session && data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, email')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!prof || !canAccessDashboard(prof.role)) {
          await supabase.auth.signOut()
          setError('Esta cuenta no tiene permiso para acceder al panel epidemiológico.')
          setLoading(false)
          return
        }

        setProfileBootstrap(data.user.id, prof)
        router.push('/dashboard')
      }
    } catch (_err) {
      setError('Ocurrió un error inesperado. Por favor, intenta nuevamente.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className={styles.page}>
        <div className={styles.splashChecking}>
          <LoginSpinnerCard
            title="Un momento…"
            subtitle="Estamos comprobando si ya tenés una sesión activa en este dispositivo."
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {loading ? (
        <div className={styles.splash}>
          <LoginSpinnerCard
            title="Entrando al panel"
            subtitle="Validando tus credenciales de forma segura. Solo debería tomar un par de segundos."
          />
        </div>
      ) : null}

      <div className={styles.glowBackdrop} aria-hidden />
      <div className={styles.pageInner}>
        <div className={styles.card}>
          <div className={styles.logoMark} aria-hidden>
            <svg className={styles.logoMarkSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 12h4l2-8 5 17 4-17 2 8h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className={styles.title}>Dashboard casos Chagas</h1>
          <p className={styles.tagline}>Iniciá sesión para acceder al sistema</p>
          <p className={styles.hint}>
            Usá el correo que te dio el equipo del programa y la contraseña asignada. Si no tenés cuenta o olvidaste
            la clave, consultá al administrador.
          </p>

          <form onSubmit={handleLogin}>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                placeholder="ejemplo@correoinstitucional.cl"
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                placeholder="Contraseña de tu cuenta"
                className={styles.input}
              />
            </div>

            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
