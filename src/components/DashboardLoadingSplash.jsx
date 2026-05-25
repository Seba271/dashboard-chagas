/**
 * Splash de carga para el panel epidemiológico (sesión + perfil).
 */
export default function DashboardLoadingSplash({
  title = 'Cargando dashboard',
  subtitle = 'Preparando tus indicadores y permisos…'
}) {
  return (
    <div className="dashboardLoadingSplashCard" role="status" aria-busy="true" aria-live="polite">
      <div className="dashboardLoadingSplashOrbit">
        <div className="dashboardLoadingSplashOrbitGlow" aria-hidden />
        <div className="dashboardLoadingSplashOrbitRing" aria-hidden />
      </div>
      <p className="dashboardLoadingSplashTitle">{title}</p>
      <p className="dashboardLoadingSplashSubtitle">{subtitle}</p>
    </div>
  )
}
