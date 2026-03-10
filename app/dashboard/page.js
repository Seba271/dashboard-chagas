/**
 * ============================================================================
 * PÁGINA DE DASHBOARD (PROTEGIDA) - app/dashboard/page.js
 * ============================================================================
 * 
 * Dashboard principal con visualizaciones de indicadores epidemiológicos.
 * REQUIERE AUTENTICACIÓN.
 * 
 * FUNCIONALIDADES:
 * 1. Verifica autenticación (redirige a /login si no hay sesión)
 * 2. Muestra KPIs en tarjetas (consumiendo RPC get_kpi_summary)
 * 3. Gráfico de tendencia temporal con 2 series (Exámenes y Notificaciones)
 * 4. Gráfico de distribución por comuna (datos reales)
 * 5. Mapa interactivo de la Región de Coquimbo (puntos reales con categorías)
 * 6. Filtros para ajustar períodos y límites
 * 7. Permite cerrar sesión
 */

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useSession } from '@/src/hooks/useSession'
import { useKpiSummary } from '@/src/hooks/useKpiSummary'
import { useCasesByDateRange } from '@/src/hooks/useCasesByDateRange'
import { useCountsByComuna } from '@/src/hooks/useCountsByComuna'
import { useMapPoints } from '@/src/hooks/useMapPoints'
import KpiCard from '@/src/components/KpiCard'
import TendencyChart from '@/src/components/Charts/TendencyChart'
import ComunaBarChart from '@/src/components/Charts/ComunaBarChart'
import dynamic from 'next/dynamic'

// Importar mapa dinámicamente (Leaflet requiere cliente)
const SimpleMap = dynamic(
  () => import('@/src/components/Map/SimpleMap'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '420px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        color: '#64748b'
      }}>
        Cargando mapa...
      </div>
    )
  }
)

/**
 * Componente principal del Dashboard
 */
export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading, error: sessionError } = useSession()
  
  // Rango de fechas por defecto: últimos 12 meses
  const getDefaultDates = () => {
    const today = new Date()
    const from = new Date(today)
    from.setMonth(from.getMonth() - 12)
    return {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10)
    }
  }
  const [dateFrom, setDateFrom] = useState(() => getDefaultDates().from)
  const [dateTo, setDateTo] = useState(() => getDefaultDates().to)
  const [mapYearFilter, setMapYearFilter] = useState('all')
  const [caseTypeComunaFilter, setCaseTypeComunaFilter] = useState('all')
  const [caseTypeMapFilter, setCaseTypeMapFilter] = useState('all')
  const [sexComunaFilter, setSexComunaFilter] = useState('all')
  const [sexMapFilter, setSexMapFilter] = useState('all')
  const [ageGroupComunaFilter, setAgeGroupComunaFilter] = useState('all')
  const [ageGroupMapFilter, setAgeGroupMapFilter] = useState('all')

  // Hooks para obtener datos
  const { kpiData, loading: kpiLoading, error: kpiError } = useKpiSummary()
  const { data: casesData, loading: casesLoading, error: casesError } = useCasesByDateRange(dateFrom, dateTo)
  const { data: comunaData, loading: comunaLoading, error: comunaError } = useCountsByComuna(
    caseTypeComunaFilter,
    sexComunaFilter,
    ageGroupComunaFilter
  )
  const { data: geoPoints, loading: geoLoading, error: geoError } = useMapPoints(
    mapYearFilter,
    caseTypeMapFilter,
    sexMapFilter,
    ageGroupMapFilter
  )

  // Rango año anterior para comparación interanual (casos)
  const { prevFrom, prevTo } = useMemo(() => {
    if (!dateFrom || !dateTo) return { prevFrom: null, prevTo: null }
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const fromPrev = new Date(from)
    const toPrev = new Date(to)
    fromPrev.setFullYear(fromPrev.getFullYear() - 1)
    toPrev.setFullYear(toPrev.getFullYear() - 1)
    return { prevFrom: fromPrev.toISOString().slice(0, 10), prevTo: toPrev.toISOString().slice(0, 10) }
  }, [dateFrom, dateTo])
  const { data: prevCasesData, loading: prevCasesLoading, error: prevCasesError } = useCasesByDateRange(prevFrom, prevTo)

  // ============================================================================
  // FUNCIÓN: MANEJAR EL CIERRE DE SESIÓN
  // ============================================================================
  
  const handleLogout = async () => {
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error al cerrar sesión:', error)
      } else {
        router.push('/login')
        router.refresh()
      }
    } catch (err) {
      console.error('Error inesperado al cerrar sesión:', err)
    }
  }

  // ============================================================================
  // RENDERIZADO CONDICIONAL: ESTADO DE CARGA
  // ============================================================================
  
  if (sessionLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: '#64748b',
        background: '#f1f5f9'
      }}>
        <div style={{ fontSize: '1.25rem' }}>Cargando dashboard...</div>
      </div>
    )
  }

  // ============================================================================
  // RENDERIZADO CONDICIONAL: ESTADO DE ERROR (SIN USUARIO)
  // ============================================================================
  
  if (sessionError && !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{sessionError}</p>
          <button
            onClick={() => router.push('/login')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500'
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
  // Base para %: solo personas con Chagas (casos), no el total de persona
  const totalCasos = kpiData?.total_personas_casos ?? kpiData?.total_personas ?? 0
  const kpiPercentages = {
    pctBajoControl: totalCasos && kpiData?.total_bajo_control != null
      ? (kpiData.total_bajo_control / totalCasos) * 100
      : 0,
    pctAgudo: totalCasos && kpiData?.total_agudo != null
      ? (kpiData.total_agudo / totalCasos) * 100
      : 0,
    pctGestantes: totalCasos && kpiData?.total_gestantes != null
      ? (kpiData.total_gestantes / totalCasos) * 100
      : 0
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  }
  const inputStyle = {
    padding: '0.5rem 0.75rem',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    fontSize: '0.875rem'
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '1.5rem 1rem',
      background: '#f1f5f9',
      color: '#1e293b',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* ========================================================================
          HEADER: Encabezado con título y botón de logout
          ======================================================================== */}
      <header style={{
        ...cardStyle,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1.25rem 1.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem', color: '#1e293b' }}>
            Dashboard Chagas
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Región de Coquimbo — Indicadores Epidemiológicos
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario</p>
            <p style={{ fontWeight: '500', fontSize: '0.875rem', color: '#1e293b' }}>{user?.email || 'N/A'}</p>
          </div>
          
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffffff',
              color: '#0d9488',
              border: '1px solid #0d9488',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#0d9488'
              e.target.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#ffffff'
              e.target.style.color = '#0d9488'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* ========================================================================
          MAIN: Contenido principal del dashboard
          ======================================================================== */}
      <main>
        {/* Sección de KPIs */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '1rem',
            color: '#1e293b',
            letterSpacing: '-0.02em'
          }}>
            Indicadores principales
          </h2>
          
          {kpiError && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              color: '#dc2626',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              Error al cargar KPIs: {kpiError}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <KpiCard title="Total casos (Chagas)" value={kpiData?.total_personas_casos ?? kpiData?.total_personas ?? 0} icon="👥" color="#0d9488" loading={kpiLoading} />
            <KpiCard title="Total Exámenes" value={kpiData?.total_examenes || 0} icon="🔬" color="#0d9488" loading={kpiLoading} />
            <KpiCard title="Bajo Control" value={kpiData?.total_bajo_control || 0} icon="✅" color="#0d9488" loading={kpiLoading} />
            <KpiCard title="Casos Agudos" value={kpiData?.total_agudo || 0} icon="⚠️" color="#f59e0b" loading={kpiLoading} />
            <KpiCard title="Gestantes" value={kpiData?.total_gestantes || 0} icon="🤰" color="#0d9488" loading={kpiLoading} />
            <KpiCard title="Inasistentes" value={kpiData?.total_inasistentes || 0} icon="📅" color="#ef4444" loading={kpiLoading} />
            <KpiCard title="Tratamientos" value={kpiData?.total_tratamientos || 0} icon="💊" color="#0d9488" loading={kpiLoading} />
            <KpiCard
              title="% Bajo control"
              value={
                kpiLoading || !totalCasos
                  ? 'N/A'
                  : `${kpiPercentages.pctBajoControl.toFixed(1)} %`
              }
              icon="📈"
              color="#0d9488"
              loading={kpiLoading}
            />
            <KpiCard
              title="% Casos agudos"
              value={
                kpiLoading || !totalCasos
                  ? 'N/A'
                  : `${kpiPercentages.pctAgudo.toFixed(1)} %`
              }
              icon="⚠️"
              color="#f97316"
              loading={kpiLoading}
            />
            <KpiCard
              title="% Gestantes"
              value={
                kpiLoading || !totalCasos
                  ? 'N/A'
                  : `${kpiPercentages.pctGestantes.toFixed(1)} %`
              }
              icon="🤰"
              color="#0ea5e9"
              loading={kpiLoading}
            />
          </div>
        </section>

        {/* Sección de Gráficos */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b',
              letterSpacing: '-0.02em'
            }}>
              Análisis temporal y geográfico
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {/* Gráfico: Casos en el tiempo */}
            <div>
              {(casesError || prevCasesError) && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {casesError && `Error casos: ${casesError}`}
                  {prevCasesError && ` Error casos (año anterior): ${prevCasesError}`}
                </div>
              )}
              <TendencyChart
                casesData={casesData || []}
                prevCasesData={prevCasesData || []}
                title="Casos en el tiempo"
                type="line"
                loading={casesLoading || prevCasesLoading}
                controls={
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      max={dateTo}
                      style={{
                        ...inputStyle,
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem'
                      }}
                    />
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={dateFrom}
                      style={{
                        ...inputStyle,
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem'
                      }}
                    />
                  </div>
                }
              />
            </div>

            {/* Gráfico de Distribución por Comuna */}
            <div>
              {comunaError && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  Error: {comunaError}
                </div>
              )}
              <ComunaBarChart
                data={comunaData || []}
                title="Casos por comuna"
                loading={comunaLoading}
                controls={
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Tipo de caso</label>
                      <select
                        value={caseTypeComunaFilter}
                        onChange={(e) => setCaseTypeComunaFilter(e.target.value)}
                        style={{
                          ...inputStyle,
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <option value="all">Todos</option>
                        <option value="agudo">Agudos</option>
                        <option value="bajo_control">Bajo control</option>
                        <option value="gestante">Gestantes</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Sexo</label>
                      <select
                        value={sexComunaFilter}
                        onChange={(e) => setSexComunaFilter(e.target.value)}
                        style={{
                          ...inputStyle,
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <option value="all">Todos</option>
                        <option value="F">Femenino</option>
                        <option value="M">Masculino</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Grupo etario</label>
                      <select
                        value={ageGroupComunaFilter}
                        onChange={(e) => setAgeGroupComunaFilter(e.target.value)}
                        style={{
                          ...inputStyle,
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <option value="all">Todos</option>
                        <option value="0_14">0-14</option>
                        <option value="15_29">15-29</option>
                        <option value="30_44">30-44</option>
                        <option value="45_59">45-59</option>
                        <option value="60_plus">60+</option>
                      </select>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        {/* Sección de Mapa */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', letterSpacing: '-0.02em' }}>
              Mapa geográfico
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Tipo de caso</label>
                <select
                  value={caseTypeMapFilter}
                  onChange={(e) => setCaseTypeMapFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="all">Todos</option>
                  <option value="agudo">Agudos</option>
                  <option value="bajo_control">Bajo control</option>
                  <option value="gestante">Gestantes</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Sexo</label>
                <select
                  value={sexMapFilter}
                  onChange={(e) => setSexMapFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="all">Todos</option>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Grupo etario</label>
                <select
                  value={ageGroupMapFilter}
                  onChange={(e) => setAgeGroupMapFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="all">Todos</option>
                  <option value="0_14">0-14</option>
                  <option value="15_29">15-29</option>
                  <option value="30_44">30-44</option>
                  <option value="45_59">45-59</option>
                  <option value="60_plus">60+</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Año</label>
                <select
                  value={mapYearFilter}
                  onChange={(e) => setMapYearFilter(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="all">Todo el tiempo</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
          </div>
          {geoError && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              color: '#dc2626',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              Error al cargar puntos geográficos: {geoError}
            </div>
          )}

          <SimpleMap points={geoPoints || []} loading={geoLoading} />
        </section>
      </main>
    </div>
  )
}
