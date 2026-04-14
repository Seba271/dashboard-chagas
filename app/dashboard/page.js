/**
 * Dashboard Chagas — orden: filtros → KPIs → análisis → mapa → seguimiento clínico.
 */

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useSession } from '@/src/hooks/useSession'
import { useKpiProgramFiltered } from '@/src/hooks/useKpiProgramFiltered'
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

/** Fecha local YYYY-MM-DD. */
function toLocalDateISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Hoy + N días (calendario local). */
function todayPlusDaysLocal(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toLocalDateISO(d)
}

function minDateStr(a, b) {
  return a <= b ? a : b
}

function getDefaultDates() {
  const today = new Date()
  const from = new Date(today)
  from.setMonth(from.getMonth() - 12)
  return {
    from: toLocalDateISO(from),
    to: todayPlusDaysLocal(3)
  }
}

/** Primera fecha con datos en casos_por_fecha (KPI); el «Hasta» se fija aparte (hoy + 3 días). */
function rangeFromCasosPorFecha(programKpi) {
  const cpf = programKpi?.casos_por_fecha
  if (!Array.isArray(cpf) || cpf.length === 0) return null
  const fechas = cpf
    .map((row) => {
      const f = row?.fecha
      if (typeof f === 'string') return f.slice(0, 10)
      if (f instanceof Date) return f.toISOString().slice(0, 10)
      return null
    })
    .filter(Boolean)
    .sort()
  if (fechas.length === 0) return null
  return { from: fechas[0] }
}

function comunaMatches(selected, comuna) {
  if (!selected || !String(selected).trim()) return true
  return (comuna || '').trim().toLowerCase() === String(selected).trim().toLowerCase()
}

/** Ranking por comuna a partir de los puntos del mapa (misma fuente que get_map_points: año + tipo + sexo + edad). */
function buildComunaRankingFromMapPoints(points) {
  if (!points?.length) return []
  const m = new Map()
  for (const p of points) {
    const raw = (p.comuna || '').trim()
    const c = raw || 'Sin comuna'
    m.set(c, (m.get(c) || 0) + 1)
  }
  return [...m.entries()]
    .map(([comuna, value]) => ({ comuna, value }))
    .sort((a, b) => b.value - a.value || a.comuna.localeCompare(b.comuna, 'es'))
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

  const mapYearFilter = globalYear === 'all' ? 'all' : globalYear

  const {
    data: programKpi,
    loading: programKpiLoading,
    error: programKpiError
  } = useKpiProgramFiltered(mapYearFilter, caseTypeFilter, sexFilter, ageGroupFilter, globalComuna)
  const {
    data: casesDataRaw,
    loading: casesLoading,
    error: casesError
  } = useCasesByDateRange(
    dateFrom,
    dateTo,
    globalYear,
    caseTypeFilter,
    sexFilter,
    ageGroupFilter,
    globalComuna
  )
  const { data: comunaData, loading: comunaLoading, error: comunaError } = useCountsByComuna(
    mapYearFilter,
    caseTypeFilter,
    sexFilter,
    ageGroupFilter
  )

  // Para recalcular porcentajes cuando hay comuna seleccionada.
  // Sin comuna, los porcentajes usan la misma base filtrada que el mapa / conteos por comuna (no get_kpi_summary).
  const { data: comunaCountsAll, loading: comunaCountsAllLoading, error: comunaCountsAllError } = useCountsByComuna(
    mapYearFilter,
    'all',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsBajo, loading: comunaCountsBajoLoading, error: comunaCountsBajoError } = useCountsByComuna(
    mapYearFilter,
    'bajo_control',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsAgudo, loading: comunaCountsAgudoLoading, error: comunaCountsAgudoError } = useCountsByComuna(
    mapYearFilter,
    'agudo',
    sexFilter,
    ageGroupFilter
  )
  const { data: comunaCountsGestantes, loading: comunaCountsGestantesLoading, error: comunaCountsGestantesError } = useCountsByComuna(
    mapYearFilter,
    'gestante',
    sexFilter,
    ageGroupFilter
  )

  /** Una sola carga: todos los tipos; el mapa y el ranking filtran por tipo en cliente (categoría = tipo). */
  const { data: geoPoints, loading: geoLoading, error: geoError, refetch: refetchMapPoints } = useMapPoints(
    mapYearFilter,
    'all',
    sexFilter,
    ageGroupFilter
  )

  const mapPointsForDisplay = useMemo(() => {
    if (!geoPoints?.length) return []
    if (caseTypeFilter === 'all') return geoPoints
    return geoPoints.filter((p) => (p.category || '') === caseTypeFilter)
  }, [geoPoints, caseTypeFilter])

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

  /**
   * Ajusta Desde/Hasta del gráfico temporal: si el KPI trae casos_por_fecha, «Desde» = primera fecha;
   * «Hasta» = hoy + 3 días (acotado al 31 dic del año si hay año fijo). Sin KPI: «Todos» → últimos
   * 12 meses hasta hoy+3; año fijo → 1 ene … min(31 dic, hoy+3).
   */
  useEffect(() => {
    if (programKpiLoading) return

    const r = rangeFromCasosPorFecha(programKpi)
    if (r) {
      setDateFrom(r.from)
      const hasta = todayPlusDaysLocal(3)
      if (globalYear === 'all') {
        setDateTo(hasta)
      } else {
        const y = parseInt(globalYear, 10)
        if (!Number.isNaN(y)) {
          setDateTo(minDateStr(hasta, `${y}-12-31`))
        }
      }
      return
    }

    if (globalYear === 'all') {
      const d = getDefaultDates()
      setDateFrom(d.from)
      setDateTo(d.to)
      return
    }

    const y = parseInt(globalYear, 10)
    if (Number.isNaN(y)) return
    const hasta = todayPlusDaysLocal(3)
    setDateFrom(`${y}-01-01`)
    setDateTo(minDateStr(hasta, `${y}-12-31`))
  }, [
    globalYear,
    programKpi,
    programKpiLoading,
    caseTypeFilter,
    sexFilter,
    ageGroupFilter,
    globalComuna
  ])

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

  /**
   * Con año ≠ «Todos», el RPC get_counts_by_comuna a menudo no aplica p_year en la BD.
   * Usamos la misma muestra que el mapa (get_map_points) para que el ranking coincida con año/tipo/sexo/edad.
   */
  const comunaRankingRows = useMemo(() => {
    if (globalYear === 'all') return comunaData ?? []
    return buildComunaRankingFromMapPoints(mapPointsForDisplay)
  }, [globalYear, comunaData, mapPointsForDisplay])

  const comunaSectionLoading = globalYear === 'all' ? comunaLoading : geoLoading
  const comunaSectionError = globalYear === 'all' ? comunaError : geoError

  const comunaOptions = useMemo(() => {
    if (!comunaRankingRows?.length) return []
    const set = new Set(comunaRankingRows.map((r) => r.comuna).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [comunaRankingRows])

  const comunaDataFiltered = useMemo(() => {
    if (!comunaRankingRows?.length) return []
    if (!globalComuna.trim()) return comunaRankingRows
    return comunaRankingRows.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [comunaRankingRows, globalComuna])

  const geoFiltered = useMemo(() => {
    if (!mapPointsForDisplay?.length) return []
    if (!globalComuna.trim()) return mapPointsForDisplay
    return mapPointsForDisplay.filter((p) => comunaMatches(globalComuna, p.comuna))
  }, [mapPointsForDisplay, globalComuna])

  /**
   * Con año fijo, «Total casos» y el mapa usan get_map_points; la serie usa fecha de registro
   * (get_cases_by_date_range = creado_en, alineado a casos_por_fecha del KPI). Si el mapa no tiene
   * puntos para ese año/filtro, vaciamos la serie para no contradecir el contador en cero.
   */
  const casesData = useMemo(() => {
    if (globalYear === 'all') return casesDataRaw
    if (geoLoading) return casesDataRaw
    const noMapPoints = globalComuna.trim() ? geoFiltered.length === 0 : mapPointsForDisplay.length === 0
    if (noMapPoints) return []
    return casesDataRaw ?? []
  }, [
    globalYear,
    geoLoading,
    globalComuna,
    geoFiltered,
    mapPointsForDisplay,
    casesDataRaw
  ])

  const casesChartLoading = casesLoading || (globalYear !== 'all' && geoLoading)

  /** Puntos en la comuna elegida (todos los tipos) — para % cobertura con año filtrado. */
  const geoInComunaAllTypes = useMemo(() => {
    if (!globalComuna.trim() || !geoPoints?.length) return []
    return geoPoints.filter((p) => comunaMatches(globalComuna, p.comuna))
  }, [globalComuna, geoPoints])

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

  const sumRankingValues = useCallback((rows) => (rows || []).reduce((s, r) => s + (Number(r.value) || 0), 0), [])

  /**
   * Total casos (Chagas) alineado a filtros del panel: año, tipo, sexo, edad y comuna.
   * Misma base que mapa + ranking (get_map_points con año fijo; get_counts_by_comuna con «Todos»).
   */
  const totalCasosDisplay = useMemo(() => {
    if (globalComuna.trim()) {
      if (globalYear !== 'all') return geoFiltered.length
      return sumRankingValues(comunaDataFiltered)
    }
    if (globalYear !== 'all') return mapPointsForDisplay.length
    return sumRankingValues(comunaData)
  }, [
    globalComuna,
    globalYear,
    geoFiltered,
    comunaDataFiltered,
    mapPointsForDisplay,
    comunaData,
    sumRankingValues
  ])

  const totalCasosFilteredLoading = useMemo(() => {
    if (globalYear !== 'all') return geoLoading
    return comunaLoading
  }, [globalYear, geoLoading, comunaLoading])

  const totalCasosCardSubtitle = useMemo(() => {
    const parts = []
    if (globalYear !== 'all') parts.push(`Año ${globalYear}`)
    else parts.push('Todos los años')
    if (caseTypeFilter !== 'all') parts.push(`Tipo: ${caseTypeFilter}`)
    if (sexFilter !== 'all') parts.push(`Sexo: ${sexFilter}`)
    if (ageGroupFilter !== 'all') parts.push(`Edad: ${ageGroupFilter}`)
    if (globalComuna.trim()) parts.push(`Comuna: ${globalComuna.trim()}`)
    else parts.push('Región (suma comunas / mapa)')
    return parts.join(' · ')
  }, [globalYear, caseTypeFilter, sexFilter, ageGroupFilter, globalComuna])

  /**
   * Con año fijo, bajo/agudo/gestantes deben coincidir con get_map_points (mismo criterio que total casos).
   * El RPC get_kpi_program_filtered puede desalinearse; exámenes/inasist./trat. siguen en BD y se anulan si el mapa no trae casos en ese año/filtro.
   */
  const programVigilanciaLoading =
    globalYear !== 'all' ? geoLoading || programKpiLoading : programKpiLoading

  const programVigilanciaTotals = useMemo(() => {
    if (globalYear === 'all') {
      return {
        total_bajo_control: programKpi?.total_bajo_control ?? 0,
        total_agudo: programKpi?.total_agudo ?? 0,
        total_gestantes: programKpi?.total_gestantes ?? 0,
        total_examenes: programKpi?.total_examenes ?? 0,
        total_inasistentes: programKpi?.total_inasistentes ?? 0,
        total_tratamientos: programKpi?.total_tratamientos ?? 0
      }
    }
    if (geoLoading) {
      return {
        total_bajo_control: 0,
        total_agudo: 0,
        total_gestantes: 0,
        total_examenes: 0,
        total_inasistentes: 0,
        total_tratamientos: 0
      }
    }
    const pts = (geoPoints || []).filter((p) =>
      globalComuna.trim() ? comunaMatches(globalComuna, p.comuna) : true
    )
    const byCat = (cat) => pts.filter((p) => (p.category || '') === cat).length
    const noMapCases = pts.length === 0
    return {
      total_bajo_control: byCat('bajo_control'),
      total_agudo: byCat('agudo'),
      total_gestantes: byCat('gestante'),
      total_examenes: noMapCases ? 0 : (programKpi?.total_examenes ?? 0),
      total_inasistentes: noMapCases ? 0 : (programKpi?.total_inasistentes ?? 0),
      total_tratamientos: noMapCases ? 0 : (programKpi?.total_tratamientos ?? 0)
    }
  }, [globalYear, geoLoading, geoPoints, globalComuna, programKpi])

  const refRegional = !!globalComuna.trim()

  const selectedCountsAll = useMemo(() => {
    if (!refRegional) return []
    if (globalYear !== 'all') {
      const n = geoInComunaAllTypes.length
      return n ? [{ comuna: globalComuna.trim(), value: n }] : []
    }
    if (!comunaCountsAll?.length) return []
    return comunaCountsAll.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, globalYear, geoInComunaAllTypes, globalComuna, comunaCountsAll])

  const selectedCountsBajo = useMemo(() => {
    if (!refRegional) return []
    if (globalYear !== 'all') {
      const n = geoInComunaAllTypes.filter((p) => p.category === 'bajo_control').length
      return n ? [{ comuna: globalComuna.trim(), value: n }] : []
    }
    if (!comunaCountsBajo?.length) return []
    return comunaCountsBajo.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, globalYear, geoInComunaAllTypes, globalComuna, comunaCountsBajo])

  const selectedCountsAgudo = useMemo(() => {
    if (!refRegional) return []
    if (globalYear !== 'all') {
      const n = geoInComunaAllTypes.filter((p) => p.category === 'agudo').length
      return n ? [{ comuna: globalComuna.trim(), value: n }] : []
    }
    if (!comunaCountsAgudo?.length) return []
    return comunaCountsAgudo.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, globalYear, geoInComunaAllTypes, globalComuna, comunaCountsAgudo])

  const selectedCountsGestantes = useMemo(() => {
    if (!refRegional) return []
    if (globalYear !== 'all') {
      const n = geoInComunaAllTypes.filter((p) => p.category === 'gestante').length
      return n ? [{ comuna: globalComuna.trim(), value: n }] : []
    }
    if (!comunaCountsGestantes?.length) return []
    return comunaCountsGestantes.filter((r) => comunaMatches(globalComuna, r.comuna))
  }, [refRegional, globalYear, geoInComunaAllTypes, globalComuna, comunaCountsGestantes])

  const totalCasosForPercent = useMemo(() => {
    if (!refRegional) {
      if (globalYear !== 'all') return geoPoints?.length ?? 0
      return sumRankingValues(comunaCountsAll)
    }
    if (globalYear !== 'all') return geoInComunaAllTypes.length
    return totalCasosDisplay
  }, [
    refRegional,
    globalYear,
    geoPoints,
    comunaCountsAll,
    geoInComunaAllTypes,
    totalCasosDisplay,
    sumRankingValues
  ])

  const bajoForPercent = useMemo(() => {
    if (!refRegional) {
      if (globalYear !== 'all') return (geoPoints || []).filter((p) => p.category === 'bajo_control').length
      return sumRankingValues(comunaCountsBajo)
    }
    return selectedCountsBajo.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, globalYear, geoPoints, comunaCountsBajo, selectedCountsBajo, sumRankingValues])

  const agudoForPercent = useMemo(() => {
    if (!refRegional) {
      if (globalYear !== 'all') return (geoPoints || []).filter((p) => p.category === 'agudo').length
      return sumRankingValues(comunaCountsAgudo)
    }
    return selectedCountsAgudo.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, globalYear, geoPoints, comunaCountsAgudo, selectedCountsAgudo, sumRankingValues])

  const gestantesForPercent = useMemo(() => {
    if (!refRegional) {
      if (globalYear !== 'all') return (geoPoints || []).filter((p) => p.category === 'gestante').length
      return sumRankingValues(comunaCountsGestantes)
    }
    return selectedCountsGestantes.reduce((s, r) => s + (Number(r.value) || 0), 0)
  }, [refRegional, globalYear, geoPoints, comunaCountsGestantes, selectedCountsGestantes, sumRankingValues])

  const loadingPercentages = refRegional
    ? globalYear !== 'all'
      ? geoLoading
      : comunaLoading ||
        comunaCountsAllLoading ||
        comunaCountsBajoLoading ||
        comunaCountsAgudoLoading ||
        comunaCountsGestantesLoading
    : globalYear !== 'all'
      ? geoLoading
      : comunaLoading ||
        comunaCountsAllLoading ||
        comunaCountsBajoLoading ||
        comunaCountsAgudoLoading ||
        comunaCountsGestantesLoading

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
            <div className="dashboardSectionLeadRow no-print">
              <span className="dashboardSectionLeadLabel">Fuentes de cada bloque</span>
              <span className="dashboardInfoTooltip">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver cómo se relacionan los indicadores con el panel y el gráfico"
                  aria-describedby="kpi-main-sources-tooltip"
                >
                  i
                </button>
                <span id="kpi-main-sources-tooltip" role="tooltip" className="dashboardInfoTooltipBubble">
                  El total de la primera tarjeta, las proporciones de cobertura y el bloque &quot;Programa y
                  vigilancia&quot; siguen año, tipo, sexo, edad y comuna del panel (vía mapa / ranking y base de datos).
                  La serie temporal y &quot;Casos nuevos&quot; siguen el gráfico.
                </span>
              </span>
            </div>
          </div>

          {refRegional && (
            <p className="dashboard-kpi-hint no-print">
              Con comuna, el total, las proporciones y los KPI de programa se limitan a esa comuna.
            </p>
          )}

          {programKpiError && (
            <div className="dashboardErrorBox">Error al cargar KPIs de programa: {programKpiError}</div>
          )}

          <div className="dashboardKpiGroup">
            <h3 className="dashboardSubsectionTitle">Casos y dinámica</h3>
            <div className="kpiGrid">
              <KpiCard
                title="Total casos (Chagas)"
                value={totalCasosDisplay}
                icon="👥"
                color="#0d9488"
                loading={totalCasosFilteredLoading}
                subtitle={totalCasosCardSubtitle}
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
            <div className="dashboardSubsectionTitleRow">
              <h3 className="dashboardSubsectionTitle">Programa y vigilancia</h3>
              <span className="dashboardInfoTooltip no-print">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver cómo se calculan las tarjetas de programa y vigilancia"
                  aria-describedby="programa-vigilancia-tooltip"
                >
                  i
                </button>
                <span id="programa-vigilancia-tooltip" role="tooltip" className="dashboardInfoTooltipBubble">
                  Con año fijado, bajo control, agudos y gestantes cuentan igual que los puntos del mapa. Exámenes,
                  inasistencias y tratamientos salen de la base; si para ese año no hay ningún caso en el mapa con los
                  filtros actuales, esas tres tarjetas se muestran en 0. Con «Todos» en año, las seis tarjetas siguen el
                  resumen filtrado en el servidor.
                </span>
              </span>
            </div>
            <div className="kpiGrid">
              <KpiCard
                title="Total exámenes"
                value={programVigilanciaTotals.total_examenes || 0}
                icon="🔬"
                color="#0d9488"
                loading={programVigilanciaLoading}
              />
              <KpiCard
                title="Bajo control"
                value={programVigilanciaTotals.total_bajo_control || 0}
                icon="✅"
                color="#0d9488"
                loading={programVigilanciaLoading}
              />
              <KpiCard
                title="Casos agudos"
                value={programVigilanciaTotals.total_agudo || 0}
                icon="⚠️"
                color="#f59e0b"
                loading={programVigilanciaLoading}
              />
              <KpiCard
                title="Gestantes"
                value={programVigilanciaTotals.total_gestantes || 0}
                icon="🤰"
                color="#0d9488"
                loading={programVigilanciaLoading}
              />
              <KpiCard
                title="Inasistentes"
                value={programVigilanciaTotals.total_inasistentes || 0}
                icon="📅"
                color="#ef4444"
                loading={programVigilanciaLoading}
              />
              <KpiCard
                title="Tratamientos"
                value={programVigilanciaTotals.total_tratamientos || 0}
                icon="💊"
                color="#0d9488"
                loading={programVigilanciaLoading}
              />
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
                disabled={!casesData?.length}
                onClick={() =>
                  exportCasesSeriesCsv(
                    casesData || [],
                    [],
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
              {casesError && (
                <div className="dashboardErrorBox">
                  {`Error casos: ${casesError}`}
                </div>
              )}
              <TendencyChart
                casesData={casesData || []}
                prevCasesData={[]}
                rangeFrom={dateFrom}
                rangeTo={dateTo}
                title="Casos en el tiempo"
                type="line"
                loading={casesChartLoading}
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
            </div>

            <div className="dashboardChartColumn">
              {comunaSectionError && <div className="dashboardErrorBox">Error: {comunaSectionError}</div>}
              <ComunaBarChart
                data={comunaDataFiltered || []}
                title={globalComuna ? `Casos por comuna — ${globalComuna}` : 'Casos por comuna'}
                loading={comunaSectionLoading}
                controls={
                  <p className="chartFilterNote">
                    {globalYear === 'all'
                      ? 'Tipo, sexo y edad: filtros del panel superior (datos desde ranking).'
                      : 'Misma muestra que el mapa para el año y filtros elegidos (puntos geográficos).'}
                  </p>
                }
              />
            </div>

            <div className="dashboardChartColumn dashboardChartColumn--full">
              <ComunaRankingTable data={comunaDataFiltered || []} loading={comunaSectionLoading} />
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
