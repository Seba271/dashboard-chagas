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

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useSession } from '@/src/hooks/useSession'
import { useKpiSummary } from '@/src/hooks/useKpiSummary'
import { useExamsByMonth } from '@/src/hooks/useExamsByMonth'
import { useNotificationsByMonth } from '@/src/hooks/useNotificationsByMonth'
import { useCountsByComuna } from '@/src/hooks/useCountsByComuna'
import { useGeoPoints } from '@/src/hooks/useGeoPoints'
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
        height: '500px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        color: 'rgba(255, 255, 255, 0.5)'
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
  
  // Estados para filtros
  const [monthsFilter, setMonthsFilter] = useState(12)
  const [comunaLimitFilter, setComunaLimitFilter] = useState(10)
  const [mapLimitFilter, setMapLimitFilter] = useState(1000)

  // Hooks para obtener datos
  const { kpiData, loading: kpiLoading, error: kpiError } = useKpiSummary()
  const { data: examsData, loading: examsLoading, error: examsError } = useExamsByMonth(monthsFilter)
  const { data: notificationsData, loading: notificationsLoading, error: notificationsError } = useNotificationsByMonth(monthsFilter)
  const { data: comunaData, loading: comunaLoading, error: comunaError } = useCountsByComuna(comunaLimitFilter)
  const { data: geoPoints, loading: geoLoading, error: geoError } = useGeoPoints(mapLimitFilter)

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
        color: 'white'
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
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{sessionError}</p>
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
  
  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      color: 'white'
    }}>
      {/* ========================================================================
          HEADER: Encabezado con título y botón de logout
          ======================================================================== */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            Dashboard Chagas
          </h1>
          <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>
            Región de Coquimbo - Indicadores Epidemiológicos
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Usuario:</p>
            <p style={{ fontWeight: '500' }}>{user?.email || 'N/A'}</p>
          </div>
          
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'background-color 0.2s'
            }}
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
        {/* Sección de KPIs */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            color: 'white'
          }}>
            Indicadores Principales
          </h2>
          
          {kpiError && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '0.5rem',
              color: 'white',
              marginBottom: '1rem'
            }}>
              Error al cargar KPIs: {kpiError}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            <KpiCard
              title="Total Personas"
              value={kpiData?.total_personas || 0}
              icon="👥"
              color="#667eea"
              loading={kpiLoading}
            />
            <KpiCard
              title="Total Exámenes"
              value={kpiData?.total_examenes || 0}
              icon="🔬"
              color="#10b981"
              loading={kpiLoading}
            />
            <KpiCard
              title="Bajo Control"
              value={kpiData?.total_bajo_control || 0}
              icon="✅"
              color="#3b82f6"
              loading={kpiLoading}
            />
            <KpiCard
              title="Casos Agudos"
              value={kpiData?.total_agudo || 0}
              icon="⚠️"
              color="#f59e0b"
              loading={kpiLoading}
            />
            <KpiCard
              title="Gestantes"
              value={kpiData?.total_gestantes || 0}
              icon="🤰"
              color="#ec4899"
              loading={kpiLoading}
            />
            <KpiCard
              title="Inasistentes"
              value={kpiData?.total_inasistentes || 0}
              icon="📅"
              color="#ef4444"
              loading={kpiLoading}
            />
            <KpiCard
              title="Tratamientos"
              value={kpiData?.total_tratamientos || 0}
              icon="💊"
              color="#8b5cf6"
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
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'white'
            }}>
              Análisis Temporal y Geográfico
            </h2>
            
            {/* Filtro de meses para gráficos */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <label style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                Período:
              </label>
              <select
                value={monthsFilter}
                onChange={(e) => setMonthsFilter(parseInt(e.target.value))}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '1.5rem'
          }}>
            {/* Gráfico de Tendencia */}
            <div>
              {(examsError || notificationsError) && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {examsError && `Error exámenes: ${examsError}`}
                  {notificationsError && ` Error notificaciones: ${notificationsError}`}
                </div>
              )}
              <TendencyChart
                examsData={examsData || []}
                notificationsData={notificationsData || []}
                title="Tendencia Temporal"
                type="line"
                loading={examsLoading || notificationsLoading}
              />
            </div>

            {/* Gráfico de Distribución por Comuna */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <div style={{ flex: 1 }} />
                {/* Filtro de límite para comunas */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <label style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    Top:
                  </label>
                  <select
                    value={comunaLimitFilter}
                    onChange={(e) => setComunaLimitFilter(parseInt(e.target.value))}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
              
              {comunaError && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  Error: {comunaError}
                </div>
              )}
              <ComunaBarChart
                data={comunaData || []}
                title="Distribución por Comuna"
                loading={comunaLoading}
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
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'white'
            }}>
              Mapa Geográfico
            </h2>
            
            {/* Filtro de límite para mapa */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <label style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                Límite de puntos:
              </label>
              <select
                value={mapLimitFilter}
                onChange={(e) => setMapLimitFilter(parseInt(e.target.value))}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
              </select>
            </div>
          </div>

          {geoError && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '0.5rem',
              color: 'white',
              marginBottom: '1rem'
            }}>
              Error al cargar puntos geográficos: {geoError}
            </div>
          )}

          <SimpleMap 
            points={geoPoints || []} 
            loading={geoLoading}
          />
        </section>
      </main>
    </div>
  )
}
