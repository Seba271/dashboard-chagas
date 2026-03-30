/**
 * Dashboard Chagas — orden: filtros → KPIs → análisis → mapa → seguimiento clínico.
 */

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useSession } from '@/src/hooks/useSession'
import { useKpiSummary } from '@/src/hooks/useKpiSummary'
import { useCasesByDateRange } from '@/src/hooks/useCasesByDateRange'
import { useCountsByComuna } from '@/src/hooks/useCountsByComuna'
import { useMapPoints } from '@/src/hooks/useMapPoints'
import { exportCasesSeriesCsv, exportComunaRankingCsv } from '@/lib/exportDashboardData'
import { schedulePrintChartResize } from '@/lib/printEchartsResize'
import KpiCard from '@/src/components/KpiCard'
import TendencyChart from '@/src/components/Charts/TendencyChart'
import ComunaBarChart from '@/src/components/Charts/ComunaBarChart'
import ComunaRankingTable from '@/src/components/Charts/ComunaRankingTable'
import DashboardGlobalFilters from '@/src/components/DashboardGlobalFilters'
import FollowupAlertsSection from '@/src/components/FollowupAlertsSection'
import dynamic from 'next/dynamic'

const SimpleMap = dynamic(
  () => import('@/src/components/Map/SimpleMap'),
  {
    ssr: false,
    loading: () => (
      <div className="dashboardMapLoading">Cargando mapa...</div>
    )
  }
)

function getDefaultDates() {
  const today = new Date()
  const from = new Date(today)
  from.setMonth(from.getMonth() - 12)
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10)
  }
}

function comunaMatches(selected, comuna) {
  if (!selected || !String(selected).trim()) return true
  return (comuna || '').trim().toLowerCase() === String(selected).trim().toLowerCase()
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading, error: sessionError } = useSession()

  const [dateFrom, setDateFrom] = useState(() => getDefaultDates().from)
  const [dateTo, setDateTo] = useState(() => getDefaultDates().to)
  const [globalYear, setGlobalYear] = useState('all')
  const [globalComuna, setGlobalComuna] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('all')
  const [sexFilter, setSexFilter] = useState('all')
  const [ageGroupFilter, setAgeGroupFilter] = useState('all')

  const { kpiData, loading: kpiLoading, error: kpiError } = useKpiSummary()
  const { data: casesData, loading: casesLoading, error: casesError } = useCasesByDateRange(dateFrom, dateTo)
  const { data: comunaData, loading: comunaLoading, error: comunaError } = useCountsByComuna(
    caseTypeFilter,
    sexFilter,
    ageGroupFilter
  )

  // Para recalcular porcentajes cuando hay comuna seleccionada.
  // get_kpi_summary() no recibe filtros, por eso usamos get_counts_by_comuna por tipo.
  const { data: comunaCountsAll, loading: comunaCountsAllLoading, error: comunaCountsAllError } = useCountsByComuna(
    'all',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsBajo, loading: comunaCountsBajoLoading, error: comunaCountsBajoError } = useCountsByComuna(
    'bajo_control',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsAgudo, loading: comunaCountsAgudoLoading, error: comunaCountsAgudoError } = useCountsByComuna(
    'agudo',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsGestantes, loading: comunaCountsGestantesLoading, error: comunaCountsGestantesError } = useCountsByComuna(
    'gestante',
    sexFilter,
    ageGroupFilter
  )

  const mapYearFilter = globalYear === 'all' ? 'all' : globalYear
  const { data: geoPoints, loading: geoLoading, error: geoError, refetch: refetchMapPoints } = useMapPoints(
    mapYearFilter,
    caseTypeFilter,
    sexFilter,
    ageGroupFilter
  )

  // Refresco suave para KPIs basados en mapa (p.ej. "Casos nuevos (mes)").
  // Sin realtime, el dashboard no detecta inserts en BD hasta recargar o refetchear.
  useEffect(() => {
    if (typeof refetchMapPoints !== 'function') return

    const onFocus = () => refetchMapPoints()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchMapPoints()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    const intervalId = window.setInterval(() => refetchMapPoints(), 30000)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(intervalId)
    }
  }, [refetchMapPoints])

  useEffect(() => {
    if (globalYear === 'all') {
      const d = getDefaultDates()
      setDateFrom(d.from)
      setDateTo(d.to)
      return
    }
    const y = parseInt(globalYear, 10)
    if (Number.isNaN(y)) return
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const endOfYear = new Date(y, 11, 31)
    const cap = today < endOfYear ? today : endOfYear
    setDateFrom(`${y}-01-01`)
    setDateTo(cap.toISOString().slice(0, 10))
  }, [globalYear])

  const resetFilters = useCallback(() => {
    setGlobalYear('all')
    setGlobalComuna('')
    setCaseTypeFilter('all')
    setSexFilter('all')
    setAgeGroupFilter('all')
  }, [])

  /** ECharts debe redimensionarse al imprimir (layout distinto al de pantalla). */
  useEffect(() => {
    const onBeforePrint = () => schedulePrintChartResize()
    const onAfterPrint = () => schedulePrintChartResize()
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [])

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

  const { data: prevCasesData, loading: prevCasesLoading, error: prevCasesError } = useCasesByDateRange(
    prevFrom,
    prevTo
  )

  const comunaOptions = useMemo(() => {
    if (!comunaData?.length) return []
    const set = new Set(comunaData.map((r) => r.comuna).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [comunaData])

  const comunaDataFiltered = useMemo(() => {
    if (!comunaData?.length) return []
    if (!globalComuna.trim()) return comunaData
    return comunaData.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [comunaData, globalComuna])

  const geoFiltered = useMemo(() => {
    if (!geoPoints?.length) return []
    if (!globalComuna.trim()) return geoPoints
    return geoPoints.filter((p) => comunaMatches(globalComuna, p.comuna))
  }, [geoPoints, globalComuna])

  const nuevosEsteMes = useMemo(() => {
    // Con comuna: usamos los puntos del mapa para respetar el filtro (si el RPC trae comuna).
    if (globalComuna.trim()) {
      return geoFiltered.filter((p) => p.isNewCase).length
    }

    // Sin comuna: usamos la serie temporal (no depende de coordenadas/mapa).
    const rows = casesData || []
    if (!rows.length) return 0
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return rows
      .filter((r) => typeof r.month === 'string' && r.month.startsWith(ym))
      .reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [globalComuna, geoFiltered, casesData])

  const totalCasosRegion = kpiData?.total_personas_casos ?? kpiData?.total_personas ?? 0

  /** Casos en el período del gráfico temporal (dateFrom–dateTo), alineado al filtro de año del panel. */
  const totalCasosSinComunaPeriodo = useMemo(() => {
    const rows = casesData || []
    return rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [casesData])

  const totalCasosDisplay = useMemo(() => {
    if (!globalComuna.trim()) {
      return totalCasosSinComunaPeriodo
    }
    if (globalYear !== 'all') {
      return geoFiltered.length
    }
    return comunaDataFiltered.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [globalComuna, globalYear, comunaDataFiltered, geoFiltered, totalCasosSinComunaPeriodo])

  const refRegional = !!globalComuna.trim()

  const selectedCountsAll = useMemo(() => {
    if (!refRegional) return []
    if (!comunaCountsAll?.length) return []
    return comunaCountsAll.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, comunaCountsAll, globalComuna])

  const selectedCountsBajo = useMemo(() => {
    if (!refRegional) return []
    if (!comunaCountsBajo?.length) return []
    return comunaCountsBajo.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, comunaCountsBajo, globalComuna])

  const selectedCountsAgudo = useMemo(() => {
    if (!refRegional) return []
    if (!comunaCountsAgudo?.length) return []
    return comunaCountsAgudo.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, comunaCountsAgudo, globalComuna])

  const selectedCountsGestantes = useMemo(() => {
    if (!refRegional) return []
    if (!comunaCountsGestantes?.length) return []
    return comunaCountsGestantes.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, comunaCountsGestantes, globalComuna])

  const totalCasosForPercent = useMemo(() => {
    // Sin comuna: proporciones siguen usando el total regional de KPI (mismos numeradores que get_kpi_summary).
    if (!refRegional) return totalCasosRegion
    return totalCasosDisplay
  }, [refRegional, totalCasosRegion, totalCasosDisplay])

  const bajoForPercent = useMemo(() => {
    if (!refRegional) return kpiData?.total_bajo_control ?? 0
    return selectedCountsBajo.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, kpiData?.total_bajo_control, selectedCountsBajo])

  const agudoForPercent = useMemo(() => {
    if (!refRegional) return kpiData?.total_agudo ?? 0
    return selectedCountsAgudo.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, kpiData?.total_agudo, selectedCountsAgudo])

  const gestantesForPercent = useMemo(() => {
    if (!refRegional) return kpiData?.total_gestantes ?? 0
    return selectedCountsGestantes.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, kpiData?.total_gestantes, selectedCountsGestantes])

  const loadingPercentages = refRegional
    ? comunaLoading ||
      comunaCountsAllLoading ||
      comunaCountsBajoLoading ||
      comunaCountsAgudoLoading ||
      comunaCountsGestantesLoading
    : kpiLoading

  const kpiPercentages = useMemo(
    () => ({
      pctBajoControl: totalCasosForPercent ? (bajoForPercent / totalCasosForPercent) * 100 : 0,
      pctAgudo: totalCasosForPercent ? (agudoForPercent / totalCasosForPercent) * 100 : 0,
      pctGestantes: totalCasosForPercent ? (gestantesForPercent / totalCasosForPercent) * 100 : 0
    }),
    [totalCasosForPercent, bajoForPercent, agudoForPercent, gestantesForPercent]
  )

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) console.error('Error al cerrar sesión:', error)
      else {
        router.push('/login')
        router.refresh()
      }
    } catch (err) {
      console.error('Error inesperado al cerrar sesión:', err)
    }
  }

  if (sessionLoading) {
    return (
      <div className="dashboardStateScreen">
        <p>Cargando dashboard...</p>
      </div>
    )
  }

  if (sessionError && !user) {
    return (
      <div className="dashboardStateScreen">
        <div className="dashboardStateCard">
          <p className="dashboardStateError">{sessionError}</p>
          <button type="button" className="dashboardStateBtnPrimary" onClick={() => router.push('/login')}>
            Ir a Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell dashboardPageRoot">
      <div className="print-only printHeader">
        <h1>Dashboard Chagas — Resumen</h1>
        <p>{new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}</p>
      </div>

      <header className="dashboardPageHeader no-print">
        <div className="dashboardPageHeaderTitles">
          <h1>Dashboard Chagas</h1>
          <p>Región de Coquimbo — Indicadores epidemiológicos</p>
        </div>
        <div className="dashboardPageHeaderActions">
          <button
            type="button"
            className="dashboardPrintBtn"
            onClick={() => window.print()}
            aria-label="Imprimir resumen del dashboard"
          >
            Imprimir resumen
          </button>
          <div className="dashboardUserBlock">
            <span>Usuario</span>
            <strong>{user?.email || 'N/A'}</strong>
          </div>
          <button type="button" className="dashboardLogoutBtn" onClick={handleLogout} aria-label="Cerrar sesión">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboardMain">
        {/* 1. Filtros */}
        <DashboardGlobalFilters
          globalYear={globalYear}
          onGlobalYearChange={setGlobalYear}
          globalComuna={globalComuna}
          onGlobalComunaChange={setGlobalComuna}
          comunaOptions={comunaOptions}
          caseTypeFilter={caseTypeFilter}
          onCaseTypeChange={setCaseTypeFilter}
          sexFilter={sexFilter}
          onSexChange={setSexFilter}
          ageGroupFilter={ageGroupFilter}
          onAgeGroupChange={setAgeGroupFilter}
          onResetFilters={resetFilters}
        />

        {/* 2. KPIs agrupados */}
        <section className="dashboardSection" aria-labelledby="kpi-heading">
          <div className="dashboardSectionHead">
            <h2 id="kpi-heading" className="dashboardSectionTitle">
              Indicadores principales
            </h2>
            <p className="dashboardSectionLead">
              El total de casos (Chagas) sigue el período del gráfico temporal según el año del panel; con comuna
              seleccionada se alinea al mapa (año + comuna).
            </p>
          </div>

          {refRegional && (
            <p className="dashboard-kpi-hint no-print">
              Con comuna seleccionada, el total de casos, &quot;Casos nuevos (mes)&quot; y las proporciones se recalculan
              para esa comuna. Los KPIs de &quot;Programa y vigilancia&quot; siguen siendo referencia regional.
            </p>
          )}

          {kpiError && <div className="dashboardErrorBox">Error al cargar KPIs: {kpiError}</div>}

          <div className="dashboardKpiGroup">
            <h3 className="dashboardSubsectionTitle">Casos y dinámica</h3>
            <div className="kpiGrid">
              <KpiCard
                title="Total casos (Chagas)"
                value={totalCasosDisplay}
                icon="👥"
                color="#0d9488"
                loading={
                  refRegional
                    ? globalYear !== 'all'
                      ? geoLoading
                      : comunaLoading
                    : casesLoading
                }
                subtitle={
                  refRegional
                    ? globalYear !== 'all'
                      ? 'Comuna + año (mapa)'
                      : 'Filtrado por comuna (ranking)'
                    : globalYear === 'all'
                      ? `Período: ${dateFrom} → ${dateTo}`
                      : `Año ${globalYear} (${dateFrom} → ${dateTo})`
                }
              />
              <KpiCard
                title="Casos nuevos (mes)"
                value={nuevosEsteMes}
                icon="✨"
                color="#0d9488"
                loading={globalComuna.trim() ? geoLoading : casesLoading}
                subtitle={globalComuna.trim() ? 'Mes actual (mapa filtrado por comuna)' : 'Mes actual (serie temporal)'}
              />
            </div>
          </div>

          <div className="dashboardKpiGroup">
            <h3 className="dashboardSubsectionTitle">Programa y vigilancia</h3>
            <div className="kpiGrid">
              <KpiCard title="Total exámenes" value={kpiData?.total_examenes || 0} icon="🔬" color="#0d9488" loading={kpiLoading} />
              <KpiCard title="Bajo control" value={kpiData?.total_bajo_control || 0} icon="✅" color="#0d9488" loading={kpiLoading} />
              <KpiCard title="Casos agudos" value={kpiData?.total_agudo || 0} icon="⚠️" color="#f59e0b" loading={kpiLoading} />
              <KpiCard title="Gestantes" value={kpiData?.total_gestantes || 0} icon="🤰" color="#0d9488" loading={kpiLoading} />
              <KpiCard title="Inasistentes" value={kpiData?.total_inasistentes || 0} icon="📅" color="#ef4444" loading={kpiLoading} />
              <KpiCard title="Tratamientos" value={kpiData?.total_tratamientos || 0} icon="💊" color="#0d9488" loading={kpiLoading} />
            </div>
          </div>

          <div className="dashboardKpiGroup">
            <div className="dashboardSubsectionTitleRow">
              <h3 className="dashboardSubsectionTitle">Cobertura por condición</h3>
              <span className="dashboardInfoTooltip no-print">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver explicación de proporciones solapadas"
                  aria-describedby="coverage-overlap-tooltip"
                >
                  i
                </button>
                <span id="coverage-overlap-tooltip" role="tooltip" className="dashboardInfoTooltipBubble">
                  Una persona puede aparecer en más de una condición (por ejemplo, gestante y bajo control), por eso
                  estos porcentajes no necesariamente suman 100%.
                </span>
              </span>
            </div>
            <div className="kpiGrid">
              <KpiCard
                title="% Bajo control"
                value={loadingPercentages || !totalCasosForPercent ? 'N/A' : `${kpiPercentages.pctBajoControl.toFixed(1)} %`}
                icon="📈"
                color="#0d9488"
                loading={loadingPercentages}
                subtitle={refRegional ? 'Filtrado por comuna' : undefined}
              />
              <KpiCard
                title="% Casos agudos"
                value={loadingPercentages || !totalCasosForPercent ? 'N/A' : `${kpiPercentages.pctAgudo.toFixed(1)} %`}
                icon="⚠️"
                color="#f97316"
                loading={loadingPercentages}
                subtitle={refRegional ? 'Filtrado por comuna' : undefined}
              />
              <KpiCard
                title="% Gestantes"
                value={loadingPercentages || !totalCasosForPercent ? 'N/A' : `${kpiPercentages.pctGestantes.toFixed(1)} %`}
                icon="🤰"
                color="#0ea5e9"
                loading={loadingPercentages}
                subtitle={refRegional ? 'Filtrado por comuna' : undefined}
              />
            </div>
          </div>
        </section>

        {/* 3. Análisis: temporal + comunas */}
        <section className="dashboardSection dashboardAnalysisSection" aria-labelledby="analysis-heading">
          <div className="dashboardSectionActionsRow dashboardAnalysisHead">
            <div>
              <h2 id="analysis-heading" className="dashboardSectionTitle">
                Análisis temporal y por comuna
              </h2>
              <p className="dashboardSectionLead dashboardSectionLeadTight">
                Serie de casos, distribución por comuna y tabla ordenable.
              </p>
              <p className="print-only printPeriodLine">
                <strong>Período del gráfico temporal:</strong> {dateFrom} al {dateTo}
              </p>
            </div>
            <div className="dashboardSectionActions no-print">
              <button
                type="button"
                className="dashboardExportBtn"
                disabled={!casesData?.length && !prevCasesData?.length}
                onClick={() =>
                  exportCasesSeriesCsv(
                    casesData || [],
                    prevCasesData || [],
                    `casos_temporal_${dateFrom}_${dateTo}.csv`
                  )
                }
                aria-label="Exportar serie temporal de casos a CSV"
              >
                CSV — Casos
              </button>
              <button
                type="button"
                className="dashboardExportBtn"
                disabled={!comunaDataFiltered?.length}
                onClick={() =>
                  exportComunaRankingCsv(comunaDataFiltered || [], `casos_por_comuna_${mapYearFilter}.csv`)
                }
                aria-label="Exportar ranking por comuna a CSV"
              >
                CSV — Comunas
              </button>
            </div>
          </div>

          <div className="dashboardChartsGrid">
            <div className="dashboardChartColumn">
              {(casesError || prevCasesError) && (
                <div className="dashboardErrorBox">
                  {casesError && `Error casos: ${casesError}`}
                  {prevCasesError && ` · Error año anterior: ${prevCasesError}`}
                </div>
              )}
              <TendencyChart
                casesData={casesData || []}
                prevCasesData={prevCasesData || []}
                title="Casos en el tiempo"
                type="line"
                loading={casesLoading || prevCasesLoading}
                controls={
                  <div className="chartControls chartControlsDates">
                    <label className="chartControlsLabel" htmlFor="dash-date-from">
                      Desde
                    </label>
                    <input
                      id="dash-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      max={dateTo}
                      className="chartControlsInput"
                      disabled={globalYear !== 'all'}
                      aria-label="Fecha inicial del gráfico temporal"
                    />
                    <label className="chartControlsLabel" htmlFor="dash-date-to">
                      Hasta
                    </label>
                    <input
                      id="dash-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={dateFrom}
                      className="chartControlsInput"
                      disabled={globalYear !== 'all'}
                      aria-label="Fecha final del gráfico temporal"
                    />
                  </div>
                }
              />
              {globalYear !== 'all' && (
                <p className="chartFilterNote chartFilterNoteSpaced no-print">
                  Período fijado por el año en filtros. Elige &quot;Todos&quot; en año para ajustar fechas manualmente.
                </p>
              )}
            </div>

            <div className="dashboardChartColumn">
              {comunaError && <div className="dashboardErrorBox">Error: {comunaError}</div>}
              <ComunaBarChart
                data={comunaDataFiltered || []}
                title={globalComuna ? `Casos por comuna — ${globalComuna}` : 'Casos por comuna'}
                loading={comunaLoading}
                controls={<p className="chartFilterNote">Tipo, sexo y edad: filtros del panel superior.</p>}
              />
              <ComunaRankingTable data={comunaDataFiltered || []} loading={comunaLoading} />
            </div>
          </div>
        </section>

        {/* 4. Mapa */}
        <section className="dashboardSection dashboardMapSection no-print" aria-labelledby="map-heading">
          <div className="dashboardSectionHead">
            <h2 id="map-heading" className="dashboardSectionTitle">
              Mapa geográfico
            </h2>
            <p className="dashboardSectionLead">Puntos según filtros de año y perfil del caso; comuna recorta en pantalla.</p>
          </div>
          {geoError && <div className="dashboardErrorBox">Error al cargar puntos: {geoError}</div>}
          <div className="dashboardMapCard">
            <SimpleMap points={geoFiltered || []} loading={geoLoading} />
          </div>
        </section>

        {/* 5. Seguimiento clínico (último bloque operativo) */}
        <div className="no-print">
          <FollowupAlertsSection />
        </div>
      </main>
    </div>
  )
}
